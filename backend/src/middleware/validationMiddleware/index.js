const { body, param, query, validationResult } = require('express-validator');

// Middleware để handle validation errors
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Dữ liệu không hợp lệ',
      errors: errors.array().map(err => ({
        field: err.path || err.param,
        message: err.msg
      }))
    });
  }
  next();
};

// Auth Validations
const validateRegister = [
  body('name')
    .trim()
    .notEmpty().withMessage('Tên không được để trống')
    .isLength({ min: 2, max: 100 }).withMessage('Tên phải từ 2 - 100 ký tự'),
  body('email')
    .trim()
    .isEmail().withMessage('Email không hợp lệ')
    .normalizeEmail(),
  body('password')
    .isLength({ min: 6 }).withMessage('Mật khẩu phải ít nhất 6 ký tự')
    .matches(/^(?=.*[a-zA-Z])(?=.*\d)/).withMessage('Mật khẩu phải chứa chữ và số'),
  body('phone')
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .matches(/^[0-9]{10,11}$/).withMessage('Số điện thoại không hợp lệ'),
  body('date_of_birth')
    .trim()
    .notEmpty().withMessage('Ngày sinh không được để trống')
    .isISO8601({ strict: true }).withMessage('Ngày sinh phải định dạng YYYY-MM-DD')
    .custom((value) => {
      const birthDate = new Date(value);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (birthDate >= today) {
        throw new Error('Ngày sinh phải nhỏ hơn ngày hiện tại');
      }

      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age -= 1;
      }

      if (age < 13 || age > 100) {
        throw new Error('Tuổi đăng ký phải từ 13 đến 100');
      }

      return true;
    }),
  handleValidationErrors
];

const validateLogin = [
  body('email')
    .trim()
    .isEmail().withMessage('Email không hợp lệ')
    .normalizeEmail(),
  body('password')
    .notEmpty().withMessage('Mật khẩu không được để trống'),
  handleValidationErrors
];

const validateForgotPassword = [
  body('email')
    .trim()
    .isEmail().withMessage('Email không hợp lệ')
    .normalizeEmail(),
  handleValidationErrors
];

const validateResetPassword = [
  body('token')
    .trim()
    .notEmpty().withMessage('Token đặt lại mật khẩu không hợp lệ'),
  body('newPassword')
    .isLength({ min: 6 }).withMessage('Mật khẩu mới phải ít nhất 6 ký tự')
    .matches(/^(?=.*[a-zA-Z])(?=.*\d)/).withMessage('Mật khẩu mới phải chứa chữ và số'),
  handleValidationErrors
];

const validateGoogleLogin = [
  body('idToken')
    .trim()
    .notEmpty().withMessage('Thiếu Google ID token'),
  handleValidationErrors
];

const validateZaloLogin = [
  body('code')
    .trim()
    .notEmpty().withMessage('Thiếu mã xác thực Zalo'),
  body('codeVerifier')
    .trim()
    .notEmpty().withMessage('Thiếu code verifier'),
  handleValidationErrors
];

const validateUpdateProfile = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 }).withMessage('Tên phải từ 2 - 100 ký tự'),
  body('email')
    .optional()
    .trim()
    .isEmail().withMessage('Email không hợp lệ')
    .normalizeEmail(),
  body('phone')
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .matches(/^[0-9]{10,11}$/).withMessage('Số điện thoại không hợp lệ'),
  body('date_of_birth')
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isISO8601({ strict: true }).withMessage('Ngày sinh phải định dạng YYYY-MM-DD')
    .custom((value) => {
      const birthDate = new Date(value);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (birthDate >= today) {
        throw new Error('Ngày sinh phải nhỏ hơn ngày hiện tại');
      }

      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age -= 1;
      }

      if (age < 13 || age > 100) {
        throw new Error('Tuổi phải từ 13 đến 100');
      }

      return true;
    }),
  body('gender')
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isIn(['male', 'female', 'other']).withMessage('Giới tính không hợp lệ'),
  handleValidationErrors
];

