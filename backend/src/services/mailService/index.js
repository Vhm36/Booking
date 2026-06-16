const nodemailer = require('nodemailer');

let transporter;
let transporterKey = '';

const getBooleanEnv = (name, defaultValue = false) => {
  const raw = process.env[name];
  if (typeof raw === 'undefined' || raw === '') {
    return defaultValue;
  }
  return ['1', 'true', 'yes', 'on'].includes(String(raw).trim().toLowerCase());
};

const getMailConfig = () => {
  const service = (process.env.SMTP_SERVICE || process.env.EMAIL_SERVICE || '').trim();
  const host = (process.env.SMTP_HOST || process.env.EMAIL_HOST || '').trim();
  const port = Number(process.env.SMTP_PORT || process.env.EMAIL_PORT || 587);
  const user = (process.env.SMTP_USER || process.env.EMAIL_USER || '').trim();
  const pass = (process.env.SMTP_PASS || process.env.EMAIL_PASSWORD || process.env.EMAIL_PASS || '').trim();
  const displayName = (process.env.SMTP_DISPLAY_NAME || process.env.EMAIL_DISPLAY_NAME || 'BeautyBook').trim();
  const from = (process.env.SMTP_FROM || process.env.EMAIL_FROM || `${displayName} <${user}>`).trim();
  const secure = getBooleanEnv('SMTP_SECURE', getBooleanEnv('EMAIL_SECURE', !service && port === 465));
  const requireTLS = getBooleanEnv('SMTP_REQUIRE_TLS', getBooleanEnv('EMAIL_REQUIRE_TLS', false));
  const ignoreTLS = getBooleanEnv('SMTP_IGNORE_TLS', getBooleanEnv('EMAIL_IGNORE_TLS', false));
  const clientId = (process.env.SMTP_CLIENT_ID || process.env.EMAIL_CLIENT_ID || '').trim();
  const clientSecret = (process.env.SMTP_CLIENT_SECRET || process.env.EMAIL_CLIENT_SECRET || '').trim();
  const refreshToken = (process.env.SMTP_REFRESH_TOKEN || process.env.EMAIL_REFRESH_TOKEN || '').trim();
  const accessToken = (process.env.SMTP_ACCESS_TOKEN || process.env.EMAIL_ACCESS_TOKEN || '').trim();

  return {
    service,
    host,
    port,
    user,
    pass,
    from,
    secure,
    requireTLS,
    ignoreTLS,
    clientId,
    clientSecret,
    refreshToken,
    accessToken,
    hasPasswordAuth: Boolean(user && pass),
    hasOAuth2Auth: Boolean(user && clientId && clientSecret && (refreshToken || accessToken))
  };
};

const getMailConfigStatus = () => {
  const config = getMailConfig();
  const hasServer = Boolean(config.service || config.host);
  const hasUser = Boolean(config.user);
  const hasAuth = Boolean(config.hasPasswordAuth || config.hasOAuth2Auth);
  const missing = [];

  if (!hasServer) {
    missing.push('SMTP_HOST/EMAIL_HOST hoặc SMTP_SERVICE/EMAIL_SERVICE');
  }
  if (!hasUser) {
    missing.push('SMTP_USER hoặc EMAIL_USER');
  }
  if (!hasAuth) {
    missing.push('SMTP_PASS/EMAIL_PASSWORD hoặc OAuth2 EMAIL_CLIENT_ID, EMAIL_CLIENT_SECRET, EMAIL_REFRESH_TOKEN');
  }

  return {
    configured: hasServer && hasUser && hasAuth,
    service: config.service || '',
    host: config.host || '',
    port: config.port,
    secure: config.secure,
    authMode: config.hasOAuth2Auth ? 'oauth2' : (config.hasPasswordAuth ? 'password' : 'none'),
    missing
  };
};

const createAuthOptions = (config) => {
  if (config.hasOAuth2Auth) {
    return {
      type: 'OAuth2',
      user: config.user,
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      refreshToken: config.refreshToken || undefined,
      accessToken: config.accessToken || undefined
    };
  }

  return {
    user: config.user,
    pass: config.pass
  };
};

const ensureTransporter = () => {
  const config = getMailConfig();
  const status = getMailConfigStatus();

  if (!status.configured) {
    const error = new Error(`Email chưa được cấu hình đầy đủ. Thiếu: ${status.missing.join(', ')}.`);
    error.status = 503;
    throw error;
  }

  const currentKey = [
    config.service,
    config.host,
    config.port,
    config.user,
    config.secure,
    config.requireTLS,
    config.ignoreTLS,
    status.authMode
  ].join(':');

  if (!transporter || transporterKey !== currentKey) {
    const transportOptions = {
      secure: config.secure,
      auth: createAuthOptions(config),
      requireTLS: config.requireTLS,
      ignoreTLS: config.ignoreTLS,
      connectionTimeout: Number(process.env.SMTP_CONNECTION_TIMEOUT || 15000),
      greetingTimeout: Number(process.env.SMTP_GREETING_TIMEOUT || 15000),
      socketTimeout: Number(process.env.SMTP_SOCKET_TIMEOUT || 30000)
    };

    if (config.service) {
      transportOptions.service = config.service;
    } else {
      transportOptions.host = config.host;
      transportOptions.port = config.port;
    }

    transporter = nodemailer.createTransport(transportOptions);
    transporterKey = currentKey;
  }

  return {
    transporter,
    from: config.from
  };
};

const sendEmail = async ({ to, subject, html, text, replyTo }) => {
  const normalizedTo = String(to || '').trim();
  if (!normalizedTo) {
    const error = new Error('Thiếu email người nhận.');
    error.status = 400;
    throw error;
  }

  const { transporter: activeTransporter, from } = ensureTransporter();

  const info = await activeTransporter.sendMail({
    from,
    to: normalizedTo,
    subject: String(subject || 'Thông báo từ BeautyBook').trim(),
    html,
    text,
    replyTo: replyTo || process.env.SMTP_REPLY_TO || process.env.EMAIL_REPLY_TO || undefined
  });

  return {
    accepted: info.accepted || [],
    rejected: info.rejected || [],
    messageId: info.messageId || ''
  };
};

const verifySmtpConnection = async () => {
  const { transporter: activeTransporter } = ensureTransporter();
  await activeTransporter.verify();
  return true;
};

module.exports = {
  sendEmail,
  verifySmtpConnection,
  getMailConfigStatus
};
