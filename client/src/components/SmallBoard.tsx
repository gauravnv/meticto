import React from 'react';
import Cell from './Cell';
import { LargeBoardCellState, GameStatus, isSmallBoardFinished } from '../../../server/src/types';

interface SmallBoardProps {
  boardIndex: number;
  boardState: LargeBoardCellState;
  activeBoardIndex: number | null;
  gameStatus: GameStatus;
  onCellClick: (largeBoardIdx: number, smallBoardIdx: number) => void;
}

const SmallBoard: React.FC<SmallBoardProps> = ({
  boardIndex,
  boardState,
  activeBoardIndex,
  gameStatus,
  onCellClick,
}) => {
  const { status, cells, winningLine } = boardState;
  let boardClasses = "grid grid-cols-3 grid-rows-3 gap-[1px] sm:gap-0.5 ";
  let overlayText = '';
  let overlayTextSize = 'text-5xl sm:text-6xl';

  // Determine if this specific board CAN be played in based on current rules
  const isPlayableNow =
    gameStatus === 'InProgress' && // Game must be ongoing
    !isSmallBoardFinished(status) && // This board must not be finished
    (activeBoardIndex === null || activeBoardIndex === boardIndex); // EITHER play anywhere OR this is the required board

    // Adjust border width for finished/active states
  const borderClass = 'border-2 sm:border-4';

  if (status === 'X' || status === 'O') {
    boardClasses += ` relative ${borderClass} `; 
    if (status === 'X') {
      boardClasses += " bg-gradient-to-br from-blue-800 via-blue-950 to-blue-800/80 border-blue-500";
      overlayText = 'X';
    } else {
      boardClasses += " bg-gradient-to-br from-red-800 via-red-950 to-red-800/80 border-red-500";
      overlayText = 'O';
    }
  } else if (status === 'Draw') {
    boardClasses += ` bg-gray-800/90 ${borderClass} border-gray-600`;
    overlayText = '--|--';
    overlayTextSize = 'text-3xl sm:text-4xl';
  } else {
    // --- Styling for IN-PROGRESS boards ---
    if (isPlayableNow) {
        // Use responsive border for active state
        boardClasses += ` ${borderClass} border-yellow-400 animate-pulse `;
        if (activeBoardIndex === boardIndex) {
            boardClasses += " bg-yellow-300/20 ";
        } else { // Play anywhere highlight
            boardClasses += " bg-yellow-300/10 ";
        }
    }
    // Otherwise, it's just an inactive, in-progress board
    else {
       // Thinner border for inactive boards
       boardClasses += " bg-gray-600/50 border sm:border-2 border-gray-500 ";
    }
  }

  const handleCellClickInternal = (cellIndex: number) => {
    onCellClick(boardIndex, cellIndex);
  };

  return (
    <div className={`${boardClasses.trim()} aspect-square relative`}>
      {/* Render Overlay Text if board is finished */}
      {isSmallBoardFinished(status) && overlayText && (
        <div className={`absolute inset-0 flex items-center justify-center font-extrabold ${overlayTextSize} ${status === 'X' ? 'text-blue-400' : status === 'O' ? 'text-red-400' : 'text-gray-400'} opacity-80 pointer-events-none`}>
          {overlayText}
        </div>
      )}

      {/* Render Cells */}
      {cells.map((cellValue, cellIndex) => {
        const isCellDisabled =
          cellValue !== null ||
          isSmallBoardFinished(status) ||
          gameStatus !== 'InProgress' ||
          !isPlayableNow;

        const isWinningCell = winningLine?.includes(cellIndex) ?? false;

        return (
          <Cell
            key={cellIndex}
            value={cellValue}
            isDisabled={isCellDisabled}
            isWinningCell={isWinningCell}
            onClick={() => handleCellClickInternal(cellIndex)}
          />
        );
      })}
    </div>
  );
};

export default SmallBoard;