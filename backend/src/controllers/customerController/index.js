const bcrypt = require('bcryptjs');
const customerModel = require('../../models/customerModel');
const userModel = require('../../models/userModel');
const mailService = require('../../services/mailService');
const { buildVoucherEmailPayload } = require('../../utils/voucherEmailTemplate');

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

const normalizeDateOfBirth = (value) => {
  if (typeof value === 'undefined') {
    return { provided: false, valid: true, value: null };
  }

  const raw = String(value || '').trim();
  if (!raw) {
    return { provided: true, valid: true, value: null };
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return { provided: true, valid: false, value: null };
  }

  const [year, month, day] = raw.split('-').map(Number);
  const birthDate = new Date(year, month - 1, day);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (
    Number.isNaN(birthDate.getTime()) ||
    birthDate.getFullYear() !== year ||
    birthDate.getMonth() !== month - 1 ||
    birthDate.getDate() !== day ||
    birthDate >= today
  ) {
    return { provided: true, valid: false, value: null };
  }

  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age -= 1;
  }

  return {
    provided: true,
    valid: age >= 13 && age <= 100,
    value: raw
  };
};

const addDays = (days) => {
  const nextDate = new Date();
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate.toISOString();
};

const createSampleVoucherForCustomer = (customer, overrides = {}) => {
  const nowCode = Date.now().toString().slice(-6);
  const baseVoucher = {
    code: `BB${customer.id}${nowCode}`,
    voucher_type: 'percentage',
    discount_percent: 15,
    discount_amount: 0,
    min_order_value: 300000,
    max_discount_amount: 120000,
    description: 'Ưu đãi dành cho lần đặt lịch tiếp theo tại BeautyBook.',
    expiry_date: addDays(7)
  };

  return {
    ...baseVoucher,
    ...overrides
  };
};

exports.getAllCustomers = (req, res) => {
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const limit = Math.min(200, Math.max(1, Number.parseInt(req.query.limit, 10) || 50));
  const search = String(req.query.search || '').trim().slice(0, 100);
  const offset = (page - 1) * limit;

  customerModel.getAllCustomers({ search, limit, offset }, (err, result) => {
    if (err) {
      return res.status(500).json({ message: 'Lỗi server', error: err });
    }

    const total = Number(result.total || 0);
    return res.status(200).json({
      success: true,
      data: result.customers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit))
      }
    });
  });
};

exports.createCustomer = (req, res) => {
  const { name, email, password, phone, date_of_birth, is_active } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Vui lòng cung cấp đầy đủ thông tin' });
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
      return res.status(400).json({ message: 'is_active không hợp lệ' });
    }

    const normalizedBirthday = normalizeDateOfBirth(date_of_birth);
    if (!normalizedBirthday.valid) {
      return res.status(400).json({ message: 'Ngày sinh không hợp lệ' });
    }

    let hashedPassword = '';
    try {
      hashedPassword = await bcrypt.hash(password, 10);
    } catch (hashErr) {
      return res.status(500).json({ message: 'Lỗi server', error: hashErr });
    }

    return customerModel.createCustomer(
      {
        name: name.trim(),
        email: email.trim(),
        password: hashedPassword,
        phone: (phone || '').trim(),
        date_of_birth: normalizedBirthday.value,
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
  const { name, email, phone, date_of_birth, is_active, password } = req.body;

  if (
    typeof name === 'undefined' &&
    typeof email === 'undefined' &&
    typeof phone === 'undefined' &&
    typeof date_of_birth === 'undefined' &&
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

    const finalizeUpdate = async () => {
      const payload = {};

      if (typeof name !== 'undefined') payload.name = name.trim();
      if (typeof email !== 'undefined') payload.email = email.trim();
      if (typeof phone !== 'undefined') payload.phone = phone.trim();
      const normalizedBirthday = normalizeDateOfBirth(date_of_birth);
      if (!normalizedBirthday.valid) {
        return res.status(400).json({ message: 'Ngày sinh không hợp lệ' });
      }
      if (normalizedBirthday.provided) payload.date_of_birth = normalizedBirthday.value;

      if (typeof password !== 'undefined') {
        if (typeof password !== 'string' || password.trim().length === 0) {
          return res.status(400).json({ message: 'Mật khẩu mới không được để trống' });
        }

        if (password.length < 6) {
          return res.status(400).json({ message: 'Mật khẩu mới phải ít nhất 6 ký tự' });
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

exports.sendVoucherEmail = (req, res) => {
  const { id } = req.params;
  const source = String(req.body?.source || 'admin').trim().toLowerCase() === 'bot' ? 'bot' : 'admin';
  const voucherOverrides = typeof req.body?.voucher === 'object' && req.body.voucher ? req.body.voucher : {};
  const issuedByName = String(
    req.body?.issuedByName || (source === 'admin' ? req.user.email || 'Admin BeautyBook' : 'BeautyBook Bot')
  ).trim();
  const reason = String(
    req.body?.reason ||
      (source === 'admin'
        ? 'Ưu đãi này được gửi trực tiếp từ đội ngũ BeautyBook.'
        : 'Hệ thống tự động gợi ý ưu đãi phù hợp cho bạn.')
  ).trim();

  customerModel.getCustomerById(id, async (err, customer) => {
    if (err) {
      return res.status(500).json({ message: 'Lỗi server', error: err });
    }

    if (!customer) {
      return res.status(404).json({ message: 'Khách hàng không tồn tại' });
    }

    if (!customer.email) {
      return res.status(400).json({ message: 'Khách hàng này chưa có email để nhận voucher.' });
    }

    try {
      const voucher = createSampleVoucherForCustomer(customer, voucherOverrides);
      const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:3000').trim();
      const supportEmail = (process.env.SUPPORT_EMAIL || process.env.EMAIL_USER || 'support@beautybook.vn').trim();

      const payload = buildVoucherEmailPayload({
        customer,
        voucher,
        source,
        issuedByName,
        reason,
        redeemUrl: `${frontendUrl}/services`,
        supportEmail
      });

      const mailResult = await mailService.sendEmail({
        to: customer.email,
        subject: payload.subject,
        html: payload.html,
        text: payload.text
      });

      return res.status(200).json({
        success: true,
        message: `Đã gửi email voucher tới ${customer.email}.`,
        data: {
          recipient: customer.email,
          voucherCode: voucher.code,
          source,
          messageId: mailResult.messageId
        }
      });
    } catch (sendErr) {
      const status = sendErr.status || 500;
      return res.status(status).json({
        success: false,
        message: sendErr.message || 'Không thể gửi email voucher lúc này.'
      });
    }
  });
};
