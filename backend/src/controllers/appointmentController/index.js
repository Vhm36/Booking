const appointmentModel = require('../../models/appointmentModel');
const serviceModel = require('../../models/serviceModel');
const staffModel = require('../../models/staffModel');
const voucherService = require('../../services/voucherService');
const { calculateScore: calculateCancellationScore } = require('../../services/cancellationScoreService');
const { normalizeTimeString, addMinutesToTimeString, toShortTimeString } = require('../../utils/timeSlot');
const { emitDashboardUpdate } = require('../../utils/realtime');
const {
  normalizeSelectedServiceIds,
  summarizeSelectedServices
} = require('../../utils/appointmentServices');

const CUSTOMER_CANCELLABLE_STATUSES = new Set(['pending', 'confirmed']);

const isCashierStaffUser = (user) =>
  user &&
  user.role === 'staff' &&
  staffModel.isStaffRoleExcludedFromCustomerBooking(user.staff_role_name);

const canManageAppointment = (appointment, currentUser) => {
  if (currentUser.role === 'admin') {
    return true;
  }

  if (isCashierStaffUser(currentUser)) {
    return true;
  }

  if (currentUser.role === 'staff') {
    return Number(appointment.staff_id) === Number(currentUser.id);
  }

  return false;
};

exports.createAppointment = (req, res) => {
  const { service_id, selected_service_ids, staff_id, appointment_date, appointment_time, notes, voucher_code } = req.body;
  const user_id = req.user.id;
  const requestedServiceIds = normalizeSelectedServiceIds(selected_service_ids, service_id);

  if (requestedServiceIds.length === 0 || !appointment_date || !appointment_time) {
    return res.status(400).json({
      success: false,
      message: 'Vui lòng cung cấp đầy đủ thông tin'
    });
  }

  const parsedStaffId = staff_id ? Number(staff_id) : null;
  if (parsedStaffId !== null && (!Number.isInteger(parsedStaffId) || parsedStaffId <= 0)) {
    return res.status(400).json({
      success: false,
      message: 'staff_id không hợp lệ'
    });
  }

  const normalizedAppointmentTime = normalizeTimeString(appointment_time);
  if (!normalizedAppointmentTime) {
    return res.status(400).json({
      success: false,
      message: 'Giờ hẹn không hợp lệ'
    });
  }

  serviceModel.getServicesByIds(requestedServiceIds, (serviceErr, services) => {
    if (serviceErr) {
      return res.status(500).json({ success: false, message: 'Lỗi server', error: serviceErr });
    }

    if (!services || services.length !== requestedServiceIds.length) {
      return res.status(404).json({ success: false, message: 'Có dịch vụ không tồn tại' });
    }

    const serviceById = new Map(services.map((service) => [Number(service.id), service]));
    const orderedServices = requestedServiceIds.map((id) => serviceById.get(Number(id))).filter(Boolean);
    const hasInactiveService = orderedServices.some((service) => service.status !== 'active');

    if (hasInactiveService) {
      return res.status(400).json({
        success: false,
        message: 'Có dịch vụ hiện không còn hoạt động'
      });
    }

    const { totalDuration, totalPrice } = summarizeSelectedServices(orderedServices);
    const requestedEndTime = addMinutesToTimeString(normalizedAppointmentTime, totalDuration);

    if (!requestedEndTime) {
      return res.status(400).json({
        success: false,
        message: 'Khung giờ đặt lịch không hợp lệ cho dịch vụ này'
      });
    }

    const prepareVoucher = async () => {
      const cleanVoucherCode = String(voucher_code || '').trim();
      if (!cleanVoucherCode) {
        return null;
      }

      return voucherService.validateVoucherForCustomer({
        customerId: user_id,
        code: cleanVoucherCode,
        subtotal: totalPrice
      });
    };

    const proceedWithStaff = (finalStaffId) => {
      staffModel.getStaffById(finalStaffId, (staffErr, staff) => {
        if (staffErr) {
          return res.status(500).json({ success: false, message: 'Lỗi server', error: staffErr });
        }

        if (!staff || !staff.is_active) {
          return res.status(400).json({
            success: false,
            message: 'Nhân viên không tồn tại hoặc đang bị khóa'
          });
        }

        if (staffModel.isStaffRoleExcludedFromCustomerBooking(staff.role_name)) {
          return res.status(400).json({
            success: false,
            message: 'Nhân viên thu ngân không thể được chọn khi đặt dịch vụ. Vui lòng chọn nhân viên khác.'
          });
        }

        appointmentModel.checkTimeConflict(
          finalStaffId,
          appointment_date,
          normalizedAppointmentTime,
          requestedEndTime,
          (conflictErr, conflictInfo) => {
            if (conflictErr) {
              return res.status(500).json({ success: false, message: 'Lỗi server', error: conflictErr });
            }

            if (conflictInfo) {
              return res.status(400).json({
                success: false,
                message: `Nhân viên đã được đặt từ ${toShortTimeString(conflictInfo.busy_start_time)} den ${toShortTimeString(
                  conflictInfo.busy_end_time
                )}. Vui lòng chọn giờ khác hoặc đổi nhân viên khác.`,
                conflict: {
                  busy_start_time: toShortTimeString(conflictInfo.busy_start_time),
                  busy_end_time: toShortTimeString(conflictInfo.busy_end_time),
                  booked_service_name: conflictInfo.booked_service_name || ''
                }
              });
            }

            staffModel.isStaffAvailableForWeeklySchedule(
              finalStaffId,
              appointment_date,
              normalizedAppointmentTime,
              requestedEndTime,
              (scheduleErr, withinSchedule) => {
                if (scheduleErr) {
                  return res.status(500).json({ success: false, message: 'Lỗi server', error: scheduleErr });
                }

                if (!withinSchedule) {
                  return res.status(400).json({
                    success: false,
                    message:
                      'Nhân viên không làm việc trong toàn bộ khung giờ đã chọn. Vui lòng đổi nhân viên khác hoặc chọn giờ khác.'
                  });
                }

                const finishCreateAppointment = async () => {
                  let voucherResult = null;
                  try {
                    voucherResult = await prepareVoucher();
                  } catch (voucherErr) {
                    return res.status(voucherErr.status || 400).json({
                      success: false,
                      message: voucherErr.message || 'Voucher không hợp lệ'
                    });
                  }

                  const discountAmount = Number(voucherResult?.discountAmount || 0);
                  const finalTotal = Math.max(totalPrice - discountAmount, 0);
                  let cancellationScore = {
                    score: 0,
                    riskLevel: 'low',
                    requireDeposit: false,
                    depositPercent: 0
                  };

                  try {
                    cancellationScore = await calculateCancellationScore(
                      user_id,
                      appointment_date,
                      normalizedAppointmentTime
                    );
                  } catch (scoreErr) {
                    console.error('[CANCELLATION_SCORE_CREATE_ERROR]', scoreErr.message);
                  }

                  const depositPercent = Number(cancellationScore.depositPercent || 0);
                  const depositRequired = Boolean(cancellationScore.requireDeposit);
                  const depositAmount = depositRequired && finalTotal > 0
                    ? Math.min(finalTotal, Math.max(1000, Math.round((finalTotal * depositPercent) / 100)))
                    : 0;
                  const appointmentData = {
                    user_id,
                    service_id: requestedServiceIds[0],
                    staff_id: finalStaffId,
                    appointment_date,
                    appointment_time: normalizedAppointmentTime,
                    end_time: requestedEndTime,
                    status: 'pending',
                    notes: notes || '',
                    total_amount: finalTotal,
                    original_amount: totalPrice,
                    voucher_discount: discountAmount,
                    voucher_codes: voucherResult?.voucher?.code || null,
                    cancellation_score: Number(cancellationScore.score || 0),
                    cancellation_risk: cancellationScore.riskLevel || 'low',
                    deposit_required: depositRequired,
                    deposit_amount: depositAmount,
                    selected_services: orderedServices
                  };

                  return appointmentModel.createAppointment(appointmentData, async (createErr, result) => {
                    if (createErr) {
                      return res.status(500).json({ success: false, message: 'Lỗi server', error: createErr });
                    }

                    if (voucherResult) {
                      try {
                        await voucherService.recordVoucherUsage(
                          voucherResult.voucher.id,
                          voucherResult.assignment.id,
                          user_id,
                          result.insertId,
                          discountAmount
                        );
                      } catch (recordErr) {
                        return res.status(500).json({
                          success: false,
                          message: 'Đã tạo lịch hẹn nhưng không ghi được lịch sử voucher',
                          appointmentId: result.insertId
                        });
                      }
                    }

                    emitDashboardUpdate(req, 'appointment.created', {
                      appointmentId: result.insertId,
                      totalAmount: finalTotal,
                      staffId: finalStaffId,
                      userId: user_id
                    });

                    return res.status(201).json({
                      success: true,
                      message: 'Đặt lịch thành công',
                      appointmentId: result.insertId,
                      totalAmount: finalTotal,
                      originalAmount: totalPrice,
                      voucherDiscount: discountAmount,
                      voucherCode: voucherResult?.voucher?.code || null,
                      cancellationScore,
                      depositRequired,
                      depositAmount,
                      autoAssigned: parsedStaffId === null,
                      staffName: staff.name,
                      meta: {
                        selected_service_ids: requestedServiceIds,
                        total_duration: totalDuration,
                        end_time: requestedEndTime
                      }
                    });
                  });
                };

                return finishCreateAppointment();
              }
            );
          }
        );
      });
    };

    if (parsedStaffId !== null) {
      return proceedWithStaff(parsedStaffId);
    }

    // Auto-assign: pick a random available staff member
    return staffModel.getAutoAssignableStaff(
      appointment_date,
      normalizedAppointmentTime,
      requestedEndTime,
      (autoErr, autoStaff) => {
        if (autoErr) {
          return res.status(500).json({ success: false, message: 'Lỗi server', error: autoErr });
        }

        if (!autoStaff) {
          return res.status(400).json({
            success: false,
            message: 'Không còn nhân viên nào trống trong khung giờ này. Vui lòng chọn giờ khác.'
          });
        }

        return proceedWithStaff(autoStaff.id);
      }
    );
  });
};

