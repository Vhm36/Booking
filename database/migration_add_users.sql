USE booking_system;
SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Password cho tất cả user mới: "123456" (bcrypt hash)
-- $2a$10$0pvvqR74Znq9SuBZ0HkOju0Dlar/LZIhcL6fxa7GzUxlBL37liBwG

-- ===== THÊM 2 ADMIN MỚI (id=5,6) =====
INSERT INTO users (id, name, email, password, phone, role, staff_role_id, is_active, created_at) VALUES
  (5,  'Diệu Anh', 'dieuanh@beautybook.com', '$2a$10$0pvvqR74Znq9SuBZ0HkOju0Dlar/LZIhcL6fxa7GzUxlBL37liBwG', '0901100001', 'admin', NULL, 1, NOW()),
  (6,  'Minh Quân', 'minhquan@beautybook.com', '$2a$10$0pvvqR74Znq9SuBZ0HkOju0Dlar/LZIhcL6fxa7GzUxlBL37liBwG', '0901100002', 'admin', NULL, 1, NOW());

-- ===== THÊM 2 THU NGÂN MỚI (id=7,8) =====
INSERT INTO users (id, name, email, password, phone, role, staff_role_id, is_active, created_at) VALUES
  (7,  'Thanh Tâm', 'thanhtam@beautybook.com', '$2a$10$0pvvqR74Znq9SuBZ0HkOju0Dlar/LZIhcL6fxa7GzUxlBL37liBwG', '0901200001', 'staff', 2, 1, NOW()),
  (8,  'Hồng Nhung', 'hongnhung@beautybook.com', '$2a$10$0pvvqR74Znq9SuBZ0HkOju0Dlar/LZIhcL6fxa7GzUxlBL37liBwG', '0901200002', 'staff', 2, 1, NOW());

-- ===== THÊM 5 NHÂN VIÊN DỊCH VỤ MỚI (id=9-13) =====
INSERT INTO users (id, name, email, password, phone, role, staff_role_id, is_active, created_at) VALUES
  (9,  'Ngọc Trinh', 'ngoctrinh@beautybook.com', '$2a$10$0pvvqR74Znq9SuBZ0HkOju0Dlar/LZIhcL6fxa7GzUxlBL37liBwG', '0901300001', 'staff', 1, 1, NOW()),
  (10, 'Thùy Linh', 'thuylinh@beautybook.com', '$2a$10$0pvvqR74Znq9SuBZ0HkOju0Dlar/LZIhcL6fxa7GzUxlBL37liBwG', '0901300002', 'staff', 1, 1, NOW()),
  (11, 'Bảo Ngọc', 'baongoc@beautybook.com', '$2a$10$0pvvqR74Znq9SuBZ0HkOju0Dlar/LZIhcL6fxa7GzUxlBL37liBwG', '0901300003', 'staff', 1, 1, NOW()),
  (12, 'Phương Anh', 'phuonganh@beautybook.com', '$2a$10$0pvvqR74Znq9SuBZ0HkOju0Dlar/LZIhcL6fxa7GzUxlBL37liBwG', '0901300004', 'staff', 1, 1, NOW()),
  (13, 'Khánh Vy', 'khanhvy@beautybook.com', '$2a$10$0pvvqR74Znq9SuBZ0HkOju0Dlar/LZIhcL6fxa7GzUxlBL37liBwG', '0901300005', 'staff', 1, 1, NOW());

-- ===== THÊM 15 KHÁCH HÀNG MỚI (id=14-28) =====
INSERT INTO users (id, name, email, password, phone, role, staff_role_id, is_active, created_at) VALUES
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

