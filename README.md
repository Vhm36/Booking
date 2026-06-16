# Smart Booking Salon - Hệ Thống Đặt Lịch Làm Đẹp Thông Minh

Ứng dụng web fullstack hỗ trợ đặt lịch dịch vụ làm đẹp, quản lý vận hành salon, thanh toán, voucher, chatbot AI và phân tích khách hàng.

- `backend`: Node.js, Express, MySQL, JWT, Socket.io
- `frontend`: React 18, React Router v6, Axios, Chart.js, PWA
- `database`: schema, seed data và các migration MySQL
- `ml-analysis`: phân tích dữ liệu khách hàng và RFM
- `docs`: tài liệu tổng quan, kiến trúc, tính năng và quy trình làm việc

**Phiên bản tài liệu:** `3.0.0`<br>
**Cập nhật lần cuối:** `2026-06-16`

## Tổng Quan

Hệ thống được xây dựng cho bài toán đặt lịch salon/spa với các mục tiêu chính:

- Cho phép khách hàng xem dịch vụ, đặt lịch, quản lý lịch hẹn và voucher cá nhân.
- Hỗ trợ admin quản lý dịch vụ, nhân viên, lịch hẹn, khách hàng, voucher và dashboard thống kê.
- Hỗ trợ nhân viên theo dõi lịch được phân công, đăng ký ca làm và gửi yêu cầu nghỉ/hủy lịch.
- Tích hợp thanh toán tiền mặt, chuyển khoản VietQR và cổng thanh toán VNPAY.
- Sử dụng chatbot AI để tư vấn dịch vụ, gợi ý lịch trống và hỗ trợ tạo booking.
- Phân tích hành vi khách hàng bằng RFM/DEC, gợi ý chiến lược chăm sóc và marketing voucher.

## Tính Năng Chính

### Khách Hàng

- Đăng ký, đăng nhập, đăng nhập Google/Zalo và khôi phục mật khẩu.
- Xem danh sách dịch vụ, chi tiết dịch vụ, dịch vụ nổi bật và gợi ý dịch vụ.
- Đặt lịch theo một hoặc nhiều dịch vụ, ngày, giờ, nhân viên và voucher.
- Xem lịch hẹn của tôi, hủy lịch và gửi đánh giá nhân viên.
- Quản lý hồ sơ cá nhân, ảnh đại diện, ngày sinh và thông tin liên hệ.
- Xem voucher của tôi và áp dụng voucher khi đặt lịch.
- Theo dõi hóa đơn, kết quả thanh toán và xác nhận chuyển khoản.
- Sử dụng giao diện mobile/PWA với bottom navigation.

### Admin

- Dashboard tổng quan và dashboard realtime bằng Socket.io.
- Quản lý dịch vụ, danh mục dịch vụ, hình ảnh và giá dịch vụ.
- Quản lý lịch hẹn, trạng thái lịch, yêu cầu hủy lịch và thanh toán.
- Quản lý nhân viên, vai trò nhân viên, lịch làm việc và lịch nghỉ.
- Quản lý khách hàng, admin user và dữ liệu hồ sơ.
- Quản lý voucher, gán voucher cho khách hàng và xem thống kê voucher.
- Xem báo cáo doanh thu, booking theo tháng, dịch vụ phổ biến, tần suất khách hàng và tỷ lệ hủy.
- Phân tích RFM/DEC, xem cụm khách hàng và xuất Excel cho chiến lược chăm sóc.

### Nhân Viên Và Thu Ngân

- Đăng nhập bằng tài khoản staff.
- Xem dashboard lịch hẹn được phân công.
- Đăng ký lịch làm việc theo tuần.
- Gửi yêu cầu nghỉ phép và theo dõi trạng thái duyệt.
- Thu ngân/quyền vận hành có thể xử lý lịch hẹn và xác nhận thanh toán chuyển khoản.

### Hệ Thống Thông Minh

- Tính điểm rủi ro hủy/no-show trước khi tạo booking.
- Yêu cầu đặt cọc với khách hàng có rủi ro cao.
- Gửi email nhắc lịch hẹn trước giờ hẹn.
- Tự động phân nhóm khách hàng và gán voucher sinh nhật/marketing.
- Chatbot AI có thể trả lời FAQ, gợi ý dịch vụ, kiểm tra lịch trống và tạo booking.

