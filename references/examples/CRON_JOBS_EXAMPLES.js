/**
 * CRON JOBS - Automated Tasks for Voucher & Email System
 * Path: /backend/src/jobs/
 */

// ===================================================================
// FILE 1: voucherExpiryNotificationCron.js
// Runs every day at 9:00 AM to send expiry reminders
// ===================================================================

const schedule = require('node-schedule');
const db = require('../config/db');
const emailService = require('../services/emailService');

async function voucherExpiryNotificationJob() {
  console.log('Starting voucher expiry notification job...');

  try {
    // Find vouchers expiring in 24 hours
    const query = `
      SELECT DISTINCT va.customer_id, v.id, v.code, v.description, v.voucher_type,
        v.discount_amount, v.discount_percent, v.expiry_date, v.max_discount_amount,
        v.min_order_value, va.assigned_date
      FROM voucher_assignments va
      JOIN vouchers v ON va.voucher_id = v.id
      JOIN customers c ON va.customer_id = c.id
      WHERE v.expiry_date > NOW()
        AND v.expiry_date <= DATE_ADD(NOW(), INTERVAL 1 DAY)
        AND va.status = 'active'
        AND v.status = 'active'
        AND c.email_opt_in = TRUE
      ORDER BY va.customer_id
    `;

    const [results] = await db.query(query);

    let notificationCount = 0;

    for (let row of results) {
      try {
        // Get customer details
        const customerQuery = 'SELECT id, name, email FROM customers WHERE id = ?';
        const [customers] = await db.query(customerQuery, [row.customer_id]);

        if (customers.length === 0) continue;

        const customer = customers[0];
        const voucher = {
          code: row.code,
          description: row.description,
          voucher_type: row.voucher_type,
          discount_amount: row.discount_amount,
          discount_percent: row.discount_percent,
          expiry_date: row.expiry_date,
          max_discount_amount: row.max_discount_amount,
          min_order_value: row.min_order_value
        };

        // Send reminder email
        await emailService.sendVoucherEmail(customer, voucher);
        notificationCount++;

        console.log(`Sent expiry reminder to ${customer.email} for voucher ${row.code}`);
      } catch (error) {
        console.error(`Error sending reminder to customer ${row.customer_id}:`, error);
      }
    }

    console.log(`Voucher expiry notification completed. Sent ${notificationCount} reminders.`);
    return { success: true, sent: notificationCount };
  } catch (error) {
    console.error('Error in voucher expiry notification job:', error);
  }
}

// Schedule job: Every day at 9:00 AM
schedule.scheduleJob('0 9 * * *', voucherExpiryNotificationJob);

module.exports = { voucherExpiryNotificationJob };

// ===================================================================
// FILE 2: voucherSuggestionCron.js
// Runs daily to generate and suggest vouchers to customers
// ===================================================================

const voucherService = require('../services/voucherService');

