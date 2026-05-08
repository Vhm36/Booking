const fs = require('fs');
const path = require('path');

const templatePath = path.resolve(__dirname, '..', '..', 'templates', 'email', 'voucher-notification.html');

const readVoucherTemplate = () => {
  try {
    return fs.readFileSync(templatePath, 'utf8');
  } catch (err) {
    return '';
  }
};

const renderTemplate = (template, data) => {
  if (!template) {
    return '';
  }

  return template
    .replace(/{{#if\s+([a-zA-Z0-9_]+)}}([\s\S]*?){{\/if}}/g, (_, key, content) =>
      data[key] ? content : ''
    )
    .replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_, key) => escapeHtml(data[key] ?? ''));
};

const formatCurrency = (value) => {
  if (!Number.isFinite(Number(value))) {
    return 'Không';
  }

  return `${Number(value).toLocaleString('vi-VN')} VND`;
};

const formatDate = (value) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return 'Sẽ được cập nhật';
  }

  return parsed.toLocaleDateString('vi-VN');
};

const escapeHtml = (value = '') =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const getVoucherSourceMeta = ({ source = 'bot', issuedByName = '', reason = '' } = {}) => {
  const normalizedSource = String(source || 'bot').trim().toLowerCase();
  const cleanIssuedByName = String(issuedByName || '').trim();
  const cleanReason = String(reason || '').trim();

  if (normalizedSource === 'admin') {
    return {
      source: 'admin',
      badge: 'Từ admin',
      subject: 'Voucher mới dành cho bạn từ BeautyBook',
      message:
        'Voucher này được đội ngũ BeautyBook gửi trực tiếp để bạn dùng cho lần đặt lịch tiếp theo.',
      issuedByName: cleanIssuedByName,
      reason: cleanReason
    };
  }

  return {
    source: 'bot',
    badge: 'Từ bot gợi ý',
    subject: 'BeautyBook vừa gợi ý một voucher phù hợp cho bạn',
    message:
      'Voucher này được hệ thống tự động gợi ý dựa trên ưu đãi hiện có và hành vi đặt lịch gần đây của bạn.',
    issuedByName: cleanIssuedByName,
    reason: cleanReason
  };
};

const getDiscountLabel = (voucher = {}) => {
  if (String(voucher.voucher_type || '').trim().toLowerCase() === 'percentage') {
    return `-${Number(voucher.discount_percent || 0)}%`;
  }

  return formatCurrency(voucher.discount_amount || 0);
};

