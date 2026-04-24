const express = require('express');
const router = express.Router();
const paymentController = require('../../controllers/paymentController');
const { verifyToken } = require('../../middleware/authMiddleware');

router.get('/vnpay-return', paymentController.handleVnpayReturn);
router.get('/vnpay-ipn', paymentController.handleVnpayIpn);
router.get('/options', verifyToken, paymentController.getPaymentOptions);

router.post('/create-payment', verifyToken, paymentController.createPayment);
router.post('/verify-payment', verifyToken, paymentController.verifyPayment);
router.put('/:payment_id/confirm-transfer', verifyToken, paymentController.confirmTransferPayment);
router.get('/:payment_id', verifyToken, paymentController.getPayment);

module.exports = router;
