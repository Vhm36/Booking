USE booking_system;

-- Them cot zalo_id vao bang users de ho tro dang nhap bang Zalo.
-- Migration nay co the chay lai nhieu lan.
SET @zalo_column_exists = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'zalo_id'
);

SET @zalo_column_sql = IF(
  @zalo_column_exists = 0,
  'ALTER TABLE users ADD COLUMN zalo_id VARCHAR(64) NULL UNIQUE AFTER email',
  'SELECT ''users.zalo_id already exists'' AS message'
);

PREPARE zalo_column_stmt FROM @zalo_column_sql;
EXECUTE zalo_column_stmt;
DEALLOCATE PREPARE zalo_column_stmt;

SET @zalo_unique_exists = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'zalo_id'
    AND NON_UNIQUE = 0
);

SET @zalo_unique_sql = IF(
  @zalo_unique_exists = 0,
  'ALTER TABLE users ADD UNIQUE KEY idx_users_zalo_id_unique (zalo_id)',
  'SELECT ''users.zalo_id unique index already exists'' AS message'
);

PREPARE zalo_unique_stmt FROM @zalo_unique_sql;
EXECUTE zalo_unique_stmt;
DEALLOCATE PREPARE zalo_unique_stmt;
