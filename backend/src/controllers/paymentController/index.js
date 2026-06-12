const appointmentModel = require('../../models/appointmentModel');
const paymentModel = require('../../models/paymentModel');
const { getPaymentSchemaInfo } = require('../../utils/paymentSchema');
const { buildVietQrImageUrl, getVietQrConfig } = require('../../utils/vietqr');
const { emitDashboardUpdate } = require('../../utils/realtime');
const {
  addMinutes,
  buildInvoiceNumber,
  buildPaymentReference,
  createSecureHash,
  formatVnpayDate,
  getClientIp,
  getVnpayPaymentUrl,
  toAsciiText,
  verifyVnpaySignature
} = require('../../utils/vnpay');

const VNPAY_SUCCESS_CODE = '00';
const DEFAULT_VIETQR_EXPIRE_MINUTES = 720;
const DEFAULT_VIETQR_EXPIRE_SECONDS = 300;
const OFFLINE_PAYMENT_METHODS = new Set(['cash', 'banking']);
const MANUAL_CONFIRMABLE_PAYMENT_METHODS = new Set(['cash', 'banking', 'vietqr']);
const SUPPORTED_PAYMENT_METHODS = new Set(['cash', 'banking', 'vnpay', 'vietqr']);

const normalizePaymentMethod = (paymentMethod) => {
  const normalizedMethod = String(paymentMethod || '').toLowerCase();
  if (normalizedMethod === 'bank_transfer') {
    return 'vietqr';
  }

  return normalizedMethod;
};

const getPaymentMethodLabel = (paymentMethod) => {
  if (paymentMethod === 'cash') {
    return 'tiền mặt';
  }

  if (paymentMethod === 'banking') {
    return 'chuyển khoản ngân hàng';
  }

  if (paymentMethod === 'vietqr') {
    return 'VietQR';
  }

  if (paymentMethod === 'vnpay') {
    return 'VNPay';
  }

  return paymentMethod || 'thanh toán';
};

const getFrontendBaseUrl = () => (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/+$/, '');

const getFrontendPaymentResultBaseUrl = () => {
  const configuredBase = process.env.FRONTEND_PAYMENT_RETURN_URL;
  if (configuredBase) {
    return configuredBase;
  }

  return `${getFrontendBaseUrl()}/payment-result`;
};

const buildFrontendTransferUrl = (paymentId) => `${getFrontendBaseUrl()}/payment-transfer/${paymentId}`;

const buildBackendAbsoluteUrl = (req, path) => {
  const configuredBase = process.env.BACKEND_PUBLIC_URL;
  if (configuredBase) {
    return `${configuredBase.replace(/\/+$/, '')}${path}`;
  }

  const forwardedProto = req.headers['x-forwarded-proto'];
  const protocol =
    typeof forwardedProto === 'string' && forwardedProto.trim()
      ? forwardedProto.split(',')[0].trim()
      : req.protocol;

  return `${protocol}://${req.get('host')}${path}`;
};

const buildFrontendRedirectUrl = (payload) => {
  const url = new URL(getFrontendPaymentResultBaseUrl());

  Object.entries(payload).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  });

  return url.toString();
};

const getVnpayConfig = (req) => {
  const tmnCode = process.env.VNPAY_TMN_CODE || process.env.VNPAY_API_KEY;
  const hashSecret = process.env.VNPAY_HASH_SECRET;

  if (!tmnCode || !hashSecret) {
    return null;
  }

  return {
    tmnCode,
    hashSecret,
    paymentUrl: getVnpayPaymentUrl(),
    returnUrl: process.env.VNPAY_RETURN_URL || buildBackendAbsoluteUrl(req, '/api/payments/vnpay-return'),
    ipnUrl: process.env.VNPAY_IPN_URL || buildBackendAbsoluteUrl(req, '/api/payments/vnpay-ipn')
  };
};

