const fs = require('fs');
const path = require('path');

const TEMPLATE_PATH = path.resolve(__dirname, '..', '..', 'templates', 'email', 'reset-password.html');

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
  expireInLabel = '15 phút',
  supportEmail = 'support@beautybook.vn'
} = {}) => {
  const safeName = userName || 'bạn';
  const safeLink = resetLink || '#';

  const subject = 'BeautyBook - Đặt lại mật khẩu';
  let htmlTemplate = '';
  try {
    htmlTemplate = fs.readFileSync(TEMPLATE_PATH, 'utf8');
  } catch (error) {
    htmlTemplate = `
      <html><body>
      <p>Xin chào <strong>{{userName}}</strong>,</p>
      <p>Nhấn vào link sau để đặt lại mật khẩu: <a href="{{resetLink}}">{{resetLink}}</a></p>
      <p>Link có hiệu lực trong {{expireInLabel}}.</p>
      <p>Hỗ trợ: {{supportEmail}}</p>
      </body></html>
    `;
  }

  const html = fillTemplate(htmlTemplate, {
    subject,
    userName: safeName,
    resetLink: safeLink,
    expireInLabel,
    supportEmail
  });

  const text = [
    `Xin chao ${safeName},`,
    '',
    'Chung toi da nhan duoc yeu cau dat lai mat khau cho tai khoan BeautyBook cua ban.',
    `Dat lai mat khau tai day: ${safeLink}`,
    `Link co hieu luc trong ${expireInLabel}.`,
    'Neu ban khong yeu cau thao tac nay, vui long bo qua email.',
    `Ho tro: ${supportEmail}`
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
