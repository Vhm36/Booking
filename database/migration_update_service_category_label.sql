USE booking_system;

-- Chuẩn hóa nhãn cột danh mục dịch vụ có dấu tiếng Việt.
ALTER TABLE services
  MODIFY COLUMN category VARCHAR(100) COMMENT 'Tên danh mục sản phẩm';