const getResponseMessage = (responseCode) => {
  const messages = {
    '00': 'Thanh toán thành công',
    '07': 'Giao dịch đang bị nghi ngờ',
    '09': 'Tài khoản chưa đăng ký Internet Banking',
    '10': 'Xác thực không đúng quá số lần cho phép',
    '11': 'Hết hạn chờ thanh toán',
    '12': 'Thẻ hoặc tài khoản bị khóa',
    '13': 'Sai mã OTP hoặc mật khẩu xác thực',
    '24': 'Khách hàng đã hủy giao dịch',
    '51': 'Tài khoản không đủ số dư',
    '65': 'Vượt hạn mức giao dịch trong ngày',
    '75': 'Ngân hàng thanh toán đang bảo trì',
    '79': 'Nhập sai mật khẩu thanh toán quá số lần quy định',
    '97': 'Chữ ký không hợp lệ',
    '99': 'Có lỗi khác xảy ra'
  };

  return messages[String(responseCode || '')] || 'Không xác định được kết quả thanh toán';
};

const getVietQrExpireSeconds = () => {
  const parsedSeconds = Number(process.env.VIETQR_EXPIRE_SECONDS);
  if (Number.isFinite(parsedSeconds) && parsedSeconds > 0) {
    return parsedSeconds;
  }

  const parsedMinutes = Number(process.env.VIETQR_EXPIRE_MINUTES || DEFAULT_VIETQR_EXPIRE_MINUTES);
  if (Number.isFinite(parsedMinutes) && parsedMinutes > 0) {
    return Math.round(parsedMinutes * 60);
  }

  return DEFAULT_VIETQR_EXPIRE_SECONDS;
};

const getExpireAtForMethod = (paymentMethod) => {
  if (paymentMethod === 'vnpay') {
    return addMinutes(new Date(), 15);
  }

  if (paymentMethod === 'vietqr') {
    return new Date(Date.now() + getVietQrExpireSeconds() * 1000);
  }

  return null;
};

const isFutureDate = (value) => {
  if (!value) {
    return false;
  }

  const parsedDate = new Date(value);
  return !Number.isNaN(parsedDate.getTime()) && parsedDate.getTime() > Date.now();
};

const canReusePendingPayment = (payment, paymentMethod) =>
  payment &&
  payment.payment_status === 'pending' &&
  payment.payment_method === paymentMethod &&
  (!payment.payment_url_expires_at || isFutureDate(payment.payment_url_expires_at));

const isExpiredPendingPayment = (payment) =>
  payment &&
  payment.payment_status === 'pending' &&
  payment.payment_url_expires_at &&
  !isFutureDate(payment.payment_url_expires_at);

const markExpiredPaymentIfNeeded = (payment, callback) => {
  if (!isExpiredPendingPayment(payment)) {
    return callback(null, payment);
  }

  const updateData = {
    payment_status: 'failed',
    gateway_response_code: 'EXPIRED',
    gateway_transaction_status: 'EXPIRED',
    gateway_payload: JSON.stringify({
      mode: 'expired_qr_code',
      expired_at: new Date().toISOString()
    })
  };

  return paymentModel.updatePaymentIfStatus(payment.id, 'pending', updateData, (updateErr) => {
    if (updateErr) {
      return callback(updateErr);
    }

    return paymentModel.getPaymentById(payment.id, (fetchErr, refreshedPayment) => {
      if (fetchErr) {
        return callback(fetchErr);
      }

      return callback(null, refreshedPayment);
    });
  });
};

