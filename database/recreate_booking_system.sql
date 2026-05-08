DROP DATABASE IF EXISTS booking_system;
CREATE DATABASE booking_system
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE booking_system;
SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;

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
  noshow_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_users_staff_role_id (staff_role_id),
  INDEX idx_users_customer_segment (customer_segment),
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
  customer_type ENUM('regular', 'vip', 'both') NOT NULL DEFAULT 'both',
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
  customer_id INT NOT NULL,
  assigned_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  max_usage_customer INT NOT NULL DEFAULT 1,
  usage_count INT NOT NULL DEFAULT 0,
  last_used_date TIMESTAMP NULL,
  is_used TINYINT(1) NOT NULL DEFAULT 0,
  status ENUM('active', 'used', 'expired') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_voucher_customer (voucher_id, customer_id),
  INDEX idx_voucher_assignments_customer (customer_id),
  INDEX idx_voucher_assignments_voucher (voucher_id),
  INDEX idx_voucher_assignments_status (status),
  CONSTRAINT fk_voucher_assignments_voucher
    FOREIGN KEY (voucher_id) REFERENCES vouchers(id) ON DELETE CASCADE,
  CONSTRAINT fk_voucher_assignments_customer
    FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE voucher_usage_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  voucher_id INT NOT NULL,
  assignment_id INT NULL,
  customer_id INT NOT NULL,
  appointment_id INT NULL,
  discount_applied DECIMAL(10,2) NOT NULL,
  used_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_voucher_usage_customer (customer_id),
  INDEX idx_voucher_usage_voucher (voucher_id),
  INDEX idx_voucher_usage_appointment (appointment_id),
  INDEX idx_voucher_usage_used_date (used_date),
  CONSTRAINT fk_voucher_usage_voucher
    FOREIGN KEY (voucher_id) REFERENCES vouchers(id) ON DELETE CASCADE,
  CONSTRAINT fk_voucher_usage_assignment
    FOREIGN KEY (assignment_id) REFERENCES voucher_assignments(id) ON DELETE SET NULL,
  CONSTRAINT fk_voucher_usage_customer
    FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_voucher_usage_appointment
    FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE voucher_suggestions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  customer_id INT NOT NULL,
  voucher_id INT NOT NULL,
  reason VARCHAR(255) NULL,
  confidence_score FLOAT NULL,
  shown_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  clicked TINYINT(1) NOT NULL DEFAULT 0,
  applied TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_voucher_suggestions_customer (customer_id),
  INDEX idx_voucher_suggestions_voucher (voucher_id),
  INDEX idx_voucher_suggestions_shown_date (shown_date),
  INDEX idx_voucher_suggestions_reason (reason),
  CONSTRAINT fk_voucher_suggestions_customer
    FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_voucher_suggestions_voucher
    FOREIGN KEY (voucher_id) REFERENCES vouchers(id) ON DELETE CASCADE
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
  (1, 'Kỹ thuật viên', 'Nhân viên thực hiện dịch vụ cho khách hàng'),
  (2, 'Thu ngân', 'Nhân viên xử lý thanh toán và hỗ trợ quầy'),
  (3, 'Quản lý', 'Nhân viên quản lý vận hành salon');

INSERT INTO users (id, name, email, password, phone, role, staff_role_id, is_active, created_at)
VALUES
  (1, 'Quản trị viên', 'admin@beautybook.com', '$2a$10$0pvvqR74Znq9SuBZ0HkOju0Dlar/LZIhcL6fxa7GzUxlBL37liBwG', '0901000001', 'admin', NULL, 1, NOW()),
  (2, 'Thu Ngân', 'thungan@beautybook.com', '$2a$10$0pvvqR74Znq9SuBZ0HkOju0Dlar/LZIhcL6fxa7GzUxlBL37liBwG', '0901000002', 'staff', 2, 1, NOW()),
  (3, 'Nhân Viên', 'nhanvien@beautybook.com', '$2a$10$0pvvqR74Znq9SuBZ0HkOju0Dlar/LZIhcL6fxa7GzUxlBL37liBwG', '0901000003', 'staff', 1, 1, NOW()),
  (4, 'Khách Hàng', 'khachhang@beautybook.com', '$2a$10$0pvvqR74Znq9SuBZ0HkOju0Dlar/LZIhcL6fxa7GzUxlBL37liBwG', '0901000004', 'customer', NULL, 1, NOW());

INSERT INTO service_category (id, category_name)
VALUES
  (1, 'Tóc'),
  (2, 'Móng'),
  (3, 'Chăm sóc da'),
  (4, 'Massage'),
  (5, 'Mi & Mày'),
  (6, 'Trang điểm');

