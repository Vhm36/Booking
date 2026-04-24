const nodemailer = require('nodemailer');

let transporter;
let transporterKey = '';

const getMailConfig = () => {
  const host = (process.env.SMTP_HOST || process.env.EMAIL_HOST || '').trim();
  const port = Number(process.env.SMTP_PORT || process.env.EMAIL_PORT || 587);
  const user = (process.env.SMTP_USER || process.env.EMAIL_USER || '').trim();
  const pass = (process.env.SMTP_PASS || process.env.EMAIL_PASSWORD || '').trim();
  const from = (process.env.SMTP_FROM || process.env.EMAIL_FROM || `BeautyBook <${user}>`).trim();
  const secure =
    String(process.env.SMTP_SECURE || process.env.EMAIL_SECURE || '')
      .trim()
      .toLowerCase() === 'true' || port === 465;

  return {
    host,
    port,
    user,
    pass,
    from,
    secure
  };
};

const ensureTransporter = () => {
  const config = getMailConfig();
  const currentKey = `${config.host}:${config.port}:${config.user}:${config.secure}`;

  if (!config.host || !config.port || !config.user || !config.pass) {
    const error = new Error(
      'Email chưa được cấu hình. Hãy cập nhật SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS (hoặc EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASSWORD) trong backend/.env.'
    );
    error.status = 503;
    throw error;
  }

  if (!transporter || transporterKey !== currentKey) {
    transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.user,
        pass: config.pass
      }
    });
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
  verifySmtpConnection
};
