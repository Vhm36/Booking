const userModel = require('../../models/userModel');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
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

const normalizeDateOfBirth = (value) => {
  const raw = String(value || '').trim();
  if (!raw) {
    return null;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return null;
  }

  const birthDate = new Date(`${raw}T00:00:00`);
  if (Number.isNaN(birthDate.getTime())) {
    return null;
  }

  return raw;
};

const attachMonthlyLoyaltyStats = (user, callback) => {
  if (!user) {
    return callback(null, user);
  }

  return userModel.getMonthlyLoyaltyStats(user.id, (err, stats) => {
    if (err) return callback(err);

    return callback(null, {
      ...user,
      ...stats,
      loyalty_period: new Date().toISOString().slice(0, 7)
    });
  });
};

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
  const payload = { id: user.id, email: user.email, role: user.role };
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
      date_of_birth: user.date_of_birth || null,
      gender: user.gender || null,
      avatar: user.avatar || null,
      role: user.role,
      created_at: user.created_at || null,
      ...(user.role === 'staff' ? { staff_role_name: user.staff_role_name || null } : {})
    }
  });
};

// ─── REGISTER ────────────────────────────────────────────────
exports.register = (req, res) => {
  const { name, email, password, phone, date_of_birth } = req.body;
  const normalizedName = (name || '').trim();
  const normalizedEmail = (email || '').trim().toLowerCase();
  const normalizedPhone = (phone || '').trim();
  const normalizedDateOfBirth = normalizeDateOfBirth(date_of_birth);

  if (!normalizedName || !normalizedEmail || !password || !normalizedDateOfBirth) {
    return res.status(400).json({ success: false, message: 'Vui lòng cung cấp đầy đủ thông tin' });
  }

  userModel.getUserByEmail(normalizedEmail, async (err, user) => {
    if (err) {
      console.error('[REGISTER_ERROR]', err);
      return res.status(500).json({ success: false, message: 'Lỗi server khi kiểm tra email' });
    }
    if (user) {
      return res.status(400).json({ success: false, message: 'Email đã được đăng ký' });
    }

    let hashedPassword = '';
    try {
      hashedPassword = await bcrypt.hash(password, 10);
    } catch (hashErr) {
      console.error('[REGISTER_HASH_ERROR]', hashErr);
      return res.status(500).json({ success: false, message: 'Lỗi server khi mã hóa mật khẩu' });
    }

    const userData = {
      name: normalizedName,
      email: normalizedEmail,
      password: hashedPassword,
      phone: normalizedPhone,
      date_of_birth: normalizedDateOfBirth,
      role: 'customer'
    };

    return userModel.createUser(userData, (createErr, result) => {
      if (createErr) {
        console.error('[REGISTER_CREATE_ERROR]', createErr);
        return res.status(500).json({ success: false, message: 'Lỗi server khi tạo người dùng' });
      }
      return res.status(201).json({
        success: true,
        message: 'Đăng ký thành công',
        user: {
          id: result.insertId,
          name: normalizedName,
          email: normalizedEmail,
          phone: normalizedPhone,
          date_of_birth: normalizedDateOfBirth,
          role: 'customer'
        }
      });
    });
  });
};

// ─── LOGIN ───────────────────────────────────────────────────
exports.login = (req, res) => {
  const { email, password } = req.body;
  const normalizedEmail = (email || '').trim().toLowerCase();

  if (!normalizedEmail || !password) {
    return res.status(400).json({ success: false, message: 'Vui lòng cung cấp email và mật khẩu' });
  }

  return userModel.getUserByEmail(normalizedEmail, async (err, user) => {
    if (err) {
      console.error('[LOGIN_ERROR]', err);
      return res.status(500).json({ success: false, message: 'Lỗi server khi xác thực' });
    }
    if (!user) {
      return res.status(401).json({ success: false, message: 'Email hoặc mật khẩu không đúng' });
    }
    if (typeof user.is_active !== 'undefined' && user.is_active !== null && Number(user.is_active) !== 1) {
      return res.status(403).json({ success: false, message: 'Tài khoản đã bị tạm khóa' });
    }

    const storedPassword = user.password || '';
    const usingLegacyPlainTextPassword = !isBcryptHash(storedPassword);

    let isPasswordValid = false;
    try {
      if (usingLegacyPlainTextPassword) {
        isPasswordValid = password === storedPassword;
      } else {
        isPasswordValid = await bcrypt.compare(password, storedPassword);
      }
    } catch (compareErr) {
      console.error('[LOGIN_COMPARE_ERROR]', compareErr);
      return res.status(500).json({ success: false, message: 'Lỗi server khi xác thực' });
    }

    if (!isPasswordValid) {
      return res.status(401).json({ success: false, message: 'Email hoặc mật khẩu không đúng' });
    }

    if (usingLegacyPlainTextPassword) {
      let hashedPassword = '';
      try {
        hashedPassword = await bcrypt.hash(password, 10);
      } catch (hashErr) {
        console.error('[LOGIN_PASSWORD_MIGRATION_HASH_ERROR]', hashErr);
        return res.status(500).json({ success: false, message: 'Lỗi server khi nâng cấp mật khẩu tài khoản cũ' });
      }

      return userModel.updateUserPassword(user.id, hashedPassword, (updateErr) => {
        if (updateErr) {
          console.error('[LOGIN_PASSWORD_MIGRATION_ERROR]', updateErr);
          return res.status(500).json({ success: false, message: 'Lỗi server khi nâng cấp mật khẩu tài khoản cũ' });
        }
        return respondWithLoginSuccess(res, { ...user, password: hashedPassword });
      });
    }

    return respondWithLoginSuccess(res, user);
  });
};