const buildVnpayCheckoutUrl = ({ req, appointment, amount, paymentReference, expireAt, vnpayConfig }) => {
  const paymentParams = {
    vnp_Version: '2.1.0',
    vnp_Command: 'pay',
    vnp_TmnCode: vnpayConfig.tmnCode,
    vnp_Amount: Math.round(Number(amount || 0) * 100),
    vnp_CreateDate: formatVnpayDate(new Date()),
    vnp_CurrCode: 'VND',
    vnp_IpAddr: getClientIp(req),
    vnp_Locale: 'vn',
    vnp_OrderInfo: toAsciiText(`Thanh toan lich hen ${appointment.id} ${appointment.service_name || ''}`),
    vnp_OrderType: 'other',
    vnp_ReturnUrl: vnpayConfig.returnUrl,
    vnp_TxnRef: paymentReference,
    vnp_ExpireDate: formatVnpayDate(expireAt),
    vnp_Bill_Email: appointment.customer_email || '',
    vnp_Bill_Mobile: appointment.customer_phone || '',
    vnp_Inv_Customer: toAsciiText(appointment.customer_name || ''),
    vnp_Inv_Email: appointment.customer_email || '',
    vnp_Inv_Phone: appointment.customer_phone || ''
  };

  const secureHash = createSecureHash(paymentParams, vnpayConfig.hashSecret);
  const url = new URL(vnpayConfig.paymentUrl);

  Object.keys(paymentParams)
    .sort()
    .forEach((key) => {
      const value = paymentParams[key];
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value));
      }
    });

  url.searchParams.set('vnp_SecureHash', secureHash);
  return url.toString();
};

const isSuccessfulVnpayResult = (params) =>
  params.vnp_ResponseCode === VNPAY_SUCCESS_CODE &&
  params.vnp_TransactionStatus === VNPAY_SUCCESS_CODE;

const buildInvoicePayload = (payment) => ({
  ...payment,
  invoice_number: buildInvoiceNumber(payment)
});

const buildPaymentClientPayload = (payment, options = {}) => {
  const payload = buildInvoicePayload(payment);

  if (payment?.payment_method === 'vietqr') {
    const vietQrConfig = getVietQrConfig();
    const transferContent = payment.payment_reference || `APT${payment.appointment_id || payment.id}`;

    payload.payment_url = buildFrontendTransferUrl(payment.id);
    payload.transfer_content = transferContent;

    if (vietQrConfig) {
      payload.qr_image_url = buildVietQrImageUrl({
        ...vietQrConfig,
        amount: Number(payment.amount || payment.payment_amount || 0),
        addInfo: transferContent,
        accountName: vietQrConfig.accountName
      });
      payload.bank_name = vietQrConfig.bankName;
      payload.bank_bin = vietQrConfig.bankBin;
      payload.account_number = vietQrConfig.accountNo;
      payload.account_holder = vietQrConfig.accountName;
    }
  }

  if (options.paymentUrl) {
    payload.payment_url = options.paymentUrl;
  }

  return payload;
};

const ensurePaymentOwner = (payment, user) => {
  if (!payment || !user) {
    return false;
  }

  if (user.role === 'admin') {
    return true;
  }

  if (user.role === 'staff') {
    return Number(payment.staff_id) === Number(user.id);
  }

  return Number(payment.user_id) === Number(user.id);
};

const canConfirmTransferPayment = (user) =>
  user && (user.role === 'admin' || user.role === 'staff');

const finalizePaymentResult = (payment, params, callback) => {
  if (!payment) {
    return callback(null, { payment: null, updated: false });
  }

  if (payment.payment_status !== 'pending') {
    return callback(null, { payment, updated: false });
  }

  const isSuccess = isSuccessfulVnpayResult(params);
  const updateData = {
    payment_status: isSuccess ? 'paid' : 'failed',
    transaction_code: params.vnp_TransactionNo || payment.transaction_code || null,
    bank_code: params.vnp_BankCode || payment.bank_code || null,
    bank_transaction_no: params.vnp_BankTranNo || payment.bank_transaction_no || null,
    gateway_response_code: params.vnp_ResponseCode || null,
    gateway_transaction_status: params.vnp_TransactionStatus || null,
    gateway_payload: JSON.stringify(params),
    paid_at: isSuccess ? new Date() : null
  };

  paymentModel.updatePaymentIfStatus(payment.id, 'pending', updateData, (updateErr, updateResult) => {
    if (updateErr) {
      return callback(updateErr);
    }

    return paymentModel.getPaymentById(payment.id, (fetchErr, refreshedPayment) => {
      if (fetchErr) {
        return callback(fetchErr);
      }

      return callback(null, {
        payment: refreshedPayment,
        updated: Boolean(updateResult?.affectedRows)
      });
    });
  });
};

