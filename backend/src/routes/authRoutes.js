const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { verifyToken } = require('../middleware/authMiddleware');
const {
  validateRegister,
  validateLogin,
  validateUpdateProfile
} = require('../middleware/validationMiddleware');

// FIX 1: Add input validation to all auth endpoints
// Đăng ký
router.post('/register', validateRegister, authController.register);

// Đăng nhập
router.post('/login', validateLogin, authController.login);

// Lấy profile (yêu cầu xác thực)
router.get('/profile', verifyToken, authController.getProfile);

// Cập nhật profile (yêu cầu xác thực)
router.put('/profile', verifyToken, validateUpdateProfile, authController.updateProfile);

module.exports = router;
