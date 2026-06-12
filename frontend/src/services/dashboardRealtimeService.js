import { io } from 'socket.io-client';
import { API_ORIGIN, AUTH_EXPIRED_EVENT } from './api';

const getAuthToken = () => localStorage.getItem('token') || sessionStorage.getItem('token');

const clearStoredAuth = () => {
  localStorage.removeItem('token');
  sessionStorage.removeItem('token');
  localStorage.removeItem('user');
  sessionStorage.removeItem('user');
};

const connectDashboardRealtime = async ({ onUpdate, onStatus, onPresenceMe, onPresenceUpdate } = {}) => {
  const socket = io(API_ORIGIN, {
    transports: ['websocket', 'polling'],
    withCredentials: true,
    auth: {
      token: getAuthToken()
    }
  });

  socket.on('connect', () => {
    onStatus?.('connected');
  });

  socket.on('disconnect', () => {
    onStatus?.('disconnected');
  });

  socket.on('connect_error', () => {
    onStatus?.('fallback');
  });

  socket.on('auth:error', (payload) => {
    clearStoredAuth();
    window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT, {
      detail: {
        message: payload?.message || 'Phiên đăng nhập đã hết hạn'
      }
    }));
    socket.disconnect();
  });

  socket.on('dashboard:update', (payload) => {
    onUpdate?.(payload);
  });

  socket.on('presence:me', (payload) => {
    onPresenceMe?.(payload);
  });

  socket.on('presence:update', (payload) => {
    onPresenceUpdate?.(payload);
  });

  return socket;
};

export default connectDashboardRealtime;
