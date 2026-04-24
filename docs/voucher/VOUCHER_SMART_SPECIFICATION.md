# Specification Document: Voucher Thông Minh & Auto-Bill System

**Version:** 1.0  
**Date:** April 16, 2026  
**Status:** Draft for Development

---

## 1. TỔNG QUAN (Overview)

### 1.1 Mục đích

Hệ thống Voucher Thông Minh là một giải pháp tích hợp để:

- Tăng khả năng giữ chân khách hàng thông qua voucher được cá nhân hóa
- Tự động hóa quy trình phát hành và quản lý voucher
- Nâng cao trải nghiệm người dùng thông qua auto-bill và email marketing
- Tối ưu hóa conversion rate dựa trên hành vi khách hàng

### 1.2 Phạm vi

Bao gồm 5 thành phần chính:

1. **Voucher Thông Minh** - Phân loại theo khách hàng (Regular/VIP)
2. **Voucher Tự Động** - Bot gợi ý dựa trên data
3. **Voucher Theo Thời Hạn** - 7 ngày + hỗ trợ multi-voucher
4. **Auto-Bill** - Tự động hiển thị bill sau thanh toán
5. **Email Marketing Automation** - Gửi email xác thực, voucher, khuyến mãi

---

## 2. YÊMÙ CẦU CÁC TÍNH NĂNG

### 2.1 Voucher Thông Minh (Smart Voucher)

#### 2.1.1 Phân loại Voucher theo Customer Type

**Khách hàng thường (Regular Customer):**

- Discount: 5-15%
- Free delivery khi đơn >= 50k VND
- Combo offers
- Seasonal promotions

**Khách hàng VIP (VIP Customer):**

- Discount: 20-40%
- Free delivery không giới hạn
- Exclusive member-only vouchers
- Early access promotion
- Birthday vouchers
- Loyalty points multiplier (2x-3x)

#### 2.1.2 Tiêu chí phân loại Regular vs VIP

| Tiêu chí              | Regular       | VIP                   |
| --------------------- | ------------- | --------------------- |
| Tổng giá trị đơn hàng | < 2 triệu VND | >= 2 triệu VND        |
| Số lượng đơn hàng     | < 10 orders   | >= 10 orders          |
| Member tenure         | < 1 năm       | > 1 năm               |
| Repeat rate           | < 50%         | > 50%                 |
| Last interaction      | > 30 ngày     | < 7 ngày              |
| Final status          | Regular       | VIP (tự động upgrade) |

**Automatic downgrade:** Nếu khách hàng VIP không hoạt động 90 ngày → Regular

### 2.2 Voucher Tự Động (Auto-Suggested Voucher)

#### 2.2.1 Bot Logic

```
Trigger: Khách hàng mở app / website
↓
Hệ thống phân tích:
  - Dịch vụ/danh mục yêu thích
  - Giá bình quân đơn hàng
  - Ngày cuối cùng mua
  - Số lần hoãn/hủy
  - Thời gian gap giữa 2 đơn
↓
Bot chọn voucher phù hợp nhất từ pool
↓
Hiển thị gợi ý (notification/banner)
```

#### 2.2.2 Quy tắc gợi ý (Recommendation Rules)

| Trường hợp                              | Gợi ý                               |
| --------------------------------------- | ----------------------------------- |
| Khách hàng lâu không mua (> 14 ngày)    | "Come back" discount (10-20%)       |
| Khách hàng hay hoãn/hủy                 | "Complete order" voucher (miễn phí) |
| Dịch vụ A mua nhiều, dịch vụ B chưa thử | Voucher B                           |
| Đơn hàng gần ngưỡng free delivery       | "Free delivery" voucher             |
| VIP member không dùng voucher 30 ngày   | Premium voucher + bonus points      |

#### 2.2.3 Frequency Cap

- Hiển thị gợi ý tối đa 3 lần/ngày
- Gợi ý cùng voucher không quá 2 lần trong 7 ngày
- Sau accept voucher → đợi 2 ngày để gợi ý mới

