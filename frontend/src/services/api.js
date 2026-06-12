import axios from 'axios';

export const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://127.0.0.1:5000/api';
export const API_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, '');
export const AUTH_EXPIRED_EVENT = 'auth:expired';

const PUBLIC_AUTH_PATHS = [
  '/auth/login',
  '/auth/register',
  '/auth/google-login',
  '/auth/zalo-login',
  '/auth/forgot-password',
  '/auth/reset-password'
];

const getStoredToken = () => localStorage.getItem('token') || sessionStorage.getItem('token');

const clearStoredAuth = () => {
  localStorage.removeItem('token');
  sessionStorage.removeItem('token');
  localStorage.removeItem('user');
  sessionStorage.removeItem('user');
};

const isPublicAuthRequest = (config = {}) => {
  const url = String(config.url || '').replace(API_BASE_URL, '');
  const path = url.split('?')[0];
  return PUBLIC_AUTH_PATHS.some((publicPath) => path === publicPath || path.endsWith(publicPath));
};

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

api.interceptors.request.use((config) => {
  const token = getStoredToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;

    if (status === 401 && getStoredToken() && !isPublicAuthRequest(error.config)) {
      clearStoredAuth();
      window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT, {
        detail: {
          message: error.response?.data?.message || 'Phiên đăng nhập đã hết hạn'
        }
      }));
    }

    return Promise.reject(error);
  }
);

export default api;
