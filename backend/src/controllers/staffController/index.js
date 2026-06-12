const bcrypt = require('bcryptjs');
const staffModel = require('../../models/staffModel');
const userModel = require('../../models/userModel');
const serviceModel = require('../../models/serviceModel');
const {
  normalizeTimeString: normalizeApiTimeString,
  addMinutesToTimeString
} = require('../../utils/timeSlot');
const {
  normalizeSelectedServiceIds,
  summarizeSelectedServices
} = require('../../utils/appointmentServices');
const { emitDashboardUpdate } = require('../../utils/realtime');

const parseActiveValue = (value) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === '1' || normalized === 'true') return true;
    if (normalized === '0' || normalized === 'false') return false;
  }
  return null;
};

exports.getAllStaff = (req, res) => {
  staffModel.getAllStaff((err, staffList) => {
    if (err) {
      return res.status(500).json({ message: 'Lỗi server', error: err });
    }

    return res.status(200).json({ success: true, data: staffList });
  });
};

exports.getBookableStaff = (req, res) => {
  staffModel.getBookableStaff((err, staffList) => {
    if (err) {
      return res.status(500).json({ message: 'Lỗi server', error: err });
    }

    return res.status(200).json({ success: true, data: staffList });
  });
};

exports.getAvailableStaff = (req, res) => {
  const { date, time, serviceId, serviceIds, selected_service_ids } = req.query;
  const requestedServiceIds = normalizeSelectedServiceIds(selected_service_ids, serviceIds, serviceId);

  if (!date || !time || requestedServiceIds.length === 0) {
    return res.status(400).json({ message: 'Vui lòng cung cấp ngày, giờ và dịch vụ' });
  }

  const normalizedTime = normalizeApiTimeString(time);
  if (!normalizedTime) {
    return res.status(400).json({ message: 'Giờ hẹn không hợp lệ' });
  }

  serviceModel.getServicesByIds(requestedServiceIds, (serviceErr, services) => {
    if (serviceErr) {
      return res.status(500).json({ message: 'Lỗi server', error: serviceErr });
    }

    if (!services || services.length !== requestedServiceIds.length) {
      return res.status(404).json({ message: 'Có dịch vụ không tồn tại' });
    }

    const serviceById = new Map(services.map((service) => [Number(service.id), service]));
    const orderedServices = requestedServiceIds.map((id) => serviceById.get(Number(id))).filter(Boolean);
    const hasInactiveService = orderedServices.some((service) => service.status !== 'active');

    if (hasInactiveService) {
      return res.status(400).json({ message: 'Có dịch vụ hiện không còn hoạt động' });
    }

    const { totalDuration } = summarizeSelectedServices(orderedServices);
    const requestedEndTime = addMinutesToTimeString(normalizedTime, totalDuration);
    if (!requestedEndTime) {
      return res.status(400).json({ message: 'Khung giờ đặt lịch không hợp lệ cho dịch vụ này' });
    }

    staffModel.getAvailableStaff(date, normalizedTime, requestedEndTime, totalDuration, (err, availability) => {
      if (err) {
        return res.status(500).json({ message: 'Lỗi server', error: err });
      }

      return res.status(200).json({
        success: true,
        data: availability.availableStaff,
        meta: {
          requested_service_ids: requestedServiceIds,
          requested_start_time: normalizedTime,
          requested_end_time: requestedEndTime,
          total_duration: totalDuration,
          max_daily_staff_minutes: staffModel.getMaxDailyStaffMinutes(),
          unavailable_staff: availability.unavailableStaff
        }
      });
    });
  });
};

