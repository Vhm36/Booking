/**
 * VOUCHER API ENDPOINTS - REST APIs for Frontend Integration
 * Path: /backend/src/routes/voucherApiRoutes.js
 */

const express = require('express');
const router = express.Router();
const voucherController = require('../controllers/voucherController');
const authMiddleware = require('../middleware/authMiddleware');
const validationMiddleware = require('../middleware/validationMiddleware');

// ===================================================================
// ADMIN ENDPOINTS (Staff only)
// ===================================================================

/**
 * POST /api/vouchers
 * Create a new voucher
 * Body: { code, voucherType, discountAmount, discountPercent, customerType, ... }
 * Returns: { success: true, voucherId, code }
 */
router.post(
  '/vouchers',
  authMiddleware.requireRole(['admin', 'staff']),
  validationMiddleware.validateVoucher,
  voucherController.createVoucher
);

/**
 * GET /api/vouchers
 * List all vouchers with filters
 * Query: ?status=active&customerType=vip&page=1&limit=20
 * Returns: { vouchers: [...], total, page, pages }
 */
router.get(
  '/vouchers',
  authMiddleware.requireRole(['admin', 'staff']),
  voucherController.listVouchers
);

/**
 * GET /api/vouchers/:id
 * Get single voucher details
 * Returns: { id, code, discountAmount, usageStats, ... }
 */
router.get(
  '/vouchers/:id',
  authMiddleware.requireRole(['admin', 'staff']),
  voucherController.getVoucher
);

/**
 * PUT /api/vouchers/:id
 * Update voucher
 * Body: { description, status, maxUsageGlobal, ... }
 * Returns: { success: true, updated: 1 }
 */
router.put(
  '/vouchers/:id',
  authMiddleware.requireRole(['admin', 'staff']),
  voucherController.updateVoucher
);

/**
 * DELETE /api/vouchers/:id
 * Delete voucher
 * Returns: { success: true, deleted: 1 }
 */
router.delete(
  '/vouchers/:id',
  authMiddleware.requireRole(['admin', 'staff']),
  voucherController.deleteVoucher
);

/**
 * POST /api/vouchers/:id/assign
 * Assign voucher to customers
 * Body: { customerIds: [1, 2, 3], maxUsageCustomer: 1 }
 * Returns: { success: true, assigned: 3 }
 */
router.post(
  '/vouchers/:id/assign',
  authMiddleware.requireRole(['admin', 'staff']),
  voucherController.assignVoucherBatch
);

/**
 * GET /api/vouchers/analytics
 * Campaign analytics and metrics
 * Query: ?voucherId=1&fromDate=2026-01-01&toDate=2026-12-31
 * Returns: { voucherId, totalIssued, totalUsed, usageRate, revenue, ... }
 */
router.get(
  '/analytics',
  authMiddleware.requireRole(['admin', 'staff']),
  voucherController.getAnalytics
);

// ===================================================================
// CUSTOMER ENDPOINTS
// ===================================================================

/**
 * GET /api/my-vouchers
 * Get all vouchers for logged-in customer
 * Returns: { vouchers: [{ code, discount, daysRemaining, status }, ...] }
 */
router.get(
  '/my-vouchers',
  authMiddleware.requireLogin,
  voucherController.getMyVouchers
);

/**
 * GET /api/vouchers/suggestions
 * Get AI-suggested vouchers for customer
 * Returns: { suggestions: [{ voucherId, reason, confidence }, ...] }
 */
router.get(
  '/suggestions',
  authMiddleware.requireLogin,
  voucherController.getSuggestedVouchers
);

/**
 * POST /api/vouchers/validate
 * Validate voucher before checkout
 * Body: { code, subtotal }
 * Returns: { valid: true, discount: 15000, discountType: 'percentage', ... }
 */
router.post(
  '/validate',
  authMiddleware.requireLogin,
  voucherController.validateVoucher
);

/**
 * POST /api/vouchers/apply
 * Apply multiple vouchers to order
 * Body: { appointmentId, codes: ['CODE1', 'CODE2'], subtotal: 500000 }
 * Returns: { valid: true, applied: ['CODE1', 'CODE2'], totalDiscount: 80000 }
 */
router.post(
  '/apply',
  authMiddleware.requireLogin,
  voucherController.applyVouchers
);

// ===================================================================
// EMAIL API ENDPOINTS
// ===================================================================

const emailController = require('../controllers/emailController');

/**
 * POST /api/emails/send-verification
 * Send verification email (triggered on signup)
 * Body: { customerId, email }
 * Returns: { success: true, messageId, deliveryStatus }
 */
router.post(
  '/emails/send-verification',
  voucherController.sendVerificationEmail
);

/**
 * POST /api/emails/verify-token
 * Verify email token (when user clicks verify link)
 * Body: { token }
 * Returns: { success: true, verified: true }
 */
router.post(
  '/emails/verify-token',
  emailController.verifyEmailToken
);

/**
 * POST /api/emails/send-voucher
 * Send voucher email
 * Body: { customerId, voucherId }
 * Returns: { success: true, messageId, queued: true }
 */
router.post(
  '/emails/send-voucher',
  authMiddleware.requireRole(['admin', 'staff']),
  emailController.sendVoucherEmail
);

/**
 * POST /api/emails/send-bill
 * Send bill email
 * Body: { billId, customerId }
 * Returns: { success: true, emailSent: true }
 */
router.post(
  '/emails/send-bill',
  authMiddleware.requireLogin,
  emailController.sendBillEmail
);

/**
 * POST /api/emails/campaigns
 * Create email campaign
 * Body: { name, type, segment_filter, offers: [...], sendAt }
 * Returns: { success: true, campaignId }
 */
