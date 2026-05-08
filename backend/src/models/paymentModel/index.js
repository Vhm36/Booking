const db = require('../../config/db');
const { getPaymentSchemaInfo } = require('../../utils/paymentSchema');
const { getAppointmentServiceSchemaInfo } = require('../../utils/appointmentServiceSchema');

const getAppointmentServiceSummaryJoin = (appointmentAlias = 'a', summaryAlias = 'service_summary') => `
  LEFT JOIN (
    SELECT
      aps.appointment_id,
      COUNT(*) AS service_count,
      GROUP_CONCAT(
        COALESCE(aps.service_name_snapshot, s2.name)
        ORDER BY aps.sort_order ASC
        SEPARATOR ', '
      ) AS service_names,
      SUM(COALESCE(aps.price_snapshot, s2.price, 0)) AS total_price,
      SUM(COALESCE(aps.duration_snapshot, s2.duration, 0)) AS total_duration
    FROM appointment_services aps
    LEFT JOIN services s2 ON s2.id = aps.service_id
    GROUP BY aps.appointment_id
  ) ${summaryAlias} ON ${summaryAlias}.appointment_id = ${appointmentAlias}.id
`;

const getPaymentServiceSelectFragment = (hasAppointmentServicesTable) => {
  if (!hasAppointmentServicesTable) {
    return [
      's.name AS service_name',
      'COALESCE(a.total_amount, s.price) AS service_price',
      's.duration AS service_duration',
      '1 AS service_count'
    ].join(',\n    ');
  }

  return [
    'COALESCE(service_summary.service_names, s.name) AS service_name',
    'COALESCE(service_summary.total_price, a.total_amount, s.price) AS service_price',
    'COALESCE(service_summary.total_duration, s.duration) AS service_duration',
    'COALESCE(service_summary.service_count, 1) AS service_count'
  ].join(',\n    ');
};

const getPaymentSelect = (schemaInfo, appointmentServiceSchemaInfo) => `
  SELECT
    p.*,
    a.user_id,
    a.service_id,
    a.staff_id,
    a.appointment_date,
    a.appointment_time,
    a.end_time,
    a.status AS appointment_status,
    a.notes AS appointment_notes,
    a.total_amount,
    a.deposit_required,
    a.deposit_amount,
    a.cancellation_score,
    a.cancellation_risk,
    u.name AS customer_name,
    u.email AS customer_email,
    u.phone AS customer_phone,
    ${getPaymentServiceSelectFragment(appointmentServiceSchemaInfo.hasAppointmentServicesTable)},
    st.name AS staff_name,
    ${schemaInfo.columns.has('payment_reference') ? 'p.payment_reference' : 'NULL AS payment_reference'},
    ${schemaInfo.columns.has('bank_code') ? 'p.bank_code' : 'NULL AS bank_code'},
    ${schemaInfo.columns.has('bank_transaction_no') ? 'p.bank_transaction_no' : 'NULL AS bank_transaction_no'},
    ${schemaInfo.columns.has('gateway_response_code') ? 'p.gateway_response_code' : 'NULL AS gateway_response_code'},
    ${schemaInfo.columns.has('gateway_transaction_status') ? 'p.gateway_transaction_status' : 'NULL AS gateway_transaction_status'},
    ${schemaInfo.columns.has('payment_url_expires_at') ? 'p.payment_url_expires_at' : 'NULL AS payment_url_expires_at'},
    ${schemaInfo.columns.has('gateway_payload') ? 'p.gateway_payload' : 'NULL AS gateway_payload'}
  FROM payments p
  JOIN appointments a ON a.id = p.appointment_id
  JOIN users u ON u.id = a.user_id
  JOIN services s ON s.id = a.service_id
  ${appointmentServiceSchemaInfo.hasAppointmentServicesTable ? getAppointmentServiceSummaryJoin('a', 'service_summary') : ''}
  LEFT JOIN users st ON st.id = a.staff_id
`;

const filterWritableFields = (data, schemaInfo) =>
  Object.keys(data).filter((field) => schemaInfo.columns.has(field));

const runPaymentQuery = (queryBuilder, params, callback, pickOne = false) => {
  getPaymentSchemaInfo((schemaErr, schemaInfo) => {
    if (schemaErr) return callback(schemaErr);

    getAppointmentServiceSchemaInfo((appointmentSchemaErr, appointmentServiceSchemaInfo) => {
      if (appointmentSchemaErr) return callback(appointmentSchemaErr);

      const query = queryBuilder(schemaInfo, appointmentServiceSchemaInfo);
      db.query(query, params, (err, results) => {
        if (err) return callback(err);
        callback(null, pickOne ? results[0] || null : results);
      });
    });
  });
};

