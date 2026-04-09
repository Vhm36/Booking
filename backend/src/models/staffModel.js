const db = require('../config/db');

const getAllStaff = (callback) => {
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
      ON a.staff_id = u.id
      AND a.status != 'cancelled'
    WHERE u.role = 'staff'
    GROUP BY u.id, u.name, u.email, u.phone, u.is_active, u.created_at
    ORDER BY u.is_active DESC, u.name ASC
  `;

  db.query(query, (err, results) => {
    if (err) return callback(err);
    callback(null, results);
  });
};

const getBookableStaff = (callback) => {
  const query = `
    SELECT id, name, email, phone
    FROM users
    WHERE role = 'staff' AND is_active = 1
    ORDER BY name ASC
  `;

  db.query(query, (err, results) => {
    if (err) return callback(err);
    callback(null, results);
  });
};

const getStaffById = (id, callback) => {
  const query = `
    SELECT id, name, email, phone, role, is_active, created_at
    FROM users
    WHERE id = ? AND role = 'staff'
  `;

  db.query(query, [id], (err, results) => {
    if (err) return callback(err);
    callback(null, results[0]);
  });
};

const createStaff = (staffData, callback) => {
  const { name, email, password, phone, is_active } = staffData;
  const query = `
    INSERT INTO users (name, email, password, phone, role, is_active, created_at)
    VALUES (?, ?, ?, ?, 'staff', ?, NOW())
  `;

  db.query(query, [name, email, password, phone || '', is_active ? 1 : 0], (err, result) => {
    if (err) return callback(err);
    callback(null, result);
  });
};

const updateStaff = (id, staffData, callback) => {
  const fields = [];
  const values = [];

  if (typeof staffData.name !== 'undefined') {
    fields.push('name = ?');
    values.push(staffData.name);
  }

  if (typeof staffData.phone !== 'undefined') {
    fields.push('phone = ?');
    values.push(staffData.phone);
  }

  if (typeof staffData.password !== 'undefined') {
    fields.push('password = ?');
    values.push(staffData.password);
  }

  if (typeof staffData.is_active !== 'undefined') {
    fields.push('is_active = ?');
    values.push(staffData.is_active ? 1 : 0);
  }

  if (fields.length === 0) {
    return callback(null, { affectedRows: 0, changedRows: 0 });
  }

  const query = `
    UPDATE users
    SET ${fields.join(', ')}
    WHERE id = ? AND role = 'staff'
  `;
  values.push(id);

  db.query(query, values, (err, result) => {
    if (err) return callback(err);
    callback(null, result);
  });
};

const getAvailableStaff = (appointmentDate, appointmentTime, callback) => {
  const query = `
    SELECT u.id, u.name, u.email, u.phone
    FROM users u
    WHERE u.role = 'staff'
      AND u.is_active = 1
      AND u.id NOT IN (
        SELECT a.staff_id
        FROM appointments a
        WHERE a.staff_id IS NOT NULL
          AND a.appointment_date = ?
          AND a.appointment_time = ?
          AND a.status != 'cancelled'
      )
    ORDER BY u.name ASC
  `;

  db.query(query, [appointmentDate, appointmentTime], (err, results) => {
    if (err) return callback(err);
    callback(null, results);
  });
};

module.exports = {
  getAllStaff,
  getBookableStaff,
  getStaffById,
  createStaff,
  updateStaff,
  getAvailableStaff
};
