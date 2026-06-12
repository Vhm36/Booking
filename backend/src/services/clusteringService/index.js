const db = require('../../config/db');
const AUTOMATION_HISTORY_START_DATE = '2024-01-01';

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
// K-Means Algorithm (thuần JS)
// ============================

/**
 * Chuẩn hóa dữ liệu (Min-Max Normalization) về khoảng [0, 1]
 */
const normalizeFeatures = (data, featureKeys) => {
  const mins = {};
  const maxs = {};

  featureKeys.forEach((key) => {
    mins[key] = Infinity;
    maxs[key] = -Infinity;
  });

  data.forEach((row) => {
    featureKeys.forEach((key) => {
      if (row[key] < mins[key]) mins[key] = row[key];
      if (row[key] > maxs[key]) maxs[key] = row[key];
    });
  });

  const normalized = data.map((row) => {
    const norm = { ...row };
    featureKeys.forEach((key) => {
      const range = maxs[key] - mins[key];
      norm[`${key}_norm`] = range === 0 ? 0 : (row[key] - mins[key]) / range;
    });
    return norm;
  });

  return { normalized, mins, maxs };
};

/**
 * Tính khoảng cách Euclidean giữa 2 điểm
 */
const euclideanDistance = (pointA, pointB, featureKeys) => {
  let sum = 0;
  featureKeys.forEach((key) => {
    const diff = (pointA[`${key}_norm`] || 0) - (pointB[key] || 0);
    sum += diff * diff;
  });
  return Math.sqrt(sum);
};

/**
 * Khởi tạo centroids bằng K-Means++ (chọn centroids phân tán tốt hơn random)
 */
const initCentroidsKMeansPlusPlus = (data, k, featureKeys) => {
  const normKeys = featureKeys.map((key) => `${key}_norm`);
  const centroids = [];

  // Chọn centroid đầu tiên ngẫu nhiên
  const firstIdx = Math.floor(Math.random() * data.length);
  const firstCentroid = {};
  normKeys.forEach((key) => {
    firstCentroid[key.replace('_norm', '')] = data[firstIdx][key] || 0;
  });
  centroids.push(firstCentroid);

  // Chọn các centroid tiếp theo dựa trên khoảng cách xa nhất
  for (let c = 1; c < k; c++) {
    const distances = data.map((point) => {
      const minDist = Math.min(
        ...centroids.map((centroid) => euclideanDistance(point, centroid, featureKeys))
      );
      return minDist * minDist;
    });

    const totalDist = distances.reduce((sum, d) => sum + d, 0);
    let random = Math.random() * totalDist;
    let selectedIdx = 0;

    for (let i = 0; i < distances.length; i++) {
      random -= distances[i];
      if (random <= 0) {
        selectedIdx = i;
        break;
      }
    }

    const newCentroid = {};
    normKeys.forEach((key) => {
      newCentroid[key.replace('_norm', '')] = data[selectedIdx][key] || 0;
    });
    centroids.push(newCentroid);
  }

  return centroids;
};

/**
 * Thuật toán K-Means chính
 * @param {Array} data - Dữ liệu đã normalize
 * @param {number} k - Số cụm
 * @param {Array} featureKeys - Tên các features gốc
 * @param {number} maxIterations - Số vòng lặp tối đa
 * @returns {Object} - Kết quả phân cụm
 */
const kMeans = (data, k, featureKeys, maxIterations = 100) => {
  if (data.length <= k) {
    // Nếu ít data hơn số cụm, gán mỗi điểm 1 cụm
    return {
      assignments: data.map((_, idx) => idx),
      centroids: data.map((point) => {
        const centroid = {};
        featureKeys.forEach((key) => {
          centroid[key] = point[`${key}_norm`] || 0;
        });
        return centroid;
      }),
      iterations: 0
    };
  }

  let centroids = initCentroidsKMeansPlusPlus(data, k, featureKeys);
  let assignments = new Array(data.length).fill(0);
  let iterations = 0;

  for (let iter = 0; iter < maxIterations; iter++) {
    iterations = iter + 1;
    let changed = false;

    // Bước 1: Gán mỗi điểm vào cụm gần nhất
    const newAssignments = data.map((point) => {
      let minDist = Infinity;
      let bestCluster = 0;

      centroids.forEach((centroid, clusterIdx) => {
        const dist = euclideanDistance(point, centroid, featureKeys);
        if (dist < minDist) {
          minDist = dist;
          bestCluster = clusterIdx;
        }
      });

      return bestCluster;
    });

    // Kiểm tra hội tụ
    for (let i = 0; i < data.length; i++) {
      if (newAssignments[i] !== assignments[i]) {
        changed = true;
        break;
      }
    }

    assignments = newAssignments;

    if (!changed) break;

    // Bước 2: Cập nhật centroids
    const newCentroids = centroids.map(() => {
      const centroid = {};
      featureKeys.forEach((key) => {
        centroid[key] = 0;
      });
      centroid._count = 0;
      return centroid;
    });

    data.forEach((point, idx) => {
      const cluster = assignments[idx];
      featureKeys.forEach((key) => {
        newCentroids[cluster][key] += point[`${key}_norm`] || 0;
      });
      newCentroids[cluster]._count++;
    });

    centroids = newCentroids.map((centroid) => {
      const result = {};
      featureKeys.forEach((key) => {
        result[key] = centroid._count > 0 ? centroid[key] / centroid._count : 0;
      });
      return result;
    });
  }

  return { assignments, centroids, iterations };
};

