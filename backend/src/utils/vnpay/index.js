const crypto = require('crypto');

const DEFAULT_PAYMENT_URL = 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html';
const VNPAY_TIMEZONE = 'Asia/Ho_Chi_Minh';

const getVnpayPaymentUrl = () => process.env.VNPAY_PAYMENT_URL || DEFAULT_PAYMENT_URL;

const encodeValue = (value) => encodeURIComponent(String(value)).replace(/%20/g, '+');

const compactSpaces = (value) => String(value || '').trim().replace(/\s+/g, ' ');

const toAsciiText = (value) =>
  compactSpaces(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^0-9a-zA-Z .,:/_-]/g, '')
    .slice(0, 255);

const buildVnpayQuery = (params) => {
  const entries = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => [key, String(value)])
    .sort(([keyA], [keyB]) => keyA.localeCompare(keyB));

  return entries
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeValue(value)}`)
    .join('&');
};

const createSecureHash = (params, secret) =>
  crypto.createHmac('sha512', secret).update(Buffer.from(buildVnpayQuery(params), 'utf-8')).digest('hex');

const constantTimeCompare = (left, right) => {
  const leftBuffer = Buffer.from(String(left || ''), 'utf-8');
  const rightBuffer = Buffer.from(String(right || ''), 'utf-8');

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
};

const verifyVnpaySignature = (query, secret) => {
  const params = { ...query };
  const secureHash = params.vnp_SecureHash;

  delete params.vnp_SecureHash;
  delete params.vnp_SecureHashType;

  if (!secureHash) {
    return { isValid: false, params };
  }

  const signed = createSecureHash(params, secret);
  return {
    isValid: constantTimeCompare(secureHash, signed),
    params,
    secureHash,
    signed
  };
};

const formatVnpayDate = (date = new Date()) => {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: VNPAY_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

  const parts = formatter.formatToParts(date).reduce((acc, part) => {
    if (part.type !== 'literal') {
      acc[part.type] = part.value;
    }
    return acc;
  }, {});

  return `${parts.year}${parts.month}${parts.day}${parts.hour}${parts.minute}${parts.second}`;
};

const addMinutes = (date, minutes) => new Date(date.getTime() + minutes * 60 * 1000);

const getClientIp = (req) => {
  const forwarded = req.headers['x-forwarded-for'];
  const source =
    (typeof forwarded === 'string' && forwarded.split(',')[0]) ||
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    req.ip ||
    '';

  return String(source).replace(/^::ffff:/, '') || '127.0.0.1';
};

const buildPaymentReference = (appointmentId) => {
  const timestamp = formatVnpayDate(new Date());
  const randomSuffix = String(Math.floor(Math.random() * 1000)).padStart(3, '0');
  return `APT${appointmentId}-${timestamp}-${randomSuffix}`;
};

const buildInvoiceNumber = (payment) => {
  const safeId = String(payment?.id || '').padStart(6, '0');
  return `INV-${new Date().getFullYear()}-${safeId}`;
};

module.exports = {
  addMinutes,
  buildInvoiceNumber,
  buildPaymentReference,
  buildVnpayQuery,
  createSecureHash,
  formatVnpayDate,
  getClientIp,
  getVnpayPaymentUrl,
  toAsciiText,
  verifyVnpaySignature
};
