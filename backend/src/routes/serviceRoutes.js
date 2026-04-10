const express = require('express');
const router = express.Router();
const serviceController = require('../controllers/serviceController');
const { verifyToken, verifyAdmin } = require('../middleware/authMiddleware');

// Admin routes
router.get('/admin/all', verifyToken, verifyAdmin, serviceController.getAllServicesForAdmin);
router.post('/', verifyToken, verifyAdmin, serviceController.createService);
router.put('/:id', verifyToken, verifyAdmin, serviceController.updateService);
router.put('/:id/price', verifyToken, verifyAdmin, serviceController.updateServicePrice);
router.delete('/:id', verifyToken, verifyAdmin, serviceController.deleteService);

// Public routes
router.get('/', serviceController.getAllServices);
router.get('/:id', serviceController.getServiceById);

module.exports = router;
