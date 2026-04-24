# Voucher Thông Minh & Auto-Bill System - Complete Documentation

**Version:** 1.0  
**Last Updated:** April 16, 2026  
**Status:** Ready for Development

---

## 📚 Documentation Files

Tất cả các file specification, code samples, và guides đầy đủ có sẵn trong project:

### 1. **Main Specification**

📄 `VOUCHER_SMART_SPECIFICATION.md`

- Đầy đủ chi tiết 5 tính năng chính
- Database schema, API endpoints, timeline
- Security considerations, testing strategy

### 2. **Database Setup**

📄 `DATABASE_MIGRATIONS_VOUCHER.sql`

- SQL DDL scripts để tạo tất cả bảng
- Bao gồm: vouchers, assignments, emails, bills, customers
- Sample data và verification queries

### 3. **Email Templates** (HTML)

📧 `EMAIL_TEMPLATE_VERIFICATION.html` - Account verification email  
📧 `EMAIL_TEMPLATE_VOUCHER.html` - Voucher notification email  
📧 `EMAIL_TEMPLATE_BILL.html` - Bill/receipt email  
📧 `EMAIL_TEMPLATE_CAMPAIGN.html` - Promotional campaign email

### 4. **Backend Services** (Node.js/JavaScript)

💾 `SERVICE_VOUCHER_EXAMPLE.js` - Voucher business logic  
💾 `SERVICE_EMAIL_EXAMPLE.js` - Email management service  
💾 `SERVICE_BILL_EXAMPLE.js` - Bill generation service  
💾 `CRON_JOBS_EXAMPLES.js` - Automated scheduled tasks

### 5. **API Documentation**

🔌 `API_ENDPOINTS_EXAMPLE.js` - All REST API endpoints with examples

- 30+ endpoints cho voucher, email, bill management
- Frontend integration examples

### 6. **Frontend Components** (React)

⚛️ `REACT_COMPONENTS_EXAMPLES.jsx` - React UI components

- MyVouchers dashboard
- VoucherCard, SuggestedVoucher, MultiVoucherSelector
- BillModal cho auto-bill display
- Email preferences components

### 7. **Implementation Guide**

✅ `IMPLEMENTATION_CHECKLIST.md` - Complete step-by-step checklist

- 10 phases, 150+ task items
- Team assignments, timeline, deployment checklist

---

## 🎯 Quick Start

### For Backend Developers

1. **Start với DATABASE**

   ```bash
   # Run SQL migrations
   mysql -u root -p < DATABASE_MIGRATIONS_VOUCHER.sql
   ```

2. **Copy Service Files**

   ```bash
   cp SERVICE_*.js src/services/
   # Cấu trúc: /backend/src/services/
   #   ├── voucherService.js
   #   ├── emailService.js
   #   ├── billService.js
   ```

3. **Setup Email**
   - Copy email templates vào `/backend/src/templates/email/`
   - Cấu hình Google API credentials trong `.env`
   - Test email sending

4. **Implement APIs**
   - Tạo controllers từ endpoints trong `API_ENDPOINTS_EXAMPLE.js`
   - Kết nối services với controllers
   - Test all endpoints

5. **Setup Cron Jobs**
   ```bash
   cp CRON_JOBS_EXAMPLES.js src/jobs/
   # Chỉnh sửa schedule time theo timezone của bạn
   # Thêm vào app.js: require('./src/jobs')
   ```

### For Frontend Developers

1. **Create Components**

   ```bash
   # Copy component structure
   cp REACT_COMPONENTS_EXAMPLES.jsx src/components/voucher/
   ```

2. **Update Pages**
   - Thêm VoucherCard, MyVouchers vào pages
   - Thêm CheckoutVoucherSelector vào checkout flow
   - Thêm BillModal trigger sau payment success

3. **API Integration**
   - Follow endpoints trong `API_ENDPOINTS_EXAMPLE.js`
   - Use axios/fetch để call APIs
   - Implement error handling

4. **Styling**
   - Add CSS files cho components
   - Responsive design cho mobile
   - Dark mode support (optional)

---

## 🔑 Key Features Overview

### 1. Voucher Thông Minh (Smart Voucher)

- Regular customers: 5-15% discount
- VIP customers: 20-40% discount + exclusive offers
- Auto classification based on spending, frequency

### 2. Voucher Tự Động (Auto-Suggested)

- Bot analyzes customer behavior
- Recommends vouchers based on purchase history
- Comeback offers, category preferences

### 3. Voucher Theo Thời Hạn

- 7-day validity from issue date
- Multi-voucher support (max 2-3 per order)
- Expiry reminders via email

### 4. Auto-Bill

