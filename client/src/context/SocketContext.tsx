import React, {
  createContext,
  useReducer,
  useContext,
  useEffect,
  ReactNode,
  useCallback,
  useRef,
} from "react";
import socket from "../services/socketService";
import { GameState, Player, RoomInfo } from "../types";
import toast from "react-hot-toast";
import { Socket } from "socket.io-client";

// --- New State Type ---
type ConnectionPhase =
  | "idle"
  | "connecting"
  | "wakeupsuspected"
  | "connected"
  | "error"
  | "disconnected";

// --- State Definition ---
interface SocketState {
  connectionPhase: ConnectionPhase;
  gameState: GameState | null;
  playerRole: Player | null;
  opponentJoined: boolean;
  opponentDisconnected: boolean;
  roomId: string | null;
  roomName: string | null;
  roomList: RoomInfo[];
  serverError: string | null;
  spectatorCount: number;
  rematchOffered: boolean;
  rematchRequested: boolean;
  currentTimer: {
    player: Player;
    timeLeft: number;
    maxDuration: number;
  } | null;
}

const initialState: SocketState = {
  connectionPhase: "idle", // Start as idle
  gameState: null,
  playerRole: null,
  opponentJoined: false,
  opponentDisconnected: false,
  roomId: null,
  roomName: null,
  roomList: [],
  serverError: null, // Initialize as null
  spectatorCount: 0,
  rematchOffered: false,
  rematchRequested: false,
  currentTimer: null,
};

// --- Action Types ---
type SocketAction =
  | { type: "SET_CONNECTION_PHASE"; payload: ConnectionPhase } // New action
  | { type: "SET_GAME_STATE"; payload: GameState | null }
  | { type: "SET_PLAYER_ROLE"; payload: Player | null }
  | { type: "SET_ROOM_LIST"; payload: RoomInfo[] }
  | {
      type: "SET_ROOM_JOINED";
      payload: { roomId: string; roomName: string; initialState: GameState };
    }
  | { type: "SET_GAME_START"; payload?: { initialState?: GameState } }
  | { type: "SET_SPECTATOR_COUNT"; payload: number }
  | { type: "SET_ERROR"; payload: string | null }
  | { type: "CLEAR_ERROR" } // Add action to clear error message
  | { type: "OPPONENT_DISCONNECTED" }
  | { type: "RESET_ROOM_STATE" }
  | { type: "GAME_ENDED_BY_DISCONNECT" }
  | { type: "OPPONENT_WANTS_REMATCH" }
  | { type: "I_REQUESTED_REMATCH" }
  | { type: "REMATCH_DECLINED" }
  | { type: "RESET_REMATCH_FLAGS" }
  | {
      type: "SET_TURN_TIMER";
      payload: { player: Player; timeLeft: number; maxDuration: number } | null;
    };