exports.getMyAppointments = (req, res) => {
  const { role } = req.user;

  if (role === 'staff') {
    appointmentModel.getAppointmentsByStaffId(req.user.id, (err, appointments) => {
      if (err) {
        return res.status(500).json({ success: false, message: 'Lỗi server', error: err });
      }

      return res.status(200).json({ success: true, data: appointments });
    });
  } else {
    appointmentModel.getAppointmentsByUserId(req.user.id, (err, appointments) => {
      if (err) {
        return res.status(500).json({ success: false, message: 'Lỗi server', error: err });
      }

      return res.status(200).json({ success: true, data: appointments });
    });
  }
};

exports.getAllAppointments = (req, res) => {
  const callback = (err, appointments) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Lỗi server', error: err });
    }

    return res.status(200).json({ success: true, data: appointments });
  };

  const run = () => {
    if (req.user.role === 'staff') {
      if (isCashierStaffUser(req.user)) {
        return appointmentModel.getAllAppointments(callback);
      }
      return appointmentModel.getAppointmentsByStaffId(req.user.id, callback);
    }

    return appointmentModel.getAllAppointments(callback);
  };

  if (req.user.role === 'staff' && typeof req.user.staff_role_name === 'undefined') {
    return staffModel.getStaffRoleNameByUserId(req.user.id, (roleErr, roleName) => {
      if (!roleErr) {
        req.user.staff_role_name = roleName;
      }
      return run();
    });
  }

  return run();
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

      if (status === 'cancelled') {
        appointmentModel.refreshCustomerCancellationCount(appointment.user_id, (refreshErr) => {
          if (refreshErr) {
            console.error('[REFRESH_CANCELLATION_COUNT_ERROR]', refreshErr);
          }
        });
      }

      emitDashboardUpdate(req, 'appointment.status_updated', {
        appointmentId: Number(id),
        status,
        userId: appointment.user_id,
        staffId: appointment.staff_id
      });

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

        appointmentModel.refreshCustomerCancellationCount(appointment.user_id, (refreshErr) => {
          if (refreshErr) {
            console.error('[REFRESH_CANCELLATION_COUNT_ERROR]', refreshErr);
          }
        });
        emitDashboardUpdate(req, 'appointment.cancelled', {
          appointmentId: Number(id),
          userId: appointment.user_id,
          staffId: appointment.staff_id
        });

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
      return res.status(400).json({ success: false, message: 'Lịch hẹn này đã bị hủy truoc do' });
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

      emitDashboardUpdate(req, 'appointment.cancel_requested', {
        appointmentId: Number(id),
        userId: appointment.user_id,
        staffId: appointment.staff_id
      });

      return res.status(200).json({
        success: true,
        message: 'Đã gửi yêu cầu hủy. Nhân viên sẽ xác nhận sớm nhất có thể.'
      });
    });
  });
};