async function voucherSuggestionJob() {
  console.log('Starting voucher suggestion job...');

  try {
    // Get active customers from past 7 days
    const customersQuery = `
      SELECT c.id, c.name, c.email, c.customer_type,
        COUNT(DISTINCT a.id) as total_orders,
        MAX(a.appointment_date) as last_order_date,
        DATEDIFF(NOW(), MAX(a.appointment_date)) as days_since_last_order,
        GROUP_CONCAT(DISTINCT s.category) as preferred_categories
      FROM customers c
      LEFT JOIN appointments a ON c.id = a.customer_id
      LEFT JOIN appointment_services asa ON a.id = asa.appointment_id
      LEFT JOIN services s ON asa.service_id = s.id
      WHERE c.active = TRUE AND c.email_opt_in = TRUE
      GROUP BY c.id
      HAVING last_order_date IS NOT NULL
    `;

    const [customers] = await db.query(customersQuery);

    let suggestionsCount = 0;

    for (let customer of customers) {
      try {
        // Determine suggestion reason
        let reason = null;
        let voucherId = null;

        // Rule 1: Come back discount (if inactive > 14 days)
        if (customer.days_since_last_order > 14) {
          reason = 'comeback';
          // Get comeback vouchers
          const comebackVouchersQuery = `
            SELECT id FROM vouchers
            WHERE customer_type IN (?, 'both')
              AND status = 'active'
              AND description LIKE '%comeback%'
              AND expiry_date > NOW()
            LIMIT 1
          `;

          const [comebackVouchers] = await db.query(comebackVouchersQuery, [
            customer.customer_type
          ]);

          if (comebackVouchers.length > 0) {
            voucherId = comebackVouchers[0].id;
          }
        }

        // Rule 2: Category preference (new service in preferred category)
        if (!reason && customer.preferred_categories) {
          reason = 'category_preference';
          const categories = customer.preferred_categories.split(',');

          const categoryVouchersQuery = `
            SELECT v.id FROM vouchers v
            WHERE customer_type IN (?, 'both')
              AND status = 'active'
              AND FIND_IN_SET(v.description, ?) > 0
              AND expiry_date > NOW()
            LIMIT 1
          `;

          const [categoryVouchers] = await db.query(categoryVouchersQuery, [
            customer.customer_type,
            categories[0]
          ]);

          if (categoryVouchers.length > 0) {
            voucherId = categoryVouchers[0].id;
          }
        }

        // Rule 3: VIP exclusive offer
        if (!reason && customer.customer_type === 'vip') {
          reason = 'vip_exclusive';

          const vipVouchersQuery = `
            SELECT id FROM vouchers
            WHERE customer_type = 'vip'
              AND status = 'active'
              AND expiry_date > NOW()
            ORDER BY discount_percent DESC
            LIMIT 1
          `;

          const [vipVouchers] = await db.query(vipVouchersQuery);

          if (vipVouchers.length > 0) {
            voucherId = vipVouchers[0].id;
          }
        }

        // Store suggestion if found
        if (voucherId) {
          const suggestQuery = `
            INSERT INTO voucher_suggestions (
              customer_id, voucher_id, reason, confidence_score, shown_date
            ) VALUES (?, ?, ?, ?, NOW())
            ON DUPLICATE KEY UPDATE shown_date = NOW()
          `;

          await db.query(suggestQuery, [
            customer.id,
            voucherId,
            reason,
            0.85 // Confidence score
          ]);

          suggestionsCount++;
          console.log(`Suggested voucher to customer ${customer.id}: ${reason}`);
        }
      } catch (error) {
        console.error(`Error suggesting voucher to customer ${customer.id}:`, error);
      }
    }

    console.log(`Voucher suggestion job completed. Created ${suggestionsCount} suggestions.`);
    return { success: true, created: suggestionsCount };
  } catch (error) {
    console.error('Error in voucher suggestion job:', error);
  }
}

// Schedule job: Every day at 8:00 AM
schedule.scheduleJob('0 8 * * *', voucherSuggestionJob);

module.exports = { voucherSuggestionJob };

// ===================================================================
// FILE 3: campaignSchedulerCron.js
// Runs at different times for email campaign automation
// ===================================================================

const emailService = require('../services/emailService');

async function automatedCampaignJob() {
  console.log('Starting automated email campaign job...');

  try {
    // Get scheduled campaigns
    const campaignsQuery = `
      SELECT * FROM email_campaigns
      WHERE status = 'scheduled'
        AND scheduled_send_time <= NOW()
    `;

    const [campaigns] = await db.query(campaignsQuery);

    let campaignCount = 0;

    for (let campaign of campaigns) {
      try {
        // Get customers based on segment filter
        const segmentFilter = JSON.parse(campaign.segment_filter || '{}');

        const customersQuery = this.buildSegmentQuery(segmentFilter);
        const [customers] = await db.query(customersQuery);

        // Update campaign to sending
        await db.query(
          'UPDATE email_campaigns SET status = ? WHERE id = ?',
          ['sending', campaign.id]
        );

        // Send emails to each customer
        let sentCount = 0;
        for (let customer of customers) {
          try {
            await emailService.sendCampaignEmail(customer, campaign);
            sentCount++;
          } catch (error) {
            console.error(`Error sending campaign to ${customer.email}:`, error);
          }
        }

        // Update campaign completed
        const updateQuery = `
          UPDATE email_campaigns
          SET status = 'completed', sent_count = ?, updated_at = NOW()
          WHERE id = ?
        `;

        await db.query(updateQuery, [sentCount, campaign.id]);

        campaignCount++;
        console.log(`Campaign ${campaign.id} completed. Sent to ${sentCount} customers.`);
      } catch (error) {
        console.error(`Error processing campaign ${campaign.id}:`, error);

        // Mark as failed
        await db.query(
          'UPDATE email_campaigns SET status = ? WHERE id = ?',
          ['failed', campaign.id]
        );
      }
    }

    console.log(`Campaign scheduler job completed. Processed ${campaignCount} campaigns.`);
    return { success: true, processed: campaignCount };
  } catch (error) {
    console.error('Error in campaign scheduler job:', error);
  }
}