// Service Validations
const validateCreateService = [
  body('name')
    .trim()
    .notEmpty().withMessage('Tên dịch vụ không được để trống')
    .isLength({ min: 2, max: 200 }).withMessage('Tên dịch vụ phải từ 2 - 200 ký tự'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 }).withMessage('Mô tả không vượt quá 1000 ký tự'),
  body('price')
    .isFloat({ min: 0 }).withMessage('Giá phải là số dương'),
  body('duration')
    .isInt({ min: 1, max: 1440 }).withMessage('Thời lượng phải từ 1 - 1440 phút'),
  body('category')
    .trim()
    .notEmpty().withMessage('Danh mục không được để trống'),
  body('service_code')
    .optional()
    .trim()
    .isLength({ max: 50 }).withMessage('Mã dịch vụ không được vượt quá 50 ký tự'),
  handleValidationErrors
];

const validateUpdateService = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 200 }).withMessage('Tên dịch vụ phải từ 2 - 200 ký tự'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 }).withMessage('Mô tả không vượt quá 1000 ký tự'),
  body('price')
    .optional()
    .isFloat({ min: 0 }).withMessage('Giá phải là số dương'),
  body('duration')
    .optional()
    .isInt({ min: 1, max: 1440 }).withMessage('Thời lượng phải từ 1 - 1440 phút'),
  body('category')
    .optional()
    .trim(),
  body('service_code')
    .optional()
    .trim()
    .isLength({ max: 50 }).withMessage('Mã dịch vụ không được vượt quá 50 ký tự'),
  handleValidationErrors
];

const validateServiceId = [
  param('id')
    .isInt({ min: 1 }).withMessage('ID dịch vụ không hợp lệ'),
  handleValidationErrors
];

const timeToMinutes = (value) => {
  const [hour, minute] = String(value || '').split(':').map(Number);
  return hour * 60 + minute;
};

const getBusinessWindowForDate = (dateValue) => {
  const [year, month, day] = String(dateValue || '').split('-').map(Number);

  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return { start: '08:00', end: '21:00', label: '08:00 đến 21:00' };
  }

  const date = new Date(Date.UTC(year, month - 1, day));
  const dayOfWeek = date.getUTCDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

  return isWeekend
    ? { start: '07:00', end: '23:00', label: '07:00 đến 23:00' }
    : { start: '08:00', end: '21:00', label: '08:00 đến 21:00' };
};

// Appointment Validations 
const validateCreateAppointment = [
  body('service_id')
    .isInt({ min: 1 }).withMessage('ID dịch vụ không hợp lệ'),
  body('staff_id')
    .optional({ nullable: true })
    .isInt({ min: 1 }).withMessage('ID nhân viên không hợp lệ'),
  body('appointment_date')
    .isISO8601().withMessage('Ngày hẹn phải định dạng YYYY-MM-DD')
    .custom(value => {
      const date = new Date(value);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (date < today) {
        throw new Error('Ngày hẹn không thể trong quá khứ');
      }
      return true;
    }),
  body('appointment_time')
    .matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/).withMessage('Giờ hẹn phải định dạng HH:MM hoặc HH:MM:SS')
    .customSanitizer((value) => (value.length === 5 ? `${value}:00` : value))
    .custom((value, { req }) => {
      const businessWindow = getBusinessWindowForDate(req.body.appointment_date);
      const appointmentMinutes = timeToMinutes(value);
      const minMinutes = timeToMinutes(businessWindow.start);
      const maxMinutes = timeToMinutes(businessWindow.end);

      if (appointmentMinutes < minMinutes || appointmentMinutes > maxMinutes) {
        throw new Error(`Giờ hẹn phải từ ${businessWindow.label}`);
      }
      return true;
    }),
  body('notes') // Ghi chú không bắt buộc, nhưng nếu có thì phải tối đa 500 ký tự
    .optional()
    .trim()
    .isLength({ max: 500 }).withMessage('Ghi chú không vượt quá 500 ký tự'),
  handleValidationErrors
];

const validateUpdateAppointmentStatus = [
  param('id')
    .isInt({ min: 1 }).withMessage('ID lịch hẹn không hợp lệ'),
  body('status')
    .isIn(['pending', 'confirmed', 'completed', 'cancelled']).withMessage('Trạng thái không hợp lệ'),
  handleValidationErrors
];