const createPayment = (paymentData, callback) => {
  getPaymentSchemaInfo((schemaErr, schemaInfo) => {
    if (schemaErr) return callback(schemaErr);

    const fields = filterWritableFields(paymentData, schemaInfo);
    const placeholders = fields.map(() => '?').join(', ');
    const values = fields.map((field) => paymentData[field]);
    const query = `
      INSERT INTO payments (${fields.join(', ')}, created_at)
      VALUES (${placeholders}, NOW())
    `;

    db.query(query, values, (err, result) => {
      if (err) return callback(err);
      callback(null, result);
    });
  });
};

const getPaymentById = (id, callback) => {
  return runPaymentQuery(
    (schemaInfo, appointmentServiceSchemaInfo) => `
      ${getPaymentSelect(schemaInfo, appointmentServiceSchemaInfo)}
      WHERE p.id = ?
      LIMIT 1
    `,
    [id],
    callback,
    true
  );
};

const getPaymentByReference = (paymentReference, callback) => {
  getPaymentSchemaInfo((schemaErr, schemaInfo) => {
    if (schemaErr) return callback(schemaErr);
    if (!schemaInfo.columns.has('payment_reference')) {
      return callback(null, null);
    }

    getAppointmentServiceSchemaInfo((appointmentSchemaErr, appointmentServiceSchemaInfo) => {
      if (appointmentSchemaErr) return callback(appointmentSchemaErr);

      const query = `
        ${getPaymentSelect(schemaInfo, appointmentServiceSchemaInfo)}
        WHERE p.payment_reference = ?
        LIMIT 1
      `;

      db.query(query, [paymentReference], (err, results) => {
        if (err) return callback(err);
        callback(null, results[0] || null);
      });
    });
  });
};

const getLatestPaymentByAppointmentId = (appointmentId, callback) => {
  return runPaymentQuery(
    (schemaInfo, appointmentServiceSchemaInfo) => `
      ${getPaymentSelect(schemaInfo, appointmentServiceSchemaInfo)}
      WHERE p.appointment_id = ?
      ORDER BY p.id DESC
      LIMIT 1
    `,
    [appointmentId],
    callback,
    true
  );
};

const updatePayment = (id, updateData, callback) => {
  getPaymentSchemaInfo((schemaErr, schemaInfo) => {
    if (schemaErr) return callback(schemaErr);

    const fields = filterWritableFields(updateData, schemaInfo);
    if (fields.length === 0) {
      return callback(null, { affectedRows: 0 });
    }

    const setClause = fields.map((field) => `${field} = ?`).join(', ');
    const values = fields.map((field) => updateData[field]);
    const query = `UPDATE payments SET ${setClause} WHERE id = ?`;

    db.query(query, [...values, id], (err, result) => {
      if (err) return callback(err);
      callback(null, result);
    });
  });
};

const updatePaymentIfStatus = (id, expectedStatus, updateData, callback) => {
  getPaymentSchemaInfo((schemaErr, schemaInfo) => {
    if (schemaErr) return callback(schemaErr);

    const fields = filterWritableFields(updateData, schemaInfo);
    if (fields.length === 0) {
      return callback(null, { affectedRows: 0 });
    }

    const setClause = fields.map((field) => `${field} = ?`).join(', ');
    const values = fields.map((field) => updateData[field]);
    const query = `
      UPDATE payments
      SET ${setClause}
      WHERE id = ?
        AND payment_status = ?
    `;

    db.query(query, [...values, id, expectedStatus], (err, result) => {
      if (err) return callback(err);
      callback(null, result);
    });
  });
};

const getAllPayments = (callback) => {
  return runPaymentQuery(
    (schemaInfo, appointmentServiceSchemaInfo) => `
      ${getPaymentSelect(schemaInfo, appointmentServiceSchemaInfo)}
      ORDER BY p.created_at DESC
    `,
    [],
    callback
  );
};

module.exports = {
  createPayment,
  getAllPayments,
  getLatestPaymentByAppointmentId,
  getPaymentById,
  getPaymentByReference,
  updatePayment,
  updatePaymentIfStatus
};
