const appointmentModel = require('../../models/appointmentModel');
const serviceModel = require('../../models/serviceModel');
const staffModel = require('../../models/staffModel');
const { normalizeTimeString, addMinutesToTimeString, toShortTimeString } = require('../../utils/timeSlot');
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
  const { service_id, selected_service_ids, staff_id, appointment_date, appointment_time, notes } = req.body;
  const user_id = req.user.id;
  const requestedServiceIds = normalizeSelectedServiceIds(selected_service_ids, service_id);

  if (requestedServiceIds.length === 0 || !appointment_date || !appointment_time) {
    return res.status(400).json({
      success: false,
      message: 'Vui long cung cap day du thong tin'
    });
  }

  const parsedStaffId = staff_id ? Number(staff_id) : null;
  if (parsedStaffId !== null && (!Number.isInteger(parsedStaffId) || parsedStaffId <= 0)) {
    return res.status(400).json({
      success: false,
      message: 'staff_id khong hop le'
    });
  }

  const normalizedAppointmentTime = normalizeTimeString(appointment_time);
  if (!normalizedAppointmentTime) {
    return res.status(400).json({
      success: false,
      message: 'Gio hen khong hop le'
    });
  }

  serviceModel.getServicesByIds(requestedServiceIds, (serviceErr, services) => {
    if (serviceErr) {
      return res.status(500).json({ success: false, message: 'Loi server', error: serviceErr });
    }

    if (!services || services.length !== requestedServiceIds.length) {
      return res.status(404).json({ success: false, message: 'Co dich vu khong ton tai' });
    }

    const serviceById = new Map(services.map((service) => [Number(service.id), service]));
    const orderedServices = requestedServiceIds.map((id) => serviceById.get(Number(id))).filter(Boolean);
    const hasInactiveService = orderedServices.some((service) => service.status !== 'active');

    if (hasInactiveService) {
      return res.status(400).json({
        success: false,
        message: 'Co dich vu hien khong con hoat dong'
      });
    }

    const { totalDuration, totalPrice } = summarizeSelectedServices(orderedServices);
    const requestedEndTime = addMinutesToTimeString(normalizedAppointmentTime, totalDuration);

    if (!requestedEndTime) {
      return res.status(400).json({
        success: false,
        message: 'Khung gio dat lich khong hop le cho dich vu nay'
      });
    }

    const proceedWithStaff = (finalStaffId) => {
      staffModel.getStaffById(finalStaffId, (staffErr, staff) => {
        if (staffErr) {
          return res.status(500).json({ success: false, message: 'Loi server', error: staffErr });
        }

        if (!staff || !staff.is_active) {
          return res.status(400).json({
            success: false,
            message: 'Nhan vien khong ton tai hoac dang bi khoa'
          });
        }

        if (staffModel.isStaffRoleExcludedFromCustomerBooking(staff.role_name)) {
          return res.status(400).json({
            success: false,
            message: 'Nhan vien thu ngan khong the duoc chon khi dat dich vu. Vui long chon nhan vien khac.'
          });
        }

        appointmentModel.checkTimeConflict(
          finalStaffId,
          appointment_date,
          normalizedAppointmentTime,
          requestedEndTime,
          (conflictErr, conflictInfo) => {
            if (conflictErr) {
              return res.status(500).json({ success: false, message: 'Loi server', error: conflictErr });
            }

            if (conflictInfo) {
              return res.status(400).json({
                success: false,
                message: `Nhan vien da duoc dat tu ${toShortTimeString(conflictInfo.busy_start_time)} den ${toShortTimeString(
                  conflictInfo.busy_end_time
                )}. Vui long chon gio khac hoac doi nhan vien khac.`,
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
                  return res.status(500).json({ success: false, message: 'Loi server', error: scheduleErr });
                }

                if (!withinSchedule) {
                  return res.status(400).json({
                    success: false,
                    message:
                      'Nhan vien khong lam viec trong toan bo khung gio da chon. Vui long doi nhan vien khac hoac chon gio khac.'
                  });
                }

                const appointmentData = {
                  user_id,
                  service_id: requestedServiceIds[0],
                  staff_id: finalStaffId,
                  appointment_date,
                  appointment_time: normalizedAppointmentTime,
                  end_time: requestedEndTime,
                  status: 'pending',
                  notes: notes || '',
                  total_amount: totalPrice,
                  selected_services: orderedServices
                };

                appointmentModel.createAppointment(appointmentData, (createErr, result) => {
                  if (createErr) {
                    return res.status(500).json({ success: false, message: 'Loi server', error: createErr });
                  }

                  return res.status(201).json({
                    success: true,
                    message: 'Dat lich thanh cong',
                    appointmentId: result.insertId,
                    totalAmount: totalPrice,
                    autoAssigned: parsedStaffId === null,
                    staffName: staff.name,
                    meta: {
                      selected_service_ids: requestedServiceIds,
                      total_duration: totalDuration,
                      end_time: requestedEndTime
                    }
                  });
                });
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
          return res.status(500).json({ success: false, message: 'Loi server', error: autoErr });
        }

        if (!autoStaff) {
          return res.status(400).json({
            success: false,
            message: 'Khong con nhan vien nao trong trong khung gio nay. Vui long chon gio khac.'
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
        return res.status(500).json({ success: false, message: 'Loi server', error: err });
      }

      return res.status(200).json({ success: true, data: appointments });
    });
  } else {
    appointmentModel.getAppointmentsByUserId(req.user.id, (err, appointments) => {
      if (err) {
        return res.status(500).json({ success: false, message: 'Loi server', error: err });
      }

      return res.status(200).json({ success: true, data: appointments });
    });
  }
};

exports.getAllAppointments = (req, res) => {
  const callback = (err, appointments) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Loi server', error: err });
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
      return res.status(500).json({ success: false, message: 'Loi server', error: err });
    }

    if (!appointment) {
      return res.status(404).json({ success: false, message: 'Lich hen khong ton tai' });
    }

    if (!canManageAppointment(appointment, req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Ban khong co quyen xem lich hen nay'
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
      message: 'Vui long cung cap trang thai'
    });
  }

  appointmentModel.getAppointmentById(id, (err, appointment) => {
    if (err) {
      console.error('[UPDATE_APPOINTMENT_ERROR]', err);
      return res.status(500).json({ success: false, message: 'Loi server' });
    }

    if (!appointment) {
      return res.status(404).json({ success: false, message: 'Lich hen khong ton tai' });
    }

    if (!canManageAppointment(appointment, req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Ban khong co quyen cap nhat lich hen nay'
      });
    }

    appointmentModel.updateAppointmentStatus(id, status, (updateErr) => {
      if (updateErr) {
        console.error('[UPDATE_APPOINTMENT_STATUS_ERROR]', updateErr);
        return res.status(500).json({
          success: false,
          message: 'Loi server khi cap nhat trang thai'
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Cap nhat trang thai thanh cong'
      });
    });
  });
};

exports.cancelAppointment = (req, res) => {
  const { id } = req.params;
  const currentUser = req.user;

  appointmentModel.getAppointmentById(id, (err, appointment) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Loi server', error: err });
    }

    if (!appointment) {
      return res.status(404).json({ success: false, message: 'Lich hen khong ton tai' });
    }

    if (currentUser.role === 'admin') {
      return appointmentModel.cancelAppointment(id, (cancelErr) => {
        if (cancelErr) {
          return res.status(500).json({ success: false, message: 'Loi server', error: cancelErr });
        }

        return res.status(200).json({ success: true, message: 'Da huy lich hen thanh cong' });
      });
    }

    if (Number(appointment.user_id) !== Number(currentUser.id)) {
      return res.status(403).json({
        success: false,
        message: 'Ban khong co quyen gui yeu cau huy lich nay'
      });
    }

    if (appointment.status === 'cancelled') {
      return res.status(400).json({ success: false, message: 'Lich hen nay da bi huy truoc do' });
    }

    if (appointment.status === 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Khong the huy lich da hoan thanh'
      });
    }

    if (!CUSTOMER_CANCELLABLE_STATUSES.has(appointment.status)) {
      return res.status(400).json({
        success: false,
        message: 'Chi co the gui yeu cau huy khi lich dang cho xac nhan hoac da xac nhan'
      });
    }

    if (Number(appointment.cancellation_requested) === 1) {
      return res.status(400).json({
        success: false,
        message: 'Yeu cau huy lich nay da duoc gui truoc do'
      });
    }

    return appointmentModel.requestAppointmentCancellation(id, (requestErr) => {
      if (requestErr) {
        return res.status(500).json({ success: false, message: 'Loi server', error: requestErr });
      }

      return res.status(200).json({
        success: true,
        message: 'Da gui yeu cau huy. Nhan vien se xac nhan som nhat co the.'
      });
    });
  });
};

