export type Player = 'X' | 'O';

export type CellValue = Player | null;

export type SmallBoardState = CellValue[];

export type SmallBoardStatus = 'InProgress' | Player | 'Draw';

export type GameStatus = 'InProgress' | Player | 'Draw';

export interface GameState {
  largeBoard: LargeBoardCellState[];
  currentPlayer: Player;
  activeBoardIndex: number | null;
  gameStatus: GameStatus;
  largeWinningLine: number[] | null;
}

export function isSmallBoardFinished(status: SmallBoardStatus): boolean {
  return status === 'X' || status === 'O' || status === 'Draw';
}

export interface LargeBoardCellState {
  status: SmallBoardStatus;
  cells: SmallBoardState;
  winningLine: number[] | null;
}