-- ===== LỊCH LÀM VIỆC CHO NHÂN VIÊN MỚI (id=9-13) =====
-- Mỗi nhân viên có ca khác nhau để tăng khả năng đặt lịch
INSERT INTO staff_weekly_availability (staff_id, day_of_week, start_time, end_time) VALUES
  -- Ngọc Trinh (id=9): Ca sáng T2-T6, ca sáng T7-CN
  (9, 0, '08:00:00', '16:00:00'), (9, 1, '08:00:00', '16:00:00'),
  (9, 2, '08:00:00', '16:00:00'), (9, 3, '08:00:00', '16:00:00'),
  (9, 4, '08:00:00', '16:00:00'), (9, 5, '08:00:00', '15:00:00'),
  (9, 6, '08:00:00', '15:00:00'),
  -- Thùy Linh (id=10): Ca chiều T2-T6
  (10, 0, '12:00:00', '21:00:00'), (10, 1, '12:00:00', '21:00:00'),
  (10, 2, '12:00:00', '21:00:00'), (10, 3, '12:00:00', '21:00:00'),
  (10, 4, '12:00:00', '21:00:00'), (10, 5, '09:00:00', '17:00:00'),
  (10, 6, '09:00:00', '17:00:00'),
  -- Bảo Ngọc (id=11): Ca sáng T2-T6
  (11, 0, '08:00:00', '16:00:00'), (11, 1, '08:00:00', '16:00:00'),
  (11, 2, '08:00:00', '16:00:00'), (11, 3, '08:00:00', '16:00:00'),
  (11, 4, '08:00:00', '16:00:00'), (11, 5, '07:00:00', '15:00:00'),
  (11, 6, '07:00:00', '15:00:00'),
  -- Phương Anh (id=12): Ca chiều T2-T6
  (12, 0, '13:00:00', '21:30:00'), (12, 1, '13:00:00', '21:30:00'),
  (12, 2, '13:00:00', '21:30:00'), (12, 3, '13:00:00', '21:30:00'),
  (12, 4, '13:00:00', '21:30:00'), (12, 5, '10:00:00', '18:00:00'),
  (12, 6, '10:00:00', '18:00:00'),
  -- Khánh Vy (id=13): Ca xoay T2-T6
  (13, 0, '09:00:00', '17:00:00'), (13, 1, '09:00:00', '17:00:00'),
  (13, 2, '12:00:00', '20:00:00'), (13, 3, '09:00:00', '17:00:00'),
  (13, 4, '12:00:00', '20:00:00'), (13, 5, '08:00:00', '16:00:00'),
  (13, 6, '08:00:00', '16:00:00');

