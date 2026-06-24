const mysql = require('mysql2/promise');
require('../src/config/loadEnv');

async function check() {
  const host = process.env.DB_HOST || '127.0.0.1';
  const port = parseInt(process.env.DB_PORT || '3306', 10);
  const user = process.env.DB_USER || 'root';
  const password = process.env.DB_PASSWORD || '';
  const databaseName = process.env.DB_NAME || 'booking_system';

  console.log(`\n=== KIỂM TRA DATABASE LOCAL ===`);
  console.log(`Host: ${host}`);
  console.log(`Port: ${port}`);
  console.log(`User: ${user}`);
  console.log(`Database: ${databaseName}`);
  console.log(`================================\n`);

  let connection;
  try {
    connection = await mysql.createConnection({ host, port, user, password });
    console.log('✔ Kết nối MySQL server thành công.');
  } catch (err) {
    console.error('✘ Không thể kết nối MySQL server:', err.message);
    process.exit(1);
  }

  try {
    const [dbExists] = await connection.query(`SHOW DATABASES LIKE '${databaseName}'`);
    if (dbExists.length === 0) {
      console.log(`✘ Database "${databaseName}" chưa tồn tại!`);
      return;
    }
    console.log(`✔ Database "${databaseName}" tồn tại.`);
    
    await connection.query(`USE \`${databaseName}\``);
    const [tables] = await connection.query('SHOW TABLES');
    const tableNames = tables.map(r => Object.values(r)[0]);
    console.log('Các bảng đang có trong DB:', tableNames.length > 0 ? tableNames.join(', ') : '(Không có bảng nào)');
    
    for (const table of ['services', 'users', 'vouchers']) {
      if (tableNames.includes(table)) {
        const [rows] = await connection.query(`SELECT COUNT(*) as count FROM \`${table}\``);
        console.log(`  └─ Bảng "${table}" đang có: ${rows[0].count} bản ghi.`);
      } else {
        console.log(`  └─ Bảng "${table}": CHƯA TỒN TẠI.`);
      }
    }
  } catch (err) {
    console.error('✘ Lỗi kiểm tra database:', err.message);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}
check();
