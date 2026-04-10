const paymentModel = require('../models/paymentModel');
const appointmentModel = require('../models/appointmentModel');

// FIX 6: Implement Payment Endpoints
// POST /api/payments/create-payment
exports.createPayment = (req, res) => {
  const { appointment_id, payment_method } = req.body;
  const user_id = req.user.id;

  if (!appointment_id || !payment_method) {
    return res.status(400).json({
      success: false,
      message: 'Vui lòng cung cấp appointment_id và payment_method'
    });
  }

  if (!['momo', 'vnpay', 'bank_transfer'].includes(payment_method)) {
    return res.status(400).json({
      success: false,
      message: 'Phương thức thanh toán không hợp lệ'
    });
  }

  // Check nếu appointment thuộc user này
  appointmentModel.getAppointmentById(appointment_id, (err, appointment) => {
    if (err || !appointment) {
      return res.status(404).json({
        success: false,
        message: 'Lịch hẹn không tồn tại'
      });
    }

    if (Number(appointment.user_id) !== Number(user_id)) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền thanh toán cho lịch này'
      });
    }

    // Tạo payment record
    const paymentData = {
      appointment_id,
      amount: appointment.total_amount,
      payment_method,
      payment_status: 'pending',
      created_by: user_id
    };

    paymentModel.createPayment(paymentData, (createErr, result) => {
      if (createErr) {
        console.error('[CREATE_PAYMENT_ERROR]', createErr);
        return res.status(500).json({
          success: false,
          message: 'Lỗi server khi tạo yêu cầu thanh toán'
        });
      }

      // TODO: Call Momo/VNPay API here to get payment URL
      // Tạm thời trả về payment info
      res.status(201).json({
        success: true,
        message: 'Yêu cầu thanh toán đã được tạo',
        payment: {
          id: result.insertId,
          appointment_id,
          amount: appointment.total_amount,
          payment_method,
          status: 'pending',
          // payment_url: '...' // Will be returned after Momo/VNPay integration
        }
      });
    });
  });
};

// POST /api/payments/verify-payment
exports.verifyPayment = (req, res) => {
  const { payment_id, transaction_code } = req.body;
  const user_id = req.user.id;

  if (!payment_id || !transaction_code) {
    return res.status(400).json({
      success: false,
      message: 'Vui lòng cung cấp payment_id và transaction_code'
    });
  }

  // Get payment record
  paymentModel.getPaymentById(payment_id, (err, payment) => {
    if (err || !payment) {
      return res.status(404).json({
        success: false,
        message: 'Thanh toán không tồn tại'
      });
    }

    // Check ownership
    appointmentModel.getAppointmentById(payment.appointment_id, (appointmentErr, appointment) => {
      if (appointmentErr || !appointment) {
        return res.status(404).json({
          success: false,
          message: 'Lịch hẹn không tồn tại'
        });
      }

      if (Number(appointment.user_id) !== Number(user_id)) {
        return res.status(403).json({
          success: false,
          message: 'Bạn không có quyền xác nhận thanh toán này'
        });
      }

      // TODO: Verify with Momo/VNPay API
      // For now, assume verification is successful
      
      const updateData = {
        payment_status: 'success',
        transaction_code,
        paid_at: new Date()
      };

      paymentModel.updatePayment(payment_id, updateData, (updateErr) => {
        if (updateErr) {
          console.error('[UPDATE_PAYMENT_ERROR]', updateErr);
          return res.status(500).json({
            success: false,
            message: 'Lỗi server khi xác nhận thanh toán'
          });
        }

        // Update appointment status to confirmed
        appointmentModel.updateAppointmentStatus(payment.appointment_id, 'confirmed', (statusErr) => {
          if (statusErr) {
            console.error('[UPDATE_APPOINTMENT_STATUS_ERROR]', statusErr);
          }

          res.status(200).json({
            success: true,
            message: 'Thanh toán đã được xác nhận',
            payment: {
              id: payment_id,
              status: 'success',
              transaction_code
            }
          });
        });
      });
    });
  });
};

// GET /api/payments/:payment_id
exports.getPayment = (req, res) => {
  const { payment_id } = req.params;
  const user_id = req.user.id;

  paymentModel.getPaymentById(payment_id, (err, payment) => {
    if (err || !payment) {
      return res.status(404).json({
        success: false,
        message: 'Thanh toán không tồn tại'
      });
    }

    // Check ownership
    appointmentModel.getAppointmentById(payment.appointment_id, (appointmentErr, appointment) => {
      if (appointmentErr || !appointment) {
        return res.status(404).json({
          success: false,
          message: 'Lịch hẹn không tồn tại'
        });
      }

      if (Number(appointment.user_id) !== Number(user_id) && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Bạn không có quyền xem thanh toán này'
        });
      }

      res.status(200).json({
        success: true,
        data: payment
      });
    });
  });
};
