const cron = require('node-cron');
const db = require('../config/db');
const path = require('path');
const fs = require('fs');

let mailService = null;
try {
  mailService = require('../services/mailService');
} catch (err) {
  console.log('[Reminder] mailService not available, reminders will be logged only');
}

const loadTemplate = () => {
  const templatePath = path.join(__dirname, '..', 'templates', 'email', 'appointment-reminder.html');
  try {
    return fs.readFileSync(templatePath, 'utf8');
  } catch (err) {
    console.error('[Reminder] Cannot load email template:', err.message);
    return null;
  }
};

const formatCurrency = (amount) =>
  new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0
  }).format(Number(amount || 0));

const formatTime = (timeStr) => {
  if (!timeStr) return '';
  const parts = String(timeStr).split(':');
  return `${parts[0]}:${parts[1]}`;
};

const formatDate = (dateVal) => {
  if (!dateVal) return '';
  const d = new Date(dateVal);
  const days = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
  return `${days[d.getDay()]}, ${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
};

const waitForDatabase = async () => {
  if (db.ready) {
    await db.ready;
  }
};

const getUpcomingAppointments = async () => {
  await waitForDatabase();

  return new Promise((resolve, reject) => {
    const query = `
      SELECT
        a.id,
        a.appointment_date,
        a.appointment_time,
        a.end_time,
        a.total_amount,
        a.status,
        a.reminder_sent,
        u.name AS customer_name,
        u.email AS customer_email,
        s.name AS service_name,
        s.duration AS service_duration,
        staff.name AS staff_name
      FROM appointments a
      JOIN users u ON a.user_id = u.id
      LEFT JOIN services s ON a.service_id = s.id
      LEFT JOIN users staff ON a.staff_id = staff.id
      WHERE a.appointment_date = CURDATE()
        AND a.status IN ('pending', 'confirmed')
        AND (a.reminder_sent IS NULL OR a.reminder_sent = 0)
        AND a.appointment_time >= ADDTIME(CURTIME(), '01:30:00')
        AND a.appointment_time <= ADDTIME(CURTIME(), '02:30:00')
      ORDER BY a.appointment_time ASC
    `;

    db.query(query, (err, results) => {
      if (err) return reject(err);
      resolve(results || []);
    });
  });
};

const markReminderSent = async (appointmentId) => {
  await waitForDatabase();

  return new Promise((resolve, reject) => {
    db.query(
      'UPDATE appointments SET reminder_sent = 1, reminder_sent_at = NOW() WHERE id = ?',
      [appointmentId],
      (err) => {
        if (err) return reject(err);
        resolve();
      }
    );
  });
};

const sendReminderEmail = async (appointment, template) => {
  const hasMailConfig = Boolean(
    (process.env.SMTP_HOST || process.env.EMAIL_HOST) &&
      (process.env.SMTP_USER || process.env.EMAIL_USER) &&
      (process.env.SMTP_PASS || process.env.EMAIL_PASSWORD)
  );

  if (!mailService || !template || !hasMailConfig) {
    console.log(`[Reminder] Would send to ${appointment.customer_email} for appointment #${appointment.id}`);
    return true;
  }

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

  const html = template
    .replace(/\{\{customerName\}\}/g, appointment.customer_name || 'Quý khách')
    .replace(/\{\{appointmentTime\}\}/g, formatTime(appointment.appointment_time))
    .replace(/\{\{appointmentDate\}\}/g, formatDate(appointment.appointment_date))
    .replace(/\{\{serviceName\}\}/g, appointment.service_name || 'Dịch vụ làm đẹp')
    .replace(/\{\{staffName\}\}/g, appointment.staff_name || 'Nhân viên salon')
    .replace(/\{\{duration\}\}/g, `${appointment.service_duration || 60} phút`)
    .replace(/\{\{totalAmount\}\}/g, formatCurrency(appointment.total_amount))
    .replace(/\{\{appointmentLink\}\}/g, `${frontendUrl}/my-appointments`);

  try {
    await mailService.sendEmail({
      to: appointment.customer_email,
      subject: `⏰ Nhắc lịch hẹn: ${formatTime(appointment.appointment_time)} hôm nay - BeautyBook`,
      html
    });
    return true;
  } catch (err) {
    console.error(`[Reminder] Failed to send to ${appointment.customer_email}:`, err.message);
    return false;
  }
};

const processReminders = async () => {
  try {
    const appointments = await getUpcomingAppointments();

    if (appointments.length === 0) {
      return;
    }

    console.log(`[Reminder] Found ${appointments.length} appointments to remind`);
    const template = loadTemplate();

    for (const apt of appointments) {
      const sent = await sendReminderEmail(apt, template);
      if (sent) {
        await markReminderSent(apt.id);
        console.log(`[Reminder] ✅ Sent reminder for appointment #${apt.id} to ${apt.customer_email}`);
      }
    }
  } catch (err) {
    console.error('[Reminder] Error processing reminders:', err.message);
  }
};

const expireVouchers = async () => {
  await waitForDatabase();

  return new Promise((resolve, reject) => {
    db.query(
      "UPDATE vouchers SET status = 'expired' WHERE expiry_date <= NOW() AND status = 'active'",
      (err, results) => {
        if (err) return reject(err);
        if (results.affectedRows > 0) {
          console.log(`[Voucher-Job] 🚨 Auto-expired ${results.affectedRows} vouchers`);
        }
        resolve();
      }
    );
  });
};

const startReminderJob = () => {
  // Run on startup
  console.log('[Reminder] Running initial auto-expiration check for vouchers...');
  expireVouchers().catch((err) => console.error('[Voucher-Job] Initial check error:', err.message));

  // Run every 15 minutes
  cron.schedule('*/15 * * * *', () => {
    console.log(`[Reminder] Checking for upcoming appointments at ${new Date().toLocaleString('vi-VN')}`);
    processReminders();
    expireVouchers().catch((err) => console.error('[Voucher-Job] Error:', err.message));
  });

  console.log('[Reminder] ✅ Appointment reminder job scheduled (every 15 minutes)');
};

module.exports = { startReminderJob, processReminders, expireVouchers };
