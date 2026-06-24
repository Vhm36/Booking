const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const app = require('./app');
const { socketCorsOptions } = require('./config/cors');
const db = require('./config/db');

const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET;
const onlineUsers = new Map();

// Create HTTP server + Socket.io
const server = http.createServer(app);

const io = new Server(server, {
  cors: socketCorsOptions,
  transports: ['websocket', 'polling']
});

// Store io instance globally for use in controllers
app.set('io', io);

const getPresencePayload = (userId, online) => {
  const entry = onlineUsers.get(String(userId));
  return {
    userId: Number(userId),
    online: Boolean(online),
    role: entry?.role || null,
    connectedAt: entry?.connectedAt || null,
    lastSeenAt: new Date().toISOString()
  };
};

const broadcastPresence = (userId, online) => {
  const payload = getPresencePayload(userId, online);
  io.to('admin-room').emit('presence:update', payload);
  io.to(`user-${userId}`).emit('presence:update', payload);
};

const registerPresence = (socket, decodedUser) => {
  const userId = String(decodedUser.id);
  const existing = onlineUsers.get(userId);
  const isFirstConnection = !existing || existing.socketIds.size === 0;
  const entry = existing || {
    userId: Number(decodedUser.id),
    role: decodedUser.role,
    email: decodedUser.email,
    socketIds: new Set(),
    connectedAt: new Date().toISOString()
  };

  entry.role = decodedUser.role;
  entry.email = decodedUser.email;
  entry.socketIds.add(socket.id);
  onlineUsers.set(userId, entry);

  socket.data.user = decodedUser;
  socket.join(`user-${userId}`);

  if (decodedUser.role === 'admin') {
    socket.join('admin-room');
  }

  if (decodedUser.role === 'staff') {
    socket.join(`staff-${decodedUser.id}`);
  }

  socket.emit('presence:me', {
    userId: Number(decodedUser.id),
    online: true,
    role: decodedUser.role,
    connectedAt: entry.connectedAt
  });

  if (isFirstConnection) {
    broadcastPresence(userId, true);
  }
};

const unregisterPresence = (socket) => {
  const decodedUser = socket.data.user;
  if (!decodedUser?.id) {
    return;
  }

  const userId = String(decodedUser.id);
  const entry = onlineUsers.get(userId);
  if (!entry) {
    return;
  }

  entry.socketIds.delete(socket.id);

  if (entry.socketIds.size > 0) {
    return;
  }

  onlineUsers.delete(userId);
  broadcastPresence(userId, false);
};

// Socket.io connection handler
io.on('connection', (socket) => {
  console.log(`[Socket] Client connected: ${socket.id}`);
  const token = socket.handshake.auth?.token;

  if (token && JWT_SECRET) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      registerPresence(socket, decoded);
    } catch (err) {
      console.warn(`[Socket] Invalid auth token for ${socket.id}: ${err.message}`);
      socket.emit('auth:error', {
        message: err.name === 'TokenExpiredError'
          ? 'Phiên đăng nhập đã hết hạn'
          : 'Token không hợp lệ'
      });
      socket.disconnect(true);
      return;
    }
  }

  // Admin joins admin room
  socket.on('join-admin', () => {
    if (socket.data.user?.role !== 'admin') {
      return;
    }
    socket.join('admin-room');
    console.log(`[Socket] ${socket.id} joined admin-room`);
  });

  // Staff joins their own room
  socket.on('join-staff', (staffId) => {
    const currentUser = socket.data.user;
    if (currentUser?.role !== 'staff' || Number(currentUser.id) !== Number(staffId)) {
      return;
    }
    socket.join(`staff-${staffId}`);
    console.log(`[Socket] ${socket.id} joined staff-${staffId}`);
  });

  socket.on('disconnect', () => {
    unregisterPresence(socket);
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