### 2.3 Voucher Theo Thời Hạn (Time-Limited Voucher)

#### 2.3.1 Thời gian hiệu lực

**Thời hạn cơ bản:**

- Hạn sử dụng: 7 ngày kể từ ngày phát hành (ISO 8601)
- Format: `issued_date` → `expiry_date` (7 days later)
- Timezone: Asia/Ho_Chi_Minh (UTC+7)

**Edge cases:**

- Xác định "ngày phát hành" rõ ràng (auto-created date, admin-issued date, email-sent date)
- Voucher có thể được kéo dài admin manually

#### 2.3.2 Hỗ trợ Multi-Voucher pada Order

**Tình huống:**

```
Khách A có 3 vouchers:
  • Voucher1: -10% (còn 2 ngày)
  • Voucher2: -5% (còn 5 ngày)
  • Voucher3: Free delivery (còn 1 ngày)

Khi checkout:
  ✓ Cho phép chọn NHIỀU vouchers cùng lúc (nếu không conflict)
  ✓ Hệ thống tính tối ưu discount tổng hợp
  ✓ Hiển thị chi tiết từng voucher + tổng tiền tiết kiệm
  ✓ Ưu tiên voucher sắp hết hạn (urgency)
```

**Business Rules:**

- Cho phép mix: Discount % + Free delivery
- Cho phép mix: Flash sale + Member discount
- KHÔNG cho phép: 2 voucher % discount cùng lúc
- KHÔNG cho phép: Discount % > 50% tổng hợp
- Priority order: Expiry date sớp nhất → Amount cao nhất → Timeliness

#### 2.3.3 Notification & Urgency

```
Voucher status timeline:
  0-3 days before expiry → "Valid" (normal)
  3-1 days before expiry → "Expiring soon!" (orange badge)
  < 1 day                → "Expires today!" (red badge)
  Expired                → "Expired" (disabled, grey out)
```

---

## 3. AUTO-BILL SYSTEM

### 3.1 Tự động hiển thị Bill

#### 3.1.1 Trigger

```
Khách hàng hoàn thành thanh toán (Payment Success)
↓
Hệ thống tạo bill PDF
↓
Tự động hiển thị trên:
  - Appointment details page
  - Order confirmation (in-app notification)
  - Browser notification
  - Email attachment
↓
KHÔNG cần staff xác nhận
```

#### 3.1.2 Bill Content Structure

```
┌─────────────────────────────────┐
│    BILL - BIÊN LAI THANH TOÁN    │
├─────────────────────────────────┤
│ Booking ID: APT-2026-04-001     │
│ Date: 16/04/2026, 14:30         │
│ Customer: Nguyễn Văn A          │
│ Phone: 0901234567              │
├─────────────────────────────────┤
│ SERVICES                        │
│ - Service1 x1      500,000 VND  │
│ - Service2 x1      300,000 VND  │
├─────────────────────────────────┤
│ Subtotal:         800,000 VND  │
│ Voucher Applied:   -80,000 VND │
│ Tax (VAT):         +60,000 VND │
│ Total:            780,000 VND  │
├─────────────────────────────────┤
│ Payment Method: Credit Card     │
│ Transaction ID: TXN-123456      │
│ Status: ✓ Paid                  │
└─────────────────────────────────┘
```

#### 3.1.3 Technical Implementation

**PDF Generation:**

- Library: pdfkit (Node.js) hoặc puppeteer
- Format: A4, bilingual (Vi/En)
- Storage: AWS S3 hoặc local `/uploads/bills/`
- Naming: `bill_${appointmentId}_${timestamp}.pdf`

**Display Method:**

```javascript
// 1. Direct modal popup after payment
showBillModal(billData);

// 2. Download link
<a href="/api/bills/APT-123/download" download="bill.pdf">

// 3. Email attachment (see section 5)
sendBillViaEmail(customerId, billPDF);
```

---

## 4. EMAIL INTEGRATION SYSTEM

### 4.1 Email Gateway & Configuration

