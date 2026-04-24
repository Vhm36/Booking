# GIAI ĐOẠN 1 - KIỂM TRA AN TOÀN & HỢP LỆ
## Phase 1 Testing Checklist

**Ngày kiểm tra:** 19/03/2026  
**Phiên bản:** 1.0  
**Người kiểm tra:** Developer Team

---

## ✅ 1. INPUT VALIDATION (FIX 1)

Kiểm tra: `POST /api/auth/register` với các input không hợp lệ

- [ ] **Tên rỗng** → Trả lỗi "Tên không được để trống"
- [ ] **Tên < 2 ký tự** → Trả lỗi "Tên phải từ 2 - 100 ký tự"
- [ ] **Email không hợp lệ** → Trả lỗi "Email không hợp lệ"
- [ ] **Password < 6 ký tự** → Trả lỗi "Mật khẩu phải ít nhất 6 ký tự"
- [ ] **Password không chứa số** → Trả lỗi "Mật khẩu phải chứa chữ và số"
- [ ] **Số điện thoại < 10 số** → Trả lỗi "Số điện thoại không hợp lệ"

Kiểm tra: `POST /api/bookings` với các input không hợp lệ

- [ ] **service_id không phải số** → Status 400
- [ ] **appointment_date format sai** → Status 400
- [ ] **appointment_date trong quá khứ** → Status 400
- [ ] **appointment_time format sai** → Status 400
- [ ] **appointment_time ngoài giờ làm** (08:00-18:00) → Status 400

Kiểm tra: `PUT /api/bookings/{id}/review` với rating không hợp lệ

- [ ] **rating > 5** → Status 400
- [ ] **rating < 1** → Status 400
- [ ] **rating không phải số** → Status 400

---

## ✅ 2. JWT SECRET ENVIRONMENT (FIX 2)

- [ ] Kiểm tra `.env.example` có `JWT_SECRET` template
- [ ] Bắt server nếu `JWT_SECRET` không được set trong `.env`
- [ ] JWT token tạo thành công khi có `JWT_SECRET` trong env
- [ ] Token verify thất bại khi thay đổi `JWT_SECRET`

Kiểm tra:
```bash
# Xóa JWT_SECRET từ .env
# npm start → Server crash với message: "JWT_SECRET must be set"
```

---

## ✅ 3. AUTHORIZATION GAPS (FIX 3)

Kiểm tra: Staff chỉ có thể update lịch của mình

**Scenario:** 
- Staff A có lịch hẹn #100 (assigned cho Staff A)
- Staff B cố gắng `PUT /api/bookings/100/status` với status=confirmed

- [ ] Staff B nhận status 403 "Bạn không có quyền cập nhật lịch này"
- [ ] Staff A cập nhật lịch của mình → Status 200 ✓
- [ ] Admin cập nhật lịch của Staff A → Status 200 ✓

Kiểm tra: Customer ko thể access staff/admin endpoints

- [ ] Customer gọi `GET /api/staff` → Status 403 "Không có quyền"
- [ ] Customer gọi `GET /api/customers` → Status 403
- [ ] Customer gọi `GET /api/admin/dashboard/summary` → Status 403

---

## ✅ 4. RACE CONDITION FIX (FIX 4)

Database Constraint: `UNIQUE KEY unique_staff_time_slot (staff_id, appointment_date, appointment_time, status)`

Kiểm tra: Không thể tạo 2 lịch trùng nhau cho cùng nhân viên, ngày, giờ

**Scenario:** 
- Đặt lịch #1: Staff 5, 2026-03-20, 10:00:00 → Status 201 ✓
- Đặt lịch #2: Staff 5, 2026-03-20, 10:00:00 → Status 400 "Nhân viên đã có lịch"

- [ ] Database constraint được add thành công
- [ ] Kiểm tra `SHOW CREATE TABLE appointments` có unique constraint
- [ ] Double booking attempt bị reject
- [ ] Cancelled lịch không block new booking (vì constraint có `status`)

```sql
-- Check quy trình
SELECT * FROM appointments WHERE staff_id=5 AND appointment_date='2026-03-20' AND appointment_time='10:00:00';
-- Không được 2 dòng có status != 'cancelled'
```

---

## ✅ 5. RATE LIMITING & CORS (FIX 5)

Kiểm tra: Rate Limiting

- [ ] `POST /api/auth/login` - Giới hạn 5 lần/15 phút
  - Login 5 lần thất bại → lần 6 nhận status 429 "Quá nhiều lần..."
  
- [ ] `POST /api/bookings` - Giới hạn 10 lần/giờ per user
  - Booking 10 lần → lần 11 nhận status 429

- [ ] `GET /` health check ko bị limit (hoặc limit cao hơn)

Kiểm tra: CORS

- [ ] Request từ `http://localhost:3000` → Nhận response (ALLOWED)
- [ ] Request từ `http://other-origin.com` → CORS error (BLOCKED)

