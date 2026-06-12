-- Chuẩn hóa dữ liệu hiển thị trên Dashboard, Dịch vụ và Nhân sự sang tiếng Việt có dấu.
-- File này chỉ cập nhật text seed/dữ liệu mẫu đã bị import sai mã hóa hoặc còn dấu hỏi.

USE booking_system;
SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;

UPDATE staff_role
SET
  role_name = CASE id
    WHEN 1 THEN 'Nhân viên'
    WHEN 2 THEN 'Thu ngân'
    WHEN 3 THEN 'Quản lý'
    ELSE role_name
  END
WHERE id IN (1, 2, 3);

SET @has_staff_role_description := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'staff_role'
    AND COLUMN_NAME = 'description'
);

SET @sql_fix_staff_role_description := IF(
  @has_staff_role_description = 1,
  'UPDATE staff_role
   SET description = CASE id
     WHEN 1 THEN ''Nhân viên thực hiện dịch vụ cho khách hàng''
     WHEN 2 THEN ''Nhân viên xử lý thanh toán và hỗ trợ quầy''
     WHEN 3 THEN ''Nhân viên quản lý vận hành salon''
     ELSE description
   END
   WHERE id IN (1, 2, 3)',
  'SELECT "staff_role.description column does not exist"'
);

PREPARE stmt_fix_staff_role_description FROM @sql_fix_staff_role_description;
EXECUTE stmt_fix_staff_role_description;
DEALLOCATE PREPARE stmt_fix_staff_role_description;

UPDATE users
SET name = CASE email
  WHEN 'admin@beautybook.com' THEN 'Quản trị viên'
  WHEN 'dieuanh@beautybook.com' THEN 'Diệu Anh'
  WHEN 'minhquan@beautybook.com' THEN 'Minh Quân'
  WHEN 'thungan@beautybook.com' THEN 'Thu Ngân'
  WHEN 'thanhtam@beautybook.com' THEN 'Thanh Tâm'
  WHEN 'hongnhung@beautybook.com' THEN 'Hồng Nhung'
  WHEN 'nhanvien@beautybook.com' THEN 'Nhân Viên'
  WHEN 'ngoctrinh@beautybook.com' THEN 'Ngọc Trinh'
  WHEN 'thuylinh@beautybook.com' THEN 'Thùy Linh'
  WHEN 'baongoc@beautybook.com' THEN 'Bảo Ngọc'
  WHEN 'phuonganh@beautybook.com' THEN 'Phương Anh'
  WHEN 'khanhvy@beautybook.com' THEN 'Khánh Vy'
  ELSE name
END
WHERE email IN (
  'admin@beautybook.com',
  'dieuanh@beautybook.com',
  'minhquan@beautybook.com',
  'thungan@beautybook.com',
  'thanhtam@beautybook.com',
  'hongnhung@beautybook.com',
  'nhanvien@beautybook.com',
  'ngoctrinh@beautybook.com',
  'thuylinh@beautybook.com',
  'baongoc@beautybook.com',
  'phuonganh@beautybook.com',
  'khanhvy@beautybook.com'
);

SET @has_service_category_table := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.TABLES
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'service_category'
);

SET @sql_fix_service_category := IF(
  @has_service_category_table = 1,
  'UPDATE service_category
   SET category_name = CASE id
     WHEN 1 THEN ''Tóc''
     WHEN 2 THEN ''Gội/Massage''
     WHEN 3 THEN ''Nail/Móng''
     WHEN 4 THEN ''Mi/Mày''
     WHEN 5 THEN ''Da mặt''
     WHEN 6 THEN ''Khác''
     ELSE category_name
   END
   WHERE id IN (1, 2, 3, 4, 5, 6)',
  'SELECT "service_category table does not exist"'
);

PREPARE stmt_fix_service_category FROM @sql_fix_service_category;
EXECUTE stmt_fix_service_category;
DEALLOCATE PREPARE stmt_fix_service_category;

