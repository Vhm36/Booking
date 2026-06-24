const appointmentModel = require('../../models/appointmentModel');
const serviceModel = require('../../models/serviceModel');
const staffModel = require('../../models/staffModel');
const voucherService = require('../../services/voucherService');
const zaloService = require('../../services/zaloService');
const userModel = require('../../models/userModel');
const { calculateScore: calculateCancellationScore } = require('../../services/cancellationScoreService');
const { getDecCustomerInsights } = require('../../services/decClusteringService');
const { normalizeTimeString, addMinutesToTimeString, toShortTimeString } = require('../../utils/timeSlot');
const { emitDashboardUpdate } = require('../../utils/realtime');
const { runClusteringJob } = require('../../jobs/clusteringJob');
const {
  normalizeSelectedServiceIds,
  summarizeSelectedServices
} = require('../../utils/appointmentServices');
const { calculateDepositAmount, normalizeDepositPercent } = require('../../utils/appointmentDeposit');

const CUSTOMER_CANCELLABLE_STATUSES = new Set(['pending', 'confirmed']);
const AUTOMATION_TRIGGER_STATUSES = new Set(['completed', 'cancelled']);

const getDepositPaidAmount = (appointment) => {
  const depositAmount = Number(appointment?.deposit_amount || 0);
  const explicitPaid = Number(appointment?.deposit_paid_amount || 0);

  if (Number.isFinite(explicitPaid) && explicitPaid > 0) {
    return Math.min(depositAmount, explicitPaid);
  }

  if (appointment?.payment_status === 'paid') {
    return Math.min(depositAmount, Number(appointment?.payment_amount || 0));
  }

  return 0;
};

const hasPaidRequiredDeposit = (appointment) => {
  const required = Number(appointment?.deposit_required) === 1 && Number(appointment?.deposit_amount || 0) > 0;
  if (!required) {
    return true;
  }

  return getDepositPaidAmount(appointment) >= Number(appointment.deposit_amount || 0);
};

const enrichAppointmentsWithCustomerInsights = async (appointments = []) => {
  if (!Array.isArray(appointments) || appointments.length === 0) {
    return appointments;
  }

  const customerIds = [...new Set(
    appointments
      .map((appointment) => Number(appointment.user_id))
      .filter((id) => Number.isInteger(id) && id > 0)
  )];

  if (customerIds.length === 0) {
    return appointments;
  }

  try {
    const insights = await getDecCustomerInsights({ customerIds });
    const insightByCustomerId = new Map(insights.map((insight) => [Number(insight.customer_id), insight]));

    return appointments.map((appointment) => ({
      ...appointment,
      customer_insight: insightByCustomerId.get(Number(appointment.user_id)) || null
    }));
  } catch (insightErr) {
    console.error('[APPOINTMENT_CUSTOMER_INSIGHTS_ERROR]', insightErr.message);
    return appointments.map((appointment) => ({
      ...appointment,
      customer_insight: null
    }));
  }
};