#### 4.1.1 Email Service Setup

**Provider:** Google Workspace / Gmail API
**Features:**

- Service account authentication
- HTML template engine
- Queue management (Bull/Bee-Queue)
- Retry mechanism (exponential backoff)
- Delivery tracking

#### 4.1.2 Email Configuration

```json
{
  "senderEmail": "noreply@yourbusiness.com",
  "displayName": "Your Business Name",
  "replyTo": "support@yourbusiness.com",
  "googleServiceAccount": "process.env.GOOGLE_SERVICE_ACCOUNT_JSON",
  "templates": {
    "accountVerification": "templates/email/account-verification.html",
    "voucherNotification": "templates/email/voucher-notification.html",
    "promotionCampaign": "templates/email/promotion-campaign.html",
    "billReceipt": "templates/email/bill-receipt.html"
  }
}
```

### 4.2 Account Verification Email (Tài khoản mới)

#### 4.2.1 Trigger

```
Khách hàng tạo account mới
↓
Hệ thống gửi email xác thực tới Google email của họ
↓
Khách hàng bấm link xác thực trong email
↓
Account active → có thể mua hàng
```

#### 4.2.2 Email Template: Account Verification

```html
Subject: [Your Business] Xác thực tài khoản - Verify Your Account Body:
┌──────────────────────────────────┐ │ [Logo] │ │ WELCOME TO [YOUR BUSINESS] │
├──────────────────────────────────┤ │ Xin chào [Customer Name], │ │ │ │ Cảm ơn
bạn đã đăng ký! │ │ Thank you for signing up! │ │ │ │ Để kích hoạt tài khoản,
vui │ │ lòng bấm nút dưới đây: │ │ Please verify your account: │ │ │ │ [VERIFY
ACCOUNT BUTTON] │ │ Hoặc nhấp link: [verification] │ │ This link expires in 24
hours │ │ │ │ Nếu không phải bạn, hãy bỏ qua │ │ bức thư này. │
└──────────────────────────────────┘
```

**Implementation Details:**

- Token: JWT/UUID, lưu trong `email_verification_tokens` table
- Expiry: 24 hours
- After verify: `customers.email_verified = true`
- Resend option: Cho phép gửi lại email 3 lần

#### 4.2.3 Database Schema

```sql
CREATE TABLE email_verification_tokens (
  id INT PRIMARY KEY AUTO_INCREMENT,
  customer_id INT NOT NULL,
  email VARCHAR(255) NOT NULL,
  token VARCHAR(500) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP,
  verified_at TIMESTAMP,
  is_used BOOLEAN DEFAULT FALSE,
  FOREIGN KEY (customer_id) REFERENCES customers(id)
);

ALTER TABLE customers ADD COLUMN (
  email_verified BOOLEAN DEFAULT FALSE,
  email_verified_at TIMESTAMP
);
```

---

### 4.3 Voucher Email Notification (Gửi Voucher)

#### 4.3.1 Trigger Events

```
1. New voucher created for customer
   → Send immediately

2. Voucher expiring soon (< 3 days)
   → Send reminder email

3. Seasonal voucher campaign
   → Batch send to segment

4. VIP exclusive offer
   → Send to VIP only
```

#### 4.3.2 Email Template: Voucher Notification

```html
Subject: 🎉 Voucher độc quyền từ [Your Business] - Exclusive Offer Inside! Body:
┌────────────────────────────────────┐ │ [Logo] SPECIAL OFFER FOR YOU │
├────────────────────────────────────┤ │ Xin chào [Name], │ │ │ │ Bạn vừa nhận
được một mã giảm giá! │ │ You just earned an exclusive voucher!│ │ │ │ VOUCHER
DETAILS: │ │ ┌──────────────────────────────┐ │ │ │ DISCOUNT: -20% off services
│ │ │ │ CODE: SUMMER2026PROMO │ │ │ │ Valid: April 16 - April 23 │ │ │ │ Max
value: 500,000 VND │ │ │ │ Min order: 100,000 VND │ │ │ │ [COPY CODE BUTTON] │ │
│ └──────────────────────────────┘ │ │ │ │ [SHOP NOW BUTTON] │ │ │ │ ⏰ This
voucher expires in 7 days! │ │ │ │ Questions? Reply to this email │
└────────────────────────────────────┘
```

