const express = require('express');
const router = express.Router();
const authController = require('../../controllers/authController');
const { verifyToken } = require('../../middleware/authMiddleware');
const {
  validateRegister,
  validateLogin,
  validateForgotPassword,
  validateResetPassword,
  validateGoogleLogin,
  validateZaloLogin,
  validateUpdateProfile
} = require('../../middleware/validationMiddleware');
const rateLimit = require('express-rate-limit');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 phút
  limit: 10, // Tối đa 10 requests / 1 IP / 15 phút
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, message: 'Quá nhiều yêu cầu, vui lòng thử lại sau 15 phút.' }
});

// FIX 1: Add input validation to all auth endpoints
// Đăng ký
router.post('/register', authLimiter, validateRegister, authController.register);

// Đăng nhập
router.post('/login', authLimiter, validateLogin, authController.login);
router.post('/google-login', authLimiter, validateGoogleLogin, authController.googleLogin);
router.post('/zalo-login', authLimiter, validateZaloLogin, authController.zaloLogin);
router.post('/forgot-password', authLimiter, validateForgotPassword, authController.forgotPassword);
router.post('/reset-password', authLimiter, validateResetPassword, authController.resetPassword);

// Lấy profile (yêu cầu xác thực)
router.get('/profile', verifyToken, authController.getProfile);

// Cập nhật profile (yêu cầu xác thực)
router.put('/profile', verifyToken, validateUpdateProfile, authController.updateProfile);

// Upload avatar (yêu cầu xác thực)
router.post('/avatar', verifyToken, authController.uploadAvatar);

module.exports = router;
