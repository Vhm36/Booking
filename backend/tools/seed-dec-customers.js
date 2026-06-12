const bcrypt = require('bcryptjs');
const db = require('../src/config/db');
const decClusteringService = require('../src/services/decClusteringService');

const SEED_PREFIX = 'dec-seed';
const DEFAULT_PASSWORD = process.env.DEC_SEED_PASSWORD || 'DecSeed@123';
const DEFAULT_YEAR = Number(process.env.DEC_SEED_YEAR || new Date().getFullYear());
const DEFAULT_MONTH = Number(process.env.DEC_SEED_MONTH || new Date().getMonth() + 1);

const GROUPS = [
  { key: 'frequent_single_service', size: 15 },
  { key: 'many_bookings_low_arrival', size: 15 },
  { key: 'frequent_cancel_no_show', size: 15 },
  { key: 'low_usage_premium', size: 15 },
  { key: 'high_usage_budget', size: 15 },
  { key: 'one_time_then_left', size: 15 },
  { key: 'low_monthly_usage', size: 10 }
];

const query = async (sql, params = []) => {
  await db.ready;
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, results) => {
      if (err) return reject(err);
      resolve(results);
    });
  });
};

const pad = (value) => String(value).padStart(2, '0');

const toDate = (year, month, day) => {
  const maxDay = new Date(year, month, 0).getDate();
  return `${year}-${pad(month)}-${pad(Math.min(day, maxDay))}`;
};

const addMinutes = (time, minutes) => {
  const [hour, minute] = time.split(':').map(Number);
  const total = hour * 60 + minute + Number(minutes || 0);
  return `${pad(Math.floor(total / 60) % 24)}:${pad(total % 60)}:00`;
};

const pick = (items, index) => items[index % items.length];

const getServiceBuckets = (services) => {
  const sorted = [...services].sort((a, b) => Number(a.price) - Number(b.price));
  const budget = sorted.slice(0, Math.max(3, Math.ceil(sorted.length * 0.28)));
  const premium = sorted.slice(Math.max(0, Math.floor(sorted.length * 0.78)));
  const mid = sorted.filter((service) => {
    const price = Number(service.price);
    return price >= 250000 && price <= 500000;
  });

  return {
    budget: budget.length ? budget : sorted,
    mid: mid.length ? mid : sorted,
    premium: premium.length ? premium : sorted
  };
};

