import React, { useState, useEffect, useRef } from 'react';
import LargeBoard from './LargeBoard';
import { useSocketContext } from '../context/SocketContext';

function usePrevious<T>(value: T): T | undefined {
    const ref = useRef<T | undefined>(undefined);
    useEffect(() => {
      ref.current = value;
    });
    return ref.current;
  }

const Game: React.FC = () => {
    const {
        isConnected,
        gameState,
        playerRole,
        opponentJoined,
        opponentDisconnected,
        roomId,
        roomName,
        spectatorCount,
        serverError,
        rematchOffered,
        rematchRequested,
        currentTimer,
        leaveRoom,
        attemptMove,
        requestRematch,
    } = useSocketContext();

    // Local state for countdown display
    const [displayTimeLeft, setDisplayTimeLeft] = useState<number | null>(null);
    // Get previous player state to detect change
    const prevPlayer = usePrevious(gameState?.currentPlayer);
    // Ref to store the Audio object to prevent creating it unnecessarily
    const turnAudioRef = useRef<HTMLAudioElement | null>(null);

    // --- Countdown Timer Effect ---
    useEffect(() => {
        let intervalId: number | null = null; // Use number for interval ID type

        if (currentTimer) {
            setDisplayTimeLeft(currentTimer.timeLeft);
            intervalId = setInterval(() => {
                setDisplayTimeLeft(prevTime => {
                    if (prevTime === null || prevTime <= 0) {
                        if(intervalId) clearInterval(intervalId);
                        return 0;
                    }
                    return prevTime - 1;
                });
            }, 1000);

        } else {
            setDisplayTimeLeft(null);
        }

        return () => {
            if (intervalId) {
                clearInterval(intervalId);
            }
        };
    }, [currentTimer]);

     // --- Audio Cue Effect ---
     useEffect(() => {
        if (
            gameState &&
            gameState.gameStatus === 'InProgress' &&
            playerRole &&
            prevPlayer !== undefined &&
            prevPlayer !== gameState.currentPlayer &&
            gameState.currentPlayer === playerRole
        ) {
            try {
                // Initialize Audio object on first use or if needed
                if (!turnAudioRef.current) {
                    turnAudioRef.current = new Audio('/notify.wav');
                }
                // Play the sound
                turnAudioRef.current.currentTime = 0;
                turnAudioRef.current.play().catch(error => {
                    // Autoplay restrictions might cause an error
                    console.warn("Audio play failed (possibly autoplay restriction):", error);
                });
            } catch (error) {
                console.error("Failed to load or play audio:", error);
            }
        }
    }, [gameState?.currentPlayer, prevPlayer, playerRole, gameState?.gameStatus]);


    // --- Click Handlers ---
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
     // 1. Opponent Disconnected State
     if (opponentDisconnected) {
        return (
          <div className="flex flex-col items-center justify-center min-h-screen p-4 text-white bg-gradient-to-br from-gray-900 via-indigo-950 to-gray-900">
            <h1 className="mb-4 text-4xl font-bold">Meticto</h1>
            <div className="mb-4 text-2xl text-red-500">Opponent Disconnected</div>
            <div className="mb-6 text-xl">Game ended.</div>
            <button onClick={handleLeaveClick} className="px-4 py-2 mt-4 bg-gray-600 rounded hover:bg-gray-700">Back to Lobby</button>
          </div>
        );
     }
     // 2. Connection/Server Error State
     if ((!isConnected || serverError) && roomId && !opponentDisconnected) {
          return (
             <div className="flex flex-col items-center justify-center min-h-screen p-4 text-white bg-gradient-to-br from-gray-900 via-indigo-950 to-gray-900">
                 <h1 className="mb-4 text-4xl font-bold">Meticto</h1>
                 <div className="mb-4 text-2xl text-red-500">Error</div>
                 <div className="mb-6 text-xl">{serverError || "Connection lost."}</div>
                 <button onClick={handleLeaveClick} className="px-4 py-2 mt-4 bg-gray-600 rounded hover:bg-gray-700">Back to Lobby</button>
             </div>
          );
     }
     // 3. Loading State
     if (!gameState) {
         return (
            <div className="flex flex-col items-center justify-center min-h-screen p-4 text-white bg-gradient-to-br from-gray-900 via-indigo-950 to-gray-900">
                <h1 className="mb-4 text-4xl font-bold">Meticto</h1>
                <div className="text-2xl text-yellow-400 animate-pulse">Loading game state... {roomName && `(Room: "${roomName}")`}</div>
                <button onClick={handleLeaveClick} className="px-4 py-2 mt-6 bg-gray-600 rounded hover:bg-gray-700">Back to Lobby</button>
            </div>
          );
     }


    // --- If gameState IS available, Determine Status Texts ---
     const playerInfoText = playerRole ? `You are Player ${playerRole}` : "Spectating";
     const roomInfoText = roomName ? ` in room "${roomName}"` : "";
     const spectatorInfo = spectatorCount > 0 ? ` (${spectatorCount} watching)` : "";
     let statusText: string;
     const isGameReadyToPlay = opponentJoined || playerRole === null;
     if (gameState.gameStatus === 'X' || gameState.gameStatus === 'O') { statusText = `Player ${gameState.gameStatus} Wins! ${gameState.gameStatus === playerRole ? '🎉 You won!' : (playerRole ? 'You lost.' : '')}`; }
     else if (gameState.gameStatus === 'Draw') { statusText = 'Game is a Draw!'; }
     else if (!isGameReadyToPlay && playerRole) { statusText = "Waiting for opponent to join..."; }
     else {
        if (!playerRole) { statusText = `Player ${gameState.currentPlayer}'s Turn`; }
        else if (playerRole === gameState.currentPlayer) { statusText = "Your Turn"; }
        else { statusText = `Player ${gameState.currentPlayer}'s Turn`; }
        if (gameState.activeBoardIndex !== null) { statusText += ` - Play in Board ${gameState.activeBoardIndex + 1}`; }
        else { statusText += ` - Play anywhere`; }
     }


    // --- Render the Main Game UI ---
    return (
      <div className={`relative flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-gray-900 via-indigo-950 to-gray-900 text-white p-4 pt-16 sm:pt-4`}>

        {/* Leave Room Button */}
         <div className="absolute z-20 top-3 left-3 sm:top-4 sm:left-4">
              <button onClick={handleLeaveClick} className="px-3 py-1 text-xs font-semibold text-white transition duration-150 ease-in-out bg-red-700 rounded shadow-md hover:bg-red-800 sm:text-sm" title="Leave Game Room">Leave</button>
         </div>

        {/* Game Title */}
        <h1 className="mt-8 mb-2 text-3xl font-bold sm:text-4xl sm:mb-4 sm:mt-0">Meticto</h1>

        {/* Player/Room/Spectator Info Area */}
        <div className="h-6 mb-1 text-base font-semibold text-center text-gray-300 sm:text-xl">{playerInfoText}{roomInfoText}{spectatorInfo}</div>

        {/* Game Status / Turn Indicator */}
        <div className="h-8 mb-1 text-xl text-center sm:text-2xl">{statusText}</div>

        {/* Timer Display */}
        <div className="h-6 mb-3 text-center">
            {displayTimeLeft !== null && currentTimer && (
                <p className={`text-lg font-medium ${displayTimeLeft <= 10 ? 'text-red-400 animate-pulse' : 'text-yellow-300'}`}>
                    {currentTimer.player === playerRole ? 'Your Time:' : `Player ${currentTimer.player}'s Time:`}{' '}{displayTimeLeft}s
                </p>
            )}
             {displayTimeLeft === null && gameState?.gameStatus === 'InProgress' && <p className="text-sm text-gray-500">(No turn timer)</p>}
        </div>

        {/* Display Mid-Game Server Errors */}
        {serverError && !opponentDisconnected && <p className="absolute px-2 mb-2 text-xs text-center text-red-500 top-14 sm:top-auto sm:relative sm:text-sm">Error: {serverError}</p>}

        {/* Game Board Area */}
        <div className="w-full max-w-lg mt-2">
          {/* Ensure all necessary props are passed */}
          <LargeBoard
            largeBoardState={gameState.largeBoard}
            activeBoardIndex={gameState.activeBoardIndex}
            currentPlayer={gameState.currentPlayer}
            myRole={playerRole}
            gameStatus={gameState.gameStatus}
            largeWinningLine={gameState.largeWinningLine}
            onCellClick={handleCellClick}
          />
        </div>

        {/* Rematch Button */}
        {(gameState.gameStatus !== 'InProgress' && playerRole) && (
             <div className="mt-6 text-center">
                 {rematchOffered && !rematchRequested && (<p className="mb-2 text-yellow-400 animate-pulse">Opponent wants a rematch!</p>)}
                 {rematchRequested && !rematchOffered && (<p className="mb-2 text-gray-400">Rematch requested. Waiting for opponent...</p>)}
                 <button onClick={handleResetClick} className="px-6 py-2 font-semibold text-white transition duration-150 ease-in-out bg-indigo-600 rounded-lg shadow-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed" aria-label={rematchOffered ? "Accept Rematch" : "Request Rematch"} disabled={rematchRequested}>
                     {rematchOffered ? "Accept Rematch & Play Again" : (rematchRequested ? "Rematch Requested" : "Request Rematch?")}
                 </button>
             </div>
         )}
      </div>
    );
};

export default Game;