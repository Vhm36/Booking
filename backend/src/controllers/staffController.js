const bcrypt = require('bcryptjs');
const staffModel = require('../models/staffModel');
const userModel = require('../models/userModel');

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
  const { date, time } = req.query;

  if (!date || !time) {
    return res.status(400).json({ message: 'Vui lòng cung cấp ngày và giờ' });
  }

  staffModel.getAvailableStaff(date, time, (err, staffList) => {
    if (err) {
      return res.status(500).json({ message: 'Lỗi server', error: err });
    }

    return res.status(200).json({ success: true, data: staffList });
  });
};

exports.createStaff = (req, res) => {
  const { name, email, password, phone, is_active } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Vui lòng cung cấp đầy đủ thông tin' });
  }

  userModel.getUserByEmail(email, (err, existingUser) => {
    if (err) {
      return res.status(500).json({ message: 'Lỗi server', error: err });
    }

    if (existingUser) {
      return res.status(400).json({ message: 'Email đã tồn tại' });
    }

    const activeValue =
      typeof is_active === 'undefined' ? true : parseActiveValue(is_active);

    if (activeValue === null) {
      return res.status(400).json({ message: 'is_active không hợp lệ' });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);

    return staffModel.createStaff(
      {
        name,
        email,
        password: hashedPassword,
        phone: phone || '',
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
};

exports.updateStaff = (req, res) => {
  const { id } = req.params;
  const { name, phone, is_active, password } = req.body;

  if (
    typeof name === 'undefined' &&
    typeof phone === 'undefined' &&
    typeof is_active === 'undefined' &&
    typeof password === 'undefined'
  ) {
    return res.status(400).json({ message: 'Không có dữ liệu để cập nhật' });
  }

  staffModel.getStaffById(id, (err, staff) => {
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
        return res.status(400).json({ message: 'Mật khẩu mới phải ít nhất 6 ký tự' });
      }

      payload.password = bcrypt.hashSync(password, 10);
    }

    if (typeof is_active !== 'undefined') {
      const activeValue = parseActiveValue(is_active);
      if (activeValue === null) {
        return res.status(400).json({ message: 'is_active không hợp lệ' });
      }
      payload.is_active = activeValue;
    }

    return staffModel.updateStaff(id, payload, (updateErr) => {
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
  });
};