const buildAppointmentsForGroup = ({ groupKey, customerIndex, services, staff }) => {
  const baseDay = 1 + (customerIndex % 24);
  const staffId = staff.length ? pick(staff, customerIndex).id : null;
  const budgetService = pick(services.budget, customerIndex);
  const midService = pick(services.mid, customerIndex);
  const premiumService = pick(services.premium, customerIndex);
  const appointments = [];

  const addAppointment = ({ offset = 0, service, status = 'completed', time = '09:00:00', amount = null }) => {
    const date = toDate(DEFAULT_YEAR, DEFAULT_MONTH, baseDay + offset);
    const totalAmount = amount === null ? Number(service.price) : Number(amount);
    appointments.push({
      userIndex: customerIndex,
      staffId,
      service,
      appointmentDate: date,
      appointmentTime: time,
      endTime: addMinutes(time, service.duration),
      status,
      totalAmount,
      notes: `Seed DEC: ${groupKey}`,
      staffRating: status === 'completed' ? 5 : null,
      createdAt: `${date} 08:00:00`
    });
  };

  if (groupKey === 'frequent_single_service') {
    [0, 5, 11, 18].forEach((offset, index) => {
      addAppointment({ offset, service: midService, time: `${pad(9 + (index % 5))}:00:00` });
    });
  }

  if (groupKey === 'many_bookings_low_arrival') {
    [
      { offset: 0, status: 'completed' },
      { offset: 3, status: 'confirmed' },
      { offset: 7, status: 'pending' },
      { offset: 12, status: 'confirmed' },
      { offset: 18, status: 'pending' }
    ].forEach((item, index) => {
      addAppointment({
        ...item,
        service: pick([budgetService, midService], index),
        time: `${pad(10 + (index % 4))}:30:00`
      });
    });
  }

  if (groupKey === 'frequent_cancel_no_show') {
    [
      { offset: 0, status: 'cancelled', amount: 0 },
      { offset: 4, status: 'completed' },
      { offset: 9, status: 'cancelled', amount: 0 },
      { offset: 15, status: 'cancelled', amount: 0 }
    ].forEach((item, index) => {
      addAppointment({
        ...item,
        service: pick([budgetService, midService], index),
        time: `${pad(9 + (index % 5))}:30:00`
      });
    });
  }

  if (groupKey === 'low_usage_premium') {
    const count = customerIndex % 2 === 0 ? 1 : 2;
    Array.from({ length: count }).forEach((_, index) => {
      addAppointment({
        offset: index * 13,
        service: premiumService,
        time: `${pad(11 + index)}:00:00`
      });
    });
  }

  if (groupKey === 'high_usage_budget') {
    [0, 4, 10, 17].forEach((offset, index) => {
      addAppointment({
        offset,
        service: pick(services.budget, customerIndex + index),
        time: `${pad(8 + (index % 5))}:30:00`
      });
    });
  }

  if (groupKey === 'one_time_then_left') {
    addAppointment({
      offset: 0,
      service: pick([budgetService, midService], customerIndex),
      time: '14:00:00'
    });
  }

  if (groupKey === 'low_monthly_usage') {
    [0, 19].forEach((offset, index) => {
      addAppointment({
        offset,
        service: midService,
        time: `${pad(13 + index)}:30:00`
      });
    });
  }

  return appointments;
};

const deleteExistingSeedAppointments = async () => {
  await query(
    `
      DELETE aps
      FROM appointment_services aps
      JOIN appointments a ON a.id = aps.appointment_id
      JOIN users u ON u.id = a.user_id
      WHERE u.email LIKE ?
    `,
    [`${SEED_PREFIX}-%@example.com`]
  );

  await query(
    `
      DELETE a
      FROM appointments a
      JOIN users u ON u.id = a.user_id
      WHERE u.email LIKE ?
    `,
    [`${SEED_PREFIX}-%@example.com`]
  );
};

const upsertCustomers = async () => {
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
  const rows = [];
  let runningIndex = 1;

  GROUPS.forEach((group) => {
    for (let i = 0; i < group.size; i += 1) {
      rows.push({
        index: runningIndex,
        groupKey: group.key,
        name: `Khach DEC ${pad(runningIndex)}`,
        email: `${SEED_PREFIX}-${pad(runningIndex)}@example.com`,
        phone: `0909${String(runningIndex).padStart(6, '0')}`
      });
      runningIndex += 1;
    }
  });

  for (const row of rows) {
    await query(
      `
        INSERT INTO users (
          name, email, password, phone, role, is_active, customer_segment,
          cancellation_count, noshow_count, created_at
        )
        VALUES (?, ?, ?, ?, 'customer', 1, 'DEC Seed', 0, 0, NOW())
        ON DUPLICATE KEY UPDATE
          name = VALUES(name),
          password = VALUES(password),
          phone = VALUES(phone),
          role = 'customer',
          is_active = 1,
          customer_segment = 'DEC Seed',
          cancellation_count = 0,
          noshow_count = 0
      `,
      [row.name, row.email, passwordHash, row.phone]
    );
  }

  const seedUsers = await query(
    `
      SELECT id, email
      FROM users
      WHERE email LIKE ?
      ORDER BY email
    `,
    [`${SEED_PREFIX}-%@example.com`]
  );

  const idByEmail = new Map(seedUsers.map((user) => [user.email, user.id]));
  return rows.map((row) => ({ ...row, id: idByEmail.get(row.email) }));
};