UPDATE services
SET
  name = CASE id
    WHEN 1 THEN 'Cắt tóc dáng thiết kế'
    WHEN 2 THEN 'Nhuộm phủ bạc thảo dược'
    WHEN 3 THEN 'Gội đầu dưỡng sinh thuần chay'
    WHEN 4 THEN 'Massage cổ vai gáy trị liệu'
    WHEN 5 THEN 'Nhặt da + Sửa dáng móng (Combo Tay/Chân)'
    WHEN 6 THEN 'Sơn gel bền màu Hàn/Nhật'
    WHEN 7 THEN 'Chà gót chân hồng, tẩy tế bào chết'
    WHEN 8 THEN 'Nối mi Classic tự nhiên'
    WHEN 9 THEN 'Uốn mi Collagen + Phủ đen mi'
    WHEN 10 THEN 'Waxing / Tỉa dáng mày'
    WHEN 11 THEN 'Chăm sóc da mặt cơ bản (Làm sạch + Cấp ẩm)'
    WHEN 12 THEN 'Lấy nhân mụn chuẩn y khoa'
    WHEN 13 THEN 'Waxing lông tay/chân bằng sáp mật ong'
    WHEN 14 THEN 'Uốn sóng lơi Hàn Quốc / Uốn cụp layer'
    WHEN 15 THEN 'Duỗi tóc tơ lụa tự nhiên'
    WHEN 16 THEN 'Hấp dầu phục hồi Collagen thủy phân'
    WHEN 17 THEN 'Gội dưỡng sinh Trung Hoa đả thông kinh lạc'
    WHEN 18 THEN 'Massage body đá nóng Himalaya'
    WHEN 19 THEN 'Sơn gel mắt mèo kim cương / Sơn thạch'
    WHEN 20 THEN 'Nối móng úp cao cấp (Soft gel tips)'
    WHEN 21 THEN 'Nail Art vẽ tay thiết kế'
    WHEN 22 THEN 'Nối mi Volume quyến rũ / Mi Katun'
    WHEN 23 THEN 'Uốn định hình lông mày'
    WHEN 24 THEN 'Cấy tảo xoắn / Cấy hồng sâm sáng da'
    WHEN 25 THEN 'Điện di Vitamin C trắng sáng, mờ thâm'
    WHEN 26 THEN 'Triệt lông vĩnh viễn công nghệ Diode Laser'
    WHEN 27 THEN 'Nhuộm thời trang đỉnh cao (Balayage/Ombre)'
    WHEN 28 THEN 'Phục hồi tóc nát/hư tổn nặng chuyên sâu'
    WHEN 29 THEN 'Combo VIP: Gội dưỡng sinh + Massage mặt + Đắp mặt nạ nghệ sĩ'
    WHEN 30 THEN 'Ẩn xà cừ, đính đá khối Swarovski thời thượng'
    WHEN 31 THEN 'Ủ paraffin hoàng gia mềm mịn da tay/chân'
    WHEN 32 THEN 'Thêu mày Hairstroke sợi siêu thực'
    WHEN 33 THEN 'Điêu khắc lông mày tự nhiên'
    WHEN 34 THEN 'Phun mày chạm hạt Ombre'
    WHEN 35 THEN 'Bắn laser carbon trẻ hóa da'
    ELSE name
  END,
  description = CASE id
    WHEN 1 THEN 'Tư vấn kiểu dáng phù hợp khuôn mặt, cắt tạo kiểu xu hướng mới nhất.'
    WHEN 2 THEN 'Nhuộm phủ bạc bằng thảo dược thiên nhiên, an toàn cho da đầu nhạy cảm.'
    WHEN 3 THEN 'Gội đầu bằng dầu gội thuần chay 100% thiên nhiên kết hợp massage thư giãn.'
    WHEN 4 THEN 'Massage trị liệu vùng cổ vai gáy, đánh tan mệt mỏi và căng cơ hiệu quả.'
    WHEN 5 THEN 'Combo chăm sóc móng tay chân: nhặt da thừa và sửa dáng móng gọn gàng.'
    WHEN 6 THEN 'Sơn gel công nghệ Hàn/Nhật bền đẹp chuẩn màu, giữ nét từ 3-4 tuần.'
    WHEN 7 THEN 'Tẩy tế bào chết và chà gót chân, mang lại đôi chân hồng mịn màng.'
    WHEN 8 THEN 'Nối mi sợi Classic tự nhiên như thật, nhẹ nhàng và giữ nét lâu dài.'
    WHEN 9 THEN 'Uốn mi bằng Collagen kết hợp phủ đen, tạo mi cong vút tự nhiên.'
    WHEN 10 THEN 'Waxing và tỉa dáng lông mày gọn gàng, định hình dáng mày chuẩn đẹp.'
    WHEN 11 THEN 'Làm sạch sâu da mặt kết hợp cấp ẩm chuyên sâu, phục hồi làn da tươi sáng.'
    WHEN 12 THEN 'Lấy nhân mụn đúng kỹ thuật y khoa, sạch mụn an toàn không để lại sẹo.'
    WHEN 13 THEN 'Waxing lông tay chân bằng sáp mật ong thiên nhiên, dịu nhẹ cho làn da.'
    WHEN 14 THEN 'Uốn sóng lơi phong cách Hàn Quốc hoặc uốn cụp layer, giữ nếp bền lâu.'
    WHEN 15 THEN 'Duỗi tóc công nghệ tơ lụa, mang lại mái tóc bóng mượt như lụa tự nhiên.'
    WHEN 16 THEN 'Hấp dầu Collagen thủy phân phục hồi chuyên sâu cho tóc hư tổn, khô xơ.'
    WHEN 17 THEN 'Gội dưỡng sinh theo phương pháp Trung Hoa, đả thông kinh lạc, thư giãn toàn thân.'
    WHEN 18 THEN 'Massage toàn thân bằng đá nóng Himalaya, thư giãn chuyên sâu và giải tỏa stress.'
    WHEN 19 THEN 'Sơn gel hiệu ứng mắt mèo kim cương hoặc sơn thạch, hot trend thời thượng.'
    WHEN 20 THEN 'Nối móng úp bằng Soft gel tips cao cấp, tạo form chuẩn đẹp bền vững.'
    WHEN 21 THEN 'Vẽ nail art thiết kế theo yêu cầu, nghệ thuật sáng tạo trên từng đầu ngón.'
    WHEN 22 THEN 'Nối mi Volume hoặc mi Katun dày đẹp cuốn hút, phù hợp mọi phong cách.'
    WHEN 23 THEN 'Uốn và định hình lông mày theo dáng Tây hiện đại, giữ nếp tự nhiên.'
    WHEN 24 THEN 'Cấy dưỡng chất tảo xoắn hoặc hồng sâm, làm sáng da từ sâu bên trong.'
    WHEN 25 THEN 'Điện di Vitamin C giúp trắng sáng da, mờ thâm nám hiệu quả sau liệu trình.'
    WHEN 26 THEN 'Triệt lông vĩnh viễn bằng công nghệ Diode Laser, triệt sạch sâu và sáng da.'
    WHEN 27 THEN 'Nhuộm Balayage hoặc Ombre đỉnh cao do nghệ nhân thực hiện, hiệu ứng thượng hạng.'
    WHEN 28 THEN 'Hồi sinh tóc nát và hư tổn nặng bằng liệu trình chuyên sâu phục hồi tức thì.'
    WHEN 29 THEN 'Combo thư giãn hoàng gia: gội dưỡng sinh, massage mặt và đắp mặt nạ nghệ sĩ.'
    WHEN 30 THEN 'Ẩn xà cừ và đính đá khối Swarovski thời thượng, mang đẳng cấp sang chảnh.'
    WHEN 31 THEN 'Ủ nến paraffin hoàng gia giúp mềm mịn da tay chân, cảm giác spa đẳng cấp.'
    WHEN 32 THEN 'Điêu khắc mày Hairstroke từng sợi siêu thực, do nghệ nhân hàng đầu thực hiện.'
    WHEN 33 THEN 'Nghệ nhân khắc từng sợi lông mày tự nhiên, tạo dáng mày hoàn hảo cá nhân hóa.'
    WHEN 34 THEN 'Phun mày chạm hạt Ombre độc quyền, mang lại dáng mày tự nhiên sang trọng.'
    WHEN 35 THEN 'Bắn laser carbon công nghệ cao giúp trẻ hóa da, se khít lỗ chân lông hiệu quả.'
    ELSE description
  END,
  category = CASE id
    WHEN 1 THEN 'Tóc'
    WHEN 2 THEN 'Tóc'
    WHEN 3 THEN 'Gội/Massage'
    WHEN 4 THEN 'Gội/Massage'
    WHEN 5 THEN 'Nail/Móng'
    WHEN 6 THEN 'Nail/Móng'
    WHEN 7 THEN 'Nail/Móng'
    WHEN 8 THEN 'Mi/Mày'
    WHEN 9 THEN 'Mi/Mày'
    WHEN 10 THEN 'Mi/Mày'
    WHEN 11 THEN 'Da mặt'
    WHEN 12 THEN 'Da mặt'
    WHEN 13 THEN 'Khác'
    WHEN 14 THEN 'Tóc'
    WHEN 15 THEN 'Tóc'
    WHEN 16 THEN 'Tóc'
    WHEN 17 THEN 'Gội/Massage'
    WHEN 18 THEN 'Gội/Massage'
    WHEN 19 THEN 'Nail/Móng'
    WHEN 20 THEN 'Nail/Móng'
    WHEN 21 THEN 'Nail/Móng'
    WHEN 22 THEN 'Mi/Mày'
    WHEN 23 THEN 'Mi/Mày'
    WHEN 24 THEN 'Da mặt'
    WHEN 25 THEN 'Da mặt'
    WHEN 26 THEN 'Khác'
    WHEN 27 THEN 'Tóc'
    WHEN 28 THEN 'Tóc'
    WHEN 29 THEN 'Gội/Massage'
    WHEN 30 THEN 'Nail/Móng'
    WHEN 31 THEN 'Nail/Móng'
    WHEN 32 THEN 'Mi/Mày'
    WHEN 33 THEN 'Mi/Mày'
    WHEN 34 THEN 'Mi/Mày'
    WHEN 35 THEN 'Da mặt'
    ELSE category
  END
