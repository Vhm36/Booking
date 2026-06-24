const db = require('../../config/db');
const path = require('path');
const { runPythonJson, runPythonJsonSync } = require('../../utils/pythonRunner');

const PYTHON_ANALYTICS_SCRIPT = path.join(__dirname, '../../../ml/customer_analytics.py');

/**
 * RFM Service — Phân hạng khách hàng tự động
 * Node lấy dữ liệu DB, thuật toán RFM chạy bằng Python.
 */

const query = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (err, results) => {
      if (err) return reject(err);
      resolve(results);
    });
  });

/**
 * Tính toán RFM cho tất cả khách hàng từ bảng appointments
 */
const calculateRFM = async () => {
  const sql = `
    SELECT
      u.id AS customer_id,
      u.name,
      u.email,
      DATEDIFF(CURDATE(), MAX(a.appointment_date)) AS recency,
      COUNT(a.id) AS frequency,
      COALESCE(SUM(a.total_amount), 0) AS monetary
    FROM users u
    LEFT JOIN appointments a
      ON u.id = a.user_id AND a.status IN ('completed', 'confirmed')
    WHERE u.role = 'customer' AND u.is_active = 1
    GROUP BY u.id, u.name, u.email
  `;

  const rows = await query(sql);

  return rows.map((row) => ({
    customer_id: row.customer_id,
    name: row.name,
    email: row.email,
    recency: row.recency === null ? 999 : Number(row.recency),
    frequency: Number(row.frequency || 0),
    monetary: Number(row.monetary || 0)
  }));
};

/**
 * Gán điểm R, F, M dựa trên quartile phân bổ
 */
const scoreRFM = (customers) => {
  const analysis = runPythonJsonSync(PYTHON_ANALYTICS_SCRIPT, 'rfm', { customers });
  return analysis.details || [];
};

/**
 * Phân khúc khách hàng dựa trên điểm RFM
 */
const segmentCustomer = (r, f, m) => {
  const result = runPythonJsonSync(PYTHON_ANALYTICS_SCRIPT, 'rfm_segment', {
    r_score: r,
    f_score: f,
    m_score: m
  });
  return result.segment;
};

/**
 * Chạy phân tích RFM đầy đủ và cập nhật DB
 */
const runFullAnalysis = async () => {
  console.log('[RFM] Starting full Python RFM analysis...');

  const customers = await calculateRFM();
  if (customers.length === 0) {
    console.log('[RFM] No customers to analyze');
    return { total: 0, segments: {} };
  }

  const analysis = await runPythonJson(PYTHON_ANALYTICS_SCRIPT, 'rfm', { customers });
  const results = analysis.details || [];

  // Update DB in batch
  const updatePromises = results.map((c) =>
    query(
      'UPDATE users SET customer_segment = ?, rfm_score = ?, rfm_updated_at = NOW() WHERE id = ?',
      [c.segment, c.rfm_score, c.customer_id]
    )
  );
  await Promise.all(updatePromises);

  const segments = analysis.segments || {};

  console.log(`[RFM] ✅ Analyzed ${results.length} customers`);
  Object.entries(segments).forEach(([seg, count]) => {
    console.log(`[RFM]   ${seg}: ${count}`);
  });

  return {
    total: results.length,
    segments,
    details: results,
    method: analysis.method || 'python_rfm'
  };
};

/**
 * Lấy danh sách khách At Risk (chưa quay lại 30+ ngày, monetary cao)
 */
const getAtRiskCustomers = async () => {
  const sql = `
    SELECT id, name, email, customer_segment, rfm_score
    FROM users
    WHERE role = 'customer'
      AND customer_segment = 'At Risk'
      AND is_active = 1
    ORDER BY rfm_score DESC
  `;
  return query(sql);
};

/**
 * Lấy danh sách khách Champions
 */
const getChampionCustomers = async () => {
  const sql = `
    SELECT id, name, email, customer_segment, rfm_score
    FROM users
    WHERE role = 'customer'
      AND customer_segment = 'Champions'
      AND is_active = 1
    ORDER BY rfm_score DESC
  `;
  return query(sql);
};

/**
 * Lấy thống kê phân bổ segment
 */
const getSegmentStats = async () => {
  const sql = `
    SELECT
      customer_segment AS segment,
      COUNT(*) AS count
    FROM users
    WHERE role = 'customer' AND is_active = 1
    GROUP BY customer_segment
    ORDER BY count DESC
  `;
  return query(sql);
};

module.exports = {
  calculateRFM,
  scoreRFM,
  segmentCustomer,
  runFullAnalysis,
  getAtRiskCustomers,
  getChampionCustomers,
  getSegmentStats
};
