USE booking_system;

-- Add appointments.cancellation_requested if missing
SET @has_appointments_cancellation_requested := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'appointments'
    AND COLUMN_NAME = 'cancellation_requested'
);
SET @sql_appointments_cancellation_requested := IF(
  @has_appointments_cancellation_requested = 0,
  'ALTER TABLE appointments ADD COLUMN cancellation_requested TINYINT(1) NOT NULL DEFAULT 0 AFTER status',
  'SELECT "appointments.cancellation_requested already exists"'
);
PREPARE stmt_appointments_cancellation_requested FROM @sql_appointments_cancellation_requested;
EXECUTE stmt_appointments_cancellation_requested;
DEALLOCATE PREPARE stmt_appointments_cancellation_requested;

-- Add appointments.cancellation_requested_at if missing
SET @has_appointments_cancellation_requested_at := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'appointments'
    AND COLUMN_NAME = 'cancellation_requested_at'
);
SET @sql_appointments_cancellation_requested_at := IF(
  @has_appointments_cancellation_requested_at = 0,
  'ALTER TABLE appointments ADD COLUMN cancellation_requested_at DATETIME NULL AFTER cancellation_requested',
  'SELECT "appointments.cancellation_requested_at already exists"'
);
PREPARE stmt_appointments_cancellation_requested_at FROM @sql_appointments_cancellation_requested_at;
EXECUTE stmt_appointments_cancellation_requested_at;
DEALLOCATE PREPARE stmt_appointments_cancellation_requested_at;