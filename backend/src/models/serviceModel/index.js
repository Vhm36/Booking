const db = require('../../config/db');

const createService = (serviceData, callback) => {
  const { name, description, price, duration, category, image_url, status, service_code } = serviceData;
  const query = `
    INSERT INTO services (name, description, price, duration, category, image_url, status, service_code, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
  `;

  db.query(
    query,
    [name, description, price, duration, category || '', image_url || '', status || 'active', service_code || null],
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

const getServicesByIds = (ids, callback) => {
  const normalizedIds = Array.isArray(ids)
    ? ids
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value > 0)
    : [];

  if (normalizedIds.length === 0) {
    return callback(null, []);
  }

  const query = 'SELECT * FROM services WHERE id IN (?)';
  db.query(query, [normalizedIds], (err, results) => {
    if (err) return callback(err);
    callback(null, results);
  });
};

const updateService = (id, serviceData, callback) => {
  const { name, description, price, duration, category, image_url, status, service_code } = serviceData;
  const query = `
    UPDATE services
    SET name = ?, description = ?, price = ?, duration = ?, category = ?, image_url = ?, status = ?, service_code = ?
    WHERE id = ?
  `;

  db.query(
    query,
    [name, description, price, duration, category || '', image_url || '', status, service_code || null, id],
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

const createCategory = (categoryData, callback) => {
  const { category_name } = categoryData;
  const query = `
    INSERT INTO service_category (category_name)
    VALUES (?)
  `;

  db.query(query, [category_name], (err, result) => {
    if (err) return callback(err);
    callback(null, result);
  });
};

const getAllCategories = (callback) => {
  const query = `
    SELECT id, category_name 
    FROM service_category 
    ORDER BY category_name ASC
  `;

  db.query(query, (err, results) => {
    if (err) return callback(err);
    callback(null, results);
  });
};

const getTrendingServices = (callback) => {
  const query = `
    SELECT
      s.id,
      s.name,
      s.description,
      s.price,
      s.duration,
      s.category,
      s.image_url,
      s.status,
      s.created_at,
      COALESCE(stats.booking_count, 0) AS booking_count,
      COALESCE(stats.completed_count, 0) AS completed_count,
      COALESCE(stats.avg_rating, 0) AS avg_rating
    FROM services s
    LEFT JOIN (
      SELECT
        service_usage.service_id,
        COUNT(service_usage.appointment_id) AS booking_count,
        SUM(CASE WHEN service_usage.status = 'completed' THEN 1 ELSE 0 END) AS completed_count,
        AVG(service_usage.staff_rating) AS avg_rating
      FROM (
        SELECT
          aps.service_id,
          a.id AS appointment_id,
          a.status,
          a.staff_rating
        FROM appointments a
        JOIN appointment_services aps ON aps.appointment_id = a.id
        WHERE a.appointment_date >= DATE_SUB(CURDATE(), INTERVAL 90 DAY)
          AND a.status != 'cancelled'

        UNION ALL

        SELECT
          a.service_id,
          a.id AS appointment_id,
          a.status,
          a.staff_rating
        FROM appointments a
        WHERE a.appointment_date >= DATE_SUB(CURDATE(), INTERVAL 90 DAY)
          AND a.status != 'cancelled'
          AND a.service_id IS NOT NULL
          AND NOT EXISTS (
            SELECT 1
            FROM appointment_services aps
            WHERE aps.appointment_id = a.id
          )
      ) service_usage
      GROUP BY service_usage.service_id
    ) stats ON stats.service_id = s.id
    WHERE s.status = 'active'
    ORDER BY booking_count DESC, completed_count DESC, s.created_at DESC
  `;

  db.query(query, (err, results) => {
    if (err) return callback(err);
    callback(null, results);
  });
};

module.exports = {
  createService,
  getAllServices,
  getServiceById,
  getServicesByIds,
  updateService,
  updateServicePrice,
  deleteService,
  createCategory,
  getAllCategories,
  getTrendingServices
};
