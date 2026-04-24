# Implementation Checklist - Voucher & Auto-Bill System

**Project:** Voucher Thông Minh & Auto-Bill System  
**Timeline:** 5-6 tuần  
**Status:** Not Started

---

## PHASE 1: Database & Foundation (Week 1-2)

### Database Setup

- [ ] Create vouchers table
- [ ] Create voucher_assignments table
- [ ] Create voucher_usage_history table
- [ ] Create voucher_suggestions table
- [ ] Create email_verification_tokens table
- [ ] Create email_queue table
- [ ] Create email_delivery_tracking table
- [ ] Create email_campaigns table
- [ ] Create bills table
- [ ] Alter customers table (add classification columns)
- [ ] Alter appointments table (add bill references)
- [ ] Create indexes for performance
- [ ] Run migration scripts
- [ ] Test database connectivity
- [ ] Backup and verify schema

### Backend Setup

- [ ] Install required npm packages (nodemailer, pdfkit, node-schedule, etc)
- [ ] Set up environment variables (.env configuration)
- [ ] Create config/emailConfig.js
- [ ] Create email templates folder structure
- [ ] Test database connections
- [ ] Set up logging infrastructure

### Testing Database

- [ ] Insert sample data into vouchers table
- [ ] Test CRUD operations
- [ ] Test queries for customer classification
- [ ] Test indexes for performance
- [ ] Verify data consistency

---

## PHASE 2: Backend Services & Business Logic (Week 2-3)

### Voucher Service

- [ ] Implement createVoucher() method
- [ ] Implement getVoucherByCode() method
- [ ] Implement assignVoucherToCustomer() method
- [ ] Implement getCustomerVouchers() method
- [ ] Implement applyVoucher() method (with validation)
- [ ] Implement recordVoucherUsage() method
- [ ] Implement classifyCustomer() (Regular/VIP logic)
- [ ] Implement updateCustomerType() method
- [ ] Write unit tests for all methods
- [ ] Add error handling and logging

### Email Service

- [ ] Set up Gmail API authentication
- [ ] Implement transporter configuration
- [ ] Implement loadTemplate() method
- [ ] Implement sendVerificationEmail()
- [ ] Implement sendVoucherEmail()
- [ ] Implement sendBillEmail()
- [ ] Implement sendCampaignEmail()
- [ ] Implement queueEmail() method
- [ ] Implement processQueue() for batch sending
- [ ] Test email delivery with test accounts

### Bill Service

- [ ] Implement generateBillPDF() with PDFKit
- [ ] Implement createBill() in database
- [ ] Implement processPaymentAndGenerateBill()
- [ ] Implement getBill() method
- [ ] Implement resendBillEmail() method
- [ ] Test PDF generation
- [ ] Verify bill calculations

### Voucher Suggestion Engine

- [ ] Implement comeback detection logic
- [ ] Implement category preference tracking
- [ ] Implement VIP exclusive offers
- [ ] Add confidence scoring
- [ ] Test recommendation accuracy

---

## PHASE 3: Backend API & Controllers (Week 2-3)

### Voucher Controllers

- [ ] Create voucherController.js
- [ ] Implement createVoucher endpoint
- [ ] Implement listVouchers endpoint
- [ ] Implement getVoucher endpoint
- [ ] Implement updateVoucher endpoint
- [ ] Implement deleteVoucher endpoint
- [ ] Implement assignVoucherBatch endpoint
- [ ] Implement getMyVouchers endpoint
- [ ] Implement getSuggestedVouchers endpoint
- [ ] Implement validateVoucher endpoint
- [ ] Implement applyVouchers endpoint
- [ ] Implement analytics endpoint

### Email Controllers

- [ ] Create emailController.js
- [ ] Implement sendVerificationEmail endpoint
- [ ] Implement verifyEmailToken endpoint
- [ ] Implement sendVoucherEmail endpoint
- [ ] Implement sendBillEmail endpoint
- [ ] Implement createCampaign endpoint
- [ ] Implement sendCampaign endpoint
- [ ] Implement getCampaignStats endpoint
- [ ] Implement getEmailQueue endpoint

### Bill Controllers

- [ ] Create billController.js
- [ ] Implement getBill endpoint
- [ ] Implement downloadBill endpoint
- [ ] Implement processPayment endpoint
- [ ] Implement resendBillEmail endpoint

### Customer Controllers

- [ ] Implement updateEmailPreferences endpoint
- [ ] Implement getEmailPreferences endpoint
- [ ] Implement unsubscribeEmail endpoint

### Testing

- [ ] Test all endpoints with Postman
- [ ] Test error handling
- [ ] Test validation middleware
- [ ] Test auth middleware

---

## PHASE 4: Cron Jobs & Automation (Week 3)

### Scheduled Tasks

