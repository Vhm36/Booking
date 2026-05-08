const cron = require('node-cron');
const rfmService = require('../services/rfmService');
const db = require('../config/db');

let voucherService = null;
try {
  voucherService = require('../services/voucherService');
} catch (err) {
  console.log('[RFM Job] voucherService not available');
}

const query = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (err, results) => {
      if (err) return reject(err);
      resolve(results);
    });
  });

/**
 * Tạo voucher tự động cho khách At Risk (re-engagement)
 */
const createReengagementVouchers = async () => {
  try {
    const atRiskCustomers = await rfmService.getAtRiskCustomers();
    if (atRiskCustomers.length === 0) return;

    console.log(`[RFM Job] Creating re-engagement vouchers for ${atRiskCustomers.length} At Risk customers`);

    // Check if today's re-engagement voucher already exists
    const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const voucherCode = `COMEBACK${today}`;

    const existing = await query('SELECT id FROM vouchers WHERE code = ?', [voucherCode]);

    let voucherId;
    if (existing.length > 0) {
      voucherId = existing[0].id;
    } else {
      // Create a 25% re-engagement voucher
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + 7);

      const result = await query(
        `INSERT INTO vouchers (code, voucher_type, discount_percent, min_order_value, max_discount_amount, customer_type, max_usage_global, max_usage_per_customer, status, description, expiry_date)
         VALUES (?, 'percentage', 25, 100000, 200000, 'both', ?, 1, 'active', 'Voucher chào mừng trở lại - Giảm 25%', ?)`,
        [voucherCode, atRiskCustomers.length, expiryDate]
      );
      voucherId = result.insertId;
    }

    // Assign to At Risk customers
    for (const customer of atRiskCustomers) {
      try {
        await query(
          `INSERT IGNORE INTO voucher_assignments (voucher_id, customer_id, source) VALUES (?, ?, 'system')`,
          [voucherId, customer.id]
        );
      } catch (assignErr) {
        // Ignore duplicate assignment errors
      }
    }

    console.log(`[RFM Job] ✅ Re-engagement voucher ${voucherCode} assigned to ${atRiskCustomers.length} customers`);
  } catch (err) {
    console.error('[RFM Job] Error creating re-engagement vouchers:', err.message);
  }
};

/**
 * Tạo voucher VIP cho Champions
 */
const createVipVouchers = async () => {
  try {
    const champions = await rfmService.getChampionCustomers();
    if (champions.length === 0) return;

    const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const voucherCode = `VIP${today}`;

    const existing = await query('SELECT id FROM vouchers WHERE code = ?', [voucherCode]);

    let voucherId;
    if (existing.length > 0) {
      voucherId = existing[0].id;
    } else {
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + 14);

      const result = await query(
        `INSERT INTO vouchers (code, voucher_type, discount_percent, min_order_value, max_discount_amount, customer_type, max_usage_global, max_usage_per_customer, status, description, expiry_date)
         VALUES (?, 'percentage', 15, 0, 300000, 'vip', ?, 1, 'active', 'Voucher VIP dành riêng cho khách hàng thân thiết - Giảm 15%', ?)`,
        [voucherCode, champions.length, expiryDate]
      );
      voucherId = result.insertId;
    }

    for (const customer of champions) {
      try {
        await query(
          `INSERT IGNORE INTO voucher_assignments (voucher_id, customer_id, source) VALUES (?, ?, 'system')`,
          [voucherId, customer.id]
        );
      } catch (assignErr) {
        // Ignore duplicate
      }
    }

    console.log(`[RFM Job] ✅ VIP voucher ${voucherCode} assigned to ${champions.length} Champions`);
  } catch (err) {
    console.error('[RFM Job] Error creating VIP vouchers:', err.message);
  }
};

/**
 * Main job: RFM analysis + auto voucher
 */
const runRFMJob = async () => {
  try {
    console.log(`[RFM Job] Starting at ${new Date().toLocaleString('vi-VN')}`);

    // 1. Run RFM analysis
    const result = await rfmService.runFullAnalysis();
    console.log(`[RFM Job] Analysis complete: ${result.total} customers`);

    // 2. Create re-engagement vouchers for At Risk
    await createReengagementVouchers();

    // 3. Create VIP vouchers for Champions
    await createVipVouchers();

    console.log('[RFM Job] ✅ Complete');
  } catch (err) {
    console.error('[RFM Job] Error:', err.message);
  }
};

const startRFMJob = () => {
  // Run daily at 3:00 AM
  cron.schedule('0 3 * * *', () => {
    runRFMJob();
  });

  console.log('[RFM Job] ✅ RFM classification job scheduled (daily at 3:00 AM)');
};

module.exports = { startRFMJob, runRFMJob };
