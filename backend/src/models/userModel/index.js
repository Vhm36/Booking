const db = require('../../config/db');

// Táº¡o user má»›i
const createUser = (userData, callback) => {
  const { name, email, password, phone, role } = userData;
  const query = 'INSERT INTO users (name, email, password, phone, role, created_at) VALUES (?, ?, ?, ?, ?, NOW())';

  db.query(query, [name, email, password, phone, role || 'customer'], (err, result) => {
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

// Láº¥y user theo ID
const getUserById = (id, callback) => {
  const query = 'SELECT id, name, email, phone, role, created_at FROM users WHERE id = ?';
  db.query(query, [id], (err, results) => {
    if (err) return callback(err);
    callback(null, results[0]);
  });
};

// Láº¥y táº¥t cáº£ users
const getAllUsers = (callback) => {
  const query = 'SELECT id, name, email, phone, role, created_at FROM users';
  db.query(query, (err, results) => {
    if (err) return callback(err);
    callback(null, results);
  });
};

// Cáº­p nháº­t máº­t kháº©u user
const updateUserPassword = (id, hashedPassword, callback) => {
  const query = 'UPDATE users SET password = ? WHERE id = ?';

  db.query(query, [hashedPassword, id], (err, result) => {
    if (err) return callback(err);
    callback(null, result);
  });
};

// Cáº­p nháº­t user
const updateUser = (id, userData, callback) => {
  const { name, email, phone } = userData;
  const query = 'UPDATE users SET name = ?, email = ?, phone = ? WHERE id = ?';

  db.query(query, [name, email, phone, id], (err, result) => {
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
  getUserByEmail,
  getUserById,
  getAllUsers,
  updateUserPassword,
  updateUser,
  deleteUser
};
