# Mo ta bang CSDL

Nguon schema tham chieu chinh: [database/booking_new.sql](/d:/Doantotnghiep/Code/database/booking_new.sql:7)

## 1. Ban dep theo format bao cao

### Bang: `staff_role` (Vai tro nhan vien)

| Ten cot | Kieu du lieu | Mo ta |
|---|---|---|
| id | INT | Khoa chinh |
| role_name | VARCHAR(100) | Ten vai tro |

### Bang: `users` (Nguoi dung)

| Ten cot | Kieu du lieu | Mo ta |
|---|---|---|
| id | INT | Khoa chinh |
| name | VARCHAR(100) | Ho ten |
| email | VARCHAR(100) | Email |
| password | VARCHAR(255) | Mat khau |
| phone | VARCHAR(20) | So dien thoai |
| role | ENUM('customer','admin','staff') | Vai tro |
| staff_role_id | INT | Khoa ngoai |
| is_active | TINYINT(1) | Trang thai |
| created_at | TIMESTAMP | Ngay tao |

### Bang: `services` (Dich vu)

| Ten cot | Kieu du lieu | Mo ta |
|---|---|---|
| id | INT | Khoa chinh |
| name | VARCHAR(100) | Ten dich vu |
| price | DECIMAL(10,2) | Gia |
| duration | INT | Thoi gian |
| description | TEXT | Mo ta |
| category | VARCHAR(100) | Danh muc |
| image_url | VARCHAR(512) | Anh dich vu |
| status | ENUM('active','inactive') | Trang thai |
| created_at | TIMESTAMP | Ngay tao |

### Bang: `service_category` (Danh muc dich vu)

| Ten cot | Kieu du lieu | Mo ta |
|---|---|---|
| id | INT | Khoa chinh |
| category_name | VARCHAR(100) | Ten danh muc |
| created_at | TIMESTAMP | Ngay tao |

### Bang: `appointments` (Lich hen)

| Ten cot | Kieu du lieu | Mo ta |
|---|---|---|
| id | INT | Khoa chinh |
| user_id | INT | Khoa ngoai |
| service_id | INT | Khoa ngoai |
| staff_id | INT | Khoa ngoai |
| appointment_date | DATE | Ngay hen |
| appointment_time | TIME | Gio hen |
| end_time | TIME | Gio ket thuc |
| status | ENUM('pending','confirmed','completed','cancelled') | Trang thai |
| cancellation_requested | TINYINT(1) | Yeu cau huy |
| cancellation_requested_at | DATETIME | Thoi diem yeu cau huy |
| notes | TEXT | Ghi chu |
| total_amount | DECIMAL(10,2) | Tong tien |
| staff_rating | TINYINT UNSIGNED | Danh gia nhan vien |
| staff_review | TEXT | Nhan xet |
| reviewed_at | TIMESTAMP | Ngay danh gia |
| created_at | TIMESTAMP | Ngay tao |

### Bang: `appointment_services` (Chi tiet dich vu trong lich hen)

| Ten cot | Kieu du lieu | Mo ta |
|---|---|---|
| id | INT | Khoa chinh |
| appointment_id | INT | Khoa ngoai |
| service_id | INT | Khoa ngoai |
| sort_order | INT | Thu tu |
| price_snapshot | DECIMAL(10,2) | Gia tai thoi diem dat |
| duration_snapshot | INT | Thoi gian tai thoi diem dat |
| service_name_snapshot | VARCHAR(100) | Ten dich vu tai thoi diem dat |
| created_at | TIMESTAMP | Ngay tao |

### Bang: `payments` (Thanh toan)

| Ten cot | Kieu du lieu | Mo ta |
|---|---|---|
| id | INT | Khoa chinh |
| appointment_id | INT | Khoa ngoai |
| amount | DECIMAL(10,2) | So tien |
| payment_method | ENUM('cash','banking','momo','vnpay','vietqr') | Phuong thuc |
| payment_status | ENUM('pending','paid','failed') | Trang thai |
| payment_reference | VARCHAR(100) | Ma tham chieu |
| transaction_code | VARCHAR(255) | Ma giao dich |
| bank_code | VARCHAR(50) | Ma ngan hang |
| bank_transaction_no | VARCHAR(100) | Ma giao dich ngan hang |
| gateway_response_code | VARCHAR(10) | Ma phan hoi |
| gateway_transaction_status | VARCHAR(10) | Trang thai cong thanh toan |
| payment_url_expires_at | DATETIME | Han thanh toan |
| gateway_payload | TEXT | Du lieu cong thanh toan |
| created_at | TIMESTAMP | Ngay tao |
| paid_at | TIMESTAMP | Ngay thanh toan |

### Bang: `staff_weekly_availability` (Lich lam viec tuan)

| Ten cot | Kieu du lieu | Mo ta |
|---|---|---|
| id | INT | Khoa chinh |
| staff_id | INT | Khoa ngoai |
| day_of_week | TINYINT | Thu trong tuan |
| start_time | TIME | Gio bat dau |
| end_time | TIME | Gio ket thuc |

## 3. Ban day du: khoa ngoai va rang buoc

### `staff_role`

- Khoa chinh: `id`
- Rang buoc `UNIQUE`: `role_name`

### `users`

- Khoa chinh: `id`
- Khoa ngoai: `staff_role_id` -> `staff_role.id`
- Rang buoc `UNIQUE`: `email`
- Gia tri mac dinh:
  `role` = `'customer'`
  `is_active` = `1`
  `created_at` = `CURRENT_TIMESTAMP`
- Chi muc:
  `idx_users_staff_role_id (staff_role_id)`

### `services`

- Khoa chinh: `id`
- Gia tri mac dinh:
  `status` = `'active'`
  `created_at` = `CURRENT_TIMESTAMP`

### `service_category`

- Khoa chinh: `id`
- Rang buoc `UNIQUE`: `category_name`
- Gia tri mac dinh:
  `created_at` = `CURRENT_TIMESTAMP`

### `appointments`

- Khoa chinh: `id`
- Khoa ngoai:
  `user_id` -> `users.id`
  `service_id` -> `services.id`
  `staff_id` -> `users.id`
- Gia tri mac dinh:
  `status` = `'pending'`
  `cancellation_requested` = `0`
  `created_at` = `CURRENT_TIMESTAMP`
- Chi muc:
  `idx_appointments_staff_slot (staff_id, appointment_date, appointment_time, status)`

### `appointment_services`

- Khoa chinh: `id`
- Khoa ngoai:
  `appointment_id` -> `appointments.id`
  `service_id` -> `services.id`
- Rang buoc `UNIQUE`:
  `uniq_appointment_service_order (appointment_id, sort_order)`
- Quy tac xoa:
  `appointment_id` co `ON DELETE CASCADE`
- Gia tri mac dinh:
  `sort_order` = `0`
  `created_at` = `CURRENT_TIMESTAMP`
- Chi muc:
  `idx_appointment_services_appointment (appointment_id)`
  `idx_appointment_services_service (service_id)`

### `payments`

- Khoa chinh: `id`
- Khoa ngoai:
  `appointment_id` -> `appointments.id`
- Rang buoc `UNIQUE`:
  `payment_reference`
- Gia tri mac dinh:
  `payment_method` = `'cash'`
  `payment_status` = `'pending'`
  `created_at` = `CURRENT_TIMESTAMP`

### `staff_weekly_availability`

- Khoa chinh: `id`
- Khoa ngoai:
  `staff_id` -> `users.id`
- Quy tac xoa:
  `staff_id` co `ON DELETE CASCADE`
- Chi muc:
  `idx_staff_week (staff_id, day_of_week)`