- [ ] Create voucherExpiryNotificationCron.js
- [ ] Implement daily voucher reminder job (9:00 AM)
- [ ] Create voucherSuggestionCron.js
- [ ] Implement daily suggestion job (8:00 AM)
- [ ] Create campaignSchedulerCron.js
- [ ] Implement weekly campaign job (Monday 8:00 AM)
- [ ] Implement daily comeback offer job (2:00 PM)
- [ ] Implement monthly birthday job (1st of month)
- [ ] Create emailQueueProcessor.js
- [ ] Implement email queue processing (every 5 minutes)
- [ ] Create customerClassificationCron.js
- [ ] Implement daily customer re-classification (3:00 AM)
- [ ] Test all cron jobs
- [ ] Set up monitoring/alerts for failed jobs

---

## PHASE 5: Frontend Components (Week 3-4)

### Voucher Components

- [ ] Create MyVouchers.jsx component
- [ ] Create VoucherCard.jsx component
- [ ] Create VoucherBadge.jsx component
- [ ] Create VoucherList.jsx component
- [ ] Create SuggestedVoucher.jsx banner
- [ ] Create MultiVoucherSelector.jsx for checkout
- [ ] Create VoucherCodeCopy.jsx utility
- [ ] Add CSS styling for all components
- [ ] Test component functionality

### Email Components

- [ ] Create EmailVerificationModal.jsx
- [ ] Create BillModal.jsx
- [ ] Create BillPreview.jsx
- [ ] Create EmailOptInToggle.jsx
- [ ] Create CampaignPerformance.jsx (admin)
- [ ] Add CSS styling

### Update Existing Components

- [ ] Update Checkout.jsx to include voucher section
- [ ] Update Checkout.jsx to show multi-voucher compatibility
- [ ] Update Payment.jsx to trigger bill generation
- [ ] Update AppointmentDetail.jsx to show bill option
- [ ] Update CustomerProfile.jsx for email preferences

### Admin Dashboard Components

- [ ] Create VoucherManagement admin page
- [ ] Create CampaignManager.jsx
- [ ] Create EmailQueueMonitor.jsx
- [ ] Create VoucherAnalytics.jsx
- [ ] Create CustomerClassification.jsx admin view

### Testing

- [ ] Test all components in isolation
- [ ] Test component integration
- [ ] Test with real API calls
- [ ] Test responsive design
- [ ] Browser compatibility testing

---

## PHASE 6: Email Templates & Content (Week 2-4)

### Email Template HTML

- [ ] Create account-verification.html
- [ ] Create voucher-notification.html
- [ ] Create promotion-campaign.html
- [ ] Create bill-receipt.html
- [ ] Create welcome-email.html
- [ ] Create vip-upgrade-email.html
- [ ] Create feedback-request-email.html
- [ ] Test email rendering in multiple clients
- [ ] Ensure mobile responsiveness
- [ ] Test with actual data substitution

### Template Configuration

- [ ] Set up Handlebars template engine
- [ ] Create template helper functions
- [ ] Test variable substitution
- [ ] Create template previewer tool

---

## PHASE 7: Integration & Testing (Week 4-5)

### Integration Testing

- [ ] Test end-to-end: Signup → Verification → Voucher → Checkout → Bill
- [ ] Test voucher assignment flow
- [ ] Test email sending from scheduled jobs
- [ ] Test multi-voucher application
- [ ] Test bill generation and delivery
- [ ] Test payment webhook handling
- [ ] Test email delivery tracking
- [ ] Test customer classification update

### Unit Testing

- [ ] Test voucherService methods
- [ ] Test emailService methods
- [ ] Test billService methods
- [ ] Test validation logic
- [ ] Test calculation logic
- [ ] Achieve >80% code coverage

### API Testing

- [ ] Test all CRUD endpoints
- [ ] Test validation error handling
- [ ] Test auth/authorization
- [ ] Test rate limiting
- [ ] Load testing for email queue
- [ ] Test concurrent requests

### UI/UX Testing

- [ ] Test voucher display logic
- [ ] Test expiry badge display
- [ ] Test copy-to-clipboard functionality
- [ ] Test responsive design on mobile
- [ ] Test accessibility (WCAG compliance)
- [ ] User acceptance testing with stakeholders

### Performance Testing

- [ ] Profile database queries
- [ ] Optimize slow queries
- [ ] Test email queue under load (10k+ emails)
- [ ] Test concurrent voucher applications
- [ ] Measure PDF generation speed
- [ ] Monitor memory usage

---

## PHASE 8: Security & Compliance (Week 5)

### Security Measures

- [ ] Validate all email addresses
- [ ] Implement spam prevention
- [ ] Add CAPTCHA to signup
- [ ] Encrypt sensitive data in transit
- [ ] Implement HTTPS everywhere
- [ ] Set up CORS properly
- [ ] Add rate limiting to APIs
- [ ] Implement audit logging for voucher usage
- [ ] Secure voucher codes (hash/encrypt)
- [ ] Prevent voucher code brute force

