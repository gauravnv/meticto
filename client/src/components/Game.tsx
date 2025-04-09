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
        rematchOffered,
        rematchRequested,
        currentTimer,
        leaveRoom, // Get action from context
        attemptMove, // Get action from context
        requestRematch, // Get action from context
    } = useSocketContext();

    // Local UI State remains
    const [isAnimatingTurn, setIsAnimatingTurn] = useState(false);
    const [displayTimeLeft, setDisplayTimeLeft] = useState<number | null>(null);

    // Animation Effect remains (depends on gameState from context)
    useEffect(() => {
        if (!gameState || gameState.gameStatus !== 'InProgress') { setIsAnimatingTurn(false); return; }
        setIsAnimatingTurn(true);
        const timer = setTimeout(() => setIsAnimatingTurn(false), 600);
        return () => clearTimeout(timer);
    }, [gameState?.currentPlayer, gameState?.gameStatus]);

     // --- Countdown Timer Effect ---
     useEffect(() => {
        let intervalId: number | null = null;

        if (currentTimer) {
            // Set initial display time from server data
            setDisplayTimeLeft(currentTimer.timeLeft);

            // Start interval to decrement the display time
            intervalId = setInterval(() => {
                setDisplayTimeLeft(prevTime => {
                    if (prevTime === null || prevTime <= 0) {
                        if(intervalId) clearInterval(intervalId); // Stop interval if time runs out client-side
                        return 0;
                    }
                    return prevTime - 1;
                });
            }, 1000); // Update every second

        } else {
            // No timer active, clear display
            setDisplayTimeLeft(null);
        }

        // Cleanup function: Clear interval when component unmounts or currentTimer changes
        return () => {
            if (intervalId) {
                clearInterval(intervalId);
            }
        };
    }, [currentTimer]); // Re-run effect when currentTimer object changes


    // --- Click Handlers (Call context actions) ---
    const handleCellClick = (largeBoardIdx: number, smallBoardIdx: number) => {
        if (!gameState || gameState.gameStatus !== 'InProgress' || playerRole !== gameState.currentPlayer || !opponentJoined) {
             console.log("Game.tsx: Click ignored - Conditions not met (game state, turn, opponent joined).");
             return;
        }
        attemptMove(largeBoardIdx, smallBoardIdx);
    };
    const handleResetClick = () => { requestRematch(); };
    const handleLeaveClick = () => { leaveRoom(); };

    // --- Conditional Rendering Logic ---

    // 1. Opponent Disconnected State (Show this screen preferentially)
    if (opponentDisconnected) {
       return (
         <div className="flex flex-col items-center justify-center min-h-screen p-4 text-white bg-gradient-to-br from-gray-900 via-indigo-950 to-gray-900">
           <h1 className="mb-4 text-4xl font-bold">Meticto</h1>
           <div className="mb-4 text-2xl text-red-500">Opponent Disconnected</div>
           <div className="mb-6 text-xl">Game ended.</div>
           {/* Provide button to go back to lobby explicitly */}
           <button onClick={handleLeaveClick} className="px-4 py-2 mt-4 bg-gray-600 rounded hover:bg-gray-700">Back to Lobby</button>
         </div>
       );
    }

    // 2. Connection/Server Error State (If disconnected or error received while in game)
    // Check !isConnected OR serverError. Added check for roomId to ensure we were meant to be in a game.
    if ((!isConnected || serverError) && roomId && !opponentDisconnected) {
         return (
            <div className="flex flex-col items-center justify-center min-h-screen p-4 text-white bg-gradient-to-br from-gray-900 via-indigo-950 to-gray-900">
                <h1 className="mb-4 text-4xl font-bold">Meticto</h1>
                <div className="mb-4 text-2xl text-red-500">Error</div>
                <div className="mb-6 text-xl">{serverError || "Connection lost."}</div>
                {/* Button to leave room state and return to lobby */}
                <button onClick={handleLeaveClick} className="px-4 py-2 mt-4 bg-gray-600 rounded hover:bg-gray-700">Back to Lobby</button>
            </div>
         );
    }

    // 3. Loading State: If App.tsx rendered us (so roomId exists), but gameState isn't loaded yet
    if (!gameState) {
        // This screen should only show briefly after joining/creating or on reconnect
        return (
           <div className="flex flex-col items-center justify-center min-h-screen p-4 text-white bg-gradient-to-br from-gray-900 via-indigo-950 to-gray-900">
               <h1 className="mb-4 text-4xl font-bold">Meticto</h1>
               <div className="text-2xl text-yellow-400 animate-pulse">Loading game state... {roomName && `(Room: "${roomName}")`}</div>
               {/* Leave button is useful even if stuck loading */}
               <button onClick={handleLeaveClick} className="px-4 py-2 mt-6 bg-gray-600 rounded hover:bg-gray-700">Back to Lobby</button>
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
        <div className="absolute z-20 top-3 left-3 sm:top-4 sm:left-4">
             <button
                onClick={handleLeaveClick}
                className="px-3 py-1 text-xs font-semibold text-white transition duration-150 ease-in-out bg-red-700 rounded shadow-md hover:bg-red-800 sm:text-sm"
                title="Leave Game Room"
             >
                 Leave
             </button>
        </div>

        {/* Game Title */}
        <h1 className="mt-8 mb-2 text-3xl font-bold sm:text-4xl sm:mb-4 sm:mt-0">Meticto</h1>

        {/* Player/Room/Spectator Info Area */}
        <div className="h-6 mb-1 text-base font-semibold text-center text-gray-300 sm:text-xl">{playerInfoText}{roomInfoText}{spectatorInfo}</div>

        {/* Game Status / Turn Indicator */}
        <div className="h-8 mb-4 text-xl text-center sm:text-2xl">{statusText}</div>

        {/* --- Timer Display --- */}
        <div className="h-6 mb-3 text-center"> {/* Added height and margin */}
            {displayTimeLeft !== null && currentTimer && (
                <p className={`text-lg font-medium ${
                    // Optional: Change color when time is low
                    displayTimeLeft <= 10 ? 'text-red-400 animate-pulse' : 'text-yellow-300'
                }`}>
                    {/* Indicate whose timer it is */}
                    {currentTimer.player === playerRole ? 'Your Time:' : `Player ${currentTimer.player}'s Time:`}
                    {' '} {/* Space */}
                    {/* Display remaining seconds */}
                    {displayTimeLeft}s
                </p>
            )}
             {/* Show placeholder if no timer active but game is playing */}
             {displayTimeLeft === null && gameState?.gameStatus === 'InProgress' && <p className="text-sm text-gray-500">(No turn timer)</p>}
        </div>
        {/* --- End Timer Display --- */}

        {/* Display Mid-Game Server Errors */}
        {serverError && !opponentDisconnected && <p className="absolute px-2 mb-2 text-xs text-center text-red-500 top-14 sm:top-auto sm:relative sm:text-sm">Error: {serverError}</p>}

        {/* Game Board Area */}
        <div className="w-full max-w-lg mt-4">
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
            <div className="mt-6 text-center">
                {/* Show message if opponent wants rematch */}
                {rematchOffered && !rematchRequested && (
                    <p className="mb-2 text-yellow-400 animate-pulse">Opponent wants a rematch!</p>
                )}
                 {/* Show message if you requested rematch */}
                {rematchRequested && !rematchOffered && (
                    <p className="mb-2 text-gray-400">Rematch requested. Waiting for opponent...</p>
                )}
                {/* Show button: Different text/action based on state */}
                <button
                    onClick={handleResetClick}
                    className="px-6 py-2 font-semibold text-white transition duration-150 ease-in-out bg-indigo-600 rounded-lg shadow-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label={rematchOffered ? "Accept Rematch" : "Request Rematch"}
                    disabled={rematchRequested} // Disable if already requested
                >
                    {/* Change button text based on whether opponent requested */}
                    {rematchOffered ? "Accept Rematch & Play Again" : (rematchRequested ? "Rematch Requested" : "Request Rematch?")}
                </button>
            </div>
        )}
      </div>
    );
};

export default Game;