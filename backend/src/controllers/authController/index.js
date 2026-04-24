const userModel = require('../../models/userModel');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const { sendEmail } = require('../../services/mailService');
const { buildResetPasswordEmailPayload } = require('../../utils/resetPasswordEmailTemplate');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRE = process.env.JWT_EXPIRE || '7d';
const PASSWORD_RESET_EXPIRE = process.env.PASSWORD_RESET_EXPIRE || '15m';
const BCRYPT_HASH_PATTERN = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/;
const googleClient = new OAuth2Client();

if (!JWT_SECRET) {
  throw new Error('ERROR: JWT_SECRET must be set in environment variables');
}

const isBcryptHash = (value) =>
  typeof value === 'string' && BCRYPT_HASH_PATTERN.test(value);

const getGoogleClientIds = () =>
  (process.env.GOOGLE_CLIENT_IDS || process.env.GOOGLE_CLIENT_ID || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const buildResetPasswordLink = (token) => {
  const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:3000').trim();
  return `${frontendUrl.replace(/\/$/, '')}/reset-password?token=${encodeURIComponent(token)}`;
};

const respondWithLoginSuccess = (res, user) => {
  const payload = {
    id: user.id,
    email: user.email,
    role: user.role
  };
  if (user.role === 'staff') {
    payload.staff_role_name = user.staff_role_name || null;
  }

  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRE });

  return res.status(200).json({
    success: true,
    message: 'Đăng nhập thành công',
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      ...(user.role === 'staff' ? { staff_role_name: user.staff_role_name || null } : {})
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

    if (typeof user.is_active !== 'undefined' && user.is_active !== null && Number(user.is_active) !== 1) {
      return res.status(403).json({
        success: false,
        message: 'Tai khoan da bi tam khoa'
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

exports.googleLogin = async (req, res) => {
  const idToken = String(req.body?.idToken || '').trim();
  const clientIds = getGoogleClientIds();

  if (!clientIds.length) {
    return res.status(500).json({
      success: false,
      message: 'Thiếu cấu hình GOOGLE_CLIENT_ID trên server.'
    });
  }

  try {
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: clientIds
    });
    const payload = ticket.getPayload();
    const email = String(payload?.email || '').trim().toLowerCase();
    const name = String(payload?.name || '').trim() || email.split('@')[0] || 'Google User';

    if (!email || payload?.email_verified !== true) {
      return res.status(401).json({
        success: false,
        message: 'Không xác minh được tài khoản Google.'
      });
    }

    return userModel.getUserByEmail(email, (err, user) => {
      if (err) {
        console.error('[GOOGLE_LOGIN_LOOKUP_ERROR]', err);
        return res.status(500).json({
          success: false,
          message: 'Lỗi server khi đăng nhập Google'
        });
      }

      if (user) {
        if (
          typeof user.is_active !== 'undefined' &&
          user.is_active !== null &&
          Number(user.is_active) !== 1
        ) {
          return res.status(403).json({
            success: false,
            message: 'Tai khoan da bi tam khoa'
          });
        }

        return respondWithLoginSuccess(res, user);
      }

      const generatedPassword = bcrypt.hashSync(`${email}-${Date.now()}-google`, 10);
      return userModel.createUser(
        {
          name,
          email,
          password: generatedPassword,
          phone: '',
          role: 'customer'
        },
        (createErr, result) => {
          if (createErr) {
            console.error('[GOOGLE_LOGIN_CREATE_ERROR]', createErr);
            return res.status(500).json({
              success: false,
              message: 'Lỗi server khi tạo tài khoản từ Google'
            });
          }

          return respondWithLoginSuccess(res, {
            id: result.insertId,
            name,
            email,
            phone: '',
            role: 'customer'
          });
        }
      );
    });
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Google token không hợp lệ hoặc đã hết hạn.'
    });
  }
};

exports.forgotPassword = (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();

  if (!email) {
    return res.status(400).json({
      success: false,
      message: 'Email không hợp lệ'
    });
  }

  return userModel.getUserByEmail(email, async (err, user) => {
    if (err) {
      console.error('[FORGOT_PASSWORD_LOOKUP_ERROR]', err);
      return res.status(500).json({
        success: false,
        message: 'Lỗi server khi xử lý yêu cầu'
      });
    }

    const genericResponse = {
      success: true,
      message: 'Nếu email tồn tại, hệ thống đã gửi hướng dẫn đặt lại mật khẩu.'
    };

    if (!user) {
      return res.status(200).json(genericResponse);
    }

    try {
      const token = jwt.sign(
        { sub: user.id, email: user.email, purpose: 'password_reset' },
        JWT_SECRET,
        { expiresIn: PASSWORD_RESET_EXPIRE }
      );
      const resetLink = buildResetPasswordLink(token);
      const supportEmail = (process.env.SUPPORT_EMAIL || process.env.SMTP_USER || 'support@beautybook.vn').trim();
      const emailPayload = buildResetPasswordEmailPayload({
        userName: user.name || 'bạn',
        resetLink,
        expireInLabel: PASSWORD_RESET_EXPIRE,
        supportEmail
      });

      await sendEmail({
        to: user.email,
        subject: emailPayload.subject,
        html: emailPayload.html,
        text: emailPayload.text
      });

      return res.status(200).json(genericResponse);
    } catch (mailErr) {
      console.error('[FORGOT_PASSWORD_MAIL_ERROR]', mailErr);
      return res.status(500).json({
        success: false,
        message: 'Không thể gửi email đặt lại mật khẩu lúc này.'
      });
    }
  });
};

exports.resetPassword = (req, res) => {
  const token = String(req.body?.token || '').trim();
  const newPassword = String(req.body?.newPassword || '');

  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: 'Link đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.'
    });
  }

  if (decoded?.purpose !== 'password_reset' || !decoded?.sub) {
    return res.status(400).json({
      success: false,
      message: 'Token đặt lại mật khẩu không hợp lệ.'
    });
  }

  const hashedPassword = bcrypt.hashSync(newPassword, 10);
  return userModel.updateUserPassword(decoded.sub, hashedPassword, (err) => {
    if (err) {
      console.error('[RESET_PASSWORD_ERROR]', err);
      return res.status(500).json({
        success: false,
        message: 'Lỗi server khi cập nhật mật khẩu'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Đặt lại mật khẩu thành công. Bạn có thể đăng nhập lại.'
    });
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