const handleMissingPaymentConfig = (res) =>
  res.status(503).json({
    success: false,
    message:
      'VNPay chưa được cấu hình. Vui lòng thêm VNPAY_TMN_CODE và VNPAY_HASH_SECRET vào backend/.env.'
  });

const handleMissingVietQrConfig = (res) =>
  res.status(503).json({
    success: false,
    message:
      'VietQR chưa được cấu hình đủ. Vui lòng thêm VIETQR_ACCOUNT_NO, VIETQR_ACCOUNT_NAME và VIETQR_BANK_BIN vào backend/.env.'
  });

const handleMissingPaymentSchema = (res) =>
  res.status(503).json({
    success: false,
    message:
      'Database payments chưa được cập nhật cho thanh toán online. Vui lòng chạy file database/migration_add_payment_gateway_support.sql rồi thử lại.'
  });

const buildPaymentOptions = (req, schemaInfo) => {
  const onlineEnabled = Boolean(schemaInfo?.hasGatewayColumns);
  const vnpayEnabled = onlineEnabled && Boolean(getVnpayConfig(req));
  const vietQrEnabled = onlineEnabled && Boolean(getVietQrConfig());

  const options = [
    {
      method: 'cash',
      label: 'Tiền mặt tại salon',
      description: 'Khách thanh toán trực tiếp bằng tiền mặt khi đến sử dụng dịch vụ.',
      enabled: true
    },
    {
      method: 'banking',
      label: 'Chuyển khoản tại salon',
      description: 'Khách chuyển khoản ngân hàng và thu ngân xác nhận thủ công tại quầy.',
      enabled: true
    },
    {
      method: 'vietqr',
      label: 'VietQR ngân hàng',
      description: 'Quét mã QR ngân hàng với số tiền và nội dung chuyển khoản có sẵn.',
      enabled: vietQrEnabled
    },
    {
      method: 'vnpay',
      label: 'VNPay online',
      description: 'Thanh toán online qua cổng VNPay và tự quay lại trang kết quả sau khi hoàn tất.',
      enabled: vnpayEnabled
    }
  ];

  const recommendedMethod =
    options.find((option) => option.enabled && option.method === 'vnpay')?.method ||
    options.find((option) => option.enabled && option.method === 'vietqr')?.method ||
    options.find((option) => option.enabled && option.method === 'banking')?.method ||
    options.find((option) => option.enabled && option.method === 'cash')?.method ||
    options.find((option) => option.enabled)?.method ||
    'cash';

  return {
    options,
    recommended_method: recommendedMethod
  };
};

const respondWithPayment = (res, statusCode, message, payment, options) =>
  res.status(statusCode).json({
    success: true,
    message,
    payment: buildPaymentClientPayload(payment, options)
  });

exports.getPaymentOptions = (req, res) => {
  return getPaymentSchemaInfo((schemaErr, schemaInfo) => {
    if (schemaErr) {
      console.error('[GET_PAYMENT_OPTIONS_SCHEMA_ERROR]', schemaErr);
      return res.status(500).json({
        success: false,
        message: 'Không thể tải cấu hình phương thức thanh toán lúc này'
      });
    }

    return res.status(200).json({
      success: true,
      data: buildPaymentOptions(req, schemaInfo)
    });
  });
};

