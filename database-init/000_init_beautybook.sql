CREATE DATABASE IF NOT EXISTS booking_system
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE booking_system;
SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;
SET FOREIGN_KEY_CHECKS = 0;

-- Xóa tất cả bảng cũ (thứ tự ngược FK)
DROP TABLE IF EXISTS chat_bot_responses;
DROP TABLE IF EXISTS chat_faq;
DROP TABLE IF EXISTS chat_suggestions;
DROP TABLE IF EXISTS chat_messages;
DROP TABLE IF EXISTS chat_conversations;
DROP TABLE IF EXISTS voucher_assignments;
DROP TABLE IF EXISTS vouchers;
DROP TABLE IF EXISTS staff_weekly_availability;
DROP TABLE IF EXISTS payments;
DROP TABLE IF EXISTS appointment_services;
DROP TABLE IF EXISTS appointments;
DROP TABLE IF EXISTS service_category;
DROP TABLE IF EXISTS services;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS staff_role;

SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE staff_role (
  id INT AUTO_INCREMENT PRIMARY KEY,
  role_name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_staff_role_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) NOT NULL UNIQUE,
  zalo_id VARCHAR(64) NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  role ENUM('customer', 'admin', 'staff') DEFAULT 'customer',
  staff_role_id INT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  customer_segment VARCHAR(40) NOT NULL DEFAULT 'New Customers',
  rfm_score VARCHAR(10) NULL,
  rfm_recency_score TINYINT UNSIGNED NULL,
  rfm_frequency_score TINYINT UNSIGNED NULL,
  rfm_monetary_score TINYINT UNSIGNED NULL,
  rfm_updated_at TIMESTAMP NULL,
  date_of_birth DATE NULL,
  cancellation_count INT NOT NULL DEFAULT 0,
  cancellation_rate DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  noshow_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_users_staff_role_id (staff_role_id),
  INDEX idx_users_customer_segment (customer_segment),
  INDEX idx_users_date_of_birth (date_of_birth),
  CONSTRAINT fk_users_staff_role
    FOREIGN KEY (staff_role_id) REFERENCES staff_role(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE services (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  duration INT NOT NULL,
  description TEXT,
  category VARCHAR(100),
  image_url VARCHAR(512),
  status ENUM('active', 'inactive') DEFAULT 'active',
  service_code VARCHAR(50) UNIQUE DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE service_category (
  id INT AUTO_INCREMENT PRIMARY KEY,
  category_name VARCHAR(100) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE appointments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  service_id INT NOT NULL,
  staff_id INT NULL,
  appointment_date DATE NOT NULL,
  appointment_time TIME NOT NULL,
  end_time TIME NULL,
  status ENUM('pending', 'confirmed', 'completed', 'cancelled') DEFAULT 'pending',
  cancellation_requested TINYINT(1) NOT NULL DEFAULT 0,
  cancellation_requested_at DATETIME NULL,
  notes TEXT,
  total_amount DECIMAL(10,2),
  original_amount DECIMAL(10,2) NULL,
  voucher_discount DECIMAL(10,2) NOT NULL DEFAULT 0,
  voucher_codes VARCHAR(255) NULL,
  reminder_sent TINYINT(1) NOT NULL DEFAULT 0,
  reminder_sent_at DATETIME NULL,
  cancellation_score DECIMAL(5,2) NULL,
  cancellation_risk ENUM('low', 'medium', 'high') NOT NULL DEFAULT 'low',
  deposit_required TINYINT(1) NOT NULL DEFAULT 0,
  deposit_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  staff_rating TINYINT UNSIGNED NULL,
  staff_review TEXT NULL,
  reviewed_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_appointments_staff_slot (staff_id, appointment_date, appointment_time, status),
  INDEX idx_appointments_reminder (appointment_date, appointment_time, reminder_sent, status),
  INDEX idx_appointments_cancellation_risk (cancellation_risk, deposit_required),
  CONSTRAINT fk_appointments_user
    FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_appointments_service
    FOREIGN KEY (service_id) REFERENCES services(id),
  CONSTRAINT fk_appointments_staff
    FOREIGN KEY (staff_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE appointment_services (
  id INT AUTO_INCREMENT PRIMARY KEY,
  appointment_id INT NOT NULL,
  service_id INT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  price_snapshot DECIMAL(10,2) NOT NULL,
  duration_snapshot INT NOT NULL,
  service_name_snapshot VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_appointment_service_order (appointment_id, sort_order),
  INDEX idx_appointment_services_appointment (appointment_id),
  INDEX idx_appointment_services_service (service_id),
  CONSTRAINT fk_appointment_services_appointment
    FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE,
  CONSTRAINT fk_appointment_services_service
    FOREIGN KEY (service_id) REFERENCES services(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  appointment_id INT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  payment_method ENUM('cash', 'banking', 'momo', 'vnpay', 'vietqr') DEFAULT 'cash',
  payment_status ENUM('pending', 'paid', 'failed') DEFAULT 'pending',
  payment_reference VARCHAR(100) NULL UNIQUE,
  transaction_code VARCHAR(255) NULL,
  bank_code VARCHAR(50) NULL,
  bank_transaction_no VARCHAR(100) NULL,
  gateway_response_code VARCHAR(10) NULL,
  gateway_transaction_status VARCHAR(10) NULL,
  payment_url_expires_at DATETIME NULL,
  gateway_payload TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  paid_at TIMESTAMP NULL,
  CONSTRAINT fk_payments_appointment
    FOREIGN KEY (appointment_id) REFERENCES appointments(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE staff_weekly_availability (
  id INT AUTO_INCREMENT PRIMARY KEY,
  staff_id INT NOT NULL,
  day_of_week TINYINT NOT NULL COMMENT '0=Monday ... 6=Sunday (matches MySQL WEEKDAY)',
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  INDEX idx_staff_week (staff_id, day_of_week),
  CONSTRAINT fk_staff_weekly_availability_staff
    FOREIGN KEY (staff_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE vouchers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(50) NOT NULL UNIQUE,
  voucher_type ENUM('fixed', 'percentage', 'free_delivery') NOT NULL,
  discount_amount DECIMAL(10,2) NULL,
  discount_percent INT NULL,
  min_order_value DECIMAL(10,2) NOT NULL DEFAULT 0,
  max_discount_amount DECIMAL(10,2) NULL,
  customer_type ENUM('regular', 'vip', 'vvip', 'vvvip', 'both') NOT NULL DEFAULT 'both',
  description TEXT NULL,
  issued_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expiry_date DATETIME NOT NULL,
  max_usage_global INT NULL,
  current_usage INT NOT NULL DEFAULT 0,
  status ENUM('active', 'inactive', 'expired') NOT NULL DEFAULT 'active',
  created_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_vouchers_code (code),
  INDEX idx_vouchers_customer_type (customer_type),
  INDEX idx_vouchers_expiry_date (expiry_date),
  INDEX idx_vouchers_status (status),
  CONSTRAINT fk_vouchers_created_by
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE voucher_assignments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  voucher_id INT NOT NULL,
  user_id INT NOT NULL,
  assigned_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  max_usage_customer INT NOT NULL DEFAULT 1,
  usage_count INT NOT NULL DEFAULT 0,
  last_used_date TIMESTAMP NULL,
  is_used TINYINT(1) NOT NULL DEFAULT 0,
  status ENUM('active', 'used', 'expired') NOT NULL DEFAULT 'active',
  source ENUM('admin', 'system', 'bot') NOT NULL DEFAULT 'admin',
  reason VARCHAR(255) NULL,
  confidence_score FLOAT NULL,
  shown_date TIMESTAMP NULL,
  clicked TINYINT(1) NOT NULL DEFAULT 0,
  applied TINYINT(1) NOT NULL DEFAULT 0,
  last_appointment_id INT NULL,
  last_discount_applied DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_discount_applied DECIMAL(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_voucher_user (voucher_id, user_id),
  INDEX idx_voucher_assignments_user (user_id),
  INDEX idx_voucher_assignments_voucher (voucher_id),
  INDEX idx_voucher_assignments_status (status),
  INDEX idx_voucher_assignments_source (source),
  INDEX idx_voucher_assignments_shown_date (shown_date),
  CONSTRAINT fk_voucher_assignments_voucher
    FOREIGN KEY (voucher_id) REFERENCES vouchers(id) ON DELETE CASCADE,
  CONSTRAINT fk_voucher_assignments_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_voucher_assignments_last_appointment
    FOREIGN KEY (last_appointment_id) REFERENCES appointments(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE chat_conversations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  status ENUM('open', 'closed', 'escalated') DEFAULT 'open',
  assigned_staff_id INT NULL,
  subject VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  closed_at TIMESTAMP NULL,
  INDEX idx_chat_conversations_user_status (user_id, status),
  INDEX idx_chat_conversations_assigned_staff (assigned_staff_id),
  INDEX idx_chat_conversations_created_at (created_at),
  CONSTRAINT fk_chat_conversations_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_chat_conversations_assigned_staff
    FOREIGN KEY (assigned_staff_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE chat_messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  conversation_id INT NOT NULL,
  sender_type ENUM('customer', 'bot', 'staff') DEFAULT 'customer',
  sender_id INT NULL,
  message_text TEXT NOT NULL,
  message_type ENUM('text', 'suggestion', 'quick_reply', 'system') DEFAULT 'text',
  metadata JSON NULL,
  sentiment VARCHAR(20) DEFAULT NULL,
  escalated TINYINT(1) DEFAULT 0,
  is_read TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_chat_messages_conversation (conversation_id),
  INDEX idx_chat_messages_sender (sender_type, sender_id),
  INDEX idx_chat_messages_created_at (created_at),
  INDEX idx_chat_messages_is_read (is_read),
  CONSTRAINT fk_chat_messages_conversation
    FOREIGN KEY (conversation_id) REFERENCES chat_conversations(id) ON DELETE CASCADE,
  CONSTRAINT fk_chat_messages_sender
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE chat_suggestions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  category VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  icon VARCHAR(50),
  action_type ENUM('service', 'booking', 'faq', 'contact', 'promotion') DEFAULT 'service',
  action_data JSON,
  priority INT DEFAULT 0,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_chat_suggestions_category_active (category, is_active),
  INDEX idx_chat_suggestions_priority (priority DESC),
  INDEX idx_chat_suggestions_action_type (action_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE chat_faq (
  id INT AUTO_INCREMENT PRIMARY KEY,
  question VARCHAR(255) NOT NULL,
  answer TEXT NOT NULL,
  category VARCHAR(100),
  keywords VARCHAR(500),
  is_active TINYINT(1) DEFAULT 1,
  view_count INT DEFAULT 0,
  helpful_count INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_chat_faq_category_active (category, is_active),
  INDEX idx_chat_faq_keywords (keywords),
  INDEX idx_chat_faq_view_count (view_count DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE chat_bot_responses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  trigger_keyword VARCHAR(255) NOT NULL,
  response_text TEXT NOT NULL,
  response_type ENUM('text', 'suggestion', 'escalate') DEFAULT 'text',
  confidence_score DECIMAL(3,2) DEFAULT 0.80,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_chat_bot_responses_trigger_keyword (trigger_keyword),
  INDEX idx_chat_bot_responses_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO staff_role (id, role_name, description)
VALUES
  (1, 'Nhân viên', 'Nhân viên thực hiện dịch vụ cho khách hàng'),
  (2, 'Thu ngân', 'Nhân viên xử lý thanh toán và hỗ trợ quầy'),
  (3, 'Quản lý', 'Nhân viên quản lý vận hành salon');

INSERT INTO users (id, name, email, password, phone, role, staff_role_id, is_active, created_at)
VALUES
  -- === ADMIN (3) ===
  (1,  'Quản trị viên', 'admin@beautybook.com', '$2a$10$0pvvqR74Znq9SuBZ0HkOju0Dlar/LZIhcL6fxa7GzUxlBL37liBwG', '0901000001', 'admin', NULL, 1, NOW()),
  (5,  'Diệu Anh', 'dieuanh@beautybook.com', '$2a$10$0pvvqR74Znq9SuBZ0HkOju0Dlar/LZIhcL6fxa7GzUxlBL37liBwG', '0901100001', 'admin', NULL, 1, NOW()),
  (6,  'Minh Quân', 'minhquan@beautybook.com', '$2a$10$0pvvqR74Znq9SuBZ0HkOju0Dlar/LZIhcL6fxa7GzUxlBL37liBwG', '0901100002', 'admin', NULL, 1, NOW()),

  -- === THU NGÂN (3) ===
  (2,  'Thu Ngân', 'thungan@beautybook.com', '$2a$10$0pvvqR74Znq9SuBZ0HkOju0Dlar/LZIhcL6fxa7GzUxlBL37liBwG', '0901000002', 'staff', 2, 1, NOW()),
  (7,  'Thanh Tâm', 'thanhtam@beautybook.com', '$2a$10$0pvvqR74Znq9SuBZ0HkOju0Dlar/LZIhcL6fxa7GzUxlBL37liBwG', '0901200001', 'staff', 2, 1, NOW()),
  (8,  'Hồng Nhung', 'hongnhung@beautybook.com', '$2a$10$0pvvqR74Znq9SuBZ0HkOju0Dlar/LZIhcL6fxa7GzUxlBL37liBwG', '0901200002', 'staff', 2, 1, NOW()),

  -- === NHÂN VIÊN DỊCH VỤ (6) ===
  (3,  'Nhân Viên', 'nhanvien@beautybook.com', '$2a$10$0pvvqR74Znq9SuBZ0HkOju0Dlar/LZIhcL6fxa7GzUxlBL37liBwG', '0901000003', 'staff', 1, 1, NOW()),
  (9,  'Ngọc Trinh', 'ngoctrinh@beautybook.com', '$2a$10$0pvvqR74Znq9SuBZ0HkOju0Dlar/LZIhcL6fxa7GzUxlBL37liBwG', '0901300001', 'staff', 1, 1, NOW()),
  (10, 'Thùy Linh', 'thuylinh@beautybook.com', '$2a$10$0pvvqR74Znq9SuBZ0HkOju0Dlar/LZIhcL6fxa7GzUxlBL37liBwG', '0901300002', 'staff', 1, 1, NOW()),
  (11, 'Bảo Ngọc', 'baongoc@beautybook.com', '$2a$10$0pvvqR74Znq9SuBZ0HkOju0Dlar/LZIhcL6fxa7GzUxlBL37liBwG', '0901300003', 'staff', 1, 1, NOW()),
  (12, 'Phương Anh', 'phuonganh@beautybook.com', '$2a$10$0pvvqR74Znq9SuBZ0HkOju0Dlar/LZIhcL6fxa7GzUxlBL37liBwG', '0901300004', 'staff', 1, 1, NOW()),
  (13, 'Khánh Vy', 'khanhvy@beautybook.com', '$2a$10$0pvvqR74Znq9SuBZ0HkOju0Dlar/LZIhcL6fxa7GzUxlBL37liBwG', '0901300005', 'staff', 1, 1, NOW()),

  -- === KHÁCH HÀNG (16) ===
  (4,  'Khách Hàng', 'khachhang@beautybook.com', '$2a$10$0pvvqR74Znq9SuBZ0HkOju0Dlar/LZIhcL6fxa7GzUxlBL37liBwG', '0901000004', 'customer', NULL, 1, NOW()),
  (14, 'Trần Thị Mai', 'mai.tran@gmail.com', '$2a$10$0pvvqR74Znq9SuBZ0HkOju0Dlar/LZIhcL6fxa7GzUxlBL37liBwG', '0912000001', 'customer', NULL, 1, DATE_SUB(NOW(), INTERVAL 60 DAY)),
  (15, 'Nguyễn Hồng Hạnh', 'hanh.nguyen@gmail.com', '$2a$10$0pvvqR74Znq9SuBZ0HkOju0Dlar/LZIhcL6fxa7GzUxlBL37liBwG', '0912000002', 'customer', NULL, 1, DATE_SUB(NOW(), INTERVAL 55 DAY)),
  (16, 'Lê Thùy Dung', 'dung.le@gmail.com', '$2a$10$0pvvqR74Znq9SuBZ0HkOju0Dlar/LZIhcL6fxa7GzUxlBL37liBwG', '0912000003', 'customer', NULL, 1, DATE_SUB(NOW(), INTERVAL 50 DAY)),
  (17, 'Phạm Thanh Hà', 'ha.pham@gmail.com', '$2a$10$0pvvqR74Znq9SuBZ0HkOju0Dlar/LZIhcL6fxa7GzUxlBL37liBwG', '0912000004', 'customer', NULL, 1, DATE_SUB(NOW(), INTERVAL 45 DAY)),
  (18, 'Vũ Minh Châu', 'chau.vu@gmail.com', '$2a$10$0pvvqR74Znq9SuBZ0HkOju0Dlar/LZIhcL6fxa7GzUxlBL37liBwG', '0912000005', 'customer', NULL, 1, DATE_SUB(NOW(), INTERVAL 40 DAY)),
  (19, 'Đỗ Quỳnh Anh', 'quynhanh.do@gmail.com', '$2a$10$0pvvqR74Znq9SuBZ0HkOju0Dlar/LZIhcL6fxa7GzUxlBL37liBwG', '0912000006', 'customer', NULL, 1, DATE_SUB(NOW(), INTERVAL 35 DAY)),
  (20, 'Hoàng Yến Nhi', 'yennhi.hoang@gmail.com', '$2a$10$0pvvqR74Znq9SuBZ0HkOju0Dlar/LZIhcL6fxa7GzUxlBL37liBwG', '0912000007', 'customer', NULL, 1, DATE_SUB(NOW(), INTERVAL 30 DAY)),
  (21, 'Bùi Tường Vi', 'tuongvi.bui@gmail.com', '$2a$10$0pvvqR74Znq9SuBZ0HkOju0Dlar/LZIhcL6fxa7GzUxlBL37liBwG', '0912000008', 'customer', NULL, 1, DATE_SUB(NOW(), INTERVAL 28 DAY)),
  (22, 'Đinh Ngọc Lan', 'ngoclan.dinh@gmail.com', '$2a$10$0pvvqR74Znq9SuBZ0HkOju0Dlar/LZIhcL6fxa7GzUxlBL37liBwG', '0912000009', 'customer', NULL, 1, DATE_SUB(NOW(), INTERVAL 25 DAY)),
  (23, 'Trịnh Khánh Linh', 'khanhlinh.trinh@gmail.com', '$2a$10$0pvvqR74Znq9SuBZ0HkOju0Dlar/LZIhcL6fxa7GzUxlBL37liBwG', '0912000010', 'customer', NULL, 1, DATE_SUB(NOW(), INTERVAL 22 DAY)),
  (24, 'Lý Thu Hương', 'thuhuong.ly@gmail.com', '$2a$10$0pvvqR74Znq9SuBZ0HkOju0Dlar/LZIhcL6fxa7GzUxlBL37liBwG', '0912000011', 'customer', NULL, 1, DATE_SUB(NOW(), INTERVAL 20 DAY)),
  (25, 'Ngô Phương Thảo', 'phuongthao.ngo@gmail.com', '$2a$10$0pvvqR74Znq9SuBZ0HkOju0Dlar/LZIhcL6fxa7GzUxlBL37liBwG', '0912000012', 'customer', NULL, 1, DATE_SUB(NOW(), INTERVAL 18 DAY)),
  (26, 'Dương Thanh Trúc', 'thanhtruc.duong@gmail.com', '$2a$10$0pvvqR74Znq9SuBZ0HkOju0Dlar/LZIhcL6fxa7GzUxlBL37liBwG', '0912000013', 'customer', NULL, 1, DATE_SUB(NOW(), INTERVAL 15 DAY)),
  (27, 'Tô Mỹ Duyên', 'myduyen.to@gmail.com', '$2a$10$0pvvqR74Znq9SuBZ0HkOju0Dlar/LZIhcL6fxa7GzUxlBL37liBwG', '0912000014', 'customer', NULL, 1, DATE_SUB(NOW(), INTERVAL 10 DAY)),
  (28, 'Cao Bích Ngọc', 'bichngoc.cao@gmail.com', '$2a$10$0pvvqR74Znq9SuBZ0HkOju0Dlar/LZIhcL6fxa7GzUxlBL37liBwG', '0912000015', 'customer', NULL, 1, DATE_SUB(NOW(), INTERVAL 5 DAY));

INSERT INTO service_category (id, category_name)
VALUES
  (1, 'Tóc'),
  (2, 'Gội/Massage'),
  (3, 'Nail/Móng'),
  (4, 'Mi/Mày'),
  (5, 'Da mặt'),
  (6, 'Khác');

-- =================================================================
-- PHÂN KHÚC TIÊU CHUẨN (Standard) — Dịch vụ Quốc dân / Cơ bản
-- =================================================================
INSERT INTO services (id, name, price, duration, description, category, image_url, status)
VALUES
  (1,  'Cắt tóc dáng thiết kế', 140000, 45, 'Tư vấn kiểu dáng phù hợp khuôn mặt, cắt tạo kiểu xu hướng mới nhất.', 'Tóc', 'https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=1200&q=80', 'active'),
  (2,  'Nhuộm phủ bạc thảo dược', 320000, 90, 'Nhuộm phủ bạc bằng thảo dược thiên nhiên, an toàn cho da đầu nhạy cảm.', 'Tóc', 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=1200&q=80', 'active'),
  (3,  'Gội đầu dưỡng sinh thuần chay', 100000, 30, 'Gội đầu bằng dầu gội thuần chay 100% thiên nhiên kết hợp massage thư giãn.', 'Gội/Massage', 'https://images.unsplash.com/photo-1522337660859-02fbefca4702?auto=format&fit=crop&w=1200&q=80', 'active'),
  (4,  'Massage cổ vai gáy trị liệu', 150000, 45, 'Massage trị liệu vùng cổ vai gáy, đánh tan mệt mỏi và căng cơ hiệu quả.', 'Gội/Massage', 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?auto=format&fit=crop&w=1200&q=80', 'active'),
  (5,  'Nhặt da + Sửa dáng móng (Combo Tay/Chân)', 75000, 30, 'Combo chăm sóc móng tay chân: nhặt da thừa và sửa dáng móng gọn gàng.', 'Nail/Móng', 'https://images.unsplash.com/photo-1604654894610-df63bc536371?auto=format&fit=crop&w=1200&q=80', 'active'),
  (6,  'Sơn gel bền màu Hàn/Nhật', 125000, 45, 'Sơn gel công nghệ Hàn/Nhật bền đẹp chuẩn màu, giữ nét từ 3-4 tuần.', 'Nail/Móng', 'https://images.unsplash.com/photo-1607779097040-26e80aa78e66?auto=format&fit=crop&w=1200&q=80', 'active'),
  (7,  'Chà gót chân hồng, tẩy tế bào chết', 110000, 30, 'Tẩy tế bào chết và chà gót chân, mang lại đôi chân hồng mịn màng.', 'Nail/Móng', 'https://images.unsplash.com/photo-1519014816548-bf5fe059798b?auto=format&fit=crop&w=1200&q=80', 'active'),
  (8,  'Nối mi Classic tự nhiên', 185000, 60, 'Nối mi sợi Classic tự nhiên như thật, nhẹ nhàng và giữ nét lâu dài.', 'Mi/Mày', 'https://images.unsplash.com/photo-1512496015851-a90fb38ba796?auto=format&fit=crop&w=1200&q=80', 'active'),
  (9,  'Uốn mi Collagen + Phủ đen mi', 150000, 45, 'Uốn mi bằng Collagen kết hợp phủ đen, tạo mi cong vút tự nhiên.', 'Mi/Mày', 'https://images.unsplash.com/photo-1583001931096-959e9a1a6223?auto=format&fit=crop&w=1200&q=80', 'active'),
  (10, 'Waxing / Tỉa dáng mày', 65000, 20, 'Waxing và tỉa dáng lông mày gọn gàng, định hình dáng mày chuẩn đẹp.', 'Mi/Mày', 'https://images.unsplash.com/photo-1616394584738-fc6e612e71b9?auto=format&fit=crop&w=1200&q=80', 'active'),
  (11, 'Chăm sóc da mặt cơ bản (Làm sạch + Cấp ẩm)', 200000, 60, 'Làm sạch sâu da mặt kết hợp cấp ẩm chuyên sâu, phục hồi làn da tươi sáng.', 'Da mặt', 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?auto=format&fit=crop&w=1200&q=80', 'active'),
  (12, 'Lấy nhân mụn chuẩn y khoa', 240000, 45, 'Lấy nhân mụn đúng kỹ thuật y khoa, sạch mụn an toàn không để lại sẹo.', 'Da mặt', 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?auto=format&fit=crop&w=1200&q=80', 'active'),
  (13, 'Waxing lông tay/chân bằng sáp mật ong', 140000, 30, 'Waxing lông tay chân bằng sáp mật ong thiên nhiên, dịu nhẹ cho làn da.', 'Khác', 'https://images.unsplash.com/photo-1515377905703-c4788e51af15?auto=format&fit=crop&w=1200&q=80', 'active'),

-- =================================================================
-- PHÂN KHÚC CAO CẤP (Premium) — Dịch vụ Chuyên sâu
-- =================================================================
  (14, 'Uốn sóng lơi Hàn Quốc / Uốn cụp layer', 900000, 120, 'Uốn sóng lơi phong cách Hàn Quốc hoặc uốn cụp layer, giữ nếp bền lâu.', 'Tóc', 'https://images.unsplash.com/photo-1519699047748-de8e457a634e?auto=format&fit=crop&w=1200&q=80', 'active'),
  (15, 'Duỗi tóc tơ lụa tự nhiên', 900000, 120, 'Duỗi tóc công nghệ tơ lụa, mang lại mái tóc bóng mượt như lụa tự nhiên.', 'Tóc', 'https://images.unsplash.com/photo-1527799820374-dcf8d9d4a388?auto=format&fit=crop&w=1200&q=80', 'active'),
  (16, 'Hấp dầu phục hồi Collagen thủy phân', 400000, 60, 'Hấp dầu Collagen thủy phân phục hồi chuyên sâu cho tóc hư tổn, khô xơ.', 'Tóc', 'https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?auto=format&fit=crop&w=1200&q=80', 'active'),
  (17, 'Gội dưỡng sinh Trung Hoa đả thông kinh lạc', 200000, 45, 'Gội dưỡng sinh theo phương pháp Trung Hoa, đả thông kinh lạc, thư giãn toàn thân.', 'Gội/Massage', 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=1200&q=80', 'active'),
  (18, 'Massage body đá nóng Himalaya', 325000, 75, 'Massage toàn thân bằng đá nóng Himalaya, thư giãn chuyên sâu và giải tỏa stress.', 'Gội/Massage', 'https://images.unsplash.com/photo-1600334089648-b0d9d3028eb2?auto=format&fit=crop&w=1200&q=80', 'active'),
  (19, 'Sơn gel mắt mèo kim cương / Sơn thạch', 215000, 45, 'Sơn gel hiệu ứng mắt mèo kim cương hoặc sơn thạch, hot trend thời thượng.', 'Nail/Móng', 'https://images.unsplash.com/photo-1604654894610-df63bc536371?auto=format&fit=crop&w=1200&q=80', 'active'),
  (20, 'Nối móng úp cao cấp (Soft gel tips)', 325000, 60, 'Nối móng úp bằng Soft gel tips cao cấp, tạo form chuẩn đẹp bền vững.', 'Nail/Móng', 'https://images.unsplash.com/photo-1632345031435-8727f6897d53?auto=format&fit=crop&w=1200&q=80', 'active'),
  (21, 'Nail Art vẽ tay thiết kế', 325000, 60, 'Vẽ nail art thiết kế theo yêu cầu, nghệ thuật sáng tạo trên từng đầu ngón.', 'Nail/Móng', 'https://images.unsplash.com/photo-1604654894610-df63bc536371?auto=format&fit=crop&w=1200&q=80', 'active'),
  (22, 'Nối mi Volume quyến rũ / Mi Katun', 300000, 75, 'Nối mi Volume hoặc mi Katun dày đẹp cuốn hút, phù hợp mọi phong cách.', 'Mi/Mày', 'https://images.unsplash.com/photo-1512496015851-a90fb38ba796?auto=format&fit=crop&w=1200&q=80', 'active'),
  (23, 'Uốn định hình lông mày', 250000, 45, 'Uốn và định hình lông mày theo dáng Tây hiện đại, giữ nếp tự nhiên.', 'Mi/Mày', 'https://images.unsplash.com/photo-1616394584738-fc6e612e71b9?auto=format&fit=crop&w=1200&q=80', 'active'),
  (24, 'Cấy tảo xoắn / Cấy hồng sâm sáng da', 425000, 75, 'Cấy dưỡng chất tảo xoắn hoặc hồng sâm, làm sáng da từ sâu bên trong.', 'Da mặt', 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?auto=format&fit=crop&w=1200&q=80', 'active'),
  (25, 'Điện di Vitamin C trắng sáng, mờ thâm', 375000, 60, 'Điện di Vitamin C giúp trắng sáng da, mờ thâm nám hiệu quả sau liệu trình.', 'Da mặt', 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?auto=format&fit=crop&w=1200&q=80', 'active'),
  (26, 'Triệt lông vĩnh viễn công nghệ Diode Laser', 325000, 30, 'Triệt lông vĩnh viễn bằng công nghệ Diode Laser, triệt sạch sâu và sáng da.', 'Khác', 'https://images.unsplash.com/photo-1612817159949-195b6eb9e31a?auto=format&fit=crop&w=1200&q=80', 'active'),

-- =================================================================
-- PHÂN KHÚC SANG TRỌNG (Luxury) — Thượng hạng / Nghệ nhân
-- =================================================================
  (27, 'Nhuộm thời trang đỉnh cao (Balayage/Ombre)', 2500000, 180, 'Nhuộm Balayage hoặc Ombre đỉnh cao do nghệ nhân thực hiện, hiệu ứng thượng hạng.', 'Tóc', 'https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?auto=format&fit=crop&w=1200&q=80', 'active'),
  (28, 'Phục hồi tóc nát/hư tổn nặng chuyên sâu', 1400000, 120, 'Hồi sinh tóc nát và hư tổn nặng bằng liệu trình chuyên sâu phục hồi tức thì.', 'Tóc', 'https://images.unsplash.com/photo-1580618672591-eb180b1a973f?auto=format&fit=crop&w=1200&q=80', 'active'),
  (29, 'Combo VIP: Gội dưỡng sinh + Massage mặt + Đắp mặt nạ nghệ sĩ', 500000, 90, 'Combo thư giãn hoàng gia: gội dưỡng sinh, massage mặt và đắp mặt nạ nghệ sĩ.', 'Gội/Massage', 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=1200&q=80', 'active'),
  (30, 'Ẩn xà cừ, đính đá khối Swarovski thời thượng', 850000, 90, 'Ẩn xà cừ và đính đá khối Swarovski thời thượng, mang đẳng cấp sang chảnh.', 'Nail/Móng', 'https://images.unsplash.com/photo-1632345031435-8727f6897d53?auto=format&fit=crop&w=1200&q=80', 'active'),
  (31, 'Ủ paraffin hoàng gia mềm mịn da tay/chân', 375000, 45, 'Ủ nến paraffin hoàng gia giúp mềm mịn da tay chân, cảm giác spa đẳng cấp.', 'Nail/Móng', 'https://images.unsplash.com/photo-1519014816548-bf5fe059798b?auto=format&fit=crop&w=1200&q=80', 'active'),
  (32, 'Thêu mày Hairstroke sợi siêu thực', 3750000, 120, 'Điêu khắc mày Hairstroke từng sợi siêu thực, do nghệ nhân hàng đầu thực hiện.', 'Mi/Mày', 'https://images.unsplash.com/photo-1616394584738-fc6e612e71b9?auto=format&fit=crop&w=1200&q=80', 'active'),
  (33, 'Điêu khắc lông mày tự nhiên', 3000000, 120, 'Nghệ nhân khắc từng sợi lông mày tự nhiên, tạo dáng mày hoàn hảo cá nhân hóa.', 'Mi/Mày', 'https://images.unsplash.com/photo-1616394584738-fc6e612e71b9?auto=format&fit=crop&w=1200&q=80', 'active'),
  (34, 'Phun mày chạm hạt Ombre', 2650000, 90, 'Phun mày chạm hạt Ombre độc quyền, mang lại dáng mày tự nhiên sang trọng.', 'Mi/Mày', 'https://images.unsplash.com/photo-1583001931096-959e9a1a6223?auto=format&fit=crop&w=1200&q=80', 'active'),
  (35, 'Bắn laser carbon trẻ hóa da', 900000, 60, 'Bắn laser carbon công nghệ cao giúp trẻ hóa da, se khít lỗ chân lông hiệu quả.', 'Da mặt', 'https://images.unsplash.com/photo-1612817159949-195b6eb9e31a?auto=format&fit=crop&w=1200&q=80', 'active');

INSERT INTO vouchers (
  id,
  code,
  voucher_type,
  discount_amount,
  discount_percent,
  min_order_value,
  max_discount_amount,
  customer_type,
  description,
  expiry_date,
  max_usage_global,
  status,
  created_by
)
VALUES
  (1, 'WELCOME15', 'percentage', 0, 15, 300000, 120000, 'both', 'Voucher chào mừng khách hàng dùng cho lần đặt lịch tiếp theo.', DATE_ADD(NOW(), INTERVAL 30 DAY), 200, 'active', 1),
  (2, 'VIP120K', 'fixed', 120000, NULL, 700000, NULL, 'vip', 'Ưu đãi dành cho khách VIP có tổng chi tiêu cao.', DATE_ADD(NOW(), INTERVAL 45 DAY), 100, 'active', 1);

INSERT INTO voucher_assignments (voucher_id, user_id, max_usage_customer)
VALUES
  (1, 4, 1);

INSERT INTO staff_weekly_availability (staff_id, day_of_week, start_time, end_time)
VALUES
  -- Nhân Viên (id=3): Ca sáng T2-T6, sáng T7-CN
  (3, 0, '08:00:00', '16:00:00'), (3, 1, '08:00:00', '16:00:00'),
  (3, 2, '08:00:00', '16:00:00'), (3, 3, '08:00:00', '16:00:00'),
  (3, 4, '08:00:00', '16:00:00'), (3, 5, '07:00:00', '15:00:00'),
  (3, 6, '07:00:00', '15:00:00'),
  -- Ngọc Trinh (id=9): Ca sáng
  (9, 0, '08:00:00', '16:00:00'), (9, 1, '08:00:00', '16:00:00'),
  (9, 2, '08:00:00', '16:00:00'), (9, 3, '08:00:00', '16:00:00'),
  (9, 4, '08:00:00', '16:00:00'), (9, 5, '08:00:00', '15:00:00'),
  (9, 6, '08:00:00', '15:00:00'),
  -- Thùy Linh (id=10): Ca chiều T2-T6
  (10, 0, '12:00:00', '21:00:00'), (10, 1, '12:00:00', '21:00:00'),
  (10, 2, '12:00:00', '21:00:00'), (10, 3, '12:00:00', '21:00:00'),
  (10, 4, '12:00:00', '21:00:00'), (10, 5, '09:00:00', '17:00:00'),
  (10, 6, '09:00:00', '17:00:00'),
  -- Bảo Ngọc (id=11): Ca sáng
  (11, 0, '08:00:00', '16:00:00'), (11, 1, '08:00:00', '16:00:00'),
  (11, 2, '08:00:00', '16:00:00'), (11, 3, '08:00:00', '16:00:00'),
  (11, 4, '08:00:00', '16:00:00'), (11, 5, '07:00:00', '15:00:00'),
  (11, 6, '07:00:00', '15:00:00'),
  -- Phương Anh (id=12): Ca chiều
  (12, 0, '13:00:00', '21:30:00'), (12, 1, '13:00:00', '21:30:00'),
  (12, 2, '13:00:00', '21:30:00'), (12, 3, '13:00:00', '21:30:00'),
  (12, 4, '13:00:00', '21:30:00'), (12, 5, '10:00:00', '18:00:00'),
  (12, 6, '10:00:00', '18:00:00'),
  -- Khánh Vy (id=13): Ca xoay
  (13, 0, '09:00:00', '17:00:00'), (13, 1, '09:00:00', '17:00:00'),
  (13, 2, '12:00:00', '20:00:00'), (13, 3, '09:00:00', '17:00:00'),
  (13, 4, '12:00:00', '20:00:00'), (13, 5, '08:00:00', '16:00:00'),
  (13, 6, '08:00:00', '16:00:00');

INSERT INTO chat_suggestions (category, title, description, icon, action_type, action_data, priority)
VALUES
  ('service', 'Cắt tóc tạo kiểu', 'Xem các dịch vụ tóc đang hoạt động.', 'scissors', 'service', JSON_OBJECT('service_id', 2), 10),
  ('booking', 'Đặt lịch nhanh', 'Chọn dịch vụ, ngày giờ và nhân viên phù hợp.', 'calendar', 'booking', JSON_OBJECT('action', 'quick_booking'), 9),
  ('faq', 'Giờ làm việc', 'Xem thông tin giờ mở cửa của salon.', 'clock', 'faq', JSON_OBJECT('faq_id', 1), 8);

INSERT INTO chat_faq (question, answer, category, keywords)
VALUES
  ('Salon mở cửa lúc mấy giờ?', 'Thứ 2 đến Thứ 6: 08:00-21:30. Thứ 7 và Chủ nhật: 07:00-23:00. Ca làm được chia sáng/tối theo lịch nhân viên.', 'Giờ làm việc', 'giờ mở cửa, thời gian, lịch làm việc'),
  ('Tôi có thể đặt lịch online không?', 'Bạn có thể đăng nhập tài khoản khách hàng, chọn dịch vụ, ngày giờ và nhân viên còn trống để đặt lịch.', 'Đặt lịch', 'đặt lịch, online, booking'),
  ('Salon hỗ trợ thanh toán thế nào?', 'Salon hỗ trợ thanh toán tiền mặt, chuyển khoản, VNPay và VietQR tuỳ cấu hình hệ thống.', 'Thanh toán', 'thanh toán, tiền mặt, vnpay, vietqr');

INSERT INTO chat_bot_responses (trigger_keyword, response_text, response_type, confidence_score)
VALUES
  ('xin chào|hello|hi', 'Xin chào! Mình có thể hỗ trợ bạn xem dịch vụ, đặt lịch hoặc kiểm tra thông tin thanh toán.', 'text', 0.95),
  ('giờ làm việc|mở cửa|đóng cửa', 'Salon mở cửa Thứ 2-Thứ 6 từ 08:00-21:30, Thứ 7-Chủ nhật từ 07:00-23:00. Bạn muốn đặt lịch khung giờ nào?', 'suggestion', 0.90),
  ('đặt lịch|booking|hẹn', 'Bạn hãy chọn dịch vụ trước, sau đó hệ thống sẽ gợi ý nhân viên còn trống.', 'suggestion', 0.90);

-- ===== APPOINTMENT SEED DATA (trải đều 3 phân khúc cho K-Means) =====
INSERT INTO appointments (user_id, service_id, staff_id, appointment_date, appointment_time, end_time, status, total_amount, staff_rating, created_at)
VALUES
  -- STANDARD: Cắt tóc dáng thiết kế (id=1, 140k, 45min)
  (4, 1, 3, DATE_SUB(CURDATE(), INTERVAL 3 DAY),  '09:00:00', '09:45:00', 'completed', 140000, 5, DATE_SUB(NOW(), INTERVAL 3 DAY)),
  (4, 1, 3, DATE_SUB(CURDATE(), INTERVAL 9 DAY),  '14:00:00', '14:45:00', 'completed', 140000, 5, DATE_SUB(NOW(), INTERVAL 9 DAY)),
  (4, 1, 3, DATE_SUB(CURDATE(), INTERVAL 18 DAY), '09:00:00', '09:45:00', 'completed', 140000, 4, DATE_SUB(NOW(), INTERVAL 18 DAY)),
  (4, 1, 3, DATE_SUB(CURDATE(), INTERVAL 25 DAY), '10:00:00', '10:45:00', 'completed', 140000, 5, DATE_SUB(NOW(), INTERVAL 25 DAY)),
  (4, 1, 3, DATE_SUB(CURDATE(), INTERVAL 1 DAY),  '09:00:00', '09:45:00', 'confirmed', 140000, NULL, DATE_SUB(NOW(), INTERVAL 1 DAY)),

  -- STANDARD: Gội đầu dưỡng sinh (id=3, 100k, 30min)
  (4, 3, 3, DATE_SUB(CURDATE(), INTERVAL 6 DAY),  '09:00:00', '09:30:00', 'completed', 100000, 5, DATE_SUB(NOW(), INTERVAL 6 DAY)),
  (4, 3, 3, DATE_SUB(CURDATE(), INTERVAL 15 DAY), '14:00:00', '14:30:00', 'completed', 100000, 4, DATE_SUB(NOW(), INTERVAL 15 DAY)),
  (4, 3, 3, DATE_SUB(CURDATE(), INTERVAL 22 DAY), '09:00:00', '09:30:00', 'completed', 100000, 5, DATE_SUB(NOW(), INTERVAL 22 DAY)),

  -- STANDARD: Sơn gel bền màu (id=6, 125k, 45min)
  (4, 6, 3, DATE_SUB(CURDATE(), INTERVAL 5 DAY),  '14:00:00', '14:45:00', 'completed', 125000, 5, DATE_SUB(NOW(), INTERVAL 5 DAY)),
  (4, 6, 3, DATE_SUB(CURDATE(), INTERVAL 12 DAY), '10:00:00', '10:45:00', 'completed', 125000, 5, DATE_SUB(NOW(), INTERVAL 12 DAY)),
  (4, 6, 3, DATE_SUB(CURDATE(), INTERVAL 20 DAY), '14:00:00', '14:45:00', 'completed', 125000, 4, DATE_SUB(NOW(), INTERVAL 20 DAY)),
  (4, 6, 3, DATE_SUB(CURDATE(), INTERVAL 2 DAY),  '10:00:00', '10:45:00', 'pending',   125000, NULL, DATE_SUB(NOW(), INTERVAL 2 DAY)),

  -- STANDARD: Nối mi Classic (id=8, 185k, 60min)
  (4, 8, 3, DATE_SUB(CURDATE(), INTERVAL 4 DAY),  '10:00:00', '11:00:00', 'completed', 185000, 5, DATE_SUB(NOW(), INTERVAL 4 DAY)),
  (4, 8, 3, DATE_SUB(CURDATE(), INTERVAL 11 DAY), '09:00:00', '10:00:00', 'completed', 185000, 4, DATE_SUB(NOW(), INTERVAL 11 DAY)),
  (4, 8, 3, DATE_SUB(CURDATE(), INTERVAL 19 DAY), '14:00:00', '15:00:00', 'completed', 185000, 5, DATE_SUB(NOW(), INTERVAL 19 DAY)),

  -- STANDARD: Chăm sóc da mặt cơ bản (id=11, 200k, 60min)
  (4, 11, 3, DATE_SUB(CURDATE(), INTERVAL 7 DAY),  '10:00:00', '11:00:00', 'completed', 200000, 5, DATE_SUB(NOW(), INTERVAL 7 DAY)),
  (4, 11, 3, DATE_SUB(CURDATE(), INTERVAL 16 DAY), '14:00:00', '15:00:00', 'completed', 200000, 5, DATE_SUB(NOW(), INTERVAL 16 DAY)),
  (4, 11, 3, DATE_SUB(CURDATE(), INTERVAL 24 DAY), '09:00:00', '10:00:00', 'completed', 200000, 4, DATE_SUB(NOW(), INTERVAL 24 DAY)),

  -- STANDARD: Massage cổ vai gáy (id=4, 150k, 45min)
  (4, 4, 3, DATE_SUB(CURDATE(), INTERVAL 8 DAY),  '14:00:00', '14:45:00', 'completed', 150000, 5, DATE_SUB(NOW(), INTERVAL 8 DAY)),
  (4, 4, 3, DATE_SUB(CURDATE(), INTERVAL 21 DAY), '10:00:00', '10:45:00', 'completed', 150000, 5, DATE_SUB(NOW(), INTERVAL 21 DAY)),

  -- PREMIUM: Uốn sóng lơi Hàn Quốc (id=14, 900k, 120min)
  (4, 14, 3, DATE_SUB(CURDATE(), INTERVAL 10 DAY), '09:00:00', '11:00:00', 'completed', 900000, 5, DATE_SUB(NOW(), INTERVAL 10 DAY)),
  (4, 14, 3, DATE_SUB(CURDATE(), INTERVAL 26 DAY), '09:00:00', '11:00:00', 'completed', 900000, 5, DATE_SUB(NOW(), INTERVAL 26 DAY)),

  -- PREMIUM: Hấp dầu Collagen (id=16, 400k, 60min)
  (4, 16, 3, DATE_SUB(CURDATE(), INTERVAL 5 DAY),  '10:00:00', '11:00:00', 'completed', 400000, 5, DATE_SUB(NOW(), INTERVAL 5 DAY)),
  (4, 16, 3, DATE_SUB(CURDATE(), INTERVAL 17 DAY), '09:00:00', '10:00:00', 'completed', 400000, 4, DATE_SUB(NOW(), INTERVAL 17 DAY)),

  -- PREMIUM: Massage body đá nóng (id=18, 325k, 75min)
  (4, 18, 3, DATE_SUB(CURDATE(), INTERVAL 8 DAY),  '09:00:00', '10:15:00', 'completed', 325000, 5, DATE_SUB(NOW(), INTERVAL 8 DAY)),
  (4, 18, 3, DATE_SUB(CURDATE(), INTERVAL 23 DAY), '13:00:00', '14:15:00', 'completed', 325000, 5, DATE_SUB(NOW(), INTERVAL 23 DAY)),

  -- PREMIUM: Cấy tảo xoắn (id=24, 425k, 75min)
  (4, 24, 3, DATE_SUB(CURDATE(), INTERVAL 13 DAY), '09:00:00', '10:15:00', 'completed', 425000, 5, DATE_SUB(NOW(), INTERVAL 13 DAY)),
  (4, 24, 3, DATE_SUB(CURDATE(), INTERVAL 3 DAY),  '13:00:00', '14:15:00', 'confirmed', 425000, NULL, DATE_SUB(NOW(), INTERVAL 3 DAY)),

  -- PREMIUM: Nối mi Volume (id=22, 300k, 75min)
  (4, 22, 3, DATE_SUB(CURDATE(), INTERVAL 14 DAY), '13:00:00', '14:15:00', 'completed', 300000, 5, DATE_SUB(NOW(), INTERVAL 14 DAY)),

  -- PREMIUM: Điện di Vitamin C (id=25, 375k, 60min)
  (4, 25, 3, DATE_SUB(CURDATE(), INTERVAL 7 DAY),  '14:00:00', '15:00:00', 'completed', 375000, 5, DATE_SUB(NOW(), INTERVAL 7 DAY)),

  -- LUXURY: Nhuộm Balayage (id=27, 2.5tr, 180min)
  (4, 27, 3, DATE_SUB(CURDATE(), INTERVAL 20 DAY), '09:00:00', '12:00:00', 'completed', 2500000, 5, DATE_SUB(NOW(), INTERVAL 20 DAY)),

  -- LUXURY: Phục hồi tóc nát (id=28, 1.4tr, 120min)
  (4, 28, 3, DATE_SUB(CURDATE(), INTERVAL 15 DAY), '09:00:00', '11:00:00', 'completed', 1400000, 5, DATE_SUB(NOW(), INTERVAL 15 DAY)),

  -- LUXURY: Combo VIP (id=29, 500k, 90min)
  (4, 29, 3, DATE_SUB(CURDATE(), INTERVAL 12 DAY), '13:00:00', '14:30:00', 'completed', 500000, 5, DATE_SUB(NOW(), INTERVAL 12 DAY)),
  (4, 29, 3, DATE_SUB(CURDATE(), INTERVAL 2 DAY),  '14:00:00', '15:30:00', 'pending',   500000, NULL, DATE_SUB(NOW(), INTERVAL 2 DAY)),

  -- LUXURY: Bắn laser carbon (id=35, 900k, 60min)
  (4, 35, 3, DATE_SUB(CURDATE(), INTERVAL 9 DAY),  '10:00:00', '11:00:00', 'completed', 900000, 5, DATE_SUB(NOW(), INTERVAL 9 DAY)),

  -- LUXURY: Thêu mày Hairstroke (id=32, 3.75tr, 120min)
  (4, 32, 3, DATE_SUB(CURDATE(), INTERVAL 28 DAY), '09:00:00', '11:00:00', 'completed', 3750000, 5, DATE_SUB(NOW(), INTERVAL 28 DAY)),

  -- Lịch hủy (cung cấp cancel_rate cho K-Means)
  (4, 1,  3, DATE_SUB(CURDATE(), INTERVAL 27 DAY), '14:00:00', '14:45:00', 'cancelled', 140000,  NULL, DATE_SUB(NOW(), INTERVAL 27 DAY)),
  (4, 11, 3, DATE_SUB(CURDATE(), INTERVAL 23 DAY), '09:00:00', '10:00:00', 'cancelled', 200000,  NULL, DATE_SUB(NOW(), INTERVAL 23 DAY)),

  -- === DỮ LIỆU ĐẶT LỊCH HẸN CHO KHÁCH HÀNG MỚI (IDs 14-28) ===
  -- Champions (VIP): user_id 14, 15, 16
  -- User 14: Chi tiêu cực cao, tần suất cao, đặt dịch vụ VIP/Premium gần đây
  (14, 27, 9, DATE_SUB(CURDATE(), INTERVAL 2 DAY), '09:00:00', '12:00:00', 'completed', 2500000, 5, DATE_SUB(NOW(), INTERVAL 2 DAY)),
  (14, 28, 9, DATE_SUB(CURDATE(), INTERVAL 12 DAY), '10:00:00', '12:00:00', 'completed', 1400000, 5, DATE_SUB(NOW(), INTERVAL 12 DAY)),
  (14, 29, 9, DATE_SUB(CURDATE(), INTERVAL 22 DAY), '13:00:00', '14:30:00', 'completed', 500000, 5, DATE_SUB(NOW(), INTERVAL 22 DAY)),
  (14, 30, 9, DATE_SUB(CURDATE(), INTERVAL 32 DAY), '14:00:00', '15:30:00', 'completed', 850000, 5, DATE_SUB(NOW(), INTERVAL 32 DAY)),
  (14, 14, 9, DATE_SUB(CURDATE(), INTERVAL 42 DAY), '09:00:00', '11:00:00', 'completed', 900000, 5, DATE_SUB(NOW(), INTERVAL 42 DAY)),
  -- User 15: Chi tiêu cao, tần suất cao, ít hủy
  (15, 17, 10, DATE_SUB(CURDATE(), INTERVAL 3 DAY), '10:00:00', '10:45:00', 'completed', 200000, 5, DATE_SUB(NOW(), INTERVAL 3 DAY)),
  (15, 18, 10, DATE_SUB(CURDATE(), INTERVAL 10 DAY), '14:00:00', '15:15:00', 'completed', 325000, 5, DATE_SUB(NOW(), INTERVAL 10 DAY)),
  (15, 20, 10, DATE_SUB(CURDATE(), INTERVAL 17 DAY), '09:00:00', '10:00:00', 'completed', 325000, 4, DATE_SUB(NOW(), INTERVAL 17 DAY)),
  (15, 24, 10, DATE_SUB(CURDATE(), INTERVAL 24 DAY), '13:00:00', '14:15:00', 'completed', 425000, 5, DATE_SUB(NOW(), INTERVAL 24 DAY)),
  (15, 25, 10, DATE_SUB(CURDATE(), INTERVAL 31 DAY), '10:00:00', '11:00:00', 'completed', 375000, 5, DATE_SUB(NOW(), INTERVAL 31 DAY)),
  -- User 16: Chi tiêu tốt, chăm sóc sắc đẹp định kỳ
  (16, 21, 11, DATE_SUB(CURDATE(), INTERVAL 4 DAY), '09:00:00', '10:00:00', 'completed', 325000, 5, DATE_SUB(NOW(), INTERVAL 4 DAY)),
  (16, 22, 11, DATE_SUB(CURDATE(), INTERVAL 11 DAY), '13:00:00', '14:15:00', 'completed', 300000, 5, DATE_SUB(NOW(), INTERVAL 11 DAY)),
  (16, 26, 11, DATE_SUB(CURDATE(), INTERVAL 18 DAY), '15:00:00', '15:30:00', 'completed', 325000, 5, DATE_SUB(NOW(), INTERVAL 18 DAY)),
  (16, 35, 11, DATE_SUB(CURDATE(), INTERVAL 25 DAY), '10:00:00', '11:00:00', 'completed', 900000, 5, DATE_SUB(NOW(), INTERVAL 25 DAY)),

  -- Loyal Customers: user_id 17, 18, 19
  -- User 17: Đặt lịch đều đặn dịch vụ tiêu chuẩn
  (17, 1, 12, DATE_SUB(CURDATE(), INTERVAL 8 DAY), '09:00:00', '09:45:00', 'completed', 140000, 5, DATE_SUB(NOW(), INTERVAL 8 DAY)),
  (17, 3, 12, DATE_SUB(CURDATE(), INTERVAL 16 DAY), '14:00:00', '14:30:00', 'completed', 100000, 5, DATE_SUB(NOW(), INTERVAL 16 DAY)),
  (17, 4, 12, DATE_SUB(CURDATE(), INTERVAL 24 DAY), '10:00:00', '10:45:00', 'completed', 150000, 4, DATE_SUB(NOW(), INTERVAL 24 DAY)),
  -- User 18: Đặt các dịch vụ làm móng và mi tầm trung
  (18, 6, 13, DATE_SUB(CURDATE(), INTERVAL 10 DAY), '11:00:00', '11:45:00', 'completed', 125000, 5, DATE_SUB(NOW(), INTERVAL 10 DAY)),
  (18, 8, 13, DATE_SUB(CURDATE(), INTERVAL 20 DAY), '09:00:00', '10:00:00', 'completed', 185000, 5, DATE_SUB(NOW(), INTERVAL 20 DAY)),
  (18, 9, 13, DATE_SUB(CURDATE(), INTERVAL 30 DAY), '14:00:00', '14:45:00', 'completed', 150000, 4, DATE_SUB(NOW(), INTERVAL 30 DAY)),
  -- User 19: Dịch vụ chăm sóc tóc và da mặt
  (19, 11, 3, DATE_SUB(CURDATE(), INTERVAL 12 DAY), '09:00:00', '10:00:00', 'completed', 200000, 5, DATE_SUB(NOW(), INTERVAL 12 DAY)),
  (19, 12, 3, DATE_SUB(CURDATE(), INTERVAL 25 DAY), '15:00:00', '15:45:00', 'completed', 240000, 5, DATE_SUB(NOW(), INTERVAL 25 DAY)),

  -- Potential Loyalists: user_id 20, 21, 22
  -- User 20: Mới bắt đầu sử dụng dịch vụ giá trị cao
  (20, 14, 9, DATE_SUB(CURDATE(), INTERVAL 5 DAY), '09:00:00', '11:00:00', 'completed', 900000, 5, DATE_SUB(NOW(), INTERVAL 5 DAY)),
  (20, 16, 9, DATE_SUB(CURDATE(), INTERVAL 15 DAY), '14:00:00', '15:00:00', 'completed', 400000, 5, DATE_SUB(NOW(), INTERVAL 15 DAY)),
  -- User 21: Mới đến gần đây, trải nghiệm dịch vụ massage body
  (21, 18, 10, DATE_SUB(CURDATE(), INTERVAL 6 DAY), '10:00:00', '11:15:00', 'completed', 325000, 5, DATE_SUB(NOW(), INTERVAL 6 DAY)),
  -- User 22: Mới cắt tóc và nhuộm
  (22, 2, 11, DATE_SUB(CURDATE(), INTERVAL 7 DAY), '13:00:00', '14:30:00', 'completed', 320000, 4, DATE_SUB(NOW(), INTERVAL 7 DAY)),

  -- Need Attention: user_id 23, 24, 25
  -- User 23: Từng chi tiêu rất lớn nhưng gần đây không đặt (35+ ngày)
  (23, 27, 12, DATE_SUB(CURDATE(), INTERVAL 35 DAY), '09:00:00', '12:00:00', 'completed', 2500000, 5, DATE_SUB(NOW(), INTERVAL 35 DAY)),
  (23, 29, 12, DATE_SUB(CURDATE(), INTERVAL 50 DAY), '14:00:00', '15:30:00', 'completed', 500000, 5, DATE_SUB(NOW(), INTERVAL 50 DAY)),
  -- User 24: Không ghé tiệm hơn 40 ngày
  (24, 14, 13, DATE_SUB(CURDATE(), INTERVAL 40 DAY), '10:00:00', '12:00:00', 'completed', 900000, 4, DATE_SUB(NOW(), INTERVAL 40 DAY)),
  -- User 25: Không ghé tiệm hơn 45 ngày
  (25, 20, 3, DATE_SUB(CURDATE(), INTERVAL 45 DAY), '13:00:00', '14:00:00', 'completed', 325000, 5, DATE_SUB(NOW(), INTERVAL 45 DAY)),

  -- At Risk: user_id 26, 27, 28
  -- User 26: Ghé thăm 1 lần rất lâu trước đây (65+ ngày)
  (26, 3, 9, DATE_SUB(CURDATE(), INTERVAL 65 DAY), '09:00:00', '09:30:00', 'completed', 100000, 4, DATE_SUB(NOW(), INTERVAL 65 DAY)),
  -- User 27: Hủy lịch liên tục (Cancel rate cao)
  (27, 4, 10, DATE_SUB(CURDATE(), INTERVAL 15 DAY), '14:00:00', '14:45:00', 'cancelled', 150000, NULL, DATE_SUB(NOW(), INTERVAL 15 DAY)),
  (27, 4, 10, DATE_SUB(CURDATE(), INTERVAL 22 DAY), '10:00:00', '10:45:00', 'cancelled', 150000, NULL, DATE_SUB(NOW(), INTERVAL 22 DAY)),
  (27, 3, 10, DATE_SUB(CURDATE(), INTERVAL 30 DAY), '09:00:00', '09:30:00', 'completed', 100000, 4, DATE_SUB(NOW(), INTERVAL 30 DAY)),
  -- User 28: Chỉ có 1 lần đặt lịch từ 80 ngày trước
  (28, 1, 11, DATE_SUB(CURDATE(), INTERVAL 80 DAY), '10:00:00', '10:45:00', 'completed', 140000, 3, DATE_SUB(NOW(), INTERVAL 80 DAY));