exports.getBusyTimeSlots = (req, res) => {
  const { id } = req.params;
  const { date } = req.query;

  if (!date) {
    return res.status(400).json({ success: false, message: 'Vui lòng cung cấp ngày cần xem lịch bận' });
  }

  return staffModel.getStaffById(id, (staffErr, staff) => {
    if (staffErr) {
      return res.status(500).json({ success: false, message: 'Lỗi server', error: staffErr });
    }

    if (!staff || !staff.is_active) {
      return res.status(404).json({ success: false, message: 'Nhân viên không tồn tại hoặc đang bị khóa' });
    }

    return staffModel.getBusyTimeSlots(id, date, (busyErr, busySlots) => {
      if (busyErr) {
        return res.status(500).json({ success: false, message: 'Lỗi server', error: busyErr });
      }

      return res.status(200).json({
        success: true,
        data: busySlots || []
      });
    });
  });
};

exports.getAllStaffRoles = (req, res) => {
  staffModel.getAllStaffRoles((err, roleList) => {
    if (err) {
      return res.status(500).json({ message: 'Lỗi server', error: err });
    }

    return res.status(200).json({ success: true, data: roleList });
  });
};

exports.createStaffRole = (req, res) => {
  const { role_name } = req.body;
  const normalizedRole = (role_name || '').trim();

  if (!normalizedRole) {
    return res.status(400).json({ message: 'Vui lòng nhập tên vai trò' });
  }

  return staffModel.createStaffRole(normalizedRole, (err, result) => {
    if (err) {
      return res.status(500).json({ message: 'Lỗi server', error: err });
    }

    return res.status(201).json({
      success: true,
      message: 'Tạo vai trò thành công',
      roleId: result.insertId
    });
  });
};

exports.createStaff = (req, res) => {
  const { name, email, password, phone, staff_role_id, is_active } = req.body;

  if (!name || !email || !password || typeof staff_role_id === 'undefined') {
    return res.status(400).json({ message: 'Vui lòng cung cấp đầy đủ thông tin' });
  }

  const parsedRoleId = Number(staff_role_id);
  if (!Number.isInteger(parsedRoleId) || parsedRoleId < 0) {
    return res.status(400).json({ message: 'Vai trò không hợp lệ' });
  }

  userModel.getUserByEmail(email, async (err, existingUser) => {
    if (err) {
      return res.status(500).json({ message: 'Lỗi server', error: err });
    }

    if (existingUser) {
      return res.status(400).json({ message: 'Email đã tồn tại' });
    }

    const activeValue =
      typeof is_active === 'undefined' ? true : parseActiveValue(is_active);

    if (activeValue === null) {
      return res.status(400).json({ message: 'Trạng thái hoạt động không hợp lệ' });
    }

    let hashedPassword = '';
    try {
      hashedPassword = await bcrypt.hash(password, 10);
    } catch (hashErr) {
      return res.status(500).json({ message: 'Lỗi server', error: hashErr });
    }

    return staffModel.getStaffRoleById(parsedRoleId, (roleErr, role) => {
      if (roleErr) {
        return res.status(500).json({ message: 'Lỗi server', error: roleErr });
      }

      if (!role) {
        return res.status(400).json({ message: 'Vai trò không tồn tại' });
      }

      return staffModel.createStaff(
        {
          name,
          email,
          password: hashedPassword,
          phone: phone || '',
          staff_role_id: parsedRoleId,
          is_active: activeValue
        },
        (createErr, result) => {
          if (createErr) {
            return res.status(500).json({ message: 'Lỗi server', error: createErr });
          }

          return res.status(201).json({
            success: true,
            message: 'Tạo nhân viên thành công',
            staffId: result.insertId
          });
        }
      );
    });
  });
};

const normalizeTimeString = (value) => {
  if (value === null || typeof value === 'undefined') {
    return null;
  }
  const raw = String(value).trim();
  if (/^\d{1,2}:\d{2}$/.test(raw)) {
    const [h, m] = raw.split(':').map((part) => Number(part));
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
    }
  }
  if (/^\d{1,2}:\d{2}:\d{2}$/.test(raw)) {
    return raw;
  }
  return null;
};

