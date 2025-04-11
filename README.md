# Meticto ✨

Meticto is a web-based online multiplayer version of the classic strategy game Meta Tic-Tac-Toe (also known as Ultimate Tic-Tac-Toe). Challenge your friends or watch ongoing matches!

<!-- Add a key screenshot or GIF here showing gameplay -->
<!-- Suggested Screenshot: Gameplay View (Mid-Game) -->
![Meticto Gameplay](docs/images/gameplay.gif?raw=true)

## Features

* **Real-time Online Multiplayer:** Play against others live using WebSockets.
* **Room Management:**
  * Create public or named rooms.
  * See a list of available rooms (Waiting, Playing, Finished).
  * Join waiting rooms to play.
* **Spectator Mode:** Join ongoing or finished games to watch.
* **Optional Turn Timers:** Choose turn durations (15s, 30s, 60s, or None) when creating a room.
* **Rematch Functionality:** Players can agree to an immediate rematch with swapped roles after a game ends.
* **Visual & Audio Cues:** Includes turn change animations and sound effects.
* **Basic Onboarding Hints:** Provides guidance for new players on game rules.
* **Responsive Design:** Playable on various screen sizes.

## Screenshots

![Meticto Mid Game](docs/images/mid-game.png?raw=true)

**Lobby View:** Shows room creation options and the list of available games.
![Meticto Lobby](docs/images/lobby.png?raw=true)

**Game End / Rematch:** Shows the game board after a win/loss/draw and the rematch prompt.
![Meticto Draw](docs/images/win.png?raw=true)
![Meticto Draw](docs/images/draw.png?raw=true)

## Technology Stack

* **Frontend (Client):**
  * React 19
  * TypeScript
  * Vite
  * Tailwind CSS
  * Socket.IO Client
  * React Hot Toast (for notifications)
* **Backend (Server):**
  * Node.js
  * Express (via Socket.IO adapter, could be removed if only WS needed)
  * TypeScript
  * Socket.IO
* **Monorepo Management:** npm workspaces (implicitly via `--prefix` scripts)

## Architecture

Meticto uses a standard client-server architecture with a server-authoritative game state. Communication happens in real-time via WebSockets (Socket.IO).

* **Client:** Emits user actions (create room, join, move, etc.) to the server. Renders the UI based on state received from the server via the `SocketContext`.
* **Server:** Listens for client events, validates actions using the `GameManager`, updates the in-memory game state, and broadcasts updates back to the relevant clients/rooms.

For a visual representation, see the [Architecture Diagram](docs/architecture.md).

## Getting Started

Follow these instructions to set up and run the project locally for development.

**Prerequisites:**

* Node.js (v18 or later recommended)
* npm (usually comes with Node.js)

**Installation & Setup:**

1. **Clone the repository:**

    ```bash
    git clone https://github.com/gauravnv/meticto.git
    cd meticto
    ```

2. **Install root dependencies:**

    ```bash
    npm install
    ```

3. **Install client and server dependencies:**

    ```bash
    npm run install:all
    # Or individually:
    # npm run install:client
    # npm run install:server
    ```

4. **Set up Environment Variables:**
    * Create a `.env` file in the `server/` directory. You can copy `server/.env.example` if it exists, or create it manually. Key variables:
        * `PORT`: The port the server will run on (e.g., `3001`).
        * `CLIENT_URL`: The URL of the running client for CORS (e.g., `http://localhost:5173`).
    * Create a `.env` file in the `client/` directory. You can copy `client/.env.example` if it exists, or create it manually. Key variables:
        * `VITE_SERVER_URL`: The URL of the running backend server (e.g., `http://localhost:3001`).

**Running Locally:**

1. **Start both client and server concurrently:**

    ```bash
    npm run dev
    ```

    This command runs the `dev` scripts defined in the root `package.json`, which in turn run the development servers for both the client (Vite) and the server (ts-node-dev).

2. **Access the application:**
    Open your browser and navigate to `http://localhost:5173`

## Deployment

This application is deployed on Render:

* **Frontend (Live):** [https://meticto.onrender.com/](https://meticto.onrender.com/)
* **Backend:** Hosted on Render (no direct user access URL)

The server is configured to accept connections from the deployed frontend URL via CORS settings managed through environment variables.

## License

MIT License

Copyright (c) 2025 Gaurav Vasudev
