USE booking_system;

-- Chuẩn hóa tên + mô tả + danh mục dịch vụ sang tiếng Việt có dấu.
UPDATE services
SET
  name = 'Gội tạo kiểu tóc nhanh',
  description = 'Gội tạo kiểu tóc nhanh cho lịch họp và sự kiện gấp.',
  category = 'Tóc'
WHERE name IN ('Express Blowout', 'Goi tao kieu toc nhanh', 'Gội tạo kiểu tóc nhanh');

UPDATE services
SET
  name = 'Cắt tóc tạo kiểu cao cấp',
  description = 'Cắt, chăm sóc và tạo kiểu tóc theo phong cách cá nhân.',
  category = 'Tóc'
WHERE name IN ('Signature Haircut & Styling', 'Cat toc tao kieu cao cap', 'Cắt tóc tạo kiểu cao cấp');

UPDATE services
SET
  name = 'Nhuộm tóc cao cấp',
  description = 'Nhuộm tóc và cân bằng tông màu cao cấp, kèm phục hồi nền tóc.',
  category = 'Tóc'
WHERE name IN ('Premium Hair Color', 'Nhuom toc cao cap', 'Nhuộm tóc cao cấp');

UPDATE services
SET
  name = 'Thải độc da đầu thư giãn',
  description = 'Làm sạch sâu da đầu và massage kích thích lưu thông.',
  category = 'Tóc'
WHERE name IN ('Scalp Detox Therapy', 'Thai doc da dau thu gian', 'Thải độc da đầu thư giãn');

UPDATE services
SET
  name = 'Sơn gel chăm sóc móng',
  description = 'Làm sạch móng, tạo form và sơn gel bền màu.',
  category = 'Móng'
WHERE name IN ('Gel Manicure', 'Son gel cham soc mong', 'Sơn gel chăm sóc móng');

UPDATE services
SET
  name = 'Nâng mi và nhuộm mi',
  description = 'Nâng mi và phủ màu tự nhiên theo phong cách boutique.',
  category = 'Mi & Mày'
WHERE name IN ('Lash Lift & Tint', 'Nang mi va nhuom mi', 'Nâng mi và nhuộm mi');

UPDATE services
SET
  name = 'Định hình chân mày',
  description = 'Định hình lông mày, giữ nếp đẹp và gọn gàng.',
  category = 'Mi & Mày'
WHERE name IN ('Brow Lamination', 'Dinh hinh chan may', 'Định hình chân mày');

UPDATE services
SET
  name = 'Chăm sóc da cấp ẩm chuyên sâu',
  description = 'Dưỡng ẩm sâu, làm dịu da và phục hồi độ căng bóng.',
  category = 'Chăm sóc da'
WHERE name IN ('Hydrating Facial Ritual', 'Cham soc da cap am chuyen sau', 'Chăm sóc da cấp ẩm chuyên sâu');

UPDATE services
SET
  name = 'Massage mô sâu thư giãn',
  description = 'Massage mô sâu giảm căng cơ và phục hồi năng lượng.',
  category = 'Massage'
WHERE name IN ('Deep Tissue Massage', 'Massage mo sau thu gian', 'Massage mô sâu thư giãn');

UPDATE services
SET
  name = 'Trang điểm thử cô dâu',
  description = 'Trang điểm thử theo concept cho sự kiện cưới.',
  category = 'Trang điểm'
WHERE name IN ('Bridal Makeup Trial', 'Trang diem thu co dau', 'Trang điểm thử cô dâu');
