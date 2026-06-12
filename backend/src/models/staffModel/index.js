const db = require('../../config/db');
const { getAppointmentServiceSchemaInfo } = require('../../utils/appointmentServiceSchema');

const DEFAULT_MAX_DAILY_STAFF_MINUTES = 8 * 60;

const getMaxDailyStaffMinutes = () => {
  const configuredMinutes = Number(process.env.STAFF_MAX_DAILY_MINUTES);
  if (Number.isFinite(configuredMinutes) && configuredMinutes > 0) {
    return Math.round(configuredMinutes);
  }

  const configuredHours = Number(process.env.STAFF_MAX_DAILY_HOURS);
  if (Number.isFinite(configuredHours) && configuredHours > 0) {
    return Math.round(configuredHours * 60);
  }

  return DEFAULT_MAX_DAILY_STAFF_MINUTES;
};

let staffWeeklyAvailabilityReady = false;
let staffWeeklyAvailabilityCallbacks = [];
let staffWeeklyAvailabilityChecking = false;

const backfillDefaultStaffWeeklyAvailability = (callback) => {
  const query = `
    INSERT INTO staff_weekly_availability (staff_id, day_of_week, start_time, end_time)
    SELECT
      u.id,
      d.day_of_week,
      CASE WHEN d.day_of_week BETWEEN 0 AND 4 THEN '08:00:00' ELSE '07:00:00' END,
      CASE WHEN d.day_of_week BETWEEN 0 AND 4 THEN '16:00:00' ELSE '15:00:00' END
    FROM users u
    JOIN (
      SELECT 0 AS day_of_week UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3
      UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6
    ) d
    WHERE u.role = 'staff'
      AND NOT EXISTS (
        SELECT 1
        FROM staff_weekly_availability swa
        WHERE swa.staff_id = u.id
          AND swa.day_of_week = d.day_of_week
      )
  `;

  return db.query(query, callback);
};

const ensureStaffWeeklyAvailabilityTable = (callback) => {
  if (staffWeeklyAvailabilityReady) {
    return callback(null);
  }

  staffWeeklyAvailabilityCallbacks.push(callback);

  if (staffWeeklyAvailabilityChecking) {
    return undefined;
  }

  staffWeeklyAvailabilityChecking = true;
  const query = `
    CREATE TABLE IF NOT EXISTS staff_weekly_availability (
      id INT AUTO_INCREMENT PRIMARY KEY,
      staff_id INT NOT NULL,
      day_of_week TINYINT NOT NULL COMMENT '0=Monday ... 6=Sunday (matches MySQL WEEKDAY)',
      start_time TIME NOT NULL,
      end_time TIME NOT NULL,
      INDEX idx_staff_week (staff_id, day_of_week),
      CONSTRAINT fk_swa_staff_auto FOREIGN KEY (staff_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `;

  const finish = (err) => {
    staffWeeklyAvailabilityReady = !err;
    staffWeeklyAvailabilityChecking = false;
    const callbacks = staffWeeklyAvailabilityCallbacks;
    staffWeeklyAvailabilityCallbacks = [];
    callbacks.forEach((queuedCallback) => queuedCallback(err));
  };

  return db.query(query, (err) => {
    if (err) {
      return finish(err);
    }

    return backfillDefaultStaffWeeklyAvailability(finish);
  });
};

let staffLeaveRequestsReady = false;
let staffLeaveRequestsCallbacks = [];
let staffLeaveRequestsChecking = false;

const ensureStaffLeaveRequestsTable = (callback) => {
  if (staffLeaveRequestsReady) {
    return callback(null);
  }

  staffLeaveRequestsCallbacks.push(callback);

  if (staffLeaveRequestsChecking) {
    return undefined;
  }

  staffLeaveRequestsChecking = true;
  const query = `
    CREATE TABLE IF NOT EXISTS staff_leave_requests (
      id INT AUTO_INCREMENT PRIMARY KEY,
      staff_id INT NOT NULL,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      reason TEXT NOT NULL,
      status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_slr_staff_auto FOREIGN KEY (staff_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `;

  return db.query(query, (err) => {
    staffLeaveRequestsReady = !err;
    staffLeaveRequestsChecking = false;
    const callbacks = staffLeaveRequestsCallbacks;
    staffLeaveRequestsCallbacks = [];
    callbacks.forEach((queuedCallback) => queuedCallback(err));
  });
};