exports.createPayment = (req, res) => {
  const { appointment_id, payment_method } = req.body;
  const userId = req.user.id;
  const normalizedMethod = normalizePaymentMethod(payment_method);

  if (!appointment_id || !payment_method) {
    return res.status(400).json({
      success: false,
      message: 'Vui lòng cung cấp appointment_id và payment_method'
    });
  }

  if (!SUPPORTED_PAYMENT_METHODS.has(normalizedMethod)) {
    return res.status(400).json({
      success: false,
      message: 'Hệ thống hiện hỗ trợ thanh toán cash, banking, vietqr hoặc vnpay'
    });
  }

  let vnpayConfig = null;

  const startCreatePayment = () =>
    appointmentModel.getAppointmentById(appointment_id, (appointmentErr, appointment) => {
      if (appointmentErr) {
        console.error('[CREATE_PAYMENT_APPOINTMENT_ERROR]', appointmentErr);
        return res.status(500).json({ success: false, message: 'Lỗi server khi tải lịch hẹn' });
      }

      if (!appointment) {
        return res.status(404).json({
          success: false,
          message: 'Lịch hẹn không tồn tại'
        });
      }

      if (Number(appointment.user_id) !== Number(userId)) {
        return res.status(403).json({
          success: false,
          message: 'Bạn không có quyền thanh toán cho lịch này'
        });
      }

      if (appointment.status === 'cancelled') {
        return res.status(400).json({
          success: false,
          message: 'Không thể tạo giao dịch cho lịch đã hủy'
        });
      }

      if (
        OFFLINE_PAYMENT_METHODS.has(normalizedMethod) &&
        Number(appointment.deposit_required) === 1 &&
        Number(appointment.deposit_amount || 0) > 0
      ) {
        return res.status(400).json({
          success: false,
          message: 'Lịch có rủi ro hủy cao cần thanh toán cọc online để giữ chỗ.'
        });
      }

      paymentModel.getLatestPaymentByAppointmentId(appointment_id, (latestErr, latestPayment) => {
        if (latestErr) {
          console.error('[GET_LATEST_PAYMENT_ERROR]', latestErr);
          return res.status(500).json({ success: false, message: 'Lỗi server khi kiểm tra thanh toán' });
        }

        return markExpiredPaymentIfNeeded(latestPayment, (expireErr, normalizedLatestPayment) => {
          if (expireErr) {
            console.error('[MARK_EXPIRED_PAYMENT_ERROR]', expireErr);
            return res.status(500).json({ success: false, message: 'Lỗi server khi làm mới mã thanh toán' });
          }

          if (normalizedLatestPayment?.payment_status === 'paid') {
            return res.status(400).json({
              success: false,
              message: 'Lịch hẹn này đã được thanh toán',
              payment: buildPaymentClientPayload(normalizedLatestPayment)
            });
          }

          const amount =
            Number(appointment.deposit_required) === 1 && Number(appointment.deposit_amount || 0) > 0
              ? Number(appointment.deposit_amount || 0)
              : Number(appointment.total_amount || appointment.service_price || 0);

          if (canReusePendingPayment(normalizedLatestPayment, normalizedMethod)) {
            const paymentUrl =
              normalizedMethod === 'vnpay'
                ? buildVnpayCheckoutUrl({
                    req,
                    appointment,
                    amount,
                    paymentReference: normalizedLatestPayment.payment_reference,
                    expireAt: normalizedLatestPayment.payment_url_expires_at,
                    vnpayConfig
                  })
                : undefined;

            return respondWithPayment(
              res,
              200,
              normalizedMethod === 'vietqr'
                ? 'Đã lấy lại mã VietQR hiện có'
                : 'Đã lấy lại giao dịch thanh toán đang chờ',
              normalizedLatestPayment,
              { paymentUrl }
            );
          }

          const paymentReference = buildPaymentReference(appointment_id);
          const expireAt = getExpireAtForMethod(normalizedMethod);

          const paymentData = {
            appointment_id,
            amount,
            payment_method: normalizedMethod,
            payment_status: 'pending',
            payment_reference: paymentReference,
            payment_url_expires_at: expireAt
          };

          return paymentModel.createPayment(paymentData, (createErr, result) => {
            if (createErr) {
              console.error('[CREATE_PAYMENT_ERROR]', createErr);
              return res.status(500).json({
                success: false,
                message: 'Lỗi server khi tạo giao dịch thanh toán'
              });
            }

            const paymentId = result.insertId;

            return paymentModel.getPaymentById(paymentId, (fetchErr, createdPayment) => {
              if (fetchErr) {
                console.error('[FETCH_PAYMENT_ERROR]', fetchErr);
                return res.status(500).json({
                  success: false,
                  message: 'Đã tạo giao dịch nhưng không tải được thông tin thanh toán'
                });
              }

              emitDashboardUpdate(req, 'payment.created', {
                paymentId,
                appointmentId: Number(appointment_id),
                amount,
                method: normalizedMethod
              });

              if (normalizedMethod === 'cash') {
                return respondWithPayment(res, 201, 'Đã tạo phiếu thu tiền mặt tại salon', createdPayment);
              }

              if (normalizedMethod === 'banking') {
                return respondWithPayment(res, 201, 'Đã tạo phiếu chuyển khoản tại salon', createdPayment);
              }

              if (normalizedMethod === 'vietqr') {
                return respondWithPayment(res, 201, 'Đã tạo mã VietQR thanh toán', createdPayment);
              }

              const paymentUrl = buildVnpayCheckoutUrl({
                req,
                appointment,
                amount,
                paymentReference,
                expireAt,
                vnpayConfig
              });

              return respondWithPayment(res, 201, 'Đã tạo link thanh toán VNPay', createdPayment, { paymentUrl });
            });
          });
        });
      });
    });

  if (OFFLINE_PAYMENT_METHODS.has(normalizedMethod)) {
    return startCreatePayment();
  }

  if (normalizedMethod === 'vietqr' && !getVietQrConfig()) {
    return handleMissingVietQrConfig(res);
  }

  if (normalizedMethod === 'vnpay') {
    vnpayConfig = getVnpayConfig(req);
    if (!vnpayConfig) {
      return handleMissingPaymentConfig(res);
    }
  }

  return getPaymentSchemaInfo((schemaErr, schemaInfo) => {
    if (schemaErr) {
      console.error('[PAYMENT_SCHEMA_ERROR]', schemaErr);
      return res.status(500).json({
        success: false,
        message: 'Không thể kiểm tra cấu trúc bảng thanh toán lúc này'
      });
    }

    if (!schemaInfo.hasGatewayColumns) {
      return handleMissingPaymentSchema(res);
    }

    return startCreatePayment();
  });
};

