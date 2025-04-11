# Meticto - Manual End-to-End Test Checklist

**Objective:** To manually verify the core functionality and user experience of the Meticto application across different scenarios.

**Instructions:** Perform these tests ideally with two browsers/incognito windows to simulate two players (plus potentially a third for a spectator). Reset state (clear application data/reload) between major test sections if needed.

---

## 1. Setup & Initial Connection

- [ ] **[P1]** Open the application URL.
- [ ] **[P1]** Verify the "Connecting..." or initial loading state appears briefly.
- [ ] **[P1]** Verify connection succeeds and the Lobby view loads.
- [ ] **[P1]** Verify the "Meticto" neon title is displayed correctly in the Lobby.
- [ ] **[P1]** Verify the "Create New Room" and "Available Games" sections are visible.
- [ ] **[P1]** Verify the timer dropdown has a visible label and defaults to "None".

## 2. Lobby Functionality

- [ ] **[P1]** Verify the "Available Games" list is initially empty (or shows existing rooms if testing persistence).
- [ ] **[P1]** Create a room with the default name and no timer.
  - [ ] Verify P1 is moved to the Game view.
  - [ ] Verify P1 is assigned Role X.
  - [ ] Verify the status shows "Waiting for opponent...".
  - [ ] Verify the room name is displayed (e.g., "Room abcdef").
- [ ] **[P2]** Open the application URL.
  - [ ] Verify P2 sees the room created by P1 in the "Available Games" list.
  - [ ] Verify the room status is "Waiting", and player count is 1/2.
- [ ] **[P1]** Leave the room using the "Leave" button.
  - [ ] Verify P1 returns to the Lobby.
- [ ] **[P2]** Verify the room disappears from the list for P2 after a short delay.
- [ ] **[P1]** Create a room with a custom name (e.g., "Test Room") and a timer (e.g., 30 seconds).
  - [ ] Verify P1 is moved to the Game view and is assigned Role X.
  - [ ] Verify the custom room name "Test Room" is displayed.
- [ ] **[P2]** Join the "Test Room" created by P1.
  - [ ] Verify P2 is moved to the Game view.
  - [ ] Verify P2 is assigned Role O.
  - [ ] Verify both P1 and P2 see the game start (e.g., "Your Turn" for P1, "Player X's Turn" for P2).
  - [ ] Verify the timer display appears for P1's turn.
- [ ] **[P1 & P2]** Leave the room.
- [ ] **[P1]** Create a room.
- [ ] **[P2]** Join the room.
- [ ] **[P1 & P2]** Play until the game finishes (Win/Draw).
- [ ] **[P3]** Open the application URL.
  - [ ] Verify P3 sees the finished game in the list with status "Finished".
  - [ ] Verify P3 can join the finished game as a spectator.
  - [ ] Verify P3 sees the final game state correctly.
  - [ ] Verify P3 sees the correct spectator count (1).
- [ ] **[P1/P2]** Attempt to join an invalid/non-existent room ID (using manual URL manipulation or a simulated event if possible). Verify an error toast appears.
- [ ] **[P3]** Attempt to join a "Waiting" room. Verify the "Join" button works and P3 becomes Player O. (Requires P1 to create and wait.)
- [ ] **[P3]** Attempt to join a "Playing" room. Verify the "Spectate" button works and P3 joins as a spectator.

## 3. Core Gameplay

*(Requires P1 and P2 in an active game)*

- [ ] **[P1]** Verify the turn indicator ("Your Turn", border animation, audio cue) works correctly when it's P1's turn.
- [ ] **[P1]** Verify the "Play anywhere" hint appears on the first turn.
- [ ] **[P1]** Make a valid first move (e.g., top-left cell of top-left board).
  - [ ] Verify the move appears on both P1 and P2's boards.
  - [ ] Verify the turn switches to P2.
  - [ ] Verify the correct small board is highlighted as active for P2 (e.g., top-left board).
  - [ ] Verify P2 sees the "Sent to Board X" hint.
- [ ] **[P2]** Attempt to play in the wrong small board. Verify the move is rejected (no state change, error toast appears).
- [ ] **[P2]** Attempt to play in a cell already taken. Verify the move is rejected (no state change, error toast appears).
- [ ] **[P1]** Attempt to play when it's P2's turn. Verify the move is rejected (no state change, error toast appears).
- [ ] **[P2]** Make a valid move in the required board.
  - [ ] Verify turn switches to P1, and the correct board is highlighted.
- [ ] Play until a small board is won.
  - [ ] Verify the winning line is shown within the small board.
  - [ ] Verify the large 'X' or 'O' overlay appears on the won small board.
  - [ ] Verify the correct player's mark is shown.
- [ ] Play until a small board is drawn.
  - [ ] Verify the draw overlay ("--|--") appears.
