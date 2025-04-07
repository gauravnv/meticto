import React, { useState, useEffect } from 'react';
import LargeBoard from './LargeBoard';
import {
  GameState,
  LargeBoardCellState,
  SmallBoardState,
  isSmallBoardFinished
} from '../types';
import { checkWinner } from '../utils/gameLogic';

const createEmptySmallBoard = (): SmallBoardState => Array(9).fill(null);

const createInitialLargeBoardCell = (): LargeBoardCellState => ({
  status: 'InProgress',
  cells: createEmptySmallBoard(),
  winningLine: null,
});

const initialGameState: GameState = {
  largeBoard: Array(9).fill(null).map(createInitialLargeBoardCell),
  currentPlayer: 'X', // X always starts
  activeBoardIndex: null, // First move can be anywhere
  gameStatus: 'InProgress',
  largeWinningLine: null,
};


const Game: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(initialGameState);
  const [isAnimatingTurn, setIsAnimatingTurn] = useState(false);

  useEffect(() => {
    // Don't animate on initial load or if game is over
    if (gameState.gameStatus !== 'InProgress') {
        setIsAnimatingTurn(false);
        return;
    }

    // Trigger animation (skip initial render where player might be default 'X')
    setIsAnimatingTurn(true);
    const timer = setTimeout(() => {
      setIsAnimatingTurn(false);
    }, 600);

    // Cleanup timeout if component unmounts or player changes again quickly
    return () => clearTimeout(timer);

  }, [gameState.currentPlayer, gameState.gameStatus]); // Run when player or game status changes

  const handleCellClick = (largeBoardIdx: number, smallBoardIdx: number) => {
    // --- Step 1: Get Current State & Basic Validation ---
    const currentLargeBoardCell = gameState.largeBoard[largeBoardIdx];
    const currentSmallBoardCells = currentLargeBoardCell.cells;

    // Ignore clicks if:
    if (gameState.gameStatus !== 'InProgress') return; // 1. Game is already won/drawn
    if (gameState.activeBoardIndex !== null && gameState.activeBoardIndex !== largeBoardIdx) return; // 2. Not the required board
    if (isSmallBoardFinished(currentLargeBoardCell.status)) return; // 3. Small board already won/drawn
    if (currentSmallBoardCells[smallBoardIdx] !== null) return; // 4. Cell already filled

    // --- Step 2: Create Next State (Deep Copy) ---
    const nextState: GameState = structuredClone(gameState);
    const nextLargeBoardCell = nextState.largeBoard[largeBoardIdx];

    // --- Step 3: Update Clicked Cell ---
    nextLargeBoardCell.cells[smallBoardIdx] = gameState.currentPlayer;

    // --- Step 4: Check Small Board Win/Draw ---
    // Call the imported checkWinner function
    const smallBoardResult = checkWinner(nextLargeBoardCell.cells);
    let smallBoardFinished = false;
    if (smallBoardResult.winner) {
      nextLargeBoardCell.status = smallBoardResult.winner;
      nextLargeBoardCell.winningLine = smallBoardResult.winningLine;
      smallBoardFinished = true;
    } else if (smallBoardResult.isDraw) {
      nextLargeBoardCell.status = 'Draw';
      nextLargeBoardCell.winningLine = null;
      smallBoardFinished = true;
    } else {
       nextLargeBoardCell.winningLine = null; // Ensure line is clear if board becomes in progress again
    }

    // --- Step 5: Check Large Board Win/Draw (if small board just finished) ---
    if (smallBoardFinished) {
      const largeBoardStatuses = nextState.largeBoard.map(cell => cell.status);
       // Call the imported checkWinner function again
      const largeBoardResult = checkWinner(largeBoardStatuses);

      if (largeBoardResult.winner) {
        nextState.gameStatus = largeBoardResult.winner;
        nextState.largeWinningLine = largeBoardResult.winningLine; // Store the large winning line
        nextState.activeBoardIndex = null; // Game over
      } else if (largeBoardResult.isDraw) {
        nextState.gameStatus = 'Draw';
        nextState.largeWinningLine = null; // Ensure no winning line on draw
        nextState.activeBoardIndex = null; // Game over
      } else {
        nextState.largeWinningLine = null; // Clear if game continues
      }
    }
    // Ensure largeWinningLine is null if game is still in progress after checking
    if (nextState.gameStatus === 'InProgress') {
        nextState.largeWinningLine = null;
    }


    // --- Step 6: Determine Next Active Board & Switch Player (if game still in progress) ---
    if (nextState.gameStatus === 'InProgress') {
      const nextActiveBoardIdx = smallBoardIdx;
      const nextSmallBoardStatus = nextState.largeBoard[nextActiveBoardIdx].status;

      if (isSmallBoardFinished(nextSmallBoardStatus)) {
        nextState.activeBoardIndex = null; // Play anywhere
      } else {
        nextState.activeBoardIndex = nextActiveBoardIdx;
      }

      nextState.currentPlayer = gameState.currentPlayer === 'X' ? 'O' : 'X';
    }

    // --- Step 7: Update State ---
    setGameState(nextState);
  };

  // Determine the status text to display
  let statusText: string;
  if (gameState.gameStatus === 'X' || gameState.gameStatus === 'O') {
    statusText = `Player ${gameState.gameStatus} Wins!`;
  } else if (gameState.gameStatus === 'Draw') {
    statusText = 'Game is a Draw!';
  } else {
    statusText = `Player ${gameState.currentPlayer}'s Turn`;
    if (gameState.activeBoardIndex !== null) {
      statusText += ` - Play in Board ${gameState.activeBoardIndex + 1}`; // Commit heresy to please the normies
    } else {
        statusText += ` - Play anywhere`;
    }
  }

  return (
    <div className={`flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-gray-900 via-indigo-950 to-gray-900 text-white p-4 ${isAnimatingTurn ? 'animate-turn-pulse' : ''}`}>
      <h1 className="text-4xl font-bold mb-4">Meta Tic-Tac-Toe</h1>
      <div className="text-2xl mb-4 h-8">{statusText}</div>
      <div className="mt-4 w-full max-w-lg">
        <LargeBoard
          largeBoardState={gameState.largeBoard}
          activeBoardIndex={gameState.activeBoardIndex}
          gameStatus={gameState.gameStatus}
          largeWinningLine={gameState.largeWinningLine}
          onCellClick={handleCellClick}
        />
      </div>

      {/* Reset button */}
      <button
        onClick={() => setGameState(initialGameState)}
        className="mt-6 px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg shadow-md transition duration-150 ease-in-out"
        aria-label="Reset Game"
      >
          Reset Game
      </button>

    </div>
  );
};

export default Game;