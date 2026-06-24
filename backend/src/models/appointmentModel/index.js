const db = require('../../config/db');
const { getPaymentSchemaInfo } = require('../../utils/paymentSchema');
const { getAppointmentServiceSchemaInfo } = require('../../utils/appointmentServiceSchema');
const {
  buildAppointmentLocksTimeCondition,
  buildAwaitingDepositCondition
} = require('../../utils/appointmentDeposit');

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
    `COALESCE((
      SELECT GROUP_CONCAT(
        COALESCE(aps.service_name_snapshot, service_item.name)
        ORDER BY aps.sort_order ASC SEPARATOR ', '
      )
      FROM appointment_services aps
      LEFT JOIN services service_item ON service_item.id = aps.service_id
      WHERE aps.appointment_id = a.id
    ), s.name) AS service_name`,
    `COALESCE((
      SELECT SUM(COALESCE(aps.price_snapshot, service_item.price, 0))
      FROM appointment_services aps
      LEFT JOIN services service_item ON service_item.id = aps.service_id
      WHERE aps.appointment_id = a.id
    ), a.total_amount, s.price) AS service_price`,
    `COALESCE((
      SELECT SUM(COALESCE(aps.duration_snapshot, service_item.duration, 0))
      FROM appointment_services aps
      LEFT JOIN services service_item ON service_item.id = aps.service_id
      WHERE aps.appointment_id = a.id
    ), s.duration) AS duration`,
    `COALESCE(NULLIF((
      SELECT COUNT(*)
      FROM appointment_services aps
      WHERE aps.appointment_id = a.id
    ), 0), 1) AS service_count`
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
    ${getPaymentSelectFragment(schemaInfo)},
    COALESCE(payment_summary.paid_amount, 0) AS paid_amount,
    LEAST(COALESCE(a.deposit_amount, 0), COALESCE(payment_summary.paid_amount, 0)) AS deposit_paid_amount,
    GREATEST(COALESCE(a.total_amount, 0) - COALESCE(payment_summary.paid_amount, 0), 0) AS remaining_amount,
    payment_summary.last_paid_at
  FROM appointments a
  JOIN users u ON a.user_id = u.id
  JOIN services s ON a.service_id = s.id
  LEFT JOIN users st ON a.staff_id = st.id
  LEFT JOIN payments latest_payment
    ON latest_payment.id = (
      SELECT MAX(payment_item.id)
      FROM payments payment_item
      WHERE payment_item.appointment_id = a.id
    )
  LEFT JOIN (
    SELECT
      appointment_id,
      COALESCE(SUM(CASE WHEN payment_status = 'paid' THEN amount ELSE 0 END), 0) AS paid_amount,
      MAX(CASE WHEN payment_status = 'paid' THEN paid_at ELSE NULL END) AS last_paid_at
    FROM payments
    GROUP BY appointment_id
  ) payment_summary ON payment_summary.appointment_id = a.id
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
    original_amount,
    voucher_discount,
    voucher_codes,
    cancellation_score,
    cancellation_risk,
    deposit_required,
    deposit_amount,
    selected_services
  } = appointmentData;

  const query = `
    INSERT INTO appointments
      (
        user_id,
        service_id,
        staff_id,
        appointment_date,
        appointment_time,
        end_time,
        status,
        notes,
        total_amount,
        original_amount,
        voucher_discount,
        voucher_codes,
        cancellation_score,
        cancellation_risk,
        deposit_required,
        deposit_amount,
        created_at
      )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
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
    total_amount,
    original_amount ?? total_amount,
    voucher_discount || 0,
    voucher_codes || null,
    typeof cancellation_score === 'number' ? cancellation_score : null,
    cancellation_risk || 'low',
    deposit_required ? 1 : 0,
    deposit_amount || 0
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

const getAppointmentsPage = (
  { staffId = null, status = 'all', dateFrom = '', dateTo = '', search = '', limit = 50, offset = 0 },
  callback
) => {
  const baseClauses = [];
  const baseParams = [];
  const normalizedSearch = String(search || '').trim();

  if (staffId) {
    baseClauses.push('a.staff_id = ?');
    baseParams.push(staffId);
  }
  if (dateFrom) {
    baseClauses.push('a.appointment_date >= ?');
    baseParams.push(dateFrom);
  }
  if (dateTo) {
    baseClauses.push('a.appointment_date <= ?');
    baseParams.push(dateTo);
  }
  if (normalizedSearch) {
    const pattern = `%${normalizedSearch}%`;
    baseClauses.push('(u.name LIKE ? OR u.email LIKE ? OR u.phone LIKE ? OR s.name LIKE ? OR st.name LIKE ?)');
    baseParams.push(pattern, pattern, pattern, pattern, pattern);
  }

  const awaitingDepositCondition = buildAwaitingDepositCondition('a');
  const statusClauseMap = {
    deposit_pending: `a.status != 'cancelled' AND ${awaitingDepositCondition}`,
    pending: `a.status = 'pending' AND COALESCE(a.cancellation_requested, 0) = 0 AND NOT ${awaitingDepositCondition}`,
    confirmed: "a.status = 'confirmed' AND COALESCE(a.cancellation_requested, 0) = 0",
    cancellation_requested: 'COALESCE(a.cancellation_requested, 0) = 1',
    completed: "a.status = 'completed'",
    cancelled: "a.status = 'cancelled'"
  };
  const filteredClauses = [...baseClauses];
  if (statusClauseMap[status]) {
    filteredClauses.push(statusClauseMap[status]);
  }

  const dataWhere = filteredClauses.length > 0 ? `WHERE ${filteredClauses.join(' AND ')}` : '';
  const statsWhere = baseClauses.length > 0 ? `WHERE ${baseClauses.join(' AND ')}` : '';
  let pageRows = null;
  let statsRows = null;
  let settled = false;

  const finish = (err) => {
    if (settled) return;
    if (err) {
      settled = true;
      callback(err);
      return;
    }
    if (!pageRows || !statsRows) return;

    settled = true;
    const stats = statsRows[0] || {};
    const normalizedStats = {
      total: Number(stats.total || 0),
      depositPending: Number(stats.deposit_pending || 0),
      pending: Number(stats.pending || 0),
      confirmed: Number(stats.confirmed || 0),
      cancellationRequested: Number(stats.cancellation_requested || 0),
      completed: Number(stats.completed || 0),
      cancelled: Number(stats.cancelled || 0)
    };
    const totalByStatus = {
      deposit_pending: normalizedStats.depositPending,
      pending: normalizedStats.pending,
      confirmed: normalizedStats.confirmed,
      cancellation_requested: normalizedStats.cancellationRequested,
      completed: normalizedStats.completed,
      cancelled: normalizedStats.cancelled
    };

    callback(null, {
      appointments: pageRows,
      stats: normalizedStats,
      total: status === 'all' ? normalizedStats.total : Number(totalByStatus[status] || 0)
    });
  };

  runAppointmentQuery(
    `${dataWhere} ORDER BY a.appointment_date DESC, a.appointment_time DESC LIMIT ? OFFSET ?`,
    [...baseParams, limit, offset],
    (err, rows) => {
      if (err) return finish(err);
      pageRows = rows;
      finish();
    }
  );

  db.query(
    `
      SELECT
        COUNT(*) AS total,
        SUM(a.status != 'cancelled' AND ${awaitingDepositCondition}) AS deposit_pending,
        SUM(a.status = 'pending' AND COALESCE(a.cancellation_requested, 0) = 0 AND NOT ${awaitingDepositCondition}) AS pending,
        SUM(a.status = 'confirmed' AND COALESCE(a.cancellation_requested, 0) = 0) AS confirmed,
        SUM(COALESCE(a.cancellation_requested, 0) = 1) AS cancellation_requested,
        SUM(a.status = 'completed') AS completed,
        SUM(a.status = 'cancelled') AS cancelled
      FROM appointments a
      JOIN users u ON u.id = a.user_id
      JOIN services s ON s.id = a.service_id
      LEFT JOIN users st ON st.id = a.staff_id
      ${statsWhere}
    `,
    baseParams,
    (err, rows) => {
      if (err) return finish(err);
      statsRows = rows;
      finish();
    }
  );
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

const updateAppointmentStatus = (id, status, callback, cancelReason = null) => {
  let query = `
    UPDATE appointments
    SET status = ?,
        cancellation_requested = 0,
        cancellation_requested_at = NULL
  `;
  const params = [status];

  if (cancelReason && status === 'cancelled') {
    query += `, notes = CONCAT(COALESCE(notes, ''), '\n[Lý do hủy từ nhân viên]: ', ?) `;
    params.push(cancelReason);
  }

  query += ` WHERE id = ?`;
  params.push(id);

  db.query(query, params, (err, result) => {
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
        AND ${buildAppointmentLocksTimeCondition('a')}
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

const refreshCustomerCancellationRate = (userId, callback) => {
  const query = `
    UPDATE users u
    LEFT JOIN (
      SELECT
        user_id,
        COUNT(*) AS total_bookings,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled_bookings
      FROM appointments
      WHERE user_id = ?
      GROUP BY user_id
    ) stats ON stats.user_id = u.id
    SET
      u.cancellation_count = COALESCE(stats.cancelled_bookings, 0),
      u.cancellation_rate = CASE
        WHEN COALESCE(stats.total_bookings, 0) = 0 THEN 0
        ELSE LEAST(100, GREATEST(0, ROUND(COALESCE(stats.cancelled_bookings, 0) * 100.0 / stats.total_bookings, 2)))
      END
    WHERE u.id = ?
      AND u.role = 'customer'
  `;

  db.query(query, [userId, userId], (err, result) => {
    if (err) return callback(err);
    callback(null, result);
  });
};

const refreshCustomerCancellationCount = refreshCustomerCancellationRate;

module.exports = {
  createAppointment,
  getAllAppointments,
  getAppointmentsPage,
  getAppointmentsByStaffId,
  getAppointmentsByUserId,
  getAppointmentById,
  updateAppointmentStatus,
  requestAppointmentCancellation,
  clearAppointmentCancellationRequest,
  cancelAppointment,
  refreshCustomerCancellationRate,
  refreshCustomerCancellationCount,
  addStaffReview,
  checkTimeConflict
};