router.post(
  '/emails/campaigns',
  authMiddleware.requireRole(['admin', 'staff']),
  emailController.createCampaign
);

/**
 * POST /api/emails/campaigns/:id/send
 * Send campaign immediately
 * Returns: { success: true, sent: 450 }
 */
router.post(
  '/emails/campaigns/:id/send',
  authMiddleware.requireRole(['admin', 'staff']),
  emailController.sendCampaign
);

/**
 * GET /api/emails/campaigns/:id/stats
 * Get campaign statistics
 * Returns: { campaignId, total: 1000, sent: 450, opened: 180, clicked: 45, ... }
 */
router.get(
  '/emails/campaigns/:id/stats',
  authMiddleware.requireRole(['admin', 'staff']),
  emailController.getCampaignStats
);

/**
 * GET /api/emails/queue
 * View email queue (admin)
 * Query: ?status=pending&limit=20&page=1
 * Returns: { emails: [...], total, page }
 */
router.get(
  '/emails/queue',
  authMiddleware.requireRole(['admin', 'staff']),
  emailController.getEmailQueue
);

/**
 * POST /api/emails/resend/:id
 * Resend email
 * Returns: { success: true, queued: true }
 */
router.post(
  '/emails/resend/:id',
  authMiddleware.requireRole(['admin', 'staff']),
  emailController.resendEmail
);

// ===================================================================
// BILL API ENDPOINTS
// ===================================================================

const billController = require('../controllers/billController');

/**
 * GET /api/bills/:appointmentId
 * Get bill for appointment
 * Returns: { billId, billNumber, subtotal, discount, total, pdfUrl }
 */
router.get(
  '/bills/:appointmentId',
  authMiddleware.requireLogin,
  billController.getBill
);

/**
 * GET /api/bills/:id/download
 * Download bill PDF
 * Returns: PDF file
 */
router.get(
  '/bills/:id/download',
  authMiddleware.requireLogin,
  billController.downloadBill
);

/**
 * POST /api/bills/process
 * Process payment and auto-generate bill
 * Body: { appointmentId, paymentMethod, transactionId, voucherDiscount }
 * Returns: { success: true, billId, pdfUrl, emailSent: true }
 */
router.post(
  '/bills/process',
  authMiddleware.requireLogin,
  billController.processPayment
);

// ===================================================================
// CUSTOMER EMAIL PREFERENCES
// ===================================================================

const customerController = require('../controllers/customerController');

/**
 * PUT /api/my-preferences/email
 * Update email preferences for logged-in customer
 * Body: { emailOptIn: true, preferredFrequency: 'weekly' }
 * Returns: { success: true, updated: true }
 */
router.put(
  '/my-preferences/email',
  authMiddleware.requireLogin,
  customerController.updateEmailPreferences
);

/**
 * GET /api/my-preferences/email
 * Get email preferences
 * Returns: { emailOptIn, preferredFrequency, categories }
 */
router.get(
  '/my-preferences/email',
  authMiddleware.requireLogin,
  customerController.getEmailPreferences
);

/**
 * POST /api/unsubscribe/:customerId
 * Unsubscribe from emails (public link)
 * Returns: { success: true, unsubscribed: true }
 */
router.post(
  '/unsubscribe/:customerId',
  customerController.unsubscribeEmail
);

module.exports = router;

// ===================================================================
// EXAMPLE API USAGE (Frontend Integration)
// ===================================================================

/*

// 1. GET MY VOUCHERS
fetch('/api/my-vouchers', {
  headers: { 'Authorization': 'Bearer ' + token }
})
.then(r => r.json())
.then(data => {
  console.log(data.vouchers);
  // Display vouchers with expiry badges
});

// 2. GET VOUCHER SUGGESTIONS
fetch('/api/vouchers/suggestions', {
  headers: { 'Authorization': 'Bearer ' + token }
})
.then(r => r.json())
.then(data => {
  // Show suggested voucher banner
  showBanner(data.suggestions[0]);
});

// 3. VALIDATE VOUCHER CODE
fetch('/api/vouchers/validate', {
  method: 'POST',
  body: JSON.stringify({
    code: 'SUMMER2026PROMO',
    subtotal: 500000
  }),
  headers: {
    'Authorization': 'Bearer ' + token,
    'Content-Type': 'application/json'
  }
})
.then(r => r.json())
.then(data => {
  if (data.valid) {
    console.log('Discount: ' + data.discount + ' VND');
    updateCheckoutTotal(data.discount);
  }
});

// 4. APPLY MULTIPLE VOUCHERS
fetch('/api/vouchers/apply', {
  method: 'POST',
  body: JSON.stringify({
    appointmentId: appointmentId,
    codes: ['SUMMER2026', 'FREEDEL'],
    subtotal: 500000
  }),
  headers: {
    'Authorization': 'Bearer ' + token,
    'Content-Type': 'application/json'
  }
})
.then(r => r.json())
.then(data => {
  console.log('Total discount: ' + data.totalDiscount);
});

// 5. PROCESS PAYMENT (Auto Bill)
fetch('/api/bills/process', {
  method: 'POST',
  body: JSON.stringify({
    appointmentId: appointmentId,
    paymentMethod: 'credit_card',
    transactionId: 'TXN-123456',
    voucherDiscount: 80000
  }),
  headers: {
    'Authorization': 'Bearer ' + token,
    'Content-Type': 'application/json'
  }
})
.then(r => r.json())
.then(data => {
  // Auto show bill modal
  openBillModal(data.pdfUrl);
  console.log('Bill emailed to: ' + data.emailSent);
});

// 6. DOWNLOAD BILL
const billId = response.billId;
window.location.href = `/api/bills/${billId}/download`;

*/
