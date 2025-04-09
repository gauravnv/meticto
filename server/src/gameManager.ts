import {
    GameState,
    Player,
    LargeBoardCellState,
    SmallBoardState,
    GameStatus,
} from "./types";
import { checkWinner } from "./utils/gameLogic";
import { isSmallBoardFinished } from "./types";
import { Socket, Server as SocketIOServer } from "socket.io";

interface PlayerInfo {
    socketId: string;
    role: Player;
}
type RoomStatus = "Waiting" | "Playing" | "Finished";
interface GameRoom {
    roomId: string;
    roomName: string;
    status: RoomStatus;
    players: [PlayerInfo | null, PlayerInfo | null];
    gameState: GameState;
    spectators: Set<string>;
    rematchRequested: [boolean, boolean];
    turnDuration: number | null;
    activeTurnTimer: NodeJS.Timeout | null;
}
export interface RoomInfo {
    roomId: string;
    roomName: string;
    playerCount: number;
    spectatorCount: number; 
    status: RoomStatus;
}

// --- Initial State Logic ---
const createEmptySmallBoard = (): SmallBoardState => Array(9).fill(null);
const createInitialLargeBoardCell = (): LargeBoardCellState => ({
    status: "InProgress",
    cells: createEmptySmallBoard(),
    winningLine: null,
});
const createInitialGameState = (): GameState => ({
    largeBoard: Array(9).fill(null).map(createInitialLargeBoardCell),
    currentPlayer: "X",
    activeBoardIndex: null,
    gameStatus: "InProgress",
    largeWinningLine: null,
});

// --- GameManager Class ---
export class GameManager {
    private io: SocketIOServer;
    private gameRooms = new Map<string, GameRoom>();
    private socketIdToRoomId = new Map<string, string>();

    private getSocketIdFromRoomId(roomId: string): string | null {
        for (const [socketId, id] of this.socketIdToRoomId.entries()) {
            if (id === roomId) {
                return socketId;
            }
        }
        return null;
    }

    private getRoomIdFromSocketId(socketId: string): string | null {
        return this.socketIdToRoomId.get(socketId) || null;
    }

    constructor(io: SocketIOServer) {
        this.io = io;
    }

    // --- Room Management ---
    private broadcastRoomList(targetSocket?: Socket) {
        const roomList: RoomInfo[] = [];
        this.gameRooms.forEach((room, roomId) => {
            // Check if status allows listing (Waiting, Playing, Finished)
            if (room.status === 'Waiting' || room.status === 'Playing' || room.status === 'Finished') {
                roomList.push({
                    roomId: room.roomId,
                    roomName: room.roomName || `Room ${room.roomId}`,
                    playerCount: room.players.filter(p => p !== null).length,
                    spectatorCount: room.spectators.size,
                    status: room.status,
                });
            } else {
                 console.log(`    ... Skipping room ${roomId} due to status ${room.status}.`); // Log if skipped
            }
        });

        console.log("Broadcasting room list update:", roomList);
        const eventName = "ROOM_LIST_UPDATE";
        if (targetSocket) {
            targetSocket.emit(eventName, roomList);
        } else {
            this.io.emit(eventName, roomList);
        }
    }