const validateAddReview = [
  param('id')
    .isInt({ min: 1 }).withMessage('ID lịch hẹn không hợp lệ'),
  body('rating')
    .isInt({ min: 1, max: 5 }).withMessage('Đánh giá phải từ 1 - 5 sao'),
  body('review')
    .optional()
    .trim()
    .isLength({ max: 500 }).withMessage('Bình luận không vượt quá 500 ký tự'),
  handleValidationErrors
];

const validateAppointmentId = [
  param('id')
    .isInt({ min: 1 }).withMessage('ID lịch hẹn không hợp lệ'),
  handleValidationErrors
];

// Staff Validations
const validateCreateStaff = [
  body('name')
    .trim()
    .notEmpty().withMessage('Tên nhân viên không được để trống')
    .isLength({ min: 2, max: 100 }).withMessage('Tên nhân viên phải từ 2 - 100 ký tự'),
  body('email')
    .trim()
    .isEmail().withMessage('Email không hợp lệ')
    .normalizeEmail(),
  body('phone')
    .trim()
    .matches(/^[0-9]{10,11}$/).withMessage('Số điện thoại không hợp lệ'),
  body('password')
    .isLength({ min: 6 }).withMessage('Mật khẩu phải ít nhất 6 ký tự'),
  handleValidationErrors
];

const validateStaffId = [
  param('id')
    .isInt({ min: 1 }).withMessage('ID nhân viên không hợp lệ'),
  handleValidationErrors
];

const validateUpdateStaff = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 }).withMessage('Tên nhân viên phải từ 2 - 100 ký tự'),
  body('phone')
    .optional()
    .trim()
    .matches(/^[0-9]{10,11}$/).withMessage('Số điện thoại không hợp lệ'),
  handleValidationErrors
];

// Customer Validations
const validateCreateCustomer = [
  body('name')
    .trim()
    .notEmpty().withMessage('Tên khách hàng không được để trống')
    .isLength({ min: 2, max: 100 }).withMessage('Tên khách hàng phải từ 2 - 100 ký tự'),
  body('email')
    .trim()
    .isEmail().withMessage('Email không hợp lệ')
    .normalizeEmail(),
  body('phone')
    .optional()
    .trim()
    .matches(/^[0-9]{10,11}$/).withMessage('Số điện thoại không hợp lệ'),
  handleValidationErrors
];

const validateCustomerId = [
  param('id')
    .isInt({ min: 1 }).withMessage('ID khách hàng không hợp lệ'),
  handleValidationErrors
];

const validateUpdateCustomer = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 }).withMessage('Tên khách hàng phải từ 2 - 100 ký tự'),
  body('email')
    .optional()
    .trim()
    .isEmail().withMessage('Email không hợp lệ')
    .normalizeEmail(),
  body('phone')
    .optional()
    .trim()
    .matches(/^[0-9]{10,11}$/).withMessage('Số điện thoại không hợp lệ'),
  handleValidationErrors
];

// Query Validations
const validatePaginationQuery = [
  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('Trang phải là số dương'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage('Giới hạn phải từ 1 - 100'),
  handleValidationErrors
];

const validateStaffAvailableQuery = [
  query('date')
    .isISO8601().withMessage('Ngày phải định dạng YYYY-MM-DD'),
  query('time')
    .matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Giờ phải định dạng HH:MM'),
  handleValidationErrors
];

module.exports = {
  handleValidationErrors,
  validateRegister,
  validateLogin,
  validateForgotPassword,
  validateResetPassword,
  validateGoogleLogin,
  validateZaloLogin,
  validateUpdateProfile,
  validateCreateService,
  validateUpdateService,
  validateServiceId,
  validateCreateAppointment,
  validateUpdateAppointmentStatus,
  validateAddReview,
  validateAppointmentId,
  validateCreateStaff,
  validateStaffId,
  validateUpdateStaff,
  validateCreateCustomer,
  validateCustomerId,
  validateUpdateCustomer,
  validatePaginationQuery,
  validateStaffAvailableQuery
};
