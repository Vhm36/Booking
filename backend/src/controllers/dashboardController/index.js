const db = require('../../config/db');
const customerModel = require('../../models/customerModel');
const decClusteringService = require('../../services/decClusteringService');

const queryAsync = async (sql, params = []) => {
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
const AUTOMATION_HISTORY_START_DATE = '2024-01-01';

const toDateKey = (date) =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

const addDays = (date, amount) => {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
};

const getMonthEnd = (year, month) => new Date(year, month, 0);

const parseDashboardPeriod = (query) => {
  const now = new Date();
  const requestedPeriod = String(query.period || 'month').toLowerCase();
  const period = ['day', 'month', 'year'].includes(requestedPeriod) ? requestedPeriod : 'month';
  const fallbackYear = now.getFullYear();
  const fallbackMonth = now.getMonth() + 1;
  const parsedYear = Number(query.year);
  const parsedMonth = Number(query.month);
  const year = Number.isInteger(parsedYear) && parsedYear >= 2000 ? parsedYear : fallbackYear;
  const month = Number.isInteger(parsedMonth) ? parsedMonth : fallbackMonth;
  const safeMonth = month >= 1 && month <= 12 ? month : fallbackMonth;

  if (period === 'day') {
    const dateValue = /^\d{4}-\d{2}-\d{2}$/.test(String(query.date || ''))
      ? String(query.date)
      : toDateKey(now);
    const selectedDate = new Date(`${dateValue}T00:00:00`);
    const previousDate = addDays(selectedDate, -1);

    return {
      period,
      startDate: dateValue,
      endDate: dateValue,
      previousStartDate: toDateKey(previousDate),
      previousEndDate: toDateKey(previousDate),
      label: selectedDate.toLocaleDateString('vi-VN'),
      year: selectedDate.getFullYear(),
      month: selectedDate.getMonth() + 1,
      date: dateValue
    };
  }

  if (period === 'year') {
    return {
      period,
      startDate: `${year}-01-01`,
      endDate: `${year}-12-31`,
      previousStartDate: `${year - 1}-01-01`,
      previousEndDate: `${year - 1}-12-31`,
      label: `Năm ${year}`,
      year,
      month: safeMonth,
      date: toDateKey(now)
    };
  }

  const startDate = `${year}-${pad2(safeMonth)}-01`;
  const endDate = toDateKey(getMonthEnd(year, safeMonth));
  const previousMonthDate = new Date(year, safeMonth - 2, 1);
  const previousYear = previousMonthDate.getFullYear();
  const previousMonth = previousMonthDate.getMonth() + 1;

  return {
    period,
    startDate,
    endDate,
    previousStartDate: `${previousYear}-${pad2(previousMonth)}-01`,
    previousEndDate: toDateKey(getMonthEnd(previousYear, previousMonth)),
    label: `Tháng ${safeMonth}/${year}`,
    year,
    month: safeMonth,
    date: toDateKey(now)
  };
};

const buildTrendQuery = (period) => {
  if (period === 'day') {
    return `
      SELECT
        HOUR(appointment_time) AS bucket,
        DATE_FORMAT(appointment_time, '%H:00') AS label,
        SUM(CASE WHEN status != 'cancelled' THEN 1 ELSE 0 END) AS bookings,
        COALESCE(SUM(CASE WHEN status = 'completed' THEN total_amount ELSE 0 END), 0) AS revenue
      FROM appointments
      WHERE appointment_date BETWEEN ? AND ?
      GROUP BY HOUR(appointment_time), DATE_FORMAT(appointment_time, '%H:00')
      ORDER BY bucket ASC
    `;
  }

  if (period === 'year') {
    return `
      SELECT
        MONTH(appointment_date) AS bucket,
        CONCAT('Tháng ', MONTH(appointment_date)) AS label,
        SUM(CASE WHEN status != 'cancelled' THEN 1 ELSE 0 END) AS bookings,
        COALESCE(SUM(CASE WHEN status = 'completed' THEN total_amount ELSE 0 END), 0) AS revenue
      FROM appointments
      WHERE appointment_date BETWEEN ? AND ?
      GROUP BY MONTH(appointment_date)
      ORDER BY bucket ASC
    `;
  }

  return `
    SELECT
      DAY(appointment_date) AS bucket,
      DATE_FORMAT(appointment_date, '%d/%m') AS label,
      SUM(CASE WHEN status != 'cancelled' THEN 1 ELSE 0 END) AS bookings,
      COALESCE(SUM(CASE WHEN status = 'completed' THEN total_amount ELSE 0 END), 0) AS revenue
    FROM appointments
    WHERE appointment_date BETWEEN ? AND ?
    GROUP BY DAY(appointment_date), DATE_FORMAT(appointment_date, '%d/%m')
    ORDER BY bucket ASC
  `;
};

const fillTrendBuckets = (periodInfo, rows) => {
  const byBucket = new Map((rows || []).map((row) => [Number(row.bucket), row]));

  if (periodInfo.period === 'year') {
    return Array.from({ length: 12 }, (_, index) => {
      const bucket = index + 1;
      const row = byBucket.get(bucket);
      return {
        bucket,
        label: `T${bucket}`,
        bookings: Number(row?.bookings || 0),
        revenue: Number(row?.revenue || 0)
      };
    });
  }

  if (periodInfo.period === 'day') {
    return Array.from({ length: 24 }, (_, index) => {
      const bucket = index;
      const row = byBucket.get(bucket);
      return {
        bucket,
        label: `${pad2(bucket)}:00`,
        bookings: Number(row?.bookings || 0),
        revenue: Number(row?.revenue || 0)
      };
    });
  }

  const endDate = new Date(`${periodInfo.endDate}T00:00:00`);
  const totalDays = endDate.getDate();

  return Array.from({ length: totalDays }, (_, index) => {
    const bucket = index + 1;
    const row = byBucket.get(bucket);
    return {
      bucket,
      label: `${pad2(bucket)}/${pad2(periodInfo.month)}`,
      bookings: Number(row?.bookings || 0),
      revenue: Number(row?.revenue || 0)
    };
  });
};

const calculateDeltaPercent = (currentValue, previousValue) => {
  const current = Number(currentValue || 0);
  const previous = Number(previousValue || 0);

  if (previous <= 0) return null;

  return Number((((current - previous) / previous) * 100).toFixed(1));
};

const scoreFavoriteServices = (services = []) => {
  const maxBookings = Math.max(...services.map((item) => Number(item.booking_count || 0)), 1);
  const maxCompleted = Math.max(...services.map((item) => Number(item.completed_count || 0)), 1);
  const maxRevenue = Math.max(...services.map((item) => Number(item.revenue || 0)), 1);

  return services
    .map((item) => {
      const bookingScore = (Number(item.booking_count || 0) / maxBookings) * 55;
      const completedScore = (Number(item.completed_count || 0) / maxCompleted) * 25;
      const revenueScore = (Number(item.revenue || 0) / maxRevenue) * 20;

      return {
        ...item,
        booking_count: Number(item.booking_count || 0),
        completed_count: Number(item.completed_count || 0),
        revenue: Number(item.revenue || 0),
        favorite_score: Number((bookingScore + completedScore + revenueScore).toFixed(1))
      };
    })
    .sort((a, b) => b.favorite_score - a.favorite_score);
};

const SEGMENT_LABELS = {
  Champions: 'Khách VIP',
  'Loyal Customers': 'Khách trung thành',
  'Potential Loyalists': 'Khách tiềm năng',
  'Need Attention': 'Cần chú ý',
  'At Risk': 'Nguy cơ rời bỏ'
};

const SEGMENT_ORDER = [
  'Champions',
  'Loyal Customers',
  'Potential Loyalists',
  'Need Attention',
  'At Risk'
];

const buildSegmentBreakdown = (rows = []) => {
  const bySegment = new Map(
    rows.map((row) => [row.segment || 'Unclassified', Number(row.count || 0)])
  );

  const knownSegments = SEGMENT_ORDER.map((segment) => ({
    segment,
    label: SEGMENT_LABELS[segment],
    count: bySegment.get(segment) || 0
  }));

  const unknownSegments = rows
    .filter((row) => !SEGMENT_ORDER.includes(row.segment))
    .map((row) => ({
      segment: row.segment || 'Unclassified',
      label: 'Chưa phân loại',
      count: Number(row.count || 0)
    }));

  return [...knownSegments, ...unknownSegments];
};

// Lấy tóm tắt dashboard
exports.getSummary = (req, res) => {
  const queries = [
    'SELECT COUNT(*) as total_bookings FROM appointments',
    `SELECT
      SUM(total_amount) + SUM(CASE WHEN staff_id IS NOT NULL THEN total_amount * 0.4 ELSE 0 END) as total_revenue
     FROM appointments
     WHERE status = "completed"`,
    'SELECT COUNT(DISTINCT user_id) as total_customers FROM appointments',
    'SELECT s.name, COUNT(*) as count FROM appointments a JOIN services s ON a.service_id = s.id GROUP BY s.id ORDER BY count DESC LIMIT 1'
  ];
  
  let results = {};
  let completed = 0;
  
  // Query 1: Tổng booking
  db.query(queries[0], (err, data) => {
    if (!err) results.total_bookings = data[0].total_bookings;
    completed++;
    if (completed === 4) sendResponse();
  });
  
  // Query 2: Tổng doanh thu
  db.query(queries[1], (err, data) => {
    if (!err) results.total_revenue = data[0].total_revenue || 0;
    completed++;
    if (completed === 4) sendResponse();
  });
  
  // Query 3: Tổng khách hàng
  db.query(queries[2], (err, data) => {
    if (!err) results.total_customers = data[0].total_customers;
    completed++;
    if (completed === 4) sendResponse();
  });
  
  // Query 4: Dịch vụ phổ biến
  db.query(queries[3], (err, data) => {
    if (!err && data.length > 0) {
      results.top_service = data[0].name;
      results.top_service_count = data[0].count;
    }
    completed++;
    if (completed === 4) sendResponse();
  });
  
  const sendResponse = () => {
    res.status(200).json({ success: true, data: results });
  };
};

// Tổng hợp dashboard theo ngày/tháng/năm
exports.getOverview = async (req, res) => {
  const periodInfo = parseDashboardPeriod(req.query);
  const automationEndDate = toDateKey(new Date());

  const summaryQuery = `
    SELECT
      COUNT(*) AS total_bookings,
      SUM(CASE WHEN status != 'cancelled' THEN 1 ELSE 0 END) AS active_bookings,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed_bookings,
      SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled_bookings,
      COUNT(DISTINCT user_id) AS total_customers,
      COALESCE(SUM(CASE WHEN status = 'completed' THEN total_amount ELSE 0 END), 0) AS total_revenue,
      COALESCE(SUM(CASE WHEN status = 'completed' AND staff_id IS NOT NULL THEN total_amount * 0.4 ELSE 0 END), 0) AS staff_commission,
      COALESCE(AVG(CASE WHEN status != 'cancelled' THEN total_amount ELSE NULL END), 0) AS average_booking_value
    FROM appointments
    WHERE appointment_date BETWEEN ? AND ?
  `;

  const statusQuery = `
    SELECT status, COUNT(*) AS count
    FROM appointments
    WHERE appointment_date BETWEEN ? AND ?
    GROUP BY status
  `;

  const serviceQuery = `
    SELECT
      s.id,
      s.name,
      COUNT(service_usage.appointment_id) AS booking_count,
      SUM(CASE WHEN service_usage.status = 'completed' THEN 1 ELSE 0 END) AS completed_count,
      COALESCE(
        SUM(CASE WHEN service_usage.status = 'completed' THEN service_usage.service_amount ELSE 0 END),
        0
      ) AS revenue
    FROM (
      SELECT
        aps.service_id,
        a.id AS appointment_id,
        a.status,
        COALESCE(aps.price_snapshot, svc.price, 0) AS service_amount
      FROM appointments a
      JOIN appointment_services aps ON aps.appointment_id = a.id
      JOIN services svc ON svc.id = aps.service_id
      WHERE a.appointment_date BETWEEN ? AND ?
        AND a.status != 'cancelled'

      UNION ALL

      SELECT
        a.service_id,
        a.id AS appointment_id,
        a.status,
        a.total_amount AS service_amount
      FROM appointments a
      WHERE a.appointment_date BETWEEN ? AND ?
        AND a.status != 'cancelled'
        AND a.service_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1
          FROM appointment_services aps
          WHERE aps.appointment_id = a.id
        )
    ) service_usage
    JOIN services s ON s.id = service_usage.service_id
    GROUP BY s.id, s.name
    ORDER BY booking_count DESC, revenue DESC
    LIMIT 10
  `;

  const recentBookingsQuery = `
    SELECT
      a.id,
      a.appointment_date,
      TIME_FORMAT(a.appointment_time, '%H:%i') AS appointment_time,
      a.status,
      a.total_amount,
      u.name AS customer_name,
      s.name AS service_name,
      st.name AS staff_name
    FROM appointments a
    JOIN users u ON u.id = a.user_id
    JOIN services s ON s.id = a.service_id
    LEFT JOIN users st ON st.id = a.staff_id
    WHERE a.appointment_date BETWEEN ? AND ?
    ORDER BY a.appointment_date DESC, a.appointment_time DESC, a.id DESC
    LIMIT 8
  `;

  const segmentStatsQuery = `
    SELECT
      COALESCE(customer_segment, 'Unclassified') AS segment,
      COUNT(*) AS count
    FROM users
    WHERE role = 'customer' AND is_active = 1
    GROUP BY COALESCE(customer_segment, 'Unclassified')
  `;

  const voucherAutomationQuery = `
    SELECT
      COUNT(*) AS assigned_total,
      SUM(CASE WHEN va.source = 'system' THEN 1 ELSE 0 END) AS system_assigned,
      SUM(CASE WHEN va.source = 'system' AND v.code LIKE 'COMEBACK%' THEN 1 ELSE 0 END) AS comeback_assigned,
      SUM(CASE WHEN va.source = 'system' AND v.code LIKE 'VIP%' THEN 1 ELSE 0 END) AS vip_assigned,
      SUM(CASE WHEN va.source = 'system' AND va.usage_count > 0 THEN 1 ELSE 0 END) AS system_used,
      COALESCE(SUM(CASE WHEN va.source = 'system' THEN va.total_discount_applied ELSE 0 END), 0) AS system_discount_total
    FROM voucher_assignments va
    JOIN vouchers v ON v.id = va.voucher_id
    WHERE DATE(va.assigned_date) BETWEEN ? AND ?
  `;

  const activeSystemVouchersQuery = `
    SELECT COUNT(DISTINCT v.id) AS active_system_vouchers
    FROM vouchers v
    JOIN voucher_assignments va ON va.voucher_id = v.id
    WHERE va.source = 'system'
      AND v.status = 'active'
      AND v.expiry_date > NOW()
  `;

  const lastAnalysisQuery = `
    SELECT MAX(rfm_updated_at) AS last_analysis_at
    FROM users
    WHERE role = 'customer' AND is_active = 1
  `;

  try {
    const [
      summaryRows,
      previousSummaryRows,
      trendRows,
      statusRows,
      serviceRows,
      recentBookings,
      segmentRows,
      voucherAutomationRows,
      activeSystemVoucherRows,
      lastAnalysisRows
    ] =
      await Promise.all([
        queryAsync(summaryQuery, [periodInfo.startDate, periodInfo.endDate]),
        queryAsync(summaryQuery, [periodInfo.previousStartDate, periodInfo.previousEndDate]),
        queryAsync(buildTrendQuery(periodInfo.period), [periodInfo.startDate, periodInfo.endDate]),
        queryAsync(statusQuery, [periodInfo.startDate, periodInfo.endDate]),
        queryAsync(serviceQuery, [periodInfo.startDate, periodInfo.endDate, periodInfo.startDate, periodInfo.endDate]),
        queryAsync(recentBookingsQuery, [periodInfo.startDate, periodInfo.endDate]),
        queryAsync(segmentStatsQuery),
        queryAsync(voucherAutomationQuery, [AUTOMATION_HISTORY_START_DATE, automationEndDate]),
        queryAsync(activeSystemVouchersQuery),
        queryAsync(lastAnalysisQuery)
      ]);

    const summary = summaryRows[0] || {};
    const previousSummary = previousSummaryRows[0] || {};
    const totalStatus = (statusRows || []).reduce((sum, row) => sum + Number(row.count || 0), 0);
    const statusBreakdown = (statusRows || []).map((row) => ({
      status: row.status,
      count: Number(row.count || 0),
      percent: totalStatus > 0 ? Number(((Number(row.count || 0) / totalStatus) * 100).toFixed(1)) : 0
    }));
    const favoriteServices = scoreFavoriteServices(serviceRows || []);
    const segmentBreakdown = buildSegmentBreakdown(segmentRows || []);
    const voucherAutomation = voucherAutomationRows[0] || {};
    const activeSystemVouchers = activeSystemVoucherRows[0] || {};
    const lastAnalysis = lastAnalysisRows[0] || {};

    return res.status(200).json({
      success: true,
      data: {
        period: periodInfo,
        summary: {
          total_bookings: Number(summary.total_bookings || 0),
          active_bookings: Number(summary.active_bookings || 0),
          completed_bookings: Number(summary.completed_bookings || 0),
          cancelled_bookings: Number(summary.cancelled_bookings || 0),
          total_customers: Number(summary.total_customers || 0),
          total_revenue: Number(summary.total_revenue || 0),
          staff_commission: Number(summary.staff_commission || 0),
          average_booking_value: Number(summary.average_booking_value || 0),
          booking_delta_percent: calculateDeltaPercent(
            summary.total_bookings,
            previousSummary.total_bookings
          ),
          revenue_delta_percent: calculateDeltaPercent(
            summary.total_revenue,
            previousSummary.total_revenue
          )
        },
        trend: fillTrendBuckets(periodInfo, trendRows),
        status_breakdown: statusBreakdown,
        favorite_services: favoriteServices,
        favorite_formula:
          'Điểm yêu thích = 55% lượt đặt + 25% lượt hoàn thành + 20% doanh thu chuẩn hóa trong kỳ.',
        recent_bookings: (recentBookings || []).map((row) => ({
          ...row,
          total_amount: Number(row.total_amount || 0)
        })),
        automation: {
          generated_at: new Date().toISOString(),
          start_date: AUTOMATION_HISTORY_START_DATE,
          end_date: automationEndDate,
          period_label: `01/01/2024 - ${new Date(`${automationEndDate}T00:00:00`).toLocaleDateString('vi-VN')}`,
          last_analysis_at: lastAnalysis.last_analysis_at || null,
          processed_customers: segmentBreakdown.reduce((sum, row) => sum + Number(row.count || 0), 0),
          segment_breakdown: segmentBreakdown,
          voucher_stats: {
            assigned_total: Number(voucherAutomation.assigned_total || 0),
            system_assigned: Number(voucherAutomation.system_assigned || 0),
            comeback_assigned: Number(voucherAutomation.comeback_assigned || 0),
            vip_assigned: Number(voucherAutomation.vip_assigned || 0),
            system_used: Number(voucherAutomation.system_used || 0),
            system_discount_total: Number(voucherAutomation.system_discount_total || 0),
            active_system_vouchers: Number(activeSystemVouchers.active_system_vouchers || 0)
          }
        }
      }
    });
  } catch (err) {
    return res.status(500).json({ message: 'Lỗi server', error: err });
  }
};

// Lấy booking theo tháng
exports.getBookingsByMonth = (req, res) => {
  const query = `
    SELECT *
    FROM (
      SELECT MONTH(appointment_date) as month, YEAR(appointment_date) as year, COUNT(*) as total
      FROM appointments
      WHERE status != 'cancelled'
      GROUP BY YEAR(appointment_date), MONTH(appointment_date)
      ORDER BY year DESC, month DESC
      LIMIT 12
    ) monthly_bookings
    ORDER BY year ASC, month ASC
  `;
  
  db.query(query, (err, results) => {
    if (err) {
      return res.status(500).json({ message: 'Lỗi server', error: err });
    }
    res.status(200).json({ success: true, data: results });
  });
};

// Lấy dịch vụ phổ biến
exports.getTopServices = (req, res) => {
  const query = `
    SELECT s.id, s.name, COUNT(*) as booking_count, SUM(a.total_amount) as revenue
    FROM appointments a
    JOIN services s ON a.service_id = s.id
    WHERE a.status != 'cancelled'
    GROUP BY s.id
    ORDER BY booking_count DESC
    LIMIT 10
  `;
  
  db.query(query, (err, results) => {
    if (err) {
      return res.status(500).json({ message: 'Lỗi server', error: err });
    }
    res.status(200).json({ success: true, data: results });
  });
};

// Lấy tần suất khách hàng
exports.getCustomerFrequency = (req, res) => {
  const query = `
    SELECT u.id, u.name, u.email, COUNT(*) as booking_count, SUM(a.total_amount) as total_spent
    FROM appointments a
    JOIN users u ON a.user_id = u.id
    WHERE a.status != 'cancelled'
    GROUP BY u.id
    ORDER BY booking_count DESC
    LIMIT 20
  `;
  
  db.query(query, (err, results) => {
    if (err) {
      return res.status(500).json({ message: 'Lỗi server', error: err });
    }
    res.status(200).json({ success: true, data: results });
  });
};

// Lấy trạng thái appointment
exports.getAppointmentStatus = (req, res) => {
  const query = `
    SELECT status, COUNT(*) as count
    FROM appointments
    GROUP BY status
  `;
  
  db.query(query, (err, results) => {
    if (err) {
      return res.status(500).json({ message: 'Lỗi server', error: err });
    }
    res.status(200).json({ success: true, data: results });
  });
};

// Lấy doanh thu theo tháng
exports.getRevenueByMonth = (req, res) => {
  const query = `
    SELECT *
    FROM (
      SELECT
        MONTH(appointment_date) as month,
        YEAR(appointment_date) as year,
        SUM(total_amount) as base_revenue,
        SUM(CASE WHEN staff_id IS NOT NULL THEN total_amount * 0.4 ELSE 0 END) as staff_commission,
        SUM(total_amount) + SUM(CASE WHEN staff_id IS NOT NULL THEN total_amount * 0.4 ELSE 0 END) as revenue
      FROM appointments
      WHERE status = 'completed'
      GROUP BY YEAR(appointment_date), MONTH(appointment_date)
      ORDER BY year DESC, month DESC
      LIMIT 12
    ) monthly_revenue
    ORDER BY year ASC, month ASC
  `;
  
  db.query(query, (err, results) => {
    if (err) {
      return res.status(500).json({ message: 'Lỗi server', error: err });
    }
    res.status(200).json({ success: true, data: results });
  });
};

// Bot theo dõi và phân tích hành vi khách hàng (MVP)
exports.getCustomerBehaviorBot = (req, res) => {
  customerModel.getAllCustomers((err, customers) => {
    if (err) {
      return res.status(500).json({ message: 'Lỗi server', error: err });
    }

    const list = Array.isArray(customers) ? customers : [];
    const frequentBookers = list.filter((item) =>
      ['frequent_booker', 'mixed_high_activity'].includes(item.behavior_role_code)
    );
    const frequentCancellers = list.filter((item) =>
      ['frequent_canceller', 'mixed_high_activity'].includes(item.behavior_role_code)
    );
    const vipCustomers = list.filter((item) => ['gold', 'black'].includes(item.vip_tier_code));
    const topSpenders = [...list]
      .sort((a, b) => Number(b.total_spent || 0) - Number(a.total_spent || 0))
      .slice(0, 5)
      .map((item) => ({
        id: item.id,
        name: item.name,
        total_spent: Number(item.total_spent || 0),
        behavior_role_label: item.behavior_role_label || 'Hành vi ổn định'
      }));

    const recommendations = [];
    if (frequentCancellers.length > 0) {
      recommendations.push(
        `Có ${frequentCancellers.length} khách thuộc nhóm hủy nhiều. Nên gửi nhắc lịch sớm và yêu cầu xác nhận trước 24h.`
      );
    }
    if (frequentBookers.length > 0) {
      recommendations.push(
        `Có ${frequentBookers.length} khách đặt nhiều. Nên triển khai gói membership và ưu đãi đặt sớm để giữ chân.`
      );
    }
    if (vipCustomers.length > 0) {
      recommendations.push(
        `Có ${vipCustomers.length} khách VIP vàng/đen. Nên ưu tiên chăm sóc riêng và tặng voucher cá nhân hóa.`
      );
    }

    return res.status(200).json({
      success: true,
      data: {
        generated_at: new Date().toISOString(),
        summary: {
          total_customers: list.length,
          frequent_bookers: frequentBookers.length,
          frequent_cancellers: frequentCancellers.length,
          vip_gold_or_black: vipCustomers.length
        },
        top_spenders: topSpenders,
        recommendations
      }
    });
  });
};

// Doanh thu + hoa hồng 10% theo nhân viên/tháng
// Phân cụm DEC hành vi khách hàng
exports.getDecClustering = async (req, res) => {
  const requestedLimit = Number(req.query.limit);
  const limitPerCluster =
    Number.isInteger(requestedLimit) && requestedLimit > 0 && requestedLimit <= 100
      ? requestedLimit
      : 20;

  try {
    const report = await decClusteringService.getDecClusteringReport({
      limitPerCluster,
      period_type: req.query.period_type || req.query.periodType,
      year: req.query.year,
      month: req.query.month,
      date: req.query.date || req.query.day,
      week: req.query.week
    });
    return res.status(200).json({ success: true, data: report });
  } catch (err) {
    console.error('[DEC_CLUSTERING_REPORT_ERROR]', err);
    return res.status(500).json({
      success: false,
      message: 'Không thể tải dữ liệu phân cụm DEC',
      error: err
    });
  }
};

exports.getStaffCommissionByMonth = (req, res) => {
  const month = Number(req.query.month || new Date().getMonth() + 1);
  const year = Number(req.query.year || new Date().getFullYear());

  if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(year) || year < 2000) {
    return res.status(400).json({ message: 'month/year không hợp lệ' });
  }

  const query = `
    SELECT
      u.id AS staff_id,
      u.name AS staff_name,
      sr.role_name AS staff_role_name,
      COUNT(a.id) AS total_completed_appointments,
      COALESCE(SUM(a.total_amount), 0) AS monthly_revenue,
      COALESCE(SUM(a.total_amount * 0.4), 0) AS monthly_commission,
      COALESCE(SUM(a.total_amount * 1.4), 0) AS monthly_revenue_with_commission
    FROM users u
    LEFT JOIN staff_role sr ON sr.id = u.staff_role_id
    LEFT JOIN appointments a
      ON a.staff_id = u.id
      AND a.status = 'completed'
      AND YEAR(a.appointment_date) = ?
      AND MONTH(a.appointment_date) = ?
    WHERE u.role = 'staff'
    GROUP BY u.id, u.name, sr.role_name
    ORDER BY monthly_commission DESC, monthly_revenue DESC, u.name ASC
  `;

  db.query(query, [year, month], (err, results) => {
    if (err) {
      return res.status(500).json({ message: 'Lỗi server', error: err });
    }

    const totals = (results || []).reduce(
      (acc, row) => ({
        total_revenue: acc.total_revenue + Number(row.monthly_revenue || 0),
        total_commission: acc.total_commission + Number(row.monthly_commission || 0),
        total_revenue_with_commission:
          acc.total_revenue_with_commission + Number(row.monthly_revenue_with_commission || 0)
      }),
      { total_revenue: 0, total_commission: 0, total_revenue_with_commission: 0 }
    );

    return res.status(200).json({
      success: true,
      data: {
        month,
        year,
        totals,
        staff: results || []
      }
    });
  });
};

// Lấy tỷ lệ hủy lịch
exports.getCancellationRate = (req, res) => {
  const query = `
    SELECT 
      COUNT(*) as total_appointments,
      SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_count,
      ROUND(SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) / COUNT(*) * 100, 2) as cancellation_rate
    FROM appointments
  `;
  
  db.query(query, (err, results) => {
    if (err) {
      return res.status(500).json({ message: 'Lỗi server', error: err });
    }
    res.status(200).json({ success: true, data: results[0] });
  });
};
