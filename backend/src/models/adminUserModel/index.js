const db = require('../../config/db');

const getAllAdmins = (callback) => {
  const query = `
    SELECT id, name, email, phone, is_active, created_at
    FROM users
    WHERE role = 'admin'
    ORDER BY created_at DESC, id DESC
  `;

  db.query(query, (err, results) => {
    if (err) return callback(err);
    callback(null, results);
  });
};

const getAdminById = (id, callback) => {
  const query = `
    SELECT id, name, email, phone, role, is_active, created_at
    FROM users
    WHERE id = ? AND role = 'admin'
    LIMIT 1
  `;

  db.query(query, [id], (err, results) => {
    if (err) return callback(err);
    callback(null, results[0] || null);
  });
};

const createAdmin = (adminData, callback) => {
  const { name, email, password, phone, is_active } = adminData;
  const query = `
    INSERT INTO users (name, email, password, phone, role, is_active, created_at)
    VALUES (?, ?, ?, ?, 'admin', ?, NOW())
  `;

  db.query(query, [name, email, password, phone || '', is_active ? 1 : 0], (err, result) => {
    if (err) return callback(err);
    callback(null, result);
  });
};

const updateAdmin = (id, adminData, callback) => {
  const fields = [];
  const values = [];

  if (typeof adminData.name !== 'undefined') {
    fields.push('name = ?');
    values.push(adminData.name);
  }

  if (typeof adminData.email !== 'undefined') {
    fields.push('email = ?');
    values.push(adminData.email);
  }

  if (typeof adminData.phone !== 'undefined') {
    fields.push('phone = ?');
    values.push(adminData.phone);
  }

  if (typeof adminData.password !== 'undefined') {
    fields.push('password = ?');
    values.push(adminData.password);
  }

  if (typeof adminData.is_active !== 'undefined') {
    fields.push('is_active = ?');
    values.push(adminData.is_active ? 1 : 0);
  }

  if (fields.length === 0) {
    return callback(null, { affectedRows: 0, changedRows: 0 });
  }

  const query = `
    UPDATE users
    SET ${fields.join(', ')}
    WHERE id = ? AND role = 'admin'
  `;
  values.push(id);

  db.query(query, values, (err, result) => {
    if (err) return callback(err);
    callback(null, result);
  });
};

module.exports = {
  getAllAdmins,
  getAdminById,
  createAdmin,
  updateAdmin
};
