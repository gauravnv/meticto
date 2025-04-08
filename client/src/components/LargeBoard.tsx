import React from 'react';
import SmallBoard from './SmallBoard';
import {
    LargeBoardCellState,
    Player,
    GameStatus
} from '../../../server/src/types';

interface LargeBoardProps {
    largeBoardState: LargeBoardCellState[];
    activeBoardIndex: number | null;
    currentPlayer: Player; // Whose turn is it currently
    myRole: Player | null; // What role does this client have ('X', 'O', or null)?
    gameStatus: GameStatus;
    largeWinningLine: number[] | null; // Indices of winning small boards
    onCellClick: (largeBoardIdx: number, smallBoardIdx: number) => void;
}

const LargeBoard: React.FC<LargeBoardProps> = ({
    largeBoardState,
    activeBoardIndex,
    gameStatus,
    largeWinningLine,
    onCellClick,
}) => {
    return (
        // Main grid container for the 9 small boards
        <div className="grid grid-cols-3 grid-rows-3 gap-2 p-2 bg-gray-800 rounded-lg border-4 border-gray-700">
            {largeBoardState.map((boardState, index) => {
                // Check if this small board is part of the large winning line
                const isWinningBoard = largeWinningLine?.includes(index) ?? false;
                // Base classes for the wrapper div around each small board
                let boardWrapperClasses = 'relative transition-all duration-300 ease-out';

                // Apply winning board elevation/glow effect
                if (isWinningBoard) {
                    boardWrapperClasses += ' transform scale-105 drop-shadow-[0_0_12px_rgba(250,204,21,0.6)] z-10';
                }

                // Apply grayscale effect if the overall game is a draw
                if (gameStatus === 'Draw') {
                    boardWrapperClasses += ' filter grayscale brightness-75 ';
                }

                return (
                    // Apply combined classes to the wrapper div
                    <div key={index} className={boardWrapperClasses.trim()}>
                        <SmallBoard
                            boardIndex={index}
                            boardState={boardState}
                            activeBoardIndex={activeBoardIndex}
                            // Pass gameStatus down to SmallBoard for its internal logic
                            gameStatus={gameStatus}
                            // currentPlayer is NOT directly needed by SmallBoard currently
                            // myRole is also NOT directly needed by SmallBoard currently
                            // SmallBoard determines playability based on activeBoardIndex and its own status
                            onCellClick={onCellClick}
                        />
                    </div>
                );
            })}
        </div>
    );
};

export default LargeBoard;