**Features:**

- Copy-to-clipboard code button
- Direct "Shop Now" link
- Countdown timer animation
- Desktop + Mobile responsive

#### 4.3.3 Implementation

```javascript
// Send voucher email
POST /api/emails/send-voucher
{
  customerId: "CUST-123",
  voucherId: "VOUCH-456",
  emailTemplate: "voucher-notification",
  sendDate: "2026-04-16T10:00:00Z"
}

// Response
{
  success: true,
  messageId: "MSG-789",
  deliveryStatus: "queued",
  estimatedDelivery: "2026-04-16T10:05:00Z"
}
```

---

### 4.4 Promotion Campaign Bot

#### 4.4.1 Auto-Campaign Scheduling

**Bot Behavior:**

```
Daily at 09:00 AM (Vietnamese time):
  1. Query vouchers expiring within 24 hours
  2. Segment customers by:
     - Status (Regular/VIP)
     - Category preference
     - Last activity
  3. Generate personalized campaigns
  4. Queue emails for sending
  5. Log campaign metrics

Daily at 02:00 PM:
  1. Check customers with pending orders
  2. Send "complete your order" promotion

Weekly (Monday 08:00 AM):
  1. Send weekly featured offers
  2. Flash sale announcements

Monthly (1st day, 08:00 AM):
  1. Birthday vouchers for celebrants
  2. Loyalty rewards digest
```

#### 4.4.2 Email Template: Auto-Campaign

```html
Subject: [PROMO] Khuyến mãi tuần này - {{week}} - Don't Miss Out! Body:
┌─────────────────────────────────┐ │ [Banner Image] │ │ THIS WEEK'S HOT DEALS │
├─────────────────────────────────┤ │ Hi [Customer Name], │ │ │ │ Based on your
preferences, we │ │ selected these special offers: │ │ │ │ 🎯 PERSONALIZED FOR
YOU: │ │ [Offer 1] - expires 2 days │ │ [Offer 2] - expires 5 days │ │ [Offer 3]
- New this week! │ │ │ │ [VIEW ALL OFFERS BUTTON] │ │ │ │ [Social media icons] │
└─────────────────────────────────┘
```

#### 4.4.3 Segmentation Rules

```json
{
  "segments": [
    {
      "name": "VIP_HIGH_VALUE",
      "filters": {
        "customerType": "VIP",
        "totalSpent": ">= 5000000"
      },
      "campaigns": ["exclusive_vip_only", "birthday_gift"]
    },
    {
      "name": "INACTIVE_30DAYS",
      "filters": {
        "lastOrderDate": "30+ days ago"
      },
      "campaigns": ["come_back_discount"]
    },
    {
      "name": "NEW_CUSTOMERS",
      "filters": {
        "createdDate": "< 7 days"
      },
      "campaigns": ["welcome_gift"]
    },
    {
      "name": "CATEGORY_LOVERS",
      "filters": {
        "preferredService": "massage"
      },
      "campaigns": ["massage_special_offer"]
    }
  ]
}
```

#### 4.4.4 Campaign Scheduler (Cron Jobs)

```javascript
// jobs/voucherReminderCron.js
const schedule = require("node-schedule");

// Every day at 9:00 AM
schedule.scheduleJob("0 9 * * *", async () => {
  const expiringSoon = await Voucher.find({
    expiryDate: {
      $gte: new Date(),
      $lte: addDays(new Date(), 1),
    },
    emailSent: false,
  });

  for (let voucher of expiringSoon) {
    await emailService.sendVoucherReminder(voucher);
  }
});

// Every Monday at 8:00 AM
schedule.scheduleJob("0 8 * * 1", async () => {
  const campaigns = await Campaign.find({ type: "weekly" });
  await emailService.sendCampaigns(campaigns);
});
```