const getAllowedShiftWindows = (day) => {
  if (day >= 0 && day <= 4) {
    return [
      { type: 'morning', start: '08:00:00', end: '16:00:00', label: 'ca sáng 08:00-16:00' },
      { type: 'evening', start: '13:30:00', end: '21:00:00', label: 'ca tối 13:30-21:00' },
      { type: 'full', start: '08:00:00', end: '21:00:00', label: 'full ca 08:00-21:00' }
    ];
  }

  return [
    { type: 'morning', start: '07:00:00', end: '15:00:00', label: 'ca sáng 07:00-15:00' },
    { type: 'evening', start: '15:00:00', end: '23:00:00', label: 'ca tối 15:00-23:00' },
    { type: 'full', start: '07:00:00', end: '23:00:00', label: 'full ca 07:00-23:00' }
  ];
};

const WEEKDAY_LABELS = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'];

const normalizeWeeklyAvailabilitySlots = (slots) => {
  if (!Array.isArray(slots)) {
    return { error: 'slots phải là mảng' };
  }

  if (slots.length !== 7) {
    return { error: 'Lịch tuần cần đủ 7 ngày từ Thứ 2 đến Chủ nhật. Ngày nghỉ xử lý bằng yêu cầu xin nghỉ phép.' };
  }

  const daysSeen = new Set();
  const normalized = [];
  const minutesByDay = new Map();
  const maxDailyMinutes = staffModel.getMaxDailyStaffMinutes();

  for (let i = 0; i < slots.length; i += 1) {
    const row = slots[i] || {};
    const day = Number(row.day_of_week);
    const start = normalizeTimeString(row.start_time);
    const end = normalizeTimeString(row.end_time);

    if (!Number.isInteger(day) || day < 0 || day > 6) {
      return { error: 'day_of_week phải từ 0 đến 6' };
    }

    if (daysSeen.has(day)) {
      return { error: 'Mỗi ngày chỉ được phép đăng ký tối đa 1 ca làm việc' };
    }
    daysSeen.add(day);

    if (!start || !end) {
      return { error: 'Giờ bắt đầu / kết thúc không hợp lệ' };
    }

    if (start >= end) {
      return { error: 'Giờ kết thúc phải sau giờ bắt đầu' };
    }

    const allowedShift = getAllowedShiftWindows(day).find(
      (shift) => shift.start === start && shift.end === end
    );

    if (!allowedShift) {
      const allowedLabels = getAllowedShiftWindows(day).map((shift) => shift.label).join(' hoặc ');
      return { error: `${WEEKDAY_LABELS[day]} chỉ được chọn ${allowedLabels}` };
    }

    const [startHour, startMinute] = start.split(':').map(Number);
    const [endHour, endMinute] = end.split(':').map(Number);
    const slotMinutes = endHour * 60 + endMinute - (startHour * 60 + startMinute);
    const nextDayMinutes = (minutesByDay.get(day) || 0) + slotMinutes;

    if (allowedShift.type !== 'full' && nextDayMinutes > maxDailyMinutes) {
      return {
        error: `Tổng giờ làm trong một ngày không được vượt quá ${Math.round(maxDailyMinutes / 60)} giờ`
      };
    }

    minutesByDay.set(day, nextDayMinutes);
    normalized.push({ day_of_week: day, start_time: start, end_time: end });
  }

  return { slots: normalized };
};

const loadPersonnelOr404 = (id, res, callback) => {
  staffModel.getStaffOrAdminById(id, (err, person) => {
    if (err) {
      return res.status(500).json({ message: 'Lỗi server', error: err });
    }

    if (!person) {
      return res.status(404).json({ message: 'Nhân sự không tồn tại' });
    }

    return callback(person);
  });
};

exports.getWeeklyAvailability = (req, res) => {
  const { id } = req.params;

  staffModel.getStaffOrAdminById(id, (err, staff) => {
    if (err) {
      return res.status(500).json({ message: 'Lỗi server', error: err });
    }

    if (!staff) {
      return res.status(404).json({ message: 'Nhân viên không tồn tại' });
    }

    return staffModel.getWeeklyAvailabilityByStaffId(id, (loadErr, rows) => {
      if (loadErr) {
        return res.status(500).json({ message: 'Lỗi server', error: loadErr });
      }

      return res.status(200).json({ success: true, data: rows });
    });
  });
};