// ─── GOOGLE LOGIN ────────────────────────────────────────────
exports.googleLogin = async (req, res) => {
  const idToken = String(req.body?.idToken || '').trim();
  const clientIds = getGoogleClientIds();

  if (!clientIds.length) {
    return res.status(500).json({ success: false, message: 'Thiếu cấu hình GOOGLE_CLIENT_ID trên server.' });
  }

  try {
    const ticket = await googleClient.verifyIdToken({ idToken, audience: clientIds });
    const payload = ticket.getPayload();
    const email = String(payload?.email || '').trim().toLowerCase();
    const name = String(payload?.name || '').trim() || email.split('@')[0] || 'Google User';

    if (!email || payload?.email_verified !== true) {
      return res.status(401).json({ success: false, message: 'Không xác minh được tài khoản Google.' });
    }

    return userModel.getUserByEmail(email, async (err, user) => {
      if (err) {
        console.error('[GOOGLE_LOGIN_LOOKUP_ERROR]', err);
        return res.status(500).json({ success: false, message: 'Lỗi server khi đăng nhập Google' });
      }

      if (user) {
        if (typeof user.is_active !== 'undefined' && user.is_active !== null && Number(user.is_active) !== 1) {
          return res.status(403).json({ success: false, message: 'Tài khoản đã bị tạm khóa' });
        }
        return respondWithLoginSuccess(res, user);
      }

      let generatedPassword = '';
      try {
        generatedPassword = await bcrypt.hash(`${email}-${Date.now()}-google`, 10);
      } catch (hashErr) {
        console.error('[GOOGLE_LOGIN_HASH_ERROR]', hashErr);
        return res.status(500).json({ success: false, message: 'Lỗi server khi tạo tài khoản từ Google' });
      }

      return userModel.createUser(
        { name, email, password: generatedPassword, phone: '', role: 'customer' },
        (createErr, result) => {
          if (createErr) {
            console.error('[GOOGLE_LOGIN_CREATE_ERROR]', createErr);
            return res.status(500).json({ success: false, message: 'Lỗi server khi tạo tài khoản từ Google' });
          }
          return respondWithLoginSuccess(res, { id: result.insertId, name, email, phone: '', role: 'customer', created_at: new Date().toISOString() });
        }
      );
    });
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Google token không hợp lệ hoặc đã hết hạn.' });
  }
};