### Email Security

- [ ] Set up SPF records
- [ ] Set up DKIM signing
- [ ] Set up DMARC policy
- [ ] Test email authentication
- [ ] Implement unsubscribe link
- [ ] Ensure GDPR compliance
- [ ] Add privacy policy reference to emails

### Data Protection

- [ ] Review database access controls
- [ ] Backups of email logs
- [ ] Implement data retention policy
- [ ] Test SQL injection prevention
- [ ] Test XSS prevention
- [ ] Security code review

---

## PHASE 9: Deployment & DevOps (Week 5-6)

### Environment Setup

- [ ] Set up production database
- [ ] Configure production email credentials
- [ ] Set up Redis for queue management
- [ ] Configure CDN for PDF storage
- [ ] Set up SSL certificates
- [ ] Configure environment variables
- [ ] Set up backups and recovery

### Monitoring & Logging

- [ ] Set up ELK stack or similar
- [ ] Configure error tracking (Sentry)
- [ ] Set up performance monitoring (APM)
- [ ] Create dashboards for metrics
- [ ] Set up alerts for failures
- [ ] Configure log rotation

### Deployment

- [ ] Build Docker containers
- [ ] Set up CI/CD pipeline
- [ ] Deploy to staging environment
- [ ] Run staging tests
- [ ] Create database migration scripts
- [ ] Plan rollback strategy
- [ ] Deploy to production
- [ ] Verify production deployment
- [ ] Monitor initial traffic

### Documentation

- [ ] Write API documentation (Swagger/OpenAPI)
- [ ] Create user guides
- [ ] Write admin guides
- [ ] Document troubleshooting steps
- [ ] Create architecture diagrams
- [ ] Document deployment procedures
- [ ] Create runbook for on-call

---

## PHASE 10: Post-Launch & Optimization (Week 6+)

### Monitoring

- [ ] Monitor email delivery rates
- [ ] Track voucher usage metrics
- [ ] Monitor system performance
- [ ] Track customer conversion rates
- [ ] Monitor error rates
- [ ] Analyze user behavior

### Optimization

- [ ] Optimize database queries based on usage
- [ ] Improve email template engagement
- [ ] A/B test voucher designs
- [ ] A/B test email subject lines
- [ ] Optimize PDF generation speed
- [ ] Cache frequently accessed data

### Feedback & Iteration

- [ ] Gather user feedback
- [ ] Fix reported bugs
- [ ] Implement feature requests
- [ ] Update documentation
- [ ] Scale resources as needed
- [ ] Regular security audits

---

## DEPLOYMENT CHECKLIST

Before going live:

- [ ] Database migrations tested and verified
- [ ] All environment variables configured
- [ ] SSL certificates installed
- [ ] Email credentials verified
- [ ] Google API credentials working
- [ ] Rate limiting configured
- [ ] Backups configured and tested
- [ ] Monitoring enabled
- [ ] Alerting configured
- [ ] Disaster recovery plan documented
- [ ] User documentation complete
- [ ] Admin training completed
- [ ] Support team trained
- [ ] Rollback plan ready
- [ ] Load testing completed
- [ ] Security audit passed
- [ ] Performance baselines established
- [ ] Staging environment mirrors production

---

## TEAM ASSIGNMENTS

Suggested team size: 4-5 developers

- **Backend Lead** (2 devs):
  - Voucher service & API
  - Email service & automation
  - Database design & optimization

- **Frontend Lead** (1-2 devs):
  - React components
  - UI/UX implementation
  - Integration testing

- **DevOps/QA** (1 dev):
  - Infrastructure & deployment
  - Testing & QA
  - Monitoring & alerts

---

## TIMELINE SUMMARY

| Phase | Duration | Deliverables                               |
| ----- | -------- | ------------------------------------------ |
| 1     | Week 1-2 | Database schema, migrations, backend setup |
| 2-3   | Week 2-3 | Services, controllers, APIs                |
| 4-5   | Week 3-4 | Frontend components, email templates       |
| 6-7   | Week 4-5 | Integration testing, bug fixes             |
| 8-9   | Week 5-6 | Security, deployment, monitoring           |
| 10    | Week 6+  | Launch, monitoring, iteration              |

**Total Duration:** 5-6 weeks (with parallel development)

---

## NOTES

- This is an estimated timeline; actual duration depends on team size and complexity
- Breaking features into smaller sprints is recommended (1-2 week sprints)
- Daily standups recommended to track progress
- Code reviews on all PRs before merge
- Test coverage should be maintained >80%
- Use feature flags for gradual rollout

---

**Last Updated:** April 16, 2026  
**Status:** Ready for Development  
**Version:** 1.0