const buildVoucherEmailPayload = ({
  customer = {},
  voucher = {},
  source = 'bot',
  issuedByName = '',
  reason = '',
  redeemUrl = '',
  supportEmail = 'support@beautybook.vn'
} = {}) => {
  const sourceMeta = getVoucherSourceMeta({ source, issuedByName, reason });
  const customerName = customer.name || 'bạn';
  const voucherCode = voucher.code || 'VOUCHER';
  const voucherDescription =
    voucher.description || 'Ưu đãi này đã được thêm vào tài khoản của bạn trên BeautyBook.';
  const expiryDate = formatDate(voucher.expiry_date);
  const discountLabel = getDiscountLabel(voucher);
  const minOrder = voucher.min_order_value ? formatCurrency(voucher.min_order_value) : 'Không yêu cầu';
  const maxDiscount = voucher.max_discount_amount ? formatCurrency(voucher.max_discount_amount) : 'Không giới hạn';
  const actionUrl = redeemUrl || '#';

  const html = `<!DOCTYPE html>
<html lang="vi">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(sourceMeta.subject)}</title>
  </head>
  <body style="margin:0;padding:24px;background:#f4f7fb;font-family:Segoe UI,Tahoma,sans-serif;color:#12223b;">
    <div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:24px;overflow:hidden;border:1px solid #dbe5f1;">
      <div style="padding:28px 24px;background:linear-gradient(135deg,#0f766e 0%,#155e75 100%);color:#ffffff;">
        <div style="display:inline-block;padding:6px 12px;border-radius:999px;background:rgba(255,255,255,0.16);font-size:12px;font-weight:700;">
          ${escapeHtml(sourceMeta.badge)}
        </div>
        <h1 style="margin:16px 0 8px;font-size:28px;line-height:1.15;">Voucher mới dành cho ${escapeHtml(customerName)}</h1>
        <p style="margin:0;font-size:15px;line-height:1.6;opacity:0.92;">${escapeHtml(sourceMeta.message)}</p>
      </div>

      <div style="padding:24px;">
        <p style="margin:0 0 16px;font-size:15px;line-height:1.7;">
          BeautyBook vừa thêm một ưu đãi mới vào tài khoản của bạn. Bạn có thể dùng voucher này khi đặt lịch hoặc thanh toán dịch vụ phù hợp.
        </p>

        <div style="margin:20px 0;padding:20px;border-radius:20px;background:#f8fbff;border:1px dashed #8fb9d7;text-align:center;">
          <div style="font-size:13px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#0f766e;">Mã voucher</div>
          <div style="margin-top:12px;font-size:34px;font-weight:800;letter-spacing:0.08em;color:#12223b;">${escapeHtml(voucherCode)}</div>
          <div style="margin-top:10px;font-size:18px;font-weight:700;color:#0f766e;">${escapeHtml(discountLabel)}</div>
          <p style="margin:12px 0 0;font-size:14px;line-height:1.6;color:#51607a;">${escapeHtml(voucherDescription)}</p>
        </div>

        <div style="display:grid;gap:10px;margin:20px 0;padding:18px;border-radius:18px;background:#f9fbfd;border:1px solid #e2e8f0;">
          <div><strong>Hạn sử dụng:</strong> ${escapeHtml(expiryDate)}</div>
          <div><strong>Đơn tối thiểu:</strong> ${escapeHtml(minOrder)}</div>
          <div><strong>Giảm tối đa:</strong> ${escapeHtml(maxDiscount)}</div>
          ${
            sourceMeta.issuedByName
              ? `<div><strong>Người gửi:</strong> ${escapeHtml(sourceMeta.issuedByName)}</div>`
              : ''
          }
          ${
            sourceMeta.reason
              ? `<div><strong>Ghi chú:</strong> ${escapeHtml(sourceMeta.reason)}</div>`
              : ''
          }
        </div>

        <a
          href="${escapeHtml(actionUrl)}"
          style="display:inline-flex;align-items:center;justify-content:center;min-height:46px;padding:0 22px;border-radius:999px;background:#0f766e;color:#ffffff;text-decoration:none;font-weight:700;"
        >
          Xem voucher của tôi
        </a>

        <p style="margin:20px 0 0;font-size:13px;line-height:1.7;color:#64748b;">
          Nếu bạn cần hỗ trợ thêm, hãy liên hệ
          <a href="mailto:${escapeHtml(supportEmail)}" style="color:#0f766e;text-decoration:none;">${escapeHtml(
            supportEmail
          )}</a>.
        </p>
      </div>
    </div>
  </body>
</html>`;

  const text = [
    `Xin chào ${customerName},`,
    '',
    sourceMeta.message,
    `Mã voucher: ${voucherCode}`,
    `Ưu đãi: ${discountLabel}`,
    `Mô tả: ${voucherDescription}`,
    `Hạn sử dụng: ${expiryDate}`,
    `Đơn tối thiểu: ${minOrder}`,
    `Giảm tối đa: ${maxDiscount}`,
    sourceMeta.issuedByName ? `Người gửi: ${sourceMeta.issuedByName}` : '',
    sourceMeta.reason ? `Ghi chú: ${sourceMeta.reason}` : '',
    redeemUrl ? `Xem voucher: ${redeemUrl}` : '',
    `Hỗ trợ: ${supportEmail}`
  ]
    .filter(Boolean)
    .join('\n');

  const daysRemaining = (() => {
    const parsed = new Date(voucher.expiry_date);
    if (Number.isNaN(parsed.getTime())) {
      return '';
    }

    return Math.max(0, Math.ceil((parsed.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
  })();

  const templateHtml = renderTemplate(readVoucherTemplate(), {
    ...sourceMeta,
    ...{
      customerName,
      voucherCode,
      discountValue: discountLabel,
      voucherDescription,
      voucherSourceLabel: sourceMeta.badge,
      voucherSourceMessage: sourceMeta.message,
      issuedByName: sourceMeta.issuedByName,
      voucherReason: sourceMeta.reason,
      expiryDate,
      minOrder,
      maxDiscount,
      daysRemaining,
      shopLink: actionUrl
    }
  });

  return {
    source: sourceMeta.source,
    subject: sourceMeta.subject,
    html: templateHtml || html,
    text,
    templateData: {
      customerName,
      voucherCode,
      discountLabel,
      voucherDescription,
      expiryDate,
      minOrder,
      maxDiscount,
      voucherSourceLabel: sourceMeta.badge,
      voucherSourceMessage: sourceMeta.message,
      issuedByName: sourceMeta.issuedByName,
      voucherReason: sourceMeta.reason,
      redeemUrl: actionUrl,
      supportEmail
    }
  };
};

module.exports = {
  buildVoucherEmailPayload,
  getVoucherSourceMeta
};
