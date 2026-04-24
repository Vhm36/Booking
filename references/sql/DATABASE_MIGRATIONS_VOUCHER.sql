-- ===================================================================
-- VOUCHER SMART SYSTEM - DATABASE MIGRATIONS
-- Date: April 16, 2026
-- ===================================================================

-- ===================================================================
-- STEP 1: CREATE VOUCHER TABLES
-- ===================================================================

-- Main Vouchers Table
CREATE TABLE vouchers (
  id INT PRIMARY KEY AUTO_INCREMENT,
  code VARCHAR(50) UNIQUE NOT NULL COMMENT 'Unique voucher code',
  voucher_type ENUM('fixed', 'percentage', 'free_delivery') NOT NULL COMMENT 'Type: fixed amount, percentage, or free delivery',
  discount_amount DECIMAL(10, 2) COMMENT 'Fixed discount amount (VND)',
  discount_percent INT COMMENT 'Percentage discount (0-100)',
  min_order_value DECIMAL(10, 2) DEFAULT 0 COMMENT 'Minimum order value to apply voucher',
  max_discount_amount DECIMAL(10, 2) COMMENT 'Maximum discount cap',
  customer_type ENUM('regular', 'vip', 'both') DEFAULT 'both' COMMENT 'Target customer type',
  description TEXT COMMENT 'Voucher description',
  issued_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Date voucher issued',
  expiry_date TIMESTAMP NOT NULL COMMENT 'Expiry date (usually +7 days from issued)',
  max_usage_global INT COMMENT 'Global max usage count',
  current_usage INT DEFAULT 0 COMMENT 'Current global usage count',
  status ENUM('active', 'inactive', 'expired') DEFAULT 'active' COMMENT 'Voucher status',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by INT COMMENT 'Staff ID who created',
  
  PRIMARY KEY (id),
  INDEX idx_code (code),
  INDEX idx_customer_type (customer_type),
  INDEX idx_expiry_date (expiry_date),
  INDEX idx_status (status),
  INDEX idx_issued_date (issued_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Voucher Assignment to Customers
CREATE TABLE voucher_assignments (
  id INT PRIMARY KEY AUTO_INCREMENT,
  voucher_id INT NOT NULL,
  customer_id INT NOT NULL,
  assigned_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  max_usage_customer INT DEFAULT 1 COMMENT 'Max usage per customer',
  usage_count INT DEFAULT 0 COMMENT 'Current usage count',
  last_used_date TIMESTAMP COMMENT 'Last time used',
  is_used BOOLEAN DEFAULT FALSE,
  status ENUM('active', 'used', 'expired') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  PRIMARY KEY (id),
  FOREIGN KEY (voucher_id) REFERENCES vouchers(id) ON DELETE CASCADE,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
  UNIQUE KEY unique_voucher_customer (voucher_id, customer_id),
  INDEX idx_customer_id (customer_id),
  INDEX idx_voucher_id (voucher_id),
  INDEX idx_status (status),
  INDEX idx_assigned_date (assigned_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Voucher Usage History
CREATE TABLE voucher_usage_history (
  id INT PRIMARY KEY AUTO_INCREMENT,
  voucher_id INT NOT NULL,
  assignment_id INT,
  customer_id INT NOT NULL,
  appointment_id INT COMMENT 'Associated appointment',
  order_id INT COMMENT 'Associated order',
  discount_applied DECIMAL(10, 2) NOT NULL,
  used_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  PRIMARY KEY (id),
  FOREIGN KEY (voucher_id) REFERENCES vouchers(id) ON DELETE CASCADE,
  FOREIGN KEY (assignment_id) REFERENCES voucher_assignments(id) ON DELETE SET NULL,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
  INDEX idx_customer_id (customer_id),
  INDEX idx_voucher_id (voucher_id),
  INDEX idx_used_date (used_date),
  INDEX idx_appointment_id (appointment_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Suggested Vouchers (Bot generated)
CREATE TABLE voucher_suggestions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  customer_id INT NOT NULL,
  voucher_id INT NOT NULL,
  reason VARCHAR(255) COMMENT 'Reason: comeback, category_preference, new_service, etc',
  confidence_score FLOAT COMMENT 'ML Score (0-1)',
  shown_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  clicked BOOLEAN DEFAULT FALSE,
  applied BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  PRIMARY KEY (id),
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
  FOREIGN KEY (voucher_id) REFERENCES vouchers(id) ON DELETE CASCADE,
  INDEX idx_customer_id (customer_id),
  INDEX idx_voucher_id (voucher_id),
  INDEX idx_shown_date (shown_date),
  INDEX idx_reason (reason)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===================================================================
-- STEP 2: CREATE EMAIL TABLES
-- ===================================================================

-- Email Verification Tokens
CREATE TABLE email_verification_tokens (
  id INT PRIMARY KEY AUTO_INCREMENT,
  customer_id INT NOT NULL,
  email VARCHAR(255) NOT NULL,
  token VARCHAR(500) UNIQUE NOT NULL COMMENT 'JWT or UUID token',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP COMMENT 'Token expiry (usually +24 hours)',
  verified_at TIMESTAMP COMMENT 'When verified',
  is_used BOOLEAN DEFAULT FALSE,
  
  PRIMARY KEY (id),
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
  INDEX idx_token (token),
  INDEX idx_customer_id (customer_id),
  INDEX idx_expires_at (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
  variables JSON COMMENT 'Template variables as JSON',
  status ENUM('pending', 'sent', 'failed', 'bounced') DEFAULT 'pending',
  retry_count INT DEFAULT 0,
  max_retries INT DEFAULT 3,
  error_message TEXT,
  sent_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  PRIMARY KEY (id),
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
  INDEX idx_status (status),
  INDEX idx_customer_id (customer_id),
  INDEX idx_created_at (created_at),
  INDEX idx_recipient_email (recipient_email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Email Delivery Tracking
CREATE TABLE email_delivery_tracking (
  id INT PRIMARY KEY AUTO_INCREMENT,
  email_queue_id INT NOT NULL,
  message_id VARCHAR(255) UNIQUE COMMENT 'Google/Provider message ID',
  delivery_status ENUM('pending', 'delivered', 'bounced', 'complained') DEFAULT 'pending',
  bounce_type ENUM('permanent', 'temporary', 'undetermined') COMMENT 'Type of bounce if failed',
  bounce_reason TEXT,
  open_count INT DEFAULT 0,
  first_open_date TIMESTAMP,
  click_count INT DEFAULT 0,
  first_click_date TIMESTAMP,
  last_update TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  PRIMARY KEY (id),
  FOREIGN KEY (email_queue_id) REFERENCES email_queue(id) ON DELETE CASCADE,
  INDEX idx_delivery_status (delivery_status),
  INDEX idx_message_id (message_id),
  INDEX idx_email_queue_id (email_queue_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Email Campaign Batches
CREATE TABLE email_campaigns (
  id INT PRIMARY KEY AUTO_INCREMENT,
  campaign_name VARCHAR(255) NOT NULL,
  campaign_type ENUM('seasonal', 'vip_exclusive', 'comeback', 'weekly', 'birthday') NOT NULL,
  segment_filter JSON COMMENT 'Customer segment filter criteria',
  email_template VARCHAR(100) NOT NULL COMMENT 'Template file name',
  scheduled_send_time TIMESTAMP,
  total_recipients INT DEFAULT 0,
  sent_count INT DEFAULT 0,
  opened_count INT DEFAULT 0,
  clicked_count INT DEFAULT 0,
  status ENUM('draft', 'scheduled', 'sending', 'completed', 'failed') DEFAULT 'draft',
  created_by INT COMMENT 'Staff ID',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  PRIMARY KEY (id),
  INDEX idx_scheduled_send_time (scheduled_send_time),
  INDEX idx_status (status),
  INDEX idx_campaign_type (campaign_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===================================================================
-- STEP 3: CREATE BILL TABLES
-- ===================================================================

-- Bill Records
CREATE TABLE bills (
  id INT PRIMARY KEY AUTO_INCREMENT,
  bill_number VARCHAR(50) UNIQUE NOT NULL COMMENT 'Unique bill number: BILL-YYYY-MMDD-NNNN',
  appointment_id INT NOT NULL,
  customer_id INT NOT NULL,
  subtotal DECIMAL(10, 2) NOT NULL COMMENT 'Subtotal before discount/tax',
  voucher_discount DECIMAL(10, 2) DEFAULT 0,
  voucher_codes TEXT COMMENT 'Applied voucher codes (comma-separated)',
  tax_amount DECIMAL(10, 2) DEFAULT 0 COMMENT 'Tax/VAT amount',
  total_amount DECIMAL(10, 2) NOT NULL COMMENT 'Final total',
  payment_method VARCHAR(50) COMMENT 'Credit Card, Cash, Bank Transfer, etc',
  transaction_id VARCHAR(255) COMMENT 'Payment gateway transaction ID',
  bill_pdf_path VARCHAR(255) COMMENT 'Path to generated PDF',
  sent_via_email BOOLEAN DEFAULT FALSE,
  email_sent_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  PRIMARY KEY (id),
  FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
  INDEX idx_bill_number (bill_number),
  INDEX idx_customer_id (customer_id),
  INDEX idx_created_at (created_at),
  INDEX idx_appointment_id (appointment_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===================================================================
-- STEP 4: ALTER EXISTING TABLES
-- ===================================================================

-- Enhance customers table with new columns
ALTER TABLE customers ADD COLUMN (
  customer_type ENUM('regular', 'vip') DEFAULT 'regular' COMMENT 'Customer classification',
  total_spent DECIMAL(15, 2) DEFAULT 0 COMMENT 'Total spending amount',
  total_orders INT DEFAULT 0 COMMENT 'Total number of orders',
  last_order_date TIMESTAMP COMMENT 'Last order date',
  last_activity_date TIMESTAMP COMMENT 'Last login/activity date',
  email_verified BOOLEAN DEFAULT FALSE COMMENT 'Email verification status',
  email_verified_at TIMESTAMP COMMENT 'When email was verified',
  email_opt_in BOOLEAN DEFAULT TRUE COMMENT 'Opted in for marketing emails',
  vip_promoted_date TIMESTAMP COMMENT 'When upgraded to VIP',
  vip_downgrade_date TIMESTAMP COMMENT 'When downgraded from VIP',
  preferred_service_category VARCHAR(100) COMMENT 'Most frequently booked service',
  repeat_rate FLOAT COMMENT 'Repeat booking rate (0-1)',
  INDEX idx_customer_type (customer_type),
  INDEX idx_last_activity_date (last_activity_date),
  INDEX idx_email_verified (email_verified)
);

-- Add bill tracking to appointments
ALTER TABLE appointments ADD COLUMN (
  bill_id INT COMMENT 'Associated bill',
  bill_generated_at TIMESTAMP COMMENT 'When bill was generated',
  bill_sent_via_email BOOLEAN DEFAULT FALSE,
  bill_sent_at TIMESTAMP,
  FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE SET NULL,
  INDEX idx_bill_generated_at (bill_generated_at)
);

-- ===================================================================
-- STEP 5: CREATE INDEXES FOR PERFORMANCE
-- ===================================================================

-- Performance indexes
CREATE INDEX idx_vouchers_code_status ON vouchers(code, status);
CREATE INDEX idx_assignments_customer_active ON voucher_assignments(customer_id, status);
CREATE INDEX idx_suggestions_customer_applied ON voucher_suggestions(customer_id, applied);
CREATE INDEX idx_email_queue_status_created ON email_queue(status, created_at);
CREATE INDEX idx_email_campaigns_scheduled ON email_campaigns(status, scheduled_send_time);

-- ===================================================================
-- STEP 6: SAMPLE DATA (OPTIONAL)
-- ===================================================================

-- Sample Regular Voucher
INSERT INTO vouchers (code, voucher_type, discount_percent, min_order_value, customer_type, description, issued_date, expiry_date, status, created_by)
VALUES (
  'REGULAR10',
  'percentage',
  10,
  50000,
  'regular',
  'Regular customer 10% discount',
  NOW(),
  DATE_ADD(NOW(), INTERVAL 7 DAY),
  'active',
  1
);

-- Sample VIP Voucher
INSERT INTO vouchers (code, voucher_type, discount_percent, min_order_value, customer_type, description, issued_date, expiry_date, status, created_by)
VALUES (
  'VIP20',
  'percentage',
  20,
  0,
  'vip',
  'VIP member 20% discount',
  NOW(),
  DATE_ADD(NOW(), INTERVAL 7 DAY),
  'active',
  1
);

-- Sample Free Delivery Voucher
INSERT INTO vouchers (code, voucher_type, customer_type, description, issued_date, expiry_date, status, created_by)
VALUES (
  'FREEDEL',
  'free_delivery',
  'both',
  'Free delivery on any order',
  NOW(),
  DATE_ADD(NOW(), INTERVAL 7 DAY),
  'active',
  1
);

-- ===================================================================
-- VERIFICATION QUERIES (Run these to verify setup)
-- ===================================================================

-- Verify tables created
-- SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE();

-- Verify voucher columns
-- DESCRIBE vouchers;

-- Count vouchers
-- SELECT COUNT(*) as total_vouchers FROM vouchers;

-- ===================================================================
-- END OF MIGRATIONS
-- ===================================================================