- Automatic PDF generation after payment
- Display in app + email delivery
- No staff approval needed
- Bill download option

### 5. Email Automation

- Account verification email
- Voucher notification emails
- Auto campaign scheduling (weekly, monthly)
- Promotion bot that runs daily
- Bill receipts

---

## 🛠️ Technology Stack

### Backend

- **Framework:** Node.js + Express.js
- **Database:** MySQL 8.0+
- **Email:** Nodemailer + Google Gmail API
- **PDF:** PDFKit
- **Queue:** Bull or Bee-Queue
- **Scheduling:** node-schedule
- **Auth:** JWT

### Frontend

- **Framework:** React.js
- **HTTP Client:** Axios
- **Date Library:** moment.js or date-fns
- **CSS:** CSS3 + Responsive Design
- **UI Components:** Custom components

---

## 📊 Database Schema Overview

**Main Tables:**

- `vouchers` - Voucher definitions
- `voucher_assignments` - Customer-voucher mapping
- `voucher_usage_history` - Usage tracking
- `voucher_suggestions` - AI recommendations
- `email_queue` - Email queue
- `email_campaigns` - Campaign batch records
- `bills` - Bill records
- `customers` (enhanced) - Customer classification, email prefs
- `appointments` (enhanced) - Bill references

**Indexes:** 20+ indexes for performance optimization

---

## 🔄 Workflow Examples

### Workflow 1: Customer Registration → Verification → Voucher

```
1. Customer signs up
2. System sends verification email
3. Customer clicks verify link
4. Account activated
5. Bot generates initial voucher
6. Voucher sent via email
7. Customer can use vouchers
```

### Workflow 2: Checkout → Bill → Email

```
1. Customer selects services
2. Shows available vouchers
3. Customer applies 1-3 vouchers
4. System calculates discount
5. Payment processed
6. Bill generated automatically (PDF)
7. Bill displayed in modal
8. Bill sent via email automatically
```

### Workflow 3: Daily Bot Campaign

```
9:00 AM - Expiry reminders sent
8:00 AM - New suggestions generated
2:00 PM - Comeback offers sent
3:00 AM - Customer classification updated
Every 5 min - Email queue processed
```

---

## 📋 Environment Variables Required

```env
# Email Configuration
EMAIL_USER=your-email@gmail.com
EMAIL_REPLY_TO=support@yourbusiness.com
EMAIL_DISPLAY_NAME=Your Business Name
GOOGLE_SERVICE_ACCOUNT_JSON={...}
EMAIL_REFRESH_TOKEN=...

# Frontend URLs
FRONTEND_URL=https://yourdomain.com
FACEBOOK_URL=https://facebook.com/yourpage
INSTAGRAM_URL=https://instagram.com/yourpage
TWITTER_URL=https://twitter.com/yourpage

# Database
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=...
DB_NAME=yourbusiness

# Server
PORT=5000
NODE_ENV=production
JWT_SECRET=...

# Payment Gateway (if applicable)
PAYMENT_API_KEY=...
```

---

## 🚀 Deployment Steps

### 1. Database

```bash
# Run migrations
mysql -u root -ppassword yourbusiness < DATABASE_MIGRATIONS_VOUCHER.sql

# Verify tables created
mysql -u root -ppassword yourbusiness -e "SHOW TABLES;"
```

### 2. Backend Setup

```bash
cd backend
npm install
# Install specific packages listed in IMPLEMENTATION_CHECKLIST

# Configure .env
cat > .env << EOF
EMAIL_USER=...
FRONTEND_URL=...
EOF

# Start server
npm start
```

### 3. Frontend Setup

```bash
cd frontend
npm install

# Update API endpoints
# src/config/api.js -> update BASE_URL

# Build
npm run build

# Deploy to hosting
```

### 4. Schedule Cron Jobs

```javascript
// In app.js
require("./src/jobs/voucherExpiryNotificationCron");
require("./src/jobs/voucherSuggestionCron");
require("./src/jobs/campaignSchedulerCron");
require("./src/jobs/emailQueueProcessor");
require("./src/jobs/customerClassificationCron");
```

### 5. Test Email

```bash
# Send test email
POST http://localhost:5000/api/emails/test
{
  "email": "your-email@gmail.com"
}
```

---

## 📞 API Testing Examples

### 1. Get My Vouchers

```bash
curl -X GET http://localhost:5000/api/my-vouchers \
  -H "Authorization: Bearer TOKEN"
```

### 2. Validate Voucher

```bash
curl -X POST http://localhost:5000/api/vouchers/validate \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "SUMMER2026PROMO",
    "subtotal": 500000
  }'
```

### 3. Apply Multiple Vouchers