INSERT INTO services (id, name, price, duration, description, category, image_url, status)
VALUES
  (1, 'Gội tạo kiểu tóc nhanh', 280000, 30, 'Gội, sấy và tạo kiểu nhanh cho lịch hẹn trong ngày.', 'Tóc', 'https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?auto=format&fit=crop&w=1200&q=80', 'active'),
  (2, 'Cắt tóc tạo kiểu cao cấp', 450000, 60, 'Tư vấn dáng tóc, cắt và tạo kiểu theo khuôn mặt.', 'Tóc', 'https://images.unsplash.com/photo-1522337660859-02fbefca4702?auto=format&fit=crop&w=1200&q=80', 'active'),
  (3, 'Nhuộm tóc cao cấp', 950000, 120, 'Nhuộm tóc kèm cân bằng màu và phục hồi nền tóc.', 'Tóc', 'https://images.unsplash.com/photo-1487412912498-0447578fcca8?auto=format&fit=crop&w=1200&q=80', 'active'),
  (4, 'Sơn gel chăm sóc móng', 320000, 45, 'Làm sạch móng, tạo form và sơn gel bền màu.', 'Móng', 'https://images.unsplash.com/photo-1604654894610-df63bc536371?auto=format&fit=crop&w=1200&q=80', 'active'),
  (5, 'Nâng mi và nhuộm mi', 520000, 75, 'Nâng mi tự nhiên, phủ màu nhẹ và giữ nếp lâu.', 'Mi & Mày', 'https://images.unsplash.com/photo-1512496015851-a90fb38ba796?auto=format&fit=crop&w=1200&q=80', 'active'),
  (6, 'Chăm sóc da cấp ẩm chuyên sâu', 680000, 75, 'Làm dịu, cấp ẩm và phục hồi độ căng bóng cho da.', 'Chăm sóc da', 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?auto=format&fit=crop&w=1200&q=80', 'active'),
  (7, 'Massage mô sâu thư giãn', 750000, 90, 'Massage giảm căng cơ và phục hồi năng lượng.', 'Massage', 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=1200&q=80', 'active'),
  (8, 'Trang điểm dự tiệc', 850000, 90, 'Trang điểm theo concept nhẹ nhàng, sang trọng cho sự kiện.', 'Trang điểm', 'https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?auto=format&fit=crop&w=1200&q=80', 'active');

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

INSERT INTO voucher_assignments (voucher_id, customer_id, max_usage_customer)
VALUES
  (1, 4, 1);

INSERT INTO staff_weekly_availability (staff_id, day_of_week, start_time, end_time)
VALUES
  (3, 0, '08:00:00', '18:00:00'),
  (3, 1, '08:00:00', '18:00:00'),
  (3, 2, '08:00:00', '18:00:00'),
  (3, 3, '08:00:00', '18:00:00'),
  (3, 4, '08:00:00', '18:00:00'),
  (3, 5, '08:00:00', '17:00:00'),
  (3, 6, '09:00:00', '16:00:00');

INSERT INTO chat_suggestions (category, title, description, icon, action_type, action_data, priority)
VALUES
  ('service', 'Cắt tóc tạo kiểu', 'Xem các dịch vụ tóc đang hoạt động.', 'scissors', 'service', JSON_OBJECT('service_id', 2), 10),
  ('booking', 'Đặt lịch nhanh', 'Chọn dịch vụ, ngày giờ và nhân viên phù hợp.', 'calendar', 'booking', JSON_OBJECT('action', 'quick_booking'), 9),
  ('faq', 'Giờ làm việc', 'Xem thông tin giờ mở cửa của salon.', 'clock', 'faq', JSON_OBJECT('faq_id', 1), 8);

INSERT INTO chat_faq (question, answer, category, keywords)
VALUES
  ('Salon mở cửa lúc mấy giờ?', 'Salon mở cửa từ 08:00 đến 18:00 vào ngày thường, cuối tuần có thể thay đổi theo lịch nhân viên.', 'Giờ làm việc', 'giờ mở cửa, thời gian, lịch làm việc'),
  ('Tôi có thể đặt lịch online không?', 'Bạn có thể đăng nhập tài khoản khách hàng, chọn dịch vụ, ngày giờ và nhân viên còn trống để đặt lịch.', 'Đặt lịch', 'đặt lịch, online, booking'),
  ('Salon hỗ trợ thanh toán thế nào?', 'Salon hỗ trợ thanh toán tiền mặt, chuyển khoản, VNPay và VietQR tuỳ cấu hình hệ thống.', 'Thanh toán', 'thanh toán, tiền mặt, vnpay, vietqr');

INSERT INTO chat_bot_responses (trigger_keyword, response_text, response_type, confidence_score)
VALUES
  ('xin chào|hello|hi', 'Xin chào! Mình có thể hỗ trợ bạn xem dịch vụ, đặt lịch hoặc kiểm tra thông tin thanh toán.', 'text', 0.95),
  ('giờ làm việc|mở cửa|đóng cửa', 'Salon mở cửa từ 08:00 đến 18:00 vào ngày thường. Bạn muốn đặt lịch khung giờ nào?', 'suggestion', 0.90),
  ('đặt lịch|booking|hẹn', 'Bạn hãy chọn dịch vụ trước, sau đó hệ thống sẽ gợi ý nhân viên còn trống.', 'suggestion', 0.90);