// ─── ZALO LOGIN ──────────────────────────────────────────────
exports.zaloLogin = async (req, res) => {
  const code = String(req.body?.code || '').trim();
  const codeVerifier = String(req.body?.codeVerifier || '').trim();
  const ZALO_APP_ID = (process.env.ZALO_APP_ID || '').trim();
  const ZALO_APP_SECRET = (process.env.ZALO_APP_SECRET || '').trim();

  if (!ZALO_APP_ID || !ZALO_APP_SECRET) {
    return res.status(500).json({ success: false, message: 'Thiếu cấu hình ZALO_APP_ID hoặc ZALO_APP_SECRET trên server.' });
  }

  try {
    // Bước 1: Đổi authorization code → access_token
    const tokenParams = new URLSearchParams({ code, app_id: ZALO_APP_ID, grant_type: 'authorization_code', code_verifier: codeVerifier });
    const tokenResponse = await fetch('https://oauth.zaloapp.com/v4/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'secret_key': ZALO_APP_SECRET },
      body: tokenParams.toString()
    });
    const tokenData = await tokenResponse.json();

    if (tokenData.error || !tokenData.access_token) {
      console.error('[ZALO_TOKEN_ERROR]', tokenData);
      return res.status(401).json({ success: false, message: tokenData.error_description || 'Không thể xác thực với Zalo.' });
    }

    // Bước 2: Lấy thông tin user từ Zalo Graph API
    const profileResponse = await fetch('https://graph.zalo.me/v2.0/me?fields=id,name,picture', {
      headers: { 'access_token': tokenData.access_token }
    });
    const profile = await profileResponse.json();

    if (profile.error || !profile.id) {
      console.error('[ZALO_PROFILE_ERROR]', profile);
      return res.status(401).json({ success: false, message: 'Không lấy được thông tin Zalo.' });
    }

    const zaloId = String(profile.id);
    const zaloName = String(profile.name || '').trim() || `Zalo User ${zaloId.slice(-4)}`;

    // Bước 3: Tìm user theo zalo_id hoặc tạo mới
    return userModel.getUserByZaloId(zaloId, async (err, user) => {
      if (err) {
        console.error('[ZALO_LOGIN_LOOKUP_ERROR]', err);
        return res.status(500).json({ success: false, message: 'Lỗi server khi đăng nhập Zalo' });
      }

      if (user) {
        if (typeof user.is_active !== 'undefined' && user.is_active !== null && Number(user.is_active) !== 1) {
          return res.status(403).json({ success: false, message: 'Tài khoản đã bị tạm khóa' });
        }
        return respondWithLoginSuccess(res, user);
      }

      // Tạo user mới từ Zalo
      let generatedPassword = '';
      try {
        generatedPassword = await bcrypt.hash(`${zaloId}-${Date.now()}-zalo`, 10);
      } catch (hashErr) {
        console.error('[ZALO_LOGIN_HASH_ERROR]', hashErr);
        return res.status(500).json({ success: false, message: 'Lỗi server khi tạo tài khoản từ Zalo' });
      }

      return userModel.createUserWithZaloId(
        { name: zaloName, zalo_id: zaloId, password: generatedPassword, phone: '', role: 'customer' },
        (createErr, result) => {
          if (createErr) {
            console.error('[ZALO_LOGIN_CREATE_ERROR]', createErr);
            return res.status(500).json({ success: false, message: 'Lỗi server khi tạo tài khoản từ Zalo' });
          }
          return respondWithLoginSuccess(res, { id: result.insertId, name: zaloName, email: `zalo_${zaloId}@beautybook.local`, phone: '', role: 'customer', created_at: new Date().toISOString() });
        }
      );
    });
  } catch (error) {
    console.error('[ZALO_LOGIN_ERROR]', error);
    return res.status(401).json({ success: false, message: 'Đăng nhập Zalo thất bại.' });
  }
};

// ─── FORGOT PASSWORD ─────────────────────────────────────────
exports.forgotPassword = (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();

  if (!email) {
    return res.status(400).json({ success: false, message: 'Email không hợp lệ' });
  }

  return userModel.getUserByEmail(email, async (err, user) => {
    if (err) {
      console.error('[FORGOT_PASSWORD_LOOKUP_ERROR]', err);
      return res.status(500).json({ success: false, message: 'Lỗi server khi xử lý yêu cầu' });
    }

    const genericResponse = { success: true, message: 'Nếu email tồn tại, hệ thống đã gửi hướng dẫn đặt lại mật khẩu.' };

    if (!user) {
      return res.status(200).json(genericResponse);
    }

    try {
      const token = jwt.sign({ sub: user.id, email: user.email, purpose: 'password_reset' }, JWT_SECRET, { expiresIn: PASSWORD_RESET_EXPIRE });
      const resetLink = buildResetPasswordLink(token);
      const supportEmail = (process.env.SUPPORT_EMAIL || process.env.SMTP_USER || 'support@beautybook.vn').trim();
      const emailPayload = buildResetPasswordEmailPayload({ userName: user.name || 'bạn', resetLink, expireInLabel: PASSWORD_RESET_EXPIRE, supportEmail });

      await sendEmail({ to: user.email, subject: emailPayload.subject, html: emailPayload.html, text: emailPayload.text });

      return res.status(200).json(genericResponse);
    } catch (mailErr) {
      console.error('[FORGOT_PASSWORD_MAIL_ERROR]', mailErr);
      return res.status(500).json({ success: false, message: 'Không thể gửi email đặt lại mật khẩu lúc này.' });
    }
  });
};

