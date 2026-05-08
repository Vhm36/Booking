USE booking_system;
SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;

SET @has_appointments_original_amount := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'appointments'
    AND COLUMN_NAME = 'original_amount'
);
SET @sql_appointments_original_amount := IF(
  @has_appointments_original_amount = 0,
  'ALTER TABLE appointments ADD COLUMN original_amount DECIMAL(10,2) NULL AFTER total_amount',
  'SELECT "appointments.original_amount already exists"'
);
PREPARE stmt_appointments_original_amount FROM @sql_appointments_original_amount;
EXECUTE stmt_appointments_original_amount;
DEALLOCATE PREPARE stmt_appointments_original_amount;

SET @has_appointments_voucher_discount := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'appointments'
    AND COLUMN_NAME = 'voucher_discount'
);
SET @sql_appointments_voucher_discount := IF(
  @has_appointments_voucher_discount = 0,
  'ALTER TABLE appointments ADD COLUMN voucher_discount DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER original_amount',
  'SELECT "appointments.voucher_discount already exists"'
);
PREPARE stmt_appointments_voucher_discount FROM @sql_appointments_voucher_discount;
EXECUTE stmt_appointments_voucher_discount;
DEALLOCATE PREPARE stmt_appointments_voucher_discount;

SET @has_appointments_voucher_codes := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'appointments'
    AND COLUMN_NAME = 'voucher_codes'
);
SET @sql_appointments_voucher_codes := IF(
  @has_appointments_voucher_codes = 0,
  'ALTER TABLE appointments ADD COLUMN voucher_codes VARCHAR(255) NULL AFTER voucher_discount',
  'SELECT "appointments.voucher_codes already exists"'
);
PREPARE stmt_appointments_voucher_codes FROM @sql_appointments_voucher_codes;
EXECUTE stmt_appointments_voucher_codes;
DEALLOCATE PREPARE stmt_appointments_voucher_codes;

CREATE TABLE IF NOT EXISTS vouchers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(50) NOT NULL UNIQUE,
  voucher_type ENUM('fixed', 'percentage', 'free_delivery') NOT NULL,
  discount_amount DECIMAL(10,2) NULL,
  discount_percent INT NULL,
  min_order_value DECIMAL(10,2) NOT NULL DEFAULT 0,
  max_discount_amount DECIMAL(10,2) NULL,
  customer_type ENUM('regular', 'vip', 'both') NOT NULL DEFAULT 'both',
  description TEXT NULL,
  issued_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expiry_date DATETIME NOT NULL,
  max_usage_global INT NULL,
  current_usage INT NOT NULL DEFAULT 0,
  status ENUM('active', 'inactive', 'expired') NOT NULL DEFAULT 'active',
  created_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_vouchers_code (code),
  INDEX idx_vouchers_customer_type (customer_type),
  INDEX idx_vouchers_expiry_date (expiry_date),
  INDEX idx_vouchers_status (status),
  CONSTRAINT fk_vouchers_created_by
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS voucher_assignments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  voucher_id INT NOT NULL,
  customer_id INT NOT NULL,
  assigned_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  max_usage_customer INT NOT NULL DEFAULT 1,
  usage_count INT NOT NULL DEFAULT 0,
  last_used_date TIMESTAMP NULL,
  is_used TINYINT(1) NOT NULL DEFAULT 0,
  status ENUM('active', 'used', 'expired') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_voucher_customer (voucher_id, customer_id),
  INDEX idx_voucher_assignments_customer (customer_id),
  INDEX idx_voucher_assignments_voucher (voucher_id),
  INDEX idx_voucher_assignments_status (status),
  CONSTRAINT fk_voucher_assignments_voucher
    FOREIGN KEY (voucher_id) REFERENCES vouchers(id) ON DELETE CASCADE,
  CONSTRAINT fk_voucher_assignments_customer
    FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS voucher_usage_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  voucher_id INT NOT NULL,
  assignment_id INT NULL,
  customer_id INT NOT NULL,
  appointment_id INT NULL,
  discount_applied DECIMAL(10,2) NOT NULL,
  used_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_voucher_usage_customer (customer_id),
  INDEX idx_voucher_usage_voucher (voucher_id),
  INDEX idx_voucher_usage_appointment (appointment_id),
  INDEX idx_voucher_usage_used_date (used_date),
  CONSTRAINT fk_voucher_usage_voucher
    FOREIGN KEY (voucher_id) REFERENCES vouchers(id) ON DELETE CASCADE,
  CONSTRAINT fk_voucher_usage_assignment
    FOREIGN KEY (assignment_id) REFERENCES voucher_assignments(id) ON DELETE SET NULL,
  CONSTRAINT fk_voucher_usage_customer
    FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_voucher_usage_appointment
    FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS voucher_suggestions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  customer_id INT NOT NULL,
  voucher_id INT NOT NULL,
  reason VARCHAR(255) NULL,
  confidence_score FLOAT NULL,
  shown_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  clicked TINYINT(1) NOT NULL DEFAULT 0,
  applied TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_voucher_suggestions_customer (customer_id),
  INDEX idx_voucher_suggestions_voucher (voucher_id),
  INDEX idx_voucher_suggestions_shown_date (shown_date),
  INDEX idx_voucher_suggestions_reason (reason),
  CONSTRAINT fk_voucher_suggestions_customer
    FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_voucher_suggestions_voucher
    FOREIGN KEY (voucher_id) REFERENCES vouchers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO vouchers (
  code,
  voucher_type,
  discount_amount,
  discount_percent,
  min_order_value,
  max_discount_amount,
  customer_type,
  description,
  expiry_date,
  max_usage_global,
  status,
  created_by
)
SELECT
  'WELCOME15',
  'percentage',
  0,
  15,
  300000,
  120000,
  'both',
  'Voucher chào mừng khách hàng dùng cho lần đặt lịch tiếp theo.',
  DATE_ADD(NOW(), INTERVAL 30 DAY),
  200,
  'active',
  (SELECT id FROM users WHERE role = 'admin' ORDER BY id LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM vouchers WHERE code = 'WELCOME15');

INSERT INTO vouchers (
  code,
  voucher_type,
  discount_amount,
  discount_percent,
  min_order_value,
  max_discount_amount,
  customer_type,
  description,
  expiry_date,
  max_usage_global,
  status,
  created_by
)
SELECT
  'VIP120K',
  'fixed',
  120000,
  NULL,
  700000,
  NULL,
  'vip',
  'Ưu đãi dành cho khách VIP có tổng chi tiêu cao.',
  DATE_ADD(NOW(), INTERVAL 45 DAY),
  100,
  'active',
  (SELECT id FROM users WHERE role = 'admin' ORDER BY id LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM vouchers WHERE code = 'VIP120K');

INSERT IGNORE INTO voucher_assignments (voucher_id, customer_id, max_usage_customer)
SELECT v.id, u.id, 1
FROM vouchers v
JOIN users u ON u.role = 'customer'
WHERE v.code = 'WELCOME15';
