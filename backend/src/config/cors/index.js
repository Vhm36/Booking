const defaultAllowedOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost',
  'http://127.0.0.1'
];

const envList = (...names) =>
  names
    .flatMap((name) => String(process.env[name] || '').split(','))
    .map((value) => value.trim())
    .filter(Boolean);

const normalizeOrigin = (value) => {
  if (!value) {
    return null;
  }

  const trimmed = String(value).trim().replace(/\/+$/, '');

  try {
    return new URL(trimmed).origin;
  } catch (err) {
    return trimmed;
  }
};

const envAllowedOrigins = envList(
  'FRONTEND_URLS',
  'FRONTEND_URL',
  'CLIENT_URLS',
  'CLIENT_URL',
  'CORS_ORIGINS',
  'CORS_ORIGIN'
);

const allowedOrigins = [
  ...new Set([...defaultAllowedOrigins, ...envAllowedOrigins].map(normalizeOrigin).filter(Boolean))
];

const allowAllOrigins = ['1', 'true', 'yes'].includes(
  String(process.env.CORS_ALLOW_ALL || '').trim().toLowerCase()
);

const isLocalDevelopmentOrigin = (origin) =>
  /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);

const isAllowedOrigin = (origin) => {
  if (!origin || allowAllOrigins) {
    return true;
  }

  return (
    allowedOrigins.includes(normalizeOrigin(origin)) ||
    (process.env.NODE_ENV !== 'production' && isLocalDevelopmentOrigin(origin))
  );
};

const corsOrigin = (origin, callback) => {
  if (isAllowedOrigin(origin)) {
    return callback(null, true);
  }

  return callback(new Error(`CORS blocked origin: ${origin}`));
};

const expressCorsOptions = {
  origin: corsOrigin,
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

const socketCorsOptions = {
  origin: corsOrigin,
  methods: ['GET', 'POST'],
  credentials: true
};

module.exports = {
  allowedOrigins,
  expressCorsOptions,
  isAllowedOrigin,
  socketCorsOptions
};
