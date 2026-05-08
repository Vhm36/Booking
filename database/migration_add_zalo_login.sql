USE booking_system;

-- Thêm cột zalo_id vào bảng users để hỗ trợ đăng nhập bằng Zalo
ALTER TABLE users ADD COLUMN zalo_id VARCHAR(50) NULL UNIQUE AFTER email;

-- Index cho tra cứu nhanh
CREATE INDEX idx_users_zalo_id ON users(zalo_id);