WHERE id BETWEEN 1 AND 35;

UPDATE services
SET
  name = 'Gội tạo kiểu tóc nhanh',
  description = 'Gội tạo kiểu tóc nhanh cho lịch họp và sự kiện gấp.',
  category = 'Tóc'
WHERE name IN ('Express Blowout', 'Goi tao kieu toc nhanh', 'Gội tạo kiểu tóc nhanh', 'G?i t?o ki?u t?c nhanh');

UPDATE services
SET
  name = 'Cắt tóc tạo kiểu cao cấp',
  description = 'Cắt, chăm sóc và tạo kiểu tóc theo phong cách cá nhân.',
  category = 'Tóc'
WHERE name IN ('Signature Haircut & Styling', 'Cat toc tao kieu cao cap', 'Cắt tóc tạo kiểu cao cấp', 'C?t t?c t?o ki?u cao c?p');

UPDATE services
SET
  name = 'Nhuộm tóc cao cấp',
  description = 'Nhuộm tóc và cân bằng tông màu cao cấp, kèm phục hồi nền tóc.',
  category = 'Tóc'
WHERE name IN ('Premium Hair Color', 'Nhuom toc cao cap', 'Nhuộm tóc cao cấp', 'Nhu?m t?c cao c?p');

UPDATE services
SET
  name = 'Thải độc da đầu thư giãn',
  description = 'Làm sạch sâu da đầu và massage kích thích lưu thông.',
  category = 'Tóc'
