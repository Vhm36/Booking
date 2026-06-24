# Cơ Sở Dữ Liệu

Database: `booking_system`

Charset/collation:

```sql
utf8mb4
utf8mb4_unicode_ci
```

## 1. File DB chính

- `database/recreate_booking_system.sql`: tạo lại DB từ đầu.
- `database/migration_add_voucher_system.sql`: thêm hệ thống voucher.
- `database/migration_smart_booking_features.sql`: thêm reminder, sentiment, RFM, cancellation risk, deposit.

## 2. Bảng người dùng

### `users`

Cột quan trọng:

- `id`
- `name`
- `email`
- `password`
- `phone`
- `role`: `customer`, `admin`, `staff`
- `staff_role_id`
- `is_active`
- `customer_segment`
- `rfm_score`
- `rfm_recency_score`
- `rfm_frequency_score`
- `rfm_monetary_score`
- `rfm_updated_at`
- `date_of_birth`
- `cancellation_count`
- `cancellation_rate` (`0` - `100`, phần trăm lịch hủy của user)
- `noshow_count`
- `created_at`

Dùng cho:

- Đăng nhập/đăng ký.
- Phân quyền.
- RFM segmentation.
- Cancellation scoring.

### `staff_role`

Quản lý vai trò nhân viên:

- Thu ngân.
- Nhân viên dịch vụ.
- Các role staff khác nếu mở rộng.

## 3. Bảng dịch vụ

### `services`

Cột quan trọng:

- `id`
- `name`
- `price`
- `duration`
- `description`
- `category`
- `image_url`
- `status`

### `service_category`

Lưu danh mục dịch vụ.

## 4. Bảng lịch hẹn

### `appointments`

Cột nghiệp vụ:

- `user_id`
- `service_id`
- `staff_id`
- `appointment_date`
- `appointment_time`
- `end_time`
- `status`: `pending`, `confirmed`, `completed`, `cancelled`
- `cancellation_requested`
- `cancellation_requested_at`
- `notes`
- `total_amount`
- `original_amount`
- `voucher_discount`
- `voucher_codes`

Cột Smart Booking:

- `reminder_sent`
- `reminder_sent_at`
- `cancellation_score`
- `cancellation_risk`: `low`, `medium`, `high`
- `deposit_required`
- `deposit_amount`

Cột review:

- `staff_rating`
- `staff_review`
- `reviewed_at`

### `appointment_services`

Hỗ trợ một lịch có nhiều dịch vụ.

Cột quan trọng:

- `appointment_id`
- `service_id`
- `sort_order`
- `price_snapshot`
- `duration_snapshot`
- `service_name_snapshot`

## 5. Bảng thanh toán

### `payments`

Quản lý payment record cho lịch hẹn.

Cột thường dùng:

- `appointment_id`
- `amount`
- `payment_method`: `cash`, `vnpay`, `vietqr`
- `payment_status`: `pending`, `paid`, `failed`
- `payment_reference`
- `transaction_code`
- `bank_code`
- `gateway_response_code`
- `gateway_transaction_status`
- `payment_url_expires_at`
- `paid_at`

Logic đặt cọc:

- Nếu `appointments.deposit_required = 1`, backend tạo payment với `amount = deposit_amount`.
- Nếu khách chọn `cash` khi cần cọc, backend trả lời lỗi.

## 6. Bảng voucher

### `vouchers`

Cột quan trọng:

- `code`
- `voucher_type`: `fixed`, `percentage`, `free_delivery`
- `discount_amount`
- `discount_percent`
- `min_order_value`
- `max_discount_amount`
- `customer_type`: `regular`, `vip`, `both`
- `expiry_date`
- `max_usage_global`
- `current_usage`
- `status`

### `voucher_assignments`

Gan voucher cho tung khach, dong thoi luu trang thai su dung va metadata goi y.

- `voucher_id`
- `user_id`
- `max_usage_customer`
- `usage_count`
- `last_used_date`
- `is_used`
- `status`
- `source`: `admin`, `system`, `bot`
- `reason`
- `confidence_score`
- `shown_date`
- `clicked`
- `applied`
- `last_appointment_id`
- `last_discount_applied`
- `total_discount_applied`

## 7. Bảng chatbot

### `chat_conversations`

- `user_id`
- `status`: `open`, `closed`, `escalated`
- `assigned_staff_id`
- `subject`

### `chat_messages`

- `conversation_id`
- `sender_type`: `customer`, `bot`, `staff`
- `sender_id`
- `message_text`
- `message_type`
- `metadata`
- `sentiment`
- `escalated`
- `is_read`

## 8. Bảng lịch làm việc nhân viên

### `staff_weekly_availability`

Dùng để kiểm tra nhân viên có làm trong khung giờ đặt lịch hay không.

Cột quan trọng:

- `staff_id`
- `day_of_week`
- `start_time`
- `end_time`
- `is_available`

Quy ước:

- `day_of_week = 0`: Thứ 2.
- `day_of_week = 6`: Chủ nhật.
- Backend dùng `WEEKDAY(date)` để so khớp.

## 9. Quan hệ chính

```text
users 1-n appointments
services 1-n appointments
users(staff) 1-n appointments
appointments 1-n appointment_services
appointments 1-n payments
users(customer) 1-n voucher_assignments
vouchers 1-n voucher_assignments
chat_conversations 1-n chat_messages
```

## 10. Index quan trọng

- `idx_users_customer_segment`
- `idx_appointments_staff_slot`
- `idx_appointments_reminder`
- `idx_appointments_cancellation_risk`
- `idx_vouchers_code`
- `idx_voucher_assignments_user`
- `idx_chat_messages_conversation`
