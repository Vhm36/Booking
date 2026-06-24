const cron = require('node-cron');
const clusteringService = require('../services/clusteringService');
const db = require('../config/db');
const { emitDashboardUpdateFromApp } = require('../utils/realtime');

let isJobRunning = false;

const pad2 = (value) => String(value).padStart(2, '0');

const getLocalDateCode = (date = new Date()) =>
  `${date.getFullYear()}${pad2(date.getMonth() + 1)}${pad2(date.getDate())}`;

const query = async (sql, params = []) => {
  if (db.ready) {
    await db.ready;
  }

  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, results) => {
      if (err) return reject(err);
      resolve(results);
    });
  });
};

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
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + validDays);

  const existing = await query('SELECT id FROM vouchers WHERE code = ?', [code]);
  if (existing.length > 0) {
    await query(
      `UPDATE vouchers
       SET
         description = ?,
         max_usage_global = GREATEST(COALESCE(max_usage_global, 0), ?),
         expiry_date = IF(expiry_date < ?, ?, expiry_date),
         status = 'active'
       WHERE id = ?`,
      [description, maxUsageGlobal, expiryDate, expiryDate, existing[0].id]
    );
    return existing[0].id;
  }

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
  const result = await query(
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

  return Number(result?.affectedRows || 0) > 0;
};

const createReengagementVouchers = async () => {
  try {
    const atRiskCustomers = await clusteringService.getAtRiskCustomers();
    if (atRiskCustomers.length === 0) {
      return {
        voucherCode: null,
        targetedCustomers: 0,
        assignedCustomers: 0
      };
    }

    console.log(`[Clustering Job] Creating re-engagement vouchers for ${atRiskCustomers.length} At Risk customers`);

    const today = getLocalDateCode();
    const voucherCode = `COMEBACK${today}`;
    const voucherId = await createSystemVoucher({
      code: voucherCode,
      discountPercent: 25,
      minOrderValue: 100000,
      maxDiscountAmount: 200000,
      customerType: 'both',
      maxUsageGlobal: atRiskCustomers.length,
      description: 'Voucher chào mừng trở lại - Giảm 25%',
      validDays: 7
    });

    let assignedCustomers = 0;
    for (const customer of atRiskCustomers) {
      try {
        const assigned = await assignSystemVoucher(voucherId, customer.id, 'Ưu đãi chào mừng khách quay lại');
        if (assigned) {
          assignedCustomers += 1;
        }
      } catch (assignErr) {
        // Ignore duplicate assignment errors.
      }
    }

    console.log(`[Clustering Job] Re-engagement voucher assigned to ${assignedCustomers}/${atRiskCustomers.length} customers`);
    return {
      voucherId,
      voucherCode,
      targetedCustomers: atRiskCustomers.length,
      assignedCustomers
    };
  } catch (err) {
    console.error('[Clustering Job] Error creating re-engagement vouchers:', err.message);
    return {
      voucherCode: null,
      targetedCustomers: 0,
      assignedCustomers: 0,
      error: err.message
    };
  }
};

const createVipVouchers = async () => {
  try {
    const champions = await clusteringService.getChampionCustomers();
    if (champions.length === 0) {
      return {
        voucherCode: null,
        targetedCustomers: 0,
        assignedCustomers: 0
      };
    }

    const today = getLocalDateCode();
    const voucherCode = `VIP${today}`;
    const voucherId = await createSystemVoucher({
      code: voucherCode,
      discountPercent: 15,
      minOrderValue: 0,
      maxDiscountAmount: 300000,
      customerType: 'vip',
      maxUsageGlobal: champions.length,
      description: 'Voucher VIP dành riêng cho khách hàng thân thiết - Giảm 15%',
      validDays: 14
    });

    let assignedCustomers = 0;
    for (const customer of champions) {
      try {
        const assigned = await assignSystemVoucher(voucherId, customer.id, 'Thưởng khách hàng VIP thân thiết');
        if (assigned) {
          assignedCustomers += 1;
        }
      } catch (assignErr) {
        // Ignore duplicate assignment errors.
      }
    }

    console.log(`[Clustering Job] VIP voucher assigned to ${assignedCustomers}/${champions.length} Champions`);
    return {
      voucherId,
      voucherCode,
      targetedCustomers: champions.length,
      assignedCustomers
    };
  } catch (err) {
    console.error('[Clustering Job] Error creating VIP vouchers:', err.message);
    return {
      voucherCode: null,
      targetedCustomers: 0,
      assignedCustomers: 0,
      error: err.message
    };
  }
};