---

## 5. DATABASE SCHEMA

### 5.1 Voucher Tables

```sql
-- Voucher Master
CREATE TABLE vouchers (
  id INT PRIMARY KEY AUTO_INCREMENT,
  code VARCHAR(50) UNIQUE NOT NULL,
  voucher_type ENUM('fixed', 'percentage', 'free_delivery') NOT NULL,
  discount_amount DECIMAL(10, 2),
  discount_percent INT,
  min_order_value DECIMAL(10, 2),
  max_discount_amount DECIMAL(10, 2),
  customer_type ENUM('regular', 'vip', 'both') DEFAULT 'both',
  description TEXT,
  issued_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expiry_date TIMESTAMP NOT NULL,
  max_usage_global INT,
  current_usage INT DEFAULT 0,
  status ENUM('active', 'inactive', 'expired') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by INT, -- Staff ID
  INDEX idx_code (code),
  INDEX idx_customer_type (customer_type),
  INDEX idx_expiry_date (expiry_date)
);

-- Voucher Assignment to Customers
CREATE TABLE voucher_assignments (
  id INT PRIMARY KEY AUTO_INCREMENT,
  voucher_id INT NOT NULL,
  customer_id INT NOT NULL,
  assigned_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  max_usage_customer INT DEFAULT 1,
  usage_count INT DEFAULT 0,
  last_used_date TIMESTAMP,
  is_used BOOLEAN DEFAULT FALSE,
  status ENUM('active', 'used', 'expired') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (voucher_id) REFERENCES vouchers(id),
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  UNIQUE KEY unique_voucher_customer (voucher_id, customer_id),
  INDEX idx_customer_id (customer_id),
  INDEX idx_status (status)
);

-- Voucher Usage History
CREATE TABLE voucher_usage_history (
  id INT PRIMARY KEY AUTO_INCREMENT,
  voucher_id INT NOT NULL,
  assignment_id INT,
  customer_id INT NOT NULL,
  appointment_id INT,
  order_id INT,
  discount_applied DECIMAL(10, 2) NOT NULL,
  used_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (voucher_id) REFERENCES vouchers(id),
  FOREIGN KEY (assignment_id) REFERENCES voucher_assignments(id),
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  INDEX idx_customer_id (customer_id),
  INDEX idx_used_date (used_date)
);

-- Suggested Vouchers (Bot generated)
CREATE TABLE voucher_suggestions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  customer_id INT NOT NULL,
  voucher_id INT NOT NULL,
  reason VARCHAR(255), -- "comeback", "category_preference", etc
  confidence_score FLOAT, -- 0-1
  shown_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  clicked BOOLEAN DEFAULT FALSE,
  applied BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  FOREIGN KEY (voucher_id) REFERENCES vouchers(id),
  INDEX idx_customer_id (customer_id),
  INDEX idx_shown_date (shown_date)
);
```

### 5.2 Email Tables