exports.verifyPayment = (req, res) => {
  return res.status(410).json({
    success: false,
    message: 'Không hỗ trợ xác nhận thanh toán thủ công. Hệ thống sẽ đối soát qua VNPay return và IPN.'
  });
};

exports.confirmTransferPayment = (req, res) => {
  const { payment_id } = req.params;
  const requestedMethod = normalizePaymentMethod(req.body?.payment_method);

  if (!canConfirmTransferPayment(req.user)) {
    return res.status(403).json({
      success: false,
      message: 'Bạn không có quyền xác nhận thanh toán'
    });
  }

  return paymentModel.getPaymentById(payment_id, (fetchErr, payment) => {
    if (fetchErr) {
      console.error('[GET_PAYMENT_FOR_CONFIRM_ERROR]', fetchErr);
      return res.status(500).json({
        success: false,
        message: 'Không thể tải giao dịch cần xác nhận'
      });
    }

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Giao dịch thanh toán không tồn tại'
      });
    }

    const finalPaymentMethod = requestedMethod || payment.payment_method;

    if (!MANUAL_CONFIRMABLE_PAYMENT_METHODS.has(finalPaymentMethod)) {
      return res.status(400).json({
        success: false,
        message: 'Chỉ hỗ trợ xác nhận thủ công cho tiền mặt, chuyển khoản ngân hàng hoặc VietQR'
      });
    }

    if (!MANUAL_CONFIRMABLE_PAYMENT_METHODS.has(payment.payment_method)) {
      return res.status(400).json({
        success: false,
        message: 'Giao dịch này không hỗ trợ xác nhận thủ công'
      });
    }

    if (payment.payment_status === 'paid') {
      return res.status(200).json({
        success: true,
        message: 'Giao dịch này đã được xác nhận thanh toán trước đó',
        data: buildPaymentClientPayload(payment)
      });
    }

    if (payment.payment_status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Chỉ có thể xác nhận giao dịch đang chờ thanh toán'
      });
    }

    const confirmedAt = new Date();
    const transactionPrefix =
      finalPaymentMethod === 'cash' ? 'CASH' : finalPaymentMethod === 'banking' ? 'BANK' : 'VQR';
    const bankCode =
      finalPaymentMethod === 'cash'
        ? null
        : payment.bank_code || (finalPaymentMethod === 'vietqr' ? 'VietQR' : 'BANKING');
    const updateData = {
      payment_method: finalPaymentMethod,
      payment_status: 'paid',
      paid_at: confirmedAt,
      bank_code: bankCode,
      gateway_response_code: 'MANUAL',
      gateway_transaction_status: 'MANUAL',
      transaction_code: payment.transaction_code || `${transactionPrefix}-${payment.id}-${confirmedAt.getTime()}`,
      gateway_payload: JSON.stringify({
        mode: `manual_${finalPaymentMethod}_confirmation`,
        confirmed_by_user_id: req.user.id,
        confirmed_by_role: req.user.role,
        original_payment_method: payment.payment_method,
        confirmed_at: confirmedAt.toISOString()
      })
    };

    return paymentModel.updatePaymentIfStatus(payment.id, 'pending', updateData, (updateErr, updateResult) => {
      if (updateErr) {
        console.error('[CONFIRM_TRANSFER_PAYMENT_ERROR]', updateErr);
        return res.status(500).json({
          success: false,
          message: 'Không thể xác nhận thanh toán lúc này'
        });
      }

      if (!updateResult?.affectedRows) {
        return res.status(409).json({
          success: false,
          message: 'Giao dịch vừa được cập nhật bởi người khác, vui lòng tải lại'
        });
      }

      return paymentModel.getPaymentById(payment.id, (refreshErr, refreshedPayment) => {
        if (refreshErr) {
          console.error('[REFRESH_TRANSFER_PAYMENT_ERROR]', refreshErr);
          return res.status(500).json({
            success: false,
            message: 'Đã xác nhận thanh toán nhưng không tải lại được dữ liệu'
          });
        }

        emitDashboardUpdate(req, 'payment.paid', {
          paymentId: payment.id,
          appointmentId: payment.appointment_id,
          amount: payment.amount,
          method: finalPaymentMethod
        });

        return res.status(200).json({
          success: true,
          message: `Đã xác nhận thanh toán ${getPaymentMethodLabel(finalPaymentMethod)} thành công`,
          data: buildPaymentClientPayload(refreshedPayment)
        });
      });
    });
  });
};