const runClusteringJob = async ({ app = null, trigger = 'manual', sourceAppointmentId = null } = {}) => {
  if (isJobRunning) {
    const skippedResult = {
      skipped: true,
      reason: 'already_running',
      trigger,
      sourceAppointmentId,
      timestamp: new Date().toISOString()
    };

    console.warn(`[Clustering Job] Skip ${trigger} trigger because another run is active`);
    emitDashboardUpdateFromApp(app, 'automation.clustering_skipped', skippedResult);
    return skippedResult;
  }

  isJobRunning = true;

  try {
    const startedAt = new Date();
    console.log(`[Clustering Job] Starting at ${startedAt.toLocaleString('vi-VN')} (${trigger})`);

    const result = await clusteringService.runFullAnalysis();
    console.log(`[Clustering Job] Analysis complete: ${result.total} customers`);

    const reengagement = await createReengagementVouchers();
    const vip = await createVipVouchers();
    const completedAt = new Date();
    const jobResult = {
      skipped: false,
      trigger,
      sourceAppointmentId,
      startedAt: startedAt.toISOString(),
      completedAt: completedAt.toISOString(),
      processedCustomers: Number(result.total || 0),
      segments: result.segments || {},
      iterations: result.iterations || 0,
      vouchers: {
        comeback: reengagement,
        vip,
        assignedTotal:
          Number(reengagement?.assignedCustomers || 0) + Number(vip?.assignedCustomers || 0),
        targetedTotal:
          Number(reengagement?.targetedCustomers || 0) + Number(vip?.targetedCustomers || 0)
      }
    };

    console.log('[Clustering Job] Complete');
    emitDashboardUpdateFromApp(app, 'automation.clustering_completed', jobResult);
    return jobResult;
  } catch (err) {
    console.error('[Clustering Job] Error:', err.message);
    emitDashboardUpdateFromApp(app, 'automation.clustering_failed', {
      trigger,
      sourceAppointmentId,
      error: err.message,
      timestamp: new Date().toISOString()
    });
    throw err;
  } finally {
    isJobRunning = false;
  }
};

const startClusteringJob = (app = null) => {
  cron.schedule('0 3 * * *', () => {
    runClusteringJob({ app, trigger: 'cron' }).catch((err) => {
      console.error('[Clustering Job] Scheduled run failed:', err.message);
    });
  });

  console.log('[Clustering Job] Customer clustering job scheduled (daily at 3:00 AM)');

  if (process.env.AUTOMATION_RUN_ON_STARTUP !== 'false') {
    setTimeout(async () => {
      try {
        const today = getLocalDateCode();
        const comebackCode = `COMEBACK${today}`;
        const vipCode = `VIP${today}`;
        const rows = await query(
          `
            SELECT
              SUM(v.code = ?) AS comeback_ready,
              SUM(v.code = ?) AS vip_ready
            FROM voucher_assignments va
            JOIN vouchers v ON v.id = va.voucher_id
            WHERE va.source = 'system'
              AND v.code IN (?, ?)
          `,
          [comebackCode, vipCode, comebackCode, vipCode]
        );
        const status = rows[0] || {};

        if (Number(status.comeback_ready || 0) > 0 && Number(status.vip_ready || 0) > 0) {
          console.log('[Clustering Job] Startup catch-up skipped because today\'s vouchers already exist');
          return;
        }

        await runClusteringJob({ app, trigger: 'startup' });
      } catch (err) {
        console.error('[Clustering Job] Startup catch-up failed:', err.message);
      }
    }, 2000);
  }
};

module.exports = { startClusteringJob, runClusteringJob };
