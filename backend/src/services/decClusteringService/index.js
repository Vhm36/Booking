const db = require('../../config/db');

const MIN_RECOMMENDED_CUSTOMERS = 100;

const CLUSTER_DEFINITIONS = [
  {
    key: 'frequent_single_service',
    label: 'Thường xuyên đặt 1 dịch vụ',
    short_label: '1 dịch vụ',
    description: 'Khách quay lại nhiều lần nhưng gần như chỉ dùng một dịch vụ cố định.',
    criteria: 'Từ 3 lịch trở lên và chỉ phát sinh 1 nhóm dịch vụ chính.',
    strategy: 'Gợi ý combo bảo dưỡng định kỳ, nhắc lịch theo chu kỳ và bán thêm dịch vụ bổ trợ.',
    tone: 'teal'
  },
  {
    key: 'many_bookings_low_arrival',
    label: 'Đặt nhiều nhưng ít đến',
    short_label: 'Ít đến',
    description: 'Khách tạo nhiều lịch nhưng tỷ lệ hoàn thành thấp.',
    criteria: 'Từ 4 lịch trở lên, lịch hoàn thành thấp so với tổng lịch.',
    strategy: 'Yêu cầu xác nhận trước giờ hẹn, đặt cọc nhẹ hoặc nhắc lịch tự động sớm hơn.',
    tone: 'amber'
  },
  {
    key: 'frequent_cancel_no_show',
    label: 'Hay hủy lịch hoặc không đến',
    short_label: 'Hay hủy',
    description: 'Khách có hành vi hủy lịch nhiều hoặc được ghi nhận không đến.',
    criteria: 'Từ 2 lịch hủy/không đến và tỷ lệ rủi ro từ 35% trở lên.',
    strategy: 'Ưu tiên khung giờ dễ thay thế, gửi nhắc lịch 24h và xác nhận lại trước ca.',
    tone: 'rose'
  },
  {
    key: 'low_usage_premium',
    label: 'Dùng ít nhưng chọn dịch vụ cao cấp',
    short_label: 'Premium ít dùng',
    description: 'Khách ít đặt lịch nhưng giá trị mỗi lần dùng dịch vụ cao.',
    criteria: 'Tối đa 2 lịch hoàn thành và giá trị trung bình thuộc nhóm cao.',
    strategy: 'Chăm sóc cá nhân hóa, ưu đãi dịch vụ cao cấp và mời quay lại theo dịp đặc biệt.',
    tone: 'violet'
  },
  {
    key: 'high_usage_budget',
    label: 'Dùng nhiều dịch vụ bình dân',
    short_label: 'Bình dân nhiều',
    description: 'Khách dùng thường xuyên nhưng chủ yếu chọn dịch vụ giá thấp.',
    criteria: 'Từ 3 lịch hoàn thành và giá trị trung bình thuộc nhóm bình dân.',
    strategy: 'Tạo gói tiết kiệm theo tháng, tích điểm và gợi ý nâng cấp từng bước.',
    tone: 'blue'
  },
  {
    key: 'one_time_then_left',
    label: 'Đặt 1 lần rồi bỏ',
    short_label: 'Một lần rồi bỏ',
    description: 'Khách chỉ đặt một lịch rồi không quay lại trong một khoảng thời gian.',
    criteria: 'Chỉ có 1 lịch, đặc biệt khi lịch gần nhất đã qua hơn 21 ngày.',
    strategy: 'Gửi voucher quay lại, hỏi trải nghiệm sau dịch vụ và đề xuất lịch hẹn mới.',
    tone: 'slate'
  },
  {
    key: 'low_monthly_usage',
    label: 'Đặt theo tháng ít',
    short_label: 'Ít theo tháng',
    description: 'Khách có phát sinh qua nhiều tháng nhưng tần suất mỗi tháng thấp.',
    criteria: 'Có lịch ở từ 2 tháng trở lên và trung bình không quá 1.25 lịch/tháng.',
    strategy: 'Nhắc lịch định kỳ theo tháng, đề xuất lịch trống gần nhất và gói duy trì.',
    tone: 'emerald'
  }
];

