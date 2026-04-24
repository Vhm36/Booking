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

const getAppointmentServiceSelectFragment = (hasAppointmentServicesTable) => {
  if (!hasAppointmentServicesTable) {
    return [
      's.name AS service_name',
      'COALESCE(a.total_amount, s.price) AS service_price',
      's.duration AS duration',
      '1 AS service_count'
    ].join(',\n    ');
  }

  return [
    'COALESCE(service_summary.service_names, s.name) AS service_name',
    'COALESCE(service_summary.total_price, a.total_amount, s.price) AS service_price',
    'COALESCE(service_summary.total_duration, s.duration) AS duration',
    'COALESCE(service_summary.service_count, 1) AS service_count'
  ].join(',\n    ');
};

const getPaymentSelectFragment = (schemaInfo) => {
  const { columns } = schemaInfo;

  return [
    'latest_payment.id AS payment_id',
    'latest_payment.amount AS payment_amount',
    'latest_payment.payment_method',
    'latest_payment.payment_status',
    columns.has('payment_reference') ? 'latest_payment.payment_reference' : 'NULL AS payment_reference',
    'latest_payment.transaction_code AS payment_transaction_code',
    columns.has('bank_code') ? 'latest_payment.bank_code AS payment_bank_code' : 'NULL AS payment_bank_code',
    columns.has('gateway_response_code')
      ? 'latest_payment.gateway_response_code'
      : 'NULL AS gateway_response_code',
    columns.has('gateway_transaction_status')
      ? 'latest_payment.gateway_transaction_status'
      : 'NULL AS gateway_transaction_status',
    columns.has('payment_url_expires_at')
      ? 'latest_payment.payment_url_expires_at'
      : 'NULL AS payment_url_expires_at',
    'latest_payment.created_at AS payment_created_at',
    'latest_payment.paid_at AS payment_paid_at'
  ].join(',\n    ');
};

const buildAppointmentSelect = (schemaInfo, appointmentServiceSchemaInfo) => `
  SELECT
    a.*,
    u.name AS customer_name,
    u.email AS customer_email,
    u.phone AS customer_phone,
    ${getAppointmentServiceSelectFragment(appointmentServiceSchemaInfo.hasAppointmentServicesTable)},
    st.name AS staff_name,
    ${getPaymentSelectFragment(schemaInfo)}
  FROM appointments a
  JOIN users u ON a.user_id = u.id
  JOIN services s ON a.service_id = s.id
  ${appointmentServiceSchemaInfo.hasAppointmentServicesTable ? getAppointmentServiceSummaryJoin('a', 'service_summary') : ''}
  LEFT JOIN users st ON a.staff_id = st.id
  LEFT JOIN (
    SELECT p1.*
    FROM payments p1
    INNER JOIN (
      SELECT appointment_id, MAX(id) AS latest_payment_id
      FROM payments
      GROUP BY appointment_id
    ) latest
      ON latest.latest_payment_id = p1.id
  ) latest_payment ON latest_payment.appointment_id = a.id
`;

const runAppointmentQuery = (queryTail, params, callback, pickOne = false) => {
  getPaymentSchemaInfo((schemaErr, schemaInfo) => {
    if (schemaErr) return callback(schemaErr);

    getAppointmentServiceSchemaInfo((appointmentSchemaErr, appointmentServiceSchemaInfo) => {
      if (appointmentSchemaErr) return callback(appointmentSchemaErr);

      const query = `
        ${buildAppointmentSelect(schemaInfo, appointmentServiceSchemaInfo)}
        ${queryTail}
      `;

      db.query(query, params, (err, results) => {
        if (err) return callback(err);
        callback(null, pickOne ? results[0] : results);
      });
    });
  });
};

const createAppointment = (appointmentData, callback) => {
  const {
    user_id,
    service_id,
    staff_id,
    appointment_date,
    appointment_time,
    end_time,
    status,
    notes,
    total_amount,
    selected_services
  } = appointmentData;

  const query = `
    INSERT INTO appointments
      (user_id, service_id, staff_id, appointment_date, appointment_time, end_time, status, notes, total_amount, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
  `;
  const appointmentValues = [
    user_id,
    service_id,
    staff_id || null,
    appointment_date,
    appointment_time,
    end_time || null,
    status || 'pending',
    notes || '',
    total_amount
  ];
  const normalizedSelectedServices = Array.isArray(selected_services) ? selected_services : [];

  getAppointmentServiceSchemaInfo((schemaErr, appointmentServiceSchemaInfo) => {
    if (schemaErr) return callback(schemaErr);

    const shouldInsertServiceRows =
      appointmentServiceSchemaInfo.hasAppointmentServicesTable && normalizedSelectedServices.length > 0;

    if (!shouldInsertServiceRows) {
      return db.query(query, appointmentValues, (insertErr, result) => {
        if (insertErr) return callback(insertErr);
        return callback(null, result);
      });
    }

    db.beginTransaction((transactionErr) => {
      if (transactionErr) return callback(transactionErr);

      db.query(query, appointmentValues, (insertErr, result) => {
        if (insertErr) {
          return db.rollback(() => callback(insertErr));
        }

        const appointmentId = result.insertId;
        const serviceRows = normalizedSelectedServices.map((service, index) => [
          appointmentId,
          Number(service.id),
          index,
          Number(service.price) || 0,
          Number(service.duration) || 0,
          String(service.name || '').trim()
        ]);
        const serviceInsertQuery = `
          INSERT INTO appointment_services
            (appointment_id, service_id, sort_order, price_snapshot, duration_snapshot, service_name_snapshot)
          VALUES ?
        `;

        return db.query(serviceInsertQuery, [serviceRows], (serviceErr) => {
          if (serviceErr) {
            return db.rollback(() => callback(serviceErr));
          }

          return db.commit((commitErr) => {
            if (commitErr) {
              return db.rollback(() => callback(commitErr));
            }

            return callback(null, result);
          });
        });
      });
    });
  });
};