exports.requestCancellationByStaff = (req, res) => {
  const { id } = req.params;
  const currentUser = req.user;

  appointmentModel.getAppointmentById(id, (err, appointment) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Loi server', error: err });
    }

    if (!appointment) {
      return res.status(404).json({ success: false, message: 'Lich hen khong ton tai' });
    }

    if (currentUser.role !== 'staff' || !canManageAppointment(appointment, currentUser)) {
      return res.status(403).json({
        success: false,
        message: 'Ban khong co quyen gui yeu cau huy lich nay'
      });
    }

    if (appointment.status === 'cancelled') {
      return res.status(400).json({ success: false, message: 'Lich hen nay da bi huy truoc do' });
    }

    if (appointment.status === 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Khong the gui yeu cau huy cho lich da hoan thanh'
      });
    }

    if (!CUSTOMER_CANCELLABLE_STATUSES.has(appointment.status)) {
      return res.status(400).json({
        success: false,
        message: 'Chi co the gui yeu cau huy khi lich dang cho xac nhan hoac da xac nhan'
      });
    }

    if (Number(appointment.cancellation_requested) === 1) {
      return res.status(400).json({
        success: false,
        message: 'Yeu cau huy lich nay da duoc gui truoc do'
      });
    }

    return appointmentModel.requestAppointmentCancellation(id, (requestErr) => {
      if (requestErr) {
        return res.status(500).json({ success: false, message: 'Loi server', error: requestErr });
      }

      return res.status(200).json({
        success: true,
        message: 'Da gui yeu cau huy. Admin hoac thu ngan se xac nhan som nhat co the.'
      });
    });
  });
};

