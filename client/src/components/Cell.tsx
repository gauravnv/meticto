import React from 'react';
import { CellValue } from '../types';

interface CellProps {
  value: CellValue;
  isDisabled: boolean;
  isWinningCell: boolean;
  onClick: () => void;
}

const Cell: React.FC<CellProps> = ({ value, isDisabled, isWinningCell, onClick }) => {
  let textClass = '';
  if (value === 'X') {
    textClass = 'text-blue-400';
  } else if (value === 'O') {
    textClass = 'text-red-400';
  }

  // Base classes, adjust font size and border
  let cellClasses = `w-full h-full border border-gray-400/50 flex items-center justify-center text-2xl sm:text-4xl font-bold ${textClass} bg-gray-800/60 relative overflow-hidden`; // Reduced base text size

  if (isWinningCell) {
    // Slightly reduce emphasis on smaller screens? Optional.
    cellClasses += ' bg-white/20 sm:bg-white/25 ';
  } else if (!isDisabled) {
    // Keep hover consistent for now
    cellClasses += ' hover:bg-gray-700/70 transition-colors duration-150 ';
  }

  if (isDisabled && !isWinningCell) {
     cellClasses += ' opacity-60 ';
  }

  if (isDisabled) {
    cellClasses += ' cursor-not-allowed ';
  } else {
     cellClasses += ' cursor-pointer ';
  }


  return (
    <button
      className={cellClasses.trim()}
      onClick={onClick}
      disabled={isDisabled}
      aria-label={`Cell ${value ? `contains ${value}` : 'empty'}${isDisabled ? ' disabled' : ''}${isWinningCell ? ' winning' : ''}`}
    >
      <span
        key={value}
        className="transition-opacity duration-200 ease-in"
        style={value ? { transform: 'scale(1)', opacity: 1 } : { transform: 'scale(0.5)', opacity: 0 }}
      >
          {value}
      </span>
    </button>
  );
};

export default Cell;