import React from 'react';
import SmallBoard from './SmallBoard';
import { LargeBoardCellState, GameStatus } from '../types';

interface LargeBoardProps {
  largeBoardState: LargeBoardCellState[];
  activeBoardIndex: number | null;
  gameStatus: GameStatus;
  largeWinningLine: number[] | null;
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
    <div className="grid grid-cols-3 grid-rows-3 gap-2 p-2 bg-gray-800 rounded-lg border-4 border-gray-700">
      {largeBoardState.map((boardState, index) => {
        const isWinningBoard = largeWinningLine?.includes(index) ?? false;
        let boardWrapperClasses = 'relative transition-all duration-300 ease-out';

        // Apply winning board elevation/glow
        if (isWinningBoard) {
          boardWrapperClasses += ' transform scale-105 drop-shadow-[0_0_12px_rgba(250,204,21,0.6)] z-10';
        }

        // Apply grayscale effect if the *overall* game is a draw
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
              gameStatus={gameStatus} // Make sure gameStatus is still passed
              onCellClick={onCellClick}
            />
          </div>
        );
      })}
    </div>
  );
};

export default LargeBoard;