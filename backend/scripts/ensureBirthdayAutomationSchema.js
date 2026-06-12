const db = require('../src/config/db');

const query = async (sql, params = []) => {
  await db.ready;
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, results) => {
      if (err) return reject(err);
      resolve(results);
    });
  });
};

const quoteId = (value) => `\`${String(value).replace(/`/g, '``')}\``;

const getCurrentDatabase = async () => {
  const rows = await query('SELECT DATABASE() AS database_name');
  return rows[0]?.database_name;
};

const tableExists = async (databaseName, tableName) => {
  const rows = await query(
    `
      SELECT COUNT(*) AS total
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = ?
        AND TABLE_NAME = ?
    `,
    [databaseName, tableName]
  );

  return Number(rows[0]?.total || 0) > 0;
};

const columnExists = async (databaseName, tableName, columnName) => {
  const rows = await query(
    `
      SELECT COUNT(*) AS total
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = ?
        AND TABLE_NAME = ?
        AND COLUMN_NAME = ?
    `,
    [databaseName, tableName, columnName]
  );

  return Number(rows[0]?.total || 0) > 0;
};

const ensureColumn = async (databaseName, tableName, columnName, definition) => {
  const exists = await columnExists(databaseName, tableName, columnName);
  if (exists) {
    console.log(`${tableName}.${columnName} already exists`);
    return;
  }

  await query(`ALTER TABLE ${quoteId(tableName)} ADD COLUMN ${quoteId(columnName)} ${definition}`);
  console.log(`Added ${tableName}.${columnName}`);
};

const indexExists = async (databaseName, tableName, indexName) => {
  const rows = await query(
    `
      SELECT COUNT(*) AS total
      FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = ?
        AND TABLE_NAME = ?
        AND INDEX_NAME = ?
    `,
    [databaseName, tableName, indexName]
  );

  return Number(rows[0]?.total || 0) > 0;
};

const ensureIndex = async (databaseName, tableName, indexName, definition) => {
  const exists = await indexExists(databaseName, tableName, indexName);
  if (exists) {
    console.log(`${indexName} already exists`);
    return;
  }

  await query(`ALTER TABLE ${quoteId(tableName)} ADD INDEX ${quoteId(indexName)} ${definition}`);
  console.log(`Added ${indexName}`);
};

