const express = require('express');
const router = express.Router();
const voucherController = require('../../controllers/voucherController');
const { verifyToken, verifyAdmin } = require('../../middleware/authMiddleware');

router.get('/my-vouchers', verifyToken, voucherController.getMyVouchers);
router.post('/validate', verifyToken, voucherController.validateVoucher);
router.get('/analytics', verifyToken, verifyAdmin, voucherController.getAnalytics);
router.get('/', verifyToken, verifyAdmin, voucherController.getAllVouchers);
router.post('/', verifyToken, verifyAdmin, voucherController.createVoucher);
router.get('/:id', verifyToken, verifyAdmin, voucherController.getVoucherById);
router.put('/:id', verifyToken, verifyAdmin, voucherController.updateVoucher);
router.delete('/:id', verifyToken, verifyAdmin, voucherController.deleteVoucher);
router.post('/:id/assign', verifyToken, verifyAdmin, voucherController.assignVoucher);

module.exports = router;
