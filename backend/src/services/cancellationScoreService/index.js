const db = require('../../config/db');

/**
 * Cancellation Score Service — Chống "Boom" lịch
 * Scoring dựa trên: lịch sử hủy, thời gian đặt, hạng khách, ngày trong tuần, no-show
 */

const query = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (err, results) => {
      if (err) return reject(err);
      resolve(results);
    });
  });

/**
 * Lấy thông tin lịch sử khách hàng
 */
const getCustomerHistory = async (customerId) => {
  const [customerRows, appointmentRows] = await Promise.all([
    query(
      `SELECT
        cancellation_count,
        noshow_count,
        customer_segment,
        rfm_score
      FROM users WHERE id = ?`,
      [customerId]
    ),
    query(
      `SELECT
        COUNT(*) AS total_bookings,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled_count,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed_count
      FROM appointments WHERE user_id = ?`,
      [customerId]
    )
  ]);

  const customer = customerRows[0] || {};
  const stats = appointmentRows[0] || {};

  return {
    cancellation_count: Number(customer.cancellation_count || stats.cancelled_count || 0),
    noshow_count: Number(customer.noshow_count || 0),
    total_bookings: Number(stats.total_bookings || 0),
    completed_count: Number(stats.completed_count || 0),
    segment: customer.customer_segment || 'New',
    rfm_score: customer.rfm_score || '111'
  };
};

/**
 * Tính Cancellation Score (0-100)
 *
 * Weights:
 * - Lịch sử hủy: 40%
 * - Thời gian đặt (sát giờ vs xa giờ): 20%
 * - Hạng khách hàng (segment): 20%
 * - Ngày trong tuần: 10%
 * - No-show history: 10%
 */
const calculateScore = async (customerId, appointmentDate, appointmentTime) => {
  const history = await getCustomerHistory(customerId);

  // 1. Cancellation Rate Score (40%)
  let cancellationScore = 0;
  if (history.total_bookings > 0) {
    const rate = history.cancellation_count / history.total_bookings;
    cancellationScore = Math.min(rate * 100, 100);
  }

  // 2. Lead Time Score (20%) — Đặt sát giờ = rủi ro cao
  let leadTimeScore = 0;
  if (appointmentDate && appointmentTime) {
    const appointmentDateTime = new Date(`${appointmentDate}T${appointmentTime}`);
    const now = new Date();
    const hoursAhead = (appointmentDateTime - now) / (1000 * 60 * 60);

    if (hoursAhead < 2) leadTimeScore = 90;
    else if (hoursAhead < 6) leadTimeScore = 60;
    else if (hoursAhead < 12) leadTimeScore = 40;
    else if (hoursAhead < 24) leadTimeScore = 20;
    else leadTimeScore = 10;
  }

  // 3. Segment Score (20%) — Khách VIP thấp rủi ro, khách mới cao rủi ro
  const segmentScores = {
    'Champions': 5,
    'Loyal Customers': 10,
    'Potential Loyalists': 20,
    'Need Attention': 40,
    'New Customers': 50,
    'At Risk': 65,
    'Lost Customers': 80,
    'New': 45
  };
  const segmentScore = segmentScores[history.segment] || 45;

  // 4. Day of Week Score (10%) — Cuối tuần ổn định hơn
  let dayScore = 30;
  if (appointmentDate) {
    const dayOfWeek = new Date(appointmentDate).getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) dayScore = 15; // Weekend
    else if (dayOfWeek === 1) dayScore = 45; // Monday high cancel
    else dayScore = 30;
  }

  // 5. No-show Score (10%)
  let noshowScore = 0;
  if (history.noshow_count >= 3) noshowScore = 90;
  else if (history.noshow_count >= 2) noshowScore = 60;
  else if (history.noshow_count >= 1) noshowScore = 30;

  // Weighted total
  const totalScore = Math.round(
    cancellationScore * 0.4 +
    leadTimeScore * 0.2 +
    segmentScore * 0.2 +
    dayScore * 0.1 +
    noshowScore * 0.1
  );

  const finalScore = Math.min(Math.max(totalScore, 0), 100);

  return {
    score: finalScore,
    requireDeposit: finalScore > 70,
    depositPercent: finalScore > 85 ? 30 : 20,
    breakdown: {
      cancellation_rate: Math.round(cancellationScore),
      lead_time: Math.round(leadTimeScore),
      segment: Math.round(segmentScore),
      day_of_week: Math.round(dayScore),
      noshow: Math.round(noshowScore)
    },
    history: {
      total_bookings: history.total_bookings,
      cancellation_count: history.cancellation_count,
      noshow_count: history.noshow_count,
      segment: history.segment
    }
  };
};

/**
 * Cập nhật cancellation count cho user khi lịch hẹn bị hủy
 */
const incrementCancellationCount = async (customerId) => {
  await query(
    'UPDATE users SET cancellation_count = cancellation_count + 1 WHERE id = ?',
    [customerId]
  );
};

/**
 * Cập nhật noshow count
 */
const incrementNoshowCount = async (customerId) => {
  await query(
    'UPDATE users SET noshow_count = noshow_count + 1 WHERE id = ?',
    [customerId]
  );
};

module.exports = {
  calculateScore,
  getCustomerHistory,
  incrementCancellationCount,
  incrementNoshowCount
};
