const cron = require('node-cron');
const db = require('../config/db');
const { emitDashboardUpdateFromApp } = require('../utils/realtime');

const TIMEZONE = 'Asia/Ho_Chi_Minh';
const BIRTHDAY_DISCOUNT_PERCENT = 20;
const BIRTHDAY_VALID_DAYS = 14;

let isJobRunning = false;
let voucherAssignmentColumnsCache = null;

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

const pad2 = (value) => String(value).padStart(2, '0');
const quoteId = (value) => `\`${String(value).replace(/`/g, '``')}\``;

const getVietnamDateParts = (date = new Date()) => {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    dateCode: `${parts.year}${parts.month}${parts.day}`
  };
};

const getExpiryDate = (now = new Date()) => {
  const expiryDate = new Date(now);
  expiryDate.setDate(expiryDate.getDate() + BIRTHDAY_VALID_DAYS);
  expiryDate.setHours(23, 59, 59, 0);
  return expiryDate;
};

const getBirthdayCustomers = async ({ month, day }) =>
  query(
    `
      SELECT id, name, email
      FROM users
      WHERE role = 'customer'
        AND is_active = 1
        AND date_of_birth IS NOT NULL
        AND MONTH(date_of_birth) = ?
        AND DAY(date_of_birth) = ?
    `,
    [month, day]
  );

const createBirthdayVoucher = async ({ dateCode, totalCustomers, now }) => {
  const code = `BIRTHDAY${dateCode}`;
  const description = 'Quà sinh nhật BeautyBook - giảm 20% cho lịch hẹn trong 14 ngày.';
  const expiryDate = getExpiryDate(now);
  const existing = await query('SELECT id FROM vouchers WHERE code = ?', [code]);

  if (existing.length > 0) {
    await query(
      `
        UPDATE vouchers
        SET
          voucher_type = 'percentage',
          discount_percent = ?,
          min_order_value = 200000,
          max_discount_amount = 150000,
          customer_type = 'both',
          max_usage_global = GREATEST(COALESCE(max_usage_global, 0), ?),
          description = ?,
          expiry_date = IF(expiry_date < ?, ?, expiry_date),
          status = 'active'
        WHERE id = ?
      `,
      [BIRTHDAY_DISCOUNT_PERCENT, totalCustomers, description, expiryDate, expiryDate, existing[0].id]
    );
    return { id: existing[0].id, code, reused: true };
  }

  const result = await query(
    `
      INSERT INTO vouchers (
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
      VALUES (?, 'percentage', ?, 200000, 150000, 'both', ?, 'active', ?, ?)
    `,
    [code, BIRTHDAY_DISCOUNT_PERCENT, totalCustomers, description, expiryDate]
  );

  return { id: result.insertId, code, reused: false };
};

const getVoucherAssignmentColumns = async () => {
  if (voucherAssignmentColumnsCache) {
    return voucherAssignmentColumnsCache;
  }

  const rows = await query('SHOW COLUMNS FROM voucher_assignments');
  voucherAssignmentColumnsCache = new Set(rows.map((row) => row.Field));
  return voucherAssignmentColumnsCache;
};

const assignBirthdayVoucher = async ({ voucherId, customerId, reason }) => {
  const columns = await getVoucherAssignmentColumns();
  const userReferenceColumn = columns.has('user_id') ? 'user_id' : 'customer_id';
  const row = {
    voucher_id: voucherId,
    [userReferenceColumn]: customerId,
    max_usage_customer: 1,
    source: 'system',
    reason,
    confidence_score: 1,
    shown_date: new Date()
  };
  const selectedColumns = Object.keys(row).filter((column) => columns.has(column));

  const result = await query(
    `
      INSERT IGNORE INTO voucher_assignments (${selectedColumns.map(quoteId).join(', ')})
      VALUES (${selectedColumns.map(() => '?').join(', ')})
    `,
    selectedColumns.map((column) => row[column])
  );

  return Number(result?.affectedRows || 0) > 0;
};

