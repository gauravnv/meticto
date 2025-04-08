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
}
export interface RoomInfo {
    roomId: string;
    roomName: string;
    playerCount: number;
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
        this.gameRooms.forEach((room) => {
            if (room.status === "Waiting") {
                roomList.push({
                    roomId: room.roomId,
                    roomName: room.roomName || `Room ${room.roomId}`,
                    playerCount: room.players.filter((p) => p !== null).length,
                    status: room.status,
                });
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

    handleCreateRoom(socket: Socket, roomName?: string) {
        const socketId = socket.id;
        if (this.socketIdToRoomId.has(socketId)) {
            socket.emit("ERROR_MESSAGE", "Already in a room.");
            return;
        }
        const roomId = this.generateRoomId();
        const playerXInfo: PlayerInfo = { socketId, role: "X" };
        const newRoom: GameRoom = {
            roomId,
            roomName: this.sanitizeRoomName(roomName) || `Room ${roomId}`,
            status: "Waiting",
            players: [playerXInfo, null],
            gameState: createInitialGameState(),
            spectators: new Set(),
        };
        this.gameRooms.set(roomId, newRoom);
        this.socketIdToRoomId.set(socketId, roomId);
        socket.join(roomId); // *** Make sure socket joins the room ***
        console.log(
            `Room ${roomId} ('${newRoom.roomName}') created by ${socketId} (Player X).`
        );
        socket.emit("YOUR_ROLE", "X");
        socket.emit("ROOM_JOINED", {
            roomId,
            initialState: newRoom.gameState,
            roomName: newRoom.roomName,
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
            const playerOInfo: PlayerInfo = { socketId, role: "O" };
            room.players[1] = playerOInfo;
            room.status = "Playing";
            this.socketIdToRoomId.set(socketId, roomId);
            socket.join(roomId); // *** Make sure socket joins the room ***
            console.log(
                `[${roomId}] Player O (${socketId}) joined. Room status: ${room.status}`
            );

            // Notify Player O first
            socket.emit("YOUR_ROLE", "O");
            socket.emit("ROOM_JOINED", {
                roomId,
                initialState: room.gameState,
                roomName: room.roomName,
            });

            // Get Player X info & socket
            const playerX = room.players[0];
            const playerXSocket = playerX
                ? this.io.sockets.sockets.get(playerX.socketId)
                : null;

            // Notify Player X (if found)
            if (playerXSocket && playerX) {
                console.log(
                    `[${roomId}] Notifying Player X (${playerX.socketId}) game is starting.`
                );
                playerXSocket.emit("GAME_START", { opponentId: socketId });
            } else {
                console.error(
                    `[${roomId}] Failed to find Player X socket or info when Player O joined.`
                );
            }

            // Update room list (room no longer waiting)
            this.broadcastRoomList();

            // *** Broadcast assignments and count TO THE ROOM ***
            console.log(`[${roomId}] Broadcasting final assignments and count.`);
            this.io.to(roomId).emit("PLAYER_ASSIGNMENT", {
                playerX: room.players[0]?.socketId,
                playerO: room.players[1]?.socketId,
            });
            this.io
                .to(roomId)
                .emit("SPECTATOR_COUNT_UPDATE", { count: room.spectators.size });
        } else if (room.status === "Playing" || room.status === "Finished") {
            // --- Join as Spectator ---
            console.log(`Socket ${socketId} joining room ${roomId} as Spectator.`);
            if (room.players.some((p) => p?.socketId === socketId)) {
                socket.emit("ERROR_MESSAGE", "Already a player.");
                return;
            }
            room.spectators.add(socketId);
            this.socketIdToRoomId.set(socketId, roomId);
            socket.join(roomId); // *** Make sure socket joins the room ***
            socket.emit("YOUR_ROLE", null);
            socket.emit("ROOM_JOINED", {
                roomId,
                initialState: room.gameState,
                roomName: room.roomName,
            });
            this.io
                .to(roomId)
                .emit("SPECTATOR_COUNT_UPDATE", { count: room.spectators.size });
        } else {
            socket.emit(
                "ERROR_MESSAGE",
                `Cannot join room '${room.roomName || roomId}': Status is ${room.status}.`
            );
        }
    } // End handleJoinRoom

    handleLeaveRoom(socket: Socket) {
        const socketId = socket.id;
        const roomId = this.socketIdToRoomId.get(socketId);
        if (!roomId) return;
        const room = this.gameRooms.get(roomId);
        if (!room) {
            this.socketIdToRoomId.delete(socketId);
            return;
        }
        console.log(`Socket ${socketId} leaving room ${roomId}.`);
        socket.leave(roomId); // *** Leave socket.io room ***
        this.socketIdToRoomId.delete(socketId);
        const playerIndex = room.players.findIndex((p) => p?.socketId === socketId);
        if (playerIndex !== -1) {
            this.handlePlayerDisconnectCleanup(socket, room, playerIndex);
        } else if (room.spectators.delete(socketId)) {
            console.log(`Spectator ${socketId} left room ${roomId}.`);
            this.io
                .to(roomId)
                .emit("SPECTATOR_COUNT_UPDATE", { count: room.spectators.size });
        }
        this.broadcastRoomList();
    }

    // --- Connection & Disconnection ---
    handleNewConnection(socket: Socket) {
        const socketId = socket.id;
        console.log(`User connected: ${socketId}`);
        this.broadcastRoomList(socket); // Send available rooms
    }

    handleDisconnect(socket: Socket) {
        const socketId = socket.id;
        console.log(`User disconnected: ${socketId}`);
        const roomId = this.socketIdToRoomId.get(socketId);
        if (roomId) {
            const room = this.gameRooms.get(roomId);
            if (room) {
                const playerIndex = room.players.findIndex(
                    (p) => p?.socketId === socketId
                );
                if (playerIndex !== -1) {
                    this.handlePlayerDisconnectCleanup(socket, room, playerIndex);
                } else {
                    if (room.spectators.delete(socketId)) {
                        console.log(
                            `Spectator ${socketId} removed from room ${roomId} on disconnect.`
                        );
                        this.io
                            .to(roomId)
                            .emit("SPECTATOR_COUNT_UPDATE", { count: room.spectators.size });
                    }
                    socket.leave(roomId); // Should be automatic on disconnect, but doesn't hurt
                }
            } else {
                console.log(
                    `Disconnect: Room ${roomId} not found for socket ${socketId}.`
                );
            }
        } else {
            console.log(`Socket ${socketId} disconnected without being in a room.`);
        }
        this.socketIdToRoomId.delete(socketId);
        this.broadcastRoomList();
    }

    private handlePlayerDisconnectCleanup(
        socket: Socket,
        room: GameRoom,
        playerIndex: number
    ) {
        const socketId = socket.id;
        const roomId = room.roomId;
        console.log(
            `Player ${room.players[playerIndex]?.role} (${socketId}) left/disconnected room ${roomId}. Cleaning up.`
        );
        const opponentIndex = playerIndex === 0 ? 1 : 0;
        const opponent = room.players[opponentIndex];
        if (opponent) {
            const opponentSocket = this.io.sockets.sockets.get(opponent.socketId);
            if (opponentSocket) {
                console.log(
                    `Notifying opponent ${opponent.socketId} in room ${roomId}.`
                );
                opponentSocket.emit(
                    "OPPONENT_DISCONNECTED",
                    "Your opponent left the game."
                );
                // Keep opponent connected but remove from room map, let them leave/refresh
                opponentSocket.leave(roomId);
                this.socketIdToRoomId.delete(opponent.socketId);
                // Don't force disconnect opponent: opponentSocket.disconnect(true);
            }
        }
        this.cleanupRoom(roomId); // Removes room state, mappings, notifies list
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
            console.log(`Move attempt ignored: Not in room ${roomId}.`);
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
            console.log(`[${roomId}] Validation Failed: Wrong player.`);
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
            return;
        }
        const currentLargeBoardCell = nextGameState.largeBoard[largeBoardIdx]; // Check copy
        if (nextGameState.gameStatus !== "InProgress") {
            console.log(`[${roomId}] Validation Failed: Game over.`);
            return;
        }
        if (
            nextGameState.activeBoardIndex !== null &&
            nextGameState.activeBoardIndex !== largeBoardIdx
        ) {
            console.log(`[${roomId}] Validation Failed: Wrong board.`);
            return;
        }
        if (isSmallBoardFinished(currentLargeBoardCell.status)) {
            console.log(`[${roomId}] Validation Failed: Board finished.`);
            return;
        }
        if (currentLargeBoardCell.cells[smallBoardIdx] !== null) {
            console.log(`[${roomId}] Validation Failed: Cell taken.`);
            return;
        }

        console.log(
            `[${roomId}] Move validated for player ${expectedPlayer}. Applying to copy...`
        );
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
                nextGameState.activeBoardIndex = null;
            } else if (largeBoardResult.isDraw) {
                nextGameState.gameStatus = "Draw";
                nextGameState.largeWinningLine = null;
                nextGameState.activeBoardIndex = null;
            } else {
                nextGameState.largeWinningLine = null;
            }
        }
        if (nextGameState.gameStatus === "InProgress") {
            nextGameState.largeWinningLine = null;
        }

        // Determine Next Active Board & Switch Player (on copy)
        if (nextGameState.gameStatus === "InProgress") {
            const nextActiveBoardIdx = smallBoardIdx;
            const nextBoardStatus =
                nextGameState.largeBoard[nextActiveBoardIdx]?.status;
            const nextBoardIsFinished = nextBoardStatus
                ? isSmallBoardFinished(nextBoardStatus)
                : false;
            nextGameState.activeBoardIndex = nextBoardIsFinished
                ? null
                : nextActiveBoardIdx;
            nextGameState.currentPlayer = expectedPlayer === "X" ? "O" : "X";
        }

        // --- Update the room's actual game state with the modified copy ---
        console.log(`[${roomId}] Updating room state with modified copy.`);
        room.gameState = nextGameState; // Assign the updated copy back

        // Update room status if game ended
        if (room.gameState.gameStatus !== "InProgress") {
            room.status = "Finished";
            this.broadcastRoomList();
        }

        // --- Broadcast the NEWLY ASSIGNED state ---
        console.log(`[${roomId}] Broadcasting updated game state.`);
        this.io.to(roomId!).emit("GAME_STATE_UPDATE", room.gameState); // Broadcast the state FROM the room
    } 

    handleResetGameRequest(socketId: string) {
        const roomId = this.socketIdToRoomId.get(socketId);
        const room = roomId ? this.gameRooms.get(roomId) : null;
        if (!room) {
            console.log(`Reset request ignored: Not in room ${roomId}.`);
            return;
        }
        // Allow reset only if game is Finished (or maybe anytime?) - Let's stick to Finished for now.
        if (room.status !== "Finished") {
            console.log(
                `[${roomId}] Reset request ignored: Game status is ${room.status}.`
            );
            return;
        }
        const isPlayer = room.players.some((p) => p?.socketId === socketId);
        if (!isPlayer) {
            console.log(
                `[${roomId}] Reset request ignored: Requester ${socketId} not player.`
            );
            return;
        }

        console.log(
            `[${roomId}] Received reset request from player ${socketId}. Resetting room...`
        );

        // --- TODO: Implement proper Rematch Logic ---
        // 1. Swap Player Roles (X becomes O, O becomes X)
        // 2. For now: Simple Reset - Keep roles, reset board, set status to Playing

        // Reset game state
        room.gameState = createInitialGameState();
        // Set room status back to Playing
        room.status = "Playing";

        console.log(`[${roomId}] Broadcasting GAME_START after reset.`);
        // Emit GAME_START to both players with the fresh initial state
        // This clearly signals the game view should reset and become active
        this.io.to(roomId!).emit("GAME_START", {
            roomId,
            initialState: room.gameState,
            // Optionally send updated roles if they were swapped
        });

        // Update room list as status changed (no longer Finished)
        this.broadcastRoomList();
    }

    // --- Private Helpers ---
    private generateRoomId(): string {
        return Math.random().toString(36).substring(2, 9);
    }
    private sanitizeRoomName(name?: string): string | undefined {
        return name?.trim().slice(0, 30);
    }
    private cleanupRoom(roomId: string): void {
        const room = this.gameRooms.get(roomId);
        if (!room) return;
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
}