WHERE name IN ('Scalp Detox Therapy', 'Thai doc da dau thu gian', 'Thải độc da đầu thư giãn', 'Th?i d?c da d?u th? gi?n');

UPDATE services
SET
  name = 'Sơn gel chăm sóc móng',
  description = 'Làm sạch móng, tạo form và sơn gel bền màu.',
  category = 'Móng'
WHERE name IN ('Gel Manicure', 'Son gel cham soc mong', 'Sơn gel chăm sóc móng', 'S?n gel ch?m s?c m?ng');

UPDATE services
SET
  name = 'Nâng mi và nhuộm mi',
  description = 'Nâng mi và phủ màu tự nhiên theo phong cách boutique.',
  category = 'Mi & Mày'
WHERE name IN ('Lash Lift & Tint', 'Nang mi va nhuom mi', 'Nâng mi và nhuộm mi', 'N?ng mi v? nhu?m mi');

UPDATE services
SET
  name = 'Định hình chân mày',
  description = 'Định hình lông mày, giữ nếp đẹp và gọn gàng.',
  category = 'Mi & Mày'
WHERE name IN ('Brow Lamination', 'Dinh hinh chan may', 'Định hình chân mày', '?inh h?nh ch?n m?y');

UPDATE services
SET
  name = 'Chăm sóc da cấp ẩm chuyên sâu',
  description = 'Dưỡng ẩm sâu, làm dịu da và phục hồi độ căng bóng.',
  category = 'Chăm sóc da'
WHERE name IN ('Hydrating Facial Ritual', 'Cham soc da cap am chuyen sau', 'Chăm sóc da cấp ẩm chuyên sâu', 'Ch?m s?c da c?p ?m chuy?n s?u');

UPDATE services
SET
  name = 'Massage mô sâu thư giãn',
  description = 'Massage mô sâu giảm căng cơ và phục hồi năng lượng.',
  category = 'Massage'
WHERE name IN ('Deep Tissue Massage', 'Massage mo sau thu gian', 'Massage mô sâu thư giãn', 'Massage m? s?u th? gi?n');

UPDATE services
SET
  name = 'Trang điểm thử cô dâu',
  description = 'Trang điểm thử theo concept cho sự kiện cưới.',
  category = 'Trang điểm'
WHERE name IN ('Bridal Makeup Trial', 'Trang diem thu co dau', 'Trang điểm thử cô dâu', 'Trang ?i?m th? c? d?u');

SET @has_appointment_services_table := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.TABLES
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'appointment_services'
);

SET @sql_fix_appointment_service_snapshot := IF(
  @has_appointment_services_table = 1,
  'UPDATE appointment_services aps
   JOIN services s ON s.id = aps.service_id
   SET aps.service_name_snapshot = s.name',
  'SELECT "appointment_services table does not exist"'
);

PREPARE stmt_fix_appointment_service_snapshot FROM @sql_fix_appointment_service_snapshot;
EXECUTE stmt_fix_appointment_service_snapshot;
DEALLOCATE PREPARE stmt_fix_appointment_service_snapshot;
