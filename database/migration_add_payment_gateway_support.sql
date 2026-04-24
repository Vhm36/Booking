USE booking_system;
SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;

SET @payments_method_type := (
  SELECT COLUMN_TYPE
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'payments'
    AND COLUMN_NAME = 'payment_method'
  LIMIT 1
);
SET @sql_payments_method_type := IF(
  @payments_method_type IS NOT NULL AND @payments_method_type NOT LIKE '%''vietqr''%',
  'ALTER TABLE payments MODIFY COLUMN payment_method ENUM(''cash'', ''banking'', ''momo'', ''vnpay'', ''vietqr'') DEFAULT ''cash''',
  'SELECT "payments.payment_method already supports vietqr"'
);
PREPARE stmt_payments_method_type FROM @sql_payments_method_type;
EXECUTE stmt_payments_method_type;
DEALLOCATE PREPARE stmt_payments_method_type;

SET @has_payments_reference := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'payments'
    AND COLUMN_NAME = 'payment_reference'
);
SET @sql_payments_reference := IF(
  @has_payments_reference = 0,
  'ALTER TABLE payments ADD COLUMN payment_reference VARCHAR(100) NULL UNIQUE AFTER payment_status',
  'SELECT "payments.payment_reference already exists"'
);
PREPARE stmt_payments_reference FROM @sql_payments_reference;
EXECUTE stmt_payments_reference;
DEALLOCATE PREPARE stmt_payments_reference;

SET @has_payments_bank_code := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'payments'
    AND COLUMN_NAME = 'bank_code'
);
SET @sql_payments_bank_code := IF(
  @has_payments_bank_code = 0,
  'ALTER TABLE payments ADD COLUMN bank_code VARCHAR(50) NULL AFTER transaction_code',
  'SELECT "payments.bank_code already exists"'
);
PREPARE stmt_payments_bank_code FROM @sql_payments_bank_code;
EXECUTE stmt_payments_bank_code;
DEALLOCATE PREPARE stmt_payments_bank_code;

SET @has_payments_bank_tran := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'payments'
    AND COLUMN_NAME = 'bank_transaction_no'
);
SET @sql_payments_bank_tran := IF(
  @has_payments_bank_tran = 0,
  'ALTER TABLE payments ADD COLUMN bank_transaction_no VARCHAR(100) NULL AFTER bank_code',
  'SELECT "payments.bank_transaction_no already exists"'
);
PREPARE stmt_payments_bank_tran FROM @sql_payments_bank_tran;
EXECUTE stmt_payments_bank_tran;
DEALLOCATE PREPARE stmt_payments_bank_tran;

SET @has_payments_gateway_response := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'payments'
    AND COLUMN_NAME = 'gateway_response_code'
);
SET @sql_payments_gateway_response := IF(
  @has_payments_gateway_response = 0,
  'ALTER TABLE payments ADD COLUMN gateway_response_code VARCHAR(10) NULL AFTER bank_transaction_no',
  'SELECT "payments.gateway_response_code already exists"'
);
PREPARE stmt_payments_gateway_response FROM @sql_payments_gateway_response;
EXECUTE stmt_payments_gateway_response;
DEALLOCATE PREPARE stmt_payments_gateway_response;

SET @has_payments_gateway_status := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'payments'
    AND COLUMN_NAME = 'gateway_transaction_status'
);
SET @sql_payments_gateway_status := IF(
  @has_payments_gateway_status = 0,
  'ALTER TABLE payments ADD COLUMN gateway_transaction_status VARCHAR(10) NULL AFTER gateway_response_code',
  'SELECT "payments.gateway_transaction_status already exists"'
);
PREPARE stmt_payments_gateway_status FROM @sql_payments_gateway_status;
EXECUTE stmt_payments_gateway_status;
DEALLOCATE PREPARE stmt_payments_gateway_status;

SET @has_payments_expire_at := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'payments'
    AND COLUMN_NAME = 'payment_url_expires_at'
);
SET @sql_payments_expire_at := IF(
  @has_payments_expire_at = 0,
  'ALTER TABLE payments ADD COLUMN payment_url_expires_at DATETIME NULL AFTER gateway_transaction_status',
  'SELECT "payments.payment_url_expires_at already exists"'
);
PREPARE stmt_payments_expire_at FROM @sql_payments_expire_at;
EXECUTE stmt_payments_expire_at;
DEALLOCATE PREPARE stmt_payments_expire_at;

SET @has_payments_gateway_payload := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'payments'
    AND COLUMN_NAME = 'gateway_payload'
);
SET @sql_payments_gateway_payload := IF(
  @has_payments_gateway_payload = 0,
  'ALTER TABLE payments ADD COLUMN gateway_payload TEXT NULL AFTER payment_url_expires_at',
  'SELECT "payments.gateway_payload already exists"'
);
PREPARE stmt_payments_gateway_payload FROM @sql_payments_gateway_payload;
EXECUTE stmt_payments_gateway_payload;
DEALLOCATE PREPARE stmt_payments_gateway_payload;
