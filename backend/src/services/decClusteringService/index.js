const db = require('../../config/db');
const path = require('path');
const { runPythonJson } = require('../../utils/pythonRunner');

const MIN_RECOMMENDED_CUSTOMERS = 100;
const PYTHON_ANALYTICS_SCRIPT = path.join(__dirname, '../../../ml/customer_analytics.py');

const CLUSTER_DEFINITIONS = [
  {
    code: 'C0',
    key: 'frequent_single_service',
    label: 'Khách hàng Đơn dịch vụ',
    short_label: 'Đơn dịch vụ',
    description: 'Khách quay lại salon nhiều lần nhưng chỉ trung thành với một dịch vụ duy nhất.',
    criteria: 'Có từ 3 lịch, ít nhất 2 lịch hoàn thành và chỉ sử dụng 1 dịch vụ.',
    strategy: 'Duy trì lịch nhắc theo chu kỳ, tạo gói thành viên theo dịch vụ chính và gợi ý một dịch vụ bổ trợ phù hợp.',
    tone: 'teal'
  },
  {
    code: 'C1',
    key: 'frequent_cancel_no_show',
    label: 'Khách hàng Đơn dịch vụ',
    short_label: 'Đơn dịch vụ',
    description: 'Khách có tỷ lệ hủy, không đến hoặc điểm rủi ro lịch hẹn vượt ngưỡng an toàn.',
    criteria: 'Có từ 2 lịch hủy hoặc không đến và tỷ lệ rủi ro từ 30%, hoặc điểm Cancellation Score trung bình từ 70.',
    strategy: 'Nhắc lịch nhiều bước, xác nhận lại trước ca và bắt buộc đặt cọc khi Cancellation Score vượt ngưỡng.',
    tone: 'rose'
  },
  {
    code: 'C2',
    key: 'many_bookings_low_arrival',
    label: 'Khách đặt lịch ảo',
    short_label: 'Đặt lịch ảo',
    description: 'Khách tạo lịch liên tục nhưng tỷ lệ đến salon thực tế cực thấp, có dấu hiệu giữ chỗ ảo.',
    criteria: 'Có từ 6 lịch, tỷ lệ hoàn thành không quá 35% và ít nhất 2 lần không đến hoặc 4 lịch rủi ro.',
    strategy: 'Giới hạn số lịch mở đồng thời, yêu cầu cọc bắt buộc và chỉ giữ khung giờ sau khi xác nhận thanh toán.',
    tone: 'amber'
  },
  {
    code: 'C3',
    key: 'low_usage_premium',
    label: 'Khách hàng Cao cấp',
    short_label: 'Cao cấp',
    description: 'Khách đặt không quá thường xuyên nhưng giá trị trung bình mỗi lần sử dụng dịch vụ rất cao.',
    criteria: 'Có lịch hoàn thành, tối đa 3 lần hoàn thành và mức chi trung bình thuộc nhóm 25% cao nhất.',
    strategy: 'Chăm sóc cá nhân hóa, ưu tiên chuyên viên phù hợp và giới thiệu liệu trình cao cấp theo nhu cầu.',
    tone: 'violet'
  },
  {
    code: 'C4',
    key: 'high_usage_budget',
    label: 'Khách hàng Bình dân',
    short_label: 'Bình dân',
    description: 'Khách tương tác thường xuyên nhưng nhạy cảm về giá và chủ yếu chọn dịch vụ cơ bản.',
    criteria: 'Có từ 3 lịch hoàn thành và mức chi trung bình thuộc nhóm 40% thấp nhất.',
    strategy: 'Tạo gói tiết kiệm, ưu đãi khung giờ thấp điểm, tích điểm và đề xuất nâng cấp từng bước.',
    tone: 'blue'
  },
  {
    code: 'C5',
    key: 'one_time_then_left',
    label: 'Khách vãng lai rời bỏ',
    short_label: 'Vãng lai',
    description: 'Khách chỉ đặt đúng một lịch rồi không phát sinh tương tác quay lại trong ít nhất 21 ngày.',
    criteria: 'Tổng số lịch bằng 1 và lịch gần nhất đã qua từ 21 ngày.',
    strategy: 'Khảo sát trải nghiệm lần đầu, gửi voucher quay lại có thời hạn và đề xuất lịch thứ hai.',
    tone: 'slate'
  },
  {
    code: 'C6',
    key: 'low_monthly_usage',
    label: 'Khách tương tác thưa theo tháng',
    short_label: 'Tương tác thưa theo tháng',
    description: 'Khách duy trì giao dịch qua nhiều tháng nhưng tần suất mỗi tháng thấp và thiếu ổn định.',
    criteria: 'Có giao dịch trong từ 2 tháng và trung bình không quá 1,25 lịch mỗi tháng.',
    strategy: 'Nhắc lịch định kỳ theo tháng, đề xuất lịch trống phù hợp và xây gói duy trì dài hạn.',
    tone: 'emerald'
  }
];

