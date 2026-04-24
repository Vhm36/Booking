/**
 * BILL SERVICE - Auto Bill Generation & Management
 * Path: /backend/src/services/billService.js
 */

const db = require('../config/db');
const PDFDocument = require('pdfkit');
const fs = require('fs').promises;
const path = require('path');
const emailService = require('./emailService');

class BillService {
  /**
   * Generate bill PDF
   */
  async generateBillPDF(billData, outputPath) {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4' });
      const stream = fs.createWriteStream(outputPath);

      doc.pipe(stream);

      // Header
      doc
        .fontSize(24)
        .font('Helvetica-Bold')
        .text('BIÊN LAI THANH TOÁN', 50, 50, { align: 'center' })
        .fontSize(12)
        .font('Helvetica')
        .text('Payment Receipt / Invoice', 50, 85, { align: 'center' });

      // Bill Info
      doc.fontSize(11).text('───────────────────────────────────', 50, 110);
      doc.fontSize(10).text(`Mã biên lai: ${billData.billNumber}`, 50, 130);
      doc.text(`Ngày thanh toán: ${new Date(billData.createdAt).toLocaleDateString('vi-VN')}`, 50, 145);
      doc.text(`Giờ: ${new Date(billData.createdAt).toLocaleTimeString('vi-VN')}`, 50, 160);

      // Customer Info
      doc.fontSize(11).font('Helvetica-Bold').text('Thông tin khách hàng', 50, 190);
      doc.fontSize(10).font('Helvetica');
      doc.text(`Họ tên: ${billData.customerName}`, 50, 210);
      doc.text(`Số điện thoại: ${billData.customerPhone}`, 50, 225);
      doc.text(`Email: ${billData.customerEmail}`, 50, 240);
      doc.text(`Mã khách: CUST-${billData.customerId}`, 50, 255);

      // Service Details Table
      const tableTop = 290;
      const col1 = 50;
      const col2 = 300;
      const col3 = 400;
      const col4 = 500;

      doc.fontSize(11).font('Helvetica-Bold').text('Chi tiết dịch vụ', 50, 270);
      doc.fontSize(9).font('Helvetica');

      // Table Header
      doc.text('Dịch vụ', col1, tableTop, { width: 250 });
      doc.text('SL', col2, tableTop, { width: 100 });
      doc.text('Đơn giá', col3, tableTop, { width: 100 });
      doc.text('Thành tiền', col4, tableTop, { width: 100 });

      doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();

      // Services
      let currentY = tableTop + 25;
      billData.services.forEach(service => {
        doc.fontSize(9).text(service.name, col1, currentY, { width: 250 });
        doc.text(service.quantity, col2, currentY);
        doc.text(`${service.price.toLocaleString()}`, col3, currentY);
        doc.text(`${(service.quantity * service.price).toLocaleString()}`, col4, currentY);
        currentY += 25;
      });

      // Total Section
      currentY += 10;
      doc.moveTo(50, currentY).lineTo(550, currentY).stroke();

      doc.fontSize(10).font('Helvetica');
      currentY += 15;
      doc.text('Cộng tiền hàng:', col1, currentY);
      doc.text(
        `${billData.subtotal.toLocaleString()} VND`,
        col4,
        currentY,
        { align: 'right', width: 100 }
      );

      currentY += 20;
      if (billData.voucherDiscount > 0) {
        doc.font('Helvetica').text('Giảm giá voucher:', col1, currentY);
        doc.text(
          `-${billData.voucherDiscount.toLocaleString()} VND`,
          col4,
          currentY,
          { align: 'right', width: 100 }
        );
        currentY += 20;
      }

      doc.text('Thuế VAT (10%):', col1, currentY);
      doc.text(
        `${billData.taxAmount.toLocaleString()} VND`,
        col4,
        currentY,
        { align: 'right', width: 100 }
      );

      currentY += 25;
      doc.moveTo(50, currentY).lineTo(550, currentY).stroke();

      // Total Amount
      doc.fontSize(12).font('Helvetica-Bold');
      currentY += 15;
      doc.text('TỔNG THANH TOÁN:', col1, currentY);
      doc.text(
        `${billData.totalAmount.toLocaleString()} VND`,
        col4,
        currentY,
        { align: 'right', width: 100 }
      );

      // Payment Info
      currentY += 35;
      doc.fontSize(10).font('Helvetica-Bold');
      doc.fillColor('#4CAF50').text('✓ THANH TOÁN THÀNH CÔNG', 50, currentY);
      doc.fillColor('black').fontSize(9).font('Helvetica');
      currentY += 20;
      doc.text(`Phương thức: ${billData.paymentMethod}`, 50, currentY);
      currentY += 15;
      doc.text(`Mã giao dịch: ${billData.transactionId}`, 50, currentY);

      // Footer
      doc.fontSize(8).text(
        '© 2026 Your Business Name. Đây là biên lai điện tử hợp lệ.',
        50,
        750,
        { align: 'center' }
      );

      doc.end();

      stream.on('finish', () => {
        resolve({ success: true, path: outputPath });
      });

      stream.on('error', reject);
    });
  }

  /**
   * Create bill record in database
   */
  async createBill(billData) {
    try {
      const billNumber = this.generateBillNumber();

      const insertQuery = `
        INSERT INTO bills (
          bill_number, appointment_id, customer_id,
          subtotal, voucher_discount, tax_amount, total_amount,
          payment_method, transaction_id, bill_pdf_path
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const [result] = await db.query(insertQuery, [
        billNumber,
        billData.appointmentId,
        billData.customerId,
        billData.subtotal,
        billData.voucherDiscount || 0,
        billData.taxAmount,
        billData.totalAmount,
        billData.paymentMethod,
        billData.transactionId,
        billData.pdfPath
      ]);

      // Update appointment with bill reference
      const updateAppointmentQuery = `
        UPDATE appointments
        SET bill_id = ?, bill_generated_at = NOW(), bill_sent_via_email = FALSE
        WHERE id = ?
      `;

      await db.query(updateAppointmentQuery, [result.insertId, billData.appointmentId]);

      return {
        success: true,
        billId: result.insertId,
        billNumber
      };
    } catch (error) {
      console.error('Error creating bill:', error);
      throw error;
    }
  }

  /**
   * Process payment and auto-generate bill
   */
  async processPaymentAndGenerateBill(appointmentId, paymentData) {
    try {
      // Get appointment details
      const appointmentQuery = `
        SELECT
          a.id, a.customer_id, a.appointment_date, a.appointment_time,
          c.name as customer_name, c.phone as customer_phone, c.email as customer_email
        FROM appointments a
        JOIN customers c ON a.customer_id = c.id
        WHERE a.id = ?
      `;

      const [appointments] = await db.query(appointmentQuery, [appointmentId]);
      if (!appointments.length) throw new Error('Appointment not found');

      const appointment = appointments[0];

      // Get services for appointment
      const servicesQuery = `
        SELECT s.name, s.price, asa.quantity
        FROM appointment_services asa
        JOIN services s ON asa.service_id = s.id
        WHERE asa.appointment_id = ?
      `;

      const [services] = await db.query(servicesQuery, [appointmentId]);

      // Calculate totals
      const subtotal = services.reduce((sum, s) => sum + (s.price * s.quantity), 0);
      const voucherDiscount = paymentData.voucherDiscount || 0;
      const taxAmount = subtotal * 0.1; // 10% VAT
      const totalAmount = subtotal - voucherDiscount + taxAmount;

      // Prepare bill data
      const billData = {
        appointmentId,
        customerId: appointment.customer_id,
        customerName: appointment.customer_name,
        customerPhone: appointment.customer_phone,
        customerEmail: appointment.customer_email,
        services,
        subtotal,
        voucherDiscount,
        taxAmount: Math.round(taxAmount * 100) / 100,
        totalAmount: Math.round(totalAmount * 100) / 100,
        paymentMethod: paymentData.method,
        transactionId: paymentData.transactionId,
        createdAt: new Date()
      };

      // Generate PDF
      const billsDir = path.join(__dirname, '../../uploads/bills');
      await fs.mkdir(billsDir, { recursive: true });

      const pdfFilename = `BILL_${appointmentId}_${Date.now()}.pdf`;
      const pdfPath = path.join(billsDir, pdfFilename);

      await this.generateBillPDF(billData, pdfPath);
      billData.pdfPath = `/uploads/bills/${pdfFilename}`;

      // Create bill record
      const billRecord = await this.createBill(billData);

      // Send bill via email automatically
      await emailService.sendBillEmail(appointment, {
        ...billRecord,
        ...billData
      }, appointment);

      return {
        success: true,
        bill: billRecord,
        pdfUrl: billData.pdfPath
      };
    } catch (error) {
      console.error('Error processing payment and generating bill:', error);
      throw error;
    }
  }

  /**
   * Get bill by ID
   */
  async getBill(billId) {
    const query = `
      SELECT b.*, c.name, c.email, c.phone
      FROM bills b
      JOIN customers c ON b.customer_id = c.id
      WHERE b.id = ?
    `;

    const [bills] = await db.query(query, [billId]);
    return bills.length > 0 ? bills[0] : null;
  }

  /**
   * Get bill by appointment ID
   */
  async getBillByAppointment(appointmentId) {
    const query = `
      SELECT * FROM bills
      WHERE appointment_id = ?
      ORDER BY created_at DESC
      LIMIT 1
    `;

    const [bills] = await db.query(query, [appointmentId]);
    return bills.length > 0 ? bills[0] : null;
  }

  /**
   * Resend bill email
   */
  async resendBillEmail(billId) {
    try {
      const bill = await this.getBill(billId);
      if (!bill) throw new Error('Bill not found');

      // Get appointment details
      const appointmentQuery = `
        SELECT a.appointment_date, a.appointment_time
        FROM appointments a
        WHERE a.id = ?
      `;

      const [appointments] = await db.query(appointmentQuery, [bill.appointment_id]);
      const appointment = appointments[0];

      // Send email
      await emailService.sendBillEmail(
        { name: bill.name, email: bill.email, phone: bill.phone },
        bill,
        appointment
      );

      // Update bill sent status
      const updateQuery = `
        UPDATE bills
        SET sent_via_email = TRUE, email_sent_date = NOW()
        WHERE id = ?
      `;

      await db.query(updateQuery, [billId]);

      return { success: true, message: 'Bill email resent' };
    } catch (error) {
      console.error('Error resending bill email:', error);
      throw error;
    }
  }

  /**
   * Generate unique bill number
   * Format: BILL-YYYY-MMDD-NNNN
   */
  generateBillNumber() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `BILL-${year}-${month}${day}-${random}`;
  }
}

module.exports = new BillService();