    handleCreateRoom(socket: Socket, roomOptions?: { roomName?: string, duration?: number }) { // Expect options object
        const socketId = socket.id;
        if (this.socketIdToRoomId.has(socketId)) {
            socket.emit("ERROR_MESSAGE", "Already in a room.");
            return;
        }
        const roomId = this.generateRoomId();
        const playerXInfo: PlayerInfo = { socketId, role: "X" };

        // --- Validate and set turn duration ---
        const allowedDurations = [15, 30, 60]; // Allowed seconds
        let validatedDuration: number | null = null;
        if (roomOptions?.duration && allowedDurations.includes(roomOptions.duration)) {
            validatedDuration = roomOptions.duration;
        } else if (roomOptions?.duration) {
            console.warn(`[${roomId}] Received invalid duration ${roomOptions.duration}. Defaulting to None.`);
        }
        // ---

        const newRoom: GameRoom = {
            roomId,
            roomName: this.sanitizeRoomName(roomOptions?.roomName) || `Room ${roomId}`,
            status: "Waiting",
            players: [playerXInfo, null],
            gameState: createInitialGameState(),
            spectators: new Set(),
            rematchRequested: [false, false],
            turnDuration: validatedDuration, // Store the validated duration
            activeTurnTimer: null,
        };
        this.gameRooms.set(roomId, newRoom);
        this.socketIdToRoomId.set(socketId, roomId);
        socket.join(roomId); // *** Make sure socket joins the room ***

        console.log(`[${roomId}] Room "${newRoom.roomName}" created. Turn duration: ${validatedDuration ?? 'None'} seconds.`);

        socket.emit("YOUR_ROLE", "X");
        socket.emit("ROOM_JOINED", {
            roomId,
            initialState: newRoom.gameState,
            roomName: newRoom.roomName,
            // Optionally send duration back if needed: turnDuration: newRoom.turnDuration
        });
        this.broadcastRoomList();
    }

    handleJoinRoom(socket: Socket, roomId: string) {
        const socketId = socket.id;
        const room = this.gameRooms.get(roomId);

        if (this.socketIdToRoomId.has(socketId)) {
            socket.emit("ERROR_MESSAGE", "Already in a room.");
            return;
        }
        if (!room) {
            socket.emit("ERROR_MESSAGE", `Room '${roomId}' not found.`);
            return;
        }

        // --- Try joining as Player O ---
        if (room.status === "Waiting" && room.players[1] === null) {
            console.log(`Socket ${socket.id} joining room ${roomId} as Player O.`);
             const playerOInfo: PlayerInfo = { socketId: socket.id, role: 'O' };
             room.players[1] = playerOInfo;
             room.status = 'Playing';
             console.log(`[${roomId}] Room status updated to: ${room.status}`);
             this.socketIdToRoomId.set(socket.id, roomId);
             socket.join(roomId);
             socket.emit('YOUR_ROLE', 'O');
             socket.emit('ROOM_JOINED', { roomId, initialState: room.gameState, roomName: room.roomName });

             const playerX = room.players[0];
             if (playerX) {
                 // Notify Player X game is starting
                 this.io.sockets.sockets.get(playerX.socketId)?.emit('GAME_START', { opponentId: socket.id });
             }

             this.broadcastRoomList(); // Update list (room no longer waiting)
             this.io.to(roomId).emit('PLAYER_ASSIGNMENT', { playerX: room.players[0]?.socketId, playerO: room.players[1]?.socketId });
             this.io.to(roomId).emit('SPECTATOR_COUNT_UPDATE', { count: room.spectators.size });

             // *** Start the timer for the first turn (Player X) ***
             this.startTurnTimer(room);
        } else if (room.status === "Playing" || room.status === "Finished") {
            // --- Join as Spectator ---
            if (room.players.some(p => p?.socketId === socket.id)) {
                socket.emit('ERROR_MESSAGE', 'You are already a player in this room.'); return;
           }
           room.spectators.add(socket.id);
           this.socketIdToRoomId.set(socket.id, roomId);
           socket.join(roomId);
           socket.emit('YOUR_ROLE', null); // Spectator role
           // Use ROOM_JOINED like players for consistency
           socket.emit('ROOM_JOINED', { roomId, initialState: room.gameState, roomName: room.roomName });
           // Notify room of spectator count change
           this.io.to(roomId).emit('SPECTATOR_COUNT_UPDATE', { count: room.spectators.size });
        } else {
            socket.emit(
                "ERROR_MESSAGE",
                `Cannot join room '${room.roomName || roomId}': Status is ${room.status}.`
            );
        }
    }