```sql
-- Email Queue
CREATE TABLE email_queue (
  id INT PRIMARY KEY AUTO_INCREMENT,
  recipient_email VARCHAR(255) NOT NULL,
  customer_id INT,
  email_type ENUM('verification', 'voucher', 'campaign', 'bill', 'promotion') NOT NULL,
  subject VARCHAR(255) NOT NULL,
  body_html LONGTEXT NOT NULL,
  body_text TEXT,
  template_name VARCHAR(100),
  variables JSON, -- {name, code, expiryDate, ...}
  status ENUM('pending', 'sent', 'failed', 'bounced') DEFAULT 'pending',
  retry_count INT DEFAULT 0,
  max_retries INT DEFAULT 3,
  error_message TEXT,
  sent_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_status (status),
  INDEX idx_customer_id (customer_id),
  INDEX idx_created_at (created_at)
);

-- Email Delivery Tracking
CREATE TABLE email_delivery_tracking (
  id INT PRIMARY KEY AUTO_INCREMENT,
  email_queue_id INT NOT NULL,
  message_id VARCHAR(255) UNIQUE, -- Google/Email provider ID
  delivery_status ENUM('pending', 'delivered', 'bounced', 'complained') DEFAULT 'pending',
  bounce_type ENUM('permanent', 'temporary', 'undetermined'),
  bounce_reason TEXT,
  open_count INT DEFAULT 0,
  first_open_date TIMESTAMP,
  click_count INT DEFAULT 0,
  first_click_date TIMESTAMP,
  last_update TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (email_queue_id) REFERENCES email_queue(id),
  INDEX idx_delivery_status (delivery_status)
);

-- Email Campaign Batches
CREATE TABLE email_campaigns (
  id INT PRIMARY KEY AUTO_INCREMENT,
  campaign_name VARCHAR(255) NOT NULL,
  campaign_type ENUM('seasonal', 'vip_exclusive', 'comeback', 'weekly', 'birthday') NOT NULL,
  segment_filter JSON, -- {customerType, lastActivityRange, ...}
  email_template VARCHAR(100) NOT NULL,
  scheduled_send_time TIMESTAMP,
  total_recipients INT,
  sent_count INT DEFAULT 0,
  opened_count INT DEFAULT 0,
  clicked_count INT DEFAULT 0,
  status ENUM('draft', 'scheduled', 'sending', 'completed', 'failed') DEFAULT 'draft',
  created_by INT, -- Staff ID
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_scheduled_send_time (scheduled_send_time),
  INDEX idx_status (status)
);
```

### 5.3 Bill & Payment Tables

```sql
-- Extend appointments or orders table
ALTER TABLE appointments ADD COLUMN (
  bill_pdf_path VARCHAR(255),
  bill_generated_at TIMESTAMP,
  bill_sent_via_email BOOLEAN DEFAULT FALSE,
  bill_sent_at TIMESTAMP
);

-- Bill Records
CREATE TABLE bills (
  id INT PRIMARY KEY AUTO_INCREMENT,
  bill_number VARCHAR(50) UNIQUE NOT NULL,
  appointment_id INT NOT NULL,
  customer_id INT NOT NULL,
  subtotal DECIMAL(10, 2) NOT NULL,
  voucher_discount DECIMAL(10, 2) DEFAULT 0,
  tax_amount DECIMAL(10, 2) DEFAULT 0,
  total_amount DECIMAL(10, 2) NOT NULL,
  payment_method VARCHAR(50),
  transaction_id VARCHAR(255),
  bill_pdf_path VARCHAR(255),
  sent_via_email BOOLEAN DEFAULT FALSE,
  email_sent_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (appointment_id) REFERENCES appointments(id),
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  INDEX idx_bill_number (bill_number),
  INDEX idx_customer_id (customer_id),
  INDEX idx_created_at (created_at)
);
```

### 5.4 Customer Enhancement

```sql
-- Enhance customers table
ALTER TABLE customers ADD COLUMN (
  customer_type ENUM('regular', 'vip') DEFAULT 'regular',
  total_spent DECIMAL(15, 2) DEFAULT 0,
  total_orders INT DEFAULT 0,
  last_order_date TIMESTAMP,
  last_activity_date TIMESTAMP,
  created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  email_verified BOOLEAN DEFAULT FALSE,
  email_verified_at TIMESTAMP,
  email_opt_in BOOLEAN DEFAULT TRUE,
  vip_promoted_date TIMESTAMP,
  vip_downgrade_date TIMESTAMP,
  preferred_service_category VARCHAR(100),
  INDEX idx_customer_type (customer_type),
  INDEX idx_last_activity_date (last_activity_date)
);
```

---

## 6. API ENDPOINTS

### 6.1 Voucher APIs

```
POST   /api/vouchers                    # Create voucher (admin)
GET    /api/vouchers                    # List vouchers (admin)
GET    /api/vouchers/:id                # Get voucher details
PUT    /api/vouchers/:id                # Update voucher
DELETE /api/vouchers/:id                # Delete voucher

POST   /api/vouchers/:id/assign         # Assign to customers
GET    /api/vouchers/my-vouchers        # Get my vouchers (customer)
GET    /api/vouchers/suggestions        # Get suggested vouchers
POST   /api/vouchers/:id/use            # Apply voucher in checkout

GET    /api/vouchers/analytics          # Campaign analytics (admin)
```