const CUSTOMER_POTENTIAL_META = {
  frequent_single_service: {
    status: 'potential',
    label: 'Khách tiềm năng',
    reason: 'Quay lại nhiều lần với một dịch vụ chính.',
    staff_hint: 'Ưu tiên nhắc lịch định kỳ và gợi ý dịch vụ bổ trợ.'
  },
  many_bookings_low_arrival: {
    status: 'not_potential',
    label: 'Khách không tiềm năng',
    reason: 'Đặt nhiều nhưng tỷ lệ đến thấp.',
    staff_hint: 'Cần xác nhận kỹ trước giờ hẹn hoặc yêu cầu cọc nhẹ.'
  },
  frequent_cancel_no_show: {
    status: 'not_potential',
    label: 'Khách không tiềm năng',
    reason: 'Có lịch sử hủy hoặc không đến cao.',
    staff_hint: 'Nên nhắc lịch sớm và ưu tiên khung giờ dễ thay thế.'
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

const getCustomerRows = async (period) => {
  const appointmentPeriod = buildAppointmentPeriodClause('a', period);
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
      COUNT(DISTINCT CASE WHEN a.id IS NOT NULL THEN DATE_FORMAT(a.appointment_date, '%Y-%m') ELSE NULL END) AS active_months,
      MIN(a.appointment_date) AS first_booking_date,
      MAX(a.appointment_date) AS last_booking_date
    FROM users u
    LEFT JOIN appointments a ON a.user_id = u.id${appointmentPeriod.sql}
    WHERE u.role = 'customer' AND u.is_active = 1
    GROUP BY u.id, u.name, u.email
    ORDER BY total_bookings DESC, completed_revenue DESC, u.name ASC
  `;

  return query(sql, appointmentPeriod.params);
};

const getServiceUsageRows = async (period) => {
  const appointmentPeriod = buildAppointmentPeriodClause('a', period);
  const sql = `
    SELECT
      a.user_id AS customer_id,
      COALESCE(aps.service_id, a.service_id) AS service_id,
      COALESCE(aps.service_name_snapshot, s.name, 'Không rõ') AS service_name,
      COUNT(DISTINCT a.id) AS booking_count,
      COALESCE(AVG(COALESCE(aps.price_snapshot, s.price, a.total_amount)), 0) AS avg_price
    FROM appointments a
    LEFT JOIN appointment_services aps ON aps.appointment_id = a.id
    LEFT JOIN services s ON s.id = COALESCE(aps.service_id, a.service_id)
    WHERE a.user_id IS NOT NULL
      AND a.status != 'cancelled'
      ${appointmentPeriod.sql}
    GROUP BY
      a.user_id,
      COALESCE(aps.service_id, a.service_id),
      COALESCE(aps.service_name_snapshot, s.name, 'Không rõ')
  `;

  return query(sql, appointmentPeriod.params);
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

  if (riskCount >= 2 && customer.cancellation_rate >= 35) {
    return 'frequent_cancel_no_show';
  }

  if (customer.total_bookings >= 4 && customer.completion_rate <= 45) {
    return 'many_bookings_low_arrival';
  }

  if (customer.total_bookings === 1 && customer.recency_days >= 21) {
    return 'one_time_then_left';
  }

  if (
    customer.completed_bookings > 0 &&
    customer.completed_bookings <= 2 &&
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

  if (customer.total_bookings >= 3 && customer.distinct_services <= 1) {
    return 'frequent_single_service';
  }

  if (customer.active_months >= 2 && customer.monthly_booking_rate <= 1.25) {
    return 'low_monthly_usage';
  }

  if (customer.total_bookings === 1) {
    return 'one_time_then_left';
  }

  return 'low_monthly_usage';
};

const calculateAverages = (customers = []) => {
  if (customers.length === 0) {
    return {
      total_bookings: 0,
      completion_rate: 0,
      cancellation_rate: 0,
      avg_completed_amount: 0,
      monthly_booking_rate: 0
    };
  }

  const sum = customers.reduce(
    (acc, customer) => ({
      total_bookings: acc.total_bookings + customer.total_bookings,
      completion_rate: acc.completion_rate + customer.completion_rate,
      cancellation_rate: acc.cancellation_rate + customer.cancellation_rate,
      avg_completed_amount: acc.avg_completed_amount + customer.avg_completed_amount,
      monthly_booking_rate: acc.monthly_booking_rate + customer.monthly_booking_rate
    }),
    {
      total_bookings: 0,
      completion_rate: 0,
      cancellation_rate: 0,
      avg_completed_amount: 0,
      monthly_booking_rate: 0
    }
  );

  return {
    total_bookings: round(sum.total_bookings / customers.length, 1),
    completion_rate: round(sum.completion_rate / customers.length, 1),
    cancellation_rate: round(sum.cancellation_rate / customers.length, 1),
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
      day: `${count} khách đặt nhiều nhưng dễ không đến ${phrase}. Chỉ giữ slot khi khách xác nhận lại, ưu tiên gọi trước giờ hẹn và chuẩn bị phương án thay slot nhanh.`,
      week: `${count} khách có tỷ lệ đến thấp ${phrase}. Đặt nhắc lịch 24h, xác nhận lại trong ngày hẹn và cân nhắc cọc nhẹ với nhóm hủy cao (${cancellationRate}%).`,
      month: `${count} khách đặt nhiều nhưng hoàn thành thấp ${phrase}. Tách danh sách cần xác nhận sớm, giới hạn đặt trùng giờ đẹp và theo dõi chuyển đổi hoàn thành ${completionRate}%.`,
      year: `${count} khách có thói quen đặt nhưng ít đến ${phrase}. Thiết lập chính sách giữ chỗ riêng, cọc theo rủi ro và đánh giá lại quyền ưu tiên lịch theo quý.`
    },
    frequent_cancel_no_show: {
      day: `${count} khách rủi ro hủy/không đến ${phrase}. Nhắc lịch trực tiếp trước ca, chọn khung giờ dễ thay thế và không để lịch này chiếm slot cao điểm quá lâu.`,
      week: `${count} khách hủy hoặc không đến nhiều ${phrase}. Lên danh sách gọi xác nhận đầu tuần, ưu tiên slot linh hoạt và theo dõi tỷ lệ hủy ${cancellationRate}%.`,
      month: `${count} khách rủi ro cao ${phrase}. Áp dụng nhắc lịch nhiều bước, yêu cầu xác nhận rõ trước ngày hẹn và dùng ưu đãi chỉ sau khi khách hoàn thành lịch.`,
      year: `${count} khách có lịch sử rủi ro ${phrase}. Xây quy tắc chống boom lịch theo phân tầng, hạn chế giữ slot cao điểm và dùng cọc cho nhóm tái phạm.`
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

  const serviceUsageMap = buildServiceUsageMap(serviceUsageRows);
  const allCustomers = customerRows.map((row) => normalizeCustomer(row, serviceUsageMap));
  const hasPeriodFilter = period.type !== 'all';
  const customers = hasPeriodFilter
    ? allCustomers.filter((customer) => customer.total_bookings > 0)
    : allCustomers;
  const amountValues = customers
    .map((customer) => customer.avg_completed_amount)
    .filter((value) => value > 0);
  const priceBasis = servicePrices.length > 0 ? servicePrices : amountValues;
  const premiumThreshold = quantile(priceBasis, 0.75) || quantile(amountValues, 0.75) || 0;
  const budgetThreshold = quantile(priceBasis, 0.4) || quantile(amountValues, 0.4) || 0;
  const thresholds = {
    premium: Math.round(premiumThreshold),
    budget: Math.round(budgetThreshold)
  };

  const clustersByKey = new Map(CLUSTER_DEFINITIONS.map((definition) => [definition.key, []]));
  const unassigned = [];

  customers.forEach((customer) => {
    const clusterKey = getClusterKey(customer, thresholds);
    if (!clusterKey || !clustersByKey.has(clusterKey)) {
      unassigned.push(customer);
      return;
    }

    clustersByKey.get(clusterKey).push({ ...customer, cluster_key: clusterKey });
  });

  return {
    period,
    customers,
    thresholds,
    clustersByKey,
    unassigned,
    clusteredCount: customers.length - unassigned.length
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
    clusteredCount
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
        customer_dec_cluster_number: index + 1,
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