const ensureStaffSchedulingTables = (callback) => {
  ensureStaffWeeklyAvailabilityTable((weeklyErr) => {
    if (weeklyErr) return callback(weeklyErr);
    return ensureStaffLeaveRequestsTable(callback);
  });
};

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

const getAppointmentConflictExpressions = (
  hasAppointmentServicesTable,
  appointmentAlias = 'a',
  serviceAlias = 'booked_service',
  summaryAlias = 'service_summary'
) => {
  if (!hasAppointmentServicesTable) {
    return {
      summaryJoin: '',
      busyEndExpression: `
        COALESCE(
          ${appointmentAlias}.end_time,
          ADDTIME(${appointmentAlias}.appointment_time, SEC_TO_TIME(${serviceAlias}.duration * 60))
        )
      `,
      bookedServiceNameExpression: `${serviceAlias}.name`
    };
  }

  return {
    summaryJoin: appointmentServiceSummaryJoin(appointmentAlias, summaryAlias),
    busyEndExpression: `
      COALESCE(
        ${appointmentAlias}.end_time,
        ADDTIME(
          ${appointmentAlias}.appointment_time,
          SEC_TO_TIME(COALESCE(${summaryAlias}.total_duration, ${serviceAlias}.duration) * 60)
        )
      )
    `,
    bookedServiceNameExpression: `COALESCE(${summaryAlias}.service_names, ${serviceAlias}.name)`
  };
};

