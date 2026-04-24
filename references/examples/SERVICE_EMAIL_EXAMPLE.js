/**
 * EMAIL SERVICE - Email Management & Automation
 * Path: /backend/src/services/emailService.js
 */

const nodemailer = require('nodemailer');
const db = require('../config/db');
const fs = require('fs').promises;
const path = require('path');
const handlebars = require('handlebars');

class EmailService {
  constructor() {
    this.initTransporter();
  }

  /**
   * Initialize email transporter with Gmail
   */
  initTransporter() {
    // Load from environment
    const serviceAccount = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);

    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        type: 'OAuth2',
        user: process.env.EMAIL_USER,
        clientId: serviceAccount.client_id,
        clientSecret: serviceAccount.client_secret,
        refreshToken: process.env.EMAIL_REFRESH_TOKEN
      }
    });
  }

  /**
   * Load and compile email template
   */
  async loadTemplate(templateName) {
    const templatePath = path.join(__dirname, '../templates/email', `${templateName}.html`);
    const templateContent = await fs.readFile(templatePath, 'utf-8');
    return handlebars.compile(templateContent);
  }

  /**
   * Send account verification email
   */
  async sendVerificationEmail(customer, token) {
    const template = await this.loadTemplate('account-verification');
    const verificationLink = `${process.env.FRONTEND_URL}/verify-email/${token}`;

    const html = template({
      customerName: customer.name,
      verificationLink,
      expiryHours: 24
    });

    const emailData = {
      recipient_email: customer.email,
      customer_id: customer.id,
      email_type: 'verification',
      subject: '[Your Business] Xác thực tài khoản - Verify Your Account',
      body_html: html,
      template_name: 'account-verification',
      variables: JSON.stringify({ customerName: customer.name, token })
    };

    return this.queueEmail(emailData);
  }

  /**
   * Send voucher notification email
   */
  async sendVoucherEmail(customer, voucher) {
    const template = await this.loadTemplate('voucher-notification');
    const shopLink = `${process.env.FRONTEND_URL}/shop?voucher=${voucher.code}`;

    const discountDisplay = voucher.voucher_type === 'percentage'
      ? `-${voucher.discount_percent}%`
      : `Miễn phí`;

    const daysRemaining = Math.ceil(
      (new Date(voucher.expiry_date) - new Date()) / (1000 * 60 * 60 * 24)
    );

    const html = template({
      customerName: customer.name,
      customerType: customer.customer_type === 'vip' ? 'VIP' : 'Thường',
      discountValue: discountDisplay,
      voucherCode: voucher.code,
      voucherDescription: voucher.description,
      expiryDate: new Date(voucher.expiry_date).toLocaleDateString('vi-VN'),
      daysRemaining,
      maxDiscount: voucher.max_discount_amount ? `${voucher.max_discount_amount.toLocaleString()} VND` : 'Không giới hạn',
      minOrder: voucher.min_order_value ? `${voucher.min_order_value.toLocaleString()} VND` : 'Không',
      shopLink,
      voucherConditions: this.generateVoucherConditions(voucher)
    });

    const emailData = {
      recipient_email: customer.email,
      customer_id: customer.id,
      email_type: 'voucher',
      subject: '🎉 Voucher độc quyền từ [Your Business] - Exclusive Offer Inside!',
      body_html: html,
      template_name: 'voucher-notification',
      variables: JSON.stringify({ code: voucher.code, discount: discountDisplay })
    };

    return this.queueEmail(emailData);
  }

  /**
   * Send bill/receipt email
   */
  async sendBillEmail(customer, bill, appointmentDetails) {
    const template = await this.loadTemplate('bill-receipt');

    const servicesRows = appointmentDetails.services
      .map(service => `
        <tr>
          <td>${service.name}</td>
          <td>${service.quantity}</td>
          <td>${service.price.toLocaleString()} VND</td>
          <td>${(service.quantity * service.price).toLocaleString()} VND</td>
        </tr>
      `)
      .join('');

    const voucherDiscount = bill.voucher_discount > 0
      ? `<div class="total-row discount">
           <span>Giảm giá voucher:</span>
           <span>-${bill.voucher_discount.toLocaleString()} VND</span>
         </div>`
      : '';

    const html = template({
      billNumber: bill.bill_number,
      paymentDate: new Date(bill.created_at).toLocaleDateString('vi-VN'),
      paymentTime: new Date(bill.created_at).toLocaleTimeString('vi-VN'),
      customerName: customer.name,
      customerPhone: customer.phone,
      customerEmail: customer.email,
      customerId: customer.id,
      appointmentId: bill.appointment_id,
      appointmentDate: new Date(appointmentDetails.appointment_date).toLocaleDateString('vi-VN'),
      appointmentTime: appointmentDetails.appointment_time,
      servicesRows,
      subtotal: bill.subtotal.toLocaleString(),
      voucherDiscount,
      taxAmount: bill.tax_amount.toLocaleString(),
      totalAmount: bill.total_amount.toLocaleString(),
      paymentMethod: bill.payment_method,
      transactionId: bill.transaction_id
    });

    const emailData = {
      recipient_email: customer.email,
      customer_id: customer.id,
      email_type: 'bill',
      subject: `Biên lai thanh toán - ${bill.bill_number}`,
      body_html: html,
      template_name: 'bill-receipt',
      variables: JSON.stringify({ billNumber: bill.bill_number })
    };

    return this.queueEmail(emailData);
  }

  /**
   * Send promotional campaign email
   */
  async sendCampaignEmail(customer, campaign) {
    const template = await this.loadTemplate('promotion-campaign');

    const offersCards = campaign.offers
      .map(offer => {
        const badge = offer.type === 'discount'
          ? `<span class="offer-badge discount">-${offer.value}%</span>`
          : `<span class="offer-badge">Free Delivery</span>`;

        return `
          <div class="offer-card">
            <div class="offer-title">${offer.title}</div>
            <div class="offer-description">${offer.description}</div>
            ${badge}
            <span class="offer-badge expiry">Expires: ${offer.expiryDate}</span>
            <div class="offer-code" onclick="this.select()">${offer.code}</div>
          </div>
        `;
      })
      .join('');

    const mainOffer = campaign.mainOffer
      ? `
        <div class="highlighted-offer">
          <div class="title">⚡ ${campaign.mainOffer.title}</div>
          <p>${campaign.mainOffer.description}</p>
          <div class="offer-code" onclick="this.select()">${campaign.mainOffer.code}</div>
        </div>
      `
      : '';

    const html = template({
      customerName: customer.name,
      weekNumber: this.getWeekNumber(),
      mainOffer,
      offersCards,
      endDate: campaign.endDate,
      shopLink: `${process.env.FRONTEND_URL}/shop`,
      testimonial: 'Tôi rất thích các ưu đãi được cá nhân hóa từ dịch vụ này!',
      testimonialAuthor: 'Khách hàng hài lòng',
      facebookLink: process.env.FACEBOOK_URL,
      instagramLink: process.env.INSTAGRAM_URL,
      twitterLink: process.env.TWITTER_URL,
      unsubscribeLink: `${process.env.FRONTEND_URL}/unsubscribe/${customer.id}`
    });

    const emailData = {
      recipient_email: customer.email,
      customer_id: customer.id,
      email_type: 'campaign',
      subject: `[PROMO] Khuyến mãi tuần này - Week ${this.getWeekNumber()}`,
      body_html: html,
      template_name: 'promotion-campaign',
      variables: JSON.stringify({ campaignId: campaign.id })
    };

    return this.queueEmail(emailData);
  }

  /**
   * Queue email to database
   */
  async queueEmail(emailData) {
    try {
      const query = `
        INSERT INTO email_queue (
          recipient_email, customer_id, email_type, subject,
          body_html, template_name, variables, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')
      `;

      const [result] = await db.query(query, [
        emailData.recipient_email,
        emailData.customer_id,
        emailData.email_type,
        emailData.subject,
        emailData.body_html,
        emailData.template_name,
        emailData.variables
      ]);

      return {
        success: true,
        queueId: result.insertId,
        message: 'Email queued for sending'
      };
    } catch (error) {
      console.error('Error queueing email:', error);
      throw error;
    }
  }

  /**
   * Process email queue (called by cron job)
   */
  async processQueue() {
    try {
      const query = `
        SELECT * FROM email_queue
        WHERE status = 'pending' AND retry_count < max_retries
        LIMIT 10
      `;

      const [emails] = await db.query(query);

      for (let email of emails) {
        await this.sendQueuedEmail(email);
      }

      console.log(`Processed ${emails.length} emails from queue`);
      return { success: true, processed: emails.length };
    } catch (error) {
      console.error('Error processing email queue:', error);
      throw error;
    }
  }

  /**
   * Send single queued email
   */
  async sendQueuedEmail(email) {
    try {
      await this.transporter.sendMail({
        from: `${process.env.EMAIL_DISPLAY_NAME} <${process.env.EMAIL_USER}>`,
        to: email.recipient_email,
        subject: email.subject,
        html: email.body_html,
        replyTo: process.env.EMAIL_REPLY_TO
      });

      // Update email status to sent
      const updateQuery = `
        UPDATE email_queue
        SET status = 'sent', sent_at = NOW()
        WHERE id = ?
      `;

      await db.query(updateQuery, [email.id]);

      return { success: true };
    } catch (error) {
      console.error(`Error sending email ${email.id}:`, error);

      // Update retry count
      const retryQuery = `
        UPDATE email_queue
        SET retry_count = retry_count + 1, error_message = ?
        WHERE id = ?
      `;

      await db.query(retryQuery, [error.message, email.id]);

      if (error.response && error.response.includes('Invalid email')) {
        // Mark as bounced if email is invalid
        const bounceQuery = `UPDATE email_queue SET status = 'bounced' WHERE id = ?`;
        await db.query(bounceQuery, [email.id]);
      }
    }
  }

  /**
   * Helper: Generate voucher conditions
   */
  generateVoucherConditions(voucher) {
    const conditions = [];
    
    if (voucher.min_order_value) {
      conditions.push(`<li>Giá trị tối thiểu đơn hàng: ${voucher.min_order_value.toLocaleString()} VND</li>`);
    }
    
    if (voucher.max_discount_amount) {
      conditions.push(`<li>Giảm giá tối đa: ${voucher.max_discount_amount.toLocaleString()} VND</li>`);
    }
    
    conditions.push(`<li>Hạn sử dụng: ${new Date(voucher.expiry_date).toLocaleDateString('vi-VN')}</li>`);
    conditions.push(`<li>Chỉ áp dụng 1 lần trên mỗi khách hàng</li>`);
    
    return conditions.join('');
  }

  /**
   * Helper: Get current week number
   */
  getWeekNumber() {
    const d = new Date();
    const firstDay = new Date(d.getFullYear(), 0, 1);
    const passedDays = Math.floor((d - firstDay) / (24 * 60 * 60 * 1000));
    return Math.ceil((d.getDay() + 1 + passedDays) / 7);
  }
}

module.exports = new EmailService();
