import api from './api';

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
    if (token) {
      if (rememberMe) {
        localStorage.setItem('token', token);
        sessionStorage.removeItem('token');
      } else {
        sessionStorage.setItem('token', token);
        localStorage.removeItem('token');
      }
      return;
    }

    localStorage.removeItem('token');
    sessionStorage.removeItem('token');
  },

  // Lấy token
  getToken: () => {
    return localStorage.getItem('token') || sessionStorage.getItem('token');
  },

  // Xóa token
  removeToken: () => {
    localStorage.removeItem('token');
    sessionStorage.removeItem('token');
  },

  // Lấy user từ localStorage hoặc sessionStorage
  getUser: () => {
    const user = localStorage.getItem('user') || sessionStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  },

  // Lưu user
  setUser: (user, rememberMe = true) => {
    const userStr = JSON.stringify(user);
    if (rememberMe) {
      localStorage.setItem('user', userStr);
      sessionStorage.removeItem('user');
    } else {
      sessionStorage.setItem('user', userStr);
      localStorage.removeItem('user');
    }
  },

  // Logout
  logout: () => {
    localStorage.removeItem('token');
    sessionStorage.removeItem('token');
    localStorage.removeItem('user');
    sessionStorage.removeItem('user');
  }
};

export default authService;
