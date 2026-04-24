const bcrypt = require('bcryptjs');
const adminUserModel = require('../../models/adminUserModel');
const userModel = require('../../models/userModel');

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

exports.getAllAdmins = (req, res) => {
  adminUserModel.getAllAdmins((err, admins) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Loi server', error: err });
    }

    return res.status(200).json({ success: true, data: admins });
  });
};

exports.createAdmin = (req, res) => {
  const { name, email, password, phone, is_active } = req.body;
  const normalizedName = (name || '').trim();
  const normalizedEmail = (email || '').trim().toLowerCase();

  if (!normalizedName || !normalizedEmail || !password) {
    return res.status(400).json({
      success: false,
      message: 'Vui long cung cap day du thong tin'
    });
  }

  if (String(password).length < 6) {
    return res.status(400).json({
      success: false,
      message: 'Mat khau phai it nhat 6 ky tu'
    });
  }

  const activeValue =
    typeof is_active === 'undefined' ? true : parseActiveValue(is_active);

  if (activeValue === null) {
    return res.status(400).json({
      success: false,
      message: 'is_active khong hop le'
    });
  }

  userModel.getUserByEmail(normalizedEmail, (err, existingUser) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Loi server', error: err });
    }

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Email da ton tai'
      });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);

    return adminUserModel.createAdmin(
      {
        name: normalizedName,
        email: normalizedEmail,
        password: hashedPassword,
        phone: (phone || '').trim(),
        is_active: activeValue
      },
      (createErr, result) => {
        if (createErr) {
          return res.status(500).json({ success: false, message: 'Loi server', error: createErr });
        }

        return res.status(201).json({
          success: true,
          message: 'Tao tai khoan admin thanh cong',
          adminId: result.insertId
        });
      }
    );
  });
};

exports.updateAdmin = (req, res) => {
  const { id } = req.params;
  const { name, email, phone, is_active, password } = req.body;

  if (
    typeof name === 'undefined' &&
    typeof email === 'undefined' &&
    typeof phone === 'undefined' &&
    typeof is_active === 'undefined' &&
    typeof password === 'undefined'
  ) {
    return res.status(400).json({
      success: false,
      message: 'Khong co du lieu de cap nhat'
    });
  }

  adminUserModel.getAdminById(id, (err, admin) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Loi server', error: err });
    }

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Tai khoan admin khong ton tai'
      });
    }

    const finalizeUpdate = () => {
      const payload = {};

      if (typeof name !== 'undefined') payload.name = name.trim();
      if (typeof email !== 'undefined') payload.email = email.trim().toLowerCase();
      if (typeof phone !== 'undefined') payload.phone = phone.trim();

      if (typeof password !== 'undefined') {
        if (typeof password !== 'string' || password.trim().length === 0) {
          return res.status(400).json({
            success: false,
            message: 'Mat khau moi khong duoc de trong'
          });
        }

        if (password.length < 6) {
          return res.status(400).json({
            success: false,
            message: 'Mat khau moi phai it nhat 6 ky tu'
          });
        }

        payload.password = bcrypt.hashSync(password, 10);
      }

      if (typeof is_active !== 'undefined') {
        const activeValue = parseActiveValue(is_active);
        if (activeValue === null) {
          return res.status(400).json({
            success: false,
            message: 'is_active khong hop le'
          });
        }

        if (Number(id) === Number(req.user.id) && !activeValue) {
          return res.status(400).json({
            success: false,
            message: 'Khong the tu vo hieu hoa tai khoan admin dang dang nhap'
          });
        }

        payload.is_active = activeValue;
      }

      return adminUserModel.updateAdmin(id, payload, (updateErr) => {
        if (updateErr) {
          return res.status(500).json({ success: false, message: 'Loi server', error: updateErr });
        }

        return res.status(200).json({
          success: true,
          message:
            typeof password !== 'undefined'
              ? 'Cap nhat admin va mat khau thanh cong'
              : 'Cap nhat admin thanh cong'
        });
      });
    };

    if (typeof email !== 'undefined' && email.trim().toLowerCase() !== admin.email) {
      return userModel.getUserByEmail(email.trim().toLowerCase(), (emailErr, existingUser) => {
        if (emailErr) {
          return res.status(500).json({ success: false, message: 'Loi server', error: emailErr });
        }

        if (existingUser && Number(existingUser.id) !== Number(id)) {
          return res.status(400).json({
            success: false,
            message: 'Email da ton tai'
          });
        }

        return finalizeUpdate();
      });
    }

    return finalizeUpdate();
  });
};