    handleLeaveRoom(socket: Socket) {
        const socketId = socket.id;
        const roomId = this.socketIdToRoomId.get(socketId);
        if (!roomId) return;
        const room = this.gameRooms.get(roomId);
        if (!room) {
            this.socketIdToRoomId.delete(socketId);
            return;
        }
        socket.leave(roomId); // *** Leave socket.io room ***
        this.socketIdToRoomId.delete(socketId); // Remove mapping *after* potential cleanup

        const playerIndex = room.players.findIndex((p) => p?.socketId === socketId);
        if (playerIndex !== -1) {
            // Player leaving - triggers cleanup which includes clearing timer
            this.handlePlayerDisconnectCleanup(socket, room, playerIndex);
        } else if (room.spectators.delete(socketId)) {
            // Spectator leaving
            this.io.to(roomId).emit("SPECTATOR_COUNT_UPDATE", { count: room.spectators.size });
            // No need to broadcast room list just for spectator leaving
        }
    }

    // --- Connection & Disconnection ---
    handleNewConnection(socket: Socket) {
        const socketId = socket.id;
        console.log(`User connected: ${socketId}`);
        this.broadcastRoomList(socket); // Send available rooms
    }

    handleDisconnect(socket: Socket) {
        const socketId = socket.id;
        const roomId = this.socketIdToRoomId.get(socketId);
        if (roomId) {
            const room = this.gameRooms.get(roomId);
            if (room) {
                const playerIndex = room.players.findIndex(
                    (p) => p?.socketId === socketId
                );
                if (playerIndex !== -1) {
                    // Player disconnected - triggers cleanup which includes clearing timer
                    this.handlePlayerDisconnectCleanup(socket, room, playerIndex);
                } else {
                    // Spectator disconnected
                    if (room.spectators.delete(socketId)) {
                        console.log(
                            `Spectator ${socketId} removed from room ${roomId} on disconnect.`
                        );
                        this.io.to(roomId).emit("SPECTATOR_COUNT_UPDATE", { count: room.spectators.size });
                    }
                    // No need to leave room, socket is already disconnected
                }
            } else {
                console.log(
                    `Disconnect: Room ${roomId} not found for socket ${socketId}.`
                );
            }
             // Remove mapping regardless of role after handling
             this.socketIdToRoomId.delete(socketId);
        } else {
            console.log(`Socket ${socketId} disconnected without being in a room.`);
        }
    }

    private handlePlayerDisconnectCleanup(
        socket: Socket,
        room: GameRoom,
        playerIndex: number
    ) {
        const socketId = room.players[playerIndex]?.socketId; // Get ID from room data
        const roomId = room.roomId;
        console.log(
            `Player ${room.players[playerIndex]?.role} (${socketId}) left/disconnected room ${roomId}. Cleaning up.`
        );

        // --- Clear timer FIRST ---
        this.clearTurnTimer(room);

        const opponentIndex = playerIndex === 0 ? 1 : 0;
        const opponent = room.players[opponentIndex];
        if (opponent) {
            const opponentSocket = this.io.sockets.sockets.get(opponent.socketId);
            if (opponentSocket) {
                console.log(`Notifying opponent ${opponent.socketId} in room ${roomId}.`);
                // Use the specific event client expects
                opponentSocket.emit('OPPONENT_DISCONNECTED', 'Your opponent left the game.');
                // Optionally force opponent back to lobby? For now, let client handle it.
            }
        }

        // Notify spectators
        if (room.spectators.size > 0) {
            console.log(`[${roomId}] Notifying ${room.spectators.size} spectators game ended due to player disconnect.`);
            room.spectators.forEach(spectatorId => {
                const spectatorSocket = this.io.sockets.sockets.get(spectatorId);
                // Send event client expects
                spectatorSocket?.emit('GAME_ENDED_BY_DISCONNECT', { roomId });
                // Let client handle leaving the room view / returning to lobby
            });
        }

        // Cleanup the room state entirely (removes mappings, deletes room, broadcasts list)
        this.cleanupRoom(roomId);
        console.log(`Room ${roomId} fully cleaned up after player disconnect/leave.`);
    }

