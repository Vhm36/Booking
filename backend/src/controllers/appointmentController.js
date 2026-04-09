const appointmentModel = require('../models/appointmentModel');
const serviceModel = require('../models/serviceModel');
const staffModel = require('../models/staffModel');

const CUSTOMER_CANCELLABLE_STATUSES = new Set(['pending', 'confirmed']);

const canManageAppointment = (appointment, currentUser) => {
  if (currentUser.role === 'admin') {
    return true;
  }

  if (currentUser.role === 'staff') {
    return Number(appointment.staff_id) === Number(currentUser.id);
  }

  return false;
};

exports.createAppointment = (req, res) => {
  const { service_id, staff_id, appointment_date, appointment_time, notes } = req.body;
  const user_id = req.user.id;

  if (!service_id || !staff_id || !appointment_date || !appointment_time) {
    return res.status(400).json({
      success: false,
      message: 'Vui lòng cung cấp đầy đủ thông tin'
    });
  }

  const parsedStaffId = Number(staff_id);
  if (!Number.isInteger(parsedStaffId) || parsedStaffId <= 0) {
    return res.status(400).json({
      success: false,
      message: 'staff_id không hợp lệ'
    });
  }

  staffModel.getStaffById(parsedStaffId, (staffErr, staff) => {
    if (staffErr) {
      return res.status(500).json({ success: false, message: 'Lỗi server', error: staffErr });
    }

    if (!staff || !staff.is_active) {
      return res.status(400).json({
        success: false,
        message: 'Nhân viên không tồn tại hoặc đang bị khóa'
      });
    }

    appointmentModel.checkTimeConflict(
      parsedStaffId,
      appointment_date,
      appointment_time,
      (conflictErr, hasConflict) => {
        if (conflictErr) {
          return res.status(500).json({ success: false, message: 'Lỗi server', error: conflictErr });
        }

        if (hasConflict) {
          return res.status(400).json({
            success: false,
            message:
              'Nhân viên đã có lịch hẹn vào thời gian này, vui lòng chọn thời gian khác hoặc nhân viên khác'
          });
        }

        serviceModel.getServiceById(service_id, (serviceErr, service) => {
          if (serviceErr || !service) {
            return res.status(404).json({ success: false, message: 'Dịch vụ không tồn tại' });
          }

          const appointmentData = {
            user_id,
            service_id,
            staff_id: parsedStaffId,
            appointment_date,
            appointment_time,
            status: 'pending',
            notes: notes || '',
            total_amount: service.price
          };

          appointmentModel.createAppointment(appointmentData, (createErr, result) => {
            if (createErr) {
              return res.status(500).json({ success: false, message: 'Lỗi server', error: createErr });
            }

            return res.status(201).json({
              success: true,
              message: 'Đặt lịch thành công',
              appointmentId: result.insertId,
              totalAmount: service.price
            });
          });
        });
      }
    );
  });
};

exports.getMyAppointments = (req, res) => {
  appointmentModel.getAppointmentsByUserId(req.user.id, (err, appointments) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Lỗi server', error: err });
    }

    return res.status(200).json({ success: true, data: appointments });
  });
};

exports.getAllAppointments = (req, res) => {
  const callback = (err, appointments) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Lỗi server', error: err });
    }

    return res.status(200).json({ success: true, data: appointments });
  };

  if (req.user.role === 'staff') {
    return appointmentModel.getAppointmentsByStaffId(req.user.id, callback);
  }

  return appointmentModel.getAllAppointments(callback);
};

exports.getAppointmentById = (req, res) => {
  const { id } = req.params;

  appointmentModel.getAppointmentById(id, (err, appointment) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Lỗi server', error: err });
    }

    if (!appointment) {
      return res.status(404).json({ success: false, message: 'Lịch hẹn không tồn tại' });
    }

    if (!canManageAppointment(appointment, req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền xem lịch hẹn này'
      });
    }

    return res.status(200).json({ success: true, data: appointment });
  });
};

exports.updateAppointmentStatus = (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!status) {
    return res.status(400).json({
      success: false,
      message: 'Vui lòng cung cấp trạng thái'
    });
  }

  appointmentModel.getAppointmentById(id, (err, appointment) => {
    if (err) {
      console.error('[UPDATE_APPOINTMENT_ERROR]', err);
      return res.status(500).json({ success: false, message: 'Lỗi server' });
    }

    if (!appointment) {
      return res.status(404).json({ success: false, message: 'Lịch hẹn không tồn tại' });
    }

    if (!canManageAppointment(appointment, req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền cập nhật lịch hẹn này'
      });
    }

    appointmentModel.updateAppointmentStatus(id, status, (updateErr) => {
      if (updateErr) {
        console.error('[UPDATE_APPOINTMENT_STATUS_ERROR]', updateErr);
        return res.status(500).json({
          success: false,
          message: 'Lỗi server khi cập nhật trạng thái'
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Cập nhật trạng thái thành công'
      });
    });
  });
};

