import React, { createContext, useReducer, useContext, useEffect, ReactNode, useCallback } from 'react';
import socket from '../services/socketService';
import { GameState, Player, RoomInfo } from '../types';

// --- State Definition ---
interface SocketState {
    isConnected: boolean;
    gameState: GameState | null;
    playerRole: Player | null;
    opponentJoined: boolean;
    // isWaiting state can be inferred: !roomId && isConnected
    opponentDisconnected: boolean;
    roomId: string | null;
    roomName: string | null;
    roomList: RoomInfo[];
    serverError: string | null;
    spectatorCount: number;
}

const initialState: SocketState = {
    isConnected: socket.connected,
    gameState: null,
    playerRole: null,
    opponentJoined: false,
    opponentDisconnected: false,
    roomId: null,
    roomName: null,
    roomList: [],
    serverError: null,
    spectatorCount: 0,
};

// --- Action Types ---
type SocketAction =
    | { type: 'SET_CONNECTION_STATUS'; payload: boolean }
    | { type: 'SET_GAME_STATE'; payload: GameState | null }
    | { type: 'SET_PLAYER_ROLE'; payload: Player | null }
    | { type: 'SET_ROOM_LIST'; payload: RoomInfo[] }
    | { type: 'SET_ROOM_JOINED'; payload: { roomId: string; roomName: string; initialState: GameState } }
    | { type: 'SET_GAME_START'; payload?: { initialState?: GameState } } // Signal opponent joined, clear waiting
    | { type: 'SET_SPECTATOR_COUNT'; payload: number }
    | { type: 'SET_ERROR'; payload: string | null }
    | { type: 'OPPONENT_DISCONNECTED' }
    | { type: 'RESET_ROOM_STATE' }; // For leaving room or disconnect

// --- Reducer ---
const socketReducer = (state: SocketState, action: SocketAction): SocketState => {
    console.log("Reducer Action:", action.type, "Payload:", (action as any).payload); // Log actions
    switch (action.type) {
        case 'SET_CONNECTION_STATUS':
            // If disconnecting, reset everything except maybe error
            if (!action.payload) {
                return { ...initialState, isConnected: false, serverError: state.serverError || 'Disconnected' };
            }
            return { ...state, isConnected: action.payload, serverError: null }; // Clear error on connect
        case 'SET_GAME_STATE':
            { const opponentNowJoined = state.roomId !== null;
            return { ...state, gameState: action.payload, opponentDisconnected: false, opponentJoined: opponentNowJoined }; } // Reset opponent flag on new state
        case 'SET_PLAYER_ROLE':
            return { ...state, playerRole: action.payload };
        case 'SET_ROOM_LIST':
            return { ...state, roomList: action.payload };
        case 'SET_ROOM_JOINED':
            return {
                ...state,
                roomId: action.payload.roomId,
                roomName: action.payload.roomName,
                gameState: action.payload.initialState,
                opponentJoined: false,
                opponentDisconnected: false,
                serverError: null,
                spectatorCount: 0,
            };
        case 'SET_GAME_START': // Opponent joined room where we were waiting
             // Don't reset gameState here, just ensure flags are correct
             { const newState = action.payload?.initialState ? action.payload.initialState : state.gameState;
             return { ...state, opponentJoined: true, opponentDisconnected: false, serverError: null, gameState: newState }; }
        case 'SET_SPECTATOR_COUNT':
            return { ...state, spectatorCount: action.payload };
        case 'SET_ERROR':
            return { ...state, serverError: action.payload };
        case 'OPPONENT_DISCONNECTED':
            // Keep roomId/roomName but clear game state and role? Mark as disconnected.
            return { ...state, opponentDisconnected: true, serverError: "Opponent disconnected.", gameState: null, playerRole: null, spectatorCount: 0 };
        case 'RESET_ROOM_STATE': // Used on leave or sometimes disconnect cleanup
             return { ...state, // Keep connection status and room list
                  gameState: null, playerRole: null, opponentJoined:false, opponentDisconnected: false,
                  roomId: null, roomName: null, serverError: null, spectatorCount: 0 };
        default:
            return state;
    }
};

// --- Context Definition ---
// Include emitter functions in context value type
interface SocketContextValue extends SocketState {
    connectSocket: () => void;
    createRoom: (roomName?: string) => void;
    joinRoom: (roomId: string) => void;
    leaveRoom: () => void;
    attemptMove: (largeBoardIdx: number, smallBoardIdx: number) => void;
    requestResetGame: () => void;
}

// Create context with a default value (can be undefined if Provider is guaranteed)
const SocketContext = createContext<SocketContextValue | undefined>(undefined);

// --- Provider Component ---
interface SocketProviderProps { children: ReactNode; }