    // --- Game Actions ---
    handleAttemptMove(
        socketId: string,
        data: { largeBoardIdx: number; smallBoardIdx: number }
    ) {
        const roomId = this.socketIdToRoomId.get(socketId);
        const room = roomId ? this.gameRooms.get(roomId) : null;

        // --- Basic Checks ---
        if (!room) {
            console.log(`[${roomId}] Move attempt ignored: Not in room.`); // Simplified log
            return;
        }
        if (room.status !== "Playing") {
            console.log(
                `[${roomId}] Move attempt ignored: Room status is ${room.status}.`
            );
            return;
        }

        // --- Create a DEEP COPY of the state to modify ---
        let nextGameState: GameState = structuredClone(room.gameState);

        const expectedPlayer = nextGameState.currentPlayer;
        let actualPlayerRole: Player | null = null;
        if (socketId === room.players[0]?.socketId) actualPlayerRole = "X";
        if (socketId === room.players[1]?.socketId) actualPlayerRole = "O";

        // --- Validation (Operate on the COPY - nextGameState) ---
        if (actualPlayerRole !== expectedPlayer) {
            console.log(`[${roomId}] Validation Failed: Not ${expectedPlayer}'s turn (Attempt by: ${actualPlayerRole || 'Spectator?'}).`);
            this.sendErrorToSocket(socketId, "Not your turn."); // Send specific error
            return;
        }
        const { largeBoardIdx, smallBoardIdx } = data;
        if (
            largeBoardIdx < 0 ||
            largeBoardIdx > 8 ||
            smallBoardIdx < 0 ||
            smallBoardIdx > 8
        ) {
            console.log(`[${roomId}] Validation Failed: Invalid index.`);
             this.sendErrorToSocket(socketId, "Invalid move index.");
            return;
        }
        const currentLargeBoardCell = nextGameState.largeBoard[largeBoardIdx]; // Check copy
        if (nextGameState.gameStatus !== "InProgress") {
            console.log(`[${roomId}] Validation Failed: Game over.`);
             this.sendErrorToSocket(socketId, "Game is already over.");
            return;
        }
        if (
            nextGameState.activeBoardIndex !== null &&
            nextGameState.activeBoardIndex !== largeBoardIdx
        ) {
            console.log(`[${roomId}] Validation Failed: Wrong board (Expected: ${nextGameState.activeBoardIndex}, Got: ${largeBoardIdx}).`);
            this.sendErrorToSocket(socketId, `Must play in board ${nextGameState.activeBoardIndex + 1}.`);
            return;
        }
        if (isSmallBoardFinished(currentLargeBoardCell.status)) {
            console.log(`[${roomId}] Validation Failed: Board ${largeBoardIdx} finished.`);
            this.sendErrorToSocket(socketId, `Board ${largeBoardIdx + 1} is already finished.`);
            return;
        }
        if (currentLargeBoardCell.cells[smallBoardIdx] !== null) {
            console.log(`[${roomId}] Validation Failed: Cell taken.`);
             this.sendErrorToSocket(socketId, "Cell already taken.");
            return;
        }

        // --- Clear existing timer BEFORE processing move ---
        this.clearTurnTimer(room);

        // --- Apply Move (on copy) ---
        const targetCell = nextGameState.largeBoard[largeBoardIdx]; // Target the cell in the copy
        targetCell.cells[smallBoardIdx] = expectedPlayer;

        // Check Small Board Win/Draw (on copy)
        const smallBoardResult = checkWinner(targetCell.cells);
        let smallBoardFinished = false;
        if (smallBoardResult.winner) {
            targetCell.status = smallBoardResult.winner;
            targetCell.winningLine = smallBoardResult.winningLine;
            smallBoardFinished = true;
        } else if (smallBoardResult.isDraw) {
            targetCell.status = "Draw";
            targetCell.winningLine = null;
            smallBoardFinished = true;
        } else {
            targetCell.winningLine = null;
        }

        // Check Large Board Win/Draw (on copy)
        if (smallBoardFinished) {
            const largeBoardStatuses = nextGameState.largeBoard.map(
                (cell) => cell.status
            );
            const largeBoardResult = checkWinner(largeBoardStatuses);
            if (largeBoardResult.winner) {
                nextGameState.gameStatus = largeBoardResult.winner;
                nextGameState.largeWinningLine = largeBoardResult.winningLine;
                nextGameState.activeBoardIndex = null; // Game over, no active board
            } else if (largeBoardResult.isDraw) {
                nextGameState.gameStatus = "Draw";
                nextGameState.largeWinningLine = null;
                nextGameState.activeBoardIndex = null; // Game over, no active board
            }
            // No 'else' needed here for large board, winningLine defaults to null
        }

        // Determine Next Active Board & Switch Player (on copy) - Only if game still in progress
        if (nextGameState.gameStatus === "InProgress") {
            const nextActiveBoardIdx = smallBoardIdx; // The cell played determines the next board
            const nextBoardStatus = nextGameState.largeBoard[nextActiveBoardIdx]?.status;
            // Check if the *next* board is already finished
            const nextBoardIsFinished = isSmallBoardFinished(nextBoardStatus);
            nextGameState.activeBoardIndex = nextBoardIsFinished ? null : nextActiveBoardIdx;
            nextGameState.currentPlayer = expectedPlayer === "X" ? "O" : "X";
        } else {
            // Game has ended, ensure no active board and player doesn't switch
            nextGameState.activeBoardIndex = null;
            // Keep currentPlayer as the one who made the winning/drawing move? Or clear?
            // Let's keep it as the player who made the last move for now.
        }

        // --- Update the room's actual game state with the modified copy ---
        room.gameState = nextGameState; // Assign the updated copy back

        // Update room status if game ended
        if (room.gameState.gameStatus !== 'InProgress' && room.status === 'Playing') {
            console.log(`[${roomId}] Game finished (${room.gameState.gameStatus}). Setting room status to Finished.`);
            room.status = 'Finished';
            this.broadcastRoomList(); // Broadcast updated room list
        }

        // --- Broadcast the NEWLY ASSIGNED state ---
        this.io.to(roomId!).emit("GAME_STATE_UPDATE", room.gameState);

        // --- Start timer for the NEXT player (if applicable) ---
        if (room.gameState.gameStatus === 'InProgress') {
            this.startTurnTimer(room); // Start timer for the player whose turn it now is
        } else {
            // Ensure timer display is cleared if game ended on this move
            this.io.to(roomId!).emit('TURN_TIMER_UPDATE', null);
       }
    }

