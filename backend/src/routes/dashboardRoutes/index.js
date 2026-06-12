const express = require('express');
const router = express.Router();
const dashboardController = require('../../controllers/dashboardController');
const { verifyToken, verifyAdmin } = require('../../middleware/authMiddleware');

// Tất cả routes dashboard yêu cầu admin
router.use(verifyToken, verifyAdmin);

// Lấy tóm tắt dashboard
router.get('/summary', dashboardController.getSummary);

// Dashboard tổng hợp theo ngày/tháng/năm
router.get('/overview', dashboardController.getOverview);

// Lấy booking theo tháng
router.get('/bookings-by-month', dashboardController.getBookingsByMonth);

// Lấy dịch vụ phổ biến
router.get('/top-services', dashboardController.getTopServices);

// Lấy tần suất khách hàng
router.get('/customer-frequency', dashboardController.getCustomerFrequency);

// Lấy trạng thái appointment
router.get('/appointment-status', dashboardController.getAppointmentStatus);

// Lấy doanh thu theo tháng
router.get('/revenue-by-month', dashboardController.getRevenueByMonth);

// Lấy tỷ lệ hủy lịch
router.get('/cancellation-rate', dashboardController.getCancellationRate);
router.get('/customer-behavior-bot', dashboardController.getCustomerBehaviorBot);
router.get('/dec-clustering', dashboardController.getDecClustering);
router.get('/staff-commission-by-month', dashboardController.getStaffCommissionByMonth);

module.exports = router;
