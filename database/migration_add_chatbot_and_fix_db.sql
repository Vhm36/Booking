-- ============================================================================
-- MIGRATION: Add Chatbot Support & Fix DB Relationships
-- ============================================================================

-- ============================================================================
-- PART 1: Fix Missing staff_role Table (if not exists)
-- ============================================================================

CREATE TABLE IF NOT EXISTS staff_role (
  id INT AUTO_INCREMENT PRIMARY KEY,
  role_name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_role_name (role_name),
  INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET @has_staff_role_description := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'staff_role'
    AND COLUMN_NAME = 'description'
);

SET @sql_staff_role_description := IF(
  @has_staff_role_description = 0,
  'ALTER TABLE staff_role ADD COLUMN description TEXT NULL AFTER role_name',
  'SELECT "staff_role.description already exists"'
);

PREPARE stmt_staff_role_description FROM @sql_staff_role_description;
EXECUTE stmt_staff_role_description;
DEALLOCATE PREPARE stmt_staff_role_description;

SET @has_staff_role_is_active := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'staff_role'
    AND COLUMN_NAME = 'is_active'
);

SET @sql_staff_role_is_active := IF(
  @has_staff_role_is_active = 0,
  'ALTER TABLE staff_role ADD COLUMN is_active TINYINT(1) DEFAULT 1 AFTER description',
  'SELECT "staff_role.is_active already exists"'
);

PREPARE stmt_staff_role_is_active FROM @sql_staff_role_is_active;
EXECUTE stmt_staff_role_is_active;
DEALLOCATE PREPARE stmt_staff_role_is_active;

SET @has_staff_role_created_at := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'staff_role'
    AND COLUMN_NAME = 'created_at'
);

SET @sql_staff_role_created_at := IF(
  @has_staff_role_created_at = 0,
  'ALTER TABLE staff_role ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP AFTER is_active',
  'SELECT "staff_role.created_at already exists"'
);

PREPARE stmt_staff_role_created_at FROM @sql_staff_role_created_at;
EXECUTE stmt_staff_role_created_at;
DEALLOCATE PREPARE stmt_staff_role_created_at;

-- Add Foreign Key to users table if not exists
SET @has_fk := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'staff_role_id'
    AND REFERENCED_TABLE_NAME = 'staff_role'
);

SET @sql_fk := IF(
  @has_fk = 0,
  'ALTER TABLE users ADD CONSTRAINT fk_users_staff_role FOREIGN KEY (staff_role_id) REFERENCES staff_role(id) ON DELETE SET NULL',
  'SELECT "FK already exists"'
);

PREPARE stmt_fk FROM @sql_fk;
EXECUTE stmt_fk;
DEALLOCATE PREPARE stmt_fk;

-- ============================================================================
-- PART 2: Add Chatbot Tables
-- ============================================================================

-- Bảng lưu trữ các cuộc trò chuyện
CREATE TABLE IF NOT EXISTS chat_conversations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  status ENUM('open', 'closed', 'escalated') DEFAULT 'open',
  assigned_staff_id INT NULL,
  subject VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  closed_at TIMESTAMP NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_staff_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_user_status (user_id, status),
  INDEX idx_assigned_staff (assigned_staff_id),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Bảng lưu trữ các tin nhắn trong cuộc trò chuyện
CREATE TABLE IF NOT EXISTS chat_messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  conversation_id INT NOT NULL,
  sender_type ENUM('customer', 'bot', 'staff') DEFAULT 'customer',
  sender_id INT NULL,
  message_text TEXT NOT NULL,
  message_type ENUM('text', 'suggestion', 'quick_reply', 'system') DEFAULT 'text',
  metadata JSON NULL,
  is_read TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (conversation_id) REFERENCES chat_conversations(id) ON DELETE CASCADE,
  FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_conversation (conversation_id),
  INDEX idx_sender (sender_type, sender_id),
  INDEX idx_created_at (created_at),
  INDEX idx_is_read (is_read)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Bảng lưu trữ các gợi ý thông minh cho khách hàng
