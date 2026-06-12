const db = require('../../config/db');

const VIP_TIERS = [
  { code: 'black', label: 'VIP Đen', minSpent: 15000000, icon: 'eclipse' },
  { code: 'gold', label: 'VIP Vàng', minSpent: 7000000, icon: 'crown' },
  { code: 'silver', label: 'VIP Bạc', minSpent: 3000000, icon: 'shield' },
  { code: 'bronze', label: 'VIP Đồng', minSpent: 1000000, icon: 'ember' }
];

const toNumber = (value) => Number(value || 0);

const getVipTier = (totalSpent) => {
  const matchedTier = VIP_TIERS.find((tier) => totalSpent >= tier.minSpent);

  if (matchedTier) {
    return matchedTier;
  }

  return {
    code: 'standard',
    label: 'Thành viên thường',
    minSpent: 0,
    icon: 'spark'
  };
};

const getBehaviorTags = ({
  totalAppointments,
  completedAppointments,
  cancelledAppointments,
  cancellationRate,
  totalSpent
}) => {
  const tags = [];

  if (totalAppointments >= 8) {
    tags.push({
      code: 'frequent_booker',
      label: 'Đặt dịch vụ nhiều',
      tone: 'emerald'
    });
  } else if (completedAppointments >= 4) {
    tags.push({
      code: 'returning_customer',
      label: 'Khách quay lại',
      tone: 'sky'
    });
  }

  if (cancelledAppointments >= 3 && cancellationRate >= 35) {
    tags.push({
      code: 'frequent_canceller',
      label: 'Hủy dịch vụ nhiều',
      tone: 'rose'
    });
  }

  if (completedAppointments >= 6 && cancellationRate <= 20) {
    tags.push({
      code: 'stable_customer',
      label: 'Giữ lịch tốt',
      tone: 'teal'
    });
  }

  if (totalSpent >= 7000000) {
    tags.push({
      code: 'high_spender',
      label: 'Chi tiêu cao',
      tone: 'amber'
    });
  }

  if (tags.length === 0) {
    tags.push({
      code: 'new_customer',
      label: 'Khách mới',
      tone: 'slate'
    });
  }

  return tags;
};

const getBehaviorRole = (tags) => {
  const codes = new Set(tags.map((tag) => tag.code));

  if (codes.has('frequent_booker') && codes.has('frequent_canceller')) {
    return {
      code: 'mixed_high_activity',
      label: 'Đặt nhiều nhưng cũng hủy nhiều'
    };
  }

  if (codes.has('frequent_canceller')) {
    return {
      code: 'frequent_canceller',
      label: 'Nhóm hủy nhiều'
    };
  }

  if (codes.has('frequent_booker')) {
    return {
      code: 'frequent_booker',
      label: 'Nhóm đặt nhiều'
    };
  }

  if (codes.has('stable_customer')) {
    return {
      code: 'stable_customer',
      label: 'Nhóm giữ lịch tốt'
    };
  }

  return {
    code: 'standard',
    label: 'Hành vi ổn định'
  };
};

const enrichCustomerInsights = (customer) => {
  const totalAppointments = toNumber(customer.total_appointments);
  const completedAppointments = toNumber(customer.completed_appointments);
  const cancelledAppointments = toNumber(customer.cancelled_appointments);
  const totalSpent = toNumber(customer.total_spent);
  const cancellationRate =
    totalAppointments > 0
      ? Number(((cancelledAppointments / totalAppointments) * 100).toFixed(1))
      : 0;
  const vipTier = getVipTier(totalSpent);
  const behaviorTags = getBehaviorTags({
    totalAppointments,
    completedAppointments,
    cancelledAppointments,
    cancellationRate,
    totalSpent
  });
  const behaviorRole = getBehaviorRole(behaviorTags);

  return {
    ...customer,
    total_appointments: totalAppointments,
    completed_appointments: completedAppointments,
    cancelled_appointments: cancelledAppointments,
    total_spent: totalSpent,
    cancellation_rate: cancellationRate,
    vip_tier_code: vipTier.code,
    vip_tier_label: vipTier.label,
    vip_tier_icon: vipTier.icon,
    behavior_tags: behaviorTags,
    behavior_role_code: behaviorRole.code,
    behavior_role_label: behaviorRole.label
  };
};

