# Tổng Quan Dự Án

## Tên dự án

Smart Booking Salon - AI Powered Booking System

## Mục tiêu

Xây dựng hệ thống đặt lịch salon thông minh, không chỉ cho phép khách đặt lịch mà còn hỗ trợ:

- Tối ưu trải nghiệm mobile.
- Giảm tình trạng boom lịch.
- Tự động phân loại khách hàng bằng RFM.
- Tự động marketing bằng voucher.
- Chatbot có khả năng hành động như AI Agent.
- Dashboard cập nhật realtime cho admin.

## Stack công nghệ

### Frontend

- React 18.
- React Router v6.
- Axios.
- Chart.js và react-chartjs-2.
- PWA manifest và service worker.

### Backend

- Node.js.
- Express.js.
- MySQL.
- JWT authentication.
- bcryptjs.
- node-cron.
- nodemailer.
- socket.io.
- OpenAI API tùy chọn.

### Database

- MySQL database: `booking_system`.
- Charset: `utf8mb4`.
- File tạo lại DB: `database/recreate_booking_system.sql`.
- Migration mới nhất: `database/migration_smart_booking_features.sql`.

## Vai trò người dùng

- `admin`: quản trị toàn bộ hệ thống.
- `staff`: nhân viên salon.
- `customer`: khách hàng.
- Thu ngân là staff có staff role `Thu ngân`.

## Tài khoản demo hiện tại

- Admin: `admin@beautybook.com` / `Beauty123`
- Thu ngân: `thungan@beautybook.com` / `Beauty123`
- Nhân viên: `nhanvien@beautybook.com` / `Beauty123`
- Khách hàng: `khachhang@beautybook.com` / `Beauty123`

## Luồng sử dụng chính

1. Khách hàng đăng nhập.
2. Khách xem dịch vụ hoặc vào thẳng `/booking`.
3. Khách chọn dịch vụ, ngày, giờ, nhân viên, voucher.
4. Frontend gọi API cancellation score.
5. Nếu rủi ro cao, khách bắt buộc thanh toán cọc online.
6. Backend tạo booking, lưu voucher và thông tin risk.
7. Backend tạo payment record.
8. Admin dashboard nhận realtime event.
9. Cron job nhắc lịch gửi email trước giờ hẹn.
10. RFM job phân loại khách và gán voucher marketing.

## Thư mục chính

```text
backend/
  src/
    config/
    controllers/
    jobs/
    middleware/
    models/
    routes/
    services/
    templates/
    utils/

frontend/
  public/
  src/
    components/
    pages/
    services/
    utils/

database/
  recreate_booking_system.sql
  migration_*.sql

docs/
  nhatky.md
  tinhnang.md
  tongquan.md
  kientruc.md
  lamviec.md
  cosodulieu.md
```

## Trạng thái hiện tại

- Chạy local.
- Backend mặc định: `http://localhost:5000`.
- Frontend mặc định: `http://localhost:3000`.
- Chưa deploy cloud.
- Chưa làm quản lý tồn kho vì không cần cho phạm vi đồ án hiện tại.
