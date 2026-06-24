CREATE DATABASE IF NOT EXISTS booking_system;
USE booking_system;

-- Bảng users: lưu thông tin người dùng (khách hàng, nhân viên, quản trị viên)
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) NOT NULL UNIQUE,
  zalo_id VARCHAR(64) NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  date_of_birth DATE NULL,
  role ENUM('user', 'admin', 'staff') DEFAULT 'user',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Bảng services: lưu thông tin về các dịch vụ salon cung cấp
CREATE TABLE services (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  duration INT NOT NULL,
  description TEXT,
  category VARCHAR(100),
  status ENUM('active', 'inactive') DEFAULT 'active',
  service_code VARCHAR(50) UNIQUE DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Bảng appointments: lưu thông tin lịch hẹn
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
  staff_rating TINYINT UNSIGNED NULL,
  staff_review TEXT NULL,
  reviewed_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (service_id) REFERENCES services(id),
  FOREIGN KEY (staff_id) REFERENCES users(id)
);

-- Bảng appointment_services: lưu danh sách dịch vụ và snapshot giá/thời lượng cho mỗi lịch hẹn
CREATE TABLE appointment_services (
  id INT AUTO_INCREMENT PRIMARY KEY,
  appointment_id INT NOT NULL,
  service_id INT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  price_snapshot DECIMAL(10,2) NOT NULL,
  duration_snapshot INT NOT NULL,
  service_name_snapshot VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (appointment_id) REFERENCES appointments(id),
  FOREIGN KEY (service_id) REFERENCES services(id)
);

-- Bảng payments: lưu thông tin thanh toán của lịch hẹn
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
  FOREIGN KEY (appointment_id) REFERENCES appointments(id)
);