// --- Reducer ---
const socketReducer = (
  state: SocketState,
  action: SocketAction
): SocketState => {
  if (import.meta.env.DEV) {
    console.log(
      "Reducer Action:",
      action.type,
      "Payload:",
      "payload" in action ? action.payload : undefined
    );
  }
  switch (action.type) {
    case "SET_CONNECTION_PHASE": {
      const errorMsgOnPhaseChange =
        action.payload === "error" || action.payload === "disconnected"
          ? state.serverError ||
            (action.payload === "disconnected"
              ? "Disconnected"
              : "Connection failed")
          : null;
      if (action.payload === "disconnected" || action.payload === "error") {
        // Reset most state on disconnect/error, keep phase and error message
        return {
          ...initialState,
          connectionPhase: action.payload,
          serverError: errorMsgOnPhaseChange,
        };
      }
      // Clear error message when transitioning to non-error/non-disconnected states
      return {
        ...state,
        connectionPhase: action.payload,
        serverError: errorMsgOnPhaseChange,
      };
    }
    case "SET_ERROR":
      return { ...state, serverError: action.payload };
    case "CLEAR_ERROR":
      // Only clear error message, don't change phase
      return { ...state, serverError: null };
    case "RESET_ROOM_STATE": {
      const phaseAfterReset =
        state.connectionPhase === "connected"
          ? "connected"
          : state.connectionPhase;
      return {
        ...state,
        connectionPhase: phaseAfterReset,
        gameState: null,
        playerRole: null,
        opponentJoined: false,
        opponentDisconnected: false,
        roomId: null,
        roomName: null,
        serverError: null,
        spectatorCount: 0,
        rematchOffered: false,
        rematchRequested: false,
        currentTimer: null,
      };
    }
    case "SET_ROOM_JOINED":
      return {
        ...state,
        roomId: action.payload.roomId,
        roomName: action.payload.roomName,
        gameState: action.payload.initialState,
        opponentJoined: false,
        opponentDisconnected: false,
        serverError: null,
        spectatorCount: 0,
        rematchOffered: false,
        rematchRequested: false,
        currentTimer: null,
      };
    case "SET_GAME_START": {
      const newState = action.payload?.initialState
        ? action.payload.initialState
        : state.gameState;
      return {
        ...state,
        opponentJoined: true,
        opponentDisconnected: false,
        serverError: null,
        gameState: newState,
      };
    }
    // ... other cases like SET_GAME_STATE, SET_PLAYER_ROLE etc. should likely remain as they were ...
    case "SET_GAME_STATE": {
      const opponentNowJoined = state.roomId !== null;
      return {
        ...state,
        gameState: action.payload,
        opponentDisconnected: false,
        opponentJoined: opponentNowJoined,
      };
    }
    case "SET_PLAYER_ROLE":
      return { ...state, playerRole: action.payload };
    case "SET_ROOM_LIST":
      return { ...state, roomList: action.payload };
    case "SET_SPECTATOR_COUNT":
      return { ...state, spectatorCount: action.payload };
    case "OPPONENT_DISCONNECTED":
      return {
        ...state,
        opponentDisconnected: true,
        serverError: "Opponent disconnected.",
        gameState: null,
        playerRole: null,
        spectatorCount: 0,
      };
    case "GAME_ENDED_BY_DISCONNECT": {
      if (import.meta.env.DEV)
        console.log("Reducer: Game ended by disconnect.");
      return {
        ...state,
        gameState: null,
        playerRole: null,
        opponentJoined: false,
        opponentDisconnected: true,
        roomId: null,
        roomName: null,
        serverError: "Game ended: A player disconnected.",
        spectatorCount: 0,
      };
    }
    case "OPPONENT_WANTS_REMATCH":
      return { ...state, rematchOffered: true };
    case "I_REQUESTED_REMATCH":
      return { ...state, rematchRequested: true };
    case "REMATCH_DECLINED":
      return {
        ...state,
        rematchOffered: false,
        serverError: "Opponent declined rematch or left.",
      };
    case "RESET_REMATCH_FLAGS":
      return { ...state, rematchOffered: false, rematchRequested: false };
    case "SET_TURN_TIMER":
      return { ...state, currentTimer: action.payload };
    default:
      return state;
  }
};

// --- Context Definition ---
// Exclude serverError from direct consumption if handled by toast
interface SocketContextValue extends Omit<SocketState, "serverError"> {
  isConnected: boolean;
  connectSocket: () => void;
  createRoom: (options: { roomName?: string; duration?: number }) => void;
  joinRoom: (roomId: string) => void;
  leaveRoom: () => void;
  attemptMove: (largeBoardIdx: number, smallBoardIdx: number) => void;
  requestRematch: () => void;
}

const SocketContext = createContext<SocketContextValue | undefined>(undefined);

// --- Provider Component ---
interface SocketProviderProps {
  children: ReactNode;
}