```bash
curl -X POST http://localhost:5000/api/vouchers/apply \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "appointmentId": 123,
    "codes": ["SUMMER2026", "FREEDEL"],
    "subtotal": 500000
  }'
```

### 4. Process Payment (Auto Bill)

```bash
curl -X POST http://localhost:5000/api/bills/process \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "appointmentId": 123,
    "paymentMethod": "credit_card",
    "transactionId": "TXN-123456",
    "voucherDiscount": 80000
  }'
```

---

## 🧪 Testing Checklist

### Unit Tests (50+ tests)

- [ ] Voucher validation logic
- [ ] Email templating
- [ ] Bill calculations
- [ ] Customer classification
- [ ] Discount calculations

### Integration Tests (30+ tests)

- [ ] End-to-end signup → voucher → bill
- [ ] Email queue processing
- [ ] Multi-voucher application
- [ ] Customer type changes

### UI Tests

- [ ] Voucher display
- [ ] Copy code button
- [ ] Multi-select vouchers
- [ ] Bill modal display
- [ ] Responsive design

---

## 📈 Success Metrics

Track these KPIs after launch:

1. **Email Metrics**
   - Delivery rate: >95%
   - Open rate: >25%
   - Click rate: >5%

2. **Voucher Metrics**
   - Usage rate: >40%
   - Redemption by type: Regular 30%, VIP 60%
   - Average discount: 12%

3. **Business Metrics**
   - Revenue increase: > 15%
   - Customer retention: > 70%
   - Repeat purchase rate: > 45%

4. **System Metrics**
   - Email send success: > 99%
   - Bill generation success: 100%
   - API response time: < 200ms
   - Error rate: < 0.1%

---

## 🐛 Troubleshooting

### Email Not Sending

- Check Gmail API credentials
- Verify email address in .env
- Check email queue table
- Look at logs for errors

### Bill PDF Not Generating

- Install pdfkit: `npm install pdfkit`
- Check /uploads/bills folder permissions
- Verify appointment data exists
- Check memory usage

### Vouchers Not Appearing

- Check voucher status = 'active'
- Check expiry_date > NOW()
- Verify customer classification correct
- Check voucher_assignments table

---

## 📞 Support & Questions

For implementation questions:

1. Check `VOUCHER_SMART_SPECIFICATION.md` first
2. Review relevant code samples
3. Check `IMPLEMENTATION_CHECKLIST.md` for step-by-step

For API questions:

- See `API_ENDPOINTS_EXAMPLE.js`
- Test endpoints with provided curl examples

For Database questions:

- Review `DATABASE_MIGRATIONS_VOUCHER.sql`
- Check table schema comments

---

## 📝 File Summary

| File                            | Purpose             | Size | Dev Time  |
| ------------------------------- | ------------------- | ---- | --------- |
| VOUCHER_SMART_SPECIFICATION.md  | Full spec           | 50KB | 1-2 days  |
| DATABASE_MIGRATIONS_VOUCHER.sql | Database setup      | 15KB | 3-4 hours |
| EMAIL*TEMPLATE*\*.html          | Email templates     | 30KB | 1 day     |
| SERVICE\_\*.js                  | Backend services    | 50KB | 3-4 days  |
| CRON_JOBS_EXAMPLES.js           | Scheduled tasks     | 15KB | 1-2 days  |
| API_ENDPOINTS_EXAMPLE.js        | API documentation   | 25KB | 1 day     |
| REACT_COMPONENTS_EXAMPLES.jsx   | Frontend components | 20KB | 2-3 days  |
| IMPLEMENTATION_CHECKLIST.md     | Task tracking       | 30KB | Reference |

**Total Dev Effort:** 5-6 weeks with 4-5 developers

---

## ✅ Implementation Order

1. **Day 1-2:** Database setup + schema review
2. **Day 3-4:** Backend services development
3. **Day 5-6:** API endpoints implementation
4. **Day 7-8:** Frontend components
5. **Day 9-10:** Integration testing
6. **Day 11-12:** Cron jobs + automation
7. **Day 13-14:** Email setup + testing
8. **Day 15+:** Refinement, optimization, deployment

---

## 🎓 Learning Resources

- **Node.js Email:** https://nodemailer.com/
- **PDFKit:** http://pdfkit.org/
- **node-schedule:** https://github.com/node-schedule/node-schedule
- **React Best Practices:** https://react.dev/
- **MySQL Optimization:** https://dev.mysql.com/doc/

---

**Version:** 1.0  
**Last Updated:** April 16, 2026  
**Status:** Ready for Development  
**Assignee:** Development Team

---

_Tất cả files đầy đủ, có thể bắt đầu development ngay lập tức._