const insertAppointment = async (customerId, appointment) => {
  const result = await query(
    `
      INSERT INTO appointments (
        user_id, service_id, staff_id, appointment_date, appointment_time, end_time,
        status, notes, total_amount, original_amount, voucher_discount,
        cancellation_score, cancellation_risk, deposit_required, deposit_amount,
        staff_rating, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?)
    `,
    [
      customerId,
      appointment.service.id,
      appointment.staffId,
      appointment.appointmentDate,
      appointment.appointmentTime,
      appointment.endTime,
      appointment.status,
      appointment.notes,
      appointment.totalAmount,
      appointment.totalAmount,
      appointment.status === 'cancelled' ? 85 : 12,
      appointment.status === 'cancelled' ? 'high' : 'low',
      appointment.status === 'cancelled' ? 1 : 0,
      appointment.status === 'cancelled' ? Math.round(Number(appointment.service.price) * 0.2) : 0,
      appointment.staffRating,
      appointment.createdAt
    ]
  );

  await query(
    `
      INSERT INTO appointment_services (
        appointment_id, service_id, sort_order, price_snapshot,
        duration_snapshot, service_name_snapshot, created_at
      )
      VALUES (?, ?, 0, ?, ?, ?, ?)
    `,
    [
      result.insertId,
      appointment.service.id,
      appointment.service.price,
      appointment.service.duration,
      appointment.service.name,
      appointment.createdAt
    ]
  );

  return result.insertId;
};

const refreshCancellationCounters = async () => {
  await query(
    `
      UPDATE users u
      LEFT JOIN (
        SELECT user_id, SUM(status = 'cancelled') AS cancellation_count
        FROM appointments
        GROUP BY user_id
      ) stats ON stats.user_id = u.id
      SET u.cancellation_count = COALESCE(stats.cancellation_count, 0)
      WHERE u.email LIKE ?
    `,
    [`${SEED_PREFIX}-%@example.com`]
  );
};

const main = async () => {
  if (!Number.isInteger(DEFAULT_YEAR) || DEFAULT_YEAR < 2000) {
    throw new Error('DEC_SEED_YEAR khong hop le.');
  }

  if (!Number.isInteger(DEFAULT_MONTH) || DEFAULT_MONTH < 1 || DEFAULT_MONTH > 12) {
    throw new Error('DEC_SEED_MONTH khong hop le.');
  }

  const [services, staff] = await Promise.all([
    query("SELECT id, name, price, duration FROM services WHERE status = 'active' ORDER BY price ASC"),
    query("SELECT id, name FROM users WHERE role = 'staff' AND is_active = 1 ORDER BY id")
  ]);

  if (services.length < 3) {
    throw new Error('Can it nhat 3 dich vu active de seed du lieu DEC.');
  }

  await deleteExistingSeedAppointments();
  const customers = await upsertCustomers();
  const serviceBuckets = getServiceBuckets(services);

  let appointmentCount = 0;
  for (const customer of customers) {
    const appointments = buildAppointmentsForGroup({
      groupKey: customer.groupKey,
      customerIndex: customer.index,
      services: serviceBuckets,
      staff
    });

    for (const appointment of appointments) {
      await insertAppointment(customer.id, appointment);
      appointmentCount += 1;
    }
  }

  await refreshCancellationCounters();

  const report = await decClusteringService.getDecClusteringReport({
    year: DEFAULT_YEAR,
    month: DEFAULT_MONTH,
    limitPerCluster: 100
  });

  console.log(`Seeded ${customers.length} DEC customers.`);
  console.log(`Seeded ${appointmentCount} self-booked appointments.`);
  console.log(`Password for all seed customers: ${DEFAULT_PASSWORD}`);
  console.log(`Period: ${DEFAULT_MONTH}/${DEFAULT_YEAR}`);
  console.log(`DEC total customers in period: ${report.summary.total_customers}`);
  report.clusters.forEach((cluster, index) => {
    console.log(`Cluster ${index + 1} - ${cluster.key}: ${cluster.count}`);
  });
};

main()
  .catch((err) => {
    console.error('[SEED_DEC_CUSTOMERS_ERROR]', err);
    process.exitCode = 1;
  })
  .finally(() => {
    db.end();
  });
