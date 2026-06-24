const db = require('../../config/db');

const DEFAULT_VALID_DAYS = 7;
const VIP_MIN_SPENT = 3000000;

const normalizeVoucherCode = (code) =>
  String(code || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');

const toNullableNumber = (value) => {
  if (value === null || typeof value === 'undefined' || value === '') {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const addDays = (days = DEFAULT_VALID_DAYS) => {
  const date = new Date();
  date.setDate(date.getDate() + Number(days || DEFAULT_VALID_DAYS));
  return date;
};

const generateVoucherCode = (prefix = 'BB') => {
  const randomPart = Math.random().toString(36).slice(2, 6).toUpperCase();
  const timePart = Date.now().toString(36).slice(-5).toUpperCase();
  return normalizeVoucherCode(`${prefix}${timePart}${randomPart}`);
};

const getVoucherSelect = () => `
  SELECT
    v.*,
    creator.name AS created_by_name,
    (SELECT COUNT(*) FROM voucher_assignments va_count WHERE va_count.voucher_id = v.id) AS assigned_count,
    (
      SELECT COALESCE(SUM(va_usage.usage_count), 0)
      FROM voucher_assignments va_usage
      WHERE va_usage.voucher_id = v.id
    ) AS assignment_usage_count
  FROM vouchers v
  LEFT JOIN users creator ON creator.id = v.created_by
`;

const getVoucherStatusExpression = () => `
  CASE
    WHEN v.expiry_date <= NOW() THEN 'expired'
    WHEN v.status != 'active' THEN v.status
    ELSE 'active'
  END
`;

const buildDiscountLabel = (voucher) => {
  if (voucher.voucher_type === 'percentage') {
    return `-${Number(voucher.discount_percent || 0)}%`;
  }

  if (voucher.voucher_type === 'fixed') {
    return `-${Number(voucher.discount_amount || 0).toLocaleString('vi-VN')} VND`;
  }

  return 'Ưu đãi đặc biệt';
};

class VoucherService {
  constructor() {
    this.db = db.promise();
  }

  async autoExpireVouchers() {
    try {
      await this.db.query("UPDATE vouchers SET status = 'expired' WHERE expiry_date <= NOW() AND status = 'active'");
    } catch (err) {
      console.error('[VoucherAutoExpire] Error:', err.message);
    }
  }

  async getAllVouchers() {
    await this.autoExpireVouchers();
    const [rows] = await this.db.query(`
      ${getVoucherSelect()}
      ORDER BY v.created_at DESC
    `);

    return rows;
  }

  async getVoucherById(voucherId) {
    await this.autoExpireVouchers();
    const [rows] = await this.db.query(
      `
        ${getVoucherSelect()}
        WHERE v.id = ?
        LIMIT 1
      `,
      [voucherId]
    );

    return rows[0] || null;
  }

  async getVoucherByCode(code) {
    await this.autoExpireVouchers();
    const normalizedCode = normalizeVoucherCode(code);
    if (!normalizedCode) {
      return null;
    }

    const [rows] = await this.db.query(
      `
        SELECT *
        FROM vouchers
        WHERE code = ?
        LIMIT 1
      `,
      [normalizedCode]
    );

    return rows[0] || null;
  }

  async createVoucher(voucherData = {}) {
    const voucherType = String(voucherData.voucher_type || voucherData.voucherType || '').trim();
    const code = normalizeVoucherCode(voucherData.code) || generateVoucherCode();
    const validDays = Number(voucherData.valid_days || voucherData.validDays || DEFAULT_VALID_DAYS);
    const expiryDate = voucherData.expiry_date || voucherData.expiryDate || addDays(validDays);

    if (!['fixed', 'percentage', 'free_delivery'].includes(voucherType)) {
      const error = new Error('Loại voucher không hợp lệ');
      error.status = 400;
      throw error;
    }

    const discountAmount = toNullableNumber(voucherData.discount_amount ?? voucherData.discountAmount);
    const discountPercent = toNullableNumber(voucherData.discount_percent ?? voucherData.discountPercent);

    if (voucherType === 'fixed' && (!discountAmount || discountAmount <= 0)) {
      const error = new Error('Voucher giảm tiền cần discount_amount lớn hơn 0');
      error.status = 400;
      throw error;
    }

    if (voucherType === 'percentage' && (!discountPercent || discountPercent <= 0 || discountPercent > 100)) {
      const error = new Error('Voucher phần trăm cần discount_percent từ 1 đến 100');
      error.status = 400;
      throw error;
    }

    const customerType = ['regular', 'vip', 'vvip', 'vvvip', 'both'].includes(voucherData.customer_type)
      ? voucherData.customer_type
      : 'both';

    const query = `
      INSERT INTO vouchers (
        code,
        voucher_type,
        discount_amount,
        discount_percent,
        min_order_value,
        max_discount_amount,
        customer_type,
        description,
        issued_date,
        expiry_date,
        max_usage_global,
        status,
        created_by
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, 'active', ?)
    `;

    const [result] = await this.db.query(query, [
      code,
      voucherType,
      discountAmount || 0,
      discountPercent,
      toNullableNumber(voucherData.min_order_value ?? voucherData.minOrderValue) || 0,
      toNullableNumber(voucherData.max_discount_amount ?? voucherData.maxDiscountAmount),
      customerType,
      String(voucherData.description || '').trim(),
      expiryDate,
      toNullableNumber(voucherData.max_usage_global ?? voucherData.maxUsageGlobal),
      voucherData.created_by || voucherData.createdBy || null
    ]);

    return this.getVoucherById(result.insertId);
  }

  async updateVoucher(voucherId, voucherData = {}) {
    const allowedFields = {
      code: normalizeVoucherCode,
      voucher_type: (value) => String(value || '').trim(),
      discount_amount: toNullableNumber,
      discount_percent: toNullableNumber,
      min_order_value: (value) => toNullableNumber(value) || 0,
      max_discount_amount: toNullableNumber,
      customer_type: (value) => (['regular', 'vip', 'vvip', 'vvvip', 'both'].includes(value) ? value : 'both'),
      description: (value) => String(value || '').trim(),
      expiry_date: (value) => value,
      max_usage_global: toNullableNumber,
      status: (value) => (['active', 'inactive', 'expired'].includes(value) ? value : 'active')
    };

    const fields = [];
    const values = [];

    Object.entries(allowedFields).forEach(([field, normalize]) => {
      if (Object.prototype.hasOwnProperty.call(voucherData, field)) {
        fields.push(`${field} = ?`);
        values.push(normalize(voucherData[field]));
      }
    });

    if (!fields.length) {
      return this.getVoucherById(voucherId);
    }

    values.push(voucherId);
    await this.db.query(`UPDATE vouchers SET ${fields.join(', ')} WHERE id = ?`, values);
    return this.getVoucherById(voucherId);
  }

  async deactivateVoucher(voucherId) {
    const [result] = await this.db.query(
      "UPDATE vouchers SET status = 'inactive' WHERE id = ?",
      [voucherId]
    );
    return result;
  }

  async assignVoucherToCustomer(voucherId, customerId, maxUsageCustomer = 1, options = {}) {
    const [customers] = await this.db.query(
      "SELECT id, name, email FROM users WHERE id = ? AND role = 'customer' AND is_active = 1 LIMIT 1",
      [customerId]
    );

    if (!customers.length) {
      const error = new Error('Khách hàng không tồn tại hoặc đang bị khóa');
      error.status = 404;
      throw error;
    }

    const [result] = await this.db.query(
      `
        INSERT INTO voucher_assignments (
          voucher_id,
          user_id,
          max_usage_customer,
          status,
          source,
          reason,
          confidence_score,
          shown_date
        )
        VALUES (?, ?, ?, 'active', ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          max_usage_customer = VALUES(max_usage_customer),
          status = IF(usage_count >= VALUES(max_usage_customer), 'used', 'active'),
          source = VALUES(source),
          reason = COALESCE(VALUES(reason), reason),
          confidence_score = COALESCE(VALUES(confidence_score), confidence_score),
          shown_date = COALESCE(VALUES(shown_date), shown_date),
          updated_at = NOW()
      `,
      [
        voucherId,
        customerId,
        Number(maxUsageCustomer) || 1,
        ['admin', 'system', 'bot'].includes(options.source) ? options.source : 'admin',
        options.reason || null,
        toNullableNumber(options.confidence_score ?? options.confidenceScore),
        options.shown_date || options.shownDate || null
      ]
    );

    return {
      assignmentId: result.insertId,
      customer: customers[0]
    };
  }

  async assignVoucherToCustomers(voucherId, customerIds = [], maxUsageCustomer = 1, options = {}) {
    const uniqueCustomerIds = [...new Set(customerIds.map(Number).filter((id) => Number.isInteger(id) && id > 0))];
    const assignments = [];

    for (const customerId of uniqueCustomerIds) {
      const assignment = await this.assignVoucherToCustomer(voucherId, customerId, maxUsageCustomer, options);
      assignments.push({
        customerId,
        ...assignment
      });
    }

    return assignments;
  }

  async getCustomerSegment(customerId) {
    const [rows] = await this.db.query(
      `
        SELECT
          u.id,
          COALESCE(SUM(CASE WHEN a.status = 'completed' THEN COALESCE(a.original_amount, a.total_amount, 0) ELSE 0 END), 0) AS total_spent,
          COUNT(CASE WHEN a.status = 'completed' THEN 1 END) AS completed_count
        FROM users u
        LEFT JOIN appointments a ON a.user_id = u.id
        WHERE u.id = ? AND u.role = 'customer'
        GROUP BY u.id
      `,
      [customerId]
    );

    const customer = rows[0];
    if (!customer) {
      return 'regular';
    }

    const totalSpent = Number(customer.total_spent || 0);
    const completedCount = Number(customer.completed_count || 0);

    if (totalSpent >= 40000000) return 'vvvip';
    if (totalSpent >= 20000000) return 'vvip';
    if (totalSpent >= 3000000 || completedCount >= 5) return 'vip';
    return 'regular';
  }

  calculateDiscount(voucher, subtotal) {
    const safeSubtotal = Math.max(Number(subtotal || 0), 0);
    let discountAmount = 0;

    if (voucher.voucher_type === 'fixed') {
      discountAmount = Number(voucher.discount_amount || 0);
    } else if (voucher.voucher_type === 'percentage') {
      discountAmount = (safeSubtotal * Number(voucher.discount_percent || 0)) / 100;
      if (voucher.max_discount_amount) {
        discountAmount = Math.min(discountAmount, Number(voucher.max_discount_amount));
      }
    }

    discountAmount = Math.max(0, Math.min(discountAmount, safeSubtotal));
    return Math.round(discountAmount);
  }

  async validateVoucherForCustomer({ customerId, code, subtotal }) {
    await this.autoExpireVouchers();
    const normalizedCode = normalizeVoucherCode(code);
    const safeSubtotal = Number(subtotal || 0);

    if (!normalizedCode) {
      const error = new Error('Vui lòng nhập mã voucher');
      error.status = 400;
      throw error;
    }

    const [rows] = await this.db.query(
      `
        SELECT
          v.*,
          va.id AS assignment_id,
          va.usage_count,
          va.max_usage_customer,
          va.status AS assignment_status,
          va.user_id,
          va.user_id AS customer_id,
          ${getVoucherStatusExpression()} AS effective_status,
          DATEDIFF(v.expiry_date, NOW()) AS days_remaining
        FROM vouchers v
        JOIN voucher_assignments va ON va.voucher_id = v.id
        WHERE v.code = ?
          AND va.user_id = ?
        LIMIT 1
      `,
      [normalizedCode, customerId]
    );

    const voucher = rows[0];
    if (!voucher) {
      const error = new Error('Voucher không tồn tại trong tài khoản của bạn');
      error.status = 404;
      throw error;
    }

    if (voucher.effective_status !== 'active' || voucher.assignment_status !== 'active') {
      const error = new Error('Voucher không còn hiệu lực');
      error.status = 400;
      throw error;
    }

    if (Number(voucher.usage_count || 0) >= Number(voucher.max_usage_customer || 1)) {
      const error = new Error('Voucher đã hết lượt dùng cho tài khoản này');
      error.status = 400;
      throw error;
    }

    if (
      voucher.max_usage_global !== null &&
      typeof voucher.max_usage_global !== 'undefined' &&
      Number(voucher.current_usage || 0) >= Number(voucher.max_usage_global)
    ) {
      const error = new Error('Voucher đã hết lượt dùng toàn hệ thống');
      error.status = 400;
      throw error;
    }

    if (safeSubtotal < Number(voucher.min_order_value || 0)) {
      const error = new Error(
        `Voucher cần đơn tối thiểu ${Number(voucher.min_order_value || 0).toLocaleString('vi-VN')} VND`
      );
      error.status = 400;
      throw error;
    }

    const segment = await this.getCustomerSegment(customerId);
    if (voucher.customer_type !== 'both' && voucher.customer_type !== segment) {
      const error = new Error('Voucher không áp dụng cho hạng khách hàng hiện tại');
      error.status = 400;
      throw error;
    }

    const discountAmount = this.calculateDiscount(voucher, safeSubtotal);
    return {
      voucher,
      assignment: {
        id: voucher.assignment_id,
        usage_count: voucher.usage_count,
        max_usage_customer: voucher.max_usage_customer
      },
      discountAmount,
      finalAmount: Math.max(safeSubtotal - discountAmount, 0),
      discountLabel: buildDiscountLabel(voucher)
    };
  }

  async getCustomerVouchers(customerId) {
    await this.autoExpireVouchers();
    const [rows] = await this.db.query(
      `
        SELECT
          v.id,
          v.code,
          v.voucher_type,
          v.discount_amount,
          v.discount_percent,
          v.min_order_value,
          v.max_discount_amount,
          v.customer_type,
          v.description,
          v.expiry_date,
          v.max_usage_global,
          v.current_usage,
          va.id AS assignment_id,
          va.assigned_date,
          va.usage_count,
          va.max_usage_customer,
          ${getVoucherStatusExpression()} AS voucher_status,
          CASE
            WHEN v.expiry_date <= NOW() THEN 'expired'
            WHEN va.status != 'active' THEN va.status
            WHEN DATEDIFF(v.expiry_date, NOW()) <= 3 THEN 'expiring_soon'
            ELSE 'active'
          END AS status,
          DATEDIFF(v.expiry_date, NOW()) AS days_remaining
        FROM voucher_assignments va
        JOIN vouchers v ON va.voucher_id = v.id
        WHERE va.user_id = ?
        ORDER BY
          CASE WHEN va.status = 'active' AND v.status = 'active' AND v.expiry_date > NOW() THEN 0 ELSE 1 END,
          v.expiry_date ASC
      `,
      [customerId]
    );

    return rows.map((row) => ({
      ...row,
      discount_label: buildDiscountLabel(row)
    }));
  }

  async recordVoucherUsage(voucherId, assignmentId, customerId, appointmentId, discountApplied) {
    const connection = await this.db.getConnection();
    let transactionStarted = false;

    try {
      await connection.beginTransaction();
      transactionStarted = true;

      const [assignmentUpdate] = await connection.query(
        `
          UPDATE voucher_assignments
          SET
            usage_count = usage_count + 1,
            last_used_date = NOW(),
            last_appointment_id = ?,
            last_discount_applied = ?,
            total_discount_applied = total_discount_applied + ?,
            applied = 1,
            is_used = CASE WHEN usage_count + 1 >= max_usage_customer THEN 1 ELSE is_used END,
            status = CASE WHEN usage_count + 1 >= max_usage_customer THEN 'used' ELSE status END
          WHERE id = ?
            AND voucher_id = ?
            AND user_id = ?
        `,
        [appointmentId, discountApplied, discountApplied, assignmentId, voucherId, customerId]
      );

      if (!assignmentUpdate.affectedRows) {
        const error = new Error('Không tìm thấy voucher đã gán để ghi nhận lượt dùng');
        error.status = 404;
        throw error;
      }

      await connection.query(
        `
          UPDATE vouchers
          SET current_usage = current_usage + 1
          WHERE id = ?
        `,
        [voucherId]
      );

      await connection.commit();
      return { success: true };
    } catch (error) {
      if (transactionStarted) {
        try {
          await connection.rollback();
        } catch (rollbackErr) {
          console.error('[VoucherUsage] Rollback error:', rollbackErr.message);
        }
      }
      throw error;
    } finally {
      connection.release();
    }
  }

  async getAnalytics() {
    const [summaryRows] = await this.db.query(`
      SELECT
        COUNT(*) AS total_vouchers,
        SUM(CASE WHEN status = 'active' AND expiry_date > NOW() THEN 1 ELSE 0 END) AS active_vouchers,
        COALESCE(SUM(current_usage), 0) AS total_usage,
        COALESCE(SUM(max_usage_global), 0) AS total_available_global
      FROM vouchers
    `);

    const [usageRows] = await this.db.query(`
      SELECT
        v.code,
        v.description,
        COALESCE(SUM(va.usage_count), 0) AS usage_count,
        COALESCE(SUM(va.total_discount_applied), 0) AS discount_total
      FROM vouchers v
      LEFT JOIN voucher_assignments va ON va.voucher_id = v.id
      GROUP BY v.id
      ORDER BY usage_count DESC, v.created_at DESC
      LIMIT 10
    `);

    return {
      summary: summaryRows[0] || {},
      top_vouchers: usageRows
    };
  }
}

module.exports = new VoucherService();
module.exports.normalizeVoucherCode = normalizeVoucherCode;