// ─── RESET PASSWORD ──────────────────────────────────────────
exports.resetPassword = async (req, res) => {
  const token = String(req.body?.token || '').trim();
  const newPassword = String(req.body?.newPassword || '');

  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return res.status(400).json({ success: false, message: 'Link đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.' });
  }

  if (decoded?.purpose !== 'password_reset' || !decoded?.sub) {
    return res.status(400).json({ success: false, message: 'Token đặt lại mật khẩu không hợp lệ.' });
  }

  let hashedPassword = '';
  try {
    hashedPassword = await bcrypt.hash(newPassword, 10);
  } catch (hashErr) {
    console.error('[RESET_PASSWORD_HASH_ERROR]', hashErr);
    return res.status(500).json({ success: false, message: 'Lỗi server khi cập nhật mật khẩu' });
  }

  return userModel.updateUserPassword(decoded.sub, hashedPassword, (err) => {
    if (err) {
      console.error('[RESET_PASSWORD_ERROR]', err);
      return res.status(500).json({ success: false, message: 'Lỗi server khi cập nhật mật khẩu' });
    }
    return res.status(200).json({ success: true, message: 'Đặt lại mật khẩu thành công. Bạn có thể đăng nhập lại.' });
  });
};

// ─── GET PROFILE ─────────────────────────────────────────────
exports.getProfile = (req, res) => {
  const userId = req.user.id;

  userModel.getUserById(userId, (err, user) => {
    if (err) {
      console.error('[GET_PROFILE_ERROR]', err);
      return res.status(500).json({ success: false, message: 'Lỗi server' });
    }
    if (!user) {
      return res.status(404).json({ success: false, message: 'Người dùng không tồn tại' });
    }

    return attachMonthlyLoyaltyStats(user, (statsErr, profileUser) => {
      if (statsErr) {
        console.error('[GET_PROFILE_LOYALTY_ERROR]', statsErr);
        return res.status(500).json({ success: false, message: 'Lỗi server khi tính điểm thành viên' });
      }

      return res.status(200).json({ success: true, data: profileUser });
    });
  });
};

// ─── UPDATE PROFILE ──────────────────────────────────────────
exports.updateProfile = (req, res) => {
  const userId = req.user.id;
  const { name, email, phone, date_of_birth, gender } = req.body;

  if (!name || !email) {
    return res.status(400).json({ success: false, message: 'Vui lòng cung cấp đầy đủ thông tin' });
  }

  const normalizedGender = gender ? String(gender).trim() : null;
  if (normalizedGender && !['male', 'female', 'other'].includes(normalizedGender)) {
    return res.status(400).json({ success: false, message: 'Giới tính không hợp lệ' });
  }

  const userData = {
    name: String(name || '').trim(),
    email: String(email || '').trim().toLowerCase(),
    phone: phone || '',
    date_of_birth: normalizeDateOfBirth(date_of_birth),
    gender: normalizedGender
  };

  return userModel.updateUser(userId, userData, (err) => {
    if (err) {
      console.error('[UPDATE_PROFILE_ERROR]', err);
      return res.status(500).json({ success: false, message: 'Lỗi server khi cập nhật profile' });
    }

    return userModel.getUserById(userId, (profileErr, updatedUser) => {
      if (profileErr) {
        console.error('[UPDATE_PROFILE_FETCH_ERROR]', profileErr);
        return res.status(500).json({ success: false, message: 'Cập nhật thành công nhưng không thể tải lại hồ sơ' });
      }

      return attachMonthlyLoyaltyStats(updatedUser, (statsErr, profileUser) => {
        if (statsErr) {
          console.error('[UPDATE_PROFILE_LOYALTY_ERROR]', statsErr);
          return res.status(500).json({ success: false, message: 'Cập nhật thành công nhưng không thể tính lại điểm thành viên' });
        }

        return res.status(200).json({
          success: true,
          message: 'Cập nhật profile thành công',
          data: profileUser
        });
      });
    });
  });
};

// ─── UPLOAD AVATAR ───────────────────────────────────────────
const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '..', '..', '..', 'uploads', 'avatars');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, `avatar_${req.user.id}_${Date.now()}${ext}`);
  }
});

const avatarUpload = multer({
  storage: avatarStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Chỉ hỗ trợ file ảnh JPG, PNG, WEBP'));
    }
  }
}).single('avatar');

exports.uploadAvatar = (req, res) => {
  avatarUpload(req, res, (err) => {
    if (err) {
      const message = err.code === 'LIMIT_FILE_SIZE'
        ? 'Ảnh đại diện không được vượt quá 5MB'
        : err.message || 'Lỗi khi tải ảnh lên';
      return res.status(400).json({ success: false, message });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Vui lòng chọn ảnh đại diện' });
    }

    const avatarPath = `/uploads/avatars/${req.file.filename}`;

    return userModel.updateUserAvatar(req.user.id, avatarPath, (dbErr) => {
      if (dbErr) {
        console.error('[UPLOAD_AVATAR_ERROR]', dbErr);
        return res.status(500).json({ success: false, message: 'Lỗi server khi lưu avatar' });
      }
      return res.status(200).json({
        success: true,
        message: 'Cập nhật ảnh đại diện thành công',
        avatar: avatarPath
      });
    });
  });
};
