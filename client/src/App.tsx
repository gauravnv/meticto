import Game from "./components/Game";
import Lobby from "./components/Lobby";
import { useSocketContext } from "./context/SocketContext";

function App() {
  const {
    // Use connectionPhase and isConnected
    connectionPhase,
    isConnected,
    roomId,
    roomList,
    createRoom,
    joinRoom,
  } = useSocketContext();

  let content;

  // 1. Show Game if connected and in a room
  if (isConnected && roomId) {
    content = <Game />;
  }
  // 2. Show Lobby if connected but not in a room
  else if (isConnected && !roomId) {
    content = (
      <Lobby
        roomList={roomList}
        onCreateRoom={createRoom}
        onJoinRoom={joinRoom}
        isConnecting={false} // Lobby is only shown when connected
      />
    );
  }
  // 3. Show Specific Loading/Connecting/Wakeup States
  else if (connectionPhase === "connecting" || connectionPhase === "idle") {
    content = (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 text-white bg-gradient-to-br from-gray-900 via-indigo-950 to-gray-900">
        <h1 className="mb-4 text-4xl font-bold">Meticto</h1>
        <div className="text-2xl animate-pulse">Connecting to server...</div>
        <p className="mt-2 text-sm text-gray-400">
          (Server may need a moment to wake up)
        </p>
      </div>
    );
  } else if (connectionPhase === "wakeupsuspected") {
    content = (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 text-white bg-gradient-to-br from-gray-900 via-indigo-950 to-gray-900">
        <h1 className="mb-4 text-4xl font-bold">Meticto</h1>
        <div className="flex items-center gap-3 text-2xl text-yellow-400">
          <div className="w-6 h-6 border-4 border-yellow-400 rounded-full border-t-transparent animate-spin"></div>
          Server is waking up...
        </div>
        <p className="mt-2 text-sm text-gray-400">
          (This may take up to 60 seconds)
        </p>
      </div>
    );
  }
  // 4. Show Generic Error / Disconnected State
  // Covers 'error' and 'disconnected' phases
  else {
    // Handle 'error', 'disconnected'
    content = (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 text-white bg-gradient-to-br from-gray-900 via-indigo-950 to-gray-900">
        <h1 className="mb-4 text-4xl font-bold">Meticto</h1>
        <div className="mb-4 text-2xl text-red-500">
          {connectionPhase === "disconnected"
            ? "Disconnected"
            : "Connection Error"}
        </div>
        {/* Display a generic message - specific error shown via toast */}
        <div className="mb-6 text-xl">
          {connectionPhase === "disconnected"
            ? "You have been disconnected."
            : "Could not connect to the server."}
        </div>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 mt-4 bg-blue-600 rounded hover:bg-blue-700"
        >
          Try Again
        </button>
      </div>
    );
  }

  return <>{content}</>;
}

export default App;
