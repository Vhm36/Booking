const db = require('../../config/db');
const customerModel = require('../../models/customerModel');

// Lấy tóm tắt dashboard
exports.getSummary = (req, res) => {
  const queries = [
    'SELECT COUNT(*) as total_bookings FROM appointments',
    `SELECT
      SUM(total_amount) + SUM(CASE WHEN staff_id IS NOT NULL THEN total_amount * 0.1 ELSE 0 END) as total_revenue
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

// Lấy booking theo tháng
exports.getBookingsByMonth = (req, res) => {
  const query = `
    SELECT MONTH(appointment_date) as month, YEAR(appointment_date) as year, COUNT(*) as total
    FROM appointments
    WHERE status != 'cancelled'
    GROUP BY YEAR(appointment_date), MONTH(appointment_date)
    ORDER BY year DESC, month DESC
    LIMIT 12
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
    SELECT
      MONTH(appointment_date) as month,
      YEAR(appointment_date) as year,
      SUM(total_amount) as base_revenue,
      SUM(CASE WHEN staff_id IS NOT NULL THEN total_amount * 0.1 ELSE 0 END) as staff_commission,
      SUM(total_amount) + SUM(CASE WHEN staff_id IS NOT NULL THEN total_amount * 0.1 ELSE 0 END) as revenue
    FROM appointments
    WHERE status = 'completed'
    GROUP BY YEAR(appointment_date), MONTH(appointment_date)
    ORDER BY year DESC, month DESC
    LIMIT 12
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
      COALESCE(SUM(a.total_amount * 0.1), 0) AS monthly_commission,
      COALESCE(SUM(a.total_amount * 1.1), 0) AS monthly_revenue_with_commission
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