const CUSTOMER_POTENTIAL_META = {
  frequent_single_service: {
    status: 'potential',
    label: 'Khách tiềm năng',
    reason: 'Trung thành với một dịch vụ chính và có khả năng quay lại theo chu kỳ.',
    staff_hint: 'Nhắc lịch định kỳ, giữ chất lượng dịch vụ quen thuộc và gợi ý bổ trợ phù hợp.'
  },
  frequent_cancel_no_show: {
    status: 'not_potential',
    label: 'Khách rủi ro',
    reason: 'Có tỷ lệ hủy hoặc không đến, hoặc điểm Cancellation Score vượt ngưỡng an toàn.',
    staff_hint: 'Nhắc lịch nhiều bước và áp dụng đặt cọc theo điểm rủi ro.'
  },
  many_bookings_low_arrival: {
    status: 'not_potential',
    label: 'Khách rủi ro cao',
    reason: 'Tạo nhiều lịch nhưng tỷ lệ đến thực tế rất thấp.',
    staff_hint: 'Giới hạn lịch mở đồng thời và yêu cầu cọc trước khi giữ chỗ.'
  },
  low_usage_premium: {
    status: 'potential',
    label: 'Khách tiềm năng',
    reason: 'Ít đặt nhưng chọn dịch vụ giá trị cao.',
    staff_hint: 'Chăm sóc cá nhân hóa và gợi ý dịch vụ cao cấp.'
  },
  high_usage_budget: {
    status: 'potential',
    label: 'Khách tiềm năng',
    reason: 'Dùng thường xuyên các dịch vụ phổ thông.',
    staff_hint: 'Gợi ý gói tiết kiệm, tích điểm hoặc nâng cấp từng bước.'
  },
  one_time_then_left: {
    status: 'not_potential',
    label: 'Khách không tiềm năng',
    reason: 'Mới đặt một lần hoặc chưa có dấu hiệu quay lại.',
    staff_hint: 'Hỏi trải nghiệm và dùng ưu đãi quay lại nếu cần.'
  },
  low_monthly_usage: {
    status: 'potential',
    label: 'Khách tiềm năng',
    reason: 'Có phát sinh qua nhiều tháng nhưng tần suất còn thấp.',
    staff_hint: 'Nhắc lịch theo tháng và gợi ý khung giờ trống gần nhất.'
  }
};

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

const toNumber = (value) => Number(value || 0);

const round = (value, digits = 1) => {
  const factor = 10 ** digits;
  return Math.round(toNumber(value) * factor) / factor;
};

const pad2 = (value) => String(value).padStart(2, '0');

const quantile = (values, q) => {
  const sorted = values
    .map(Number)
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((a, b) => a - b);

  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];

  const position = (sorted.length - 1) * q;
  const base = Math.floor(position);
  const rest = position - base;
  const next = sorted[base + 1];

  return next === undefined ? sorted[base] : sorted[base] + rest * (next - sorted[base]);
};

const daysSince = (dateValue) => {
  if (!dateValue) return 999;

  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return 999;

  const now = new Date();
  const diff = now.getTime() - date.getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
};

