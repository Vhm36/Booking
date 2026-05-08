import { io } from 'socket.io-client';
import { API_ORIGIN } from './api';

const connectDashboardRealtime = async ({ onUpdate, onStatus }) => {
  const socket = io(API_ORIGIN, {
    transports: ['websocket', 'polling'],
    withCredentials: true
  });

  socket.on('connect', () => {
    socket.emit('join-admin');
    onStatus?.('connected');
  });

  socket.on('disconnect', () => {
    onStatus?.('disconnected');
  });

  socket.on('connect_error', () => {
    onStatus?.('fallback');
  });

  socket.on('dashboard:update', (payload) => {
    onUpdate?.(payload);
  });

  return socket;
};

export default connectDashboardRealtime;
