const customerModel = require('../../models/customerModel');
const mailService = require('../../services/mailService');
const voucherService = require('../../services/voucherService');
const { buildVoucherEmailPayload } = require('../../utils/voucherEmailTemplate');

const parseCustomerIds = (value) => {
  if (Array.isArray(value)) {
    return value.map(Number).filter((id) => Number.isInteger(id) && id > 0);
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? [parsed] : [];
};

const sendVoucherEmailToCustomer = async ({ customer, voucher, source, issuedByName, reason }) => {
  const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:3000').trim();
  const supportEmail = (process.env.SUPPORT_EMAIL || process.env.EMAIL_USER || 'support@beautybook.vn').trim();
  const payload = buildVoucherEmailPayload({
    customer,
    voucher,
    source,
    issuedByName,
    reason,
    redeemUrl: `${frontendUrl.replace(/\/$/, '')}/my-vouchers`,
    supportEmail
  });

  return mailService.sendEmail({
    to: customer.email,
    subject: payload.subject,
    html: payload.html,
    text: payload.text
  });
};

exports.getAllVouchers = async (req, res) => {
  try {
    const vouchers = await voucherService.getAllVouchers();
    return res.status(200).json({ success: true, data: vouchers });
  } catch (err) {
    return res.status(err.status || 500).json({
      success: false,
      message: err.message || 'Không thể tải danh sách voucher'
    });
  }
};

exports.getVoucherById = async (req, res) => {
  try {
    const voucher = await voucherService.getVoucherById(req.params.id);
    if (!voucher) {
      return res.status(404).json({ success: false, message: 'Voucher không tồn tại' });
    }

    return res.status(200).json({ success: true, data: voucher });
  } catch (err) {
    return res.status(err.status || 500).json({
      success: false,
      message: err.message || 'Không thể tải voucher'
    });
  }
};

exports.createVoucher = async (req, res) => {
  try {
    const voucher = await voucherService.createVoucher({
      ...req.body,
      created_by: req.user.id
    });

    return res.status(201).json({
      success: true,
      message: 'Tạo voucher thành công',
      data: voucher
    });
  } catch (err) {
    return res.status(err.status || 500).json({
      success: false,
      message: err.message || 'Tạo voucher thất bại'
    });
  }
};

exports.updateVoucher = async (req, res) => {
  try {
    const voucher = await voucherService.updateVoucher(req.params.id, req.body);
    if (!voucher) {
      return res.status(404).json({ success: false, message: 'Voucher không tồn tại' });
    }

    return res.status(200).json({
      success: true,
      message: 'Cập nhật voucher thành công',
      data: voucher
    });
  } catch (err) {
    return res.status(err.status || 500).json({
      success: false,
      message: err.message || 'Cập nhật voucher thất bại'
    });
  }
};

exports.deleteVoucher = async (req, res) => {
  try {
    const result = await voucherService.deactivateVoucher(req.params.id);
    if (!result?.affectedRows) {
      return res.status(404).json({ success: false, message: 'Voucher không tồn tại' });
    }

    return res.status(200).json({
      success: true,
      message: 'Đã tắt voucher'
    });
  } catch (err) {
    return res.status(err.status || 500).json({
      success: false,
      message: err.message || 'Không thể tắt voucher'
    });
  }
};

exports.assignVoucher = async (req, res) => {
  const customerIds = parseCustomerIds(
    req.body.user_ids || req.body.user_id || req.body.customer_ids || req.body.customer_id
  );
  const shouldSendEmail = Boolean(req.body.send_email);
  const maxUsageCustomer = Number(req.body.max_usage_customer || 1);

  if (!customerIds.length) {
    return res.status(400).json({
      success: false,
      message: 'Vui lòng chọn ít nhất một khách hàng'
    });
  }

  try {
    const voucher = await voucherService.getVoucherById(req.params.id);
    if (!voucher) {
      return res.status(404).json({ success: false, message: 'Voucher không tồn tại' });
    }

    const assignments = await voucherService.assignVoucherToCustomers(
      req.params.id,
      customerIds,
      maxUsageCustomer,
      {
        source: 'admin',
        reason: req.body.reason || null
      }
    );
    const emailResults = [];

    if (shouldSendEmail) {
      for (const assignment of assignments) {
        if (!assignment.customer?.email) {
          continue;
        }

        try {
          const result = await sendVoucherEmailToCustomer({
            customer: assignment.customer,
            voucher,
            source: 'admin',
            issuedByName: req.user.email || 'Admin BeautyBook',
            reason: req.body.reason || 'Voucher được gửi trực tiếp từ đội ngũ BeautyBook.'
          });
          emailResults.push({
            user_id: assignment.customerId,
            customer_id: assignment.customerId,
            email: assignment.customer.email,
            messageId: result.messageId
          });
        } catch (mailErr) {
          emailResults.push({
            user_id: assignment.customerId,
            customer_id: assignment.customerId,
            email: assignment.customer.email,
            error: mailErr.message
          });
        }
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Gán voucher thành công',
      data: {
        assignments,
        emails: emailResults
      }
    });
  } catch (err) {
    return res.status(err.status || 500).json({
      success: false,
      message: err.message || 'Gán voucher thất bại'
    });
  }
};

exports.getMyVouchers = async (req, res) => {
  try {
    const vouchers = await voucherService.getCustomerVouchers(req.user.id);
    return res.status(200).json({ success: true, data: vouchers });
  } catch (err) {
    return res.status(err.status || 500).json({
      success: false,
      message: err.message || 'Không thể tải voucher của bạn'
    });
  }
};

exports.validateVoucher = async (req, res) => {
  try {
    const result = await voucherService.validateVoucherForCustomer({
      customerId: req.user.id,
      code: req.body.code,
      subtotal: req.body.subtotal
    });

    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (err) {
    return res.status(err.status || 500).json({
      success: false,
      message: err.message || 'Voucher không hợp lệ'
    });
  }
};

exports.getAnalytics = async (req, res) => {
  try {
    const analytics = await voucherService.getAnalytics();
    return res.status(200).json({ success: true, data: analytics });
  } catch (err) {
    return res.status(err.status || 500).json({
      success: false,
      message: err.message || 'Không thể tải thống kê voucher'
    });
  }
};

exports.createAndSendVoucherToCustomer = (req, res) => {
  const { id } = req.params;
  const source = String(req.body?.source || 'admin').trim().toLowerCase() === 'bot' ? 'bot' : 'admin';
  const voucherInput = typeof req.body?.voucher === 'object' && req.body.voucher ? req.body.voucher : {};
  const issuedByName = String(
    req.body?.issuedByName || (source === 'admin' ? req.user.email || 'Admin BeautyBook' : 'BeautyBook Bot')
  ).trim();
  const reason = String(
    req.body?.reason ||
      (source === 'admin'
        ? 'Voucher được gửi trực tiếp từ đội ngũ BeautyBook.'
        : 'Hệ thống tự động gợi ý ưu đãi phù hợp cho bạn.')
  ).trim();

  customerModel.getCustomerById(id, async (err, customer) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Lỗi server', error: err });
    }

    if (!customer) {
      return res.status(404).json({ success: false, message: 'Khách hàng không tồn tại' });
    }

    if (!customer.email) {
      return res.status(400).json({ success: false, message: 'Khách hàng này chưa có email để nhận voucher.' });
    }

    try {
      const voucher = await voucherService.createVoucher({
        voucher_type: voucherInput.voucher_type || 'percentage',
        discount_percent: voucherInput.discount_percent || 15,
        discount_amount: voucherInput.discount_amount || 0,
        min_order_value: voucherInput.min_order_value || 300000,
        max_discount_amount: voucherInput.max_discount_amount || 120000,
        customer_type: voucherInput.customer_type || 'both',
        description:
          voucherInput.description || 'Ưu đãi dành cho lần đặt lịch tiếp theo tại BeautyBook.',
        valid_days: voucherInput.valid_days || 7,
        max_usage_global: voucherInput.max_usage_global || 1,
        created_by: req.user.id
      });

      await voucherService.assignVoucherToCustomer(voucher.id, customer.id, 1, {
        source,
        reason
      });
      const mailResult = await sendVoucherEmailToCustomer({
        customer,
        voucher,
        source,
        issuedByName,
        reason
      });

      return res.status(200).json({
        success: true,
        message: `Đã tạo và gửi email voucher tới ${customer.email}.`,
        data: {
          recipient: customer.email,
          voucherCode: voucher.code,
          source,
          messageId: mailResult.messageId
        }
      });
    } catch (sendErr) {
      return res.status(sendErr.status || 500).json({
        success: false,
        message: sendErr.message || 'Không thể gửi email voucher lúc này.'
      });
    }
  });
};
