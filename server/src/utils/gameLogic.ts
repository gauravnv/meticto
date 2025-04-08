import { CellValue, Player, SmallBoardStatus } from '../types';

export const checkWinner = <T extends CellValue | SmallBoardStatus>(
  board: T[] // Accepts CellValue[] or SmallBoardStatus[]
): { winner: Player | null; isDraw: boolean; winningLine: number[] | null } => {
  const lines = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // Columns
    [0, 4, 8], [2, 4, 6], // Diagonals
  ];

  for (let i = 0; i < lines.length; i++) {
    const [a, b, c] = lines[i];
    if (board[a] && board[a] !== 'InProgress' && board[a] !== 'Draw' && board[a] === board[b] && board[a] === board[c]) {
       if (board[a] === 'X' || board[a] === 'O') {
         return { winner: board[a] as Player, isDraw: false, winningLine: lines[i] };
      }
    }
  }

  const isBoardFull = board.every(cellOrStatus => cellOrStatus !== null && cellOrStatus !== 'InProgress');
  if (isBoardFull) {
    return { winner: null, isDraw: true, winningLine: null }; // Draw
  }

  return { winner: null, isDraw: false, winningLine: null }; // No winner, not a draw yet
};
