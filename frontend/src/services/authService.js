import api from './api';

const authService = {
  // Đăng ký
  register: (name, email, password, phone) => {
    return api.post('/auth/register', {
      name,
      email,
      password,
      phone
    });
  },

  // Đăng nhập
  login: (email, password) => {
    return api.post('/auth/login', {
      email,
      password
    });
  },

  // Lấy profile
  getProfile: () => {
    return api.get('/auth/profile');
  },

  // Cập nhật profile
  updateProfile: (name, email, phone) => {
    return api.put('/auth/profile', {
      name,
      email,
      phone
    });
  },

  // Lưu token
  setToken: (token) => {
    if (token) {
      localStorage.setItem('token', token);
      return;
    }

    localStorage.removeItem('token');
  },

  // Lấy token
  getToken: () => {
    return localStorage.getItem('token');
  },

  // Xóa token
  removeToken: () => {
    localStorage.removeItem('token');
  },

  // Lấy user từ localStorage
  getUser: () => {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  },

  // Lưu user
  setUser: (user) => {
    localStorage.setItem('user', JSON.stringify(user));
  },

  // Logout
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }
};

export default authService;

