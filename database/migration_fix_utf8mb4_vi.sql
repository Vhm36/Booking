USE booking_system;

-- Chuẩn hóa bộ mã tiếng Việt cho toàn bộ hệ thống.
ALTER DATABASE booking_system
  CHARACTER SET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;

ALTER TABLE users CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE services CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE appointments CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE payments CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Đảm bảo phiên import dữ liệu dùng đúng mã hóa.
SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;
