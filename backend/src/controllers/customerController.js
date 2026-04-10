const bcrypt = require('bcryptjs');
const customerModel = require('../models/customerModel');
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

exports.getAllCustomers = (req, res) => {
  customerModel.getAllCustomers((err, customers) => {
    if (err) {
      return res.status(500).json({ message: 'Lỗi server', error: err });
    }

    return res.status(200).json({ success: true, data: customers });
  });
};

exports.createCustomer = (req, res) => {
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

    return customerModel.createCustomer(
      {
        name: name.trim(),
        email: email.trim(),
        password: hashedPassword,
        phone: (phone || '').trim(),
        is_active: activeValue
      },
      (createErr, result) => {
        if (createErr) {
          return res.status(500).json({ message: 'Lỗi server', error: createErr });
        }

        return res.status(201).json({
          success: true,
          message: 'Thêm khách hàng thành công',
          customerId: result.insertId
        });
      }
    );
  });
};

exports.updateCustomer = (req, res) => {
  const { id } = req.params;
  const { name, email, phone, is_active, password } = req.body;

  if (
    typeof name === 'undefined' &&
    typeof email === 'undefined' &&
    typeof phone === 'undefined' &&
    typeof is_active === 'undefined' &&
    typeof password === 'undefined'
  ) {
    return res.status(400).json({ message: 'Không có dữ liệu để cập nhật' });
  }

  customerModel.getCustomerById(id, (err, customer) => {
    if (err) {
      return res.status(500).json({ message: 'Lỗi server', error: err });
    }

    if (!customer) {
      return res.status(404).json({ message: 'Khách hàng không tồn tại' });
    }

    const finalizeUpdate = () => {
      const payload = {};

      if (typeof name !== 'undefined') payload.name = name.trim();
      if (typeof email !== 'undefined') payload.email = email.trim();
      if (typeof phone !== 'undefined') payload.phone = phone.trim();

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

      return customerModel.updateCustomer(id, payload, (updateErr) => {
        if (updateErr) {
          return res.status(500).json({ message: 'Lỗi server', error: updateErr });
        }

        return res.status(200).json({
          success: true,
          message:
            typeof password !== 'undefined'
              ? 'Cập nhật khách hàng và mật khẩu thành công'
              : 'Cập nhật khách hàng thành công'
        });
      });
    };

    if (typeof email !== 'undefined' && email.trim() !== customer.email) {
      return userModel.getUserByEmail(email.trim(), (emailErr, existingUser) => {
        if (emailErr) {
          return res.status(500).json({ message: 'Lỗi server', error: emailErr });
        }

        if (existingUser && Number(existingUser.id) !== Number(id)) {
          return res.status(400).json({ message: 'Email đã tồn tại' });
        }

        return finalizeUpdate();
      });
    }

    return finalizeUpdate();
  });
};

exports.deleteCustomer = (req, res) => {
  const { id } = req.params;

  customerModel.getCustomerById(id, (err, customer) => {
    if (err) {
      return res.status(500).json({ message: 'Lỗi server', error: err });
    }

    if (!customer) {
      return res.status(404).json({ message: 'Khách hàng không tồn tại' });
    }

    return customerModel.getCustomerAppointmentCount(id, (countErr, totalAppointments) => {
      if (countErr) {
        return res.status(500).json({ message: 'Lỗi server', error: countErr });
      }

      if (totalAppointments > 0) {
        return res.status(400).json({
          message: 'Không thể xóa tài khoản này vì khách hàng đã có lịch hẹn. Hãy tạm khóa tài khoản nếu cần.'
        });
      }

      return customerModel.deleteCustomer(id, (deleteErr) => {
        if (deleteErr) {
          return res.status(500).json({ message: 'Lỗi server', error: deleteErr });
        }

        return res.status(200).json({
          success: true,
          message: 'Xóa tài khoản khách hàng thành công'
        });
      });
    });
  });
};