import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GameManager } from './gameManager';
import { Server as SocketIOServer, Socket } from 'socket.io';

// Minimal mock for Socket.IO Server and Socket
const mockRoomEmit = vi.fn(); // Create a persistent spy for room emits
const mockIo = {
    sockets: { sockets: new Map() },
    // Make io.to return an object containing the emit spy
    to: vi.fn().mockReturnValue({ emit: mockRoomEmit }),
    emit: vi.fn(),
} as unknown as SocketIOServer;

// --- Helper to create a mock socket ---
const createMockSocket = (id: string): Socket => {
    const socket = {
        id,
        join: vi.fn(),
        leave: vi.fn(),
        emit: vi.fn(),
        disconnect: vi.fn(),
    } as unknown as Socket;
    // Add to mock server's list of connected sockets
    (mockIo.sockets.sockets as Map<string, Socket>).set(id, socket);
    return socket;
};


describe('GameManager', () => {
    let gameManager: GameManager;
    let socket1: Socket;
    let socket2: Socket;

    beforeEach(() => {
        vi.clearAllMocks();
        (mockIo.sockets.sockets as Map<string, Socket>).clear();
        gameManager = new GameManager(mockIo);
        socket1 = createMockSocket('socket-1');
        socket2 = createMockSocket('socket-2');
    });

    it('should place first connecting player in waiting', () => {
        gameManager.handleNewConnection(socket1);
        expect(socket1.emit).toHaveBeenCalledWith('WAITING_FOR_OPPONENT');
        expect(socket1.emit).toHaveBeenCalledWith('YOUR_ROLE', null);
        // @ts-ignore // Access private member for testing
        expect(gameManager.waitingPlayerSocketId).toBe('socket-1');
    });

    it('should create a room when second player connects', () => {
        gameManager.handleNewConnection(socket1); // Player 1 waits
        gameManager.handleNewConnection(socket2); // Player 2 joins

        expect(socket1.emit).toHaveBeenCalledWith('YOUR_ROLE', 'X');
        expect(socket1.emit).toHaveBeenCalledWith( 'GAME_START', expect.objectContaining({ roomId: expect.any(String) }) );
        expect(socket2.emit).toHaveBeenCalledWith('YOUR_ROLE', 'O');
        expect(socket2.emit).toHaveBeenCalledWith( 'GAME_START', expect.objectContaining({ roomId: expect.any(String) }) );

        // @ts-ignore
        expect(gameManager.waitingPlayerSocketId).toBeNull();
         // @ts-ignore
        expect(gameManager.gameRooms.size).toBe(1);
         // @ts-ignore
        const roomId = gameManager.socketIdToRoomId.get('socket-1');
        expect(roomId).toBeDefined();
        expect((gameManager as any).getRoomIdFromSocketId('socket-2')).toBe(roomId);
    });

    it('should allow valid first move by Player X', () => {
        gameManager.handleNewConnection(socket1);
        gameManager.handleNewConnection(socket2);
        // @ts-ignore
        const roomId = gameManager.socketIdToRoomId.get('socket-1')!;
        // @ts-ignore
        const room = gameManager.gameRooms.get(roomId)!;

        gameManager.handleAttemptMove('socket-1', { largeBoardIdx: 0, smallBoardIdx: 0 });

        expect(room.gameState.largeBoard[0].cells[0]).toBe('X');
        expect(room.gameState.currentPlayer).toBe('O');
        expect(room.gameState.activeBoardIndex).toBe(0);

        // Check that io.to was called with the correct room ID
        expect(mockIo.to).toHaveBeenCalledWith(roomId);
        // Check that the *room's* emit function was called correctly
        expect(mockRoomEmit).toHaveBeenCalledWith('GAME_STATE_UPDATE', expect.objectContaining({ currentPlayer: 'O' })); // Use the dedicated room emit mock
    });

     it('should reject move if not player\'s turn', () => {
        gameManager.handleNewConnection(socket1);
        gameManager.handleNewConnection(socket2);
        // @ts-ignore
        const roomId = gameManager.socketIdToRoomId.get('socket-1')!;
        // @ts-ignore
        const room = gameManager.gameRooms.get(roomId)!;

        // --- Clear Mocks After Setup ---
        // Clear history specifically for the room emit mock before the action under test
        mockRoomEmit.mockClear();

        // --- Action Phase ---
        // Simulate Player O trying to move first (invalid)
        gameManager.handleAttemptMove('socket-2', { largeBoardIdx: 0, smallBoardIdx: 0 });

        // --- Assertion Phase ---
        // Check that state did NOT change
        expect(room.gameState.largeBoard[0].cells[0]).toBeNull();
        expect(room.gameState.currentPlayer).toBe('X');
        // Check that the ROOM EMIT broadcast did NOT occur *after* the setup phase
        expect(mockRoomEmit).not.toHaveBeenCalled(); 
    });

    // --- Add more tests ---
    // - Test invalid move placement (wrong board, cell taken, etc.)
    // - Test winning a small board
    // - Test winning the large board
    // - Test draws (small and large)
    // - Test 'play anywhere' rule activation
    // - Test reset game functionality
    // - Test disconnect handling (player disconnect resets/notifies, spectator disconnect is quiet)

});