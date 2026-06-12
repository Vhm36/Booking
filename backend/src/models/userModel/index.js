const db = require('../../config/db');

// Táº¡o user má»›i
const createUser = (userData, callback) => {
  const { name, email, password, phone, role, date_of_birth } = userData;
  const query = `
    INSERT INTO users (name, email, password, phone, date_of_birth, role, created_at)
    VALUES (?, ?, ?, ?, ?, ?, NOW())
  `;

  db.query(query, [name, email, password, phone, date_of_birth || null, role || 'customer'], (err, result) => {
    if (err) return callback(err);
    callback(null, result);
  });
};

// Tạo user mới với Zalo ID
const createUserWithZaloId = (userData, callback) => {
  const { name, zalo_id, password, phone, role } = userData;
  const email = `zalo_${zalo_id}@beautybook.local`;
  const query = 'INSERT INTO users (name, email, zalo_id, password, phone, role, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW())';

  db.query(query, [name, email, zalo_id, password, phone || '', role || 'customer'], (err, result) => {
    if (err) return callback(err);
    callback(null, result);
  });
};

// Láº¥y user theo email
const getUserByEmail = (email, callback) => {
  const query = `
    SELECT u.*, sr.role_name AS staff_role_name
    FROM users u
    LEFT JOIN staff_role sr ON sr.id = u.staff_role_id
    WHERE u.email = ?
  `;
  db.query(query, [email], (err, results) => {
    if (err) return callback(err);
    callback(null, results[0]);
  });
};

// Lấy user theo Zalo ID
const getUserByZaloId = (zaloId, callback) => {
  const query = `
    SELECT u.*, sr.role_name AS staff_role_name
    FROM users u
    LEFT JOIN staff_role sr ON sr.id = u.staff_role_id
    WHERE u.zalo_id = ?
  `;
  db.query(query, [zaloId], (err, results) => {
    if (err) return callback(err);
    callback(null, results[0]);
  });
};

// Láº¥y user theo ID
const getUserById = (id, callback) => {
  const query = 'SELECT id, name, email, phone, date_of_birth, gender, avatar, role, created_at FROM users WHERE id = ?';
  db.query(query, [id], (err, results) => {
    if (err) return callback(err);
    callback(null, results[0]);
  });
};

// Láº¥y táº¥t cáº£ users
const getAllUsers = (callback) => {
  const query = 'SELECT id, name, email, phone, date_of_birth, gender, role, created_at FROM users';
  db.query(query, (err, results) => {
    if (err) return callback(err);
    callback(null, results);
  });
};

// Cáº­p nháº­t máº­t kháº©u user
const getMonthlyLoyaltyStats = (id, callback) => {
  const query = `
    SELECT
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed_count,
      SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled_count
    FROM appointments
    WHERE user_id = ?
      AND appointment_date >= DATE_FORMAT(CURDATE(), '%Y-%m-01')
      AND appointment_date < DATE_ADD(DATE_FORMAT(CURDATE(), '%Y-%m-01'), INTERVAL 1 MONTH)
  `;

  db.query(query, [id], (err, results) => {
    if (err) return callback(err);

    const row = results[0] || {};
    const completedCount = Number(row.completed_count || 0);
    const cancelledCount = Number(row.cancelled_count || 0);

    callback(null, {
      loyalty_points: completedCount * 5 - cancelledCount * 10,
      loyalty_completed_count: completedCount,
      loyalty_cancelled_count: cancelledCount
    });
  });
};

const updateUserPassword = (id, hashedPassword, callback) => {
  const query = 'UPDATE users SET password = ? WHERE id = ?';

  db.query(query, [hashedPassword, id], (err, result) => {
    if (err) return callback(err);
    callback(null, result);
  });
};

// Cáº­p nháº­t user
const updateUser = (id, userData, callback) => {
  const allowedFields = ['name', 'email', 'phone', 'date_of_birth', 'gender', 'avatar'];
  const fields = [];
  const values = [];

  allowedFields.forEach((field) => {
    if (typeof userData[field] !== 'undefined') {
      fields.push(`${field} = ?`);
      values.push(userData[field]);
    }
  });

  if (fields.length === 0) {
    return callback(null, { affectedRows: 0 });
  }

  const query = `UPDATE users SET ${fields.join(', ')} WHERE id = ?`;
  db.query(query, [...values, id], (err, result) => {
    if (err) return callback(err);
    callback(null, result);
  });
};

// Cập nhật avatar
const updateUserAvatar = (id, avatarUrl, callback) => {
  const query = 'UPDATE users SET avatar = ? WHERE id = ?';
  db.query(query, [avatarUrl, id], (err, result) => {
    if (err) return callback(err);
    callback(null, result);
  });
};

// Xóa user
const deleteUser = (id, callback) => {
  const query = 'DELETE FROM users WHERE id = ?';
  db.query(query, [id], (err, result) => {
    if (err) return callback(err);
    callback(null, result);
  });
};

module.exports = {
  createUser,
  createUserWithZaloId,
  getUserByEmail,
  getUserByZaloId,
  getUserById,
  getAllUsers,
  getMonthlyLoyaltyStats,
  updateUserPassword,
  updateUser,
  updateUserAvatar,
  deleteUser
};