const isCashierStaffUser = (user) =>
  user &&
  user.role === 'staff' &&
  ['thu ngan', 'quan ly'].includes(
    String(user.staff_role_name || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .trim()
      .toLowerCase()
  );

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

exports.getCancellationScore = async (req, res) => {
  try {
    const appointmentDate = req.body.appointment_date || req.body.appointmentDate;
    const appointmentTime = req.body.appointment_time || req.body.appointmentTime;
    const result = await calculateCancellationScore(req.user.id, appointmentDate, appointmentTime);

    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    console.error('[BOOKING_CANCELLATION_SCORE_ERROR]', err);
    return res.status(500).json({
      success: false,
      message: 'Không thể tính điểm rủi ro hủy lịch'
    });
  }
};

const sendZaloStatusNotification = (appointment, status, cancelReason = '') => {
  if (appointment && appointment.customer_phone && (status === 'confirmed' || status === 'cancelled')) {
    const templateId = status === 'confirmed' ? 'booking_confirmed' : 'booking_cancelled';
    zaloService.sendZaloNotification({
      phone: appointment.customer_phone,
      templateId,
      templateData: {
        customerName: appointment.customer_name || 'Khách hàng',
        bookingId: appointment.id,
        time: appointment.appointment_time,
        date: appointment.appointment_date,
        reason: cancelReason || 'Cập nhật từ hệ thống'
      }
    }).catch(zErr => console.error('[ZALO_NOTIFICATION_STATUS_ERROR]', zErr.message));
  }
};

const triggerVoucherAutomation = (req, { appointmentId, status }) => {
  const normalizedStatus = String(status || '').toLowerCase();
  if (!AUTOMATION_TRIGGER_STATUSES.has(normalizedStatus)) {
    return;
  }

  setImmediate(() => {
    runClusteringJob({
      app: req.app,
      trigger: `appointment.${normalizedStatus}`,
      sourceAppointmentId: Number(appointmentId)
    }).catch((automationErr) => {
      console.error('[APPOINTMENT_AUTOMATION_TRIGGER_ERROR]', automationErr.message);
    });
  });
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
                message: `Nhân viên đã được đặt từ ${toShortTimeString(conflictInfo.busy_start_time)} đến ${toShortTimeString(
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

                staffModel.isWithinDailyCapacity(
                  finalStaffId,
                  appointment_date,
                  totalDuration,
                  (capacityErr, capacity) => {
                    if (capacityErr) {
                      return res.status(500).json({ success: false, message: 'Lỗi server', error: capacityErr });
                    }

                    if (!capacity.allowed) {
                      return res.status(400).json({
                        success: false,
                        message: `Nhân viên đã gần đạt giới hạn ${Math.round(
                          capacity.maxDailyMinutes / 60
                        )} giờ/ngày. Vui lòng chọn nhân viên khác hoặc đổi ngày.`,
                        capacity: {
                          booked_minutes: capacity.bookedMinutes,
                          requested_duration: capacity.requestedDuration,
                          projected_minutes: capacity.projectedMinutes,
                          max_daily_minutes: capacity.maxDailyMinutes
                        }
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
                    requireDeposit: true,
                    depositPercent: 20
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

                  const depositPercent = normalizeDepositPercent(cancellationScore.depositPercent || 20);
                  const depositRequired = finalTotal > 0;
                  const depositAmount = depositRequired ? calculateDepositAmount(finalTotal, depositPercent) : 0;
                  cancellationScore = {
                    ...cancellationScore,
                    requireDeposit: depositRequired,
                    depositPercent
                  };
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

                    // Gửi thông báo Zalo ZNS trong nền (không chặn response phản hồi)
                    userModel.getUserById(user_id, (userErr, customer) => {
                      if (!userErr && customer && customer.phone) {
                        zaloService.sendZaloNotification({
                          phone: customer.phone,
                          templateId: 'booking_created',
                          templateData: {
                            customerName: customer.name || 'Khách hàng',
                            time: appointmentData.appointment_time,
                            date: appointmentData.appointment_date,
                            staffName: staff.name
                          }
                        }).catch(zErr => console.error('[ZALO_NOTIFICATION_CREATE_ERROR]', zErr.message));
                      }
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
      totalDuration,
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
    appointmentModel.getAppointmentsByStaffId(req.user.id, async (err, appointments) => {
      if (err) {
        return res.status(500).json({ success: false, message: 'Lỗi server', error: err });
      }

      const enrichedAppointments = await enrichAppointmentsWithCustomerInsights(appointments);
      return res.status(200).json({ success: true, data: enrichedAppointments });
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
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const limit = Math.min(1000, Math.max(1, Number.parseInt(req.query.limit, 10) || 50));
  const status = String(req.query.status || 'all').trim().toLowerCase();
  const dateFrom = String(req.query.date_from || '').trim();
  const dateTo = String(req.query.date_to || '').trim();
  const search = String(req.query.search || '').trim().slice(0, 100);
  const offset = (page - 1) * limit;

  const callback = (err, result) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Lỗi server', error: err });
    }

    const total = Number(result.total || 0);
    return res.status(200).json({
      success: true,
      data: result.appointments,
      stats: result.stats,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit))
      }
    });
  };

  const run = () => {
    const staffId = req.user.role === 'staff' && !isCashierStaffUser(req.user)
      ? req.user.id
      : null;

    return appointmentModel.getAppointmentsPage(
      { staffId, status, dateFrom, dateTo, search, limit, offset },
      callback
    );
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
  const { status, cancelReason } = req.body;

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

    if (['confirmed', 'completed'].includes(String(status).toLowerCase()) && !hasPaidRequiredDeposit(appointment)) {
      return res.status(400).json({
        success: false,
        message: 'Lịch này chưa đặt cọc VietQR nên chưa thể khóa/nhận lịch.'
      });
    }

    appointmentModel.updateAppointmentStatus(
      id,
      status,
      (updateErr) => {
        if (updateErr) {
          console.error('[UPDATE_APPOINTMENT_STATUS_ERROR]', updateErr);
          return res.status(500).json({
            success: false,
            message: 'Lỗi server khi cập nhật trạng thái'
          });
        }

        appointmentModel.refreshCustomerCancellationRate(appointment.user_id, (refreshErr) => {
          if (refreshErr) {
            console.error('[REFRESH_CANCELLATION_RATE_ERROR]', refreshErr);
          }
        });

      emitDashboardUpdate(req, 'appointment.status_updated', {
        appointmentId: Number(id),
        status,
        userId: appointment.user_id,
        staffId: appointment.staff_id
      });
      triggerVoucherAutomation(req, { appointmentId: id, status });

      sendZaloStatusNotification(appointment, status, cancelReason);

        return res.status(200).json({
          success: true,
          message: 'Cập nhật trạng thái thành công'
        });
      },
      cancelReason
    );
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

        appointmentModel.refreshCustomerCancellationRate(appointment.user_id, (refreshErr) => {
          if (refreshErr) {
            console.error('[REFRESH_CANCELLATION_RATE_ERROR]', refreshErr);
          }
        });
        emitDashboardUpdate(req, 'appointment.cancelled', {
          appointmentId: Number(id),
          userId: appointment.user_id,
          staffId: appointment.staff_id
        });
        triggerVoucherAutomation(req, { appointmentId: id, status: 'cancelled' });

        sendZaloStatusNotification(appointment, 'cancelled', 'Hủy bởi quản lý');

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

    return appointmentModel.cancelAppointment(id, (cancelErr) => {
      if (cancelErr) {
        return res.status(500).json({ success: false, message: 'Lỗi server', error: cancelErr });
      }

      appointmentModel.refreshCustomerCancellationRate(appointment.user_id, (refreshErr) => {
        if (refreshErr) {
          console.error('[REFRESH_CANCELLATION_RATE_ERROR]', refreshErr);
        }
      });
      emitDashboardUpdate(req, 'appointment.cancelled', {
        appointmentId: Number(id),
        userId: appointment.user_id,
        staffId: appointment.staff_id
      });
      triggerVoucherAutomation(req, { appointmentId: id, status: 'cancelled' });

      sendZaloStatusNotification(appointment, 'cancelled', 'Khách hàng yêu cầu hủy');

      return res.status(200).json({ success: true, message: 'Đã hủy lịch hẹn thành công' });
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
      return res.status(400).json({ success: false, message: 'Lịch hẹn này đã bị hủy trước đó' });
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
        message: 'Đã gửi yêu cầu hủy. Quản lý hoặc thu ngân sẽ xác nhận sớm nhất có thể.'
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

      appointmentModel.refreshCustomerCancellationRate(appointment.user_id, (refreshErr) => {
        if (refreshErr) {
          console.error('[REFRESH_CANCELLATION_RATE_ERROR]', refreshErr);
        }
      });
      emitDashboardUpdate(req, 'appointment.cancelled', {
        appointmentId: Number(id),
        userId: appointment.user_id,
        staffId: appointment.staff_id
      });
      triggerVoucherAutomation(req, { appointmentId: id, status: 'cancelled' });

      sendZaloStatusNotification(appointment, 'cancelled', 'Yêu cầu hủy được nhân viên xác nhận');

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
