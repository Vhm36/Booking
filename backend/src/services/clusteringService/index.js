const db = require('../../config/db');
const path = require('path');
const { runPythonJson } = require('../../utils/pythonRunner');

const AUTOMATION_HISTORY_START_DATE = '2024-01-01';
const PYTHON_ANALYTICS_SCRIPT = path.join(__dirname, '../../../ml/customer_analytics.py');

/**
 * Customer Clustering Service — Phân cụm khách hàng bằng K-Means
 * Thay thế RFM rule-based bằng mô hình phân cụm (Unsupervised ML)
 * 
 * Features: Recency, Frequency, Monetary, Cancellation Rate
 * K = 5 cụm mặc định
 */

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

// ============================
// Thuật toán K-Means chạy trong backend/ml/customer_analytics.py
// Service này chỉ trích xuất dữ liệu và lưu kết quả Python trả về.
// ============================

// ============================
// Service chính
// ============================

/**
 * Trích xuất dữ liệu hành vi khách hàng từ DB
 */
const extractCustomerFeatures = async () => {
  const sql = `
    SELECT
      u.id AS customer_id,
      u.name,
      u.email,
      DATEDIFF(CURDATE(), MAX(a.appointment_date)) AS recency,
      COUNT(a.id) AS frequency,
      COALESCE(SUM(CASE WHEN a.status IN ('completed', 'confirmed') THEN a.total_amount ELSE 0 END), 0) AS monetary,
      COALESCE(
        SUM(CASE WHEN a.status = 'cancelled' THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(a.id), 0),
        0
      ) AS cancel_rate
    FROM users u
    LEFT JOIN appointments a
      ON u.id = a.user_id
      AND a.appointment_date BETWEEN ? AND CURDATE()
    WHERE u.role = 'customer' AND u.is_active = 1
    GROUP BY u.id, u.name, u.email
  `;

  const rows = await query(sql, [AUTOMATION_HISTORY_START_DATE]);

  return rows.map((row) => ({
    customer_id: row.customer_id,
    name: row.name,
    email: row.email,
    recency: row.recency === null ? 999 : Number(row.recency),
    frequency: Number(row.frequency || 0),
    monetary: Number(row.monetary || 0),
    cancel_rate: Number(row.cancel_rate || 0)
  }));
};

/**
 * Chạy phân cụm K-Means đầy đủ và cập nhật DB
 * @param {number} k - Số cụm (mặc định 5)
 */
const runFullAnalysis = async (k = 5) => {
  console.log('[CLUSTERING] Bắt đầu phân cụm khách hàng K-Means bằng Python...');

  const customers = await extractCustomerFeatures();
  if (customers.length === 0) {
    console.log('[CLUSTERING] Không có khách hàng để phân tích');
    return { total: 0, segments: {} };
  }

  const featureKeys = ['recency', 'frequency', 'monetary', 'cancel_rate'];

  const analysis = await runPythonJson(PYTHON_ANALYTICS_SCRIPT, 'kmeans', {
    customers,
    k,
    feature_keys: featureKeys,
    max_iterations: 100
  });

  const results = analysis.details || [];
  const segments = analysis.segments || {};

  console.log(
    `[CLUSTERING] Python K-Means hội tụ sau ${analysis.iterations || 0} vòng lặp với ${analysis.actual_k || Math.min(k, customers.length)} cụm`
  );

  // Cập nhật DB
  const updateBatchSize = 500;
  for (let index = 0; index < results.length; index += updateBatchSize) {
    const batch = results.slice(index, index + updateBatchSize);
    const segmentCases = batch.map(() => 'WHEN ? THEN ?').join(' ');
    const scoreCases = batch.map(() => 'WHEN ? THEN ?').join(' ');
    const ids = batch.map((customer) => customer.customer_id);
    const params = [
      ...batch.flatMap((customer) => [customer.customer_id, customer.segment]),
      ...batch.flatMap((customer) => [customer.customer_id, `C${customer.cluster_id}`]),
      ...ids
    ];

    await query(
      `
        UPDATE users
        SET customer_segment = CASE id ${segmentCases} ELSE customer_segment END,
            rfm_score = CASE id ${scoreCases} ELSE rfm_score END,
            rfm_updated_at = NOW()
        WHERE id IN (${ids.map(() => '?').join(', ')})
      `,
      params
    );
  }

  console.log(`[CLUSTERING] ✅ Đã phân cụm ${results.length} khách hàng`);
  Object.entries(segments).forEach(([seg, count]) => {
    console.log(`[CLUSTERING]   ${seg}: ${count}`);
  });

  return {
    total: results.length,
    segments,
    details: results,
    centroids: analysis.centroids || [],
    iterations: analysis.iterations || 0,
    method: analysis.method || 'python_kmeans'
  };
};

/**
 * Lấy danh sách khách At Risk (cụm nguy cơ rời bỏ)
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
 * Lấy danh sách khách Champions (cụm VIP)
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
  extractCustomerFeatures,
  runFullAnalysis,
  getAtRiskCustomers,
  getChampionCustomers,
  getSegmentStats
};
