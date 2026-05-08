const fs = require('fs');
const path = require('path');

const TEMPLATE_PATH = path.resolve(__dirname, '..', '..', 'templates', 'email', 'reset-password.html');
const FALLBACK_TEMPLATE = `
  <html><body>
  <p>Xin chao <strong>{{userName}}</strong>,</p>
  <p>Nhan vao link sau de dat lai mat khau: <a href="{{resetLink}}">{{resetLink}}</a></p>
  <p>Link co hieu luc trong {{expireInLabel}}.</p>
  <p>Ho tro: {{supportEmail}}</p>
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