const ensureVoucherTables = async (databaseName) => {
  if (!(await tableExists(databaseName, 'vouchers'))) {
    await query(
      `
        CREATE TABLE vouchers (
          id INT AUTO_INCREMENT PRIMARY KEY,
          code VARCHAR(50) NOT NULL UNIQUE,
          voucher_type ENUM('fixed', 'percentage', 'free_delivery') NOT NULL,
          discount_amount DECIMAL(10,2) NULL,
          discount_percent INT NULL,
          min_order_value DECIMAL(10,2) NOT NULL DEFAULT 0,
          max_discount_amount DECIMAL(10,2) NULL,
          customer_type ENUM('regular', 'vip', 'vvip', 'vvvip', 'both') NOT NULL DEFAULT 'both',
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
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `
    );
    console.log('Created vouchers table');
  } else {
    console.log('vouchers table already exists');
  }

  if (!(await tableExists(databaseName, 'voucher_assignments'))) {
    await query(
      `
        CREATE TABLE voucher_assignments (
          id INT AUTO_INCREMENT PRIMARY KEY,
          voucher_id INT NOT NULL,
          customer_id INT NOT NULL,
          assigned_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          max_usage_customer INT NOT NULL DEFAULT 1,
          usage_count INT NOT NULL DEFAULT 0,
          last_used_date TIMESTAMP NULL,
          is_used TINYINT(1) NOT NULL DEFAULT 0,
          status ENUM('active', 'used', 'expired') NOT NULL DEFAULT 'active',
          source ENUM('admin', 'system', 'bot') NOT NULL DEFAULT 'admin',
          reason VARCHAR(255) NULL,
          confidence_score FLOAT NULL,
          shown_date TIMESTAMP NULL,
          clicked TINYINT(1) NOT NULL DEFAULT 0,
          applied TINYINT(1) NOT NULL DEFAULT 0,
          last_appointment_id INT NULL,
          last_discount_applied DECIMAL(10,2) NOT NULL DEFAULT 0,
          total_discount_applied DECIMAL(10,2) NOT NULL DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY uniq_voucher_customer (voucher_id, customer_id),
          INDEX idx_voucher_assignments_customer (customer_id),
          INDEX idx_voucher_assignments_voucher (voucher_id),
          INDEX idx_voucher_assignments_status (status),
          INDEX idx_voucher_assignments_source (source),
          INDEX idx_voucher_assignments_shown_date (shown_date),
          CONSTRAINT fk_voucher_assignments_voucher
            FOREIGN KEY (voucher_id) REFERENCES vouchers(id) ON DELETE CASCADE,
          CONSTRAINT fk_voucher_assignments_customer
            FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE CASCADE,
          CONSTRAINT fk_voucher_assignments_last_appointment
            FOREIGN KEY (last_appointment_id) REFERENCES appointments(id) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `
    );
    console.log('Created voucher_assignments table');
    return;
  }

  console.log('voucher_assignments table already exists');
  await ensureColumn(databaseName, 'voucher_assignments', 'source', "ENUM('admin', 'system', 'bot') NOT NULL DEFAULT 'admin' AFTER status");
  await ensureColumn(databaseName, 'voucher_assignments', 'reason', 'VARCHAR(255) NULL AFTER source');
  await ensureColumn(databaseName, 'voucher_assignments', 'confidence_score', 'FLOAT NULL AFTER reason');
  await ensureColumn(databaseName, 'voucher_assignments', 'shown_date', 'TIMESTAMP NULL AFTER confidence_score');
  await ensureColumn(databaseName, 'voucher_assignments', 'clicked', 'TINYINT(1) NOT NULL DEFAULT 0 AFTER shown_date');
  await ensureColumn(databaseName, 'voucher_assignments', 'applied', 'TINYINT(1) NOT NULL DEFAULT 0 AFTER clicked');
  await ensureColumn(databaseName, 'voucher_assignments', 'last_appointment_id', 'INT NULL AFTER applied');
  await ensureColumn(databaseName, 'voucher_assignments', 'last_discount_applied', 'DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER last_appointment_id');
  await ensureColumn(databaseName, 'voucher_assignments', 'total_discount_applied', 'DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER last_discount_applied');
  await ensureIndex(databaseName, 'voucher_assignments', 'idx_voucher_assignments_source', '(source)');
  await ensureIndex(databaseName, 'voucher_assignments', 'idx_voucher_assignments_shown_date', '(shown_date)');
};

const ensureBirthdaySchema = async () => {
  const databaseName = await getCurrentDatabase();
  if (!databaseName) {
    throw new Error('Cannot detect current database');
  }

  const hasDateOfBirth = await columnExists(databaseName, 'users', 'date_of_birth');
  if (!hasDateOfBirth) {
    await query('ALTER TABLE users ADD COLUMN date_of_birth DATE NULL AFTER phone');
    console.log('Added users.date_of_birth');
  } else {
    console.log('users.date_of_birth already exists');
  }

  const hasDateOfBirthIndex = await indexExists(databaseName, 'users', 'idx_users_date_of_birth');
  if (!hasDateOfBirthIndex) {
    await query('ALTER TABLE users ADD INDEX idx_users_date_of_birth (date_of_birth)');
    console.log('Added idx_users_date_of_birth');
  } else {
    console.log('idx_users_date_of_birth already exists');
  }

  await ensureVoucherTables(databaseName);
};

ensureBirthdaySchema()
  .then(() => {
    console.log('Birthday automation schema is ready');
    db.end();
  })
  .catch((err) => {
    console.error('Birthday automation schema failed:', err.message);
    db.end();
    process.exit(1);
  });
