const express = require('express');
const router = express.Router();
const adminUserController = require('../../controllers/adminUserController');
const { verifyToken, verifyAdmin } = require('../../middleware/authMiddleware');

router.get('/', verifyToken, verifyAdmin, adminUserController.getAllAdmins);
router.post('/', verifyToken, verifyAdmin, adminUserController.createAdmin);
router.put('/:id', verifyToken, verifyAdmin, adminUserController.updateAdmin);

module.exports = router;
