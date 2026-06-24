const express = require('express');
const router = express.Router();
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const appointmentController = require('../../controllers/appointmentController');
const { verifyToken, verifyAdminOrStaff } = require('../../middleware/authMiddleware');
const {
  validateCreateAppointment,
  validateUpdateAppointmentStatus,
  validateAddReview,
  validateAppointmentId
} = require('../../middleware/validationMiddleware');

const createBookingLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  keyGenerator: (req) => (req.user?.id ? `user:${req.user.id}` : ipKeyGenerator(req.ip)),
  message: 'Bạn đặt lịch quá nhiều lần, vui lòng thử lại sau.'
});

router.post('/', verifyToken, createBookingLimiter, validateCreateAppointment, appointmentController.createAppointment);
router.post('/cancellation-score', verifyToken, appointmentController.getCancellationScore);
router.get('/my-bookings', verifyToken, appointmentController.getMyAppointments);
router.put('/:id/cancel', verifyToken, validateAppointmentId, appointmentController.cancelAppointment);
router.put('/:id/request-cancel', verifyToken, verifyAdminOrStaff, validateAppointmentId, appointmentController.requestCancellationByStaff);
router.put('/:id/review', verifyToken, validateAppointmentId, validateAddReview, appointmentController.addStaffReview);

router.get('/', verifyToken, verifyAdminOrStaff, appointmentController.getAllAppointments);
router.get('/:id', verifyToken, verifyAdminOrStaff, validateAppointmentId, appointmentController.getAppointmentById);
router.put('/:id/status', verifyToken, verifyAdminOrStaff, validateAppointmentId, validateUpdateAppointmentStatus, appointmentController.updateAppointmentStatus);
router.put('/:id/confirm-cancel', verifyToken, verifyAdminOrStaff, validateAppointmentId, appointmentController.confirmCancellationRequest);
router.put('/:id/reject-cancel', verifyToken, verifyAdminOrStaff, validateAppointmentId, appointmentController.rejectCancellationRequest);

module.exports = router;
