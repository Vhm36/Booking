const db = require('../../config/db');

const CACHE_TTL_MS = 30 * 1000;

let cachedInfo = null;
let cacheExpiresAt = 0;

const getAppointmentServiceSchemaInfo = (callback) => {
  if (cachedInfo && cacheExpiresAt > Date.now()) {
    return callback(null, cachedInfo);
  }

  const query = `
    SELECT COUNT(*) AS c
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'appointment_services'
  `;

  db.query(query, (err, rows) => {
    if (err) return callback(err);

    cachedInfo = {
      hasAppointmentServicesTable: Number(rows?.[0]?.c || 0) > 0
    };
    cacheExpiresAt = Date.now() + CACHE_TTL_MS;

    return callback(null, cachedInfo);
  });
};

module.exports = {
  getAppointmentServiceSchemaInfo
};
