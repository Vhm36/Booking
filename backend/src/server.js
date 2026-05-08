const http = require('http');
const { Server } = require('socket.io');
const app = require('./app');
const db = require('./config/db');

const PORT = process.env.PORT || 5000;

// Create HTTP server + Socket.io
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      process.env.FRONTEND_URL || 'http://localhost:3000'
    ],
    methods: ['GET', 'POST'],
    credentials: true
  },
  transports: ['websocket', 'polling']
});

// Store io instance globally for use in controllers
app.set('io', io);

// Socket.io connection handler
io.on('connection', (socket) => {
  console.log(`[Socket] Client connected: ${socket.id}`);

  // Admin joins admin room
  socket.on('join-admin', () => {
    socket.join('admin-room');
    console.log(`[Socket] ${socket.id} joined admin-room`);
  });

  // Staff joins their own room
  socket.on('join-staff', (staffId) => {
    socket.join(`staff-${staffId}`);
    console.log(`[Socket] ${socket.id} joined staff-${staffId}`);
  });

  socket.on('disconnect', () => {
    console.log(`[Socket] Client disconnected: ${socket.id}`);
  });
});

db.ready
  .then(() => {
    server.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
      console.log(`[Socket] WebSocket server ready`);
    });
  })
  .catch((err) => {
    console.error('Database initialization error:', err);
    process.exit(1);
  });
