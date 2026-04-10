USE booking_system;
SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Optional demo users (password in this script is plain text for quick local testing only).
-- You should register via API in production.
DELETE FROM users
WHERE email IN (
  'admin@example.com',
  'customer@example.com',
  'staff1@example.com',
  'staff2@example.com',
  'staff3@example.com'
);
INSERT INTO users (name, email, password, phone, role, created_at)
VALUES
  ('Admin Demo', 'admin@example.com', '$2a$10$h8z47WDz93kpQiWT4WtmFu8ML40EhcWp6cqN2SNxcBOCaQPEJGYFu', '0900000000', 'admin', NOW()),
  ('Customer Demo', 'customer@example.com', '$2a$10$c.w5r4w2oUHeEFKlNHN10uBCLM/k0vP3jTqspYkNYvvfCMNkxN2HO', '0911111111', 'customer', NOW()),
  ('Linh Tran', 'staff1@example.com', 'staff123456', '0922222222', 'staff', NOW()),
  ('Quynh Nguyen', 'staff2@example.com', '$2a$10$h8z47WDz93kpQiWT4WtmFu8ML40EhcWp6cqN2SNxcBOCaQPEJGYFu', '0933333333', 'staff', NOW()),
  ('Thao Le', 'staff3@example.com', '$2a$10$h8z47WDz93kpQiWT4WtmFu8ML40EhcWp6cqN2SNxcBOCaQPEJGYFu', '0944444444', 'staff', NOW());

-- Seed dịch vụ tiếng Việt có dấu.
DELETE FROM services
WHERE name IN (
  'Express Blowout',
  'Signature Haircut & Styling',
  'Premium Hair Color',
  'Scalp Detox Therapy',
  'Gel Manicure',
  'Lash Lift & Tint',
  'Brow Lamination',
  'Hydrating Facial Ritual',
  'Deep Tissue Massage',
  'Bridal Makeup Trial',
  'Gội tạo kiểu tóc nhanh',
  'Cắt tóc tạo kiểu cao cấp',
  'Nhuộm tóc cao cấp',
  'Thải độc da đầu thư giãn',
  'Sơn gel chăm sóc móng',
  'Nâng mi và nhuộm mi',
  'Định hình chân mày',
  'Chăm sóc da cấp ẩm chuyên sâu',
  'Massage mô sâu thư giãn',
  'Trang điểm thử cô dâu'
);

INSERT INTO services (name, price, duration, description, category, image_url, status, created_at)
VALUES
  (
    'Gội tạo kiểu tóc nhanh',
    280000,
    30,
    'Gội tạo kiểu tóc nhanh cho lịch họp và sự kiện gấp.',
    'Tóc',
    'https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?auto=format&fit=crop&w=1200&q=80',
    'active',
    NOW()
  ),
  (
    'Cắt tóc tạo kiểu cao cấp',
    450000,
    60,
    'Cắt, chăm sóc và tạo kiểu tóc theo phong cách cá nhân.',
    'Tóc',
    'https://images.unsplash.com/photo-1522337660859-02fbefca4702?auto=format&fit=crop&w=1200&q=80',
    'active',
    NOW()
  ),
  (
    'Nhuộm tóc cao cấp',
    950000,
    120,
    'Nhuộm tóc và cân bằng tông màu cao cấp, kèm phục hồi nền tóc.',
    'Tóc',
    'https://images.unsplash.com/photo-1487412912498-0447578fcca8?auto=format&fit=crop&w=1200&q=80',
    'active',
    NOW()
  ),
  (
    'Thải độc da đầu thư giãn',
    560000,
    60,
    'Làm sạch sâu da đầu và massage kích thích lưu thông.',
    'Tóc',
    'https://images.unsplash.com/photo-1500840216050-6ffa99d75160?auto=format&fit=crop&w=1200&q=80',
    'active',
    NOW()
  ),
  (
    'Sơn gel chăm sóc móng',
    320000,
    45,
    'Làm sạch móng, tạo form và sơn gel bền màu.',
    'Móng',
    'https://images.unsplash.com/photo-1604654894610-df63bc536371?auto=format&fit=crop&w=1200&q=80',
    'active',
    NOW()
  ),
  (
    'Nâng mi và nhuộm mi',
    520000,
    75,
    'Nâng mi và phủ màu tự nhiên theo phong cách boutique.',
    'Mi & Mày',
    'https://images.unsplash.com/photo-1512496015851-a90fb38ba796?auto=format&fit=crop&w=1200&q=80',
    'active',
    NOW()
  ),
  (
    'Định hình chân mày',
    480000,
    60,
    'Định hình lông mày, giữ nếp đẹp và gọn gàng.',
    'Mi & Mày',
    'https://images.unsplash.com/photo-1620331311520-246422fd82f9?auto=format&fit=crop&w=1200&q=80',
    'active',
    NOW()
  ),
  (
    'Chăm sóc da cấp ẩm chuyên sâu',
    680000,
    75,
    'Dưỡng ẩm sâu, làm dịu da và phục hồi độ căng bóng.',
    'Chăm sóc da',
    'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?auto=format&fit=crop&w=1200&q=80',
    'active',
    NOW()
  ),
  (
    'Massage mô sâu thư giãn',
    750000,
    90,
    'Massage mô sâu giảm căng cơ và phục hồi năng lượng.',
    'Massage',
    'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=1200&q=80',
    'active',
    NOW()
  ),
  (
    'Trang điểm thử cô dâu',
    1200000,
    120,
    'Trang điểm thử theo concept cho sự kiện cưới.',
    'Trang điểm',
    'https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?auto=format&fit=crop&w=1200&q=80',
    'active',
    NOW()
  );