exports.replaceWeeklyAvailability = (req, res) => {
  const { id } = req.params;
  const { slots } = req.body;

  if (!Array.isArray(slots)) {
    return res.status(400).json({ message: 'slots phải là mảng' });
  }

  staffModel.getStaffOrAdminById(id, (err, staff) => {
    if (err) {
      return res.status(500).json({ message: 'Lỗi server', error: err });
    }

    if (!staff) {
      return res.status(404).json({ message: 'Nhân viên không tồn tại' });
    }

    const normalized = normalizeWeeklyAvailabilitySlots(slots);

    if (normalized.error) {
      return res.status(400).json({ message: normalized.error });
    }

    return staffModel.replaceWeeklyAvailability(id, normalized.slots, (saveErr) => {
      if (saveErr) {
        return res.status(500).json({ message: 'Lỗi server', error: saveErr });
      }

      return res.status(200).json({
        success: true,
        message: 'Đã lưu lịch làm việc hàng tuần'
      });
    });
  });
};

exports.getMyWeeklyAvailability = (req, res) => {
  if (!['staff', 'admin'].includes(req.user.role)) {
    return res.status(403).json({ message: 'Bạn không có quyền đăng ký ca làm' });
  }

  return staffModel.getWeeklyAvailabilityByStaffId(req.user.id, (err, rows) => {
    if (err) {
      return res.status(500).json({ message: 'Lỗi server', error: err });
    }

    return res.status(200).json({ success: true, data: rows });
  });
};

exports.replaceMyWeeklyAvailability = (req, res) => {
  if (!['staff', 'admin'].includes(req.user.role)) {
    return res.status(403).json({ message: 'Bạn không có quyền đăng ký ca làm' });
  }

  const normalized = normalizeWeeklyAvailabilitySlots(req.body.slots);

  if (normalized.error) {
    return res.status(400).json({ message: normalized.error });
  }

  return staffModel.replaceWeeklyAvailability(req.user.id, normalized.slots, (err) => {
    if (err) {
      return res.status(500).json({ message: 'Lỗi server', error: err });
    }

    return res.status(200).json({ success: true, message: 'Đã đăng ký ca làm' });
  });
};

exports.startWork = (req, res) => {
  if (req.user.role !== 'staff') {
    return res.status(403).json({ success: false, message: 'Chỉ nhân viên mới có thể xác nhận bắt đầu làm' });
  }

  return staffModel.confirmPendingAppointmentsForStaff(req.user.id, (err, result) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Lỗi server', error: err });
    }

    const confirmedAppointments = result.appointments || [];

    emitDashboardUpdate(req, 'staff.work_started', {
      staffId: req.user.id,
      confirmedCount: Number(result.affectedRows || 0)
    });

    confirmedAppointments.forEach((appointment) => {
      emitDashboardUpdate(req, 'appointment.auto_confirmed', {
        appointmentId: appointment.id,
        status: 'confirmed',
        userId: appointment.user_id,
        staffId: appointment.staff_id,
        serviceName: appointment.service_name,
        staffName: appointment.staff_name,
        customerName: appointment.customer_name,
        appointmentDate: appointment.appointment_date,
        appointmentTime: appointment.appointment_time
      });
    });

    return res.status(200).json({
      success: true,
      message:
        confirmedAppointments.length > 0
          ? `Đã xác nhận ${confirmedAppointments.length} lịch hẹn được giao.`
          : 'Không có lịch hẹn mới cần xác nhận.',
      data: {
        confirmed_count: confirmedAppointments.length,
        appointments: confirmedAppointments
      }
    });
  });
};

