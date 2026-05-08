const db = require('../../config/db');

/**
 * RFM Service — Phân hạng khách hàng tự động
 * Port từ Python (ml-analysis/rfm_analysis.py) sang Node.js
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
  if (customers.length === 0) return [];

  const sortedByR = [...customers].sort((a, b) => a.recency - b.recency);
  const sortedByF = [...customers].sort((a, b) => b.frequency - a.frequency);
  const sortedByM = [...customers].sort((a, b) => b.monetary - a.monetary);

  const assignScore = (sortedArr, key) => {
    const n = sortedArr.length;
    sortedArr.forEach((item, idx) => {
      const percentile = idx / n;
      if (percentile < 0.25) item[key] = 4;
      else if (percentile < 0.5) item[key] = 3;
      else if (percentile < 0.75) item[key] = 2;
      else item[key] = 1;
    });
  };

  assignScore(sortedByR, 'r_score');
  assignScore(sortedByF, 'f_score');
  assignScore(sortedByM, 'm_score');

  const scoreMap = new Map();
  sortedByR.forEach((c) => scoreMap.set(c.customer_id, { r_score: c.r_score }));
  sortedByF.forEach((c) => {
    const existing = scoreMap.get(c.customer_id) || {};
    scoreMap.set(c.customer_id, { ...existing, f_score: c.f_score });
  });
  sortedByM.forEach((c) => {
    const existing = scoreMap.get(c.customer_id) || {};
    scoreMap.set(c.customer_id, { ...existing, m_score: c.m_score });
  });

  return customers.map((c) => {
    const scores = scoreMap.get(c.customer_id) || { r_score: 1, f_score: 1, m_score: 1 };
    return {
      ...c,
      ...scores,
      rfm_score: `${scores.r_score}${scores.f_score}${scores.m_score}`
    };
  });
};

/**
 * Phân khúc khách hàng dựa trên điểm RFM
 */
const segmentCustomer = (r, f, m) => {
  if (r >= 4 && f >= 4 && m >= 4) return 'Champions';
  if (f >= 4 && m >= 4) return 'Loyal Customers';
  if ((f >= 3 || m >= 3) && r >= 2) return 'Potential Loyalists';
  if (m >= 3 && r <= 2) return 'At Risk';
  if (r <= 2 && f <= 2) return 'Lost Customers';
  if (f <= 2) return 'New Customers';
  return 'Need Attention';
};

/**
 * Chạy phân tích RFM đầy đủ và cập nhật DB
 */
const runFullAnalysis = async () => {
  console.log('[RFM] Starting full RFM analysis...');

  const customers = await calculateRFM();
  if (customers.length === 0) {
    console.log('[RFM] No customers to analyze');
    return { total: 0, segments: {} };
  }

  const scored = scoreRFM(customers);

  const results = scored.map((c) => ({
    ...c,
    segment: segmentCustomer(c.r_score, c.f_score, c.m_score)
  }));

  // Update DB in batch
  const updatePromises = results.map((c) =>
    query(
      'UPDATE users SET customer_segment = ?, rfm_score = ?, rfm_updated_at = NOW() WHERE id = ?',
      [c.segment, c.rfm_score, c.customer_id]
    )
  );
  await Promise.all(updatePromises);

  // Summarize
  const segments = {};
  results.forEach((c) => {
    segments[c.segment] = (segments[c.segment] || 0) + 1;
  });

  console.log(`[RFM] ✅ Analyzed ${results.length} customers`);
  Object.entries(segments).forEach(([seg, count]) => {
    console.log(`[RFM]   ${seg}: ${count}`);
  });

  return { total: results.length, segments, details: results };
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