// ============================
// Gán nhãn tự động cho cụm
// ============================

/**
 * Segment Labels — Gán tên segment cho mỗi cụm dựa trên centroid
 * Sắp xếp centroids theo tổng điểm "chất lượng" khách hàng
 */
const SEGMENT_LABELS = [
  {
    key: 'Champions',
    label: 'Khách VIP',
    description: 'Chi tiêu cao, đặt nhiều, ít hủy'
  },
  {
    key: 'Loyal Customers',
    label: 'Khách trung thành',
    description: 'Đặt đều đặn, chi tiêu ổn định'
  },
  {
    key: 'Potential Loyalists',
    label: 'Khách tiềm năng',
    description: 'Có xu hướng tốt, cần khuyến khích'
  },
  {
    key: 'Need Attention',
    label: 'Cần chú ý',
    description: 'Giảm hoạt động, cần chăm sóc'
  },
  {
    key: 'At Risk',
    label: 'Nguy cơ rời bỏ',
    description: 'Không hoạt động lâu, hủy nhiều'
  }
];

/**
 * Tính "điểm chất lượng" cho centroid — dùng để sắp xếp cụm
 * Recency thấp = tốt, Frequency cao = tốt, Monetary cao = tốt, Cancel rate thấp = tốt
 */
const scoreCentroid = (centroid) => {
  return (
    (1 - (centroid.recency || 0)) * 0.25 +   // Recency thấp = tốt (đã normalize 0-1)
    (centroid.frequency || 0) * 0.30 +         // Frequency cao = tốt
    (centroid.monetary || 0) * 0.30 +           // Monetary cao = tốt
    (1 - (centroid.cancel_rate || 0)) * 0.15    // Cancel rate thấp = tốt
  );
};

/**
 * Gán nhãn cho từng cụm dựa trên thứ tự chất lượng centroid
 */
const assignClusterLabels = (centroids) => {
  const scored = centroids.map((centroid, idx) => ({
    originalIdx: idx,
    score: scoreCentroid(centroid),
    centroid
  }));

  // Sắp xếp giảm dần theo điểm chất lượng
  scored.sort((a, b) => b.score - a.score);

  const labelMap = {};
  const k = scored.length;

  scored.forEach((item, rank) => {
    // Map rank vào segment label (chia đều cho k cụm)
    const labelIdx = Math.min(rank, SEGMENT_LABELS.length - 1);
    labelMap[item.originalIdx] = SEGMENT_LABELS[labelIdx];
  });

  return labelMap;
};

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
  console.log('[CLUSTERING] Bắt đầu phân cụm khách hàng K-Means...');

  const customers = await extractCustomerFeatures();
  if (customers.length === 0) {
    console.log('[CLUSTERING] Không có khách hàng để phân tích');
    return { total: 0, segments: {} };
  }

  const featureKeys = ['recency', 'frequency', 'monetary', 'cancel_rate'];

  // Normalize features
  const { normalized } = normalizeFeatures(customers, featureKeys);

  // Chạy K-Means (giảm k nếu ít data)
  const actualK = Math.min(k, customers.length);
  const { assignments, centroids, iterations } = kMeans(normalized, actualK, featureKeys);

  console.log(`[CLUSTERING] K-Means hội tụ sau ${iterations} vòng lặp với ${actualK} cụm`);

  // Gán nhãn cho từng cụm
  const labelMap = assignClusterLabels(centroids);

  // Gắn kết quả
  const results = normalized.map((customer, idx) => {
    const clusterId = assignments[idx];
    const label = labelMap[clusterId] || SEGMENT_LABELS[SEGMENT_LABELS.length - 1];
    return {
      customer_id: customer.customer_id,
      name: customer.name,
      email: customer.email,
      recency: customer.recency,
      frequency: customer.frequency,
      monetary: customer.monetary,
      cancel_rate: customer.cancel_rate,
      cluster_id: clusterId,
      segment: label.key
    };
  });

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

  // Thống kê
  const segments = {};
  results.forEach((c) => {
    segments[c.segment] = (segments[c.segment] || 0) + 1;
  });

  console.log(`[CLUSTERING] ✅ Đã phân cụm ${results.length} khách hàng`);
  Object.entries(segments).forEach(([seg, count]) => {
    console.log(`[CLUSTERING]   ${seg}: ${count}`);
  });

  return { total: results.length, segments, details: results, centroids, iterations };
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
  normalizeFeatures,
  kMeans,
  assignClusterLabels,
  runFullAnalysis,
  getAtRiskCustomers,
  getChampionCustomers,
  getSegmentStats
};
