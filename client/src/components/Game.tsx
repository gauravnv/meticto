import React, { useState, useEffect } from 'react';
import LargeBoard from './LargeBoard';
import { useSocketContext } from '../context/SocketContext'; // Import context hook

const Game: React.FC = () => {
    // Consume context hook
    const {
        isConnected,
        gameState,
        playerRole,
        opponentJoined, // Get flag from context state
        opponentDisconnected,
        roomId,
        roomName,
        spectatorCount,
        serverError,
        leaveRoom, // Get action from context
        attemptMove, // Get action from context
        requestResetGame, // Get action from context
    } = useSocketContext();

    // Local UI State remains
    const [isAnimatingTurn, setIsAnimatingTurn] = useState(false);

    // Animation Effect remains (depends on gameState from context)
    useEffect(() => {
        if (!gameState || gameState.gameStatus !== 'InProgress') { setIsAnimatingTurn(false); return; }
        setIsAnimatingTurn(true);
        const timer = setTimeout(() => setIsAnimatingTurn(false), 600);
        return () => clearTimeout(timer);
    }, [gameState?.currentPlayer, gameState?.gameStatus]);

    // --- Click Handlers (Call context actions) ---
    const handleCellClick = (largeBoardIdx: number, smallBoardIdx: number) => {
        if (!gameState || gameState.gameStatus !== 'InProgress' || playerRole !== gameState.currentPlayer || !opponentJoined) {
             console.log("Game.tsx: Click ignored - Conditions not met (game state, turn, opponent joined).");
             return;
        }
        attemptMove(largeBoardIdx, smallBoardIdx);
    };
    const handleResetClick = () => { requestResetGame(); };
    const handleLeaveClick = () => { leaveRoom(); };

    // --- Conditional Rendering Logic ---

    // 1. Opponent Disconnected State (Show this screen preferentially)
    if (opponentDisconnected) {
       return (
         <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-gray-900 via-indigo-950 to-gray-900 text-white p-4">
           <h1 className="text-4xl font-bold mb-4">Meticto</h1>
           <div className="text-2xl text-red-500 mb-4">Opponent Disconnected</div>
           <div className="text-xl mb-6">Game ended.</div>
           {/* Provide button to go back to lobby explicitly */}
           <button onClick={handleLeaveClick} className="mt-4 px-4 py-2 bg-gray-600 rounded hover:bg-gray-700">Back to Lobby</button>
         </div>
       );
    }

    // 2. Connection/Server Error State (If disconnected or error received while in game)
    // Check !isConnected OR serverError. Added check for roomId to ensure we were meant to be in a game.
    if ((!isConnected || serverError) && roomId && !opponentDisconnected) {
         return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-gray-900 via-indigo-950 to-gray-900 text-white p-4">
                <h1 className="text-4xl font-bold mb-4">Meticto</h1>
                <div className="text-2xl text-red-500 mb-4">Error</div>
                <div className="text-xl mb-6">{serverError || "Connection lost."}</div>
                {/* Button to leave room state and return to lobby */}
                <button onClick={handleLeaveClick} className="mt-4 px-4 py-2 bg-gray-600 rounded hover:bg-gray-700">Back to Lobby</button>
            </div>
         );
    }

    // 3. Loading State: If App.tsx rendered us (so roomId exists), but gameState isn't loaded yet
    if (!gameState) {
        // This screen should only show briefly after joining/creating or on reconnect
        return (
           <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-gray-900 via-indigo-950 to-gray-900 text-white p-4">
               <h1 className="text-4xl font-bold mb-4">Meticto</h1>
               <div className="text-2xl text-yellow-400 animate-pulse">Loading game state... {roomName && `(Room: "${roomName}")`}</div>
               {/* Leave button is useful even if stuck loading */}
               <button onClick={handleLeaveClick} className="mt-6 px-4 py-2 bg-gray-600 rounded hover:bg-gray-700">Back to Lobby</button>
           </div>
         );
    }


    // --- If gameState IS available, Determine Status Texts ---
    // Player Role Info
    let playerInfoText = playerRole ? `You are Player ${playerRole}` : "Spectating";
    let roomInfoText = roomName ? ` in room "${roomName}"` : "";
    let spectatorInfo = spectatorCount > 0 ? ` (${spectatorCount} watching)` : "";

    // Main Status/Turn Text
    let statusText: string;
    // Check if waiting for opponent AFTER joining the room
    const isGameReadyToPlay = opponentJoined || playerRole === null; // Ready if opponent joined or spectating

    if (gameState.gameStatus === 'X' || gameState.gameStatus === 'O') { statusText = `Player ${gameState.gameStatus} Wins! ${gameState.gameStatus === playerRole ? '🎉 You won!' : (playerRole ? 'You lost.' : '')}`; }
    else if (gameState.gameStatus === 'Draw') { statusText = 'Game is a Draw!'; }
    // --- Check if ready to play before showing turn info ---
    else if (!isGameReadyToPlay && playerRole) {
         statusText = "Waiting for opponent to join...";
    } else {
       // Game In Progress - Determine turn text based on player role
       if (!playerRole) { // Spectator view
           statusText = `Player ${gameState.currentPlayer}'s Turn`;
       } else if (playerRole === gameState.currentPlayer) { // Your turn
            statusText = "Your Turn";
       } else { // Opponent's turn
           statusText = `Player ${gameState.currentPlayer}'s Turn`;
       }
       // Add board target information
       if (gameState.activeBoardIndex !== null) {
           statusText += ` - Play in Board ${gameState.activeBoardIndex + 1}`;
       } else {
           statusText += ` - Play anywhere`;
       }
    }


    // --- Render the Main Game UI ---
    return (
      // Apply background gradient and conditional turn animation class
      // Added relative positioning for absolute elements inside
      <div className={`relative flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-gray-900 via-indigo-950 to-gray-900 text-white p-4 pt-16 sm:pt-4 ${isAnimatingTurn ? 'animate-turn-pulse' : ''}`}>

        {/* Leave Room Button (Positioned Top Left) */}
        <div className="absolute top-3 left-3 sm:top-4 sm:left-4 z-20">
             <button
                onClick={handleLeaveClick}
                className="px-3 py-1 bg-red-700 hover:bg-red-800 text-white text-xs sm:text-sm font-semibold rounded shadow-md transition duration-150 ease-in-out"
                title="Leave Game Room"
             >
                 Leave
             </button>
        </div>

        {/* Game Title */}
        <h1 className="text-3xl sm:text-4xl font-bold mb-2 sm:mb-4 mt-8 sm:mt-0">Meticto</h1>

        {/* Player/Room/Spectator Info Area */}
        <div className="text-base sm:text-xl mb-1 h-6 font-semibold text-center text-gray-300">{playerInfoText}{roomInfoText}{spectatorInfo}</div>

        {/* Game Status / Turn Indicator */}
        <div className="text-xl sm:text-2xl mb-4 h-8 text-center">{statusText}</div>

        {/* Display Mid-Game Server Errors */}
        {serverError && !opponentDisconnected && <p className="absolute top-14 sm:top-auto sm:relative text-red-500 text-xs sm:text-sm mb-2 px-2 text-center">Error: {serverError}</p>}

        {/* Game Board Area */}
        <div className="mt-4 w-full max-w-lg">
          <LargeBoard
            // Pass all necessary props derived from gameState and playerRole
            largeBoardState={gameState.largeBoard}
            activeBoardIndex={gameState.activeBoardIndex}
            currentPlayer={gameState.currentPlayer}
            myRole={playerRole}
            gameStatus={gameState.gameStatus}
            largeWinningLine={gameState.largeWinningLine}
            onCellClick={handleCellClick}
          />
        </div>

        {/* Rematch Button: Show only if game is finished AND user was a player */}
        {(gameState.gameStatus !== 'InProgress' && playerRole) && (
            <button
                onClick={handleResetClick} // Emits 'REQUEST_RESET_GAME'
                className="mt-6 px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg shadow-md transition duration-150 ease-in-out"
                aria-label="Request Rematch"
            >
                Request Rematch? {/* Label clearly indicates user action */}
            </button>
        )}
      </div>
    );
};

export default Game;