const normalizeDateValue = (value) => {
  const raw = String(value || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return null;
  }

  const date = new Date(`${raw}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return raw;
};

const parseWeekValue = (value, fallbackYear) => {
  const raw = String(value || '').trim();
  const weekMatch = raw.match(/^(\d{4})-W(\d{1,2})$/);
  const plainWeekMatch = raw.match(/^(\d{1,2})$/);

  const parsedYear = weekMatch ? Number(weekMatch[1]) : Number(fallbackYear);
  const parsedWeek = weekMatch ? Number(weekMatch[2]) : plainWeekMatch ? Number(plainWeekMatch[1]) : null;

  if (!Number.isInteger(parsedYear) || parsedYear < 2000 || !Number.isInteger(parsedWeek) || parsedWeek < 1 || parsedWeek > 53) {
    return null;
  }

  return {
    year: parsedYear,
    week: parsedWeek,
    value: `${parsedYear}-W${pad2(parsedWeek)}`,
    key: parsedYear * 100 + parsedWeek
  };
};

const getPeriodLabel = (period) => {
  if (period.type === 'day' && period.date) {
    return `Ngày ${new Date(`${period.date}T00:00:00`).toLocaleDateString('vi-VN')}`;
  }

  if (period.type === 'week' && period.week) {
    return `Tuần ${period.week}/${period.year}`;
  }

  if (period.type === 'year' && period.year) {
    return `Năm ${period.year}`;
  }

  if (period.type === 'month' && period.year && period.month) {
    return `Tháng ${period.month}/${period.year}`;
  }

  return 'Toàn bộ thời gian';
};

const normalizePeriod = ({ period_type, periodType, year, month, date, day, week } = {}) => {
  const requestedType = String(period_type || periodType || '').trim().toLowerCase();
  const parsedYear = Number(year);
  const parsedMonth = Number(month);
  const normalizedDate = normalizeDateValue(date || day);
  const normalizedWeek = parseWeekValue(week, parsedYear);
  const type = ['day', 'week', 'month', 'year', 'all'].includes(requestedType)
    ? requestedType
    : normalizedDate
      ? 'day'
      : normalizedWeek
        ? 'week'
        : parsedMonth
          ? 'month'
          : parsedYear
            ? 'year'
            : 'all';
  const safeYear = Number.isInteger(parsedYear) && parsedYear >= 2000 ? parsedYear : new Date().getFullYear();
  const safeMonth = Number.isInteger(parsedMonth) && parsedMonth >= 1 && parsedMonth <= 12
    ? parsedMonth
    : new Date().getMonth() + 1;
  const basePeriod = {
    type,
    year: type === 'week' && normalizedWeek ? normalizedWeek.year : safeYear,
    month: safeMonth,
    date: normalizedDate,
    week: normalizedWeek?.week || null,
    week_value: normalizedWeek?.value || null,
    week_key: normalizedWeek?.key || null
  };

  if (type === 'day' && !basePeriod.date) {
    basePeriod.date = normalizeDateValue(new Date().toISOString().slice(0, 10));
  }

  if (type === 'week' && !basePeriod.week_key) {
    const currentWeek = parseWeekValue(`${safeYear}-W01`, safeYear);
    basePeriod.week = currentWeek.week;
    basePeriod.week_value = currentWeek.value;
    basePeriod.week_key = currentWeek.key;
  }

  basePeriod.label = getPeriodLabel(basePeriod);
  return basePeriod;
};

const buildAppointmentPeriodClause = (alias, period) => {
  const clauses = [];
  const params = [];

  if (period.type === 'day' && period.date) {
    clauses.push(`DATE(${alias}.appointment_date) = ?`);
    params.push(period.date);
  } else if (period.type === 'week' && period.week_key) {
    clauses.push(`YEARWEEK(${alias}.appointment_date, 3) = ?`);
    params.push(period.week_key);
  } else if (period.type === 'year' && period.year) {
    clauses.push(`YEAR(${alias}.appointment_date) = ?`);
    params.push(period.year);
  } else if (period.type === 'month' && period.year && period.month) {
    clauses.push(`YEAR(${alias}.appointment_date) = ?`);
    params.push(period.year);
    clauses.push(`MONTH(${alias}.appointment_date) = ?`);
    params.push(period.month);
  }

  return {
    sql: clauses.length > 0 ? ` AND ${clauses.join(' AND ')}` : '',
    params
  };
};

const buildCustomerActivityClause = (customerAlias, period) => {
  if (period.type === 'all') {
    return { sql: '', params: [] };
  }

  const activityPeriod = buildAppointmentPeriodClause('activity', period);
  return {
    sql: `
      AND EXISTS (
        SELECT 1
        FROM appointments activity
        WHERE activity.user_id = ${customerAlias}.id${activityPeriod.sql}
      )
    `,
    params: activityPeriod.params
  };
};

const getCustomerRows = async (period) => {
  const customerActivity = buildCustomerActivityClause('u', period);
  const sql = `
    SELECT
      u.id AS customer_id,
      u.name,
      u.email,
      COUNT(a.id) AS total_bookings,
      SUM(CASE WHEN a.status = 'completed' THEN 1 ELSE 0 END) AS completed_bookings,
      SUM(CASE WHEN a.status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled_bookings,
      SUM(CASE WHEN a.status = 'no_show' THEN 1 ELSE 0 END) AS no_show_bookings,
      SUM(CASE WHEN a.status IN ('pending', 'confirmed') THEN 1 ELSE 0 END) AS open_bookings,
      COALESCE(SUM(CASE WHEN a.status = 'completed' THEN a.total_amount ELSE 0 END), 0) AS completed_revenue,
      COALESCE(AVG(CASE WHEN a.status = 'completed' THEN a.total_amount ELSE NULL END), 0) AS avg_completed_amount,
      COALESCE(AVG(CASE WHEN a.cancellation_score IS NOT NULL THEN a.cancellation_score ELSE NULL END), 0) AS avg_cancellation_score,
      COUNT(DISTINCT CASE WHEN a.id IS NOT NULL THEN DATE_FORMAT(a.appointment_date, '%Y-%m') ELSE NULL END) AS active_months,
      MIN(a.appointment_date) AS first_booking_date,
      MAX(a.appointment_date) AS last_booking_date
    FROM users u
    LEFT JOIN appointments a ON a.user_id = u.id AND a.appointment_date <= CURDATE()
    WHERE u.role = 'customer' AND u.is_active = 1
      ${customerActivity.sql}
    GROUP BY u.id, u.name, u.email
    ORDER BY total_bookings DESC, completed_revenue DESC, u.name ASC
  `;

  return query(sql, customerActivity.params);
};

const getServiceUsageRows = async (period) => {
  const customerActivity = buildCustomerActivityClause('u', period);
  const sql = `
    SELECT
      a.user_id AS customer_id,
      COALESCE(aps.service_id, a.service_id) AS service_id,
      COALESCE(aps.service_name_snapshot, s.name, 'Không rõ') AS service_name,
      COUNT(DISTINCT a.id) AS booking_count,
      COALESCE(AVG(COALESCE(aps.price_snapshot, s.price, a.total_amount)), 0) AS avg_price
    FROM appointments a
    JOIN users u ON u.id = a.user_id
    LEFT JOIN appointment_services aps ON aps.appointment_id = a.id
    LEFT JOIN services s ON s.id = COALESCE(aps.service_id, a.service_id)
    WHERE a.user_id IS NOT NULL
      AND a.status != 'cancelled'
      AND a.appointment_date <= CURDATE()
      ${customerActivity.sql}
    GROUP BY
      a.user_id,
      COALESCE(aps.service_id, a.service_id),
      COALESCE(aps.service_name_snapshot, s.name, 'Không rõ')
  `;

  return query(sql, customerActivity.params);
};

const getServicePrices = async () => {
  const sql = `
    SELECT price
    FROM services
    WHERE price IS NOT NULL AND price > 0
  `;

  const rows = await query(sql);
  return rows.map((row) => Number(row.price)).filter((price) => Number.isFinite(price) && price > 0);
};

const buildServiceUsageMap = (rows = []) => {
  const byCustomer = new Map();

  rows.forEach((row) => {
    const customerId = Number(row.customer_id);
    if (!byCustomer.has(customerId)) {
      byCustomer.set(customerId, []);
    }

    byCustomer.get(customerId).push({
      service_id: row.service_id,
      service_name: row.service_name || 'Không rõ',
      booking_count: toNumber(row.booking_count),
      avg_price: toNumber(row.avg_price)
    });
  });

  return byCustomer;
};

const getFavoriteService = (services = []) => {
  if (services.length === 0) {
    return { name: 'Chưa có dịch vụ', booking_count: 0 };
  }

  return [...services].sort((a, b) => b.booking_count - a.booking_count || b.avg_price - a.avg_price)[0];
};

const normalizeCustomer = (row, serviceUsageMap) => {
  const totalBookings = toNumber(row.total_bookings);
  const completedBookings = toNumber(row.completed_bookings);
  const cancelledBookings = toNumber(row.cancelled_bookings);
  const noShowBookings = toNumber(row.no_show_bookings);
  const riskBookings = cancelledBookings + noShowBookings;
  const completedRevenue = toNumber(row.completed_revenue);
  const avgCompletedAmount = toNumber(row.avg_completed_amount);
  const avgCancellationScore = toNumber(row.avg_cancellation_score);
  const activeMonths = Math.max(0, toNumber(row.active_months));
  const monthlyBookingRate = activeMonths > 0 ? totalBookings / activeMonths : totalBookings;
  const serviceUsage = serviceUsageMap.get(Number(row.customer_id)) || [];
  const favoriteService = getFavoriteService(serviceUsage);

  return {
    id: Number(row.customer_id),
    name: row.name || 'Khách hàng',
    email: row.email || '',
    total_bookings: totalBookings,
    completed_bookings: completedBookings,
    cancelled_bookings: cancelledBookings,
    no_show_bookings: noShowBookings,
    open_bookings: toNumber(row.open_bookings),
    completed_revenue: completedRevenue,
    avg_completed_amount: avgCompletedAmount,
    avg_cancellation_score: round(avgCancellationScore, 1),
    active_months: activeMonths,
    monthly_booking_rate: round(monthlyBookingRate, 2),
    distinct_services: serviceUsage.length,
    favorite_service: favoriteService.name,
    favorite_service_count: favoriteService.booking_count,
    first_booking_date: row.first_booking_date || null,
    last_booking_date: row.last_booking_date || null,
    recency_days: daysSince(row.last_booking_date),
    cancellation_rate: totalBookings > 0 ? round((riskBookings / totalBookings) * 100, 1) : 0,
    completion_rate: totalBookings > 0 ? round((completedBookings / totalBookings) * 100, 1) : 0
  };
};

const getClusterKey = (customer, thresholds) => {
  if (customer.total_bookings <= 0) return null;

  const riskCount = customer.cancelled_bookings + customer.no_show_bookings;

  if (
    customer.total_bookings >= 6 &&
    customer.completion_rate <= 35 &&
    (customer.no_show_bookings >= 2 || riskCount >= 4)
  ) {
    return 'many_bookings_low_arrival';
  }

  if (
    (riskCount >= 2 && customer.cancellation_rate >= 30) ||
    customer.avg_cancellation_score >= 70
  ) {
    return 'frequent_cancel_no_show';
  }

  if (customer.total_bookings === 1 && customer.recency_days >= 21) {
    return 'one_time_then_left';
  }

  if (
    customer.total_bookings >= 3 &&
    customer.completed_bookings >= 2 &&
    customer.distinct_services === 1
  ) {
    return 'frequent_single_service';
  }

  if (
    customer.completed_bookings > 0 &&
    customer.completed_bookings <= 3 &&
    customer.avg_completed_amount >= thresholds.premium
  ) {
    return 'low_usage_premium';
  }

  if (
    customer.completed_bookings >= 3 &&
    customer.avg_completed_amount > 0 &&
    customer.avg_completed_amount <= thresholds.budget
  ) {
    return 'high_usage_budget';
  }

  if (customer.active_months >= 2 && customer.monthly_booking_rate <= 1.25) {
    return 'low_monthly_usage';
  }

  return null;
};

const calculateAverages = (customers = []) => {
  if (customers.length === 0) {
    return {
      total_bookings: 0,
      completion_rate: 0,
      cancellation_rate: 0,
      avg_cancellation_score: 0,
      avg_completed_amount: 0,
      monthly_booking_rate: 0
    };
  }

  const sum = customers.reduce(
    (acc, customer) => ({
      total_bookings: acc.total_bookings + customer.total_bookings,
      completion_rate: acc.completion_rate + customer.completion_rate,
      cancellation_rate: acc.cancellation_rate + customer.cancellation_rate,
      avg_cancellation_score: acc.avg_cancellation_score + customer.avg_cancellation_score,
      avg_completed_amount: acc.avg_completed_amount + customer.avg_completed_amount,
      monthly_booking_rate: acc.monthly_booking_rate + customer.monthly_booking_rate
    }),
    {
      total_bookings: 0,
      completion_rate: 0,
      cancellation_rate: 0,
      avg_cancellation_score: 0,
      avg_completed_amount: 0,
      monthly_booking_rate: 0
    }
  );

  return {
    total_bookings: round(sum.total_bookings / customers.length, 1),
    completion_rate: round(sum.completion_rate / customers.length, 1),
    cancellation_rate: round(sum.cancellation_rate / customers.length, 1),
    avg_cancellation_score: round(sum.avg_cancellation_score / customers.length, 1),
    avg_completed_amount: round(sum.avg_completed_amount / customers.length, 0),
    monthly_booking_rate: round(sum.monthly_booking_rate / customers.length, 2)
  };
};

const getPeriodPhrase = (period) => {
  const phraseMap = {
    day: 'trong ngày này',
    week: 'trong tuần này',
    month: 'trong tháng này',
    year: 'trong năm này'
  };

  return phraseMap[period.type] || 'trong kỳ này';
};

const getPeriodActionPace = (period) => {
  const paceMap = {
    day: 'xử lý ngay trong ca',
    week: 'theo dõi theo tuần',
    month: 'nuôi dưỡng theo tháng',
    year: 'xây chương trình dài hạn'
  };

  return paceMap[period.type] || 'theo dõi theo kỳ';
};

const buildDynamicStrategy = (definition, customers = [], averages = {}, period = {}) => {
  const count = customers.length;
  if (count === 0) {
    return `${period.label}: chưa có khách thuộc cụm này, tạm thời không cần triển khai chiến lược riêng.`;
  }

  const phrase = getPeriodPhrase(period);
  const pace = getPeriodActionPace(period);
  const completionRate = round(averages.completion_rate || 0, 0);
  const cancellationRate = round(averages.cancellation_rate || 0, 0);
  const avgAmount = Math.round(toNumber(averages.avg_completed_amount || 0)).toLocaleString('vi-VN');
  const topCustomer = customers[0]?.name || 'nhóm khách này';

  const byPeriod = {
    frequent_single_service: {
      day: `Có ${count} khách lặp lại 1 dịch vụ ${phrase}. Ưu tiên hoàn tất trải nghiệm cho ${topCustomer}, nhắc lịch lần sau ngay sau ca và gợi ý thêm 1 dịch vụ bổ trợ ngắn.`,
      week: `Có ${count} khách trung thành với 1 dịch vụ ${phrase}. Gom lịch theo nhân viên quen, thử combo bổ trợ trong tuần và theo dõi tỷ lệ hoàn thành ${completionRate}%.`,
      month: `Có ${count} khách dùng 1 dịch vụ cố định ${phrase}. Tạo lịch nhắc chu kỳ theo tháng, gợi ý combo duy trì và đo phản hồi sau mỗi lần quay lại.`,
      year: `Có ${count} khách chỉ gắn với 1 dịch vụ ${phrase}. Xây gói thành viên theo dịch vụ chủ lực, chia nhóm chăm sóc theo mùa và mở rộng dần sang dịch vụ liên quan.`
    },
    many_bookings_low_arrival: {
      day: `${count} khách có dấu hiệu đặt lịch ảo ${phrase}. Chỉ giữ slot sau khi xác nhận hoặc thanh toán cọc, đồng thời giới hạn số lịch đang mở trên mỗi tài khoản.`,
      week: `${count} khách tạo nhiều lịch nhưng tỷ lệ đến rất thấp ${phrase}. Kiểm tra lịch trùng, khóa giữ chỗ cao điểm khi chưa cọc và rà lại tỷ lệ hoàn thành ${completionRate}%.`,
      month: `${count} khách thuộc nhóm đặt lịch ảo ${phrase}. Áp dụng cọc bắt buộc, giới hạn số lịch mở đồng thời và theo dõi tài khoản tái phạm theo tuần.`,
      year: `${count} khách có hành vi giữ chỗ gây lãng phí công suất ${phrase}. Thiết lập chế tài theo mức tái phạm và chỉ khôi phục quyền đặt linh hoạt sau các lịch hoàn thành.`
    },
    frequent_cancel_no_show: {
      day: `${count} khách có rủi ro hủy, trễ hoặc không đến ${phrase}. Nhắc trực tiếp trước ca và yêu cầu cọc ngay khi Cancellation Score vượt ngưỡng.`,
      week: `${count} khách hủy hoặc không đến nhiều ${phrase}. Gọi xác nhận, ưu tiên khung giờ linh hoạt và theo dõi tỷ lệ rủi ro ${cancellationRate}%.`,
      month: `${count} khách vượt ngưỡng an toàn ${phrase}. Áp dụng nhắc lịch nhiều bước, cọc theo điểm rủi ro và chỉ cấp ưu đãi sau lịch hoàn thành.`,
      year: `${count} khách có lịch sử rủi ro kéo dài ${phrase}. Phân tầng mức đặt cọc, hạn chế slot cao điểm và đánh giá lại sau mỗi chuỗi lịch hoàn thành.`
    },
    low_usage_premium: {
      day: `${count} khách ít dùng nhưng chọn dịch vụ cao cấp ${phrase}. Chuẩn bị tư vấn kỹ cho ${topCustomer}, chăm sóc sau ca và mời đặt lịch cao cấp tiếp theo.`,
      week: `${count} khách premium ít dùng ${phrase}. Gửi gợi ý cá nhân hóa trong tuần, ưu tiên nhân viên tay nghề cao và giữ mức chi trung bình khoảng ${avgAmount} đ.`,
      month: `${count} khách giá trị cao nhưng tần suất thấp ${phrase}. Chạy ưu đãi quay lại theo dịp, nhắc lịch chăm sóc cá nhân và đề xuất gói cao cấp phù hợp.`,
      year: `${count} khách premium thưa lịch ${phrase}. Xây nhóm VIP theo mùa, mời trải nghiệm dịch vụ mới và chăm sóc bằng lịch hẹn cá nhân hóa.`
    },
    high_usage_budget: {
      day: `${count} khách dùng nhiều dịch vụ phổ thông ${phrase}. Tập trung phục vụ nhanh, giới thiệu nâng cấp nhỏ ngay tại quầy và giữ trải nghiệm ổn định.`,
      week: `${count} khách phổ thông quay lại nhiều ${phrase}. Gợi ý gói tiết kiệm theo tuần, tích điểm và thử nâng cấp từng bước với dịch vụ có biên tốt.`,
      month: `${count} khách bình dân tần suất cao ${phrase}. Tạo combo tiết kiệm theo tháng, theo dõi doanh thu trung bình ${avgAmount} đ và đẩy dịch vụ bổ trợ dễ mua.`,
      year: `${count} khách phổ thông bền vững ${phrase}. Xây chương trình thành viên, bậc tích điểm và lộ trình nâng cấp dịch vụ theo quý.`
    },
    one_time_then_left: {
      day: `${count} khách mới hoặc một lần ${phrase}. Hỏi nhanh trải nghiệm sau ca, lưu ghi chú nhu cầu và gửi lời mời quay lại trong thời điểm gần nhất.`,
      week: `${count} khách một lần rồi rời ${phrase}. Gửi khảo sát ngắn trong tuần, kèm voucher quay lại có hạn và theo dõi ai phản hồi để chăm tiếp.`,
      month: `${count} khách chưa quay lại ${phrase}. Phân tách theo dịch vụ đã dùng, thử ưu đãi quay lại trong tháng và đo tỷ lệ đặt lịch lại.`,
      year: `${count} khách rời sau lần đầu ${phrase}. Rà trải nghiệm lần đầu, tối ưu quy trình chăm sau dịch vụ và tạo chiến dịch win-back theo mùa.`
    },
    low_monthly_usage: {
      day: `${count} khách tần suất thấp ${phrase}. Ưu tiên nhắc lịch gần nhất, gợi ý khung giờ còn trống và ghi nhận nhu cầu để hẹn lại đúng chu kỳ.`,
      week: `${count} khách ít phát sinh theo nhịp tuần ${phrase}. Chọn ngày nhắc lịch cố định, đề xuất slot vắng và dùng ưu đãi nhỏ để tăng tần suất.`,
      month: `${count} khách đặt theo tháng còn thấp ${phrase}. Lập nhắc lịch định kỳ, gợi ý gói duy trì và theo dõi nhịp đặt trung bình ${averages.monthly_booking_rate || 0} lịch/tháng.`,
      year: `${count} khách có nhịp dùng thưa ${phrase}. Chia lịch chăm sóc theo quý, tạo gói duy trì dài hạn và đo mức quay lại qua từng mùa.`
    }
  };

  return byPeriod[definition.key]?.[period.type] || `${period.label}: ${definition.strategy} Trọng tâm ${pace}.`;
};

const buildDecAssignmentData = async ({ period_type = null, periodType = null, year = null, month = null, date = null, day = null, week = null } = {}) => {
  const period = normalizePeriod({ period_type, periodType, year, month, date, day, week });
  const [customerRows, serviceUsageRows, servicePrices] = await Promise.all([
    getCustomerRows(period),
    getServiceUsageRows(period),
    getServicePrices()
  ]);

  const analysis = await runPythonJson(PYTHON_ANALYTICS_SCRIPT, 'dec', {
    customer_rows: customerRows,
    service_usage_rows: serviceUsageRows,
    service_prices: servicePrices,
    has_period_filter: period.type !== 'all',
    today: new Date().toISOString().slice(0, 10)
  });

  const clustersByKey = new Map(
    CLUSTER_DEFINITIONS.map((definition) => [
      definition.key,
      analysis.clusters_by_key?.[definition.key] || []
    ])
  );
  const customers = analysis.customers || [];
  const unassigned = analysis.unassigned || [];

  return {
    period,
    customers,
    thresholds: analysis.thresholds || { premium: 0, budget: 0 },
    clustersByKey,
    unassigned,
    clusteredCount: analysis.clustered_count || 0,
    method: analysis.method || 'python_dec'
  };
};

const getDecClusteringReport = async ({
  limitPerCluster = 20,
  period_type = null,
  periodType = null,
  year = null,
  month = null,
  date = null,
  day = null,
  week = null
} = {}) => {
  const {
    period,
    customers,
    thresholds,
    clustersByKey,
    unassigned,
    clusteredCount,
    method
  } = await buildDecAssignmentData({ period_type, periodType, year, month, date, day, week });

  const clusters = CLUSTER_DEFINITIONS.map((definition) => {
    const clusterCustomers = clustersByKey.get(definition.key) || [];
    const sortedCustomers = [...clusterCustomers].sort(
      (a, b) =>
        b.total_bookings - a.total_bookings ||
        b.completed_revenue - a.completed_revenue ||
        b.cancellation_rate - a.cancellation_rate
    );
    const averages = calculateAverages(clusterCustomers);

    return {
      ...definition,
      base_strategy: definition.strategy,
      strategy: buildDynamicStrategy(definition, sortedCustomers, averages, period),
      count: clusterCustomers.length,
      percent: clusteredCount > 0 ? round((clusterCustomers.length / clusteredCount) * 100, 1) : 0,
      averages,
      customers: sortedCustomers.slice(0, limitPerCluster)
    };
  });

  return {
    generated_at: new Date().toISOString(),
    period: {
      type: period.type,
      label: period.label,
      year: period.year,
      month: period.month,
      date: period.date,
      week: period.week,
      week_value: period.week_value
    },
    method: {
      code: 'DEC',
      name: 'Dynamic Engagement Clustering',
      description:
        'Phân cụm hành vi động dựa trên tần suất đặt lịch, tỷ lệ hoàn thành, hủy/không đến, giá trị dịch vụ và nhịp đặt theo tháng.',
      runtime: method,
      min_recommended_customers: MIN_RECOMMENDED_CUSTOMERS,
      cluster_count: CLUSTER_DEFINITIONS.length,
      thresholds
    },
    summary: {
      total_customers: customers.length,
      clustered_customers: clusteredCount,
      unassigned_customers: unassigned.length,
      is_enough_data: customers.length >= MIN_RECOMMENDED_CUSTOMERS
    },
    clusters,
    unassigned: unassigned.slice(0, limitPerCluster)
  };
};

const getDecCustomerInsights = async ({ customerIds = [], year = null, month = null } = {}) => {
  const requestedIds = new Set(
    customerIds
      .map((id) => Number(id))
      .filter((id) => Number.isInteger(id) && id > 0)
  );

  if (requestedIds.size === 0) {
    return [];
  }

  const { clustersByKey } = await buildDecAssignmentData({ year, month });
  const insights = [];

  CLUSTER_DEFINITIONS.forEach((definition, index) => {
    const potentialMeta = CUSTOMER_POTENTIAL_META[definition.key] || {
      status: 'unknown',
      label: 'Chưa phân loại',
      reason: 'Chưa đủ dữ liệu hành vi.',
      staff_hint: 'Theo dõi thêm các lịch hẹn tiếp theo.'
    };

    (clustersByKey.get(definition.key) || []).forEach((customer) => {
      if (!requestedIds.has(Number(customer.id))) {
        return;
      }

      insights.push({
        customer_id: customer.id,
        customer_dec_cluster_key: definition.key,
        customer_dec_cluster_number: index,
        customer_dec_cluster_code: definition.code,
        customer_dec_cluster_label: definition.label,
        customer_dec_cluster_short_label: definition.short_label,
        customer_dec_cluster_strategy: definition.strategy,
        customer_potential_status: potentialMeta.status,
        customer_potential_label: potentialMeta.label,
        customer_potential_reason: potentialMeta.reason,
        customer_staff_hint: potentialMeta.staff_hint,
        customer_total_bookings: customer.total_bookings,
        customer_completed_bookings: customer.completed_bookings,
        customer_cancelled_bookings: customer.cancelled_bookings,
        customer_no_show_bookings: customer.no_show_bookings,
        customer_completion_rate: customer.completion_rate,
        customer_cancellation_rate: customer.cancellation_rate,
        customer_avg_completed_amount: customer.avg_completed_amount,
        customer_favorite_service: customer.favorite_service,
        customer_last_booking_date: customer.last_booking_date
      });
    });
  });

  return insights;
};

module.exports = {
  CLUSTER_DEFINITIONS,
  MIN_RECOMMENDED_CUSTOMERS,
  getDecClusteringReport,
  getDecCustomerInsights
};