## Cấu Trúc Dự Án

```text
.
|-- backend/
|   |-- src/
|   |   |-- config/
|   |   |-- controllers/
|   |   |-- jobs/
|   |   |-- middleware/
|   |   |-- models/
|   |   |-- routes/
|   |   |-- services/
|   |   |-- templates/
|   |   `-- utils/
|   |-- scripts/
|   |-- tools/
|   `-- package.json
|-- frontend/
|   |-- public/
|   |-- src/
|   |   |-- components/
|   |   |-- pages/
|   |   |-- services/
|   |   `-- utils/
|   `-- package.json
|-- database/
|   |-- recreate_booking_system.sql
|   |-- seed_new.sql
|   `-- migration_*.sql
|-- docs/
|-- ml-analysis/
`-- references/
```

## Yêu Cầu Môi Trường

- Node.js và npm
- MySQL
- Python 3 nếu chạy phần `ml-analysis`
- SMTP/VNPAY/VietQR/OpenAI là các cấu hình tùy chọn

## Cài Đặt Nhanh

### 1. Database

Tạo lại database từ file tổng hợp:

```bash
mysql -u root -p < database/recreate_booking_system.sql
```

Nếu cần bổ sung dữ liệu hoặc nâng cấp schema, chạy các migration trong `database/`, ví dụ:

```bash
mysql -u root -p booking_system < database/migration_smart_booking_features.sql
mysql -u root -p booking_system < database/migration_consolidate_voucher_tables.sql
mysql -u root -p booking_system < database/migration_phase5_leave_requests.sql
```

### 2. Backend

```bash
cd backend
npm install
npm start
```

Tạo file `backend/.env`:

```env
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=booking_system
JWT_SECRET=your_secret_key
PORT=5000
FRONTEND_URL=http://localhost:3000
```

Biến tùy chọn:

```env
GOOGLE_CLIENT_ID=

ZALO_APP_ID=
ZALO_APP_SECRET=
ZALO_REDIRECT_URI=http://localhost:3000/auth/zalo-callback

OPENAI_API_KEY=
OPENAI_MODEL=gpt-4.1-mini

SMTP_SERVICE=gmail
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM="BeautyBook <your@email.com>"

VNPAY_TMN_CODE=
VNPAY_HASH_SECRET=

VIETQR_ACCOUNT_NO=
VIETQR_ACCOUNT_NAME=
VIETQR_BANK_BIN=
```

Backend mặc định chạy tại:

```text
http://localhost:5000
```

### 3. Frontend

```bash
cd frontend
npm install
npm start
```

Nếu cần đổi API backend, tạo file `frontend/.env`:

```env
REACT_APP_API_URL=http://127.0.0.1:5000/api
REACT_APP_GOOGLE_CLIENT_ID=
REACT_APP_ZALO_APP_ID=
REACT_APP_ZALO_CALLBACK_URL=http://localhost:3000/auth/zalo-callback
```

Frontend mặc định chạy tại:

```text
http://localhost:3000
```

## Tài Khoản Demo

- Admin: `admin@beautybook.com` / `Beauty123`
- Thu ngân: `thungan@beautybook.com` / `Beauty123`
- Nhân viên: `nhanvien@beautybook.com` / `Beauty123`
- Khách hàng: `khachhang@beautybook.com` / `Beauty123`

## API Chính

### Auth

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/google-login`
- `POST /api/auth/zalo-login`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`
- `GET /api/auth/profile`
- `PUT /api/auth/profile`
- `POST /api/auth/avatar`

### Services

- `GET /api/services`
- `GET /api/services/:id`
- `GET /api/services/categories`
- `GET /api/services/trending`
- `GET /api/services/recommendations`
- `GET /api/services/admin/all`
- `POST /api/services`
- `PUT /api/services/:id`
- `PUT /api/services/:id/price`
- `DELETE /api/services/:id`

### Bookings

- `POST /api/bookings`
- `GET /api/bookings/my-bookings`
- `GET /api/bookings`
- `GET /api/bookings/:id`
- `PUT /api/bookings/:id/status`
- `PUT /api/bookings/:id/cancel`
- `PUT /api/bookings/:id/request-cancel`
- `PUT /api/bookings/:id/confirm-cancel`
- `PUT /api/bookings/:id/reject-cancel`
- `PUT /api/bookings/:id/review`
- `POST /api/cancellation-score`

