USE booking_system;
SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;

UPDATE users
SET name = CASE email
  WHEN 'khachhang@beautybook.com' THEN 'Khách Hàng'
  WHEN 'customer@example.com' THEN 'Khách hàng Demo'
  WHEN 'mai.tran@gmail.com' THEN 'Trần Thị Mai'
  WHEN 'hanh.nguyen@gmail.com' THEN 'Nguyễn Hồng Hạnh'
  WHEN 'dung.le@gmail.com' THEN 'Lê Thùy Dung'
  WHEN 'ha.pham@gmail.com' THEN 'Phạm Thanh Hà'
  WHEN 'chau.vu@gmail.com' THEN 'Vũ Minh Châu'
  WHEN 'quynhanh.do@gmail.com' THEN 'Đỗ Quỳnh Anh'
  WHEN 'yennhi.hoang@gmail.com' THEN 'Hoàng Yến Nhi'
  WHEN 'tuongvi.bui@gmail.com' THEN 'Bùi Tường Vi'
  WHEN 'ngoclan.dinh@gmail.com' THEN 'Đinh Ngọc Lan'
  WHEN 'khanhlinh.trinh@gmail.com' THEN 'Trịnh Khánh Linh'
  WHEN 'thuhuong.ly@gmail.com' THEN 'Lý Thu Hương'
  WHEN 'phuongthao.ngo@gmail.com' THEN 'Ngô Phương Thảo'
  WHEN 'thanhtruc.duong@gmail.com' THEN 'Dương Thanh Trúc'
  WHEN 'myduyen.to@gmail.com' THEN 'Tô Mỹ Duyên'
  WHEN 'bichngoc.cao@gmail.com' THEN 'Cao Bích Ngọc'
  ELSE name
END
WHERE role = 'customer'
  AND email IN (
    'khachhang@beautybook.com',
    'customer@example.com',
    'mai.tran@gmail.com',
    'hanh.nguyen@gmail.com',
    'dung.le@gmail.com',
    'ha.pham@gmail.com',
    'chau.vu@gmail.com',
    'quynhanh.do@gmail.com',
    'yennhi.hoang@gmail.com',
    'tuongvi.bui@gmail.com',
    'ngoclan.dinh@gmail.com',
    'khanhlinh.trinh@gmail.com',
    'thuhuong.ly@gmail.com',
    'phuongthao.ngo@gmail.com',
    'thanhtruc.duong@gmail.com',
    'myduyen.to@gmail.com',
    'bichngoc.cao@gmail.com'
  );
