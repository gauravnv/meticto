import express from 'express';
import http from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import cors from 'cors';
import { GameManager } from './gameManager';

// --- Server Setup ---
const app = express();
const server = http.createServer(app);
const clientUrlFromEnv = process.env.CLIENT_URL || 'http://localhost:5173';
const renderClientUrlFromEnv = process.env.RENDER_CLIENT_URL;

let dynamicAllowedOrigins = [clientUrlFromEnv];
if (renderClientUrlFromEnv) {
    console.log(`RENDER_CLIENT_URL found: ${renderClientUrlFromEnv}`);
    // Ensure no duplicates if CLIENT_URL was also set to the render URL
    if (!dynamicAllowedOrigins.includes(renderClientUrlFromEnv)) {
         dynamicAllowedOrigins.push(renderClientUrlFromEnv);
    }
} else {
     console.log("RENDER_CLIENT_URL not found in environment.");
}
console.log("Final allowed CORS origins:", dynamicAllowedOrigins);


const corsOptions: cors.CorsOptions = {
    origin: (origin, callback) => {
        // Use the dynamically built list
        if (!origin || dynamicAllowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            console.warn(`CORS blocked for origin: ${origin}`);
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
    credentials: true,
};
app.use(cors(corsOptions));

const io = new SocketIOServer(server, {
    cors: corsOptions,
    transports: ['websocket', 'polling']
});

const PORT = process.env.PORT || 3001;
app.get('/', (req, res) => { res.send('Meticto Server Running!'); });

// --- Instantiate GameManager ---
const gameManager = new GameManager(io);

// --- Socket.IO Connection Handling ---
io.on('connection', (socket: Socket) => {
    gameManager.handleNewConnection(socket);
    socket.on('CREATE_ROOM', (data?: { roomName?: string }) => { gameManager.handleCreateRoom(socket, data?.roomName); });
    socket.on('JOIN_ROOM', (data: { roomId: string }) => { if (data && typeof data.roomId === 'string') { gameManager.handleJoinRoom(socket, data.roomId); } else { socket.emit('ERROR_MESSAGE', 'Invalid JOIN_ROOM data.'); } });
    socket.on('LEAVE_ROOM', () => { gameManager.handleLeaveRoom(socket); });
    socket.on('ATTEMPT_MOVE', (data: { largeBoardIdx: number; smallBoardIdx: number }) => { if (data && typeof data.largeBoardIdx === 'number' && typeof data.smallBoardIdx === 'number') { gameManager.handleAttemptMove(socket.id, data); } else { socket.emit('ERROR_MESSAGE', 'Invalid ATTEMPT_MOVE data.'); } });
    socket.on('REQUEST_REMATCH', () => { gameManager.handleRematchRequest(socket.id); });
    socket.on('disconnect', (reason: string) => { gameManager.handleDisconnect(socket); });
});

// Start the server
server.listen(PORT, () => { console.log(`Server listening on port ${PORT}`); });