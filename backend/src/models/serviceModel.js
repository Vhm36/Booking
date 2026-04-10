const db = require('../config/db');

const createService = (serviceData, callback) => {
  const { name, description, price, duration, category, image_url, status } = serviceData;
  const query = `
    INSERT INTO services (name, description, price, duration, category, image_url, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
  `;

  db.query(
    query,
    [name, description, price, duration, category || '', image_url || '', status || 'active'],
    (err, result) => {
      if (err) return callback(err);
      callback(null, result);
    }
  );
};

const getAllServices = (callback, includeInactive = false) => {
  const query = includeInactive
    ? 'SELECT * FROM services ORDER BY created_at DESC'
    : 'SELECT * FROM services WHERE status = "active" ORDER BY created_at DESC';
  db.query(query, (err, results) => {
    if (err) return callback(err);
    callback(null, results);
  });
};

const getServiceById = (id, callback) => {
  const query = 'SELECT * FROM services WHERE id = ?';
  db.query(query, [id], (err, results) => {
    if (err) return callback(err);
    callback(null, results[0]);
  });
};

const updateService = (id, serviceData, callback) => {
  const { name, description, price, duration, category, image_url, status } = serviceData;
  const query = `
    UPDATE services
    SET name = ?, description = ?, price = ?, duration = ?, category = ?, image_url = ?, status = ?
    WHERE id = ?
  `;

  db.query(
    query,
    [name, description, price, duration, category || '', image_url || '', status, id],
    (err, result) => {
      if (err) return callback(err);
      callback(null, result);
    }
  );
};

const updateServicePrice = (id, price, callback) => {
  const query = 'UPDATE services SET price = ? WHERE id = ?';
  db.query(query, [price, id], (err, result) => {
    if (err) return callback(err);
    callback(null, result);
  });
};

const deleteService = (id, callback) => {
  const query = 'DELETE FROM services WHERE id = ?';
  db.query(query, [id], (err, result) => {
    if (err) return callback(err);
    callback(null, result);
  });
};

module.exports = {
  createService,
  getAllServices,
  getServiceById,
  updateService,
  updateServicePrice,
  deleteService
};