exports.updateStaff = (req, res) => {
  const { id } = req.params;
  const { name, phone, is_active, password, staff_role_id } = req.body;

  if (
    typeof name === 'undefined' &&
    typeof phone === 'undefined' &&
    typeof is_active === 'undefined' &&
    typeof password === 'undefined' &&
    typeof staff_role_id === 'undefined'
  ) {
    return res.status(400).json({ message: 'Không có dữ liệu để cập nhật' });
  }

  staffModel.getStaffById(id, async (err, staff) => {
    if (err) {
      return res.status(500).json({ message: 'Lỗi server', error: err });
    }

    if (!staff) {
      return res.status(404).json({ message: 'Nhân viên không tồn tại' });
    }

    const payload = {};
    if (typeof name !== 'undefined') payload.name = name;
    if (typeof phone !== 'undefined') payload.phone = phone;

    if (typeof password !== 'undefined') {
      if (typeof password !== 'string' || password.trim().length === 0) {
        return res.status(400).json({ message: 'Mật khẩu mới không được để trống' });
      }

      if (password.length < 6) {
        return res.status(400).json({ message: 'Mật khẩu mới phải có ít nhất 6 ký tự' });
      }

      try {
        payload.password = await bcrypt.hash(password, 10);
      } catch (hashErr) {
        return res.status(500).json({ message: 'Lỗi server', error: hashErr });
      }
    }

    if (typeof is_active !== 'undefined') {
      const activeValue = parseActiveValue(is_active);
      if (activeValue === null) {
        return res.status(400).json({ message: 'Trạng thái hoạt động không hợp lệ' });
      }
      payload.is_active = activeValue;
    }

    const finishUpdate = () =>
      staffModel.updateStaff(id, payload, (updateErr) => {
        if (updateErr) {
          return res.status(500).json({ message: 'Lỗi server', error: updateErr });
        }

        return res.status(200).json({
        success: true,
        message:
          typeof password !== 'undefined'
            ? 'Cập nhật nhân viên và mật khẩu thành công'
            : 'Cập nhật nhân viên thành công'
        });
      });

    if (typeof staff_role_id !== 'undefined') {
      const parsedRoleId = Number(staff_role_id);
      if (!Number.isInteger(parsedRoleId) || parsedRoleId < 0) {
        return res.status(400).json({ message: 'Vai trò không hợp lệ' });
      }

      return staffModel.getStaffRoleById(parsedRoleId, (roleErr, role) => {
        if (roleErr) {
          return res.status(500).json({ message: 'Lỗi server', error: roleErr });
        }

        if (!role) {
          return res.status(400).json({ message: 'Vai trò không tồn tại' });
        }

        payload.staff_role_id = parsedRoleId;
        return finishUpdate();
      });
    }

    return finishUpdate();
  });
};

exports.requestLeave = (req, res) => {
  const { start_date, end_date, reason } = req.body;
  const staffId = req.user.id;

  if (!start_date || !end_date || !reason) {
    return res.status(400).json({ message: 'Vui lòng cung cấp đầy đủ thông tin' });
  }

  staffModel.createLeaveRequest(staffId, start_date, end_date, reason, (err, result) => {
    if (err) {
      return res.status(500).json({ message: 'Lỗi server', error: err });
    }
    return res.status(201).json({ success: true, message: 'Gửi yêu cầu nghỉ phép thành công', data: { id: result.insertId } });
  });
};

exports.getMyLeaveRequests = (req, res) => {
  const staffId = req.user.id;
  staffModel.getLeaveRequestsByStaff(staffId, (err, results) => {
    if (err) {
      return res.status(500).json({ message: 'Lỗi server', error: err });
    }
    return res.status(200).json({ success: true, data: results });
  });
};

exports.getAllLeaveRequests = (req, res) => {
  staffModel.getAllLeaveRequests((err, results) => {
    if (err) {
      return res.status(500).json({ message: 'Lỗi server', error: err });
    }
    return res.status(200).json({ success: true, data: results });
  });
};

exports.updateLeaveRequestStatus = (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!['approved', 'rejected'].includes(status)) {
    return res.status(400).json({ message: 'Trạng thái không hợp lệ' });
  }

  staffModel.updateLeaveRequestStatus(id, status, (err, result) => {
    if (err) {
      return res.status(500).json({ message: 'Lỗi server', error: err });
    }
    return res.status(200).json({ success: true, message: 'Cập nhật trạng thái thành công' });
  });
};