export const SocketProvider: React.FC<SocketProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(socketReducer, initialState);
  const connectionAttemptStartTime = useRef<number | null>(null); // Track start time

  // --- Effect to Show Toasts for Errors ---
  useEffect(() => {
    // Show toast only if there's an error message and we are NOT in initial connecting phases
    if (
      state.serverError &&
      state.connectionPhase !== "idle" &&
      state.connectionPhase !== "connecting" &&
      state.connectionPhase !== "wakeupsuspected"
    ) {
      if (import.meta.env.DEV)
        console.log("Error state updated, showing toast:", state.serverError);
      toast.error(state.serverError);
      // Clear the error state *message* after showing toast, but keep the phase
      dispatch({ type: "CLEAR_ERROR" });
    }
  }, [state.serverError, state.connectionPhase]);

  // --- Emitter Functions ---
  const connectSocket = useCallback(() => {
    if (
      state.connectionPhase !== "connected" &&
      state.connectionPhase !== "connecting" &&
      state.connectionPhase !== "wakeupsuspected"
    ) {
      if (import.meta.env.DEV)
        console.log("Provider: Manual connect initiated.");
      dispatch({ type: "SET_CONNECTION_PHASE", payload: "connecting" });
      connectionAttemptStartTime.current = Date.now();
      socket.connect();
    }
  }, [state.connectionPhase]);
  const createRoom = useCallback(
    (options: { roomName?: string; duration?: number }) => {
      if (import.meta.env.DEV)
        console.log("Provider: Emitting CREATE_ROOM", options);
      socket.emit("CREATE_ROOM", options);
    },
    []
  );
  const joinRoom = useCallback((roomIdToJoin: string) => {
    if (import.meta.env.DEV)
      console.log(`Provider: Emitting JOIN_ROOM for ${roomIdToJoin}`);
    socket.emit("JOIN_ROOM", { roomId: roomIdToJoin });
  }, []);
  const leaveRoom = useCallback(() => {
    if (state.roomId) {
      if (import.meta.env.DEV)
        console.log(`Provider: Emitting LEAVE_ROOM for ${state.roomId}`);
      socket.emit("LEAVE_ROOM");
      dispatch({ type: "RESET_ROOM_STATE" });
    }
  }, [state.roomId]);
  const attemptMove = useCallback(
    (largeBoardIdx: number, smallBoardIdx: number) => {
      if (import.meta.env.DEV) console.log(`Provider: Emitting ATTEMPT_MOVE`);
      socket.emit("ATTEMPT_MOVE", { largeBoardIdx, smallBoardIdx });
    },
    []
  );
  const requestRematch = useCallback(() => {
    if (state.roomId && state.gameState?.gameStatus !== "InProgress") {
      if (import.meta.env.DEV)
        console.log(`Provider: Emitting REQUEST_REMATCH for ${state.roomId}`);
      socket.emit("REQUEST_REMATCH");
      dispatch({ type: "I_REQUESTED_REMATCH" });
    }
  }, [state.roomId, state.gameState?.gameStatus]);

  // --- Effect for Socket Listeners ---
  useEffect(() => {
    if (import.meta.env.DEV)
      console.log("Provider Effect: Registering Listeners...");

    const COLD_BOOT_THRESHOLD_MS = 20000; // 20 seconds heuristic

    // Define handlers that dispatch actions
    const handleConnect = () => {
      if (import.meta.env.DEV) console.log("Socket connected:", socket.id);
      dispatch({ type: "SET_CONNECTION_PHASE", payload: "connected" });
      connectionAttemptStartTime.current = null; // Reset timer
    };
    const handleDisconnect = (reason: Socket.DisconnectReason) => {
      if (import.meta.env.DEV) console.log("Socket disconnected:", reason);
      const message =
        reason === "io server disconnect"
          ? "Disconnected by server."
          : "Connection lost.";
      dispatch({ type: "SET_ERROR", payload: message }); // Set error message first
      dispatch({ type: "SET_CONNECTION_PHASE", payload: "disconnected" }); // Then set phase
      connectionAttemptStartTime.current = null; // Reset timer
    };
    const handleConnectError = (err: Error) => {
      if (import.meta.env.DEV) console.error("Socket connection error:", err);
      const currentTime = Date.now();
      const startTime = connectionAttemptStartTime.current;
      let targetPhase: ConnectionPhase = "error";
      let message = `Connection failed: ${err.message}`;

      // Check if this error occurred shortly after initiating the connection attempt
      if (startTime && currentTime - startTime < COLD_BOOT_THRESHOLD_MS) {
        targetPhase = "wakeupsuspected";
        message = "Server is waking up..."; // Specific message for toast/state
        if (import.meta.env.DEV)
          console.log(
            "Connection error within threshold, suspecting cold boot."
          );
        // Keep trying to connect implicitly by not disconnecting the socket instance here
      } else {
        // If error happens later, or we didn't track start time, treat as generic error
        targetPhase = "error";
        message = `Connection Error: ${err.message}`;
      }
      dispatch({ type: "SET_ERROR", payload: message }); // Set specific/generic message
      dispatch({ type: "SET_CONNECTION_PHASE", payload: targetPhase }); // Set the determined phase
    };

    // --- Other Handlers ---
    const handleGameStateUpdate = (gs: GameState) =>
      dispatch({ type: "SET_GAME_STATE", payload: gs });
    const handleYourRole = (role: Player | null) =>
      dispatch({ type: "SET_PLAYER_ROLE", payload: role });
    const handleRoomListUpdate = (list: RoomInfo[]) =>
      dispatch({ type: "SET_ROOM_LIST", payload: list });
    const handleRoomJoined = (data: {
      roomId: string;
      initialState: GameState;
      roomName: string;
    }) => dispatch({ type: "SET_ROOM_JOINED", payload: data });
    const handleGameStart = (data?: { initialState?: GameState }) =>
      dispatch({ type: "SET_GAME_START", payload: data });
    const handleOpponentDisconnect = () =>
      dispatch({ type: "OPPONENT_DISCONNECTED" });
    const handleSpectatorCount = (data: { count: number }) =>
      dispatch({ type: "SET_SPECTATOR_COUNT", payload: data.count });
    const handleErrorMessage = (msg: string) =>
      dispatch({ type: "SET_ERROR", payload: msg }); // Use SET_ERROR
    const handleGameEndedByDisconnect = () =>
      dispatch({ type: "GAME_ENDED_BY_DISCONNECT" });
    const handleOpponentWantsRematch = (data: { requestingPlayer: Player }) => {
      if (import.meta.env.DEV)
        console.log(
          `Provider: Opponent ${data.requestingPlayer} wants rematch.`
        );
      dispatch({ type: "OPPONENT_WANTS_REMATCH" });
    };
    const handleWaitingForRematch = () => {
      if (import.meta.env.DEV)
        console.log("Provider: Waiting for opponent's rematch approval.");
    };
    const handleTurnTimerUpdate = (
      payload: { player: Player; timeLeft: number; maxDuration: number } | null
    ) => {
      if (import.meta.env.DEV)
        console.log("Provider: Received TURN_TIMER_UPDATE", payload);
      dispatch({ type: "SET_TURN_TIMER", payload });
    };

    // Register listeners
    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("connect_error", handleConnectError);
    socket.on("GAME_STATE_UPDATE", handleGameStateUpdate);
    socket.on("YOUR_ROLE", handleYourRole);
    socket.on("ROOM_LIST_UPDATE", handleRoomListUpdate);
    socket.on("ROOM_JOINED", handleRoomJoined);
    socket.on("GAME_START", handleGameStart);
    socket.on("OPPONENT_DISCONNECTED", handleOpponentDisconnect);
    socket.on("SPECTATOR_COUNT_UPDATE", handleSpectatorCount);
    socket.on("ERROR_MESSAGE", handleErrorMessage); // Listen for server errors
    socket.on("GAME_ENDED_BY_DISCONNECT", handleGameEndedByDisconnect);
    socket.on("OPPONENT_WANTS_REMATCH", handleOpponentWantsRematch);
    socket.on("WAITING_FOR_REMATCH_APPROVAL", handleWaitingForRematch);
    socket.on("TURN_TIMER_UPDATE", handleTurnTimerUpdate);

    // Initial connection attempt only if idle
    if (state.connectionPhase === "idle") {
      if (import.meta.env.DEV)
        console.log("Provider Effect: Attempting initial connect...");
      dispatch({ type: "SET_CONNECTION_PHASE", payload: "connecting" });
      connectionAttemptStartTime.current = Date.now(); // Record start time
      socket.connect();
    }

    // Cleanup: Remove listeners on unmount or phase change
    return () => {
      if (import.meta.env.DEV)
        console.log("Provider Effect: Cleaning up listeners...");
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("connect_error", handleConnectError);
      socket.off("GAME_STATE_UPDATE", handleGameStateUpdate);
      socket.off("YOUR_ROLE", handleYourRole);
      socket.off("ROOM_LIST_UPDATE", handleRoomListUpdate);
      socket.off("ROOM_JOINED", handleRoomJoined);
      socket.off("GAME_START", handleGameStart);
      socket.off("OPPONENT_DISCONNECTED", handleOpponentDisconnect);
      socket.off("SPECTATOR_COUNT_UPDATE", handleSpectatorCount);
      socket.off("ERROR_MESSAGE", handleErrorMessage);
      socket.off("GAME_ENDED_BY_DISCONNECT", handleGameEndedByDisconnect);
      socket.off("OPPONENT_WANTS_REMATCH", handleOpponentWantsRematch);
      socket.off("WAITING_FOR_REMATCH_APPROVAL", handleWaitingForRematch);
      socket.off("TURN_TIMER_UPDATE", handleTurnTimerUpdate);
    };
    // Only re-run listener registration logic if the phase changes significantly?
    // For now, let's keep it simple and re-register if phase changes.
  }, [state.connectionPhase]); // Re-run effect if connectionPhase changes

  // Value provided by the context
  const isConnected = state.connectionPhase === "connected"; // Derived state
  const value: SocketContextValue = {
    ...state, // Spread all state properties
    isConnected, // Provide the boolean flag
    connectSocket,
    createRoom,
    joinRoom,
    leaveRoom,
    attemptMove,
    requestRematch,
  };

  return (
    <SocketContext.Provider value={value}>{children}</SocketContext.Provider>
  );
};

// --- Custom Hook to Consume Context ---
export const useSocketContext = (): SocketContextValue => {
  const context = useContext(SocketContext);
  if (context === undefined) {
    throw new Error("useSocketContext must be used within a SocketProvider");
  }
  return context;
};
