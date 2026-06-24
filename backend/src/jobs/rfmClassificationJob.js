const cron = require('node-cron');
const rfmService = require('../services/rfmService');
const db = require('../config/db');

const pad2 = (value) => String(value).padStart(2, '0');

const getLocalDateCode = (date = new Date()) =>
  `${date.getFullYear()}${pad2(date.getMonth() + 1)}${pad2(date.getDate())}`;

const query = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (err, results) => {
      if (err) return reject(err);
      resolve(results);
    });
  });

const createSystemVoucher = async ({
  code,
  discountPercent,
  minOrderValue,
  maxDiscountAmount,
  customerType,
  maxUsageGlobal,
  description,
  validDays
}) => {
  const existing = await query('SELECT id FROM vouchers WHERE code = ?', [code]);
  if (existing.length > 0) {
    return existing[0].id;
  }

  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + validDays);

  const result = await query(
    `INSERT INTO vouchers (
       code,
       voucher_type,
       discount_percent,
       min_order_value,
       max_discount_amount,
       customer_type,
       max_usage_global,
       status,
       description,
       expiry_date
     )
     VALUES (?, 'percentage', ?, ?, ?, ?, ?, 'active', ?, ?)`,
    [
      code,
      discountPercent,
      minOrderValue,
      maxDiscountAmount,
      customerType,
      maxUsageGlobal,
      description,
      expiryDate
    ]
  );

  return result.insertId;
};

const assignSystemVoucher = async (voucherId, customerId, reason) => {
  await query(
    `INSERT IGNORE INTO voucher_assignments (
       voucher_id,
       user_id,
       max_usage_customer,
       source,
       reason
     )
     VALUES (?, ?, 1, 'system', ?)`,
    [voucherId, customerId, reason]
  );
};

const createReengagementVouchers = async () => {
  try {
    const atRiskCustomers = await rfmService.getAtRiskCustomers();
    if (atRiskCustomers.length === 0) return;

    console.log(`[RFM Job] Creating re-engagement vouchers for ${atRiskCustomers.length} At Risk customers`);

    const today = getLocalDateCode();
    const voucherId = await createSystemVoucher({
      code: `COMEBACK${today}`,
      discountPercent: 25,
      minOrderValue: 100000,
      maxDiscountAmount: 200000,
      customerType: 'both',
      maxUsageGlobal: atRiskCustomers.length,
      description: 'Voucher chào mừng trở lại - Giảm 25%',
      validDays: 7
    });

    for (const customer of atRiskCustomers) {
      try {
        await assignSystemVoucher(voucherId, customer.id, 'Ưu đãi chào mừng khách quay lại');
      } catch (assignErr) {
        // Ignore duplicate assignment errors.
      }
    }

    console.log(`[RFM Job] Re-engagement voucher assigned to ${atRiskCustomers.length} customers`);
  } catch (err) {
    console.error('[RFM Job] Error creating re-engagement vouchers:', err.message);
  }
};

const createVipVouchers = async () => {
  try {
    const champions = await rfmService.getChampionCustomers();
    if (champions.length === 0) return;

    const today = getLocalDateCode();
    const voucherId = await createSystemVoucher({
      code: `VIP${today}`,
      discountPercent: 15,
      minOrderValue: 0,
      maxDiscountAmount: 300000,
      customerType: 'vip',
      maxUsageGlobal: champions.length,
      description: 'Voucher VIP dành riêng cho khách hàng thân thiết - Giảm 15%',
      validDays: 14
    });

    for (const customer of champions) {
      try {
        await assignSystemVoucher(voucherId, customer.id, 'Thưởng khách hàng VIP thân thiết');
      } catch (assignErr) {
        // Ignore duplicate assignment errors.
      }
    }

    console.log(`[RFM Job] VIP voucher assigned to ${champions.length} Champions`);
  } catch (err) {
    console.error('[RFM Job] Error creating VIP vouchers:', err.message);
  }
};

const runRFMJob = async () => {
  try {
    console.log(`[RFM Job] Starting at ${new Date().toLocaleString('vi-VN')}`);

    const result = await rfmService.runFullAnalysis();
    console.log(`[RFM Job] Analysis complete: ${result.total} customers`);

    await createReengagementVouchers();
    await createVipVouchers();

    console.log('[RFM Job] Complete');
  } catch (err) {
    console.error('[RFM Job] Error:', err.message);
  }
};

const startRFMJob = () => {
  cron.schedule('0 3 * * *', () => {
    runRFMJob();
  });

  console.log('[RFM Job] RFM classification job scheduled (daily at 3:00 AM)');
};

module.exports = { startRFMJob, runRFMJob };