exports.handleVnpayReturn = (req, res) => {
  const vnpayConfig = getVnpayConfig(req);
  if (!vnpayConfig) {
    return res.redirect(
      buildFrontendRedirectUrl({
        status: 'error',
        code: 'CONFIG',
        message: 'VNPay chưa được cấu hình trên server'
      })
    );
  }

  const verification = verifyVnpaySignature(req.query, vnpayConfig.hashSecret);
  if (!verification.isValid) {
    return res.redirect(
      buildFrontendRedirectUrl({
        status: 'error',
        code: '97',
        message: getResponseMessage('97')
      })
    );
  }

  const paymentReference = verification.params.vnp_TxnRef;
  return paymentModel.getPaymentByReference(paymentReference, (paymentErr, payment) => {
    if (paymentErr) {
      console.error('[VNPAY_RETURN_LOOKUP_ERROR]', paymentErr);
      return res.redirect(
        buildFrontendRedirectUrl({
          status: 'error',
          code: 'DB',
          message: 'Không thể đối soát giao dịch lúc này'
        })
      );
    }

    if (!payment) {
      return res.redirect(
        buildFrontendRedirectUrl({
          status: 'error',
          code: '01',
          message: 'Không tìm thấy giao dịch thanh toán'
        })
      );
    }

    const expectedAmount = Math.round(Number(payment.amount || 0) * 100);
    const returnedAmount = Number(verification.params.vnp_Amount || 0);
    if (expectedAmount !== returnedAmount) {
      return res.redirect(
        buildFrontendRedirectUrl({
          payment_id: payment.id,
          appointment_id: payment.appointment_id,
          status: 'error',
          code: '04',
          message: 'Số tiền đối soát không khớp'
        })
      );
    }

    return finalizePaymentResult(payment, verification.params, (finalizeErr, finalResult) => {
      if (finalizeErr) {
        console.error('[VNPAY_RETURN_FINALIZE_ERROR]', finalizeErr);
        return res.redirect(
          buildFrontendRedirectUrl({
            payment_id: payment.id,
            appointment_id: payment.appointment_id,
            status: 'error',
            code: 'DB',
            message: 'Không thể cập nhật kết quả thanh toán'
          })
        );
      }

      const finalPayment = finalResult.payment || payment;
      const isSuccess = finalPayment.payment_status === 'paid';

      if (isSuccess && finalResult.updated) {
        emitDashboardUpdate(req, 'payment.paid', {
          paymentId: finalPayment.id,
          appointmentId: finalPayment.appointment_id,
          amount: finalPayment.amount,
          method: finalPayment.payment_method
        });
      }

      return res.redirect(
        buildFrontendRedirectUrl({
          payment_id: finalPayment.id,
          appointment_id: finalPayment.appointment_id,
          status: isSuccess ? 'success' : 'failed',
          code: verification.params.vnp_ResponseCode,
          message: getResponseMessage(verification.params.vnp_ResponseCode)
        })
      );
    });
  });
};