export const SocketProvider: React.FC<SocketProviderProps> = ({ children }) => {
    const [state, dispatch] = useReducer(socketReducer, initialState);

    // --- Emitter Functions (Stable references via useCallback) ---
    // These don't dispatch directly but emit to the server
    const connectSocket = useCallback(() => { if (!socket.connected) socket.connect(); }, []);
    const createRoom = useCallback((roomName?: string) => { console.log("Provider: Emitting CREATE_ROOM"); socket.emit('CREATE_ROOM', { roomName }); /* Server response will dispatch state changes */ }, []);
    const joinRoom = useCallback((roomIdToJoin: string) => { console.log(`Provider: Emitting JOIN_ROOM for ${roomIdToJoin}`); socket.emit('JOIN_ROOM', { roomId: roomIdToJoin }); }, []);
    const leaveRoom = useCallback(() => { if (state.roomId) { console.log(`Provider: Emitting LEAVE_ROOM for ${state.roomId}`); socket.emit('LEAVE_ROOM'); dispatch({ type: 'RESET_ROOM_STATE' }); } }, [state.roomId]); // Dispatch reset locally immediately
    const attemptMove = useCallback((largeBoardIdx: number, smallBoardIdx: number) => { console.log(`Provider: Emitting ATTEMPT_MOVE`); socket.emit('ATTEMPT_MOVE', { largeBoardIdx, smallBoardIdx }); }, []);
    const requestResetGame = useCallback(() => { if (state.roomId) { console.log(`Provider: Emitting REQUEST_RESET_GAME for ${state.roomId}`); socket.emit('REQUEST_RESET_GAME'); } }, [state.roomId]);

    // --- Effect for Socket Listeners ---
    useEffect(() => {
        console.log("Provider Effect: Registering Listeners...");

        // Define handlers that dispatch actions
        const handleConnect = () => dispatch({ type: 'SET_CONNECTION_STATUS', payload: true });
        const handleDisconnect = (reason: string) => dispatch({ type: 'SET_CONNECTION_STATUS', payload: false }); // Reducer handles reset
        const handleConnectError = (err: Error) => dispatch({ type: 'SET_ERROR', payload: 'Connection failed.' });
        const handleGameStateUpdate = (gs: GameState) => dispatch({ type: 'SET_GAME_STATE', payload: gs });
        const handleYourRole = (role: Player | null) => dispatch({ type: 'SET_PLAYER_ROLE', payload: role });
        const handleRoomListUpdate = (list: RoomInfo[]) => dispatch({ type: 'SET_ROOM_LIST', payload: list });
        const handleRoomJoined = (data: { roomId: string; initialState: GameState; roomName: string }) => dispatch({ type: 'SET_ROOM_JOINED', payload: data });
        const handleGameStart = (data?: { initialState?: GameState }) => dispatch({ type: 'SET_GAME_START', payload: data });
        const handleOpponentDisconnect = () => dispatch({ type: 'OPPONENT_DISCONNECTED' });
        const handleSpectatorCount = (data: { count: number }) => dispatch({ type: 'SET_SPECTATOR_COUNT', payload: data.count });
        const handleErrorMessage = (msg: string) => dispatch({ type: 'SET_ERROR', payload: msg });

        // Register listeners
        socket.on('connect', handleConnect); socket.on('disconnect', handleDisconnect); socket.on('connect_error', handleConnectError);
        socket.on('GAME_STATE_UPDATE', handleGameStateUpdate); socket.on('YOUR_ROLE', handleYourRole); socket.on('ROOM_LIST_UPDATE', handleRoomListUpdate); socket.on('ROOM_JOINED', handleRoomJoined); socket.on('GAME_START', handleGameStart); socket.on('OPPONENT_DISCONNECTED', handleOpponentDisconnect); socket.on('SPECTATOR_COUNT_UPDATE', handleSpectatorCount); socket.on('ERROR_MESSAGE', handleErrorMessage);

        // Initial connection attempt
        if (!socket.connected) {
            console.log("Provider Effect: Attempting initial connect...");
            socket.connect();
        } else {
             // Ensure connected state is accurate if already connected when provider mounts
             if (!state.isConnected) {
                 dispatch({ type: 'SET_CONNECTION_STATUS', payload: true });
             }
        }

        // Cleanup
        return () => {
            console.log("Provider Effect: Cleaning up listeners...");
            socket.off('connect', handleConnect); socket.off('disconnect', handleDisconnect); socket.off('connect_error', handleConnectError);
            socket.off('GAME_STATE_UPDATE', handleGameStateUpdate); socket.off('YOUR_ROLE', handleYourRole); socket.off('ROOM_LIST_UPDATE', handleRoomListUpdate); socket.off('ROOM_JOINED', handleRoomJoined); socket.off('GAME_START', handleGameStart); socket.off('OPPONENT_DISCONNECTED', handleOpponentDisconnect); socket.off('SPECTATOR_COUNT_UPDATE', handleSpectatorCount); socket.off('ERROR_MESSAGE', handleErrorMessage);
        };
    }, [dispatch, state.isConnected]); // Include dispatch in deps array

    // Value provided by the context
    const value: SocketContextValue = {
        ...state,
        connectSocket,
        createRoom,
        joinRoom,
        leaveRoom,
        attemptMove,
        requestResetGame,
    };

    return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
};

// --- Custom Hook to Consume Context ---
export const useSocketContext = (): SocketContextValue => {
    const context = useContext(SocketContext);
    if (context === undefined) {
        throw new Error('useSocketContext must be used within a SocketProvider');
    }
    return context;
};