USE booking_system;
SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS staff_role (
  id INT AUTO_INCREMENT PRIMARY KEY,
  role_name VARCHAR(100) NOT NULL UNIQUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS service_category (
  id INT AUTO_INCREMENT PRIMARY KEY,
  category_name VARCHAR(100) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS staff_weekly_availability (
  id INT AUTO_INCREMENT PRIMARY KEY,
  staff_id INT NOT NULL,
  day_of_week TINYINT NOT NULL COMMENT '0=Monday ... 6=Sunday (matches MySQL WEEKDAY)',
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  INDEX idx_staff_week (staff_id, day_of_week),
  CONSTRAINT fk_swa_staff FOREIGN KEY (staff_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO staff_role (role_name)
VALUES
  ('Kỹ thuật viên'),
  ('Thu ngân');

INSERT IGNORE INTO service_category (category_name)
VALUES
  ('Tóc'),
  ('Móng'),
  ('Chăm sóc da'),
  ('Massage'),
  ('Mi & Mày'),
  ('Trang điểm');

SET @has_users_staff_role_id := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'staff_role_id'
);
SET @sql_users_staff_role_id := IF(
  @has_users_staff_role_id = 0,
  'ALTER TABLE users ADD COLUMN staff_role_id INT NULL AFTER role',
  'SELECT "users.staff_role_id already exists"'
);
PREPARE stmt_users_staff_role_id FROM @sql_users_staff_role_id;
EXECUTE stmt_users_staff_role_id;
DEALLOCATE PREPARE stmt_users_staff_role_id;

SET @has_users_staff_role_idx := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND INDEX_NAME = 'idx_users_staff_role_id'
);
SET @sql_users_staff_role_idx := IF(
  @has_users_staff_role_idx = 0,
  'ALTER TABLE users ADD INDEX idx_users_staff_role_id (staff_role_id)',
  'SELECT "idx_users_staff_role_id already exists"'
);
PREPARE stmt_users_staff_role_idx FROM @sql_users_staff_role_idx;
EXECUTE stmt_users_staff_role_idx;
DEALLOCATE PREPARE stmt_users_staff_role_idx;

SET @has_users_staff_role_fk := (
  SELECT COUNT(*)
  FROM information_schema.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'staff_role_id'
    AND REFERENCED_TABLE_NAME = 'staff_role'
);
SET @sql_users_staff_role_fk := IF(
  @has_users_staff_role_fk = 0,
  'ALTER TABLE users ADD CONSTRAINT fk_users_staff_role FOREIGN KEY (staff_role_id) REFERENCES staff_role(id)',
  'SELECT "fk_users_staff_role already exists"'
);
PREPARE stmt_users_staff_role_fk FROM @sql_users_staff_role_fk;
EXECUTE stmt_users_staff_role_fk;
DEALLOCATE PREPARE stmt_users_staff_role_fk;

SET @has_appointments_end_time := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'appointments'
    AND COLUMN_NAME = 'end_time'
);
SET @sql_appointments_end_time := IF(
  @has_appointments_end_time = 0,
  'ALTER TABLE appointments ADD COLUMN end_time TIME NULL AFTER appointment_time',
  'SELECT "appointments.end_time already exists"'
);
PREPARE stmt_appointments_end_time FROM @sql_appointments_end_time;
EXECUTE stmt_appointments_end_time;
DEALLOCATE PREPARE stmt_appointments_end_time;

UPDATE appointments a
JOIN services s ON s.id = a.service_id
SET a.end_time = ADDTIME(a.appointment_time, SEC_TO_TIME(s.duration * 60))
WHERE a.end_time IS NULL;

SET @has_payments_transaction_code := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'payments'
    AND COLUMN_NAME = 'transaction_code'
);
SET @sql_payments_transaction_code := IF(
  @has_payments_transaction_code = 0,
  'ALTER TABLE payments ADD COLUMN transaction_code VARCHAR(255) NULL AFTER payment_status',
  'SELECT "payments.transaction_code already exists"'
);
PREPARE stmt_payments_transaction_code FROM @sql_payments_transaction_code;
EXECUTE stmt_payments_transaction_code;
DEALLOCATE PREPARE stmt_payments_transaction_code;

SET @has_payments_created_at := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'payments'
    AND COLUMN_NAME = 'created_at'
);
SET @sql_payments_created_at := IF(
  @has_payments_created_at = 0,
  'ALTER TABLE payments ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP AFTER transaction_code',
  'SELECT "payments.created_at already exists"'
);
PREPARE stmt_payments_created_at FROM @sql_payments_created_at;
EXECUTE stmt_payments_created_at;
DEALLOCATE PREPARE stmt_payments_created_at;

ALTER TABLE payments
  MODIFY COLUMN payment_method ENUM('cash', 'banking', 'momo', 'vnpay') DEFAULT 'cash',
  MODIFY COLUMN payment_status ENUM('pending', 'paid', 'failed') DEFAULT 'pending';
