const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { verifyToken } = require('../middleware/authMiddleware');

// FIX 6: Add payment routes
// Create payment request
router.post('/create-payment', verifyToken, paymentController.createPayment);

// Verify/confirm payment (called after successful payment from Momo/VNPay)
router.post('/verify-payment', verifyToken, paymentController.verifyPayment);

// Get payment details
router.get('/:payment_id', verifyToken, paymentController.getPayment);

module.exports = router;
