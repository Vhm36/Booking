const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('../src/config/loadEnv');

async function importDb() {
  const host = process.env.DB_HOST || '127.0.0.1';
  const port = parseInt(process.env.DB_PORT || '3306', 10);
  const user = process.env.DB_USER || 'root';
  const password = process.env.DB_PASSWORD || '';
  const databaseName = process.env.DB_NAME || 'booking_system';

  console.log(`\n=== KẾT NỐI DATABASE LOCAL ===`);
  console.log(`Host: ${host}`);
  console.log(`Port: ${port}`);
  console.log(`User: ${user}`);
  console.log(`Database: ${databaseName}`);
  console.log(`==============================\n`);

  let connection;
  try {
    connection = await mysql.createConnection({
      host,
      port,
      user,
      password,
      multipleStatements: true
    });
    console.log('✔ Kết nối đến MySQL local thành công.');
  } catch (err) {
    console.error('✘ Lỗi kết nối đến MySQL local:', err.message);
    console.error('\nVui lòng đảm bảo rằng:');
    console.error('1. XAMPP MySQL hoặc dịch vụ MySQL local của bạn đang CHẠY.');
    console.error('2. Các thông tin cấu hình DB_PORT, DB_USER, DB_PASSWORD trong backend/.env đã đúng.');
    process.exit(1);
  }

  try {
    const sqlFilePath = path.join(__dirname, '..', '..', 'database', 'booking_system.sql');
    if (!fs.existsSync(sqlFilePath)) {
      throw new Error(`Không tìm thấy file SQL tại: ${sqlFilePath}`);
    }

    console.log(`\nĐọc file dữ liệu SQL...`);
    const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');

    console.log(`Tạo database "${databaseName}" nếu chưa tồn tại...`);
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${databaseName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
    await connection.query(`USE \`${databaseName}\`;`);

    console.log('Đang nạp cấu trúc bảng và dữ liệu mẫu (sẽ mất vài giây)...');
    await connection.query(sqlContent);
    console.log('✔ Import dữ liệu cơ sở dữ liệu thành công!');
  } catch (err) {
    console.error('✘ Lỗi trong quá trình import database:', err.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

importDb();
