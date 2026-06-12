const express = require('express');
const router = express.Router();
const staffController = require('../../controllers/staffController');
const { verifyToken, verifyAdmin } = require('../../middleware/authMiddleware');
const { validateStaffId } = require('../../middleware/validationMiddleware');

// For booking flow (customer/admin): get free staff by date/time
router.get('/bookable', verifyToken, staffController.getBookableStaff);
router.get('/available', verifyToken, staffController.getAvailableStaff);
router.get('/:id/busy-slots', verifyToken, validateStaffId, staffController.getBusyTimeSlots);

// Admin staff management (specific paths before generic /:id)
router.get('/roles', verifyToken, verifyAdmin, staffController.getAllStaffRoles);
router.post('/roles', verifyToken, verifyAdmin, staffController.createStaffRole);
router.get('/me/weekly-availability', verifyToken, staffController.getMyWeeklyAvailability);
router.put('/me/weekly-availability', verifyToken, staffController.replaceMyWeeklyAvailability);
router.post('/me/start-work', verifyToken, staffController.startWork);
router.get(
  '/:id/weekly-availability',
  verifyToken,
  verifyAdmin,
  validateStaffId,
  staffController.getWeeklyAvailability
);
router.put(
  '/:id/weekly-availability',
  verifyToken,
  verifyAdmin,
  validateStaffId,
  staffController.replaceWeeklyAvailability
);

// Leave requests (Staff)
router.post('/leave-request', verifyToken, staffController.requestLeave);
router.get('/my-leave-requests', verifyToken, staffController.getMyLeaveRequests);

// Leave requests (Admin)
router.get('/leave-requests', verifyToken, verifyAdmin, staffController.getAllLeaveRequests);
router.put('/leave-requests/:id/status', verifyToken, verifyAdmin, staffController.updateLeaveRequestStatus);

router.get('/', verifyToken, verifyAdmin, staffController.getAllStaff);
router.post('/', verifyToken, verifyAdmin, staffController.createStaff);
router.put('/:id', verifyToken, verifyAdmin, staffController.updateStaff);

module.exports = router;
