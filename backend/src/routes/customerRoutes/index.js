const express = require('express');
const router = express.Router();
const customerController = require('../../controllers/customerController');
const voucherController = require('../../controllers/voucherController');
const { verifyToken, verifyAdmin, verifyAdminOrStaff } = require('../../middleware/authMiddleware');

router.get('/', verifyToken, verifyAdminOrStaff, customerController.getAllCustomers);
router.post('/', verifyToken, verifyAdminOrStaff, customerController.createCustomer);
router.put('/:id', verifyToken, verifyAdminOrStaff, customerController.updateCustomer);
router.delete('/:id', verifyToken, verifyAdminOrStaff, customerController.deleteCustomer);
router.post('/:id/send-voucher-email', verifyToken, verifyAdmin, voucherController.createAndSendVoucherToCustomer);

module.exports = router;
