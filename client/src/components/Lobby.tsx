import React, { useState } from 'react';
import { RoomInfo } from '../types';

interface LobbyProps { roomList: RoomInfo[]; onCreateRoom: (roomName?: string) => void; onJoinRoom: (roomId: string) => void; isConnecting: boolean; serverError: string | null; }

const Lobby: React.FC<LobbyProps> = ({ roomList, onCreateRoom, onJoinRoom, isConnecting, serverError }) => {
    const [newRoomName, setNewRoomName] = useState('');
    const handleCreateClick = () => { onCreateRoom(newRoomName.trim() || undefined); setNewRoomName(''); };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-gray-800 via-gray-900 to-gray-800 text-white p-6">
            <h1 className="text-4xl font-bold mb-8 text-indigo-400">Meticto Lobby</h1>
            {isConnecting && <p className="text-yellow-400 animate-pulse mb-4">Connecting...</p>}
            {serverError && <p className="text-red-500 mb-4 font-semibold">Error: {serverError}</p>}
            {/* Create Room Section */}
            <div className="mb-8 p-4 border border-indigo-700 rounded-lg w-full max-w-md">
                <h2 className="text-2xl font-semibold mb-3 text-indigo-300">Create New Room</h2>
                <div className="flex flex-col sm:flex-row gap-2">
                    <input type="text" value={newRoomName} onChange={(e) => setNewRoomName(e.target.value)} placeholder="Optional room name" maxLength={30} className="flex-grow px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500" disabled={isConnecting} />
                    <button onClick={handleCreateClick} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded shadow-md transition duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed" disabled={isConnecting} > Create Room </button>
                </div>
            </div>
            {/* Join Room Section */}
            <div className="w-full max-w-md">
                <h2 className="text-2xl font-semibold mb-3 text-indigo-300">Join Waiting Room</h2>
                {roomList.length === 0 ? ( <p className="text-gray-400">No rooms available to join.</p> ) : (
                    <ul className="space-y-2"> {roomList.map((room) => ( <li key={room.roomId} className="flex justify-between items-center p-3 bg-gray-700/50 border border-gray-600 rounded hover:bg-gray-700/80"> <span className="font-medium">{room.roomName}</span> <button onClick={() => onJoinRoom(room.roomId)} className="px-4 py-1 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded shadow transition duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed" disabled={isConnecting} > Join </button> </li> ))} </ul>
                )}
            </div>
        </div>
    );
};
export default Lobby;