exports.requestCancellationByStaff = (req, res) => {
  const { id } = req.params;
  const currentUser = req.user;

  appointmentModel.getAppointmentById(id, (err, appointment) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Lỗi server', error: err });
    }

    if (!appointment) {
      return res.status(404).json({ success: false, message: 'Lịch hẹn không tồn tại' });
    }

    if (currentUser.role !== 'staff' || !canManageAppointment(appointment, currentUser)) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền gửi yêu cầu hủy lịch này'
      });
    }

    if (appointment.status === 'cancelled') {
      return res.status(400).json({ success: false, message: 'Lịch hẹn này đã bị hủy truoc do' });
    }

    if (appointment.status === 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Không thể gửi yêu cầu hủy cho lịch đã hoàn thành'
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

      emitDashboardUpdate(req, 'appointment.cancel_requested', {
        appointmentId: Number(id),
        userId: appointment.user_id,
        staffId: appointment.staff_id
      });

      return res.status(200).json({
        success: true,
        message: 'Đã gửi yêu cầu hủy. Admin hoặc thu ngân sẽ xác nhận sớm nhất có thể.'
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

      appointmentModel.refreshCustomerCancellationCount(appointment.user_id, (refreshErr) => {
        if (refreshErr) {
          console.error('[REFRESH_CANCELLATION_COUNT_ERROR]', refreshErr);
        }
      });
      emitDashboardUpdate(req, 'appointment.cancelled', {
        appointmentId: Number(id),
        userId: appointment.user_id,
        staffId: appointment.staff_id
      });

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

      emitDashboardUpdate(req, 'appointment.cancel_rejected', {
        appointmentId: Number(id),
        userId: appointment.user_id,
        staffId: appointment.staff_id
      });

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