- [ ] Force a "Play anywhere" scenario (make a move that sends the opponent to an already finished board).
  - [ ] Verify the active board highlight disappears for the next player.
  - [ ] Verify the "Play anywhere" hint (or "Sent to finished board...") appears for the next player.
- [ ] Play until the large board is won.
  - [ ] Verify the game status correctly shows "Player X/O Wins!".
  - [ ] Verify the "You won!" / "You lost." sub-status is correct.
  - [ ] Verify the rematch button appears for players.
- [ ] Play until the large board is drawn.
  - [ ] Verify the game status correctly shows "Game is a Draw!".
  - [ ] Verify the rematch button appears for players.

## 4. Timers

*(Requires P1 and P2 in a game created with a timer)*

- [ ] Verify the timer countdown displays correctly for the current player.
- [ ] Verify the timer shows the correct player ("Your Time" vs "Player X/O's Time").
- [ ] Verify the timer resets and starts for the next player after a valid move.
- [ ] Let the timer run out for one player (e.g., P1).
  - [ ] Verify the game ends immediately.
  - [ ] Verify the status correctly shows the *other* player (P2) as the winner.
  - [ ] Verify a toast message indicates a win by timeout.
  - [ ] Verify the timer display disappears.
- [ ] Start a new timed game. Make moves quickly and verify the timer clears correctly on each move.

## 5. Rematch

*(Requires P1 and P2 in a finished game)*

- [ ] **[P1]** Click "Request Rematch?".
  - [ ] Verify P1's button changes to "Rematch Requested" and becomes disabled.
  - [ ] Verify P1 sees "Rematch requested. Waiting..." text.
- [ ] **[P2]** Verify P2 sees "Opponent wants a rematch!" text.
- [ ] **[P2]** Verify P2's button shows "Accept Rematch & Play Again".
- [ ] **[P2]** Click "Accept Rematch & Play Again".
  - [ ] Verify the game board resets.
  - [ ] Verify roles are swapped (P1 is now O, P2 is now X).
  - [ ] Verify the game starts immediately with the new Player X's turn.
  - [ ] Verify timers (if applicable) restart correctly for the new Player X.
- [ ] Play another game to completion.
- [ ] **[P1]** Request rematch.
- [ ] **[P2]** Leave the room instead of accepting.
  - [ ] Verify P2 returns to the Lobby.
  - [ ] Verify P1 is notified that the opponent left (via an "Opponent Disconnected" screen or toast) and is returned to the Lobby or the game ends cleanly.

## 6. Spectators

*(Requires P1, P2 playing; P3 spectating)*

- [ ] **[P3]** Verify spectator sees game state updates in real time as P1/P2 play.
- [ ] **[P3]** Verify spectator sees the correct player's turn indicated.
- [ ] **[P3]** Verify spectator sees timer countdowns correctly (if applicable).
- [ ] **[P3]** Verify spectator count updates correctly for P1/P2 when P3 joins/leaves.
- [ ] **[P3]** Leave the room using the "Leave" button and verify spectator count updates for P1/P2.
- [ ] **[P1/P2]** If one player leaves while P3 is spectating:
  - [ ] Verify P3 sees a "Game Ended" or "Player Disconnected" message/toast.
  - [ ] Verify P3 is handled appropriately (e.g., remains on a final screen with a "Back to Lobby" button, or is automatically returned to the Lobby).

## 7. Disconnects

- [ ] **[P1, P2]** Start a game.
- [ ] **[P2]** Close P2's browser tab/window abruptly.
- [ ] **[P1]** Verify P1 sees the "Opponent Disconnected" screen within a reasonable time.
- [ ] **[P1]** Verify P1 can return to the Lobby.
- [ ] **[P1, P2]** Start a game.
- [ ] **[P1]** Close P1's browser tab/window abruptly.
- [ ] **[P2]** Verify P2 sees the "Opponent Disconnected" screen.
- [ ] **[P3]** Join a game as a spectator.
- [ ] **[P3]** Close P3's browser tab/window abruptly.
- [ ] **[P1, P2]** Verify spectator count updates correctly for P1/P2 and that the game continues normally.

## 8. UI/UX Polish & Responsiveness

- [ ] Verify turn border animation plays correctly and promptly for the current player.
- [ ] Verify turn audio cue plays correctly when it becomes the player's turn.
- [ ] Verify error messages (for invalid moves, connection issues, timeouts) appear as toasts.
- [ ] Verify hints display correctly under the intended conditions.
- [ ] **[Responsiveness]** Test the Lobby on various screen sizes (mobile, tablet, desktop) and verify layout adjusts, elements are usable, and text wraps correctly.
- [ ] **[Responsiveness]** Test the Game view on various screen sizes and verify the board scales, text remains readable, and buttons are usable.