CREATE TABLE IF NOT EXISTS chat_suggestions (
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
  INDEX idx_category_active (category, is_active),
  INDEX idx_priority (priority DESC),
  INDEX idx_action_type (action_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Bảng lưu trữ các câu hỏi thường gặp
CREATE TABLE IF NOT EXISTS chat_faq (
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
  INDEX idx_category_active (category, is_active),
  INDEX idx_keywords (keywords),
  INDEX idx_view_count (view_count DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Bảng lưu trữ các mẫu trả lời tự động của bot
CREATE TABLE IF NOT EXISTS chat_bot_responses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  trigger_keyword VARCHAR(255) NOT NULL,
  response_text TEXT NOT NULL,
  response_type ENUM('text', 'suggestion', 'escalate') DEFAULT 'text',
  confidence_score DECIMAL(3,2) DEFAULT 0.80,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_trigger_keyword (trigger_keyword),
  INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- PART 3: Seed Initial Data
-- ============================================================================

-- Insert default staff roles if not exists
INSERT IGNORE INTO staff_role (role_name, description)
VALUES
  ('Kỹ thuật viên', 'Nhân viên thực hiện dịch vụ'),
  ('Thu ngân', 'Nhân viên quản lý thanh toán'),
  ('Quản lý', 'Nhân viên quản lý salon');

-- Insert default chat suggestions
INSERT IGNORE INTO chat_suggestions (category, title, description, icon, action_type, action_data, priority)
VALUES
  ('service', 'Cắt tóc nam', 'Dịch vụ cắt tóc chuyên nghiệp cho nam giới', 'scissors', 'service', JSON_OBJECT('service_id', 1), 10),
  ('service', 'Nhuộm tóc', 'Nhuộm tóc với các màu sắc hiện đại', 'palette', 'service', JSON_OBJECT('service_id', 2), 9),
  ('booking', 'Đặt lịch nhanh', 'Đặt lịch hẹn với nhân viên yêu thích', 'calendar', 'booking', JSON_OBJECT('action', 'quick_booking'), 8),
  ('faq', 'Giờ làm việc', 'Xem giờ làm việc của salon', 'clock', 'faq', JSON_OBJECT('faq_id', 1), 7),
  ('promotion', 'Khuyến mãi hôm nay', 'Xem các khuyến mãi đặc biệt', 'gift', 'promotion', JSON_OBJECT('promo_type', 'daily'), 6);

-- Insert default FAQ
INSERT IGNORE INTO chat_faq (question, answer, category, keywords)
VALUES
  ('Salon mở cửa lúc mấy giờ?', 'Thứ 2 đến Thứ 6: 08:00-21:30. Thứ 7 và Chủ nhật: 07:00-23:00. Ca làm được chia sáng/tối theo lịch nhân viên.', 'Giờ làm việc', 'giờ mở cửa, thời gian, lịch'),
  ('Làm sao để đặt lịch hẹn?', 'Bạn có thể đặt lịch hẹn trực tiếp trên ứng dụng hoặc gọi điện thoại cho salon.', 'Đặt lịch', 'đặt lịch, hẹn, booking'),
  ('Có chính sách hoàn tiền không?', 'Chúng tôi có chính sách hoàn tiền 100% nếu bạn không hài lòng với dịch vụ.', 'Thanh toán', 'hoàn tiền, refund, tiền'),
  ('Nhân viên có kinh nghiệm không?', 'Tất cả nhân viên của chúng tôi đều có chứng chỉ và kinh nghiệm từ 3 năm trở lên.', 'Nhân viên', 'kinh nghiệm, nhân viên, chuyên môn'),
  ('Có dịch vụ gì mới?', 'Chúng tôi vừa thêm dịch vụ chăm sóc da mặt cao cấp và massage đầu thư giãn.', 'Dịch vụ', 'dịch vụ mới, mới, cập nhật');

-- Insert default bot responses
INSERT IGNORE INTO chat_bot_responses (trigger_keyword, response_text, response_type, confidence_score)
VALUES
  ('xin chào|hello|hi', 'Xin chào! 👋 Chào mừng bạn đến với salon chúng tôi. Tôi có thể giúp bạn với điều gì?', 'text', 0.95),
  ('giờ làm việc|mở cửa|đóng cửa', 'Salon mở cửa Thứ 2-Thứ 6 từ 08:00-21:30, Thứ 7-Chủ nhật từ 07:00-23:00. Bạn muốn đặt lịch khung giờ nào?', 'suggestion', 0.90),
  ('đặt lịch|booking|hẹn', 'Tuyệt vời! Bạn muốn đặt lịch hẹn nào? Chúng tôi có các dịch vụ: cắt tóc, nhuộm, chăm sóc da...', 'suggestion', 0.92),
  ('giá cả|bao nhiêu tiền|chi phí', 'Giá cả của chúng tôi rất cạnh tranh. Bạn muốn biết giá của dịch vụ nào?', 'suggestion', 0.88),
  ('nhân viên|kỹ thuật viên|chuyên gia', 'Tất cả nhân viên của chúng tôi đều có chứng chỉ và kinh nghiệm. Bạn muốn chọn nhân viên cụ thể không?', 'text', 0.85);

-- Additional FAQ and bot training data for better default coverage
INSERT INTO chat_faq (question, answer, category, keywords)
SELECT
  'Salon có nhận khách vãng lai không?',
  'Salon vẫn nhận khách vãng lai nếu còn chỗ trống, nhưng đặt lịch trước sẽ dễ chọn nhân viên và khung giờ đẹp hơn.',
  'Đặt lịch',
  'vãng lai, không hẹn trước, walk in, đặt lịch'
WHERE NOT EXISTS (
  SELECT 1 FROM chat_faq WHERE question IN ('Salon co nhan khach vang lai khong?', 'Salon có nhận khách vãng lai không?')
);

INSERT INTO chat_faq (question, answer, category, keywords)
SELECT
  'Tôi có thể đổi lịch hoặc hủy lịch không?',
  'Bạn có thể vào mục lịch hẹn để đổi giờ hoặc hủy lịch. Nếu lịch đã gần đến giờ, bạn nên thao tác sớm để salon sắp xếp nhân viên tốt hơn.',
  'Đặt lịch',
  'đổi lịch, hủy lịch, đổi giờ, reschedule, cancel'
WHERE NOT EXISTS (
  SELECT 1 FROM chat_faq WHERE question IN ('Toi co the doi lich hoac huy lich khong?', 'Tôi có thể đổi lịch hoặc hủy lịch không?')
);

INSERT INTO chat_faq (question, answer, category, keywords)
SELECT
  'Salon có nhận thanh toán online không?',
  'Salon hỗ trợ thanh toán online qua cổng thanh toán trên hệ thống, đồng thời bạn vẫn có thể chọn thanh toán tại salon nếu muốn.',
  'Thanh toán',
  'thanh toán online, chuyển khoản, momo, vnpay, tiền mặt'
WHERE NOT EXISTS (
  SELECT 1 FROM chat_faq WHERE question IN ('Salon co nhan thanh toan online khong?', 'Salon có nhận thanh toán online không?')
);

INSERT INTO chat_faq (question, answer, category, keywords)
SELECT
  'Tôi nên đến sớm trước giờ hẹn bao lâu?',
  'Bạn nên đến sớm khoảng 5 đến 10 phút để check-in, xác nhận dịch vụ và được tư vấn nhanh nếu cần.',
  'Đặt lịch',
  'đến sớm, check in, trước giờ hẹn, bao lâu'
WHERE NOT EXISTS (
  SELECT 1 FROM chat_faq WHERE question IN ('Toi nen den som truoc gio hen bao lau?', 'Tôi nên đến sớm trước giờ hẹn bao lâu?')
);

INSERT INTO chat_faq (question, answer, category, keywords)
SELECT
  'Salon có ưu đãi cho khách hàng thân thiết không?',
  'Salon có các ưu đãi theo chương trình và hạng mức khách hàng. Bạn có thể xem thông báo khuyến mãi hoặc hỏi bot để được gợi ý nhanh.',
  'Khuyến mãi',
  'vip, khách hàng thân thiết, ưu đãi, khuyến mãi, giảm giá'
WHERE NOT EXISTS (
  SELECT 1 FROM chat_faq WHERE question IN ('Salon co uu dai cho khach hang than thiet khong?', 'Salon có ưu đãi cho khách hàng thân thiết không?')
);

INSERT INTO chat_bot_responses (trigger_keyword, response_text, response_type, confidence_score)
SELECT
  'huy lich|doi lich|reschedule|cancel',
  'Bạn có thể vào phần lịch hẹn để đổi giờ hoặc hủy lịch. Nếu cần, mình cũng có thể chuyển yêu cầu sang nhân viên hỗ trợ.',
  'text',
  0.93
WHERE NOT EXISTS (
  SELECT 1 FROM chat_bot_responses WHERE trigger_keyword = 'huy lich|doi lich|reschedule|cancel'
);

INSERT INTO chat_bot_responses (trigger_keyword, response_text, response_type, confidence_score)
SELECT
  'khuyen mai|uu dai|giam gia|combo',
  'Mình có thể gợi ý các ưu đãi đang hiện có, hoặc nếu bạn nói rõ dịch vụ quan tâm thì mình sẽ ưu tiên gợi ý phù hợp hơn.',
  'suggestion',
  0.91
WHERE NOT EXISTS (
  SELECT 1 FROM chat_bot_responses WHERE trigger_keyword = 'khuyen mai|uu dai|giam gia|combo'
);

INSERT INTO chat_bot_responses (trigger_keyword, response_text, response_type, confidence_score)
SELECT
  'thanh toan|momo|vnpay|chuyen khoan|tien mat',
  'Salon hỗ trợ thanh toán online và thanh toán tại salon. Nếu bạn muốn, mình có thể hướng dẫn cách đặt lịch và thanh toán nhanh.',
  'text',
  0.92
WHERE NOT EXISTS (
  SELECT 1 FROM chat_bot_responses WHERE trigger_keyword = 'thanh toan|momo|vnpay|chuyen khoan|tien mat'
);

INSERT INTO chat_bot_responses (trigger_keyword, response_text, response_type, confidence_score)
SELECT
  'tu van|goi y|chon dich vu',
  'Bạn chỉ cần nói nhu cầu như cắt tóc, nhuộm, chăm sóc da hay massage, mình sẽ gợi ý dịch vụ phù hợp và mức giá tham khảo.',
  'suggestion',
  0.89
WHERE NOT EXISTS (
  SELECT 1 FROM chat_bot_responses WHERE trigger_keyword = 'tu van|goi y|chon dich vu'
);

INSERT INTO chat_bot_responses (trigger_keyword, response_text, response_type, confidence_score)
SELECT
  'nguoi that|nhan vien that|ho tro truc tiep',
  'Mình sẽ chuyển cuộc trò chuyện sang nhân viên hỗ trợ để bạn được tư vấn chi tiết hơn.',
  'escalate',
  0.98
WHERE NOT EXISTS (
  SELECT 1 FROM chat_bot_responses WHERE trigger_keyword = 'nguoi that|nhan vien that|ho tro truc tiep'
);

INSERT INTO chat_suggestions (category, title, description, icon, action_type, action_data, priority)
SELECT
  'service',
  'Chăm sóc da cấp ẩm',
  'Gợi ý cho khách muốn làm đẹp nhẹ nhàng và thư giãn',
  'sparkles',
  'service',
  JSON_OBJECT('service_id', 8),
  8
WHERE NOT EXISTS (
  SELECT 1 FROM chat_suggestions WHERE category = 'service' AND title IN ('Cham soc da cap am', 'Chăm sóc da cấp ẩm')
);

INSERT INTO chat_suggestions (category, title, description, icon, action_type, action_data, priority)
SELECT
  'service',
  'Massage thư giãn',
  'Dịch vụ phù hợp khi bạn muốn giảm mệt mỏi sau ngày dài',
  'hand',
  'service',
  JSON_OBJECT('service_id', 9),
  8
WHERE NOT EXISTS (
  SELECT 1 FROM chat_suggestions WHERE category = 'service' AND title IN ('Massage thu gian', 'Massage thư giãn')
);

INSERT INTO chat_suggestions (category, title, description, icon, action_type, action_data, priority)
SELECT
  'contact',
  'Gặp nhân viên tư vấn',
  'Chuyển cuộc trò chuyện cho nhân viên khi bạn cần tư vấn sâu hơn',
  'headset',
  'contact',
  JSON_OBJECT('action', 'handoff'),
  9
WHERE NOT EXISTS (
  SELECT 1 FROM chat_suggestions WHERE category = 'contact' AND title IN ('Gap nhan vien tu van', 'Gặp nhân viên tư vấn')
);

-- Normalize seeded chatbot content to Vietnamese with accents
UPDATE chat_suggestions
SET
  title = 'Cắt tóc nam',
  description = 'Dịch vụ cắt tóc chuyên nghiệp cho nam giới'
WHERE title IN ('C?t t?c nam', 'Cắt tóc nam')
   OR description = 'D?ch v? c?t t?c chuy?n nghi?p cho nam gi?i';

UPDATE chat_faq
SET
  question = 'Làm sao để đặt lịch hẹn?',
  answer = 'Bạn có thể đặt lịch hẹn trực tiếp trên ứng dụng hoặc gọi điện thoại cho salon.',
  category = 'Đặt lịch',
  keywords = 'đặt lịch, hẹn, booking'
WHERE question IN ('L?m sao ?? ??t l?ch h?n?', 'Làm sao để đặt lịch hẹn?');

UPDATE chat_faq
SET
  question = 'Salon có nhận khách vãng lai không?',
  answer = 'Salon vẫn nhận khách vãng lai nếu còn chỗ trống, nhưng đặt lịch trước sẽ dễ chọn nhân viên và khung giờ đẹp hơn.',
  category = 'Đặt lịch',
  keywords = 'vãng lai, không hẹn trước, walk in, đặt lịch'
WHERE question IN ('Salon co nhan khach vang lai khong?', 'Salon có nhận khách vãng lai không?');

UPDATE chat_faq
SET
  question = 'Tôi có thể đổi lịch hoặc hủy lịch không?',
  answer = 'Bạn có thể vào mục lịch hẹn để đổi giờ hoặc hủy lịch. Nếu lịch đã gần đến giờ, bạn nên thao tác sớm để salon sắp xếp nhân viên tốt hơn.',
  category = 'Đặt lịch',
  keywords = 'đổi lịch, hủy lịch, đổi giờ, reschedule, cancel'
WHERE question IN ('Toi co the doi lich hoac huy lich khong?', 'Tôi có thể đổi lịch hoặc hủy lịch không?');

UPDATE chat_faq
SET
  question = 'Salon có nhận thanh toán online không?',
  answer = 'Salon hỗ trợ thanh toán online qua cổng thanh toán trên hệ thống, đồng thời bạn vẫn có thể chọn thanh toán tại salon nếu muốn.',
  category = 'Thanh toán',
  keywords = 'thanh toán online, chuyển khoản, momo, vnpay, tiền mặt'
WHERE question IN ('Salon co nhan thanh toan online khong?', 'Salon có nhận thanh toán online không?');

UPDATE chat_faq
SET
  question = 'Tôi nên đến sớm trước giờ hẹn bao lâu?',
  answer = 'Bạn nên đến sớm khoảng 5 đến 10 phút để check-in, xác nhận dịch vụ và được tư vấn nhanh nếu cần.',
  category = 'Đặt lịch',
  keywords = 'đến sớm, check in, trước giờ hẹn, bao lâu'
WHERE question IN ('Toi nen den som truoc gio hen bao lau?', 'Tôi nên đến sớm trước giờ hẹn bao lâu?');

UPDATE chat_faq
SET
  question = 'Salon có ưu đãi cho khách hàng thân thiết không?',
  answer = 'Salon có các ưu đãi theo chương trình và hạng mức khách hàng. Bạn có thể xem thông báo khuyến mãi hoặc hỏi bot để được gợi ý nhanh.',
  category = 'Khuyến mãi',
  keywords = 'vip, khách hàng thân thiết, ưu đãi, khuyến mãi, giảm giá'
WHERE question IN ('Salon co uu dai cho khach hang than thiet khong?', 'Salon có ưu đãi cho khách hàng thân thiết không?');

UPDATE chat_bot_responses
SET response_text = 'Bạn có thể vào phần lịch hẹn để đổi giờ hoặc hủy lịch. Nếu cần, mình cũng có thể chuyển yêu cầu sang nhân viên hỗ trợ.'
WHERE trigger_keyword = 'huy lich|doi lich|reschedule|cancel';

UPDATE chat_bot_responses
SET response_text = 'Mình có thể gợi ý các ưu đãi đang hiện có, hoặc nếu bạn nói rõ dịch vụ quan tâm thì mình sẽ ưu tiên gợi ý phù hợp hơn.'
WHERE trigger_keyword = 'khuyen mai|uu dai|giam gia|combo';

UPDATE chat_bot_responses
SET response_text = 'Salon hỗ trợ thanh toán online và thanh toán tại salon. Nếu bạn muốn, mình có thể hướng dẫn cách đặt lịch và thanh toán nhanh.'
WHERE trigger_keyword = 'thanh toan|momo|vnpay|chuyen khoan|tien mat';

UPDATE chat_bot_responses
SET response_text = 'Bạn chỉ cần nói nhu cầu như cắt tóc, nhuộm, chăm sóc da hay massage, mình sẽ gợi ý dịch vụ phù hợp và mức giá tham khảo.'
WHERE trigger_keyword = 'tu van|goi y|chon dich vu';

UPDATE chat_bot_responses
SET response_text = 'Mình sẽ chuyển cuộc trò chuyện sang nhân viên hỗ trợ để bạn được tư vấn chi tiết hơn.'
WHERE trigger_keyword = 'nguoi that|nhan vien that|ho tro truc tiep';

UPDATE chat_suggestions
SET
  title = 'Chăm sóc da cấp ẩm',
  description = 'Gợi ý cho khách muốn làm đẹp nhẹ nhàng và thư giãn'
WHERE title IN ('Cham soc da cap am', 'Chăm sóc da cấp ẩm');

UPDATE chat_suggestions
SET
  title = 'Massage thư giãn',
  description = 'Dịch vụ phù hợp khi bạn muốn giảm mệt mỏi sau ngày dài'
WHERE title IN ('Massage thu gian', 'Massage thư giãn');

UPDATE chat_suggestions
SET
  title = 'Gặp nhân viên tư vấn',
  description = 'Chuyển cuộc trò chuyện cho nhân viên khi bạn cần tư vấn sâu hơn'
WHERE title IN ('Gap nhan vien tu van', 'Gặp nhân viên tư vấn');

-- ============================================================================
-- PART 4: Verify Foreign Keys
-- ============================================================================

-- Check all foreign keys
SELECT 
  CONSTRAINT_NAME,
  TABLE_NAME,
  COLUMN_NAME,
  REFERENCED_TABLE_NAME,
  REFERENCED_COLUMN_NAME
FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
WHERE TABLE_SCHEMA = DATABASE()
  AND REFERENCED_TABLE_NAME IS NOT NULL
ORDER BY TABLE_NAME, CONSTRAINT_NAME;
