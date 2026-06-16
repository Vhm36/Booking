import api from './api';
import {
  clearAuthSession,
  getAuthToken,
  getAuthUser,
  isAuthRemembered,
  setAuthToken,
  setAuthUser,
  startFreshAuthSession
} from '../utils/authStorage';

const authService = {
  // Đăng ký
  register: (name, email, password, phone, dateOfBirth) => {
    return api.post('/auth/register', {
      name,
      email,
      password,
      phone,
      date_of_birth: dateOfBirth
    });
  },

  // Đăng nhập
  login: (email, password) => {
    return api.post('/auth/login', {
      email,
      password
    });
  },

  googleLogin: (idToken) => {
    return api.post('/auth/google-login', {
      idToken
    });
  },

  zaloLogin: (code, codeVerifier) => {
    return api.post('/auth/zalo-login', {
      code,
      codeVerifier
    });
  },

  forgotPassword: (email) => {
    return api.post('/auth/forgot-password', {
      email
    });
  },

  resetPassword: (token, newPassword) => {
    return api.post('/auth/reset-password', {
      token,
      newPassword
    });
  },

  // Lấy profile
  getProfile: () => {
    return api.get('/auth/profile');
  },

  // Cập nhật profile
  updateProfile: ({ name, email, phone, date_of_birth, gender }) => {
    return api.put('/auth/profile', {
      name,
      email,
      phone,
      date_of_birth,
      gender
    });
  },

  // Upload avatar
  uploadAvatar: (file) => {
    const formData = new FormData();
    formData.append('avatar', file);
    return api.post('/auth/avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },

  // Lưu token
  setToken: (token, rememberMe = true) => {
    setAuthToken(token, rememberMe);
  },

  // Lấy token
  getToken: () => {
    return getAuthToken();
  },

  // Xóa token
  removeToken: () => {
    setAuthToken(null);
  },

  // Lấy user từ localStorage hoặc sessionStorage
  getUser: () => {
    return getAuthUser();
  },

  // Lưu user
  setUser: (user, rememberMe = true) => {
    setAuthUser(user, rememberMe);
  },

  isRemembered: () => isAuthRemembered(),

  startFreshSession: () => startFreshAuthSession(),

  // Logout
  logout: () => {
    clearAuthSession();
  }
};

export default authService;
