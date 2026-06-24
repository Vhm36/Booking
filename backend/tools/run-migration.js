const fs = require('fs');
const path = require('path');
const db = require('../src/config/db');

async function main() {
  console.log('Chờ kết nối cơ sở dữ liệu...');
  await db.ready;
  console.log('Cơ sở dữ liệu đã sẵn sàng, bắt đầu chạy migration...');

  const migrationFile = process.argv[2] || 'migration_add_zalo_logs.sql';
  const migrationPath = path.resolve(__dirname, '..', '..', 'database', migrationFile);
  const databaseDir = path.resolve(__dirname, '..', '..', 'database');

  if (!migrationPath.startsWith(databaseDir + path.sep)) {
    throw new Error('Migration path không hợp lệ');
  }

  const sql = fs
    .readFileSync(migrationPath, 'utf8')
    .split(/\r?\n/)
    .filter(line => !line.trim().startsWith('--'))
    .join('\n');

  // Tách các câu lệnh SQL bằng dấu chấm phẩy
  const queries = sql
    .split(';')
    .map(q => q.trim())
    .filter(q => q.length > 0);

  for (const query of queries) {
    console.log(`Đang thực thi truy vấn:\n${query}\n`);
    await new Promise((resolve, reject) => {
      db.query(query, (err, results) => {
        if (err) {
          console.error('Lỗi khi thực thi truy vấn:', err.message);
          reject(err);
        } else {
          console.log('Thành công!');
          resolve(results);
        }
      });
    });
  }

  console.log('Tất cả migration chạy thành công!');
  db.end();
  process.exit(0);
}

main().catch(err => {
  console.error('Migration thất bại:', err);
  process.exit(1);
});
