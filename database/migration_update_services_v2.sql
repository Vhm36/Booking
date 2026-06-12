USE booking_system;
SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Tắt kiểm tra khóa ngoại để xóa dữ liệu cũ
SET FOREIGN_KEY_CHECKS = 0;
DELETE FROM appointment_services;
DELETE FROM payments;
DELETE FROM appointments;
DELETE FROM services;
DELETE FROM service_category;
SET FOREIGN_KEY_CHECKS = 1;

-- ===== DANH MỤC DỊCH VỤ MỚI =====
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
  (1,  'Cắt tóc dáng thiết kế', 140000, 45,
       'Tư vấn kiểu dáng phù hợp khuôn mặt, cắt tạo kiểu xu hướng mới nhất.',
       'Tóc', 'https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=1200&q=80', 'active'),
  (2,  'Nhuộm phủ bạc thảo dược', 320000, 90,
       'Nhuộm phủ bạc bằng thảo dược thiên nhiên, an toàn cho da đầu nhạy cảm.',
       'Tóc', 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=1200&q=80', 'active'),
  (3,  'Gội đầu dưỡng sinh thuần chay', 100000, 30,
       'Gội đầu bằng dầu gội thuần chay 100% thiên nhiên kết hợp massage thư giãn.',
       'Gội/Massage', 'https://images.unsplash.com/photo-1522337660859-02fbefca4702?auto=format&fit=crop&w=1200&q=80', 'active'),
  (4,  'Massage cổ vai gáy trị liệu', 150000, 45,
       'Massage trị liệu vùng cổ vai gáy, đánh tan mệt mỏi và căng cơ hiệu quả.',
       'Gội/Massage', 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?auto=format&fit=crop&w=1200&q=80', 'active'),
  (5,  'Nhặt da + Sửa dáng móng (Combo Tay/Chân)', 75000, 30,
       'Combo chăm sóc móng tay chân: nhặt da thừa và sửa dáng móng gọn gàng.',
       'Nail/Móng', 'https://images.unsplash.com/photo-1604654894610-df63bc536371?auto=format&fit=crop&w=1200&q=80', 'active'),
  (6,  'Sơn gel bền màu Hàn/Nhật', 125000, 45,
       'Sơn gel công nghệ Hàn/Nhật bền đẹp chuẩn màu, giữ nét từ 3-4 tuần.',
       'Nail/Móng', 'https://images.unsplash.com/photo-1607779097040-26e80aa78e66?auto=format&fit=crop&w=1200&q=80', 'active'),
  (7,  'Chà gót chân hồng, tẩy tế bào chết', 110000, 30,
       'Tẩy tế bào chết và chà gót chân, mang lại đôi chân hồng mịn màng.',
       'Nail/Móng', 'https://images.unsplash.com/photo-1519014816548-bf5fe059798b?auto=format&fit=crop&w=1200&q=80', 'active'),
  (8,  'Nối mi Classic tự nhiên', 185000, 60,
       'Nối mi sợi Classic tự nhiên như thật, nhẹ nhàng và giữ nét lâu dài.',
       'Mi/Mày', 'https://images.unsplash.com/photo-1512496015851-a90fb38ba796?auto=format&fit=crop&w=1200&q=80', 'active'),
  (9,  'Uốn mi Collagen + Phủ đen mi', 150000, 45,
       'Uốn mi bằng Collagen kết hợp phủ đen, tạo mi cong vút tự nhiên.',
       'Mi/Mày', 'https://images.unsplash.com/photo-1583001931096-959e9a1a6223?auto=format&fit=crop&w=1200&q=80', 'active'),
  (10, 'Waxing / Tỉa dáng mày', 65000, 20,
       'Waxing và tỉa dáng lông mày gọn gàng, định hình dáng mày chuẩn đẹp.',
       'Mi/Mày', 'https://images.unsplash.com/photo-1616394584738-fc6e612e71b9?auto=format&fit=crop&w=1200&q=80', 'active'),
  (11, 'Chăm sóc da mặt cơ bản (Làm sạch + Cấp ẩm)', 200000, 60,
       'Làm sạch sâu da mặt kết hợp cấp ẩm chuyên sâu, phục hồi làn da tươi sáng.',
       'Da mặt', 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?auto=format&fit=crop&w=1200&q=80', 'active'),
  (12, 'Lấy nhân mụn chuẩn y khoa', 240000, 45,
       'Lấy nhân mụn đúng kỹ thuật y khoa, sạch mụn an toàn không để lại sẹo.',
       'Da mặt', 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?auto=format&fit=crop&w=1200&q=80', 'active'),
  (13, 'Waxing lông tay/chân bằng sáp mật ong', 140000, 30,
       'Waxing lông tay chân bằng sáp mật ong thiên nhiên, dịu nhẹ cho làn da.',
       'Khác', 'https://images.unsplash.com/photo-1515377905703-c4788e51af15?auto=format&fit=crop&w=1200&q=80', 'active'),

-- =================================================================
-- PHÂN KHÚC CAO CẤP (Premium) — Dịch vụ Chuyên sâu
-- =================================================================
  (14, 'Uốn sóng lơi Hàn Quốc / Uốn cụp layer', 900000, 120,
       'Uốn sóng lơi phong cách Hàn Quốc hoặc uốn cụp layer, giữ nếp bền lâu.',
       'Tóc', 'https://images.unsplash.com/photo-1519699047748-de8e457a634e?auto=format&fit=crop&w=1200&q=80', 'active'),
  (15, 'Duỗi tóc tơ lụa tự nhiên', 900000, 120,
       'Duỗi tóc công nghệ tơ lụa, mang lại mái tóc bóng mượt như lụa tự nhiên.',
       'Tóc', 'https://images.unsplash.com/photo-1527799820374-dcf8d9d4a388?auto=format&fit=crop&w=1200&q=80', 'active'),
  (16, 'Hấp dầu phục hồi Collagen thủy phân', 400000, 60,
       'Hấp dầu Collagen thủy phân phục hồi chuyên sâu cho tóc hư tổn, khô xơ.',
       'Tóc', 'https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?auto=format&fit=crop&w=1200&q=80', 'active'),
  (17, 'Gội dưỡng sinh Trung Hoa đả thông kinh lạc', 200000, 45,
       'Gội dưỡng sinh theo phương pháp Trung Hoa, đả thông kinh lạc, thư giãn toàn thân.',
       'Gội/Massage', 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=1200&q=80', 'active'),
  (18, 'Massage body đá nóng Himalaya', 325000, 75,
       'Massage toàn thân bằng đá nóng Himalaya, thư giãn chuyên sâu và giải tỏa stress.',
       'Gội/Massage', 'https://images.unsplash.com/photo-1600334089648-b0d9d3028eb2?auto=format&fit=crop&w=1200&q=80', 'active'),
  (19, 'Sơn gel mắt mèo kim cương / Sơn thạch', 215000, 45,
       'Sơn gel hiệu ứng mắt mèo kim cương hoặc sơn thạch, hot trend thời thượng.',
       'Nail/Móng', 'https://images.unsplash.com/photo-1604654894610-df63bc536371?auto=format&fit=crop&w=1200&q=80', 'active'),
  (20, 'Nối móng úp cao cấp (Soft gel tips)', 325000, 60,
       'Nối móng úp bằng Soft gel tips cao cấp, tạo form chuẩn đẹp bền vững.',
       'Nail/Móng', 'https://images.unsplash.com/photo-1632345031435-8727f6897d53?auto=format&fit=crop&w=1200&q=80', 'active'),
  (21, 'Nail Art vẽ tay thiết kế', 325000, 60,
       'Vẽ nail art thiết kế theo yêu cầu, nghệ thuật sáng tạo trên từng đầu ngón.',
       'Nail/Móng', 'https://images.unsplash.com/photo-1604654894610-df63bc536371?auto=format&fit=crop&w=1200&q=80', 'active'),
  (22, 'Nối mi Volume quyến rũ / Mi Katun', 300000, 75,
       'Nối mi Volume hoặc mi Katun dày đẹp cuốn hút, phù hợp mọi phong cách.',
       'Mi/Mày', 'https://images.unsplash.com/photo-1512496015851-a90fb38ba796?auto=format&fit=crop&w=1200&q=80', 'active'),
  (23, 'Uốn định hình lông mày', 250000, 45,
       'Uốn và định hình lông mày theo dáng Tây hiện đại, giữ nếp tự nhiên.',
       'Mi/Mày', 'https://images.unsplash.com/photo-1616394584738-fc6e612e71b9?auto=format&fit=crop&w=1200&q=80', 'active'),
  (24, 'Cấy tảo xoắn / Cấy hồng sâm sáng da', 425000, 75,
       'Cấy dưỡng chất tảo xoắn hoặc hồng sâm, làm sáng da từ sâu bên trong.',
       'Da mặt', 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?auto=format&fit=crop&w=1200&q=80', 'active'),
  (25, 'Điện di Vitamin C trắng sáng, mờ thâm', 375000, 60,
       'Điện di Vitamin C giúp trắng sáng da, mờ thâm nám hiệu quả sau liệu trình.',
       'Da mặt', 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?auto=format&fit=crop&w=1200&q=80', 'active'),
  (26, 'Triệt lông vĩnh viễn công nghệ Diode Laser', 325000, 30,
       'Triệt lông vĩnh viễn bằng công nghệ Diode Laser, triệt sạch sâu và sáng da.',
       'Khác', 'https://images.unsplash.com/photo-1612817159949-195b6eb9e31a?auto=format&fit=crop&w=1200&q=80', 'active'),

-- =================================================================
-- PHÂN KHÚC SANG TRỌNG (Luxury) — Thượng hạng / Nghệ nhân
-- =================================================================
  (27, 'Nhuộm thời trang đỉnh cao (Balayage/Ombre)', 2500000, 180,
       'Nhuộm Balayage hoặc Ombre đỉnh cao do nghệ nhân thực hiện, hiệu ứng thượng hạng.',
       'Tóc', 'https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?auto=format&fit=crop&w=1200&q=80', 'active'),
  (28, 'Phục hồi tóc nát/hư tổn nặng chuyên sâu', 1400000, 120,
       'Hồi sinh tóc nát và hư tổn nặng bằng liệu trình chuyên sâu phục hồi tức thì.',
       'Tóc', 'https://images.unsplash.com/photo-1580618672591-eb180b1a973f?auto=format&fit=crop&w=1200&q=80', 'active'),
  (29, 'Combo VIP: Gội dưỡng sinh + Massage mặt + Đắp mặt nạ nghệ sĩ', 500000, 90,
       'Combo thư giãn hoàng gia: gội dưỡng sinh, massage mặt và đắp mặt nạ nghệ sĩ.',
       'Gội/Massage', 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=1200&q=80', 'active'),
  (30, 'Ẩn xà cừ, đính đá khối Swarovski thời thượng', 850000, 90,
       'Ẩn xà cừ và đính đá khối Swarovski thời thượng, mang đẳng cấp sang chảnh.',
       'Nail/Móng', 'https://images.unsplash.com/photo-1632345031435-8727f6897d53?auto=format&fit=crop&w=1200&q=80', 'active'),
  (31, 'Ủ paraffin hoàng gia mềm mịn da tay/chân', 375000, 45,
       'Ủ nến paraffin hoàng gia giúp mềm mịn da tay chân, cảm giác spa đẳng cấp.',
       'Nail/Móng', 'https://images.unsplash.com/photo-1519014816548-bf5fe059798b?auto=format&fit=crop&w=1200&q=80', 'active'),
  (32, 'Thêu mày Hairstroke sợi siêu thực', 3750000, 120,
       'Điêu khắc mày Hairstroke từng sợi siêu thực, do nghệ nhân hàng đầu thực hiện.',
       'Mi/Mày', 'https://images.unsplash.com/photo-1616394584738-fc6e612e71b9?auto=format&fit=crop&w=1200&q=80', 'active'),
  (33, 'Điêu khắc lông mày tự nhiên', 3000000, 120,
       'Nghệ nhân khắc từng sợi lông mày tự nhiên, tạo dáng mày hoàn hảo cá nhân hóa.',
       'Mi/Mày', 'https://images.unsplash.com/photo-1616394584738-fc6e612e71b9?auto=format&fit=crop&w=1200&q=80', 'active'),
  (34, 'Phun mày chạm hạt Ombre', 2650000, 90,
       'Phun mày chạm hạt Ombre độc quyền, mang lại dáng mày tự nhiên sang trọng.',
       'Mi/Mày', 'https://images.unsplash.com/photo-1583001931096-959e9a1a6223?auto=format&fit=crop&w=1200&q=80', 'active'),
  (35, 'Bắn laser carbon trẻ hóa da', 900000, 60,
       'Bắn laser carbon công nghệ cao giúp trẻ hóa da, se khít lỗ chân lông hiệu quả.',
       'Da mặt', 'https://images.unsplash.com/photo-1612817159949-195b6eb9e31a?auto=format&fit=crop&w=1200&q=80', 'active');

-- ===== DỮ LIỆU LỊCH HẸN MẪU (trải đều 3 phân khúc cho K-Means) =====
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

  -- Lịch hủy (cung cấp dữ liệu cancel_rate cho K-Means)
  (4, 1,  3, DATE_SUB(CURDATE(), INTERVAL 27 DAY), '14:00:00', '14:45:00', 'cancelled', 140000,  NULL, DATE_SUB(NOW(), INTERVAL 27 DAY)),
  (4, 11, 3, DATE_SUB(CURDATE(), INTERVAL 23 DAY), '09:00:00', '10:00:00', 'cancelled', 200000,  NULL, DATE_SUB(NOW(), INTERVAL 23 DAY));