### Payments

- `GET /api/payments/options`
- `POST /api/payments/create-payment`
- `POST /api/payments/verify-payment`
- `GET /api/payments/:payment_id`
- `PUT /api/payments/:payment_id/confirm-transfer`
- `GET /api/payments/vnpay-return`
- `GET /api/payments/vnpay-ipn`

### Staff

- `GET /api/staff/bookable`
- `GET /api/staff/available`
- `GET /api/staff/:id/busy-slots`
- `GET /api/staff/roles`
- `POST /api/staff/roles`
- `GET /api/staff/me/weekly-availability`
- `PUT /api/staff/me/weekly-availability`
- `POST /api/staff/me/start-work`
- `POST /api/staff/leave-request`
- `GET /api/staff/my-leave-requests`
- `GET /api/staff/leave-requests`
- `PUT /api/staff/leave-requests/:id/status`
- `GET /api/staff`
- `POST /api/staff`
- `PUT /api/staff/:id`

### Customers, Vouchers Và Chatbot

- `GET /api/customers`
- `POST /api/customers`
- `PUT /api/customers/:id`
- `DELETE /api/customers/:id`
- `POST /api/customers/:id/send-voucher-email`
- `GET /api/vouchers/my-vouchers`
- `POST /api/vouchers/validate`
- `GET /api/vouchers/analytics`
- `GET /api/vouchers`
- `POST /api/vouchers`
- `PUT /api/vouchers/:id`
- `DELETE /api/vouchers/:id`
- `POST /api/vouchers/:id/assign`
- `POST /api/chat/conversations`
- `POST /api/chat/conversations/:conversationId/messages`
- `POST /api/chat/conversations/:conversationId/chat-bot`
- `GET /api/chat/suggestions`
- `GET /api/chat/faq/search`

### Dashboard Và Phân Tích

- `GET /api/admin/dashboard/summary`
- `GET /api/admin/dashboard/overview`
- `GET /api/admin/dashboard/bookings-by-month`
- `GET /api/admin/dashboard/top-services`
- `GET /api/admin/dashboard/customer-frequency`
- `GET /api/admin/dashboard/appointment-status`
- `GET /api/admin/dashboard/revenue-by-month`
- `GET /api/admin/dashboard/cancellation-rate`
- `GET /api/admin/dashboard/customer-behavior-bot`
- `GET /api/admin/dashboard/dec-clustering`
- `GET /api/admin/dashboard/staff-commission-by-month`
- `POST /api/admin/rfm/run`
- `GET /api/admin/rfm/stats`

## Công Nghệ Sử Dụng

### Frontend

- React 18
- React Router v6
- Axios
- Chart.js và react-chartjs-2
- Socket.io client
- XLSX
- PWA manifest và service worker

### Backend

- Node.js
- Express.js
- MySQL/mysql2
- JWT và bcryptjs
- Socket.io
- Nodemailer
- Node-cron
- Multer
- Express validator và rate limit

### Data Analysis

- Python
- Pandas
- NumPy
- RFM và DEC clustering

## Tài Liệu Liên Quan

- `docs/tongquan.md`: tổng quan dự án và trạng thái hiện tại.
- `docs/tinhnang.md`: danh sách tính năng theo vai trò.
- `docs/kientruc.md`: kiến trúc frontend, backend, database, realtime và AI.
- `docs/cosodulieu.md`: bảng dữ liệu, quan hệ và migration.
- `docs/lamviec.md`: cách chạy local, biến môi trường và lỗi thường gặp.
- `docs/voucher/`: tài liệu hệ thống voucher.
- `docs/chatbot/`: tài liệu chatbot và tích hợp AI.

## Ghi Chú

- Backend sử dụng JWT để xác thực và phân quyền theo `admin`, `staff`, `customer`.
- Frontend lưu token trong auth storage và tự động đăng xuất khi token hết hạn.
- Socket.io được dùng cho dashboard realtime và trạng thái online.
- Cron job chạy nhắc lịch, phân cụm khách hàng và tự động voucher sinh nhật/marketing.
- Các file migration mới nằm trong `database/`; khi đổi schema nên tạo migration mới thay vì sửa trực tiếp file cũ.
