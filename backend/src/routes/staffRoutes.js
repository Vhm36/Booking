const express = require('express');
const router = express.Router();
const staffController = require('../controllers/staffController');
const { verifyToken, verifyAdmin } = require('../middleware/authMiddleware');

// For booking flow (customer/admin): get free staff by date/time
router.get('/bookable', verifyToken, staffController.getBookableStaff);
router.get('/available', verifyToken, staffController.getAvailableStaff);

// Admin staff management
router.get('/', verifyToken, verifyAdmin, staffController.getAllStaff);
router.post('/', verifyToken, verifyAdmin, staffController.createStaff);
router.put('/:id', verifyToken, verifyAdmin, staffController.updateStaff);

module.exports = router;