const getAllAppointments = (callback) => {
  return runAppointmentQuery('ORDER BY a.appointment_date DESC, a.appointment_time DESC', [], callback);
};

const getAppointmentsByStaffId = (staff_id, callback) => {
  return runAppointmentQuery(
    `
      WHERE a.staff_id = ?
      ORDER BY a.appointment_date DESC, a.appointment_time DESC
    `,
    [staff_id],
    callback
  );
};

const getAppointmentsByUserId = (user_id, callback) => {
  return runAppointmentQuery(
    `
      WHERE a.user_id = ?
      ORDER BY a.appointment_date DESC, a.appointment_time DESC
    `,
    [user_id],
    callback
  );
};

const getAppointmentById = (id, callback) => {
  return runAppointmentQuery(
    `
      WHERE a.id = ?
      LIMIT 1
    `,
    [id],
    callback,
    true
  );
};

const updateAppointmentStatus = (id, status, callback) => {
  const query = `
    UPDATE appointments
    SET status = ?,
        cancellation_requested = 0,
        cancellation_requested_at = NULL
    WHERE id = ?
  `;

  db.query(query, [status, id], (err, result) => {
    if (err) return callback(err);
    callback(null, result);
  });
};

const requestAppointmentCancellation = (id, callback) => {
  const query = `
    UPDATE appointments
    SET cancellation_requested = 1,
        cancellation_requested_at = NOW()
    WHERE id = ?
  `;

  db.query(query, [id], (err, result) => {
    if (err) return callback(err);
    callback(null, result);
  });
};

const clearAppointmentCancellationRequest = (id, callback) => {
  const query = `
    UPDATE appointments
    SET cancellation_requested = 0,
        cancellation_requested_at = NULL
    WHERE id = ?
  `;

  db.query(query, [id], (err, result) => {
    if (err) return callback(err);
    callback(null, result);
  });
};

const cancelAppointment = (id, callback) => {
  const query = `
    UPDATE appointments
    SET status = 'cancelled',
        cancellation_requested = 0,
        cancellation_requested_at = NULL
    WHERE id = ?
  `;

  db.query(query, [id], (err, result) => {
    if (err) return callback(err);
    callback(null, result);
  });
};

const addStaffReview = (id, user_id, staff_rating, staff_review, callback) => {
  const query = `
    UPDATE appointments
    SET staff_rating = ?, staff_review = ?, reviewed_at = NOW()
    WHERE id = ?
      AND user_id = ?
      AND status = 'completed'
      AND staff_id IS NOT NULL
      AND (staff_rating IS NULL)
  `;

  db.query(query, [staff_rating, staff_review || '', id, user_id], (err, result) => {
    if (err) return callback(err);
    callback(null, result);
  });
};

const checkTimeConflict = (staff_id, appointment_date, requested_start_time, requested_end_time, callback) => {
  getAppointmentServiceSchemaInfo((schemaErr, appointmentServiceSchemaInfo) => {
    if (schemaErr) return callback(schemaErr);

    const hasAppointmentServicesTable = appointmentServiceSchemaInfo.hasAppointmentServicesTable;
    const busyEndExpression = hasAppointmentServicesTable
      ? `
        COALESCE(
          a.end_time,
          ADDTIME(
            a.appointment_time,
            SEC_TO_TIME(COALESCE(service_summary.total_duration, booked_service.duration) * 60)
          )
        )
      `
      : `
        COALESCE(
          a.end_time,
          ADDTIME(a.appointment_time, SEC_TO_TIME(booked_service.duration * 60))
        )
      `;
    const bookedServiceNameExpression = hasAppointmentServicesTable
      ? 'COALESCE(service_summary.service_names, booked_service.name)'
      : 'booked_service.name';
    const conflictQuery = `
      SELECT
        a.id,
        a.appointment_time AS busy_start_time,
        ${busyEndExpression} AS busy_end_time,
        ${bookedServiceNameExpression} AS booked_service_name
      FROM appointments a
      JOIN services booked_service
        ON booked_service.id = a.service_id
      ${hasAppointmentServicesTable ? getAppointmentServiceSummaryJoin('a', 'service_summary') : ''}
      WHERE a.staff_id = ?
        AND a.appointment_date = ?
        AND a.status != 'cancelled'
        AND TIME(a.appointment_time) < TIME(?)
        AND TIME(${busyEndExpression}) > TIME(?)
      ORDER BY a.appointment_time ASC
      LIMIT 1
    `;

    db.query(
      conflictQuery,
      [staff_id, appointment_date, requested_end_time, requested_start_time],
      (err, results) => {
        if (err) return callback(err);
        callback(null, results[0] || null);
      }
    );
  });
};

module.exports = {
  createAppointment,
  getAllAppointments,
  getAppointmentsByStaffId,
  getAppointmentsByUserId,
  getAppointmentById,
  updateAppointmentStatus,
  requestAppointmentCancellation,
  clearAppointmentCancellationRequest,
  cancelAppointment,
  addStaffReview,
  checkTimeConflict
};
