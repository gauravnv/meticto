import React, { useState, useEffect, useRef } from 'react';
import LargeBoard from './LargeBoard';
import { useSocketContext } from '../context/SocketContext';
import { GameState, isSmallBoardFinished } from '../types';
import { trackEvent } from '../utils/analytics';
import { useSettings } from '../context/SettingsContext';

function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T | undefined>(undefined);
  useEffect(() => {
    ref.current = value;
  });
  return ref.current;
}

// Helper hook to get previous GameState
function usePreviousGameState(value: GameState | null): GameState | null | undefined {
    const ref = useRef<GameState | null>(null);
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
        rematchOffered,
        rematchRequested,
        currentTimer,
        leaveRoom,
        attemptMove,
        requestRematch,
    } = useSocketContext();
    const { isMuted, toggleMute } = useSettings();

    // Local state for countdown display
    const [displayTimeLeft, setDisplayTimeLeft] = useState<number | null>(null);
    // Get previous player state to detect change for audio cue
    const prevPlayer = usePrevious(gameState?.currentPlayer);
    // Ref to store the Audio object
    const turnAudioRef = useRef<HTMLAudioElement | null>(null);
    const winAudioRef = useRef<HTMLAudioElement | null>(null);
    const loseAudioRef = useRef<HTMLAudioElement | null>(null);
    const drawAudioRef = useRef<HTMLAudioElement | null>(null);
    const prevGameState = usePreviousGameState(gameState);
    const prevGameStateStatus = prevGameState?.gameStatus 

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

        // Cleanup function: Clear interval when component unmounts or currentTimer changes
        return () => {
            if (intervalId) {
                clearInterval(intervalId);
            }
        };
    }, [currentTimer]); // Re-run effect when currentTimer object changes


    // --- Audio Cue Effect ---
    useEffect(() => {
        if (
            !isMuted &&
            gameState && gameState.gameStatus === 'InProgress' && playerRole &&
            prevPlayer !== undefined && prevPlayer !== gameState.currentPlayer &&
            gameState.currentPlayer === playerRole
        ) {
             if (turnAudioRef.current) {
                 turnAudioRef.current.currentTime = 0;
                 turnAudioRef.current.play().catch(error => console.warn("Audio play failed:", error));
             } else if (turnAudioRef.current === null) {
                 try {
                     turnAudioRef.current = new Audio('/notify.wav');
                     turnAudioRef.current.play().catch(error => console.warn("Audio play failed:", error));
                 } catch (e) { console.error("Failed to init/play turn audio", e); }
             }
        }
    }, [gameState?.currentPlayer, prevPlayer, playerRole, gameState?.gameStatus, isMuted]);

    // --- Game End Audio Effect ---
    useEffect(() => {
        const currentStatus = gameState?.gameStatus;
        if (prevGameStateStatus === 'InProgress' && (currentStatus === 'X' || currentStatus === 'O' || currentStatus === 'Draw')) {
            let audioToPlay: HTMLAudioElement | null = null;
            let soundFile = ''; // Store filename for initialization
            let soundRef: React.MutableRefObject<HTMLAudioElement | null> | null = null;

            if (currentStatus === 'X' || currentStatus === 'O') {
                if (playerRole && currentStatus === playerRole) { // Win
                    soundFile = '/win.mp3'; soundRef = winAudioRef;
                } else if (playerRole) { // Lose
                    soundFile = '/lose.wav'; soundRef = loseAudioRef;
                }
            } else if (currentStatus === 'Draw') { // Draw
                soundFile = '/draw.wav'; soundRef = drawAudioRef;
            }

            if (!isMuted && soundRef && soundFile) { // <-- Check if muted and soundRef/File exist
                if (!soundRef.current) { // Initialize if needed
                    try { soundRef.current = new Audio(soundFile); } catch (e) { console.error(`Failed to init ${soundFile}`, e); return; }
                }
                audioToPlay = soundRef.current;

                if (audioToPlay) {
                    audioToPlay.currentTime = 0;
                    audioToPlay.play().catch(error => console.warn(`Audio play failed (${soundFile}):`, error));
                }
            }
        }
    }, [gameState?.gameStatus, prevGameStateStatus, playerRole, isMuted]);

    // --- Track Game Start ---
    useEffect(() => {
        if (gameState && opponentJoined && !prevGameState) { // Track when game state appears *and* opponent is joined
            trackEvent('game/start');
        }
    }, [gameState, opponentJoined, prevGameState]);


    // --- Track Game End ---
    useEffect(() => {
        const currentStatus = gameState?.gameStatus;
        const prevStatus = prevGameState?.gameStatus;

        if (currentStatus && prevStatus === 'InProgress') { // Check if game just finished
            if (currentStatus === 'X' || currentStatus === 'O') {
                const outcome = currentStatus === playerRole ? 'win' : 'loss';
                trackEvent(`game/end/${outcome}`);
            } else if (currentStatus === 'Draw') {
                trackEvent('game/end/draw');
            }
            // Could also track disconnects here if needed, e.g., based on opponentDisconnected flag change
        }
    }, [gameState?.gameStatus, prevGameState?.gameStatus, playerRole]);


    // --- Click Handlers ---
     const handleCellClick = (largeBoardIdx: number, smallBoardIdx: number) => {
         if (!gameState || gameState.gameStatus !== 'InProgress' || playerRole !== gameState.currentPlayer || !opponentJoined) {
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
     // 2. Connection/Server Error State (Relies on toast now, but keep basic connection lost screen)
     if (!isConnected && roomId && !opponentDisconnected) {
          return (
             <div className="flex flex-col items-center justify-center min-h-screen p-4 text-white bg-gradient-to-br from-gray-900 via-indigo-950 to-gray-900">
                 <h1 className="mb-4 text-4xl font-bold">Meticto</h1>
                 <div className="mb-4 text-2xl text-red-500">Error</div>
                 <div className="mb-6 text-xl">{"Connection lost."}</div>
                 <button onClick={handleLeaveClick} className="px-4 py-2 mt-4 bg-gray-600 rounded hover:bg-gray-700">Back to Lobby</button>
             </div>
          );
     }
     // 3. Loading State
     if (!gameState) {
         return (
            <div className="flex flex-col items-center justify-center min-h-screen p-4 text-white bg-gradient-to-br from-gray-900 via-indigo-950 to-gray-900">
                <h1 className="mb-4 text-4xl font-bold">Meticto</h1> 
                <div className="text-2xl text-yellow-400 animate-pulse">Loading game state... {roomName && `("${roomName}")`}</div>
                <button onClick={handleLeaveClick} className="px-4 py-2 mt-6 bg-gray-600 rounded hover:bg-gray-700">Back to Lobby</button>
            </div>
          );
     }


    // --- If gameState IS available, Determine Status Texts ---
     const playerInfoText = playerRole ? `You are Player ${playerRole}` : "Spectating";
     const roomInfoText = roomName ? ` in room "${roomName}"` : "";
     const spectatorInfo = spectatorCount > 0 ? ` (${spectatorCount} watching)` : "";

     // Determine the main status message (Win/Draw/Turn)
     let mainStatusText: string | React.ReactNode = ''; // Can be string or JSX
     let subStatusText: string = ''; // For secondary info like active board
     const isGameOver = gameState && (gameState.gameStatus === 'X' || gameState.gameStatus === 'O' || gameState.gameStatus === 'Draw');
     const isGameReadyToPlay = opponentJoined || playerRole === null;

     if (isGameOver) {
        if (gameState.gameStatus === 'X' || gameState.gameStatus === 'O') {
            mainStatusText = (
                 <>
                    Player {gameState.gameStatus} Wins!
                    {/* Add emoji only if the current client won */}
                    {gameState.gameStatus === playerRole && <span className="ml-2">🎉</span>}
                 </>
            );
            // Sub-status can indicate if you won/lost
            subStatusText = gameState.gameStatus === playerRole ? 'You won!' : (playerRole ? 'You lost.' : '');
        } else if (gameState.gameStatus === 'Draw') {
            mainStatusText = 'Game is a Draw!';
            subStatusText = ''; // No sub-status needed for draw
        }
     } else if (!isGameReadyToPlay && playerRole) {
         mainStatusText = "Waiting for opponent...";
     } else if (gameState) { // Game in progress
        if (!playerRole) { mainStatusText = `Player ${gameState.currentPlayer}'s Turn`; }
        else if (playerRole === gameState.currentPlayer) { mainStatusText = "Your Turn"; }
        else { mainStatusText = `Player ${gameState.currentPlayer}'s Turn`; }
        // Sub-status indicates where to play
        if (gameState.activeBoardIndex !== null) { subStatusText = `Play in Board ${gameState.activeBoardIndex + 1}`; }
        else { subStatusText = `Play anywhere`; }
     }

     // --- Determine Hints ---
     let hintText: string | null = null;
     if (gameState && gameState.gameStatus === 'InProgress' && playerRole === gameState.currentPlayer) {
         const currentActiveBoard = gameState.activeBoardIndex;
         const prevActiveBoard = prevGameState?.activeBoardIndex; // Active board *before* this turn started

         // Hint 1: Play Anywhere (Current state allows it, and it wasn't forced by opponent playing in a finished board)
         if (currentActiveBoard === null) {
             // Check if the *reason* it's null is NOT because the opponent just played in a finished board
             const lastMoveSentToFinishedBoard =
                 prevGameState &&
                 prevGameState.currentPlayer !== playerRole && // Was opponent's turn before
                 prevGameState.activeBoardIndex !== null && // Opponent was sent to a specific board
                 isSmallBoardFinished(gameState.largeBoard[prevGameState.activeBoardIndex].status); // That board is now finished

             if (!lastMoveSentToFinishedBoard) {
                // Show "Play Anywhere" hint, maybe more strongly on the very first turn?
                // Simple version for now:
                hintText = "Hint: You can play in any available cell on any unfinished board.";
             } else {
                 // Hint 3: Opponent played in finished board, now play anywhere
                 hintText = "Hint: Opponent sent you to a finished board. You can play anywhere!";
             }
         }
         // Hint 2: Sent to specific board
         else if (currentActiveBoard !== null) {
             // Optionally check if prevActiveBoard was different to only show on change
             if (prevActiveBoard !== currentActiveBoard) {
                  hintText = `Hint: Opponent's move sends you to Board ${currentActiveBoard + 1}.`;
             }
         }
     }


    // --- Render the Main Game UI ---
    return (
      // Adjust overall padding, especially top padding on small screens
      <div className={`relative flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-gray-900 via-indigo-950 to-gray-900 text-white p-4 pt-12 sm:pt-4`}>

        {/* Leave Room Button - Adjust position slightly if needed */}
         <div className="absolute z-20 top-2 left-2 sm:top-4 sm:left-4">
              <button onClick={handleLeaveClick} className="px-3 py-1 text-xs font-semibold text-white transition duration-150 ease-in-out bg-red-700 rounded shadow-md hover:bg-red-800 sm:text-sm" title="Leave Game Room">Leave</button>
         </div>
         
         {/* --- Mute Button --- */}
        <div className="absolute z-20 top-2 right-2 sm:top-4 sm:right-4">
            <button
                onClick={toggleMute}
                className="p-1.5 text-xl text-gray-300 rounded-full hover:bg-gray-700/50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                aria-label={isMuted ? "Unmute Sounds" : "Mute Sounds"}
                title={isMuted ? "Unmute Sounds" : "Mute Sounds"}
            >
                {isMuted ? '🔇' : '🔊'}
            </button>
        </div>

        {/* --- Main Status Area --- */}
        <div className="mt-4 mb-2 text-center sm:mt-0">
            {/* Main Game Result / Turn Indicator */}
            <h1 className={`font-bold mb-1 ${isGameOver ? 'text-4xl sm:text-5xl text-yellow-300' : 'text-2xl sm:text-3xl'}`}>
                 {mainStatusText}
            </h1>
            {/* Sub Status (Win/Loss/Play Location) */}
            <p className={`text-base sm:text-lg text-gray-300 ${isGameOver ? 'h-6' : 'h-6 mb-1'}`}>
                {subStatusText}
            </p>
        </div>


        {/* Player/Room/Spectator Info Area (Moved below main status) */}
        <div className="h-6 mb-1 text-sm font-semibold text-center text-gray-400 sm:text-base">
            {playerInfoText}{roomInfoText}{spectatorInfo}
        </div>


        {/* Timer Display*/}
        <div className="h-6 mb-2 text-center">
            {displayTimeLeft !== null && currentTimer && (
                <p className={`text-base font-medium ${displayTimeLeft <= 10 ? 'text-red-400 animate-pulse' : 'text-yellow-300'} sm:text-lg`}> {/* Reduced font size */}
                    {currentTimer.player === playerRole ? 'Your Time:' : `Player ${currentTimer.player}'s Time:`}{' '}{displayTimeLeft}s
                </p>
            )}
             {displayTimeLeft === null && gameState?.gameStatus === 'InProgress' && <p className="text-xs text-gray-500 sm:text-sm">(No turn timer)</p>} {/* Reduced font size */}
        </div>

        {/* --- Hint Display Area --- */}
        <div className="h-5 mt-1 mb-1 text-center"> {/* Reserve space for hint */}
            {hintText && (
                <p className="text-xs italic text-yellow-200/80 sm:text-sm animate-pulse">
                    {hintText}
                </p>
            )}
        </div>

        {/* Game Board Area - Adjust container size */}
        <div className="w-[calc(100%-1rem)] max-w-[400px] sm:max-w-lg mt-2">
          <LargeBoard
            largeBoardState={gameState.largeBoard}
            activeBoardIndex={gameState.activeBoardIndex}
            currentPlayer={gameState.currentPlayer}
            myRole={playerRole}
            gameStatus={gameState.gameStatus}
            largeWinningLine={gameState.largeWinningLine} // Pass prop even if not used for styling
            onCellClick={handleCellClick}
          />
        </div>

        {/* Rematch Button */}
        {(isGameOver && playerRole) && ( 
             <div className="mt-4 text-center sm:mt-6">
                 {rematchOffered && !rematchRequested && (<p className="mb-2 text-sm text-yellow-400 animate-pulse sm:text-base">Opponent wants a rematch!</p>)}
                 {rematchRequested && !rematchOffered && (<p className="mb-2 text-sm text-gray-400 sm:text-base">Rematch requested. Waiting for opponent...</p>)}
                
                 <button onClick={handleResetClick} className="px-5 py-2 text-sm font-semibold text-white transition duration-150 ease-in-out bg-indigo-600 rounded-lg shadow-md sm:text-base sm:px-6 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed" aria-label={rematchOffered ? "Accept Rematch" : "Request Rematch"} disabled={rematchRequested}>
                     {rematchOffered ? "Accept Rematch & Play Again" : (rematchRequested ? "Rematch Requested" : "Request Rematch?")}
                 </button>
             </div>
         )}
      </div>
    );
};

export default Game;