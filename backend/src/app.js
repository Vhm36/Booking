const express = require('express');
const cors = require('cors');
const path = require('path');
const { rateLimit } = require('express-rate-limit');
const bodyParser = require('body-parser');
require('./config/loadEnv');

const authRoutes = require('./routes/authRoutes');
const serviceRoutes = require('./routes/serviceRoutes');
const appointmentRoutes = require('./routes/appointmentRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const staffRoutes = require('./routes/staffRoutes');
const customerRoutes = require('./routes/customerRoutes');
const adminUserRoutes = require('./routes/adminUserRoutes');
const chatRoutes = require('./routes/chatRoutes');
const voucherRoutes = require('./routes/voucherRoutes');

// Cron Jobs
const { startReminderJob } = require('./jobs/appointmentReminderJob');
const { startRFMJob } = require('./jobs/rfmClassificationJob');

// Smart Services
const cancellationScoreService = require('./services/cancellationScoreService');
const rfmService = require('./services/rfmService');

const app = express();
app.set('trust proxy', 1);

const defaultAllowedOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost',
  'http://127.0.0.1'
];

const envAllowedOrigins = (process.env.FRONTEND_URLS || process.env.FRONTEND_URL || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const allowedOrigins = [...new Set([...defaultAllowedOrigins, ...envAllowedOrigins])];
const isLocalDevelopmentOrigin = (origin) =>
  /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);

const corsOptions = {
  origin: (origin, callback) => {
    if (
      !origin ||
      allowedOrigins.includes(origin) ||
      (process.env.NODE_ENV !== 'production' && isLocalDevelopmentOrigin(origin))
    ) {
      return callback(null, true);
    }

    return callback(new Error(`CORS blocked origin: ${origin}`));
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

app.use((req, res, next) => {
  res.header('X-Content-Type-Options', 'nosniff');
  res.header('X-Frame-Options', 'DENY');
  res.header('X-XSS-Protection', '1; mode=block');
  next();
});

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Quá nhiều yêu cầu từ IP này, vui lòng thử lại sau.'
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  skipSuccessfulRequests: true,
  message: 'Đăng nhập sai quá nhiều lần, vui lòng thử lại sau 15 phút.'
});

app.use(generalLimiter);

app.use('/api/auth/login', loginLimiter);
app.use('/api/auth', authRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/bookings', appointmentRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/vouchers', voucherRoutes);
app.use('/api/admin-users', adminUserRoutes);
app.use('/api/admin/dashboard', dashboardRoutes);

app.get('/', (req, res) => {
  res.json({ message: 'API đang hoạt động', status: 'ok' });
});

// Smart Booking APIs
const { verifyToken, verifyAdmin } = require('./middleware/authMiddleware');

// Cancellation Score — Check before booking
app.post('/api/cancellation-score', verifyToken, async (req, res) => {
  try {
    const { appointmentDate, appointmentTime } = req.body;
    const result = await cancellationScoreService.calculateScore(
      req.user.id,
      appointmentDate,
      appointmentTime
    );
    return res.json({ success: true, data: result });
  } catch (err) {
    console.error('[CANCELLATION_SCORE_ERROR]', err);
    return res.status(500).json({ success: false, message: 'Không thể tính điểm rủi ro' });
  }
});

// RFM — Manual trigger (admin)
app.post('/api/admin/rfm/run', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const result = await rfmService.runFullAnalysis();
    return res.json({ success: true, data: result });
  } catch (err) {
    console.error('[RFM_RUN_ERROR]', err);
    return res.status(500).json({ success: false, message: 'Không thể chạy phân tích RFM' });
  }
});

// RFM — Get segment stats (admin)
app.get('/api/admin/rfm/stats', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const stats = await rfmService.getSegmentStats();
    return res.json({ success: true, data: stats });
  } catch (err) {
    console.error('[RFM_STATS_ERROR]', err);
    return res.status(500).json({ success: false, message: 'Không thể lấy thống kê RFM' });
  }
});

// Start Cron Jobs
try {
  startReminderJob();
  startRFMJob();
} catch (cronErr) {
  console.error('[CRON_INIT_ERROR]', cronErr.message);
}

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Không tìm thấy đường dẫn API'
  });
});

app.use((err, req, res, next) => {
  if (process.env.NODE_ENV !== 'production') {
    console.error('[ERROR]', err);
  }

  const status = err.status || err.statusCode || 500;
  const errorResponse = {
    success: false,
    message: err.message || 'Lỗi máy chủ'
  };

  if (process.env.NODE_ENV !== 'production') {
    errorResponse.stack = err.stack;
  }

  res.status(status).json(errorResponse);
});

module.exports = app;