const getAllCustomers = ({ search = '', limit = 50, offset = 0 } = {}, callback) => {
  const normalizedSearch = String(search || '').trim();
  const searchPattern = `%${normalizedSearch}%`;
  const searchClause = normalizedSearch
    ? 'AND (u.name LIKE ? OR u.email LIKE ? OR u.phone LIKE ?)'
    : '';
  const searchParams = normalizedSearch ? [searchPattern, searchPattern, searchPattern] : [];
  const customerQuery = `
    SELECT
      u.id,
      u.name,
      u.email,
      u.phone,
      u.date_of_birth,
      u.is_active,
      u.customer_segment,
      u.rfm_score,
      u.rfm_updated_at,
      u.created_at,
      COUNT(a.id) AS total_appointments,
      SUM(CASE WHEN a.status = 'completed' THEN 1 ELSE 0 END) AS completed_appointments,
      SUM(CASE WHEN a.status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled_appointments,
      COALESCE(SUM(CASE WHEN a.status = 'completed' THEN a.total_amount ELSE 0 END), 0) AS total_spent
    FROM users u
    LEFT JOIN appointments a
      ON a.user_id = u.id
    WHERE u.role = 'customer'
      ${searchClause}
    GROUP BY
      u.id,
      u.name,
      u.email,
      u.phone,
      u.date_of_birth,
      u.is_active,
      u.customer_segment,
      u.rfm_score,
      u.rfm_updated_at,
      u.created_at
    ORDER BY u.created_at DESC
    LIMIT ? OFFSET ?
  `;
  const countQuery = `
    SELECT COUNT(*) AS total
    FROM users u
    WHERE u.role = 'customer'
      ${searchClause}
  `;

  db.query(customerQuery, [...searchParams, limit, offset], (err, results) => {
    if (err) return callback(err);

    db.query(countQuery, searchParams, (countErr, countRows) => {
      if (countErr) return callback(countErr);
      callback(null, {
        customers: results.map(enrichCustomerInsights),
        total: Number(countRows[0]?.total || 0)
      });
    });
  });
};

const getCustomerById = (id, callback) => {
  const query = `
    SELECT id, name, email, phone, date_of_birth, role, is_active, created_at
    FROM users
    WHERE id = ? AND role = 'customer'
  `;

  db.query(query, [id], (err, results) => {
    if (err) return callback(err);
    callback(null, results[0]);
  });
};

const createCustomer = (customerData, callback) => {
  const { name, email, password, phone, date_of_birth, is_active } = customerData;
  const query = `
    INSERT INTO users (name, email, password, phone, date_of_birth, role, is_active, created_at)
    VALUES (?, ?, ?, ?, ?, 'customer', ?, NOW())
  `;

  db.query(query, [name, email, password, phone || '', date_of_birth || null, is_active ? 1 : 0], (err, result) => {
    if (err) return callback(err);
    callback(null, result);
  });
};

const updateCustomer = (id, customerData, callback) => {
  const fields = [];
  const values = [];

  if (typeof customerData.name !== 'undefined') {
    fields.push('name = ?');
    values.push(customerData.name);
  }

  if (typeof customerData.email !== 'undefined') {
    fields.push('email = ?');
    values.push(customerData.email);
  }

  if (typeof customerData.phone !== 'undefined') {
    fields.push('phone = ?');
    values.push(customerData.phone);
  }

  if (typeof customerData.date_of_birth !== 'undefined') {
    fields.push('date_of_birth = ?');
    values.push(customerData.date_of_birth || null);
  }

  if (typeof customerData.password !== 'undefined') {
    fields.push('password = ?');
    values.push(customerData.password);
  }

  if (typeof customerData.is_active !== 'undefined') {
    fields.push('is_active = ?');
    values.push(customerData.is_active ? 1 : 0);
  }

  if (fields.length === 0) {
    return callback(null, { affectedRows: 0, changedRows: 0 });
  }

  const query = `
    UPDATE users
    SET ${fields.join(', ')}
    WHERE id = ? AND role = 'customer'
  `;
  values.push(id);

  db.query(query, values, (err, result) => {
    if (err) return callback(err);
    callback(null, result);
  });
};

const getCustomerAppointmentCount = (id, callback) => {
  const query = 'SELECT COUNT(*) AS total FROM appointments WHERE user_id = ?';

  db.query(query, [id], (err, results) => {
    if (err) return callback(err);
    callback(null, Number(results[0]?.total || 0));
  });
};

const deleteCustomer = (id, callback) => {
  const query = "DELETE FROM users WHERE id = ? AND role = 'customer'";

  db.query(query, [id], (err, result) => {
    if (err) return callback(err);
    callback(null, result);
  });
};

module.exports = {
  getAllCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  getCustomerAppointmentCount,
  deleteCustomer
};
