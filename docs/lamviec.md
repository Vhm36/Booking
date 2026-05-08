# Cách Làm Việc Với Dự Án

## 1. Chạy local

### Backend

```powershell
cd D:\Doantotnghiep\Code\backend
npm start
```

Backend mặc định:

```text
http://localhost:5000
```

Kiểm tra nhanh:

```powershell
Invoke-WebRequest -UseBasicParsing http://localhost:5000/
```

### Frontend

```powershell
cd D:\Doantotnghiep\Code\frontend
npm start
```

Frontend mặc định:

```text
http://localhost:3000
```

## 2. Lỗi hay gặp

### Port backend bị trùng

Lỗi:

```text
Error: listen EADDRINUSE: address already in use :::5000
```

Nguyên nhân: đã có backend khác đang chạy port `5000`.

Cách xử lý:

```powershell
netstat -ano | Select-String ":5000"
Stop-Process -Id <PID> -Force
npm start
```

### Frontend không kết nối backend

Kiểm tra:

```powershell
Invoke-WebRequest -UseBasicParsing http://localhost:5000/
```

Nếu backend chưa chạy thì vào `backend` và `npm start`.

## 3. Database

### Tạo lại DB từ đầu

Dùng file:

```text
database/recreate_booking_system.sql
```

Lệnh MySQL mẫu:

```powershell
mysql -u root -p < database/recreate_booking_system.sql
```

### Chạy migration mới

File smart booking:

```text
database/migration_smart_booking_features.sql
```

File voucher:

```text
database/migration_add_voucher_system.sql
```

Nếu không có mysql CLI, có thể chạy bằng Node với `mysql2` trong thư mục backend.

## 4. Biến môi trường backend

File: `backend/.env`

Biến cần có:

```env
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=booking_system
JWT_SECRET=your_secret
PORT=5000
FRONTEND_URL=http://localhost:3000
```

Biến tùy chọn:

```env
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-4.1-mini

SMTP_HOST=...
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...
SMTP_FROM=BeautyBook <your@email.com>

VNPAY_TMN_CODE=...
VNPAY_HASH_SECRET=...

VIETQR_ACCOUNT_NO=...
VIETQR_ACCOUNT_NAME=...
VIETQR_BANK_BIN=...
```

## 5. Quy trình code nên làm

1. Kiểm tra branch/worktree trước khi sửa.
2. Đọc file liên quan trước khi sửa.
3. Sửa đúng module, không sửa `node_modules`.
4. Nếu đổi DB, tạo migration trong `database/`.
5. Nếu đổi API, cập nhật frontend service tương ứng.
6. Chạy syntax check/backend smoke.
7. Chạy `npm run build` trong frontend.
8. Cập nhật docs nếu đổi nghiệp vụ.

## 6. Lệnh kiểm tra

Backend syntax:

```powershell
node --check backend/src/controllers/appointmentController/index.js
node --check backend/src/controllers/paymentController/index.js
node --check backend/src/controllers/chatController/index.js
```

Frontend build:

```powershell
cd frontend
npm run build
```

API smoke mẫu:

```powershell
Invoke-WebRequest -UseBasicParsing http://localhost:5000/
```

## 7. Tài khoản demo

- Admin: `admin@beautybook.com` / `Beauty123`
- Thu ngân: `thungan@beautybook.com` / `Beauty123`
- Nhân viên: `nhanvien@beautybook.com` / `Beauty123`
- Khách hàng: `khachhang@beautybook.com` / `Beauty123`
