const userModel = require('../models/userModel');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRE = process.env.JWT_EXPIRE || '7d';
const BCRYPT_HASH_PATTERN = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/;

if (!JWT_SECRET) {
  throw new Error('ERROR: JWT_SECRET must be set in environment variables');
}

const isBcryptHash = (value) =>
  typeof value === 'string' && BCRYPT_HASH_PATTERN.test(value);

const respondWithLoginSuccess = (res, user) => {
  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRE }
  );

  return res.status(200).json({
    success: true,
    message: 'Đăng nhập thành công',
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role
    }
  });
};

exports.register = (req, res) => {
  const { name, email, password, phone } = req.body;
  const normalizedName = (name || '').trim();
  const normalizedEmail = (email || '').trim().toLowerCase();
  const normalizedPhone = (phone || '').trim();

  if (!normalizedName || !normalizedEmail || !password) {
    return res.status(400).json({
      success: false,
      message: 'Vui lòng cung cấp đầy đủ thông tin'
    });
  }

  userModel.getUserByEmail(normalizedEmail, (err, user) => {
    if (err) {
      console.error('[REGISTER_ERROR]', err);
      return res.status(500).json({
        success: false,
        message: 'Lỗi server khi kiểm tra email'
      });
    }

    if (user) {
      return res.status(400).json({
        success: false,
        message: 'Email đã được đăng ký'
      });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);

    const userData = {
      name: normalizedName,
      email: normalizedEmail,
      password: hashedPassword,
      phone: normalizedPhone,
      role: 'customer'
    };

    return userModel.createUser(userData, (createErr, result) => {
      if (createErr) {
        console.error('[REGISTER_CREATE_ERROR]', createErr);
        return res.status(500).json({
          success: false,
          message: 'Lỗi server khi tạo người dùng'
        });
      }

      return res.status(201).json({
        success: true,
        message: 'Đăng ký thành công',
        user: {
          id: result.insertId,
          name: normalizedName,
          email: normalizedEmail,
          phone: normalizedPhone,
          role: 'customer'
        }
      });
    });
  });
};

exports.login = (req, res) => {
  const { email, password } = req.body;
  const normalizedEmail = (email || '').trim().toLowerCase();

  if (!normalizedEmail || !password) {
    return res.status(400).json({
      success: false,
      message: 'Vui lòng cung cấp email và mật khẩu'
    });
  }

  return userModel.getUserByEmail(normalizedEmail, (err, user) => {
    if (err) {
      console.error('[LOGIN_ERROR]', err);
      return res.status(500).json({
        success: false,
        message: 'Lỗi server khi xác thực'
      });
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Email hoặc mật khẩu không đúng'
      });
    }

    const storedPassword = user.password || '';
    const usingLegacyPlainTextPassword = !isBcryptHash(storedPassword);

    let isPasswordValid = false;
    if (usingLegacyPlainTextPassword) {
      isPasswordValid = password === storedPassword;
    } else {
      isPasswordValid = bcrypt.compareSync(password, storedPassword);
    }

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Email hoặc mật khẩu không đúng'
      });
    }

    if (usingLegacyPlainTextPassword) {
      const hashedPassword = bcrypt.hashSync(password, 10);

      return userModel.updateUserPassword(user.id, hashedPassword, (updateErr) => {
        if (updateErr) {
          console.error('[LOGIN_PASSWORD_MIGRATION_ERROR]', updateErr);
          return res.status(500).json({
            success: false,
            message: 'Lỗi server khi nâng cấp mật khẩu tài khoản cũ'
          });
        }

        return respondWithLoginSuccess(res, {
          ...user,
          password: hashedPassword
        });
      });
    }

    return respondWithLoginSuccess(res, user);
  });
};

exports.getProfile = (req, res) => {
  const userId = req.user.id;

  userModel.getUserById(userId, (err, user) => {
    if (err) {
      console.error('[GET_PROFILE_ERROR]', err);
      return res.status(500).json({
        success: false,
        message: 'Lỗi server'
      });
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Người dùng không tồn tại'
      });
    }

    return res.status(200).json({
      success: true,
      data: user
    });
  });
};

exports.updateProfile = (req, res) => {
  const userId = req.user.id;
  const { name, email, phone } = req.body;

  if (!name || !email) {
    return res.status(400).json({
      success: false,
      message: 'Vui lòng cung cấp đầy đủ thông tin'
    });
  }

  const userData = {
    name,
    email,
    phone: phone || ''
  };

  return userModel.updateUser(userId, userData, (err) => {
    if (err) {
      console.error('[UPDATE_PROFILE_ERROR]', err);
      return res.status(500).json({
        success: false,
        message: 'Lỗi server khi cập nhật profile'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Cập nhật profile thành công'
    });
  });
};