// Applying changes for: client/src/components/LargeBoard.tsx
import React, { useRef, useEffect } from 'react';
import SmallBoard from './SmallBoard';
import {
    LargeBoardCellState,
    Player,
    GameStatus
} from '../../../server/src/types'; // Ensure path is correct

// Helper hook to get previous value
function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T | undefined>(undefined);
  // This effect runs *after* the render, so ref.current holds the value from the *previous* render
  useEffect(() => {
    ref.current = value;
  });
  return ref.current;
}

interface LargeBoardProps {
    largeBoardState: LargeBoardCellState[];
    activeBoardIndex: number | null;
    currentPlayer: Player; // Current player whose turn it is
    myRole: Player | null; // Role of the client viewing this board
    gameStatus: GameStatus;
    largeWinningLine: number[] | null;
    onCellClick: (largeBoardIdx: number, smallBoardIdx: number) => void;
}

const LargeBoard: React.FC<LargeBoardProps> = ({
    largeBoardState,
    activeBoardIndex,
    currentPlayer,
    myRole,
    gameStatus,
    largeWinningLine,
    onCellClick,
}) => {
    const rectRef = useRef<SVGRectElement>(null);
    const animationRef = useRef<Animation | null>(null);
    // Get the currentPlayer from the *previous* render cycle
    const prevPlayer = usePrevious(currentPlayer);

    // Effect to trigger the animation imperatively
    useEffect(() => {
        const rectElement = rectRef.current;
        if (!rectElement) return; // Exit if ref not available yet

        // Log state *at the time the effect runs*
        console.log(`LargeBoard Effect Run: Prev=${prevPlayer}, Curr=${currentPlayer}, Role=${myRole}, Status=${gameStatus}`);

        // --- Trigger Condition ---
        // Check if the game is running, a previous player value exists,
        // the player actually changed, and the *new* current player is this client.
        const shouldAnimate =
            gameStatus === 'InProgress' &&
            prevPlayer !== undefined && // Ensure we have a previous value to compare against
            prevPlayer !== currentPlayer && // Ensure the player actually changed
            currentPlayer === myRole; // Ensure it's now this client's turn

        // --- Animation Handling ---
        // Always try to cancel any existing animation *before* deciding whether to start a new one.
        // This simplifies logic and prevents race conditions.
        if (animationRef.current) {
            console.log("LargeBoard: Cancelling previous animation (if any).");
            animationRef.current.cancel(); // Stop and clear effects
            animationRef.current = null; // Clear the ref immediately after cancelling
        }

        // --- Start Animation (if conditions met) ---
        if (shouldAnimate) {
            console.log(`LargeBoard: Triggering animation for ${currentPlayer}.`);

            // --- Reset Element State ---
            // Explicitly set initial animation styles before starting
            rectElement.style.strokeDashoffset = '2000';
            rectElement.style.opacity = '1'; // Start visible

            // --- Define Animation ---
            const drawDuration = 1500;
            const fadeDuration = 500;
            const keyframes: Keyframe[] = [
                { strokeDashoffset: 2000, opacity: 1, offset: 0 }, // Start draw
                { strokeDashoffset: 0, opacity: 1, offset: drawDuration / (drawDuration + fadeDuration) }, // End draw / Start fade delay
                { strokeDashoffset: 0, opacity: 0, offset: 1 } // End fade
            ];
            const timing: KeyframeAnimationOptions = {
                duration: drawDuration + fadeDuration,
                easing: 'ease-in-out',
                fill: 'forwards' // Keep final state (opacity 0)
            };

            // --- Start Animation ---
            try {
                const animation = rectElement.animate(keyframes, timing);
                animationRef.current = animation; // Store the new animation object
                console.log("LargeBoard: Animation started.");

                // Set up handlers for when the animation finishes or is cancelled
                animation.onfinish = () => {
                    console.log("LargeBoard: Animation finished naturally.");
                    // Ensure opacity is 0, although fill: forwards should handle this
                    rectElement.style.opacity = '0';
                    // Clear the ref if this specific animation finished
                    if (animationRef.current === animation) {
                        animationRef.current = null;
                    }
                };
                animation.oncancel = () => {
                     console.log("LargeBoard: Animation cancelled.");
                     // Ensure element is hidden if cancelled
                     rectElement.style.opacity = '0';
                     // Clear the ref if this specific animation was cancelled
                     if (animationRef.current === animation) {
                        animationRef.current = null;
                     }
                };

            } catch (error) {
                console.error("LargeBoard: Failed to start animation:", error);
                rectElement.style.opacity = '0'; // Ensure hidden on error
                animationRef.current = null; // Clear ref on error
            }
        } else {
            // If we are not starting a new animation, ensure the element is hidden.
            // This handles the initial state and cases where the turn changes away.
            // Since any running animation was cancelled above, we can safely set opacity.
             console.log("LargeBoard: Condition not met for animation, ensuring rect is hidden.");
             rectElement.style.opacity = '0';
        }

        // --- Cleanup Function ---
        // Return a cleanup function that cancels the *specific animation started by this effect instance*
        // This is crucial if the component unmounts or dependencies change *while* an animation is running.
        return () => {
            // Get the animation object that was potentially stored by *this run* of the effect
            const animationToCancel = animationRef.current;
            if (animationToCancel && animationToCancel.playState === 'running') {
                console.log("LargeBoard Effect Cleanup: Cancelling animation on unmount/re-run.");
                animationToCancel.cancel();
                // The oncancel handler should clear animationRef.current
            }
        };

    // Effect dependencies: Run whenever the logical inputs change.
    }, [currentPlayer, myRole, gameStatus]); // Removed prevPlayer from deps


    // Determine color based on the player whose turn it *currently* is
    const neonColor = currentPlayer === 'X' ? '#60a5fa' : '#f87171';
    const filterId = `neon-glow-${currentPlayer}`;

    return (
        // Relative container
        <div className="relative">
            {/* SVG Overlay - Always rendered */}
            <svg
                className="absolute -inset-0.5 w-[calc(100%+4px)] h-[calc(100%+4px)] overflow-visible pointer-events-none"
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
            >
                {/* Defs */}
                <defs>
                    <filter id={filterId} x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur stdDeviation="2.5" result="coloredBlur" />
                        <feMerge>
                            <feMergeNode in="coloredBlur" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                </defs>
                {/* Border Rect - Animation controlled by JS */}
                <rect
                    ref={rectRef}
                    x="1" y="1"
                    width="98" height="98"
                    rx="4"
                    fill="none"
                    stroke={neonColor}
                    strokeWidth="1.5"
                    filter={`url(#${filterId})`}
                    strokeDashoffset="2000"
                    strokeDasharray="2000"
                    style={{ opacity: 0 }} // Start hidden via inline style
                />
            </svg>

            {/* Original Grid Container */}
            <div className={`grid grid-cols-3 grid-rows-3 gap-2 p-2 bg-gray-800 rounded-lg border-4 border-gray-700`}>
                {/* ... mapping logic ... */}
                 {largeBoardState.map((boardState, index) => {
                     const isWinningBoard = largeWinningLine?.includes(index) ?? false;
                     let boardWrapperClasses = 'relative transition-all duration-300 ease-out';
                     if (isWinningBoard) {
                         boardWrapperClasses += ' transform scale-105 drop-shadow-[0_0_12px_rgba(250,204,21,0.6)] z-10';
                     }
                     if (gameStatus === 'Draw') {
                         boardWrapperClasses += ' filter grayscale brightness-75 ';
                     }
                     return (
                         <div key={index} className={boardWrapperClasses.trim()}>
                             <SmallBoard
                                 boardIndex={index}
                                 boardState={boardState}
                                 activeBoardIndex={activeBoardIndex}
                                 gameStatus={gameStatus}
                                 onCellClick={onCellClick}
                             />
                         </div>
                     );
                })}
            </div>
        </div>
    );
};

export default LargeBoard;