-- ===== THÊM LỊCH HẸN CHO KHÁCH HÀNG MỚI (tạo dữ liệu K-Means phong phú) =====
INSERT INTO appointments (user_id, service_id, staff_id, appointment_date, appointment_time, end_time, status, total_amount, staff_rating, created_at)
VALUES
  -- === Trần Thị Mai (id=14) - Champions: chi nhiều, đặt thường xuyên ===
  (14, 27, 9,  DATE_SUB(CURDATE(), INTERVAL 50 DAY), '09:00:00', '12:00:00', 'completed', 2500000, 5, DATE_SUB(NOW(), INTERVAL 50 DAY)),
  (14, 14, 9,  DATE_SUB(CURDATE(), INTERVAL 40 DAY), '09:00:00', '11:00:00', 'completed', 900000,  5, DATE_SUB(NOW(), INTERVAL 40 DAY)),
  (14, 29, 9,  DATE_SUB(CURDATE(), INTERVAL 30 DAY), '13:00:00', '14:30:00', 'completed', 500000,  5, DATE_SUB(NOW(), INTERVAL 30 DAY)),
  (14, 32, 9,  DATE_SUB(CURDATE(), INTERVAL 20 DAY), '09:00:00', '11:00:00', 'completed', 3750000, 5, DATE_SUB(NOW(), INTERVAL 20 DAY)),
  (14, 24, 9,  DATE_SUB(CURDATE(), INTERVAL 10 DAY), '14:00:00', '15:15:00', 'completed', 425000,  5, DATE_SUB(NOW(), INTERVAL 10 DAY)),
  (14, 35, 9,  DATE_SUB(CURDATE(), INTERVAL 3 DAY),  '10:00:00', '11:00:00', 'completed', 900000,  5, DATE_SUB(NOW(), INTERVAL 3 DAY)),

  -- === Nguyễn Hồng Hạnh (id=15) - Loyal Customers: đặt đều, chi trung bình ===
  (15, 1,  10, DATE_SUB(CURDATE(), INTERVAL 45 DAY), '13:00:00', '13:45:00', 'completed', 140000, 5, DATE_SUB(NOW(), INTERVAL 45 DAY)),
  (15, 6,  10, DATE_SUB(CURDATE(), INTERVAL 35 DAY), '14:00:00', '14:45:00', 'completed', 125000, 4, DATE_SUB(NOW(), INTERVAL 35 DAY)),
  (15, 8,  10, DATE_SUB(CURDATE(), INTERVAL 25 DAY), '15:00:00', '16:00:00', 'completed', 185000, 5, DATE_SUB(NOW(), INTERVAL 25 DAY)),
  (15, 11, 10, DATE_SUB(CURDATE(), INTERVAL 15 DAY), '13:00:00', '14:00:00', 'completed', 200000, 5, DATE_SUB(NOW(), INTERVAL 15 DAY)),
  (15, 3,  10, DATE_SUB(CURDATE(), INTERVAL 5 DAY),  '14:00:00', '14:30:00', 'completed', 100000, 4, DATE_SUB(NOW(), INTERVAL 5 DAY)),

  -- === Lê Thùy Dung (id=16) - Potential Loyalists: mới bắt đầu chi nhiều ===
  (16, 16, 11, DATE_SUB(CURDATE(), INTERVAL 20 DAY), '09:00:00', '10:00:00', 'completed', 400000, 5, DATE_SUB(NOW(), INTERVAL 20 DAY)),
  (16, 22, 11, DATE_SUB(CURDATE(), INTERVAL 12 DAY), '10:30:00', '11:45:00', 'completed', 300000, 5, DATE_SUB(NOW(), INTERVAL 12 DAY)),
  (16, 18, 11, DATE_SUB(CURDATE(), INTERVAL 4 DAY),  '09:00:00', '10:15:00', 'completed', 325000, 5, DATE_SUB(NOW(), INTERVAL 4 DAY)),

  -- === Phạm Thanh Hà (id=17) - At Risk: chi nhiều nhưng lâu không quay lại ===
  (17, 28, 12, DATE_SUB(CURDATE(), INTERVAL 55 DAY), '14:00:00', '16:00:00', 'completed', 1400000, 5, DATE_SUB(NOW(), INTERVAL 55 DAY)),
  (17, 14, 12, DATE_SUB(CURDATE(), INTERVAL 45 DAY), '13:00:00', '15:00:00', 'completed', 900000,  4, DATE_SUB(NOW(), INTERVAL 45 DAY)),
  (17, 29, 12, DATE_SUB(CURDATE(), INTERVAL 38 DAY), '15:00:00', '16:30:00', 'completed', 500000,  5, DATE_SUB(NOW(), INTERVAL 38 DAY)),

  -- === Vũ Minh Châu (id=18) - Loyal Customers: đặt đều, chi trung bình ===
  (18, 4,  13, DATE_SUB(CURDATE(), INTERVAL 35 DAY), '09:00:00', '09:45:00', 'completed', 150000, 5, DATE_SUB(NOW(), INTERVAL 35 DAY)),
  (18, 9,  13, DATE_SUB(CURDATE(), INTERVAL 25 DAY), '10:00:00', '10:45:00', 'completed', 150000, 4, DATE_SUB(NOW(), INTERVAL 25 DAY)),
  (18, 1,  13, DATE_SUB(CURDATE(), INTERVAL 18 DAY), '14:00:00', '14:45:00', 'completed', 140000, 5, DATE_SUB(NOW(), INTERVAL 18 DAY)),
  (18, 6,  13, DATE_SUB(CURDATE(), INTERVAL 10 DAY), '09:00:00', '09:45:00', 'completed', 125000, 5, DATE_SUB(NOW(), INTERVAL 10 DAY)),
  (18, 3,  13, DATE_SUB(CURDATE(), INTERVAL 2 DAY),  '15:00:00', '15:30:00', 'completed', 100000, 5, DATE_SUB(NOW(), INTERVAL 2 DAY)),

  -- === Đỗ Quỳnh Anh (id=19) - At Risk: lâu không quay lại ===
  (19, 1,  9,  DATE_SUB(CURDATE(), INTERVAL 50 DAY), '10:00:00', '10:45:00', 'completed', 140000, 3, DATE_SUB(NOW(), INTERVAL 50 DAY)),
  (19, 5,  9,  DATE_SUB(CURDATE(), INTERVAL 42 DAY), '11:00:00', '11:30:00', 'completed', 75000,  4, DATE_SUB(NOW(), INTERVAL 42 DAY)),

  -- === Hoàng Yến Nhi (id=20) - Champions: VIP cao, mua nhiều Luxury ===
  (20, 33, 10, DATE_SUB(CURDATE(), INTERVAL 28 DAY), '13:00:00', '15:00:00', 'completed', 3000000, 5, DATE_SUB(NOW(), INTERVAL 28 DAY)),
  (20, 27, 10, DATE_SUB(CURDATE(), INTERVAL 18 DAY), '14:00:00', '17:00:00', 'completed', 2500000, 5, DATE_SUB(NOW(), INTERVAL 18 DAY)),
  (20, 35, 10, DATE_SUB(CURDATE(), INTERVAL 8 DAY),  '15:00:00', '16:00:00', 'completed', 900000,  5, DATE_SUB(NOW(), INTERVAL 8 DAY)),
  (20, 30, 10, DATE_SUB(CURDATE(), INTERVAL 2 DAY),  '13:00:00', '14:30:00', 'completed', 850000,  5, DATE_SUB(NOW(), INTERVAL 2 DAY)),

  -- === Bùi Tường Vi (id=21) - Potential Loyalists ===
  (21, 11, 11, DATE_SUB(CURDATE(), INTERVAL 15 DAY), '10:00:00', '11:00:00', 'completed', 200000, 4, DATE_SUB(NOW(), INTERVAL 15 DAY)),
  (21, 25, 11, DATE_SUB(CURDATE(), INTERVAL 7 DAY),  '09:00:00', '10:00:00', 'completed', 375000, 5, DATE_SUB(NOW(), INTERVAL 7 DAY)),

  -- === Đinh Ngọc Lan (id=22) - New Customers: mới đăng ký, 1 lượt ===
  (22, 1,  12, DATE_SUB(CURDATE(), INTERVAL 5 DAY),  '14:00:00', '14:45:00', 'completed', 140000, 5, DATE_SUB(NOW(), INTERVAL 5 DAY)),

  -- === Trịnh Khánh Linh (id=23) - Loyal Customers ===
  (23, 17, 13, DATE_SUB(CURDATE(), INTERVAL 20 DAY), '10:00:00', '10:45:00', 'completed', 200000, 5, DATE_SUB(NOW(), INTERVAL 20 DAY)),
  (23, 4,  13, DATE_SUB(CURDATE(), INTERVAL 12 DAY), '14:00:00', '14:45:00', 'completed', 150000, 4, DATE_SUB(NOW(), INTERVAL 12 DAY)),
  (23, 8,  13, DATE_SUB(CURDATE(), INTERVAL 5 DAY),  '09:00:00', '10:00:00', 'completed', 185000, 5, DATE_SUB(NOW(), INTERVAL 5 DAY)),

  -- === Lý Thu Hương (id=24) - At Risk: hủy nhiều ===
  (24, 14, 9,  DATE_SUB(CURDATE(), INTERVAL 30 DAY), '10:00:00', '12:00:00', 'completed',  900000, 4, DATE_SUB(NOW(), INTERVAL 30 DAY)),
  (24, 16, 9,  DATE_SUB(CURDATE(), INTERVAL 25 DAY), '09:00:00', '10:00:00', 'cancelled',  400000, NULL, DATE_SUB(NOW(), INTERVAL 25 DAY)),
  (24, 1,  9,  DATE_SUB(CURDATE(), INTERVAL 20 DAY), '14:00:00', '14:45:00', 'cancelled',  140000, NULL, DATE_SUB(NOW(), INTERVAL 20 DAY)),

  -- === Ngô Phương Thảo (id=25) - Potential Loyalists ===
  (25, 19, 10, DATE_SUB(CURDATE(), INTERVAL 14 DAY), '16:00:00', '16:45:00', 'completed', 215000, 5, DATE_SUB(NOW(), INTERVAL 14 DAY)),
  (25, 21, 10, DATE_SUB(CURDATE(), INTERVAL 6 DAY),  '13:00:00', '14:00:00', 'completed', 325000, 5, DATE_SUB(NOW(), INTERVAL 6 DAY)),
  (25, 23, 10, DATE_SUB(CURDATE(), INTERVAL 1 DAY),  '15:00:00', '15:45:00', 'confirmed', 250000, NULL, DATE_SUB(NOW(), INTERVAL 1 DAY)),

  -- === Dương Thanh Trúc (id=26) - New Customers ===
  (26, 3,  11, DATE_SUB(CURDATE(), INTERVAL 3 DAY),  '10:00:00', '10:30:00', 'completed', 100000, 5, DATE_SUB(NOW(), INTERVAL 3 DAY)),

  -- === Tô Mỹ Duyên (id=27) - Loyal Customers ===
  (27, 12, 12, DATE_SUB(CURDATE(), INTERVAL 10 DAY), '15:00:00', '15:45:00', 'completed', 240000, 5, DATE_SUB(NOW(), INTERVAL 10 DAY)),
  (27, 24, 12, DATE_SUB(CURDATE(), INTERVAL 5 DAY),  '14:00:00', '15:15:00', 'completed', 425000, 5, DATE_SUB(NOW(), INTERVAL 5 DAY)),
  (27, 6,  12, DATE_SUB(CURDATE(), INTERVAL 1 DAY),  '16:00:00', '16:45:00', 'pending',   125000, NULL, DATE_SUB(NOW(), INTERVAL 1 DAY)),

  -- === Cao Bích Ngọc (id=28) - New Customers: vừa đăng ký ===
  (28, 10, 13, DATE_SUB(CURDATE(), INTERVAL 2 DAY),  '09:00:00', '09:20:00', 'completed', 65000, 4, DATE_SUB(NOW(), INTERVAL 2 DAY)),
  (28, 7,  13, DATE_SUB(CURDATE(), INTERVAL 1 DAY),  '10:00:00', '10:30:00', 'pending',   110000, NULL, DATE_SUB(NOW(), INTERVAL 1 DAY));