const runBirthdayVoucherJob = async ({ app = null, trigger = 'manual', now = new Date() } = {}) => {
  if (isJobRunning) {
    const skippedResult = {
      skipped: true,
      reason: 'already_running',
      trigger,
      timestamp: new Date().toISOString()
    };

    console.warn(`[Birthday Voucher Job] Skip ${trigger} trigger because another run is active`);
    emitDashboardUpdateFromApp(app, 'automation.birthday_vouchers_skipped', skippedResult);
    return skippedResult;
  }

  isJobRunning = true;

  try {
    const startedAt = new Date();
    const vietnamDate = getVietnamDateParts(now);
    const birthdayCustomers = await getBirthdayCustomers(vietnamDate);

    if (birthdayCustomers.length === 0) {
      const emptyResult = {
        skipped: false,
        trigger,
        dateCode: vietnamDate.dateCode,
        birthdayMonth: pad2(vietnamDate.month),
        birthdayDay: pad2(vietnamDate.day),
        targetedCustomers: 0,
        assignedCustomers: 0,
        voucherCode: null,
        startedAt: startedAt.toISOString(),
        completedAt: new Date().toISOString()
      };

      console.log(`[Birthday Voucher Job] No customer birthday on ${pad2(vietnamDate.day)}/${pad2(vietnamDate.month)}`);
      emitDashboardUpdateFromApp(app, 'automation.birthday_vouchers_completed', emptyResult);
      return emptyResult;
    }

    const voucher = await createBirthdayVoucher({
      dateCode: vietnamDate.dateCode,
      totalCustomers: birthdayCustomers.length,
      now
    });

    let assignedCustomers = 0;
    for (const customer of birthdayCustomers) {
      try {
        const assigned = await assignBirthdayVoucher({
          voucherId: voucher.id,
          customerId: customer.id,
          reason: `Tự động tặng voucher sinh nhật ngày ${pad2(vietnamDate.day)}/${pad2(vietnamDate.month)}`
        });

        if (assigned) {
          assignedCustomers += 1;
        }
      } catch (assignErr) {
        console.error(`[Birthday Voucher Job] Cannot assign voucher to customer ${customer.id}:`, assignErr.message);
      }
    }

    const jobResult = {
      skipped: false,
      trigger,
      dateCode: vietnamDate.dateCode,
      birthdayMonth: pad2(vietnamDate.month),
      birthdayDay: pad2(vietnamDate.day),
      voucherId: voucher.id,
      voucherCode: voucher.code,
      voucherReused: voucher.reused,
      targetedCustomers: birthdayCustomers.length,
      assignedCustomers,
      startedAt: startedAt.toISOString(),
      completedAt: new Date().toISOString()
    };

    console.log(
      `[Birthday Voucher Job] ${voucher.code} assigned to ${assignedCustomers}/${birthdayCustomers.length} birthday customers`
    );
    emitDashboardUpdateFromApp(app, 'automation.birthday_vouchers_completed', jobResult);
    return jobResult;
  } catch (err) {
    console.error('[Birthday Voucher Job] Error:', err.message);
    emitDashboardUpdateFromApp(app, 'automation.birthday_vouchers_failed', {
      trigger,
      error: err.message,
      timestamp: new Date().toISOString()
    });
    throw err;
  } finally {
    isJobRunning = false;
  }
};

const startBirthdayVoucherJob = (app = null) => {
  cron.schedule(
    '0 0 * * *',
    () => {
      runBirthdayVoucherJob({ app, trigger: 'cron' }).catch((err) => {
        console.error('[Birthday Voucher Job] Scheduled run failed:', err.message);
      });
    },
    { timezone: TIMEZONE }
  );

  console.log('[Birthday Voucher Job] Scheduled daily at 00:00 Asia/Ho_Chi_Minh');

  if (process.env.AUTOMATION_RUN_ON_STARTUP !== 'false') {
    setTimeout(() => {
      runBirthdayVoucherJob({ app, trigger: 'startup' }).catch((err) => {
        console.error('[Birthday Voucher Job] Startup catch-up failed:', err.message);
      });
    }, 1000);
  }
};

module.exports = {
  startBirthdayVoucherJob,
  runBirthdayVoucherJob
};
