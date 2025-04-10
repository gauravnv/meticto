import React, { useState } from 'react';
import { RoomInfo } from '../types';

interface LobbyProps {
    roomList: RoomInfo[]; // Expecting the updated RoomInfo structure
    // Update onCreateRoom signature to accept duration
    onCreateRoom: (options: { roomName?: string; duration?: number }) => void;
    onJoinRoom: (roomId: string) => void; // Used for both joining and spectating
    isConnecting: boolean;
}

const Lobby: React.FC<LobbyProps> = ({
    roomList,
    onCreateRoom,
    onJoinRoom, // Renamed for clarity, handles joining Waiting or Spectating others
    isConnecting,
}) => {
    const [newRoomName, setNewRoomName] = useState('');
    // Store duration in seconds (0 for None)
    const [timerDuration, setTimerDuration] = useState<number>(0);

    const handleCreateClick = () => {
        // Trim whitespace, send undefined if empty so server uses default name
        // Pass options object including duration
        onCreateRoom({
            roomName: newRoomName.trim() || undefined,
            duration: timerDuration === 0 ? undefined : timerDuration // Send undefined if 0 (None)
        });
        setNewRoomName(''); // Clear input
        setTimerDuration(0); // Reset dropdown
    };

    // Helper function to get Tailwind color class based on room status
    const getStatusColor = (status: RoomInfo['status']): string => {
        switch (status) {
            case 'Waiting':
                return 'text-yellow-400';
            case 'Playing':
                return 'text-green-400';
            case 'Finished':
                return 'text-gray-500';
            default:
                return 'text-gray-400'; // Fallback
        }
    };

    // Timer options mapping
    const timerOptions = [
        { value: 0, label: 'None' },
        { value: 15, label: '15 seconds' },
        { value: 30, label: '30 seconds' },
        { value: 60, label: '60 seconds' },
    ];

    return (
        <div className="flex flex-col items-center justify-center min-h-screen p-6 text-white bg-gradient-to-br from-gray-800 via-gray-900 to-gray-800">
            <h1 className="mb-8 text-4xl font-bold text-indigo-400">Game Lobby</h1>

            {/* Connection/Error Status */}
            {isConnecting && (
                <p className="mb-4 text-yellow-400 animate-pulse">Connecting...</p>
            )}

            {/* Create Room Section */}
            <div className="w-full max-w-md p-4 mb-8 border border-indigo-700 rounded-lg">
                <h2 className="mb-3 text-2xl font-semibold text-indigo-300">
                    Create New Room
                </h2>
                {/* Input Row */}
                <div className="flex flex-col gap-3 sm:flex-row sm:gap-2">
                    <input
                        type="text"
                        value={newRoomName}
                        onChange={(e) => setNewRoomName(e.target.value)}
                        placeholder="Optional room name"
                        maxLength={30} // Match server sanitization limit
                        className="flex-grow px-3 py-2 text-white placeholder-gray-400 bg-gray-700 border border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        disabled={isConnecting}
                    />
                     {/* Timer Selection Dropdown */}
                     <div className="flex-shrink-0"> {/* Prevent dropdown from shrinking too much */}
                        <label htmlFor="timer-select" className="sr-only">Turn Timer</label> {/* Screen reader label */}
                        <select
                            id="timer-select"
                            value={timerDuration}
                            onChange={(e) => setTimerDuration(Number(e.target.value))}
                            className="w-full px-3 py-2 text-white bg-gray-700 border border-gray-600 rounded sm:w-auto focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            disabled={isConnecting}
                        >
                            {timerOptions.map(option => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
                 {/* Create Button (Moved below inputs) */}
                 <div className="mt-3 text-right">
                    <button
                        onClick={handleCreateClick}
                        className="px-5 py-2 font-semibold text-white transition duration-150 ease-in-out bg-indigo-600 rounded shadow-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={isConnecting}
                    >
                        Create Room
                    </button>
                </div>
            </div>

            {/* Join/Spectate Room Section */}
            <div className="w-full max-w-md">
                <h2 className="mb-3 text-2xl font-semibold text-indigo-300">
                    Available Games
                </h2>
                {/* Show message if list is empty */}
                {!isConnecting && roomList.length === 0 && (
                    <p className="text-gray-400">No active games found. Why not create one?</p>
                )}
                {/* Display list of rooms */}
                {roomList.length > 0 && (
                    <ul className="space-y-2">
                        {roomList.map((room) => (
                            <li
                                key={room.roomId}
                                className="flex flex-col items-start justify-between gap-2 p-3 transition-colors duration-150 border border-gray-600 rounded sm:flex-row sm:items-center bg-gray-700/50 hover:bg-gray-600/80" // Added hover effect
                            >
                                {/* Room Info */}
                                <div className="flex-grow">
                                    <span className="mr-2 font-medium">{room.roomName}</span>
                                    {/* Display Status with Color */}
                                    <span className={`text-sm font-semibold ${getStatusColor(room.status)}`}>
                                        ({room.status})
                                    </span>
                                    {/* Display Player/Spectator Count */}
                                    <span className="block text-xs text-gray-400 sm:inline sm:ml-2">
                                        ({room.playerCount}/2 Players{room.spectatorCount > 0 ? `, ${room.spectatorCount} Watching` : ''})
                                    </span>
                                </div>
                                {/* Action Buttons */}
                                <div className="flex self-end gap-2 sm:self-center">
                                    {/* Show JOIN button only if Waiting */}
                                    {room.status === 'Waiting' && (
                                        <button
                                            onClick={() => onJoinRoom(room.roomId)}
                                            className="px-4 py-1 text-sm font-semibold text-white transition duration-150 ease-in-out bg-green-600 rounded shadow hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                            disabled={isConnecting}
                                            title="Join as Player O"
                                        >
                                            Join
                                        </button>
                                    )}
                                    {/* Show SPECTATE button if Playing or Finished */}
                                    {(room.status === 'Playing' || room.status === 'Finished') && (
                                         <button
                                            onClick={() => onJoinRoom(room.roomId)} // Same event, server differentiates logic
                                            className="px-4 py-1 text-sm font-semibold text-white transition duration-150 ease-in-out bg-blue-600 rounded shadow hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                            disabled={isConnecting}
                                            title="Watch Game"
                                        >
                                            Spectate
                                        </button>
                                    )}
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
};

export default Lobby;