exports.handleVnpayIpn = (req, res) => {
  const vnpayConfig = getVnpayConfig(req);
  if (!vnpayConfig) {
    return res.status(200).json({ RspCode: '99', Message: 'Config missing' });
  }

  const verification = verifyVnpaySignature(req.query, vnpayConfig.hashSecret);
  if (!verification.isValid) {
    return res.status(200).json({ RspCode: '97', Message: 'Invalid checksum' });
  }

  return paymentModel.getPaymentByReference(verification.params.vnp_TxnRef, (paymentErr, payment) => {
    if (paymentErr) {
      console.error('[VNPAY_IPN_LOOKUP_ERROR]', paymentErr);
      return res.status(200).json({ RspCode: '99', Message: 'Unknown error' });
    }

    if (!payment) {
      return res.status(200).json({ RspCode: '01', Message: 'Order not found' });
    }

    const expectedAmount = Math.round(Number(payment.amount || 0) * 100);
    const returnedAmount = Number(verification.params.vnp_Amount || 0);
    if (expectedAmount !== returnedAmount) {
      return res.status(200).json({ RspCode: '04', Message: 'Amount invalid' });
    }

    if (payment.payment_status !== 'pending') {
      return res.status(200).json({ RspCode: '02', Message: 'Order already confirmed' });
    }

    return finalizePaymentResult(payment, verification.params, (finalizeErr, finalResult) => {
      if (finalizeErr) {
        console.error('[VNPAY_IPN_FINALIZE_ERROR]', finalizeErr);
        return res.status(200).json({ RspCode: '99', Message: 'Unknown error' });
      }

      const finalPayment = finalResult?.payment || payment;
      if (finalPayment.payment_status === 'paid' && finalResult?.updated) {
        emitDashboardUpdate(req, 'payment.paid', {
          paymentId: finalPayment.id,
          appointmentId: finalPayment.appointment_id,
          amount: finalPayment.amount,
          method: finalPayment.payment_method
        });
      }

      return res.status(200).json({ RspCode: '00', Message: 'Confirm Success' });
    });
  });
};

exports.getPayment = (req, res) => {
  const { payment_id } = req.params;

  return paymentModel.getPaymentById(payment_id, (err, payment) => {
    if (err) {
      console.error('[GET_PAYMENT_ERROR]', err);
      return res.status(500).json({
        success: false,
        message: 'Không thể tải thông tin thanh toán'
      });
    }

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Thanh toán không tồn tại'
      });
    }

    if (!ensurePaymentOwner(payment, req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền xem thanh toán này'
      });
    }

    return res.status(200).json({
      success: true,
      data: buildPaymentClientPayload(payment)
    });
  });
};