### 6.2 Email APIs

```
POST   /api/emails/send-verification    # Send account verification
POST   /api/emails/send-voucher         # Send voucher email
POST   /api/emails/send-bill            # Send bill email
POST   /api/emails/campaigns            # Create email campaign
POST   /api/emails/campaigns/:id/send   # Send campaign
GET    /api/emails/campaigns/:id/stats  # Campaign statistics

GET    /api/emails/queue                # View email queue (admin)
GET    /api/emails/delivery-tracking    # Track delivery (admin)
POST   /api/emails/resend/:id           # Resend email
```

### 6.3 Bill APIs

```
GET    /api/bills/:appointmentId        # Get bill
GET    /api/bills/:id/download          # Download bill PDF
POST   /api/bills/:id/send-email        # Resend bill email
```

### 6.4 Customer APIs

```
POST   /api/customers/register          # New customer registration
POST   /api/customers/verify-email      # Verify email token
GET    /api/customers/:id               # Get customer profile (include type)
PUT    /api/customers/:id               # Update profile
```

---

## 7. FRONTEND COMPONENTS

### 7.1 Voucher Components

```
/components/
  ├── VoucherBadge.jsx              # Display expiry urgency
  ├── VoucherCard.jsx               # Single voucher card
  ├── VoucherList.jsx               # List of available vouchers
  ├── SuggestedVoucher.jsx           # Auto-suggested banner
  ├── VoucherCodeCopy.jsx            # Copy code button
  └── MultiVoucherSelector.jsx       # Select multiple vouchers (checkout)

/pages/
  ├── MyVouchers.jsx                 # Customer's voucher dashboard
  └── VoucherDetail.jsx              # Single voucher details
```

### 7.2 Email Management Components

```
/components/
  ├── EmailVerificationModal.jsx     # Verification prompt
  ├── BillPreview.jsx                # Bill preview/download
  ├── EmailOptInToggle.jsx           # Email preferences
  └── CampaignPerformance.jsx        # Admin campaign stats

/pages/
  └── EmailPreferences.jsx           # Customer email settings
```

### 7.3 Checkout Enhancement

```
Updated /pages/Checkout.jsx:
  ├── Add voucher selection section
  ├── Show multi-voucher compatibility
  ├── Display total savings breakdown
  └── Auto-bill generation on payment success
```

---

## 8. BACKEND STRUCTURE

```
/src/
  ├── /controllers/
  │   ├── voucherController.js
  │   ├── emailController.js
  │   ├── billController.js
  │   └── voucherSuggestionController.js
  │
  ├── /services/
  │   ├── voucherService.js
  │   ├── emailService.js
  │   ├── billService.js
  │   ├── voucherSuggestionEngine.js
  │   └── googleEmailService.js
  │
  ├── /models/
  │   ├── voucherModel.js
  │   ├── voucherAssignmentModel.js
  │   ├── emailQueueModel.js
  │   ├── billModel.js
  │   └── emailCampaignModel.js
  │
  ├── /middleware/
  │   ├── voucherMiddleware.js
  │   └── emailValidationMiddleware.js
  │
  ├── /templates/
  │   ├── email/
  │   │   ├── account-verification.html
  │   │   ├── voucher-notification.html
  │   │   ├── promotion-campaign.html
  │   │   └── bill-receipt.html
  │   └── pdf/
  │       └── bill-template.html
  │
  ├── /jobs/
  │   ├── voucherExpiryNotificationCron.js
  │   ├── voucherSuggestionCron.js
  │   ├── campaignSchedulerCron.js
  │   └── emailQueueProcessor.js
  │
  ├── /utils/
  │   ├── pdfGenerator.js
  │   ├── emailTemplate.js
  │   └── voucherValidator.js
  │
  └── /config/
      └── emailConfig.js
```

