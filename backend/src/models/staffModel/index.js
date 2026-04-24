const db = require('../../config/db');
const { getAppointmentServiceSchemaInfo } = require('../../utils/appointmentServiceSchema');

/** Vai trò không hiển thị / không được chọn khi khách đặt dịch vụ (so khớp không phân biệt hoa thường). */
const CUSTOMER_BOOKING_EXCLUDED_ROLE_NORMALIZED = 'thu ngân';

const customerBookableStaffJoin = `
  LEFT JOIN staff_role sr ON sr.id = u.staff_role_id
`;

const customerBookableStaffRoleFilter = `
  AND (
    sr.role_name IS NULL
    OR LOWER(TRIM(sr.role_name)) <> ?
  )
`;

const appointmentServiceSummaryJoin = (appointmentAlias = 'a', summaryAlias = 'service_summary') => `
  LEFT JOIN (
    SELECT
      aps.appointment_id,
      GROUP_CONCAT(
        COALESCE(aps.service_name_snapshot, s2.name)
        ORDER BY aps.sort_order ASC
        SEPARATOR ', '
      ) AS service_names,
      SUM(COALESCE(aps.duration_snapshot, s2.duration, 0)) AS total_duration
    FROM appointment_services aps
    LEFT JOIN services s2 ON s2.id = aps.service_id
    GROUP BY aps.appointment_id
  ) ${summaryAlias} ON ${summaryAlias}.appointment_id = ${appointmentAlias}.id
`;

const getAppointmentConflictExpressions = (hasAppointmentServicesTable) => {
  if (!hasAppointmentServicesTable) {
    return {
      summaryJoin: '',
      busyEndExpression: `
        COALESCE(
          a.end_time,
          ADDTIME(a.appointment_time, SEC_TO_TIME(booked_service.duration * 60))
        )
      `,
      bookedServiceNameExpression: 'booked_service.name'
    };
  }

  return {
    summaryJoin: appointmentServiceSummaryJoin('a', 'service_summary'),
    busyEndExpression: `
      COALESCE(
        a.end_time,
        ADDTIME(
          a.appointment_time,
          SEC_TO_TIME(COALESCE(service_summary.total_duration, booked_service.duration) * 60)
        )
      )
    `,
    bookedServiceNameExpression: 'COALESCE(service_summary.service_names, booked_service.name)'
  };
};

const getAllStaff = (callback) => {
  const query = `
    SELECT
      u.id,
      u.name,
      u.email,
      u.phone,
      u.staff_role_id,
      sr.role_name,
      u.is_active,
      u.created_at,
      COUNT(a.id) AS total_appointments,
      COALESCE(
        SUM(
          CASE
            WHEN a.status = 'completed'
              AND YEAR(a.appointment_date) = YEAR(CURDATE())
              AND MONTH(a.appointment_date) = MONTH(CURDATE())
            THEN a.total_amount
            ELSE 0
          END
        ),
        0
      ) AS monthly_revenue,
      COALESCE(
        SUM(
          CASE
            WHEN a.status = 'completed'
              AND YEAR(a.appointment_date) = YEAR(CURDATE())
              AND MONTH(a.appointment_date) = MONTH(CURDATE())
            THEN a.total_amount * 0.1
            ELSE 0
          END
        ),
        0
      ) AS monthly_commission
    FROM users u
    LEFT JOIN staff_role sr
      ON sr.id = u.staff_role_id
    LEFT JOIN appointments a
      ON a.staff_id = u.id
      AND a.status != 'cancelled'
    WHERE u.role = 'staff'
    GROUP BY u.id, u.name, u.email, u.phone, u.staff_role_id, sr.role_name, u.is_active, u.created_at
    ORDER BY u.is_active DESC, u.name ASC
  `;

  db.query(query, (err, results) => {
    if (err) return callback(err);
    callback(null, results);
  });
};

const getBookableStaff = (callback) => {
  const query = `
    SELECT u.id, u.name, u.email, u.phone
    FROM users u
    ${customerBookableStaffJoin}
    WHERE u.role = 'staff' AND u.is_active = 1
    ${customerBookableStaffRoleFilter}
    ORDER BY u.name ASC
  `;

  db.query(query, [CUSTOMER_BOOKING_EXCLUDED_ROLE_NORMALIZED], (err, results) => {
    if (err) return callback(err);
    callback(null, results);
  });
};

const getStaffById = (id, callback) => {
  const query = `
    SELECT u.id, u.name, u.email, u.phone, u.role, u.is_active, u.created_at, sr.role_name
    FROM users u
    LEFT JOIN staff_role sr ON sr.id = u.staff_role_id
    WHERE u.id = ? AND u.role = 'staff'
  `;

  db.query(query, [id], (err, results) => {
    if (err) return callback(err);
    callback(null, results[0]);
  });
};

