const bcrypt = require('bcryptjs');
const db = require('../src/config/db');

const CUSTOMER_COUNT = 20000;
const SERVICE_COUNT = 500;
const TECHNICIAN_COUNT = 20;
const CASHIER_COUNT = 10;
const MANAGER_COUNT = 5;
const START_DATE_VALUE = '2024-01-01';
const CUSTOMER_EMAIL_PREFIX = 'scale.customer';
const STAFF_EMAIL_PREFIX = 'scale.staff';
const SERVICE_CODE_PREFIX = 'SCALE';
const DEFAULT_PASSWORD = process.env.LARGE_SEED_PASSWORD || 'BeautyScale@123';
const BATCH_SIZE = 500;
const MIN_DAILY_APPOINTMENTS = 100;
const MAX_DAILY_APPOINTMENTS = 200;

const query = async (sql, params = []) => {
  await db.ready;
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, results) => {
      if (err) return reject(err);
      resolve(results);
    });
  });
};

const pad = (value, length) => String(value).padStart(length, '0');

const getVietnamTodayValue = () => {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(new Date()).map((part) => [part.type, part.value])
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
};

const END_DATE_VALUE = getVietnamTodayValue();

const parseDate = (value) => {
  if (value instanceof Date) {
    return new Date(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()));
  }
  const [year, month, day] = String(value).slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
};

const formatDate = (date) =>
  `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1, 2)}-${pad(date.getUTCDate(), 2)}`;

const addDays = (date, days) => {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
};

const diffDays = (startDate, endDate) =>
  Math.floor((endDate.getTime() - startDate.getTime()) / 86400000);

const dateAtRatio = (startDate, endDate, index, total) => {
  if (total <= 1) return new Date(startDate);
  return addDays(startDate, Math.floor((diffDays(startDate, endDate) * index) / (total - 1)));
};

const addMinutes = (time, minutes) => {
  const [hours, mins] = String(time).split(':').map(Number);
  const totalMinutes = hours * 60 + mins + Number(minutes || 0);
  return `${pad(Math.floor(totalMinutes / 60) % 24, 2)}:${pad(totalMinutes % 60, 2)}:00`;
};

const chunk = (items, size = BATCH_SIZE) => {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
};

const ensureColumn = async (tableName, columnName, definition) => {
  const rows = await query(`SHOW COLUMNS FROM \`${tableName}\` LIKE ?`, [columnName]);
  if (rows.length === 0) {
    await query(`ALTER TABLE \`${tableName}\` ADD COLUMN \`${columnName}\` ${definition}`);
    console.log(`Added ${tableName}.${columnName}`);
  }
};

const ensureSchema = async () => {
  await ensureColumn('services', 'service_code', 'VARCHAR(50) NULL');
  await ensureColumn('users', 'gender', "ENUM('male','female','other') NULL AFTER date_of_birth");

  const serviceIndexes = await query('SHOW INDEX FROM services WHERE Key_name = ?', [
    'uniq_services_service_code'
  ]);
  if (serviceIndexes.length === 0) {
    await query('ALTER TABLE services ADD UNIQUE INDEX uniq_services_service_code (service_code)');
  }
};

const roleDefinitions = [
  ['Kỹ thuật viên', 'Nhân viên trực tiếp thực hiện dịch vụ cho khách hàng'],
  ['Thu ngân', 'Nhân viên xử lý thanh toán và hỗ trợ tại quầy'],
  ['Quản lý', 'Nhân viên quản lý hoạt động vận hành salon']
];

const ensureStaffRoles = async () => {
  for (const [roleName, description] of roleDefinitions) {
    await query(
      `
        INSERT INTO staff_role (role_name, description, is_active)
        VALUES (?, ?, 1)
        ON DUPLICATE KEY UPDATE description = VALUES(description), is_active = 1
      `,
      [roleName, description]
    );
  }

  const rows = await query(
    'SELECT id, role_name FROM staff_role WHERE role_name IN (?, ?, ?)',
    roleDefinitions.map(([roleName]) => roleName)
  );
  return new Map(rows.map((row) => [row.role_name, row.id]));
};

const surnames = [
  'Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Huỳnh', 'Phan', 'Vũ', 'Võ', 'Đặng',
  'Bùi', 'Đỗ', 'Hồ', 'Ngô', 'Dương', 'Lý', 'Đinh', 'Mai', 'Tô', 'Trịnh'
];

const middleNames = [
  'Minh', 'Thanh', 'Ngọc', 'Gia', 'Khánh', 'Hải', 'Phương', 'Bảo', 'Quỳnh', 'Thu',
  'Kim', 'Nhật', 'Tường', 'Hoài', 'Đức', 'Anh', 'Thùy', 'Xuân', 'Tuấn', 'Mai'
];

