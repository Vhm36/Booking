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
  validateUpdateProfile
} = require('../../middleware/validationMiddleware');

// FIX 1: Add input validation to all auth endpoints
// Đăng ký
router.post('/register', validateRegister, authController.register);

// Đăng nhập
router.post('/login', validateLogin, authController.login);
router.post('/google-login', validateGoogleLogin, authController.googleLogin);
router.post('/forgot-password', validateForgotPassword, authController.forgotPassword);
router.post('/reset-password', validateResetPassword, authController.resetPassword);

// Lấy profile (yêu cầu xác thực)
router.get('/profile', verifyToken, authController.getProfile);

// Cập nhật profile (yêu cầu xác thực)
router.put('/profile', verifyToken, validateUpdateProfile, authController.updateProfile);

module.exports = router;