---

## 9. IMPLEMENTATION TIMELINE

### Phase 1: Foundation (Week 1-2)

- [ ] Database schema & migrations
- [ ] Voucher CRUD operations
- [ ] Basic email service setup
- [ ] Email verification flow

### Phase 2: Smart Features (Week 2-3)

- [ ] Voucher classification (Regular/VIP)
- [ ] Voucher suggestion engine
- [ ] Multi-voucher support
- [ ] Voucher time-limit logic

### Phase 3: Auto-Bill (Week 3)

- [ ] Bill PDF generation
- [ ] Auto-bill display on payment success
- [ ] Bill download/email functionality

### Phase 4: Email Automation (Week 4)

- [ ] Voucher email campaign
- [ ] Bot-driven auto-campaigns
- [ ] Reminder emails (expiring vouchers)
- [ ] Cron job setup

### Phase 5: Testing & Optimization (Week 5)

- [ ] Integration testing
- [ ] Email delivery tracking
- [ ] Performance optimization
- [ ] QA & bug fixes

### Phase 6: Deployment

- [ ] Production deployment
- [ ] Monitoring setup
- [ ] Documentation

---

## 10. KEY TECHNOLOGIES

### Backend

- **Node.js + Express.js** - REST API
- **MySQL** - Database
- **Google Gmail API** - Email service
- **node-schedule** - Cron jobs
- **pdfkit** - PDF generation
- **Bull/Bee-Queue** - Email queue management
- **JWT** - Token authentication

### Frontend

- **React.js** - UI components
- **Axios** - API calls
- **moment.js / date-fns** - Date handling
- **react-copy-to-clipboard** - Copy code button

### Email

- **Nodemailer** - SMTP client
- **Handlebars / EJS** - Template engine
- **Google Service Account** - Authentication

---

## 11. SECURITY CONSIDERATIONS

### Email Security

- [ ] Validate email addresses
- [ ] Implement SPF, DKIM, DMARC
- [ ] Rate-limit email sending
- [ ] Sanitize template variables

### Voucher Security

- [ ] Hash/encrypt voucher codes
- [ ] Validate voucher expiry server-side
- [ ] Prevent code reuse
- [ ] Bot detection for auto-suggest

### Data Protection

- [ ] Encrypt sensitive data (customer emails)
- [ ] HTTPS only for API calls
- [ ] Implement CORS properly
- [ ] Audit logs for admin actions

---

## 12. TESTING STRATEGY

### Unit Tests

- Voucher validation logic
- Email template rendering
- Bill calculation
- Customer type classification

### Integration Tests

- Voucher assignment workflow
- Email sending pipeline
- Multi-voucher checkout
- Payment → Bill → Email flow

### End-to-End Tests

- Customer registration → verification email
- Voucher reception → usage → billing
- Campaign scheduling & sending

### Load Testing

- Email queue under high volume
- Concurrent voucher applications
- Campaign sending to 10k+ customers

---

## 13. MONITORING & ANALYTICS

### Key Metrics

- Email delivery rate (%)
- Email open rate (%)
- Voucher usage rate (%)
- Revenue impact per campaign
- Customer acquisition cost (CAC)
- Customer lifetime value (LTV)

### Dashboards

- Admin: Campaign performance, email metrics
- Customer: Voucher status, bill history, email preferences
- Analytics: Funnel analysis, A/B test results

---

## 14. DEPLOYMENT CHECKLIST

- [ ] Database backups configured
- [ ] Email service credentials secure
- [ ] Google API credentials set up
- [ ] SMTP & security settings configured
- [ ] Monitoring & alerts enabled
- [ ] Error tracking (Sentry) enabled
- [ ] CDN/cache configured
- [ ] Rate limiting configured
- [ ] User documentation completed
- [ ] Admin training completed

---

**Document Prepared By:** Development Team  
**Version:** 1.0  
**Last Updated:** April 16, 2026  
**Status:** Ready for Development