const givenNames = [
  'An', 'Bích', 'Châu', 'Dung', 'Duyên', 'Giang', 'Hà', 'Hân', 'Hạnh', 'Hiền',
  'Hoa', 'Hương', 'Linh', 'Ly', 'Mai', 'My', 'Nga', 'Ngân', 'Nhi', 'Nhung',
  'Oanh', 'Quỳnh', 'Thảo', 'Trang', 'Vy', 'Bình', 'Cường', 'Duy', 'Hào', 'Hưng',
  'Khang', 'Khoa', 'Long', 'Minh', 'Nam', 'Phong', 'Phúc', 'Quân', 'Sơn', 'Thành',
  'Thiện', 'Trung', 'Tuấn', 'Tùng', 'Việt', 'Vinh', 'Đạt', 'Đức', 'Khôi', 'Lâm'
];

const customerPatterns = [
  { bookings: 1, segment: 'New Customers', rfm: '311' },
  { bookings: 4, segment: 'Loyal Customers', rfm: '444' },
  { bookings: 5, segment: 'Potential Loyalists', rfm: '434' },
  { bookings: 2, segment: 'Champions', rfm: '344' },
  { bookings: 4, segment: 'At Risk', rfm: '144' },
  { bookings: 3, segment: 'Need Attention', rfm: '233' },
  { bookings: 0, segment: 'New Customers', rfm: '111' },
  { bookings: 2, segment: 'Lost Customers', rfm: '122' }
];

const buildCustomerRows = async () => {
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
  const startDate = parseDate(START_DATE_VALUE);
  const endDate = parseDate(END_DATE_VALUE);
  const oldestBirthDate = parseDate('1970-01-01');
  const youngestBirthDate = new Date(endDate);
  youngestBirthDate.setUTCFullYear(youngestBirthDate.getUTCFullYear() - 16);
  const birthRange = diffDays(oldestBirthDate, youngestBirthDate);
  const rows = [];

  for (let index = 0; index < CUSTOMER_COUNT; index += 1) {
    const surnameIndex = index % surnames.length;
    const middleIndex = Math.floor(index / surnames.length) % middleNames.length;
    const givenIndex = Math.floor(index / (surnames.length * middleNames.length)) % givenNames.length;
    const gender = givenIndex < 25 ? 'female' : 'male';
    const pattern = customerPatterns[index % customerPatterns.length];
    const createdDate = dateAtRatio(startDate, endDate, index, CUSTOMER_COUNT);
    let birthDate = addDays(oldestBirthDate, (index * 7919) % (birthRange + 1));

    if (index === 0) birthDate = oldestBirthDate;
    if (index === CUSTOMER_COUNT - 1) birthDate = youngestBirthDate;

    rows.push([
      `${surnames[surnameIndex]} ${middleNames[middleIndex]} ${givenNames[givenIndex]}`,
      `${CUSTOMER_EMAIL_PREFIX}.${pad(index + 1, 5)}@beautybook.local`,
      passwordHash,
      `07${pad(index + 1, 8)}`,
      'customer',
      null,
      1,
      pattern.segment,
      pattern.rfm,
      Number(pattern.rfm[0]),
      Number(pattern.rfm[1]),
      Number(pattern.rfm[2]),
      `${END_DATE_VALUE} 00:00:00`,
      formatDate(birthDate),
      gender,
      0,
      0,
      `${formatDate(createdDate)} ${pad(8 + (index % 11), 2)}:${pad(index % 60, 2)}:00`
    ]);
  }

  return rows;
};

const staffGroups = [
  { key: 'tech', label: 'Kỹ thuật viên', count: TECHNICIAN_COUNT },
  { key: 'cashier', label: 'Thu ngân', count: CASHIER_COUNT },
  { key: 'manager', label: 'Quản lý', count: MANAGER_COUNT }
];

const buildStaffRows = async (roleIds) => {
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
  const startDate = parseDate(START_DATE_VALUE);
  const endDate = parseDate(END_DATE_VALUE);
  const rows = [];
  let globalIndex = 0;

  for (const group of staffGroups) {
    for (let index = 0; index < group.count; index += 1) {
      const nameIndex = globalIndex + 2300;
      const fullName = `${surnames[nameIndex % surnames.length]} ${middleNames[(nameIndex * 3) % middleNames.length]} ${givenNames[(nameIndex * 7) % givenNames.length]}`;
      const createdDate = dateAtRatio(startDate, endDate, globalIndex, TECHNICIAN_COUNT + CASHIER_COUNT + MANAGER_COUNT);
      const birthYear = 1978 + (globalIndex % 25);
      const birthMonth = 1 + (globalIndex % 12);
      const birthDay = 1 + ((globalIndex * 3) % 27);

      rows.push([
        fullName,
        `${STAFF_EMAIL_PREFIX}.${group.key}.${pad(index + 1, 2)}@beautybook.local`,
        passwordHash,
        `079${pad(globalIndex + 1, 7)}`,
        'staff',
        roleIds.get(group.label),
        1,
        'Staff',
        null,
        null,
        null,
        null,
        null,
        `${birthYear}-${pad(birthMonth, 2)}-${pad(birthDay, 2)}`,
        globalIndex % 3 === 0 ? 'male' : 'female',
        0,
        0,
        `${formatDate(createdDate)} 07:30:00`
      ]);
      globalIndex += 1;
    }
  }

  return rows;
};