    handleRematchRequest(socketId: string) {
        const roomId = this.socketIdToRoomId.get(socketId);
        const room = roomId ? this.gameRooms.get(roomId) : null;
        if (!room) { console.log(`Rematch request ignored: Not in room ${roomId}.`); return; }
        // Allow request only if game is Finished
        if (room.status !== 'Finished') { console.log(`[${roomId}] Rematch request ignored: Game status is ${room.status}.`); return; }

        const playerIndex = room.players.findIndex(p => p?.socketId === socketId);
        if (playerIndex === -1) { console.log(`[${roomId}] Rematch request ignored: Requester ${socketId} not player.`); return; }

        const requestingPlayerRole = room.players[playerIndex]?.role; // 'X' or 'O'
        console.log(`[${roomId}] Received rematch request from Player ${requestingPlayerRole} (${socketId})`);

        // Mark this player as wanting rematch
        room.rematchRequested[playerIndex] = true;

        // Notify opponent
        const opponentIndex = playerIndex === 0 ? 1 : 0;
        const opponent = room.players[opponentIndex];
        if (opponent) {
            const opponentSocket = this.io.sockets.sockets.get(opponent.socketId);
            // Send event telling opponent that player X/O wants a rematch
            opponentSocket?.emit('OPPONENT_WANTS_REMATCH', { requestingPlayer: requestingPlayerRole });
        }

        // Notify requester that their request was registered (optional)
        // socket.emit('REMATCH_REQUEST_ACKNOWLEDGED');

        // Check if BOTH players have now requested a rematch
        if (room.rematchRequested[0] && room.rematchRequested[1]) {
            console.log(`[${roomId}] Both players want a rematch! Starting new game.`);
            this.clearTurnTimer(room); // Clear any active timer
            this.startRematch(room); // Call separate function to handle reset/swap
        } else {
             console.log(`[${roomId}] Waiting for opponent's rematch request.`);
             // Maybe notify requester that we are waiting?
             const socket = this.io.sockets.sockets.get(socketId);
             socket?.emit('WAITING_FOR_REMATCH_APPROVAL');
        }
   }