exports.confirmCancellationRequest = (req, res) => {
  const { id } = req.params;

  appointmentModel.getAppointmentById(id, (err, appointment) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Loi server', error: err });
    }

    if (!appointment) {
      return res.status(404).json({ success: false, message: 'Lich hen khong ton tai' });
    }

    if (!canManageAppointment(appointment, req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Ban khong co quyen xac nhan huy lich hen nay'
      });
    }

    if (appointment.status === 'cancelled') {
      return res.status(400).json({ success: false, message: 'Lich hen nay da bi huy' });
    }

    if (appointment.status === 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Khong the xac nhan huy lich da hoan thanh'
      });
    }

    if (Number(appointment.cancellation_requested) !== 1) {
      return res.status(400).json({
        success: false,
        message: 'Lich hen nay chua co yeu cau huy can xac nhan'
      });
    }

    return appointmentModel.cancelAppointment(id, (cancelErr) => {
      if (cancelErr) {
        return res.status(500).json({ success: false, message: 'Loi server', error: cancelErr });
      }

      return res.status(200).json({
        success: true,
        message: 'Da xac nhan huy lich hen'
      });
    });
  });
};

exports.rejectCancellationRequest = (req, res) => {
  const { id } = req.params;

  appointmentModel.getAppointmentById(id, (err, appointment) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Loi server', error: err });
    }

    if (!appointment) {
      return res.status(404).json({ success: false, message: 'Lich hen khong ton tai' });
    }

    if (!canManageAppointment(appointment, req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Ban khong co quyen xu ly yeu cau huy cua lich hen nay'
      });
    }

    if (appointment.status === 'cancelled') {
      return res.status(400).json({ success: false, message: 'Lich hen nay da bi huy' });
    }

    if (Number(appointment.cancellation_requested) !== 1) {
      return res.status(400).json({
        success: false,
        message: 'Lich hen nay khong co yeu cau huy dang cho xu ly'
      });
    }

    return appointmentModel.clearAppointmentCancellationRequest(id, (clearErr) => {
      if (clearErr) {
        return res.status(500).json({ success: false, message: 'Loi server', error: clearErr });
      }

      return res.status(200).json({
        success: true,
        message: 'Da giu lai lich hen va dong yeu cau huy'
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
    return res.status(400).json({ success: false, message: 'Diem danh gia phai tu 1 den 5' });
  }

  appointmentModel.addStaffReview(id, user_id, parsedRating, review || '', (err, result) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Loi server', error: err });
    }

    if (!result || result.affectedRows === 0) {
      return res.status(400).json({
        success: false,
        message: 'Chi co the danh gia lich da hoan thanh va chua duoc danh gia'
      });
    }

    return res.status(200).json({ success: true, message: 'Danh gia nhan vien thanh cong' });
  });
};
