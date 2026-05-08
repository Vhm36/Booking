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
    return res.status(400).json({ message: 'Vui long cung cap ngay, gio va dich vu' });
  }

  const normalizedTime = normalizeApiTimeString(time);
  if (!normalizedTime) {
    return res.status(400).json({ message: 'Gio hen khong hop le' });
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
      return res.status(400).json({ message: 'Co dich vu hien khong con hoat dong' });
    }

    const { totalDuration } = summarizeSelectedServices(orderedServices);
    const requestedEndTime = addMinutesToTimeString(normalizedTime, totalDuration);
    if (!requestedEndTime) {
      return res.status(400).json({ message: 'Khung gio dat lich khong hop le cho dich vu nay' });
    }

    staffModel.getAvailableStaff(date, normalizedTime, requestedEndTime, (err, availability) => {
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
    return res.status(400).json({ success: false, message: 'Vui long cung cap ngay can xem lich ban' });
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
    return res.status(400).json({ message: 'Vui long nhap ten vai tro' });
  }

  return staffModel.createStaffRole(normalizedRole, (err, result) => {
    if (err) {
      return res.status(500).json({ message: 'Lỗi server', error: err });
    }

    return res.status(201).json({
      success: true,
      message: 'Tao vai tro thanh cong',
      roleId: result.insertId
    });
  });
};

exports.createStaff = (req, res) => {
  const { name, email, password, phone, staff_role_id, is_active } = req.body;

  if (!name || !email || !password || typeof staff_role_id === 'undefined') {
    return res.status(400).json({ message: 'Vui long cung cap day du thong tin' });
  }

  const parsedRoleId = Number(staff_role_id);
  if (!Number.isInteger(parsedRoleId) || parsedRoleId < 0) {
    return res.status(400).json({ message: 'Vai tro khong hop le' });
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
      return res.status(400).json({ message: 'is_active khong hop le' });
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

exports.getWeeklyAvailability = (req, res) => {
  const { id } = req.params;

  staffModel.getStaffById(id, (err, staff) => {
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

  staffModel.getStaffById(id, (err, staff) => {
    if (err) {
      return res.status(500).json({ message: 'Lỗi server', error: err });
    }

    if (!staff) {
      return res.status(404).json({ message: 'Nhân viên không tồn tại' });
    }

    const normalized = [];

    for (let i = 0; i < slots.length; i += 1) {
      const row = slots[i] || {};
      const day = Number(row.day_of_week);
      const start = normalizeTimeString(row.start_time);
      const end = normalizeTimeString(row.end_time);

      if (!Number.isInteger(day) || day < 0 || day > 6) {
        return res.status(400).json({ message: 'day_of_week phải từ 0 đến 6' });
      }

      if (!start || !end) {
        return res.status(400).json({ message: 'Giờ bắt đầu / kết thúc không hợp lệ' });
      }

      if (start >= end) {
        return res.status(400).json({ message: 'Giờ kết thúc phải sau giờ bắt đầu' });
      }

      normalized.push({ day_of_week: day, start_time: start, end_time: end });
    }

    return staffModel.replaceWeeklyAvailability(id, normalized, (saveErr) => {
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
    return res.status(400).json({ message: 'Khong co du lieu de cap nhat' });
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
        return res.status(400).json({ message: 'Mat khau moi khong duoc de trong' });
      }

      if (password.length < 6) {
        return res.status(400).json({ message: 'Mat khau moi phai it nhat 6 ky tu' });
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
        return res.status(400).json({ message: 'is_active khong hop le' });
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
            ? 'Cap nhat nhan vien va mat khau thanh cong'
            : 'Cập nhật nhân viên thành công'
        });
      });

    if (typeof staff_role_id !== 'undefined') {
      const parsedRoleId = Number(staff_role_id);
      if (!Number.isInteger(parsedRoleId) || parsedRoleId < 0) {
        return res.status(400).json({ message: 'Vai tro khong hop le' });
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
