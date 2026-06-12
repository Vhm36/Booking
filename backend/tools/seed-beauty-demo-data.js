const bcrypt = require('bcryptjs');
const db = require('../src/config/db');

const SEED_PREFIX = 'beauty.seed';
const STAFF_PREFIX = 'beauty.staff';
const DEFAULT_PASSWORD = process.env.BEAUTY_SEED_PASSWORD || 'BeautySeed@123';
const CUSTOMER_COUNT = Number(process.env.BEAUTY_SEED_CUSTOMERS || 720);
const START_DATE_VALUE = process.env.BEAUTY_SEED_START_DATE || '2024-01-01';

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
const pad2 = (value) => String(value).padStart(2, '0');
const pad4 = (value) => String(value).padStart(4, '0');

const getVietnamTodayValue = () => {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const parts = Object.fromEntries(formatter.formatToParts(new Date()).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
};

const END_DATE_VALUE = process.env.BEAUTY_SEED_END_DATE || getVietnamTodayValue();

let randomState = Number(process.env.BEAUTY_SEED_RANDOM || 20240608);
const random = () => {
  randomState = (randomState * 1664525 + 1013904223) % 4294967296;
  return randomState / 4294967296;
};

const randomInt = (min, max) => Math.floor(random() * (max - min + 1)) + min;
const pick = (items) => items[randomInt(0, items.length - 1)];

const parseDate = (value) => {
  const [year, month, day] = String(value).split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
};

const formatDate = (date) =>
  `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;

const addDays = (date, days) => {
  const nextDate = new Date(date);
  nextDate.setUTCDate(nextDate.getUTCDate() + days);
  return nextDate;
};

const diffDays = (startDate, endDate) =>
  Math.floor((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));

const addMinutes = (time, minutes) => {
  const [hour, minute] = String(time).split(':').map(Number);
  const total = hour * 60 + minute + Number(minutes || 0);
  return `${pad2(Math.floor(total / 60) % 24)}:${pad2(total % 60)}:00`;
};

const tableExists = async (tableName) => {
  const rows = await query('SHOW TABLES LIKE ?', [tableName]);
  return rows.length > 0;
};

const getTableColumns = async (tableName) => {
  const rows = await query(`SHOW COLUMNS FROM ${quoteId(tableName)}`);
  return new Set(rows.map((row) => row.Field));
};

const columnExists = async (tableName, columnName) => {
  const columns = await getTableColumns(tableName);
  return columns.has(columnName);
};

const ensureColumn = async (tableName, columnName, definition) => {
  if (await columnExists(tableName, columnName)) {
    return;
  }

  await query(`ALTER TABLE ${quoteId(tableName)} ADD COLUMN ${quoteId(columnName)} ${definition}`);
  console.log(`Added ${tableName}.${columnName}`);
};

const insertDynamic = async (tableName, row, tableColumns = null) => {
  const columns = tableColumns || (await getTableColumns(tableName));
  const selectedColumns = Object.keys(row).filter((column) => columns.has(column));
  const placeholders = selectedColumns.map(() => '?').join(', ');
  const values = selectedColumns.map((column) => row[column]);

  return query(
    `INSERT INTO ${quoteId(tableName)} (${selectedColumns.map(quoteId).join(', ')}) VALUES (${placeholders})`,
    values
  );
};

const categoryImages = {
  'Tóc': 'https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=900&q=80',
  'Gội/Massage': 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?auto=format&fit=crop&w=900&q=80',
  'Nail/Móng': 'https://images.unsplash.com/photo-1604654894610-df63bc536371?auto=format&fit=crop&w=900&q=80',
  'Mi/Mày': 'https://images.unsplash.com/photo-1516975080664-ed2fc6a32937?auto=format&fit=crop&w=900&q=80',
  'Da mặt': 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?auto=format&fit=crop&w=900&q=80',
  'Massage & Spa': 'https://images.unsplash.com/photo-1600334129128-685c5582fd35?auto=format&fit=crop&w=900&q=80',
  'Trang điểm': 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=900&q=80',
  'Wax/Tẩy lông': 'https://images.unsplash.com/photo-1519415943484-9fa1873496d4?auto=format&fit=crop&w=900&q=80',
  'Phun xăm thẩm mỹ': 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=900&q=80',
  'Chăm sóc cơ thể': 'https://images.unsplash.com/photo-1552693673-1bf958298935?auto=format&fit=crop&w=900&q=80',
  'Công nghệ trẻ hóa': 'https://images.unsplash.com/photo-1616394584738-fc6e612e71b9?auto=format&fit=crop&w=900&q=80',
  'Gói cô dâu': 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=900&q=80'
};

const serviceDefinitions = [
  ['Tóc', 'Cắt tóc nữ tư vấn dáng mặt', 220000, 45, 'Tư vấn dáng mặt, cắt tạo kiểu và sấy hoàn thiện theo phong cách cá nhân.'],
  ['Tóc', 'Cắt tóc nam salon', 160000, 35, 'Cắt nam kỹ thuật salon, gội sạch và tạo kiểu nhanh gọn.'],
  ['Tóc', 'Nhuộm thời trang Balayage/Ombre', 2500000, 180, 'Nhuộm chuyển màu cao cấp, xử lý nền tóc và phủ bóng sau nhuộm.'],
  ['Tóc', 'Nhuộm phủ bạc hữu cơ', 680000, 90, 'Phủ bạc bằng màu dịu nhẹ, giảm mùi hóa chất và giữ độ bóng tự nhiên.'],
  ['Tóc', 'Uốn setting Hàn Quốc', 1850000, 150, 'Uốn setting lọn mềm, tư vấn độ xoăn phù hợp chất tóc.'],
  ['Tóc', 'Duỗi collagen phục hồi', 2100000, 150, 'Duỗi thẳng kết hợp collagen giúp tóc mượt và giảm khô xơ.'],
  ['Tóc', 'Phục hồi Keratin chuyên sâu', 1200000, 100, 'Bổ sung keratin cho tóc hư tổn, giảm xù và tăng độ bóng.'],
  ['Tóc', 'Hấp dầu nano protein', 420000, 50, 'Hấp dưỡng nano protein cho tóc khô, xơ và dễ rối.'],
  ['Gội/Massage', 'Gội dưỡng sinh thảo mộc', 260000, 60, 'Gội dưỡng sinh với thảo mộc, massage đầu và bấm huyệt nhẹ.'],
  ['Gội/Massage', 'Spa da đầu detox', 520000, 75, 'Làm sạch sâu da đầu, tẩy tế bào chết và cân bằng dầu.'],
  ['Gội/Massage', 'Massage cổ vai gáy 45 phút', 350000, 45, 'Giảm căng cơ vùng cổ vai gáy cho khách làm việc văn phòng.'],
  ['Gội/Massage', 'Gội thư giãn đá nóng', 390000, 70, 'Kết hợp gội dưỡng sinh và đá nóng giúp thư giãn sâu.'],
  ['Gội/Massage', 'Tẩy tế bào chết da đầu', 300000, 45, 'Làm sạch mảng bám, giảm bí da đầu và hỗ trợ tóc chắc khỏe.'],
  ['Nail/Móng', 'Sơn gel Hàn Quốc', 280000, 60, 'Sơn gel bền màu, xử lý form móng và dưỡng móng nhẹ.'],
  ['Nail/Móng', 'Cắt da sửa form móng', 160000, 35, 'Chăm sóc da quanh móng, chỉnh form và làm sạch móng.'],
  ['Nail/Móng', 'Đắp gel extension', 780000, 120, 'Nối dài móng bằng gel, tạo form tự nhiên và chắc móng.'],
  ['Nail/Móng', 'Nail art 10 ngón', 650000, 110, 'Vẽ họa tiết theo mẫu, phối màu và phủ bóng bảo vệ.'],
  ['Nail/Móng', 'Đính đá Swarovski cao cấp', 850000, 100, 'Thiết kế nail đính đá nổi bật, phù hợp tiệc và sự kiện.'],
  ['Nail/Móng', 'Chăm sóc gót chân mềm mịn', 320000, 55, 'Ngâm chân, xử lý da khô và dưỡng mềm gót chân.'],
  ['Mi/Mày', 'Nối mi classic tự nhiên', 420000, 75, 'Nối từng sợi tạo hiệu ứng tự nhiên, nhẹ mắt và dễ chăm sóc.'],
  ['Mi/Mày', 'Nối mi volume quyến rũ', 680000, 95, 'Nối mi volume tạo độ dày rõ nét cho ánh nhìn nổi bật.'],
  ['Mi/Mày', 'Uốn mi collagen', 360000, 60, 'Uốn cong mi thật kết hợp dưỡng collagen giúp mi mềm hơn.'],
  ['Mi/Mày', 'Điêu khắc chân mày 6D', 1800000, 150, 'Tạo sợi mày mô phỏng tự nhiên, tư vấn dáng theo khuôn mặt.'],
  ['Mi/Mày', 'Nhuộm và tạo dáng chân mày', 260000, 45, 'Tỉa dáng, nhuộm màu chân mày hài hòa màu tóc và da.'],
  ['Da mặt', 'Làm sạch sâu Hydra Facial', 720000, 75, 'Hút sạch bã nhờn, cấp ẩm và làm dịu da sau liệu trình.'],
  ['Da mặt', 'Chăm sóc da mụn chuyên sâu', 620000, 90, 'Làm sạch, lấy nhân mụn chuẩn vệ sinh và phục hồi sau mụn.'],
  ['Da mặt', 'Peel da sinh học', 950000, 60, 'Peel dịu nhẹ hỗ trợ cải thiện bề mặt da, thâm và sần.'],
  ['Da mặt', 'Điện di vitamin C', 780000, 70, 'Điện di tinh chất vitamin C giúp da sáng và đều màu hơn.'],
  ['Da mặt', 'Cấp ẩm HA chuyên sâu', 580000, 60, 'Bổ sung HA, làm dịu da thiếu nước và tăng độ căng bóng.'],
  ['Da mặt', 'Trẻ hóa RF nâng cơ', 1400000, 90, 'Sóng RF hỗ trợ nâng cơ, săn chắc và cải thiện đường nét mặt.'],
  ['Da mặt', 'Điều trị thâm nám ánh sáng', 1650000, 100, 'Liệu trình ánh sáng hỗ trợ mờ thâm nám và da không đều màu.'],
  ['Massage & Spa', 'Massage body tinh dầu', 650000, 90, 'Massage toàn thân với tinh dầu thư giãn và giảm căng cơ.'],
  ['Massage & Spa', 'Massage đá nóng', 780000, 90, 'Đá nóng kết hợp kỹ thuật massage giúp lưu thông và thư giãn.'],
  ['Massage & Spa', 'Thải độc body', 920000, 100, 'Tẩy tế bào chết, ủ dưỡng và massage hỗ trợ thải độc cơ thể.'],
  ['Massage & Spa', 'Xông hơi thảo mộc', 300000, 40, 'Xông hơi thảo mộc giúp cơ thể thư giãn và làm sạch da.'],
  ['Massage & Spa', 'Combo thư giãn sau làm việc', 990000, 120, 'Gói kết hợp massage, xông hơi và chăm sóc cổ vai gáy.'],
  ['Trang điểm', 'Makeup dự tiệc', 850000, 75, 'Trang điểm dự tiệc theo phong cách sang trọng, lâu trôi.'],
  ['Trang điểm', 'Makeup cô dâu cao cấp', 2500000, 150, 'Makeup cô dâu, tư vấn layout và hỗ trợ chỉnh tóc hoàn thiện.'],
  ['Trang điểm', 'Trang điểm kỷ yếu', 650000, 60, 'Trang điểm nhẹ nhàng, tươi tắn phù hợp chụp ảnh kỷ yếu.'],
  ['Trang điểm', 'Tạo kiểu tóc sự kiện', 480000, 50, 'Uốn, búi hoặc tạo kiểu tóc phù hợp váy và bối cảnh sự kiện.'],
  ['Wax/Tẩy lông', 'Wax tay hoặc chân', 420000, 60, 'Wax sạch vùng tay hoặc chân, làm dịu da sau wax.'],
  ['Wax/Tẩy lông', 'Wax bikini', 620000, 60, 'Wax bikini riêng tư, vệ sinh và chăm sóc da sau liệu trình.'],
  ['Wax/Tẩy lông', 'Triệt lông IPL vùng nách', 780000, 45, 'Triệt lông IPL vùng nách, hỗ trợ giảm thâm và mọc chậm.'],
  ['Phun xăm thẩm mỹ', 'Phun môi collagen', 2200000, 150, 'Phun môi màu tự nhiên kết hợp dưỡng phục hồi collagen.'],
  ['Phun xăm thẩm mỹ', 'Phun mày ombre', 1900000, 130, 'Phun mày hiệu ứng ombre mềm mại, hợp nhiều dáng mặt.'],
  ['Phun xăm thẩm mỹ', 'Dặm màu phun xăm', 650000, 75, 'Dặm lại màu môi hoặc mày sau phun để màu đều và bền hơn.'],
  ['Chăm sóc cơ thể', 'Tắm trắng phi thuyền', 1600000, 120, 'Dưỡng trắng body bằng công nghệ phi thuyền và serum chuyên sâu.'],
  ['Chăm sóc cơ thể', 'Ủ trắng body thảo mộc', 880000, 90, 'Ủ body thảo mộc, làm mềm da và hỗ trợ sáng da tự nhiên.'],
  ['Công nghệ trẻ hóa', 'Giảm béo công nghệ RF', 1800000, 110, 'RF body hỗ trợ săn chắc vùng bụng, đùi hoặc bắp tay.'],
  ['Gói cô dâu', 'Gói cô dâu 7 ngày', 5200000, 420, 'Lịch trình chăm sóc da, tóc, nail và makeup thử trước ngày cưới.']
];

const categories = [...new Set(serviceDefinitions.map(([category]) => category))];

const staffRows = [
  ['Nguyễn Thị Minh Châu', '0907100001'],
  ['Trần Bảo Ngọc', '0907100002'],
  ['Lê Hoàng Anh', '0907100003'],
  ['Phạm Thu Hà', '0907100004'],
  ['Vũ Gia Hân', '0907100005'],
  ['Đặng Khánh Linh', '0907100006'],
  ['Bùi Hải Yến', '0907100007'],
  ['Hoàng Mai Phương', '0907100008']
];

const lastNames = [
  'Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Huỳnh', 'Phan', 'Vũ', 'Võ', 'Đặng',
  'Bùi', 'Đỗ', 'Hồ', 'Ngô', 'Dương', 'Lý', 'Đinh', 'Mai', 'Tô', 'Trịnh'
];

const middleNames = [
  'Thị', 'Minh', 'Ngọc', 'Thanh', 'Hoài', 'Gia', 'Khánh', 'Hải', 'Phương', 'Bảo',
  'Anh', 'Quỳnh', 'Thu', 'Kim', 'Nhật', 'Tường', 'Hồng', 'Mỹ', 'Trúc', 'Đức'
];

const givenNames = [
  'An', 'Bình', 'Châu', 'Dung', 'Duyên', 'Giang', 'Hà', 'Hân', 'Hạnh', 'Hiền',
  'Hoa', 'Hương', 'Khanh', 'Linh', 'Ly', 'Mai', 'My', 'Nga', 'Ngân', 'Nhi',
  'Nhung', 'Oanh', 'Phúc', 'Quỳnh', 'Tâm', 'Thảo', 'Thư', 'Trang', 'Trinh', 'Tú',
  'Uyên', 'Vy', 'Yến', 'Nam', 'Duy', 'Khoa', 'Long', 'Minh', 'Phong', 'Quân'
];

const ensureSeedSchema = async () => {
  await ensureColumn('users', 'date_of_birth', 'DATE NULL AFTER phone');
  await ensureColumn('services', 'service_code', 'VARCHAR(50) UNIQUE DEFAULT NULL');
  await ensureColumn('services', 'image_url', 'VARCHAR(512) NULL AFTER category');

  if (!(await tableExists('service_category'))) {
    await query(
      `
        CREATE TABLE service_category (
          id INT AUTO_INCREMENT PRIMARY KEY,
          category_name VARCHAR(100) NOT NULL UNIQUE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `
    );
    console.log('Created service_category table');
  }
};

const upsertCategories = async () => {
  for (const category of categories) {
    await query(
      'INSERT IGNORE INTO service_category (category_name, created_at) VALUES (?, NOW())',
      [category]
    );
  }

  return categories.length;
};

const upsertServices = async () => {
  const serviceColumns = await getTableColumns('services');
  const fields = [
    'service_code',
    'name',
    'description',
    'price',
    'duration',
    'category',
    'image_url',
    'status',
    'created_at'
  ].filter((field) => serviceColumns.has(field));

  for (let index = 0; index < serviceDefinitions.length; index += 1) {
    const [category, name, price, duration, description] = serviceDefinitions[index];
    const row = {
      service_code: `BEAUTY${pad2(index + 1)}`,
      name,
      description,
      price,
      duration,
      category,
      image_url: categoryImages[category] || '',
      status: 'active',
      created_at: `${START_DATE_VALUE} 08:00:00`
    };

    await query(
      `
        INSERT INTO services (${fields.map(quoteId).join(', ')})
        VALUES (${fields.map(() => '?').join(', ')})
        ON DUPLICATE KEY UPDATE
          name = VALUES(name),
          description = VALUES(description),
          price = VALUES(price),
          duration = VALUES(duration),
          category = VALUES(category),
          image_url = VALUES(image_url),
          status = 'active'
      `,
      fields.map((field) => row[field])
    );
  }

  const services = await query(
    `
      SELECT id, name, price, duration, category, service_code
      FROM services
      WHERE service_code LIKE 'BEAUTY%'
      ORDER BY service_code ASC
    `
  );

  return services;
};

const buildBirthDate = (index) => {
  const year = 1968 + ((index * 7 + randomInt(0, 20)) % 41);
  const month = 1 + ((index * 5 + randomInt(0, 11)) % 12);
  const maxDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const day = 1 + ((index * 11 + randomInt(0, maxDay - 1)) % maxDay);
  return `${year}-${pad2(month)}-${pad2(day)}`;
};

const buildCustomerRows = () => {
  const startDate = parseDate(START_DATE_VALUE);
  const endDate = parseDate(END_DATE_VALUE);
  const totalDays = Math.max(1, diffDays(startDate, endDate));
  const rows = [];

  for (let index = 1; index <= CUSTOMER_COUNT; index += 1) {
    const name = [
      lastNames[index % lastNames.length],
      middleNames[(index * 3) % middleNames.length],
      givenNames[(index * 5) % givenNames.length]
    ].join(' ');
    const createdAt = addDays(startDate, Math.floor((index / CUSTOMER_COUNT) * totalDays));

    rows.push({
      index,
      name,
      email: `${SEED_PREFIX}.${pad4(index)}@example.com`,
      phone: `09${String(72000000 + index).padStart(8, '0')}`,
      date_of_birth: buildBirthDate(index),
      created_at: `${formatDate(createdAt)} ${pad2(8 + (index % 10))}:00:00`
    });
  }

  return rows;
};

const upsertUsers = async ({ rows, role, segment }) => {
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
  const userColumns = await getTableColumns('users');
  const fields = [
    'name',
    'email',
    'password',
    'phone',
    'date_of_birth',
    'role',
    'is_active',
    'customer_segment',
    'cancellation_count',
    'noshow_count',
    'created_at'
  ].filter((field) => userColumns.has(field));

  for (const row of rows) {
    const userRow = {
      name: row.name,
      email: row.email,
      password: passwordHash,
      phone: row.phone,
      date_of_birth: row.date_of_birth || null,
      role,
      is_active: 1,
      customer_segment: segment,
      cancellation_count: 0,
      noshow_count: 0,
      created_at: row.created_at
    };

    const updateClauses = fields
      .filter((field) => !['email', 'created_at'].includes(field))
      .map((field) => `${quoteId(field)} = VALUES(${quoteId(field)})`);

    if (fields.includes('created_at')) {
      updateClauses.push('created_at = LEAST(created_at, VALUES(created_at))');
    }

    await query(
      `
        INSERT INTO users (${fields.map(quoteId).join(', ')})
        VALUES (${fields.map(() => '?').join(', ')})
        ON DUPLICATE KEY UPDATE ${updateClauses.join(', ')}
      `,
      fields.map((field) => userRow[field])
    );
  }
};

const upsertCustomers = async () => {
  const rows = buildCustomerRows();
  await upsertUsers({ rows, role: 'customer', segment: 'Beauty Seed' });

  return query(
    `
      SELECT id, name, email, date_of_birth, created_at
      FROM users
      WHERE email LIKE ?
      ORDER BY email ASC
    `,
    [`${SEED_PREFIX}.%@example.com`]
  );
};

const upsertStaff = async () => {
  const rows = staffRows.map(([name, phone], index) => ({
    name,
    email: `${STAFF_PREFIX}.${pad2(index + 1)}@example.com`,
    phone,
    date_of_birth: `${1985 + index}-${pad2((index % 12) + 1)}-${pad2((index % 20) + 5)}`,
    created_at: `${START_DATE_VALUE} 07:30:00`
  }));

  await upsertUsers({ rows, role: 'staff', segment: 'Beauty Staff Seed' });

  return query(
    `
      SELECT id, name, email
      FROM users
      WHERE role = 'staff'
        AND is_active = 1
      ORDER BY id ASC
    `
  );
};

const deleteExistingSeedAppointments = async () => {
  if (await tableExists('payments')) {
    await query(
      `
        DELETE p
        FROM payments p
        JOIN appointments a ON a.id = p.appointment_id
        JOIN users u ON u.id = a.user_id
        WHERE u.email LIKE ?
      `,
      [`${SEED_PREFIX}.%@example.com`]
    );
  }

  if (await tableExists('appointment_services')) {
    await query(
      `
        DELETE aps
        FROM appointment_services aps
        JOIN appointments a ON a.id = aps.appointment_id
        JOIN users u ON u.id = a.user_id
        WHERE u.email LIKE ?
      `,
      [`${SEED_PREFIX}.%@example.com`]
    );
  }

  await query(
    `
      DELETE a
      FROM appointments a
      JOIN users u ON u.id = a.user_id
      WHERE u.email LIKE ?
    `,
    [`${SEED_PREFIX}.%@example.com`]
  );
};

const getDailyAppointmentCount = (date) => {
  const dayOfWeek = date.getUTCDay();
  const month = date.getUTCMonth() + 1;
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  const seasonBoost = [1, 2, 6, 7, 11, 12].includes(month) ? 3 : 0;
  const base = isWeekend ? randomInt(14, 23) : randomInt(8, 16);
  return base + seasonBoost;
};

const getStatusForDate = (dateValue) => {
  if (dateValue === END_DATE_VALUE) {
    const roll = random();
    if (roll < 0.2) return 'completed';
    if (roll < 0.82) return 'confirmed';
    if (roll < 0.95) return 'pending';
    return 'cancelled';
  }

  const roll = random();
  if (roll < 0.84) return 'completed';
  if (roll < 0.93) return 'cancelled';
  if (roll < 0.98) return 'confirmed';
  return 'pending';
};

const pickServiceBundle = (services) => {
  const first = pick(services);
  const bundle = [first];
  const sameCategory = services.filter((service) => service.category === first.category && service.id !== first.id);

  if (random() < 0.24 && sameCategory.length > 0) {
    bundle.push(pick(sameCategory));
  }

  if (random() < 0.07) {
    const extraCandidates = services.filter((service) => !bundle.some((item) => item.id === service.id));
    if (extraCandidates.length > 0) {
      bundle.push(pick(extraCandidates));
    }
  }

  return bundle;
};

const insertAppointmentServices = async ({ appointmentId, services, appointmentServiceColumns }) => {
  for (let index = 0; index < services.length; index += 1) {
    const service = services[index];
    await insertDynamic(
      'appointment_services',
      {
        appointment_id: appointmentId,
        service_id: service.id,
        sort_order: index,
        price_snapshot: service.price,
        duration_snapshot: service.duration,
        service_name_snapshot: service.name,
        created_at: new Date()
      },
      appointmentServiceColumns
    );
  }
};

const insertPaymentIfNeeded = async ({ appointmentId, amount, status, appointmentDate, paymentColumns }) => {
  if (status !== 'completed' || paymentColumns.size === 0 || random() > 0.94) {
    return false;
  }

  const method = pick(['cash', 'banking', 'momo', 'vnpay', 'vietqr']);
  await insertDynamic(
    'payments',
    {
      appointment_id: appointmentId,
      amount,
      payment_method: method,
      payment_status: 'paid',
      payment_reference: `BEAUTY-SEED-${appointmentId}`,
      transaction_code: `TXN${appointmentId}`,
      created_at: `${appointmentDate} 20:00:00`,
      paid_at: `${appointmentDate} 20:05:00`
    },
    paymentColumns
  );

  return true;
};

const seedAppointments = async ({ customers, services, staff }) => {
  const appointmentsColumns = await getTableColumns('appointments');
  const appointmentServiceColumns = await getTableColumns('appointment_services');
  const paymentColumns = (await tableExists('payments')) ? await getTableColumns('payments') : new Set();
  const startDate = parseDate(START_DATE_VALUE);
  const endDate = parseDate(END_DATE_VALUE);
  const totalDays = diffDays(startDate, endDate);
  const timeSlots = [
    '08:00:00', '08:30:00', '09:00:00', '09:30:00', '10:00:00', '10:30:00',
    '11:00:00', '11:30:00', '13:00:00', '13:30:00', '14:00:00', '14:30:00',
    '15:00:00', '15:30:00', '16:00:00', '16:30:00', '17:00:00', '17:30:00',
    '18:00:00', '18:30:00', '19:00:00', '19:30:00'
  ];

  let appointmentsCreated = 0;
  let appointmentServicesCreated = 0;
  let paymentsCreated = 0;

  for (let dayIndex = 0; dayIndex <= totalDays; dayIndex += 1) {
    const currentDate = addDays(startDate, dayIndex);
    const appointmentDate = formatDate(currentDate);
    const dailyCount = getDailyAppointmentCount(currentDate);

    for (let index = 0; index < dailyCount; index += 1) {
      const customer = customers[(dayIndex * 13 + index * 7 + randomInt(0, customers.length - 1)) % customers.length];
      const selectedServices = pickServiceBundle(services);
      const mainService = selectedServices[0];
      const staffMember = staff.length > 0 ? staff[(dayIndex + index + randomInt(0, staff.length - 1)) % staff.length] : null;
      const appointmentTime = timeSlots[(index + randomInt(0, timeSlots.length - 1)) % timeSlots.length];
      const totalDuration = selectedServices.reduce((sum, service) => sum + Number(service.duration || 0), 0);
      const totalAmount = selectedServices.reduce((sum, service) => sum + Number(service.price || 0), 0);
      const status = getStatusForDate(appointmentDate);
      const createdDate = addDays(currentDate, -randomInt(1, 28));
      const safeCreatedDate = createdDate < startDate ? startDate : createdDate;
      const payableAmount = status === 'cancelled' ? 0 : totalAmount;

      const result = await insertDynamic(
        'appointments',
        {
          user_id: customer.id,
          service_id: mainService.id,
          staff_id: staffMember?.id || null,
          appointment_date: appointmentDate,
          appointment_time: appointmentTime,
          end_time: addMinutes(appointmentTime, totalDuration),
          status,
          cancellation_requested: 0,
          cancellation_requested_at: null,
          notes: `Seed Beauty Demo: ${mainService.category}`,
          total_amount: payableAmount,
          original_amount: totalAmount,
          voucher_discount: 0,
          voucher_codes: null,
          reminder_sent: status === 'completed' ? 1 : 0,
          reminder_sent_at: status === 'completed' ? `${appointmentDate} 07:00:00` : null,
          cancellation_score: status === 'cancelled' ? randomInt(65, 92) : randomInt(5, 45),
          cancellation_risk: status === 'cancelled' ? 'high' : pick(['low', 'low', 'medium']),
          deposit_required: status === 'cancelled' ? 1 : 0,
          deposit_amount: status === 'cancelled' ? Math.round(totalAmount * 0.2) : 0,
          staff_rating: status === 'completed' ? randomInt(4, 5) : null,
          staff_review: null,
          reviewed_at: null,
          created_at: `${formatDate(safeCreatedDate)} ${pad2(randomInt(8, 20))}:${pad2(randomInt(0, 5) * 10)}:00`
        },
        appointmentsColumns
      );

      await insertAppointmentServices({
        appointmentId: result.insertId,
        services: selectedServices,
        appointmentServiceColumns
      });

      const paymentInserted = await insertPaymentIfNeeded({
        appointmentId: result.insertId,
        amount: payableAmount,
        status,
        appointmentDate,
        paymentColumns
      });

      appointmentsCreated += 1;
      appointmentServicesCreated += selectedServices.length;
      if (paymentInserted) paymentsCreated += 1;
    }

    if (dayIndex > 0 && dayIndex % 90 === 0) {
      console.log(`Seeded appointments through ${appointmentDate} (${appointmentsCreated} appointments)`);
    }
  }

  return {
    appointmentsCreated,
    appointmentServicesCreated,
    paymentsCreated
  };
};

const refreshCustomerCounters = async () => {
  const userColumns = await getTableColumns('users');
  const updates = [];

  if (userColumns.has('cancellation_count')) {
    updates.push('u.cancellation_count = COALESCE(stats.cancelled_count, 0)');
  }

  if (userColumns.has('noshow_count')) {
    updates.push('u.noshow_count = 0');
  }

  if (updates.length === 0) {
    return;
  }

  await query(
    `
      UPDATE users u
      LEFT JOIN (
        SELECT user_id, SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled_count
        FROM appointments
        GROUP BY user_id
      ) stats ON stats.user_id = u.id
      SET ${updates.join(', ')}
      WHERE u.email LIKE ?
    `,
    [`${SEED_PREFIX}.%@example.com`]
  );
};

const main = async () => {
  const startDate = parseDate(START_DATE_VALUE);
  const endDate = parseDate(END_DATE_VALUE);

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || endDate < startDate) {
    throw new Error('Invalid seed date range');
  }

  console.log(`Beauty demo seed from ${START_DATE_VALUE} to ${END_DATE_VALUE}`);
  await ensureSeedSchema();

  const categoryCount = await upsertCategories();
  const services = await upsertServices();
  const staff = await upsertStaff();
  const customers = await upsertCustomers();

  await deleteExistingSeedAppointments();
  const appointmentStats = await seedAppointments({ customers, services, staff });
  await refreshCustomerCounters();

  console.log('Beauty demo seed complete');
  console.log(`Categories: ${categoryCount}`);
  console.log(`Services: ${services.length}`);
  console.log(`Customers: ${customers.length}`);
  console.log(`Staff available: ${staff.length}`);
  console.log(`Appointments: ${appointmentStats.appointmentsCreated}`);
  console.log(`Appointment services: ${appointmentStats.appointmentServicesCreated}`);
  console.log(`Payments: ${appointmentStats.paymentsCreated}`);
  console.log(`Default password for seed users: ${DEFAULT_PASSWORD}`);
};

main()
  .then(() => {
    db.end();
  })
  .catch((err) => {
    console.error('Beauty demo seed failed:', err.message);
    db.end();
    process.exit(1);
  });
