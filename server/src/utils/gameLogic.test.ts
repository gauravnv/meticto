import { describe, it, expect } from 'vitest';
import { checkWinner } from './gameLogic';
import { CellValue, Player } from '../types';

describe('checkWinner', () => {
  it('should return null winner for empty board', () => {
    const board: CellValue[] = Array(9).fill(null);
    const result = checkWinner(board);
    expect(result.winner).toBeNull();
    expect(result.isDraw).toBe(false);
    expect(result.winningLine).toBeNull();
  });

  it('should detect row win for X', () => {
    const board: CellValue[] = ['X', 'X', 'X', null, 'O', null, 'O', null, null];
    const result = checkWinner(board);
    expect(result.winner).toBe('X');
    expect(result.isDraw).toBe(false);
    expect(result.winningLine).toEqual([0, 1, 2]);
  });

   it('should detect column win for O', () => {
    const board: CellValue[] = ['X', 'O', 'X', null, 'O', null, 'X', 'O', null];
    const result = checkWinner(board);
    expect(result.winner).toBe('O');
    expect(result.isDraw).toBe(false);
    expect(result.winningLine).toEqual([1, 4, 7]);
  });

   it('should detect diagonal win', () => {
     const board: CellValue[] = ['X', 'O', 'O', null, 'X', null, 'O', null, 'X'];
     const result = checkWinner(board);
     expect(result.winner).toBe('X');
     expect(result.isDraw).toBe(false);
     expect(result.winningLine).toEqual([0, 4, 8]);
   });

  it('should detect a draw', () => {
    const board: CellValue[] = ['X', 'O', 'X', 'O', 'X', 'O', 'O', 'X', 'O'];
    const result = checkWinner(board);
    expect(result.winner).toBeNull();
    expect(result.isDraw).toBe(true);
    expect(result.winningLine).toBeNull();
  });
});