const db = require('../config/db');

const getAllCustomers = (callback) => {
  const query = `
    SELECT
      u.id,
      u.name,
      u.email,
      u.phone,
      u.is_active,
      u.created_at,
      COUNT(a.id) AS total_appointments
    FROM users u
    LEFT JOIN appointments a
      ON a.user_id = u.id
      AND a.status != 'cancelled'
    WHERE u.role = 'customer'
    GROUP BY u.id, u.name, u.email, u.phone, u.is_active, u.created_at
    ORDER BY u.created_at DESC
  `;

  db.query(query, (err, results) => {
    if (err) return callback(err);
    callback(null, results);
  });
};

const getCustomerById = (id, callback) => {
  const query = `
    SELECT id, name, email, phone, role, is_active, created_at
    FROM users
    WHERE id = ? AND role = 'customer'
  `;

  db.query(query, [id], (err, results) => {
    if (err) return callback(err);
    callback(null, results[0]);
  });
};

const createCustomer = (customerData, callback) => {
  const { name, email, password, phone, is_active } = customerData;
  const query = `
    INSERT INTO users (name, email, password, phone, role, is_active, created_at)
    VALUES (?, ?, ?, ?, 'customer', ?, NOW())
  `;

  db.query(query, [name, email, password, phone || '', is_active ? 1 : 0], (err, result) => {
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