const upsertUsers = async (rows) => {
  const columns = [
    'name', 'email', 'password', 'phone', 'role', 'staff_role_id', 'is_active',
    'customer_segment', 'rfm_score', 'rfm_recency_score', 'rfm_frequency_score',
    'rfm_monetary_score', 'rfm_updated_at', 'date_of_birth', 'gender',
    'cancellation_count', 'noshow_count', 'created_at'
  ];
  const updates = columns
    .filter((column) => column !== 'email')
    .map((column) => `\`${column}\` = VALUES(\`${column}\`)`)
    .join(', ');

  for (const batch of chunk(rows)) {
    await query(
      `
        INSERT INTO users (${columns.map((column) => `\`${column}\``).join(', ')})
        VALUES ?
        ON DUPLICATE KEY UPDATE ${updates}
      `,
      [batch]
    );
  }
};

const serviceCategories = [
  { name: 'Tóc', basePrice: 180000, treatments: ['Cắt tạo kiểu', 'Nhuộm thời trang', 'Uốn phục hồi', 'Duỗi collagen', 'Hấp dưỡng keratin'] },
  { name: 'Gội đầu & thư giãn', basePrice: 140000, treatments: ['Gội dưỡng sinh', 'Massage cổ vai gáy', 'Detox da đầu', 'Ủ tóc thảo mộc', 'Đá nóng thư giãn'] },
  { name: 'Móng', basePrice: 120000, treatments: ['Sơn gel', 'Đắp gel', 'Nail art', 'Chăm sóc móng', 'Dưỡng gót chân'] },
  { name: 'Mi & Mày', basePrice: 220000, treatments: ['Nối mi classic', 'Nối mi volume', 'Uốn mi collagen', 'Tạo dáng chân mày', 'Điêu khắc chân mày'] },
  { name: 'Chăm sóc da', basePrice: 350000, treatments: ['Hydra facial', 'Chăm sóc da mụn', 'Peel sinh học', 'Điện di vitamin', 'Nâng cơ RF'] },
  { name: 'Massage & Spa', basePrice: 320000, treatments: ['Massage tinh dầu', 'Massage đá nóng', 'Thải độc cơ thể', 'Xông hơi thảo mộc', 'Massage trị liệu'] },
  { name: 'Trang điểm', basePrice: 380000, treatments: ['Trang điểm dự tiệc', 'Trang điểm cô dâu', 'Trang điểm kỷ yếu', 'Tạo kiểu tóc', 'Trang điểm chụp ảnh'] },
  { name: 'Wax & Triệt lông', basePrice: 260000, treatments: ['Wax tay', 'Wax chân', 'Wax bikini', 'Triệt lông IPL', 'Chăm sóc sau wax'] },
  { name: 'Phun xăm thẩm mỹ', basePrice: 650000, treatments: ['Phun môi collagen', 'Phun mày ombre', 'Điêu khắc sợi', 'Dặm màu', 'Khử thâm môi'] },
  { name: 'Chăm sóc cơ thể', basePrice: 480000, treatments: ['Ủ trắng body', 'Giảm béo RF', 'Tẩy tế bào chết', 'Dưỡng ẩm toàn thân', 'Nâng cơ body'] }
];

const serviceVariants = [
  'Tiêu chuẩn', 'Thư giãn', 'Dưỡng ẩm', 'Phục hồi', 'Chuyên sâu',
  'Cá nhân hóa', 'Detox', 'Cao cấp', 'Premium', 'Signature'
];

const categoryImages = [
  'https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1604654894610-df63bc536371?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1516975080664-ed2fc6a32937?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1600334129128-685c5582fd35?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1519415943484-9fa1873496d4?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1552693673-1bf958298935?auto=format&fit=crop&w=900&q=80'
];

const buildServiceRows = () => {
  const startDate = parseDate(START_DATE_VALUE);
  const endDate = parseDate(END_DATE_VALUE);
  const rows = [];
  let serviceIndex = 0;

  serviceCategories.forEach((category, categoryIndex) => {
    category.treatments.forEach((treatment, treatmentIndex) => {
      serviceVariants.forEach((variant, variantIndex) => {
        const createdDate = dateAtRatio(startDate, endDate, serviceIndex, SERVICE_COUNT);
        const price = category.basePrice + treatmentIndex * 90000 + variantIndex * 70000;
        const duration = 30 + treatmentIndex * 15 + variantIndex * 5 + categoryIndex * 2;
        rows.push([
          `${SERVICE_CODE_PREFIX}${pad(serviceIndex + 1, 4)}`,
          `${treatment} - ${variant}`,
          price,
          duration,
          `${variant} dành cho ${treatment.toLowerCase()}, được thiết kế theo quy trình chăm sóc an toàn và phù hợp từng khách hàng.`,
          category.name,
          categoryImages[categoryIndex],
          'active',
          `${formatDate(createdDate)} 08:00:00`
        ]);
        serviceIndex += 1;
      });
    });
  });

  return rows;
};

const upsertServices = async () => {
  for (const category of serviceCategories) {
    await query(
      `
        INSERT INTO service_category (category_name, created_at)
        VALUES (?, ?)
        ON DUPLICATE KEY UPDATE category_name = VALUES(category_name)
      `,
      [category.name, `${START_DATE_VALUE} 08:00:00`]
    );
  }

  const rows = buildServiceRows();
  const columns = [
    'service_code', 'name', 'price', 'duration', 'description', 'category',
    'image_url', 'status', 'created_at'
  ];
  const updates = columns
    .filter((column) => !['service_code', 'created_at'].includes(column))
    .map((column) => `\`${column}\` = VALUES(\`${column}\`)`)
    .join(', ');

  for (const batch of chunk(rows)) {
    await query(
      `
        INSERT INTO services (${columns.map((column) => `\`${column}\``).join(', ')})
        VALUES ?
        ON DUPLICATE KEY UPDATE ${updates}
      `,
      [batch]
    );
  }
};

const seedAvailability = async (staff) => {
  if (staff.length === 0) return;

  await query('DELETE FROM staff_weekly_availability WHERE staff_id IN (?)', [staff.map((row) => row.id)]);
  const rows = [];

  staff.forEach((staffMember) => {
    for (let day = 0; day < 7; day += 1) {
      const isCashier = staffMember.email.includes('.cashier.');
      const isManager = staffMember.email.includes('.manager.');
      rows.push([
        staffMember.id,
        day,
        isCashier ? '07:30:00' : '08:00:00',
        isCashier ? '20:00:00' : isManager ? '18:00:00' : '19:00:00'
      ]);
    }
  });

  for (const batch of chunk(rows)) {
    await query(
      'INSERT INTO staff_weekly_availability (staff_id, day_of_week, start_time, end_time) VALUES ?',
      [batch]
    );
  }
};

const deleteExistingSeedAppointments = async () => {
  await query(
    `
      DELETE p
      FROM payments p
      JOIN appointments a ON a.id = p.appointment_id
      JOIN users u ON u.id = a.user_id
      WHERE u.email LIKE ?
    `,
    [`${CUSTOMER_EMAIL_PREFIX}.%@beautybook.local`]
  );

  await query(
    `
      DELETE a
      FROM appointments a
      JOIN users u ON u.id = a.user_id
      WHERE u.email LIKE ?
    `,
    [`${CUSTOMER_EMAIL_PREFIX}.%@beautybook.local`]
  );
};

const appointmentTimeSlots = [
  '08:00:00', '08:30:00', '09:00:00', '09:30:00', '10:00:00', '10:30:00',
  '11:00:00', '13:00:00', '13:30:00', '14:00:00', '14:30:00', '15:00:00',
  '15:30:00', '16:00:00', '16:30:00', '17:00:00', '17:30:00', '18:00:00'
];

const getAppointmentStatus = (dailyIndex, appointmentDate) => {
  if (appointmentDate === END_DATE_VALUE) {
    return dailyIndex % 2 === 0 ? 'confirmed' : 'pending';
  }
  if (dailyIndex % 17 === 0) return 'cancelled';
  return 'completed';
};

const selectService = (services, customerIndex, bookingIndex, patternIndex) => {
  if (patternIndex === 1) {
    return services[(customerIndex * 11) % services.length];
  }
  if (patternIndex === 2) {
    return services[(customerIndex * 7 + bookingIndex * 13) % 150];
  }
  if (patternIndex === 3) {
    return services[services.length - 1 - ((customerIndex + bookingIndex) % 100)];
  }
  return services[(customerIndex * 17 + bookingIndex * 29) % services.length];
};

const buildAppointmentRow = ({
  customer,
  customerIndex,
  dailyIndex,
  sequenceIndex,
  service,
  technician,
  appointmentDate,
  appointmentTime
}) => {
  const accountDate = parseDate(customer.created_at);
  const appointmentDateValue = parseDate(appointmentDate);
  const availableLeadDays = Math.max(0, diffDays(accountDate, appointmentDateValue));
  const leadDays = Math.min(availableLeadDays, 1 + ((sequenceIndex + customerIndex) % 21));
  const status = getAppointmentStatus(dailyIndex, appointmentDate);
  const amount = Number(service.price);
  const createdDate = addDays(appointmentDateValue, -leadDays);
  const isCancelled = status === 'cancelled';

  return {
    values: [
      customer.id,
      service.id,
      technician.id,
      appointmentDate,
      appointmentTime,
      addMinutes(appointmentTime, service.duration),
      status,
      0,
      null,
      `Dữ liệu quy mô lớn - ${service.category}`,
      isCancelled ? 0 : amount,
      amount,
      0,
      null,
      status === 'completed' ? 1 : 0,
      status === 'completed' ? `${appointmentDate} 07:00:00` : null,
      isCancelled ? 78 : 18,
      isCancelled ? 'high' : 'low',
      isCancelled ? 1 : 0,
      isCancelled ? Math.round(amount * 0.2) : 0,
      status === 'completed' ? 4 + ((customerIndex + dailyIndex) % 2) : null,
      null,
      null,
      `${formatDate(createdDate)} ${pad(8 + (customerIndex % 11), 2)}:${pad((dailyIndex * 7) % 60, 2)}:00`
    ],
    service,
    status,
    appointmentDate,
    appointmentTime,
    amount
  };
};

const insertAppointmentBatch = async (records) => {
  const columns = [
    'user_id', 'service_id', 'staff_id', 'appointment_date', 'appointment_time', 'end_time',
    'status', 'cancellation_requested', 'cancellation_requested_at', 'notes', 'total_amount',
    'original_amount', 'voucher_discount', 'voucher_codes', 'reminder_sent', 'reminder_sent_at',
    'cancellation_score', 'cancellation_risk', 'deposit_required', 'deposit_amount',
    'staff_rating', 'staff_review', 'reviewed_at', 'created_at'
  ];
  const result = await query(
    `INSERT INTO appointments (${columns.map((column) => `\`${column}\``).join(', ')}) VALUES ?`,
    [records.map((record) => record.values)]
  );
  const firstAppointmentId = result.insertId;
  const serviceRows = [];
  const paymentRows = [];

  records.forEach((record, index) => {
    const appointmentId = firstAppointmentId + index;
    serviceRows.push([
      appointmentId,
      record.service.id,
      0,
      record.service.price,
      record.service.duration,
      record.service.name,
      `${record.appointmentDate} ${record.appointmentTime}`
    ]);

    if (record.status === 'completed') {
      const method = ['cash', 'banking', 'momo', 'vnpay', 'vietqr'][appointmentId % 5];
      paymentRows.push([
        appointmentId,
        record.amount,
        method,
        'paid',
        `SCALE-PAY-${appointmentId}`,
        `SCALE-TXN-${appointmentId}`,
        `${record.appointmentDate} 20:00:00`,
        `${record.appointmentDate} 20:05:00`
      ]);
    }
  });

  await query(
    `
      INSERT INTO appointment_services
        (appointment_id, service_id, sort_order, price_snapshot, duration_snapshot, service_name_snapshot, created_at)
      VALUES ?
    `,
    [serviceRows]
  );

  if (paymentRows.length > 0) {
    await query(
      `
        INSERT INTO payments
          (appointment_id, amount, payment_method, payment_status, payment_reference, transaction_code, created_at, paid_at)
        VALUES ?
      `,
      [paymentRows]
    );
  }

  return { appointments: records.length, payments: paymentRows.length };
};

const seedAppointments = async ({ customers, services, technicians }) => {
  const startDate = parseDate(START_DATE_VALUE);
  const endDate = parseDate(END_DATE_VALUE);
  const totalDays = diffDays(startDate, endDate) + 1;
  const sortedCustomers = [...customers].sort(
    (a, b) => parseDate(a.created_at).getTime() - parseDate(b.created_at).getTime()
  );
  let records = [];
  let appointmentCount = 0;
  let paymentCount = 0;
  let activeCustomerCount = 0;
  let sequenceIndex = 0;

  for (let dayIndex = 0; dayIndex < totalDays; dayIndex += 1) {
    const appointmentDate = formatDate(addDays(startDate, dayIndex));
    while (
      activeCustomerCount < sortedCustomers.length &&
      formatDate(parseDate(sortedCustomers[activeCustomerCount].created_at)) <= appointmentDate
    ) {
      activeCustomerCount += 1;
    }

    const availableCustomerCount = Math.max(1, activeCustomerCount);
    const dailyTarget = MIN_DAILY_APPOINTMENTS +
      ((dayIndex * 37) % (MAX_DAILY_APPOINTMENTS - MIN_DAILY_APPOINTMENTS + 1));

    for (let dailyIndex = 0; dailyIndex < dailyTarget; dailyIndex += 1) {
      const customerIndex = (dayIndex * 131 + dailyIndex * 17) % availableCustomerCount;
      const customer = sortedCustomers[customerIndex];
      const patternIndex = customerIndex % customerPatterns.length;
      const service = selectService(services, customerIndex, dailyIndex, patternIndex);
      const technician = technicians[dailyIndex % technicians.length];
      const slotIndex = Math.floor(dailyIndex / technicians.length) % appointmentTimeSlots.length;
      const appointmentTime = appointmentTimeSlots[slotIndex];
      records.push(
        buildAppointmentRow({
          customer,
          customerIndex,
          dailyIndex,
          sequenceIndex,
          service,
          technician,
          appointmentDate,
          appointmentTime
        })
      );
      sequenceIndex += 1;

      if (records.length >= BATCH_SIZE) {
        const inserted = await insertAppointmentBatch(records);
        appointmentCount += inserted.appointments;
        paymentCount += inserted.payments;
        records = [];

        if (appointmentCount % 5000 === 0) {
          console.log(`Seeded ${appointmentCount} appointments`);
        }
      }
    }
  }

  if (records.length > 0) {
    const inserted = await insertAppointmentBatch(records);
    appointmentCount += inserted.appointments;
    paymentCount += inserted.payments;
  }

  return { appointmentCount, paymentCount };
};

const deleteExistingHistoricalAutomation = async () => {
  await query(
    `
      DELETE va
      FROM voucher_assignments va
      JOIN vouchers v ON v.id = va.voucher_id
      WHERE v.code LIKE 'COMEBACK%HIST' OR v.code LIKE 'VIP%HIST'
    `
  );
  await query("DELETE FROM vouchers WHERE code LIKE 'COMEBACK%HIST' OR code LIKE 'VIP%HIST'");
};

const createHistoricalVoucher = async ({
  code,
  discountPercent,
  maxDiscountAmount,
  description,
  issueDate,
  expiryDate
}) => {
  const status = expiryDate < END_DATE_VALUE ? 'expired' : 'active';
  const result = await query(
    `
      INSERT INTO vouchers (
        code, voucher_type, discount_percent, min_order_value, max_discount_amount,
        customer_type, max_usage_global, current_usage, status, description, expiry_date, created_at
      )
      VALUES (?, 'percentage', ?, 0, ?, 'both', 200, 0, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        id = LAST_INSERT_ID(id),
        status = VALUES(status),
        expiry_date = VALUES(expiry_date)
    `,
    [
      code,
      discountPercent,
      maxDiscountAmount,
      status,
      description,
      `${expiryDate} 23:59:59`,
      `${issueDate} 08:00:00`
    ]
  );
  return Number(result.insertId);
};

const pickHistoricalCustomers = (customers, count, offset) => {
  if (customers.length === 0) return [];
  const selected = [];
  const used = new Set();
  const target = Math.min(count, customers.length);

  for (let index = 0; index < target; index += 1) {
    let customerIndex = (offset + index * 37) % customers.length;
    while (used.has(customerIndex)) {
      customerIndex = (customerIndex + 1) % customers.length;
    }
    used.add(customerIndex);
    selected.push(customers[customerIndex]);
  }

  return selected;
};

const seedHistoricalVoucherAutomation = async (customers) => {
  await deleteExistingHistoricalAutomation();
  const startDate = parseDate(START_DATE_VALUE);
  const endDate = parseDate(END_DATE_VALUE);
  let monthCursor = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), 1));
  let monthIndex = 0;
  let voucherCount = 0;
  let assignmentCount = 0;

  while (monthCursor <= endDate) {
    const monthEnd = new Date(Date.UTC(monthCursor.getUTCFullYear(), monthCursor.getUTCMonth() + 1, 0));
    const effectiveMonthEnd = monthEnd > endDate ? endDate : monthEnd;
    const issueDateValue = new Date(Date.UTC(
      monthCursor.getUTCFullYear(),
      monthCursor.getUTCMonth(),
      Math.min(15, effectiveMonthEnd.getUTCDate())
    ));
    const issueDate = formatDate(issueDateValue);
    const expiryDate = formatDate(addDays(issueDateValue, 14));
    const monthCode = `${issueDate.slice(0, 4)}${issueDate.slice(5, 7)}`;
    const eligible = customers.filter(
      (customer) => formatDate(parseDate(customer.created_at)) <= issueDate
    );
    const atRiskPool = eligible.filter((customer) =>
      ['At Risk', 'Need Attention'].includes(customer.customer_segment)
    );
    const vipPool = eligible.filter((customer) =>
      ['Champions', 'Loyal Customers'].includes(customer.customer_segment)
    );
    const targetCount = 60 + (monthIndex % 41);
    const definitions = [
      {
        code: `COMEBACK${monthCode}HIST`,
        discountPercent: 25,
        maxDiscountAmount: 200000,
        description: 'Voucher quay lai do he thong tu dong phat',
        customers: pickHistoricalCustomers(atRiskPool, targetCount, monthIndex * 19),
        reason: 'Tu dong cham soc khach co nguy co roi bo'
      },
      {
        code: `VIP${monthCode}HIST`,
        discountPercent: 15,
        maxDiscountAmount: 300000,
        description: 'Voucher VIP do he thong tu dong phat',
        customers: pickHistoricalCustomers(vipPool, targetCount, monthIndex * 23),
        reason: 'Tu dong tri an khach hang than thiet'
      }
    ];

    for (const definition of definitions) {
      const voucherId = await createHistoricalVoucher({ ...definition, issueDate, expiryDate });
      voucherCount += 1;
      const rows = definition.customers.map((customer) => [
        voucherId,
        customer.id,
        `${issueDate} 09:00:00`,
        1,
        'active',
        'system',
        definition.reason,
        `${issueDate} 09:00:00`
      ]);

      if (rows.length > 0) {
        await query(
          `
            INSERT INTO voucher_assignments (
              voucher_id, user_id, assigned_date, max_usage_customer,
              status, source, reason, created_at
            ) VALUES ?
          `,
          [rows]
        );
        assignmentCount += rows.length;
      }
    }

    monthCursor = new Date(Date.UTC(monthCursor.getUTCFullYear(), monthCursor.getUTCMonth() + 1, 1));
    monthIndex += 1;
  }

  return { voucherCount, assignmentCount };
};

const refreshCustomerCounters = async () => {
  await query(
    `
      UPDATE users u
      LEFT JOIN (
        SELECT user_id, SUM(status = 'cancelled') AS cancellation_count
        FROM appointments
        GROUP BY user_id
      ) stats ON stats.user_id = u.id
      SET u.cancellation_count = COALESCE(stats.cancellation_count, 0),
          u.noshow_count = 0
      WHERE u.email LIKE ?
    `,
    [`${CUSTOMER_EMAIL_PREFIX}.%@beautybook.local`]
  );
};

const verifySeed = async (roleIds) => {
  const cutoff = new Date(parseDate(END_DATE_VALUE));
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - 16);
  const cutoffValue = formatDate(cutoff);
  const [customerSummary] = await query(
    `
      SELECT COUNT(*) AS total, MIN(date_of_birth) AS min_birth, MAX(date_of_birth) AS max_birth,
             MIN(created_at) AS min_created, MAX(created_at) AS max_created,
             SUM(date_of_birth < '1970-01-01' OR date_of_birth > ?) AS invalid_birth_dates
      FROM users
      WHERE email LIKE ?
    `,
    [cutoffValue, `${CUSTOMER_EMAIL_PREFIX}.%@beautybook.local`]
  );
  const [serviceSummary] = await query(
    `
      SELECT COUNT(*) AS total, MIN(created_at) AS min_created, MAX(created_at) AS max_created
      FROM services
      WHERE service_code LIKE ?
    `,
    [`${SERVICE_CODE_PREFIX}%`]
  );
  const staffSummary = await query(
    `
      SELECT sr.role_name, COUNT(*) AS total
      FROM users u
      JOIN staff_role sr ON sr.id = u.staff_role_id
      WHERE u.email LIKE ?
      GROUP BY sr.role_name
      ORDER BY sr.id
    `,
    [`${STAFF_EMAIL_PREFIX}.%@beautybook.local`]
  );
  const [appointmentSummary] = await query(
    `
      SELECT COUNT(*) AS total, MIN(a.appointment_date) AS min_date, MAX(a.appointment_date) AS max_date
      FROM appointments a
      JOIN users u ON u.id = a.user_id
      WHERE u.email LIKE ?
    `,
    [`${CUSTOMER_EMAIL_PREFIX}.%@beautybook.local`]
  );
  const [dailyAppointmentSummary] = await query(
    `
      SELECT
        COUNT(*) AS covered_days,
        MIN(daily_count) AS min_daily,
        MAX(daily_count) AS max_daily
      FROM (
        SELECT a.appointment_date, COUNT(*) AS daily_count
        FROM appointments a
        JOIN users u ON u.id = a.user_id
        WHERE u.email LIKE ?
        GROUP BY a.appointment_date
      ) daily_counts
    `,
    [`${CUSTOMER_EMAIL_PREFIX}.%@beautybook.local`]
  );
  const [voucherAutomationSummary] = await query(
    `
      SELECT
        COUNT(*) AS assignments,
        MIN(DATE(va.assigned_date)) AS min_date,
        MAX(DATE(va.assigned_date)) AS max_date
      FROM voucher_assignments va
      JOIN vouchers v ON v.id = va.voucher_id
      WHERE va.source = 'system'
        AND (v.code LIKE 'COMEBACK%HIST' OR v.code LIKE 'VIP%HIST')
    `
  );

  const staffCounts = new Map(staffSummary.map((row) => [row.role_name, Number(row.total)]));
  const expectedDays = diffDays(parseDate(START_DATE_VALUE), parseDate(END_DATE_VALUE)) + 1;
  const checks = [
    [Number(customerSummary.total) === CUSTOMER_COUNT, `customers=${customerSummary.total}`],
    [Number(customerSummary.invalid_birth_dates) === 0, `invalid_birth_dates=${customerSummary.invalid_birth_dates}`],
    [Number(serviceSummary.total) === SERVICE_COUNT, `services=${serviceSummary.total}`],
    [staffCounts.get('Kỹ thuật viên') === TECHNICIAN_COUNT, `technicians=${staffCounts.get('Kỹ thuật viên') || 0}`],
    [staffCounts.get('Thu ngân') === CASHIER_COUNT, `cashiers=${staffCounts.get('Thu ngân') || 0}`],
    [staffCounts.get('Quản lý') === MANAGER_COUNT, `managers=${staffCounts.get('Quản lý') || 0}`],
    [appointmentSummary.min_date && formatDate(parseDate(appointmentSummary.min_date)) === START_DATE_VALUE, `appointment_min=${appointmentSummary.min_date}`],
    [appointmentSummary.max_date && formatDate(parseDate(appointmentSummary.max_date)) === END_DATE_VALUE, `appointment_max=${appointmentSummary.max_date}`],
    [Number(dailyAppointmentSummary.covered_days) === expectedDays, `covered_days=${dailyAppointmentSummary.covered_days}`],
    [Number(dailyAppointmentSummary.min_daily) >= MIN_DAILY_APPOINTMENTS, `min_daily=${dailyAppointmentSummary.min_daily}`],
    [Number(dailyAppointmentSummary.max_daily) <= MAX_DAILY_APPOINTMENTS, `max_daily=${dailyAppointmentSummary.max_daily}`],
    [voucherAutomationSummary.min_date && formatDate(parseDate(voucherAutomationSummary.min_date)) >= START_DATE_VALUE, `voucher_min=${voucherAutomationSummary.min_date}`],
    [voucherAutomationSummary.max_date && formatDate(parseDate(voucherAutomationSummary.max_date)) === END_DATE_VALUE, `voucher_max=${voucherAutomationSummary.max_date}`],
    [roleIds.size === 3, `staff_roles=${roleIds.size}`]
  ];
  const failures = checks.filter(([passed]) => !passed).map(([, label]) => label);
  if (failures.length > 0) {
    throw new Error(`Seed verification failed: ${failures.join(', ')}`);
  }

  return {
    customers: customerSummary,
    services: serviceSummary,
    staff: staffSummary,
    appointments: appointmentSummary,
    dailyAppointments: dailyAppointmentSummary,
    voucherAutomation: voucherAutomationSummary,
    youngestAllowedBirthDate: cutoffValue
  };
};

const main = async () => {
  const startDate = parseDate(START_DATE_VALUE);
  const endDate = parseDate(END_DATE_VALUE);
  if (endDate < startDate) {
    throw new Error('Seed end date must be on or after 2024-01-01');
  }

  console.log(`Large dataset seed: ${START_DATE_VALUE} to ${END_DATE_VALUE}`);
  console.log('Checking database connection and schema...');
  await ensureSchema();
  const roleIds = await ensureStaffRoles();

  console.log('Upserting 500 services...');
  await upsertServices();

  console.log('Upserting 20,000 customer accounts...');
  await upsertUsers(await buildCustomerRows());

  console.log('Upserting 35 staff accounts...');
  await upsertUsers(await buildStaffRows(roleIds));

  const customers = await query(
    `
      SELECT id, email, created_at, customer_segment
      FROM users
      WHERE email LIKE ?
      ORDER BY created_at ASC, id ASC
    `,
    [`${CUSTOMER_EMAIL_PREFIX}.%@beautybook.local`]
  );
  const services = await query(
    `
      SELECT id, service_code, name, price, duration, category
      FROM services
      WHERE service_code LIKE ?
      ORDER BY service_code ASC
    `,
    [`${SERVICE_CODE_PREFIX}%`]
  );
  const staff = await query(
    `
      SELECT id, email, staff_role_id
      FROM users
      WHERE email LIKE ?
      ORDER BY email ASC
    `,
    [`${STAFF_EMAIL_PREFIX}.%@beautybook.local`]
  );
  const technicians = staff.filter((row) => Number(row.staff_role_id) === Number(roleIds.get('Kỹ thuật viên')));

  console.log('Refreshing staff schedules...');
  await seedAvailability(staff);

  console.log('Replacing generated appointment history...');
  await deleteExistingSeedAppointments();
  const appointmentStats = await seedAppointments({ customers, services, technicians });
  await refreshCustomerCounters();

  console.log('Seeding automated voucher history from 2024 to today...');
  const voucherAutomationStats = await seedHistoricalVoucherAutomation(customers);

  const summary = await verifySeed(roleIds);
  console.log('Large dataset seed completed successfully');
  console.log(JSON.stringify({
    ...summary,
    generated: { ...appointmentStats, voucherAutomation: voucherAutomationStats }
  }, null, 2));
  console.log(`Default password for generated accounts: ${DEFAULT_PASSWORD}`);
};

main()
  .then(() => db.end())
  .catch((err) => {
    console.error('Large dataset seed failed:', err);
    db.end();
    process.exitCode = 1;
  });