   private startRematch(room: GameRoom) {
    const roomId = room.roomId;

    // 1. Swap Player Roles
    const oldPlayerX = room.players[0];
    const oldPlayerO = room.players[1];

    if (!oldPlayerX || !oldPlayerO) {
        console.error(`[${roomId}] Cannot start rematch, player info missing.`);
        // Maybe notify clients of error?
        return;
    }

    // Create new PlayerInfo with swapped roles
    const newPlayerX: PlayerInfo = { socketId: oldPlayerO.socketId, role: 'X' }; // Old O is new X
    const newPlayerO: PlayerInfo = { socketId: oldPlayerX.socketId, role: 'O' }; // Old X is new O

    room.players = [newPlayerX, newPlayerO]; // Update player array

    // 2. Reset Game State
    room.gameState = createInitialGameState(); // Fresh state (X starts by default)

    // 3. Reset Rematch Flags
    room.rematchRequested = [false, false];

    // 4. Set Room Status back to Playing
    room.status = 'Playing';

    // 5. Notify Clients

    // Notify Player X (Old O) of their new role and start game
    this.io.sockets.sockets.get(newPlayerX.socketId)?.emit('YOUR_ROLE', 'X');
    this.io.sockets.sockets.get(newPlayerX.socketId)?.emit('GAME_START', {
         roomId,
         initialState: room.gameState,
         // opponentId: newPlayerO.socketId // Can send opponent info
    });

    // Notify Player O (Old X) of their new role and start game
     this.io.sockets.sockets.get(newPlayerO.socketId)?.emit('YOUR_ROLE', 'O');
     this.io.sockets.sockets.get(newPlayerO.socketId)?.emit('GAME_START', {
         roomId,
         initialState: room.gameState,
         // opponentId: newPlayerX.socketId
     });

    // Notify spectators (if any) game is restarting (just send new state)
    room.spectators.forEach(specId => {
        this.io.sockets.sockets.get(specId)?.emit('GAME_STATE_UPDATE', room.gameState);
    });

    // Broadcast new assignments
    this.io.to(roomId).emit('PLAYER_ASSIGNMENT', { playerX: newPlayerX.socketId, playerO: newPlayerO.socketId });
    this.clearTurnTimer(room);
    this.startTurnTimer(room);

    // Update Lobby List (status changed back to Playing)
    this.broadcastRoomList();
}


private startTurnTimer(room: GameRoom) {
    this.clearTurnTimer(room); // Ensure no duplicate timers running

    if (!room.turnDuration || room.gameState.gameStatus !== 'InProgress') {
        console.log(`[${room.roomId}] Timer not starting (No duration or game not in progress).`);
        // Ensure client timer display is cleared if game ended or no timer set
        this.io.to(room.roomId).emit('TURN_TIMER_UPDATE', null);
        return;
    }

    const durationSec = room.turnDuration;
    const durationMs = durationSec * 1000;
    const currentPlayer = room.gameState.currentPlayer;
    const playerInfo = room.players.find(p => p?.role === currentPlayer);

    if (!playerInfo) {
         console.error(`[${room.roomId}] Cannot start timer: Current player ${currentPlayer} info not found in room.`);
         return;
    }

    console.log(`[${room.roomId}] Starting ${durationSec}s timer for Player ${currentPlayer} (${playerInfo.socketId})`);

    // Emit initial timer state immediately
    const timerData = {
        player: currentPlayer,
        timeLeft: durationSec, // Start with full duration
        maxDuration: durationSec
    };
    console.log(`[${room.roomId}] Emitting initial TURN_TIMER_UPDATE:`, timerData);
    this.io.to(room.roomId).emit('TURN_TIMER_UPDATE', timerData);

    // Set the timeout for expiration
    room.activeTurnTimer = setTimeout(() => {
        // Check inside timeout if the player *still* matches, as a move might have occurred
        // just before the timeout fired.
        if (room.gameState.currentPlayer === currentPlayer && room.gameState.gameStatus === 'InProgress') {
             this.handleTurnTimeout(room.roomId, currentPlayer);
        } else {
             console.log(`[${room.roomId}] Timeout for ${currentPlayer} ignored, game state changed before execution.`);
        }
    }, durationMs);
}

private clearTurnTimer(room: GameRoom) {
    if (room.activeTurnTimer) {
        console.log(`[${room.roomId}] Clearing active timer.`);
        clearTimeout(room.activeTurnTimer);
        room.activeTurnTimer = null;
        console.log(`[${room.roomId}] Emitting null TURN_TIMER_UPDATE.`);
        this.io.to(room.roomId).emit('TURN_TIMER_UPDATE', null);
    }
}

private handleTurnTimeout(roomId: string, timedOutPlayer: Player) {
    const room = this.gameRooms.get(roomId);
    // Re-check conditions as state might have changed between setTimeout schedule and execution
    if (!room || room.gameState.gameStatus !== 'InProgress' || room.gameState.currentPlayer !== timedOutPlayer) {
         console.log(`[${roomId}] Timeout handling aborted: Room/Game state changed before timeout execution for ${timedOutPlayer}.`);
         return; // Ignore if game ended or player changed just before timeout fired
    }

    console.log(`[${roomId}] Player ${timedOutPlayer} timed out! Processing forfeit.`);
    room.activeTurnTimer = null; // Ensure timer reference is cleared

    // Determine winner
    const winner = timedOutPlayer === 'X' ? 'O' : 'X';
    console.log(`[${roomId}] Winner by timeout: Player ${winner}.`);

    // Update game state (make a copy first for safety, though modifying directly might be okay here)
    let nextGameState = structuredClone(room.gameState);
    nextGameState.gameStatus = winner;
    nextGameState.activeBoardIndex = null; // Game over
    nextGameState.largeWinningLine = null; // No winning line for timeout

    // Update room state
    room.gameState = nextGameState;
    room.status = 'Finished';

    // Notify clients
    console.log(`[${roomId}] Broadcasting final game state after timeout.`);
    this.io.to(roomId).emit('GAME_STATE_UPDATE', room.gameState);

    // Send a specific timeout message
    const timeoutMessage = `Player ${timedOutPlayer} ran out of time. Player ${winner} wins!`;
    console.log(`[${roomId}] Emitting timeout message: "${timeoutMessage}"`);
    this.io.to(roomId).emit('ERROR_MESSAGE', timeoutMessage); // Use existing error channel or create a dedicated one

    // Clear any timer display on clients (should have been done by clearTurnTimer, but belt-and-suspenders)
    console.log(`[${roomId}] Emitting null TURN_TIMER_UPDATE after timeout.`);
    this.io.to(roomId).emit('TURN_TIMER_UPDATE', null);

    // Update lobby list as room is now Finished
    console.log(`[${roomId}] Broadcasting room list update after timeout.`);
    this.broadcastRoomList();
}