Header response check:
```
Access-Control-Allow-Origin: http://localhost:3000
Access-Control-Allow-Credentials: true
```

---

## ✅ 6. PAYMENT API (FIX 6)

Kiểm tra: Payment Endpoints

### POST /api/payments/create-payment
```json
{
  "appointment_id": 1,
  "payment_method": "momo"
}
```
- [ ] Status 201, trả payment object với `status: "pending"`
- [ ] Payment record được tạo trong DB
- [ ] Appointment ko thể tạo payment 2 lần (hoặc override cũ)

### POST /api/payments/verify-payment
```json
{
  "payment_id": 1,
  "transaction_code": "TXN123456"
}
```
- [ ] Status 200, payment status → "success"
- [ ] Appointment status tự động → "confirmed"
- [ ] User khác ko thể verify payment của người khác (status 403)

### GET /api/payments/:payment_id
- [ ] User chủ appointment nhìn thấy payment
- [ ] User khác ko nhìn thấy (status 403)
- [ ] Admin nhìn thấy bất kỳ payment

---

## ✅ 7. ERROR HANDLING (FIX 7)

Kiểm tra: Error Response không expose stack trace

- [ ] Production: Error response chỉ có `message`, không có `stack`
- [ ] Development: Error response có `stack` để debug
- [ ] HTTP 500 error: message = "Lỗi server", ko show chi tiết
- [ ] HTTP 404: message = "Endpoint không tồn tại"

Response example:
```json
// Prod
{"success": false, "message": "Lỗi server"}

// Dev
{"success": false, "message": "Lỗi server", "stack": "Error at ..."}
```

---

## ✅ 8. DATABASE INDEXES (FIX 8)

Kiểm tra: Indexes được tạo để optimize query

```sql
SHOW INDEX FROM appointments;
SHOW INDEX FROM users;
```

- [ ] Index trên `appointments.user_id`
- [ ] Index trên `appointments.staff_id`
- [ ] Index trên `appointments.service_id`
- [ ] Index trên `appointments.appointment_date`
- [ ] Index trên `users.email`
- [ ] Composite index trên `(staff_id, appointment_date, appointment_time)`

Query performance check:
```sql
-- Trước: ~500ms
-- Sau: <50ms
SELECT * FROM appointments WHERE staff_id=5 AND appointment_date='2026-03-20';
```

---

## ✅ 9. RESPONSE FORMAT (FIX 9)

Kiểm tra: Tất cả response có format cố định

Success response format:
```json
{
  "success": true,
  "message": "...",
  "data": {...}
}
```

Error response format:
```json
{
  "success": false,
  "message": "...",
  "errors": [{
    "field": "email",
    "message": "Email không hợp lệ"
  }]
}
```

- [ ] Login response có `token` và `user`
- [ ] Pagination response có `total`, `page`, `data`
- [ ] List response có `data` array

---

## ✅ 10. ENVIRONMENT VARIABLES (FIX 10)

Kiểm tra: `.env` được setup đúng

- [ ] File `.env.example` tồn tại và complete
- [ ] File `.env` được ignore trong `.gitignore`
- [ ] `README.md` có hướng dẫn setup `.env`

Required variables:
```
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=password
DB_NAME=beautybook
PORT=5000
NODE_ENV=production|development
JWT_SECRET=your_secret_here
FRONTEND_URL=http://localhost:3000
```

---

## 📊 SUMMARY

| Fix | Status | Ghi chú |
|-----|--------|--------|
| 1. Input Validation | [ ] | |
| 2. JWT Secret Env | [ ] | |
| 3. Authorization Gaps | [ ] | |
| 4. Race Condition Fix | [ ] | |
| 5. Rate Limiting + CORS | [ ] | |
| 6. Payment API | [ ] | |
| 7. Error Handling | [ ] | |
| 8. Database Indexes | [ ] | |
| 9. Response Format | [ ] | |
| 10. Environment Setup | [ ] | |

---

## 🚀 DEPLOYMENT CHECKLIST

Trước khi deploy lên production:

- [ ] Tất cả 10 fix được test và pass
- [ ] Database migration applied thành công
- [ ] `.env` production config được setup
- [ ] `NODE_ENV=production` được set
- [ ] `JWT_SECRET` là random string 32+ ký tự
- [ ] FRONTEND_URL trỏ đúng domain production
- [ ] CORS domain chỉ allow production frontend
- [ ] Rate limiting config phù hợp
- [ ] Log file permissions được setup
- [ ] Backup database trước deployment

---

## 📝 NOTES

**Tests chạy:**
- Postman collection: `/tests/phase1-tests.postman_collection.json`
- Unit tests: `npm test -- phase1`
- Load test: `npm run test:load`

**Expected Results:**
- 0 lỗi bảo mật
- 100% validation coverage
- 0 authorization bypass
- 0 race conditions
- <50ms query time (trước 200-500ms)