const getAllStaff = (callback) => {
  const query = `
    SELECT
      u.id,
      u.name,
      u.email,
      u.phone,
      u.role,
      u.staff_role_id,
      CASE
        WHEN u.role = 'admin' THEN 'Quản lý'
        ELSE sr.role_name
      END AS role_name,
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
            THEN a.total_amount * 0.4
            ELSE 0
          END
        ),
        0
      ) AS monthly_commission,
      COALESCE(AVG(a.staff_rating), 0) AS avg_rating,
      COUNT(a.staff_rating) AS review_count,
      (
        SELECT COALESCE(SUM(COALESCE(service_summary.total_duration, s_main.duration, 0)), 0)
        FROM appointments ap
        LEFT JOIN services s_main ON s_main.id = ap.service_id
        LEFT JOIN (
          SELECT aps.appointment_id, SUM(COALESCE(aps.duration_snapshot, s2.duration, 0)) AS total_duration
          FROM appointment_services aps
          LEFT JOIN services s2 ON s2.id = aps.service_id
          GROUP BY aps.appointment_id
        ) service_summary ON service_summary.appointment_id = ap.id
        WHERE ap.staff_id = u.id
          AND ap.status = 'completed'
          AND YEAR(ap.appointment_date) = YEAR(CURDATE())
          AND MONTH(ap.appointment_date) = MONTH(CURDATE())
      ) AS monthly_minutes
    FROM users u
    LEFT JOIN staff_role sr
      ON sr.id = u.staff_role_id
    LEFT JOIN appointments a
      ON a.staff_id = u.id
      AND a.status != 'cancelled'
    WHERE u.role IN ('staff', 'admin')
    GROUP BY u.id, u.name, u.email, u.phone, u.role, u.staff_role_id, sr.role_name, u.is_active, u.created_at
    ORDER BY FIELD(u.role, 'admin', 'staff'), u.is_active DESC, u.name ASC
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

const getStaffOrAdminById = (id, callback) => {
  const query = `
    SELECT
      u.id,
      u.name,
      u.email,
      u.phone,
      u.role,
      u.staff_role_id,
      u.is_active,
      u.created_at,
      CASE
        WHEN u.role = 'admin' THEN 'Quản lý'
        ELSE sr.role_name
      END AS role_name
    FROM users u
    LEFT JOIN staff_role sr ON sr.id = u.staff_role_id
    WHERE u.id = ? AND u.role IN ('staff', 'admin')
    LIMIT 1
  `;

  db.query(query, [id], (err, results) => {
    if (err) return callback(err);
    callback(null, results[0] || null);
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
      ensureStaffWeeklyAvailabilityTable((scheduleErr) => {
        if (scheduleErr) return callback(scheduleErr);

        return backfillDefaultStaffWeeklyAvailability((backfillErr) => {
          if (backfillErr) return callback(backfillErr);
          return callback(null, result);
        });
      });
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

const getAvailableStaff = (
  appointmentDate,
  requestedStartTime,
  requestedEndTime,
  requestedDurationMinutes,
  callback
) => {
  if (typeof requestedDurationMinutes === 'function') {
    callback = requestedDurationMinutes;
    requestedDurationMinutes = 0;
  }

  ensureStaffSchedulingTables((scheduleTableErr) => {
    if (scheduleTableErr) return callback(scheduleTableErr);

    getAppointmentServiceSchemaInfo((schemaErr, appointmentServiceSchemaInfo) => {
    if (schemaErr) return callback(schemaErr);

    const { summaryJoin, busyEndExpression, bookedServiceNameExpression } =
      getAppointmentConflictExpressions(appointmentServiceSchemaInfo.hasAppointmentServicesTable);
    const {
      summaryJoin: dailySummaryJoin,
      busyEndExpression: dailyBusyEndExpression
    } = getAppointmentConflictExpressions(
      appointmentServiceSchemaInfo.hasAppointmentServicesTable,
      'daily_a',
      'daily_service',
      'daily_service_summary'
    );
    const maxDailyMinutes = getMaxDailyStaffMinutes();
    const requestedDuration = Number(requestedDurationMinutes || 0);

    const availableQuery = `
      SELECT u.id, u.name, u.email, u.phone
      FROM users u
      ${customerBookableStaffJoin}
      WHERE u.role = 'staff'
        AND u.is_active = 1
        ${customerBookableStaffRoleFilter}
        AND NOT EXISTS (
          SELECT 1
          FROM staff_leave_requests slr
          WHERE slr.staff_id = u.id
            AND slr.status = 'approved'
            AND ? BETWEEN slr.start_date AND slr.end_date
        )
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
        AND EXISTS (
          SELECT 1
          FROM staff_weekly_availability swa2
          WHERE swa2.staff_id = u.id
            AND swa2.day_of_week = WEEKDAY(?)
            AND TIME(?) >= swa2.start_time
            AND TIME(?) <= swa2.end_time
        )
        AND (
          ? <= 0
          OR (
            SELECT COALESCE(
              SUM(
                GREATEST(
                  0,
                  FLOOR(TIME_TO_SEC(TIMEDIFF(${dailyBusyEndExpression}, daily_a.appointment_time)) / 60)
                )
              ),
              0
            )
            FROM appointments daily_a
            JOIN services daily_service
              ON daily_service.id = daily_a.service_id
            ${dailySummaryJoin}
            WHERE daily_a.staff_id = u.id
              AND daily_a.appointment_date = ?
              AND daily_a.status != 'cancelled'
          ) + ? <= COALESCE(
            (
              SELECT MAX(FLOOR(TIME_TO_SEC(TIMEDIFF(swa_cap.end_time, swa_cap.start_time)) / 60))
              FROM staff_weekly_availability swa_cap
              WHERE swa_cap.staff_id = u.id
                AND swa_cap.day_of_week = WEEKDAY(?)
            ),
            ?
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
        appointmentDate,
        requestedEndTime,
        requestedStartTime,
        appointmentDate,
        requestedStartTime,
        requestedEndTime,
        requestedDuration,
        appointmentDate,
        requestedDuration,
        appointmentDate,
        maxDailyMinutes
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

const confirmPendingAppointmentsForStaff = (staffId, callback) => {
  getAppointmentServiceSchemaInfo((schemaErr, appointmentServiceSchemaInfo) => {
    if (schemaErr) return callback(schemaErr);

    const { summaryJoin, busyEndExpression, bookedServiceNameExpression } =
      getAppointmentConflictExpressions(appointmentServiceSchemaInfo.hasAppointmentServicesTable);
    const selectQuery = `
      SELECT
        a.id,
        a.user_id,
        a.staff_id,
        a.appointment_date,
        TIME_FORMAT(a.appointment_time, '%H:%i') AS appointment_time,
        TIME_FORMAT(${busyEndExpression}, '%H:%i') AS end_time,
        ${bookedServiceNameExpression} AS service_name,
        customer.name AS customer_name,
        customer.email AS customer_email,
        staff_user.name AS staff_name
      FROM appointments a
      JOIN users customer
        ON customer.id = a.user_id
      JOIN users staff_user
        ON staff_user.id = a.staff_id
      JOIN services booked_service
        ON booked_service.id = a.service_id
      ${summaryJoin}
      WHERE a.staff_id = ?
        AND a.status = 'pending'
        AND a.appointment_date >= CURDATE()
      ORDER BY a.appointment_date ASC, a.appointment_time ASC, a.id ASC
    `;

    return db.query(selectQuery, [staffId], (selectErr, appointments) => {
      if (selectErr) return callback(selectErr);

      const appointmentIds = (appointments || []).map((appointment) => Number(appointment.id)).filter(Boolean);
      if (appointmentIds.length === 0) {
        return callback(null, { affectedRows: 0, appointments: [] });
      }

      const updateQuery = `
        UPDATE appointments
        SET
          status = 'confirmed',
          cancellation_requested = 0,
          cancellation_requested_at = NULL
        WHERE staff_id = ?
          AND status = 'pending'
          AND id IN (?)
      `;

      return db.query(updateQuery, [staffId, appointmentIds], (updateErr, result) => {
        if (updateErr) return callback(updateErr);

        return callback(null, {
          affectedRows: Number(result.affectedRows || 0),
          appointments
        });
      });
    });
  });
};

const getStaffBookedMinutes = (staffId, appointmentDate, callback) => {
  getAppointmentServiceSchemaInfo((schemaErr, appointmentServiceSchemaInfo) => {
    if (schemaErr) return callback(schemaErr);

    const { summaryJoin, busyEndExpression } = getAppointmentConflictExpressions(
      appointmentServiceSchemaInfo.hasAppointmentServicesTable,
      'a',
      'booked_service',
      'service_summary'
    );
    const query = `
      SELECT COALESCE(
        SUM(
          GREATEST(
            0,
            FLOOR(TIME_TO_SEC(TIMEDIFF(${busyEndExpression}, a.appointment_time)) / 60)
          )
        ),
        0
      ) AS booked_minutes
      FROM appointments a
      JOIN services booked_service
        ON booked_service.id = a.service_id
      ${summaryJoin}
      WHERE a.staff_id = ?
        AND a.appointment_date = ?
        AND a.status != 'cancelled'
    `;

    db.query(query, [staffId, appointmentDate], (err, rows) => {
      if (err) return callback(err);
      callback(null, Number(rows[0]?.booked_minutes || 0));
    });
  });
};

const getStaffDailyCapacityMinutes = (staffId, appointmentDate, callback) => {
  const defaultMaxDailyMinutes = getMaxDailyStaffMinutes();

  ensureStaffWeeklyAvailabilityTable((schemaErr) => {
    if (schemaErr) return callback(schemaErr);

    const query = `
      SELECT MAX(FLOOR(TIME_TO_SEC(TIMEDIFF(end_time, start_time)) / 60)) AS capacity_minutes
      FROM staff_weekly_availability
      WHERE staff_id = ?
        AND day_of_week = WEEKDAY(?)
    `;

    return db.query(query, [staffId, appointmentDate], (err, rows) => {
      if (err) return callback(err);

      const scheduledMinutes = Number(rows[0]?.capacity_minutes || 0);
      return callback(null, scheduledMinutes > 0 ? scheduledMinutes : defaultMaxDailyMinutes);
    });
  });
};

const isWithinDailyCapacity = (staffId, appointmentDate, requestedDurationMinutes, callback) => {
  const requestedDuration = Number(requestedDurationMinutes || 0);
  const maxDailyMinutes = getMaxDailyStaffMinutes();

  if (requestedDuration <= 0) {
    return callback(null, {
      allowed: true,
      bookedMinutes: 0,
      requestedDuration: 0,
      maxDailyMinutes
    });
  }

  return getStaffDailyCapacityMinutes(staffId, appointmentDate, (capacityErr, staffDailyCapacityMinutes) => {
    if (capacityErr) return callback(capacityErr);

    return getStaffBookedMinutes(staffId, appointmentDate, (err, bookedMinutes) => {
      if (err) return callback(err);

      const projectedMinutes = bookedMinutes + requestedDuration;

      return callback(null, {
        allowed: projectedMinutes <= staffDailyCapacityMinutes,
        bookedMinutes,
        requestedDuration,
        projectedMinutes,
        maxDailyMinutes: staffDailyCapacityMinutes
      });
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
  ensureStaffWeeklyAvailabilityTable((schemaErr) => {
    if (schemaErr) return callback(schemaErr);

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
  });
};

const replaceWeeklyAvailability = (staffId, slots, callback) => {
  ensureStaffWeeklyAvailabilityTable((schemaErr) => {
    if (schemaErr) return callback(schemaErr);

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
  });
};

const isStaffAvailableForWeeklySchedule = (
  staffId,
  appointmentDate,
  requestedStartTime,
  requestedEndTime,
  callback
) => {
  ensureStaffSchedulingTables((schemaErr) => {
    if (schemaErr) return callback(schemaErr);

    const leaveQuery = `
      SELECT 1
      FROM staff_leave_requests
      WHERE staff_id = ?
        AND status = 'approved'
        AND ? BETWEEN start_date AND end_date
      LIMIT 1
    `;

    db.query(leaveQuery, [staffId, appointmentDate], (leaveErr, leaveRows) => {
      if (leaveErr) return callback(leaveErr);
      if (leaveRows.length > 0) {
        return callback(null, false);
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

      return db.query(query, [staffId, appointmentDate, requestedStartTime, requestedEndTime], (err, rows) => {
        if (err) return callback(err);
        return callback(null, rows.length > 0);
      });
    });
  });
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

const getAutoAssignableStaff = (
  appointmentDate,
  requestedStartTime,
  requestedEndTime,
  requestedDurationMinutes,
  callback
) => {
  if (typeof requestedDurationMinutes === 'function') {
    callback = requestedDurationMinutes;
    requestedDurationMinutes = 0;
  }

  getAvailableStaff(
    appointmentDate,
    requestedStartTime,
    requestedEndTime,
    requestedDurationMinutes,
    (err, result) => {
      if (err) return callback(err);

      const candidates = result.availableStaff || [];
      if (candidates.length === 0) {
        return callback(null, null);
      }

      const randomIndex = Math.floor(Math.random() * candidates.length);
      return callback(null, candidates[randomIndex]);
    }
  );
};

const createLeaveRequest = (staffId, startDate, endDate, reason, callback) => {
  ensureStaffLeaveRequestsTable((schemaErr) => {
    if (schemaErr) return callback(schemaErr);

    const query = `
      INSERT INTO staff_leave_requests (staff_id, start_date, end_date, reason)
      VALUES (?, ?, ?, ?)
    `;
    db.query(query, [staffId, startDate, endDate, reason], (err, result) => {
      if (err) return callback(err);
      callback(null, result);
    });
  });
};

const getLeaveRequestsByStaff = (staffId, callback) => {
  ensureStaffLeaveRequestsTable((schemaErr) => {
    if (schemaErr) return callback(schemaErr);

    const query = `
      SELECT id, start_date, end_date, reason, status, created_at
      FROM staff_leave_requests
      WHERE staff_id = ?
      ORDER BY created_at DESC
    `;
    db.query(query, [staffId], (err, results) => {
      if (err) return callback(err);
      callback(null, results);
    });
  });
};

const getAllLeaveRequests = (callback) => {
  ensureStaffLeaveRequestsTable((schemaErr) => {
    if (schemaErr) return callback(schemaErr);

    const query = `
      SELECT lr.id, lr.staff_id, u.name AS staff_name, lr.start_date, lr.end_date, lr.reason, lr.status, lr.created_at
      FROM staff_leave_requests lr
      JOIN users u ON u.id = lr.staff_id
      ORDER BY lr.created_at DESC
    `;
    db.query(query, (err, results) => {
      if (err) return callback(err);
      callback(null, results);
    });
  });
};

const updateLeaveRequestStatus = (id, status, callback) => {
  ensureStaffLeaveRequestsTable((schemaErr) => {
    if (schemaErr) return callback(schemaErr);

    const query = `
      UPDATE staff_leave_requests
      SET status = ?
      WHERE id = ?
    `;
    db.query(query, [status, id], (err, result) => {
      if (err) return callback(err);
      callback(null, result);
    });
  });
};

module.exports = {
  getAllStaff,
  getBookableStaff,
  getStaffById,
  getStaffOrAdminById,
  createStaff,
  updateStaff,
  getAvailableStaff,
  getAutoAssignableStaff,
  getMaxDailyStaffMinutes,
  getStaffBookedMinutes,
  isWithinDailyCapacity,
  getStaffRoleById,
  getAllStaffRoles,
  createStaffRole,
  getWeeklyAvailabilityByStaffId,
  replaceWeeklyAvailability,
  isStaffAvailableForWeeklySchedule,
  getBusyTimeSlots,
  confirmPendingAppointmentsForStaff,
  isStaffRoleExcludedFromCustomerBooking,
  getStaffRoleNameByUserId,
  createLeaveRequest,
  getLeaveRequestsByStaff,
  getAllLeaveRequests,
  updateLeaveRequestStatus
};
