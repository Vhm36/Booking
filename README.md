# Booking - Hệ Thống Đặt Lịch Dịch Vụ Làm Đẹp

Ứng dụng web đặt lịch dịch vụ làm đẹp theo mô hình fullstack:
- `backend`: Node.js + Express + MySQL
- `frontend`: React
- `ml-analysis`: phân tích dữ liệu khách hàng (RFM)

**Phiên bản:** `1.0.0`  
**Cập nhật lần cuối:** `2026-03-18`

## Chức Năng Chính

### Khách hàng
- Đăng ký, đăng nhập
- Xem danh sách dịch vụ
- Đặt lịch theo dịch vụ, ngày, giờ và nhân viên
- Xem hoặc hủy lịch hẹn của mình
- Cập nhật hồ sơ cá nhân

### Quản trị viên
- Dashboard thống kê
- Quản lý dịch vụ
- Quản lý lịch hẹn
- Quản lý nhân viên
- Xem phân tích doanh thu, tỷ lệ hủy, dịch vụ phổ biến

## Cấu Trúc Dự Án

```text
.
├── backend/
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── models/
│   │   └── routes/
│   └── package.json
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/
│   │   └── utils/
│   └── package.json
├── database/
│   ├── booking.sql
│   ├── migration_add_staff_management.sql
│   └── seed.sql
└── ml-analysis/
    ├── booking.csv
    └── rfm_analysis.py
```

## Yêu Cầu Môi Trường

- Node.js + npm
- MySQL
- Python 3 (nếu chạy phần `ml-analysis`)

## Cài Đặt Nhanh

### 1) Database

```bash
mysql -u root -p < database/booking.sql
mysql -u root -p < database/seed.sql
```

Nếu bạn đã có DB cũ, chạy thêm migration:

```bash
mysql -u root -p < database/migration_add_staff_management.sql
```

### 2) Backend

```bash
cd backend
npm install
```

Tạo file `backend/.env`:

```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=booking_system
JWT_SECRET=your_secret_key
PORT=5000
```

Chạy backend:

```bash
npm start
```

### 3) Frontend

```bash
cd frontend
npm install
npm start
```

Frontend chạy mặc định tại `http://localhost:3000`.

## Tài Khoản Demo (seed.sql)

- Admin: `admin@example.com` / `admin123`
- Customer: `customer@example.com` / `customer123`
- Staff:
  - `staff1@example.com` / `admin123`
  - `staff2@example.com` / `admin123`
  - `staff3@example.com` / `admin123`

## API Chính

### Auth
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/profile`
- `PUT /api/auth/profile`

### Services
- `GET /api/services`
- `GET /api/services/:id`
- `POST /api/services` (admin)
- `PUT /api/services/:id` (admin)
- `DELETE /api/services/:id` (admin)

### Bookings
- `POST /api/bookings`
- `GET /api/bookings/my-bookings`
- `GET /api/bookings` (admin)
- `GET /api/bookings/:id`
- `PUT /api/bookings/:id/status` (admin)
- `PUT /api/bookings/:id/cancel`

### Staff
- `GET /api/staff/available`
- `GET /api/staff` (admin)
- `POST /api/staff` (admin)
- `PUT /api/staff/:id` (admin)

### Dashboard
- `GET /api/admin/dashboard/summary`
- `GET /api/admin/dashboard/bookings-by-month`
- `GET /api/admin/dashboard/top-services`
- `GET /api/admin/dashboard/customer-frequency`
- `GET /api/admin/dashboard/appointment-status`
- `GET /api/admin/dashboard/revenue-by-month`
- `GET /api/admin/dashboard/cancellation-rate`

## Công Nghệ Sử Dụng

### Frontend
- React 18
- React Router v6
- Axios
- Chart.js

### Backend
- Node.js
- Express.js
- MySQL
- JWT
- bcryptjs

### Data Analysis
- Python
- Pandas
- NumPy

## Ghi Chú

- Dữ liệu lịch hẹn lưu trong MySQL.
- Xác thực sử dụng JWT.
- Frontend lưu token ở `localStorage`.
- Module `ml-analysis` dùng để phân tích RFM trên dữ liệu mẫu.
