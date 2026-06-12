const fs = require('fs');
const path = require('path');

const TEMPLATE_PATH = path.resolve(__dirname, '..', '..', 'templates', 'email', 'reset-password.html');
const FALLBACK_TEMPLATE = `
  <html><body>
  <p>Xin chào <strong>{{userName}}</strong>,</p>
  <p>Nhấn vào link sau để đặt lại mật khẩu: <a href="{{resetLink}}">{{resetLink}}</a></p>
  <p>Link có hiệu lực trong {{expireInLabel}}.</p>
  <p>Hỗ trợ: {{supportEmail}}</p>
  </body></html>
`;

let cachedResetTemplate = '';
try {
  cachedResetTemplate = fs.readFileSync(TEMPLATE_PATH, 'utf8');
} catch (error) {
  cachedResetTemplate = '';
}

const escapeHtml = (value = '') =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const fillTemplate = (template, variables) =>
  Object.entries(variables).reduce((html, [key, value]) => {
    const token = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    return html.replace(token, escapeHtml(value));
  }, template);

const buildResetPasswordEmailPayload = ({
  userName = '',
  resetLink = '',
  expireInLabel = '15 ph\u00fat',
  supportEmail = 'support@beautybook.vn'
} = {}) => {
  const safeName = userName || 'b\u1ea1n';
  const safeLink = resetLink || '#';

  const subject = 'BeautyBook - \u0110\u1eb7t l\u1ea1i m\u1eadt kh\u1ea9u';
  const htmlTemplate = cachedResetTemplate || FALLBACK_TEMPLATE;

  const html = fillTemplate(htmlTemplate, {
    subject,
    userName: safeName,
    resetLink: safeLink,
    expireInLabel,
    supportEmail
  });

  const text = [
    `Xin chào ${safeName},`,
    '',
    'Chúng tôi đã nhận được yêu cầu đặt lại mật khẩu cho tài khoản BeautyBook của bạn.',
    `Đặt lại mật khẩu tại đây: ${safeLink}`,
    `Link có hiệu lực trong ${expireInLabel}.`,
    'Nếu bạn không yêu cầu thao tác này, vui lòng bỏ qua email.',
    `Hỗ trợ: ${supportEmail}`
  ].join('\n');

  return {
    subject,
    html,
    text
  };
};

module.exports = {
  buildResetPasswordEmailPayload
};