exports.cancelAppointment = (req, res) => {
  const { id } = req.params;
  const currentUser = req.user;

  appointmentModel.getAppointmentById(id, (err, appointment) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Lỗi server', error: err });
    }

    if (!appointment) {
      return res.status(404).json({ success: false, message: 'Lịch hẹn không tồn tại' });
    }

    if (currentUser.role === 'admin') {
      return appointmentModel.cancelAppointment(id, (cancelErr) => {
        if (cancelErr) {
          return res.status(500).json({ success: false, message: 'Lỗi server', error: cancelErr });
        }

        return res.status(200).json({ success: true, message: 'Đã hủy lịch hẹn thành công' });
      });
    }

    if (Number(appointment.user_id) !== Number(currentUser.id)) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền gửi yêu cầu hủy lịch này'
      });
    }

    if (appointment.status === 'cancelled') {
      return res.status(400).json({ success: false, message: 'Lịch hẹn này đã bị hủy trước đó' });
    }

    if (appointment.status === 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Không thể hủy lịch đã hoàn thành'
      });
    }

    if (!CUSTOMER_CANCELLABLE_STATUSES.has(appointment.status)) {
      return res.status(400).json({
        success: false,
        message: 'Chỉ có thể gửi yêu cầu hủy khi lịch đang chờ xác nhận hoặc đã xác nhận'
      });
    }

    if (Number(appointment.cancellation_requested) === 1) {
      return res.status(400).json({
        success: false,
        message: 'Yêu cầu hủy lịch này đã được gửi trước đó'
      });
    }

    return appointmentModel.requestAppointmentCancellation(id, (requestErr) => {
      if (requestErr) {
        return res.status(500).json({ success: false, message: 'Lỗi server', error: requestErr });
      }

      return res.status(200).json({
        success: true,
        message: 'Đã gửi yêu cầu hủy. Nhân viên sẽ xác nhận trong thời gian sớm nhất.'
      });
    });
  });
};

exports.confirmCancellationRequest = (req, res) => {
  const { id } = req.params;

  appointmentModel.getAppointmentById(id, (err, appointment) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Lỗi server', error: err });
    }

    if (!appointment) {
      return res.status(404).json({ success: false, message: 'Lịch hẹn không tồn tại' });
    }

    if (!canManageAppointment(appointment, req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền xác nhận hủy lịch hẹn này'
      });
    }

    if (appointment.status === 'cancelled') {
      return res.status(400).json({ success: false, message: 'Lịch hẹn này đã bị hủy' });
    }

    if (appointment.status === 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Không thể xác nhận hủy lịch đã hoàn thành'
      });
    }

    if (Number(appointment.cancellation_requested) !== 1) {
      return res.status(400).json({
        success: false,
        message: 'Lịch hẹn này chưa có yêu cầu hủy cần xác nhận'
      });
    }

    return appointmentModel.cancelAppointment(id, (cancelErr) => {
      if (cancelErr) {
        return res.status(500).json({ success: false, message: 'Lỗi server', error: cancelErr });
      }

      return res.status(200).json({
        success: true,
        message: 'Đã xác nhận hủy lịch hẹn'
      });
    });
  });
};

exports.rejectCancellationRequest = (req, res) => {
  const { id } = req.params;

  appointmentModel.getAppointmentById(id, (err, appointment) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Lỗi server', error: err });
    }

    if (!appointment) {
      return res.status(404).json({ success: false, message: 'Lịch hẹn không tồn tại' });
    }

    if (!canManageAppointment(appointment, req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền xử lý yêu cầu hủy của lịch hẹn này'
      });
    }

    if (appointment.status === 'cancelled') {
      return res.status(400).json({ success: false, message: 'Lịch hẹn này đã bị hủy' });
    }

    if (Number(appointment.cancellation_requested) !== 1) {
      return res.status(400).json({
        success: false,
        message: 'Lịch hẹn này không có yêu cầu hủy đang chờ xử lý'
      });
    }

    return appointmentModel.clearAppointmentCancellationRequest(id, (clearErr) => {
      if (clearErr) {
        return res.status(500).json({ success: false, message: 'Lỗi server', error: clearErr });
      }

      return res.status(200).json({
        success: true,
        message: 'Đã giữ lại lịch hẹn và đóng yêu cầu hủy'
      });
    });
  });
};

exports.addStaffReview = (req, res) => {
  const { id } = req.params;
  const user_id = req.user.id;
  const { rating, review } = req.body;

  const parsedRating = Number(rating);
  if (!Number.isInteger(parsedRating) || parsedRating < 1 || parsedRating > 5) {
    return res.status(400).json({ success: false, message: 'Điểm đánh giá phải từ 1 đến 5' });
  }

  appointmentModel.addStaffReview(id, user_id, parsedRating, review || '', (err, result) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Lỗi server', error: err });
    }

    if (!result || result.affectedRows === 0) {
      return res.status(400).json({
        success: false,
        message: 'Chỉ có thể đánh giá lịch đã hoàn thành và chưa được đánh giá'
      });
    }

    return res.status(200).json({ success: true, message: 'Đánh giá nhân viên thành công' });
  });
};