# Kiến Trúc Hệ Thống

## 1. Tổng quan kiến trúc

Hệ thống gồm 3 lớp chính:

```text
React Frontend
  -> REST API / Socket.io
Express Backend
  -> MySQL
```

Ngoài ra có các job nền:

```text
node-cron
  -> appointmentReminderJob
  -> rfmClassificationJob
```

Và AI tùy chọn:

```text
ChatBot UI
  -> /api/chat
  -> openAiChat
  -> OpenAI Responses API
  -> function calls
  -> MySQL booking/service data
```

## 2. Frontend

### App router

File: `frontend/src/App.js`

Route chính:

- `/`
- `/services`
- `/services/:id`
- `/booking`
- `/booking/:serviceId`
- `/my-appointments`
- `/my-vouchers`
- `/profile`
- `/admin/dashboard`
- `/admin/services`
- `/admin/staff`
- `/admin/customers`
- `/admin/vouchers`
- `/admin/appointments`
- `/staff/dashboard`

### Services layer

Thư mục: `frontend/src/services`

- `api.js`: axios base config và JWT interceptor.
- `bookingService.js`: booking API và cancellation score.
- `voucherService.js`: voucher API.
- `dashboardService.js`: dashboard API.
- `dashboardRealtimeService.js`: load socket.io client từ backend và lắng nghe event.

### PWA

- `frontend/public/manifest.json`
- `frontend/public/sw.js`
- `frontend/public/index.html`

Service worker:

- Cache static assets.
- Bỏ qua API request.
- Hỗ trợ push notification và notification click.

## 3. Backend

### Entry point

- `backend/src/server.js`
  - Tạo HTTP server.
  - Gán socket.io.
  - Lưu `io` vào `app.set('io', io)`.
  - Listen port `5000` mặc định.

- `backend/src/app.js`
  - Cấu hình Express.
  - CORS.
  - Body parser.
  - Rate limit.
  - Route API.
  - Đăng ký cron jobs.

### Route chính

- `/api/auth`
- `/api/services`
- `/api/bookings`
- `/api/payments`
- `/api/staff`
- `/api/customers`
- `/api/chat`
- `/api/vouchers`
- `/api/admin-users`
- `/api/admin/dashboard`

## 4. Realtime dashboard

### Backend

- `backend/src/server.js`: khởi tạo socket.io.
- Admin client emit `join_admin`.
- Backend join socket vào room `admin_room`.
- `backend/src/utils/realtime/index.js`: helper `emitDashboardUpdate`.
- Controller booking/payment gọi emit khi có thay đổi.

### Frontend

- `frontend/src/services/dashboardRealtimeService.js`.
- Load client script từ:

```text
http://localhost:5000/socket.io/socket.io.js
```

- Dashboard lắng nghe:

```text
dashboard:update
```

- Nếu socket lỗi, dashboard fallback polling mỗi 30 giây.

## 5. Booking flow

```text
Booking.js
  -> bookingService.getCancellationScore()
  -> /api/bookings/cancellation-score
  -> cancellationScoreService
```

Nếu đặt lịch:

```text
Booking.js
  -> bookingService.createBooking()
  -> appointmentController.createAppointment()
  -> appointmentModel.createAppointment()
  -> paymentService.createPayment()
  -> paymentController.createPayment()
```

Nếu có voucher:

```text
appointmentController
  -> voucherService.validateVoucherForCustomer()
  -> appointmentModel.createAppointment()
  -> voucherService.recordVoucherUsage()
```

Nếu risk cao:

```text
cancellationScore >= 70
  -> deposit_required = 1
  -> deposit_amount = 20% final total
  -> payment cash bị từ chối
```

## 6. AI Agent flow

```text
ChatBot.js
  -> chatService.chatWithBot()
  -> chatController.chatWithBot()
  -> buildSmartRuleResponse()
  -> nếu cần AI: openAiChat.generateSalonAIReply()
  -> extractFunctionCalls()
  -> executeFunctionCalls()
  -> submitFunctionResults()
```

Function calls:

- `check_availability`
- `create_booking`
- `get_my_appointments`

Sentiment được tách từ text:

```text
[SENTIMENT:positive]
[SENTIMENT:neutral]
[SENTIMENT:negative]
[SENTIMENT:complaint]
```

## 7. Cron jobs

### Reminder

- File: `backend/src/jobs/appointmentReminderJob.js`.
- Lịch: mỗi 15 phút.
- Mục đích: gửi email nhắc lịch trước giờ hẹn khoảng 2 tiếng.

### RFM

- File: `backend/src/jobs/rfmClassificationJob.js`.
- Lịch: 03:00 hằng ngày.
- Mục đích: phân loại khách và gán voucher marketing.
