USE booking_system;

-- Add users.is_active if missing
SET @has_users_is_active := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'is_active'
);
SET @sql_users_is_active := IF(
  @has_users_is_active = 0,
  'ALTER TABLE users ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1 AFTER role',
  'SELECT "users.is_active already exists"'
);
PREPARE stmt_users_is_active FROM @sql_users_is_active;
EXECUTE stmt_users_is_active;
DEALLOCATE PREPARE stmt_users_is_active;

-- Add appointments.staff_id if missing
SET @has_appointments_staff_id := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'appointments'
    AND COLUMN_NAME = 'staff_id'
);
SET @sql_appointments_staff_id := IF(
  @has_appointments_staff_id = 0,
  'ALTER TABLE appointments ADD COLUMN staff_id INT NULL AFTER service_id',
  'SELECT "appointments.staff_id already exists"'
);
PREPARE stmt_appointments_staff_id FROM @sql_appointments_staff_id;
EXECUTE stmt_appointments_staff_id;
DEALLOCATE PREPARE stmt_appointments_staff_id;

-- Add index for fast availability lookup
SET @has_staff_slot_index := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'appointments'
    AND INDEX_NAME = 'idx_appointments_staff_slot'
);
SET @sql_staff_slot_index := IF(
  @has_staff_slot_index = 0,
  'ALTER TABLE appointments ADD INDEX idx_appointments_staff_slot (staff_id, appointment_date, appointment_time, status)',
  'SELECT "idx_appointments_staff_slot already exists"'
);
PREPARE stmt_staff_slot_index FROM @sql_staff_slot_index;
EXECUTE stmt_staff_slot_index;
DEALLOCATE PREPARE stmt_staff_slot_index;

-- Add FK from appointments.staff_id -> users.id if missing
SET @has_staff_fk := (
  SELECT COUNT(*)
  FROM information_schema.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'appointments'
    AND COLUMN_NAME = 'staff_id'
    AND REFERENCED_TABLE_NAME = 'users'
);
SET @sql_staff_fk := IF(
  @has_staff_fk = 0,
  'ALTER TABLE appointments ADD CONSTRAINT fk_appointments_staff FOREIGN KEY (staff_id) REFERENCES users(id)',
  'SELECT "fk_appointments_staff already exists"'
);
PREPARE stmt_staff_fk FROM @sql_staff_fk;
EXECUTE stmt_staff_fk;
DEALLOCATE PREPARE stmt_staff_fk;

-- Add services.image_url if missing
SET @has_services_image_url := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'services'
    AND COLUMN_NAME = 'image_url'
);
SET @sql_services_image_url := IF(
  @has_services_image_url = 0,
  'ALTER TABLE services ADD COLUMN image_url VARCHAR(512) NULL AFTER category',
  'SELECT "services.image_url already exists"'
);
PREPARE stmt_services_image_url FROM @sql_services_image_url;
EXECUTE stmt_services_image_url;
DEALLOCATE PREPARE stmt_services_image_url;

-- Add appointments.staff_rating if missing
SET @has_appointments_staff_rating := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'appointments'
    AND COLUMN_NAME = 'staff_rating'
);
SET @sql_appointments_staff_rating := IF(
  @has_appointments_staff_rating = 0,
  'ALTER TABLE appointments ADD COLUMN staff_rating TINYINT UNSIGNED NULL AFTER total_amount',
  'SELECT "appointments.staff_rating already exists"'
);
PREPARE stmt_appointments_staff_rating FROM @sql_appointments_staff_rating;
EXECUTE stmt_appointments_staff_rating;
DEALLOCATE PREPARE stmt_appointments_staff_rating;

-- Add appointments.staff_review if missing
SET @has_appointments_staff_review := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'appointments'
    AND COLUMN_NAME = 'staff_review'
);
SET @sql_appointments_staff_review := IF(
  @has_appointments_staff_review = 0,
  'ALTER TABLE appointments ADD COLUMN staff_review TEXT NULL AFTER staff_rating',
  'SELECT "appointments.staff_review already exists"'
);
PREPARE stmt_appointments_staff_review FROM @sql_appointments_staff_review;
EXECUTE stmt_appointments_staff_review;
DEALLOCATE PREPARE stmt_appointments_staff_review;

-- Add appointments.reviewed_at if missing
SET @has_appointments_reviewed_at := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'appointments'
    AND COLUMN_NAME = 'reviewed_at'
);
SET @sql_appointments_reviewed_at := IF(
  @has_appointments_reviewed_at = 0,
  'ALTER TABLE appointments ADD COLUMN reviewed_at TIMESTAMP NULL AFTER staff_review',
  'SELECT "appointments.reviewed_at already exists"'
);
PREPARE stmt_appointments_reviewed_at FROM @sql_appointments_reviewed_at;
EXECUTE stmt_appointments_reviewed_at;
DEALLOCATE PREPARE stmt_appointments_reviewed_at;
