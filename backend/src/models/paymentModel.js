const db = require('../config/db');

// Tạo thanh toán mới
const createPayment = (paymentData, callback) => {
  const { appointment_id, amount, payment_method, status, transaction_id } = paymentData;
  const query = 'INSERT INTO payments (appointment_id, amount, payment_method, status, transaction_id, created_at) VALUES (?, ?, ?, ?, ?, NOW())';
  
  db.query(query, [appointment_id, amount, payment_method, status || 'pending', transaction_id || ''], (err, result) => {
    if (err) return callback(err);
    callback(null, result);
  });
};

// Lấy thanh toán theo ID
const getPaymentById = (id, callback) => {
  const query = 'SELECT * FROM payments WHERE id = ?';
  db.query(query, [id], (err, results) => {
    if (err) return callback(err);
    callback(null, results[0]);
  });
};

// Lấy thanh toán theo appointment ID
const getPaymentByAppointmentId = (appointment_id, callback) => {
  const query = 'SELECT * FROM payments WHERE appointment_id = ?';
  db.query(query, [appointment_id], (err, results) => {
    if (err) return callback(err);
    callback(null, results[0]);
  });
};

// Cập nhật thanh toán
const updatePayment = (id, updateData, callback) => {
  // FIX 6: Add update payment logic
  const setClause = Object.keys(updateData)
    .map(key => `${key} = ?`)
    .join(', ');
  const values = Object.values(updateData);
  
  const query = `UPDATE payments SET ${setClause} WHERE id = ?`;
  
  db.query(query, [...values, id], (err, result) => {
    if (err) return callback(err);
    callback(null, result);
  });
};

// Cập nhật trạng thái thanh toán
const updatePaymentStatus = (id, status, callback) => {
  const query = 'UPDATE payments SET payment_status = ? WHERE id = ?';
  db.query(query, [status, id], (err, result) => {
    if (err) return callback(err);
    callback(null, result);
  });
};

// Lấy tất cả thanh toán
const getAllPayments = (callback) => {
  const query = `
    SELECT p.*, a.appointment_date, u.name as customer_name, s.name as service_name
    FROM payments p
    JOIN appointments a ON p.appointment_id = a.id
    JOIN users u ON a.user_id = u.id
    JOIN services s ON a.service_id = s.id
    ORDER BY p.created_at DESC
  `;
  db.query(query, (err, results) => {
    if (err) return callback(err);
    callback(null, results);
  });
};

module.exports = {
  createPayment,
  getPaymentById,
  getPaymentByAppointmentId,
  updatePaymentStatus,
  updatePayment,
  getAllPayments
};
