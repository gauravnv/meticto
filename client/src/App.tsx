import Game from './components/Game';
import Lobby from './components/Lobby';
import { useSocketContext } from './context/SocketContext';

function App() {
    // Get state and actions from context
    const {
        isConnected,
        roomId,
        roomList,
        createRoom,
        joinRoom,
    } = useSocketContext(); // Use context hook

    let content;

    // 1. Show Game if we are in a room (roomId is set from context)
    if (roomId) {
        content = <Game />; // Game component will consume context itself
    }
    // 2. Show Lobby if connected but not in a room
    else if (isConnected && !roomId) {
         content = (
             <Lobby
                roomList={roomList}
                onCreateRoom={createRoom} // Pass actions from context
                onJoinRoom={joinRoom}     // Pass actions from context
                isConnecting={false}
             />
         );
    }
    // 3. Show Connection Error State
    // If explicitly not connected AND there's a server error message.
    else if (!isConnected) {
         content = (
            <div className="flex flex-col items-center justify-center min-h-screen p-4 text-white bg-gradient-to-br from-gray-900 via-indigo-950 to-gray-900">
              <h1 className="mb-4 text-4xl font-bold">Meticto</h1>
              <div className="mb-4 text-2xl text-red-500">Connection Error</div>
              <div className="mb-6 text-xl">Could not connect to the server.</div>
              {/* Simple refresh button to allow user retry */}
              <button onClick={() => window.location.reload()} className="px-4 py-2 mt-4 bg-blue-600 rounded hover:bg-blue-700">Refresh Page</button>
            </div>
         );
    }
    // 4. Catch-all Loading/Connecting State
    // Covers the initial state before connection is established or first room list is received.
    else {
         content = (
            <div className="flex flex-col items-center justify-center min-h-screen p-4 text-white bg-gradient-to-br from-gray-900 via-indigo-950 to-gray-900">
                <h1 className="mb-4 text-4xl font-bold">Meticto</h1>
                <div className="text-2xl animate-pulse">
                    {/* Show different text based on state */}
                    {!isConnected ? 'Connecting...' : 'Loading Lobby...'}
                </div>
            </div>
        );
    }

    // Render the determined component tree
    return <>{content}</>;
}

// Export the App component for use in main.tsx/index.tsx
export default App;