/**
 * Build SQL query based on segment filter
 */
function buildSegmentQuery(filter) {
  let query = `
    SELECT c.id, c.name, c.email, c.customer_type
    FROM customers c
    WHERE c.active = TRUE AND c.email_opt_in = TRUE
  `;

  if (filter.customerType) {
    query += ` AND c.customer_type = '${filter.customerType}'`;
  }

  if (filter.minTotalSpent) {
    query += ` AND c.total_spent >= ${filter.minTotalSpent}`;
  }

  if (filter.lastActivityDaysAgo) {
    query += ` AND DATEDIFF(NOW(), c.last_activity_date) <= ${filter.lastActivityDaysAgo}`;
  }

  return query;
}

// Schedule jobs for different campaign types

// Weekly campaigns - Every Monday at 8:00 AM
schedule.scheduleJob('0 8 * * 1', automatedCampaignJob);

// Daily comeback offers - Every day at 2:00 PM
schedule.scheduleJob('0 14 * * *', automatedCampaignJob);

// Monthly birthday vouchers - 1st of month at 8:00 AM
schedule.scheduleJob('0 8 1 * *', automatedCampaignJob);

module.exports = { automatedCampaignJob };

// ===================================================================
// FILE 4: emailQueueProcessor.js
// Runs every 5 minutes to process pending emails
// ===================================================================

async function emailQueueProcessor() {
  console.log('[' + new Date().toISOString() + '] Processing email queue...');

  try {
    const result = await emailService.processQueue();
    if (result.processed > 0) {
      console.log(`Processed ${result.processed} emails from queue`);
    }
  } catch (error) {
    console.error('Error processing email queue:', error);
  }
}

// Schedule job: Every 5 minutes
schedule.scheduleJob('*/5 * * * *', emailQueueProcessor);

module.exports = { emailQueueProcessor };

// ===================================================================
// FILE 5: customerClassificationCron.js
// Runs daily to re-classify customers (Regular <-> VIP)
// ===================================================================

async function customerClassificationJob() {
  console.log('Starting customer classification job...');

  try {
    // Get all active customers
    const customersQuery = 'SELECT id FROM customers WHERE active = TRUE';
    const [customers] = await db.query(customersQuery);

    let updatedCount = 0;

    for (let customer of customers) {
      try {
        // Classify customer
        const newType = await voucherService.classifyCustomer(customer.id);

        // Get current type
        const currentQuery = 'SELECT customer_type FROM customers WHERE id = ?';
        const [current] = await db.query(currentQuery, [customer.id]);

        if (current[0].customer_type !== newType) {
          // Update type
          await voucherService.updateCustomerType(customer.id, newType);
          updatedCount++;

          console.log(`Updated customer ${customer.id} from ${current[0].customer_type} to ${newType}`);

          // If promoted to VIP, send welcome email
          if (newType === 'vip') {
            // TODO: Send VIP welcome email
          }
        }
      } catch (error) {
        console.error(`Error classifying customer ${customer.id}:`, error);
      }
    }

    console.log(`Customer classification job completed. Updated ${updatedCount} customers.`);
    return { success: true, updated: updatedCount };
  } catch (error) {
    console.error('Error in customer classification job:', error);
  }
}

// Schedule job: Every day at 3:00 AM
schedule.scheduleJob('0 3 * * *', customerClassificationJob);

module.exports = { customerClassificationJob };
