/**
 * VOUCHER SERVICE - Core Business Logic
 * Path: /backend/src/services/voucherService.js
 */

const db = require('../config/db');

class VoucherService {
  /**
   * Create a new voucher
   */
  async createVoucher(voucherData) {
    const {
      code,
      voucherType,
      discountAmount,
      discountPercent,
      minOrderValue,
      maxDiscountAmount,
      customerType,
      description,
      expiryDate,
      maxUsageGlobal,
      createdBy
    } = voucherData;

    try {
      const query = `
        INSERT INTO vouchers (
          code, voucher_type, discount_amount, discount_percent,
          min_order_value, max_discount_amount, customer_type,
          description, issued_date, expiry_date, max_usage_global,
          created_by, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?, 'active')
      `;

      const [result] = await db.query(query, [
        code,
        voucherType,
        discountAmount,
        discountPercent,
        minOrderValue,
        maxDiscountAmount,
        customerType,
        description,
        expiryDate,
        maxUsageGlobal,
        createdBy
      ]);

      return {
        success: true,
        voucherId: result.insertId,
        code
      };
    } catch (error) {
      console.error('Error creating voucher:', error);
      throw error;
    }
  }

  /**
   * Get voucher by code
   */
  async getVoucherByCode(code) {
    const query = `
      SELECT * FROM vouchers
      WHERE code = ? AND status = 'active'
        AND expiry_date > NOW()
    `;

    const [rows] = await db.query(query, [code]);
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Assign voucher to customer
   */
  async assignVoucherToCustomer(voucherId, customerId, maxUsageCustomer = 1) {
    try {
      const query = `
        INSERT INTO voucher_assignments (voucher_id, customer_id, max_usage_customer)
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE updated_at = NOW()
      `;

      const [result] = await db.query(query, [voucherId, customerId, maxUsageCustomer]);
      return {
        success: true,
        assignmentId: result.insertId
      };
    } catch (error) {
      console.error('Error assigning voucher:', error);
      throw error;
    }
  }

  /**
   * Get vouchers for customer
   */
  async getCustomerVouchers(customerId) {
    const query = `
      SELECT
        v.id, v.code, v.voucher_type, v.discount_amount, v.discount_percent,
        v.min_order_value, v.max_discount_amount, v.description,
        va.assigned_date, va.usage_count, va.max_usage_customer,
        DATEDIFF(v.expiry_date, NOW()) as days_remaining,
        CASE
          WHEN v.expiry_date <= NOW() THEN 'expired'
          WHEN DATEDIFF(v.expiry_date, NOW()) <= 1 THEN 'expiring_soon'
          ELSE 'valid'
        END as status
      FROM voucher_assignments va
      JOIN vouchers v ON va.voucher_id = v.id
      WHERE va.customer_id = ? AND va.status = 'active'
      ORDER BY v.expiry_date ASC
    `;

    const [rows] = await db.query(query, [customerId]);
    return rows;
  }

  /**
   * Apply voucher to order/appointment
   */
  async applyVoucher(customerId, voucherId, appointmentId, subtotal) {
    // Get voucher details
    const voucher = await this.getVoucherById(voucherId);
    if (!voucher) throw new Error('Voucher not found');

    // Check if customer has this voucher
    const assignment = await this.getVoucherAssignment(voucherId, customerId);
    if (!assignment) throw new Error('Customer does not have this voucher');

    // Check usage limit
    if (assignment.usage_count >= assignment.max_usage_customer) {
      throw new Error('Voucher usage limit exceeded');
    }

    // Check minimum order value
    if (subtotal < voucher.min_order_value) {
      throw new Error(`Minimum order value: ${voucher.min_order_value} VND`);
    }

    // Calculate discount
    let discountAmount = 0;
    if (voucher.voucher_type === 'fixed') {
      discountAmount = voucher.discount_amount;
    } else if (voucher.voucher_type === 'percentage') {
      discountAmount = (subtotal * voucher.discount_percent) / 100;
      if (voucher.max_discount_amount) {
        discountAmount = Math.min(discountAmount, voucher.max_discount_amount);
      }
    }

    return {
      voucherId,
      discountAmount: Math.round(discountAmount * 100) / 100
    };
  }

  /**
   * Record voucher usage
   */
  async recordVoucherUsage(voucherId, assignmentId, customerId, appointmentId, discountApplied) {
    try {
      // Insert usage record
      const usageQuery = `
        INSERT INTO voucher_usage_history (
          voucher_id, assignment_id, customer_id, appointment_id, discount_applied
        ) VALUES (?, ?, ?, ?, ?)
      `;

      await db.query(usageQuery, [
        voucherId,
        assignmentId,
        customerId,
        appointmentId,
        discountApplied
      ]);

      // Update assignment usage count
      const updateQuery = `
        UPDATE voucher_assignments
        SET usage_count = usage_count + 1, last_used_date = NOW()
        WHERE id = ?
      `;

      await db.query(updateQuery, [assignmentId]);

      // Update voucher global usage count
      const voucherQuery = `
        UPDATE vouchers
        SET current_usage = current_usage + 1
        WHERE id = ?
      `;

      await db.query(voucherQuery, [voucherId]);

      return { success: true };
    } catch (error) {
      console.error('Error recording voucher usage:', error);
      throw error;
    }
  }

  /**
   * Get voucher by ID
   */
  async getVoucherById(voucherId) {
    const query = `SELECT * FROM vouchers WHERE id = ?`;
    const [rows] = await db.query(query, [voucherId]);
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Get voucher assignment
   */
  async getVoucherAssignment(voucherId, customerId) {
    const query = `
      SELECT * FROM voucher_assignments
      WHERE voucher_id = ? AND customer_id = ?
    `;

    const [rows] = await db.query(query, [voucherId, customerId]);
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Classify customer as Regular or VIP
   */
  async classifyCustomer(customerId) {
    const query = `
      SELECT
        c.id,
        SUM(b.total_amount) as total_spent,
        COUNT(DISTINCT a.id) as total_orders,
        c.created_at,
        MAX(a.appointment_date) as last_order_date,
        DATEDIFF(NOW(), MAX(a.appointment_date)) as days_since_last_order,
        (COUNT(DISTINCT a.id) - 
         COUNT(DISTINCT CASE WHEN a.status = 'cancelled' THEN 1 END) - 
         COUNT(DISTINCT CASE WHEN a.status = 'pending' THEN 1 END)) / 
        COUNT(DISTINCT a.id) as completion_rate
      FROM customers c
      LEFT JOIN appointments a ON c.id = a.customer_id
      LEFT JOIN bills b ON a.id = b.appointment_id
      WHERE c.id = ?
      GROUP BY c.id
    `;

    const [rows] = await db.query(query, [customerId]);
    if (!rows.length) return 'regular';

    const data = rows[0];
    const totalSpent = data.total_spent || 0;
    const totalOrders = data.total_orders || 0;
    const completionRate = data.completion_rate || 0;
    const daysSinceLast = data.days_since_last_order || 999;
    const memberMonths = Math.floor(
      (new Date() - new Date(data.created_at)) / (1000 * 60 * 60 * 24 * 30)
    );

    // VIP Criteria
    if (
      totalSpent >= 2000000 &&
      totalOrders >= 10 &&
      memberMonths > 12 &&
      completionRate > 0.5 &&
      daysSinceLast < 7
    ) {
      return 'vip';
    }

    return 'regular';
  }

  /**
   * Update customer type in database
   */
  async updateCustomerType(customerId, customerType) {
    const dateColumn = customerType === 'vip' ? 'vip_promoted_date' : 'vip_downgrade_date';
    const query = `
      UPDATE customers
      SET customer_type = ?, ${dateColumn} = NOW()
      WHERE id = ?
    `;

    await db.query(query, [customerType, customerId]);
  }
}

module.exports = new VoucherService();
