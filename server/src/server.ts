import express from 'express';
import http from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import cors from 'cors';
import { GameManager } from './gameManager';

// --- Server Setup ---
const app = express();
const server = http.createServer(app);
const allowedOrigins = [ process.env.CLIENT_URL || 'http://localhost:5173',];

if (process.env.RENDER_CLIENT_URL) {
    allowedOrigins.push(process.env.RENDER_CLIENT_URL);
}

const corsOptions: cors.CorsOptions = {
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.indexOf(origin) !== -1) { callback(null, true); }
        else { callback(new Error('Not allowed by CORS')); }
    },
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE", credentials: true,
};
app.use(cors(corsOptions));
const io = new SocketIOServer(server, { cors: corsOptions });
const PORT = process.env.PORT || 3001;
app.get('/', (req, res) => { res.send('Meta Tic-Tac-Toe Server Running!'); });

// --- Instantiate GameManager ---
const gameManager = new GameManager(io);

// --- Socket.IO Connection Handling ---
io.on('connection', (socket: Socket) => {
    gameManager.handleNewConnection(socket);
    socket.on('CREATE_ROOM', (data?: { roomName?: string }) => { gameManager.handleCreateRoom(socket, data?.roomName); });
    socket.on('JOIN_ROOM', (data: { roomId: string }) => { if (data && typeof data.roomId === 'string') { gameManager.handleJoinRoom(socket, data.roomId); } else { socket.emit('ERROR_MESSAGE', 'Invalid JOIN_ROOM data.'); } });
    socket.on('LEAVE_ROOM', () => { gameManager.handleLeaveRoom(socket); });
    socket.on('ATTEMPT_MOVE', (data: { largeBoardIdx: number; smallBoardIdx: number }) => { if (data && typeof data.largeBoardIdx === 'number' && typeof data.smallBoardIdx === 'number') { gameManager.handleAttemptMove(socket.id, data); } else { socket.emit('ERROR_MESSAGE', 'Invalid ATTEMPT_MOVE data.'); } });
    socket.on('REQUEST_RESET_GAME', () => { gameManager.handleResetGameRequest(socket.id); });
    socket.on('disconnect', (reason: string) => { gameManager.handleDisconnect(socket); });
    // Add other listeners here - chat
});

// Start the server
server.listen(PORT, () => { console.log(`Server listening on port ${PORT}`); });