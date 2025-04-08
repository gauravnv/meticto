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
  let boardClasses = "grid grid-cols-3 grid-rows-3 gap-0.5 ";
  let overlayText = '';

  // Determine if this specific board CAN be played in based on current rules
  const isPlayableNow =
    gameStatus === 'InProgress' && // Game must be ongoing
    !isSmallBoardFinished(status) && // This board must not be finished
    (activeBoardIndex === null || activeBoardIndex === boardIndex); // EITHER play anywhere OR this is the required board

  if (status === 'X' || status === 'O') {
    // Styling for WON boards (gradients)
    boardClasses += " relative border-4 ";
    if (status === 'X') {
      boardClasses += " bg-gradient-to-br from-blue-800 via-blue-950 to-blue-800/80 border-blue-500";
      overlayText = 'X';
    } else {
      boardClasses += " bg-gradient-to-br from-red-800 via-red-950 to-red-800/80 border-red-500";
      overlayText = 'O';
    }
  } else if (status === 'Draw') {
    // Styling for DRAWN boards
    boardClasses += " bg-gray-800/90 border-4 border-gray-600";
    overlayText = '--|--';
  } else {
    // --- Styling for IN-PROGRESS boards ---
    // Check if the board is playable right now
    if (isPlayableNow) {
        boardClasses += " border-4 border-yellow-400 animate-pulse ";
        if (activeBoardIndex === boardIndex) {
            boardClasses += " bg-yellow-300/20 ";
        } else {
            boardClasses += " bg-yellow-300/10 ";
        }
    }
    // Otherwise, it's just an inactive, in-progress board
    else {
       boardClasses += " bg-gray-600/50 border-2 border-gray-500 ";
    }
  }

  // Internal click handler to pass boardIndex along with cellIndex
  const handleCellClickInternal = (cellIndex: number) => {
    onCellClick(boardIndex, cellIndex);
  };

  return (
    // Apply calculated classes, ensure square aspect ratio, relative positioning for overlay
    <div className={`${boardClasses.trim()} aspect-square relative`}>
      {isSmallBoardFinished(status) && overlayText && (
        <div className={`absolute inset-0 flex items-center justify-center text-6xl font-extrabold ${status === 'X' ? 'text-blue-400' : status === 'O' ? 'text-red-400' : 'text-gray-400'} opacity-80 pointer-events-none`}>
          {overlayText}
        </div>
      )}

      {/* Render Cells - Need to update isCellDisabled logic slightly */}
      {cells.map((cellValue, cellIndex) => {
        const isCellDisabled =
          cellValue !== null ||
          isSmallBoardFinished(status) ||
          gameStatus !== 'InProgress' ||
          !isPlayableNow; // Cell is disabled if the board itself isn't playable now

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