const createStaff = (staffData, callback) => {
  const { name, email, password, phone, staff_role_id, is_active } = staffData;
  const query = `
    INSERT INTO users (name, email, password, phone, role, staff_role_id, is_active, created_at)
    VALUES (?, ?, ?, ?, 'staff', ?, ?, NOW())
  `;

  db.query(
    query,
    [name, email, password, phone || '', staff_role_id, is_active ? 1 : 0],
    (err, result) => {
      if (err) return callback(err);
      callback(null, result);
    }
  );
};

const getStaffRoleById = (id, callback) => {
  const query = `
    SELECT id, role_name
    FROM staff_role
    WHERE id = ?
    LIMIT 1
  `;

  db.query(query, [id], (err, results) => {
    if (err) return callback(err);
    callback(null, results[0] || null);
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

  if (typeof staffData.staff_role_id !== 'undefined') {
    fields.push('staff_role_id = ?');
    values.push(staffData.staff_role_id);
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

const getAvailableStaff = (appointmentDate, requestedStartTime, requestedEndTime, callback) => {
  getAppointmentServiceSchemaInfo((schemaErr, appointmentServiceSchemaInfo) => {
    if (schemaErr) return callback(schemaErr);

    const { summaryJoin, busyEndExpression, bookedServiceNameExpression } =
      getAppointmentConflictExpressions(appointmentServiceSchemaInfo.hasAppointmentServicesTable);

    const availableQuery = `
      SELECT u.id, u.name, u.email, u.phone
      FROM users u
      ${customerBookableStaffJoin}
      WHERE u.role = 'staff'
        AND u.is_active = 1
        ${customerBookableStaffRoleFilter}
        AND NOT EXISTS (
          SELECT 1
          FROM appointments a
          JOIN services booked_service
            ON booked_service.id = a.service_id
          ${summaryJoin}
          WHERE a.staff_id = u.id
            AND a.appointment_date = ?
            AND a.status != 'cancelled'
            AND TIME(a.appointment_time) < TIME(?)
            AND TIME(${busyEndExpression}) > TIME(?)
        )
        AND (
          (SELECT COUNT(*) FROM staff_weekly_availability swa WHERE swa.staff_id = u.id) = 0
          OR EXISTS (
            SELECT 1
            FROM staff_weekly_availability swa2
            WHERE swa2.staff_id = u.id
              AND swa2.day_of_week = WEEKDAY(?)
              AND TIME(?) >= swa2.start_time
              AND TIME(?) <= swa2.end_time
          )
        )
      ORDER BY u.name ASC
    `;

    const unavailableQuery = `
      SELECT
        u.id,
        u.name,
        u.email,
        u.phone,
        TIME_FORMAT(a.appointment_time, '%H:%i') AS busy_start_time,
        TIME_FORMAT(
          ${busyEndExpression},
          '%H:%i'
        ) AS busy_end_time,
        ${bookedServiceNameExpression} AS booked_service_name
      FROM users u
      ${customerBookableStaffJoin}
      JOIN appointments a
        ON a.staff_id = u.id
      JOIN services booked_service
        ON booked_service.id = a.service_id
      ${summaryJoin}
      WHERE u.role = 'staff'
        AND u.is_active = 1
        ${customerBookableStaffRoleFilter}
        AND a.appointment_date = ?
        AND a.status != 'cancelled'
        AND TIME(a.appointment_time) < TIME(?)
        AND TIME(${busyEndExpression}) > TIME(?)
      ORDER BY u.name ASC, a.appointment_time ASC
    `;

    db.query(
      availableQuery,
      [
        CUSTOMER_BOOKING_EXCLUDED_ROLE_NORMALIZED,
        appointmentDate,
        requestedEndTime,
        requestedStartTime,
        appointmentDate,
        requestedStartTime,
        requestedEndTime
      ],
      (availableErr, availableResults) => {
        if (availableErr) return callback(availableErr);

        db.query(
          unavailableQuery,
          [
            CUSTOMER_BOOKING_EXCLUDED_ROLE_NORMALIZED,
            appointmentDate,
            requestedEndTime,
            requestedStartTime
          ],
          (unavailableErr, unavailableResults) => {
            if (unavailableErr) return callback(unavailableErr);

            callback(null, {
              availableStaff: availableResults,
              unavailableStaff: unavailableResults
            });
          }
        );
      }
    );
  });
};

const getBusyTimeSlots = (staffId, appointmentDate, callback) => {
  getAppointmentServiceSchemaInfo((schemaErr, appointmentServiceSchemaInfo) => {
    if (schemaErr) return callback(schemaErr);

    const { summaryJoin, busyEndExpression, bookedServiceNameExpression } =
      getAppointmentConflictExpressions(appointmentServiceSchemaInfo.hasAppointmentServicesTable);
    const query = `
      SELECT
        a.id AS appointment_id,
        TIME_FORMAT(a.appointment_time, '%H:%i') AS busy_start_time,
        TIME_FORMAT(
          ${busyEndExpression},
          '%H:%i'
        ) AS busy_end_time,
        ${bookedServiceNameExpression} AS booked_service_name
      FROM appointments a
      JOIN services booked_service
        ON booked_service.id = a.service_id
      ${summaryJoin}
      WHERE a.staff_id = ?
        AND a.appointment_date = ?
        AND a.status != 'cancelled'
      ORDER BY a.appointment_time ASC
    `;

    db.query(query, [staffId, appointmentDate], (err, results) => {
      if (err) return callback(err);
      callback(null, results);
    });
  });
};

const isStaffRoleExcludedFromCustomerBooking = (roleName) => {
  const normalized = (roleName || '').trim().toLowerCase();
  return normalized === CUSTOMER_BOOKING_EXCLUDED_ROLE_NORMALIZED;
};

const getStaffRoleNameByUserId = (userId, callback) => {
  const query = `
    SELECT sr.role_name
    FROM users u
    LEFT JOIN staff_role sr ON sr.id = u.staff_role_id
    WHERE u.id = ? AND u.role = 'staff'
    LIMIT 1
  `;

  db.query(query, [userId], (err, rows) => {
    if (err) return callback(err);
    callback(null, rows[0]?.role_name || null);
  });
};

const getWeeklyAvailabilityByStaffId = (staffId, callback) => {
  const query = `
    SELECT id, staff_id, day_of_week, start_time, end_time
    FROM staff_weekly_availability
    WHERE staff_id = ?
    ORDER BY day_of_week ASC, start_time ASC
  `;

  db.query(query, [staffId], (err, results) => {
    if (err) return callback(err);
    callback(null, results);
  });
};

const replaceWeeklyAvailability = (staffId, slots, callback) => {
  db.query('DELETE FROM staff_weekly_availability WHERE staff_id = ?', [staffId], (delErr) => {
    if (delErr) return callback(delErr);
    if (!slots || slots.length === 0) {
      return callback(null, { affectedRows: 0 });
    }

    const values = slots.map((row) => [staffId, row.day_of_week, row.start_time, row.end_time]);
    const insertSql = `
      INSERT INTO staff_weekly_availability (staff_id, day_of_week, start_time, end_time)
      VALUES ?
    `;

    db.query(insertSql, [values], (insErr, result) => {
      if (insErr) return callback(insErr);
      callback(null, result);
    });
  });
};

const isStaffAvailableForWeeklySchedule = (
  staffId,
  appointmentDate,
  requestedStartTime,
  requestedEndTime,
  callback
) => {
  db.query(
    'SELECT COUNT(*) AS c FROM staff_weekly_availability WHERE staff_id = ?',
    [staffId],
    (countErr, countRows) => {
      if (countErr) return callback(countErr);
      if (!countRows[0] || Number(countRows[0].c) === 0) {
        return callback(null, true);
      }

      const query = `
        SELECT 1
        FROM staff_weekly_availability
        WHERE staff_id = ?
          AND day_of_week = WEEKDAY(?)
          AND TIME(?) >= start_time
          AND TIME(?) <= end_time
        LIMIT 1
      `;

      db.query(query, [staffId, appointmentDate, requestedStartTime, requestedEndTime], (err, rows) => {
        if (err) return callback(err);
        callback(null, rows.length > 0);
      });
    }
  );
};

const getAllStaffRoles = (callback) => {
  const query = `
    SELECT id, role_name
    FROM staff_role
    ORDER BY id ASC
  `;

  db.query(query, (err, results) => {
    if (err) return callback(err);
    callback(null, results);
  });
};

const createStaffRole = (roleName, callback) => {
  const query = `
    INSERT INTO staff_role (id, role_name)
    SELECT COALESCE(MAX(id), -1) + 1, ?
    FROM staff_role
  `;

  db.query(query, [roleName], (err, result) => {
    if (err) return callback(err);
    callback(null, result);
  });
};

const getAutoAssignableStaff = (appointmentDate, requestedStartTime, requestedEndTime, callback) => {
  getAvailableStaff(appointmentDate, requestedStartTime, requestedEndTime, (err, result) => {
    if (err) return callback(err);

    const candidates = result.availableStaff || [];
    if (candidates.length === 0) {
      return callback(null, null);
    }

    const randomIndex = Math.floor(Math.random() * candidates.length);
    return callback(null, candidates[randomIndex]);
  });
};

module.exports = {
  getAllStaff,
  getBookableStaff,
  getStaffById,
  createStaff,
  updateStaff,
  getAvailableStaff,
  getAutoAssignableStaff,
  getStaffRoleById,
  getAllStaffRoles,
  createStaffRole,
  getWeeklyAvailabilityByStaffId,
  replaceWeeklyAvailability,
  isStaffAvailableForWeeklySchedule,
  getBusyTimeSlots,
  isStaffRoleExcludedFromCustomerBooking,
  getStaffRoleNameByUserId
};