    // --- Private Helpers ---
    private generateRoomId(): string {
        return Math.random().toString(36).substring(2, 9);
    }
    private sanitizeRoomName(name?: string): string | undefined {
        // Allow empty strings to pass through, handle default name in createRoom
        return name?.trim().slice(0, 30);
    }
    private cleanupRoom(roomId: string): void {
        const room = this.gameRooms.get(roomId);
        if (!room) return;

        // --- Clear timer before cleaning up ---
        this.clearTurnTimer(room);

        console.log(`Cleaning up room data for: ${roomId}`);
        // Make players and spectators leave the socket.io room first
        const playerIds = room.players
            .map((p) => p?.socketId)
            .filter((id) => !!id) as string[];
        const spectatorIds = Array.from(room.spectators);
        [...playerIds, ...spectatorIds].forEach((socketId) => {
            this.io.sockets.sockets.get(socketId)?.leave(roomId);
            this.socketIdToRoomId.delete(socketId); // Remove mapping
        });
        this.gameRooms.delete(roomId); // Delete room state
        console.log(`Room ${roomId} removed from active games.`);
        this.broadcastRoomList(); // Update list after removal
    }

    // Helper to send error message to a specific socket
    private sendErrorToSocket(socketId: string, message: string) {
        this.io.sockets.sockets.get(socketId)?.emit('ERROR_MESSAGE', message);
    }
}
