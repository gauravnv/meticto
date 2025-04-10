import { io, Socket } from 'socket.io-client';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

// Initialize the socket connection
const socket: Socket = io(SERVER_URL, {
  autoConnect: false, // Connect manually when needed
  // Optional: Add withCredentials if you need cookies/auth later
  // withCredentials: true,
  transports: ['websocket', 'polling']
});

socket.on('connect', () => {
  console.log('Socket connected:', socket.id);
});

socket.on('disconnect', (reason) => {
  console.log('Socket disconnected:', reason);
  // TODO: Maybe update UI state to show disconnected status
});

socket.on('connect_error', (err) => {
  console.error('Socket connection error:', err);
  // TODO: Show connection error message to user
});

export default socket;