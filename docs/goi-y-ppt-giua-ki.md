# Gợi Ý PPT Giữa Kì - Smart Booking Salon

Tài liệu này được rút ra từ code hiện tại của dự án BeautyBook/Smart Booking Salon. Có thể dùng để làm slide PowerPoint 10-14 trang, thuyết trình khoảng 8-12 phút.

## 1. Thông Điệp Chính Nên Bám Theo

Đề tài không chỉ là web đặt lịch salon cơ bản. Điểm nổi bật là hệ thống đặt lịch thông minh cho dịch vụ làm đẹp, có phân quyền theo vai trò, quản lý vận hành, thanh toán, voucher, dashboard realtime và các chức năng thông minh như RFM marketing, chống boom lịch, chatbot hỗ trợ đặt lịch.

Câu mở đầu gợi ý:

> Nhóm em xây dựng hệ thống BeautyBook - web đặt lịch dịch vụ làm đẹp. Hệ thống giải quyết bài toán khách đặt lịch online, salon quản lý nhân viên/lịch hẹn/doanh thu, đồng thời bổ sung các tính năng thông minh như phân loại khách hàng RFM, voucher cá nhân hóa, chatbot và cảnh báo rủi ro hủy lịch.

## 2. Dàn Slide Đề Xuất

### Slide 1 - Tiêu Đề

Tiêu đề:

**BeautyBook - Hệ Thống Đặt Lịch Dịch Vụ Làm Đẹp Thông Minh**

Nội dung:

- Đề tài: Web đặt lịch salon/spa.
- Công nghệ: React, Node.js/Express, MySQL.
- Thành viên, lớp, giảng viên, thời gian.

Gợi ý trình bày:

- Nền là ảnh salon/làm đẹp hoặc ảnh chụp trang Home/Booking.
- Đừng ghi quá nhiều chữ ở slide này.

### Slide 2 - Lý Do Chọn Đề Tài

Vấn đề thực tế:

- Khách phải gọi điện/nhắn tin để hỏi dịch vụ, giờ trống, nhân viên trống.
- Salon dễ bị trùng lịch nhân viên nếu quản lý thủ công.
- Khách hủy lịch sát giờ làm giảm hiệu suất vận hành.
- Admin khó theo dõi doanh thu, lịch hẹn, khách hàng thân thiết.
- Marketing voucher thường chưa cá nhân hóa theo hành vi khách hàng.

Mục tiêu hệ thống:

- Cho khách tự xem dịch vụ và đặt lịch online.
- Hỗ trợ salon quản lý dịch vụ, nhân viên, khách hàng, lịch hẹn.
- Cung cấp dashboard thống kê và cập nhật realtime.
- Thêm các tính năng thông minh để tăng trải nghiệm và giảm rủi ro vận hành.

### Slide 3 - Đối Tượng Sử Dụng Và Phân Quyền

Các vai trò chính:

- Customer: đăng ký/đăng nhập, xem dịch vụ, đặt lịch, dùng voucher, thanh toán, xem lịch, yêu cầu hủy, đánh giá nhân viên, chat với bot.
- Staff: xem lịch được phân công, xử lý lịch hẹn, gửi yêu cầu hủy nếu cần.
- Thu ngân: staff có role riêng, có thể hỗ trợ xử lý lịch/khách và xác nhận thanh toán VietQR.
- Admin: quản lý toàn bộ hệ thống, dashboard, dịch vụ, nhân viên, lịch làm việc, khách hàng, voucher, lịch hẹn.

Code liên quan:

- `frontend/src/App.js`: chia route theo role.
- `backend/src/middleware/authMiddleware/index.js`: xác thực JWT và kiểm tra role.
- `backend/src/routes/*/index.js`: định nghĩa quyền truy cập API.

Gợi ý nói:

> Hệ thống dùng JWT để xác thực. Sau khi đăng nhập, frontend điều hướng theo role. Backend tiếp tục kiểm tra quyền ở middleware để tránh việc người dùng gọi API trái phép.

### Slide 4 - Công Nghệ Sử Dụng

Frontend:

- React 18.
- React Router v6.
- Axios.
- Chart.js, react-chartjs-2.
- Socket.io client.
- PWA: manifest và service worker.
- xlsx để hỗ trợ xuất dữ liệu Excel.

Backend:

- Node.js, Express.js.
- MySQL/MySQL2.
- JWT, bcryptjs.
- express-validator.
- express-rate-limit.
- multer upload ảnh.
- node-cron.
- nodemailer.
- socket.io.
- OpenAI API tùy chọn cho chatbot.

Database:

- MySQL database `booking_system`.
- Charset `utf8mb4`, hỗ trợ tiếng Việt.
- Có 17 bảng chính trong `database/recreate_booking_system.sql`.

### Slide 5 - Kiến Trúc Tổng Quan

Sơ đồ nên vẽ:

```text
React Frontend
  -> Axios REST API
  -> Express Routes
  -> Controllers
  -> Models
  -> MySQL

Socket.io
  -> Dashboard realtime

node-cron
  -> Reminder job
  -> RFM job

ChatBot
  -> Rule engine / OpenAI optional
  -> Tool registry
  -> Booking/service data
```

Ý chính:

- Frontend chỉ gọi API qua service layer trong `frontend/src/services`.
- Backend chia rõ `routes`, `controllers`, `models`, `services`, `jobs`, `utils`.
- Database lưu dữ liệu nghiệp vụ.
- Socket.io dùng để đẩy cập nhật dashboard.
- Cron job chạy nền cho nhắc lịch và phân loại RFM.

Code liên quan:

- `backend/src/app.js`.
- `backend/src/server.js`.
- `docs/kientruc.md`.

### Slide 6 - Cơ Sở Dữ Liệu

Nhóm bảng chính:

- Người dùng: `users`, `staff_role`.
- Dịch vụ: `services`, `service_category`.
- Lịch hẹn: `appointments`, `appointment_services`.
- Thanh toán: `payments`.
- Voucher: `vouchers`, `voucher_assignments`, `voucher_usage_history`, `voucher_suggestions`.
- Chatbot: `chat_conversations`, `chat_messages`, `chat_suggestions`, `chat_faq`, `chat_bot_responses`.
- Lịch làm việc nhân viên: `staff_weekly_availability`.

Quan hệ chính:

```text
users 1-n appointments
services 1-n appointments
appointments 1-n appointment_services
appointments 1-n payments
users(customer) 1-n voucher_assignments
vouchers 1-n voucher_assignments
chat_conversations 1-n chat_messages
```

Điểm nên nhấn:

- `appointment_services` hỗ trợ một lịch có nhiều dịch vụ.
- `staff_weekly_availability` giúp kiểm tra nhân viên có làm trong khung giờ khách chọn.
- `appointments` lưu thêm `cancellation_score`, `deposit_required`, `deposit_amount`, `voucher_discount`.
- Các index quan trọng giúp truy vấn lịch, voucher, chat nhanh hơn.

### Slide 7 - Luồng Đặt Lịch Của Khách Hàng

Luồng nghiệp vụ:

1. Khách đăng nhập.
2. Vào trang dịch vụ hoặc trang đặt lịch.
3. Chọn một hoặc nhiều dịch vụ.
4. Chọn ngày, giờ, nhân viên hoặc để hệ thống tự phân công.
5. Chọn voucher nếu có.
6. Hệ thống kiểm tra nhân viên trống, lịch làm việc tuần và trùng lịch.
7. Hệ thống tính tổng tiền, tổng thời lượng, điểm rủi ro hủy lịch.
8. Tạo lịch hẹn trạng thái `pending`.
9. Tạo payment record theo phương thức thanh toán.
10. Dashboard admin nhận sự kiện realtime.

Code liên quan:

- `frontend/src/pages/Booking/Booking.js`.
- `frontend/src/services/bookingService.js`.
- `backend/src/controllers/appointmentController/index.js`.
- `backend/src/models/appointmentModel/index.js`.
- `backend/src/services/cancellationScoreService/index.js`.

Điểm nổi bật để nói:

> Khi đặt lịch, hệ thống không chỉ lưu ngày giờ. Backend còn tính tổng thời lượng của nhiều dịch vụ, kiểm tra xung đột theo khoảng thời gian, kiểm tra lịch làm việc nhân viên, áp voucher, tính điểm rủi ro hủy và yêu cầu cọc nếu cần.

### Slide 8 - Module Quản Trị

Admin có thể:

- Xem dashboard điều hành.
- Quản lý dịch vụ và danh mục.
- Quản lý lịch hẹn.
- Quản lý nhân viên, vai trò nhân viên, lịch làm việc tuần, nghỉ phép.
- Quản lý khách hàng.
- Quản lý voucher.
- Xem analytics: booking, doanh thu, khách hàng, trạng thái lịch.

Code liên quan:

- `frontend/src/pages/admin/Dashboard/Dashboard.js`.
- `frontend/src/pages/admin/ManageServices/ManageServices.js`.
- `frontend/src/pages/admin/ManageAppointments/ManageAppointments.js`.
- `frontend/src/pages/admin/ManageStaff/ManageStaff.js`.
- `frontend/src/pages/admin/ManageCustomers/ManageCustomers.js`.
- `frontend/src/pages/admin/ManageVouchers/ManageVouchers.js`.
- `backend/src/controllers/dashboardController/index.js`.

Gợi ý demo:

- Đăng nhập admin.
- Mở Dashboard.
- Chuyển qua Quản lý lịch hẹn.
- Cập nhật trạng thái một lịch.
- Quay lại Dashboard để thấy dữ liệu được làm mới.

### Slide 9 - Dashboard Realtime Và Thống Kê

Thống kê đang có:

- Tổng booking.
- Tổng doanh thu.
- Tổng khách hàng.
- Dịch vụ phổ biến.
- Booking theo tháng.
- Doanh thu theo tháng.
- Top dịch vụ.
- Tỷ lệ hủy lịch.
- Hoa hồng nhân viên theo tháng.
- Phân tích hành vi khách hàng mức MVP.

Realtime:

- Backend tạo HTTP server + Socket.io trong `backend/src/server.js`.
- Admin client emit `join-admin`.
- Backend phát event `dashboard:update`.
- Frontend nhận event và tự gọi lại API dashboard.
- Nếu socket lỗi, frontend fallback polling.

Code liên quan:

- `backend/src/server.js`.
- `backend/src/utils/realtime/index.js`.
- `frontend/src/services/dashboardRealtimeService.js`.
- `frontend/src/pages/admin/Dashboard/Dashboard.js`.

Gợi ý nói:

> Realtime giúp admin không cần refresh tay. Khi có lịch mới, cập nhật trạng thái hoặc thanh toán, backend phát sự kiện để dashboard tự tải lại dữ liệu.

### Slide 10 - Voucher Và Marketing Cá Nhân Hóa

Chức năng voucher:

- Admin tạo/sửa/tắt voucher.
- Gán voucher cho một hoặc nhiều khách hàng.
- Có thể gửi email voucher cho khách.
- Khách xem voucher của mình.
- Booking validate voucher theo khách, hạn dùng, số lượt dùng, giá trị đơn tối thiểu, loại khách.
- Khi dùng voucher, hệ thống ghi lịch sử sử dụng.

RFM marketing:

- Recency: khách quay lại gần hay lâu.
- Frequency: số lần sử dụng dịch vụ.
- Monetary: tổng chi tiêu.
- Phân nhóm: Champions, Loyal Customers, Potential Loyalists, At Risk, Lost Customers, New Customers, Need Attention.
- Cron job chạy hằng ngày lúc 03:00.
- Có logic tạo voucher comeback cho khách At Risk và voucher VIP cho Champions.

Code liên quan:

- `backend/src/services/voucherService/index.js`.
- `backend/src/controllers/voucherController/index.js`.
- `backend/src/services/rfmService/index.js`.
- `backend/src/jobs/rfmClassificationJob.js`.
- `frontend/src/pages/MyVouchers/MyVouchers.js`.
- `frontend/src/pages/admin/ManageVouchers/ManageVouchers.js`.

### Slide 11 - Chống Boom Lịch Bằng Cancellation Score

Ý tưởng:

Hệ thống tính điểm rủi ro hủy lịch của khách trước khi đặt. Nếu điểm cao, hệ thống yêu cầu đặt cọc online để giữ chỗ.

Các yếu tố tính điểm trong code:

- Lịch sử hủy: 40%.
- Đặt sát giờ: 20%.
- Phân khúc khách hàng/RFM segment: 20%.
- Ngày trong tuần: 10%.
- Số lần no-show: 10%.

Quy tắc:

- Điểm từ 0-100.
- Nếu điểm lớn hơn 70: yêu cầu đặt cọc.
- Nếu điểm lớn hơn 85: cọc 30%.
- Nếu điểm từ 71-85: cọc 20%.

Code liên quan:

- `backend/src/services/cancellationScoreService/index.js`.
- `backend/src/controllers/appointmentController/index.js`.
- `frontend/src/pages/Booking/Booking.js`.

Gợi ý nói:

> Đây là phần thông minh của đề tài. Thay vì mọi khách đều đặt lịch giống nhau, hệ thống dựa vào hành vi trước đó để quyết định có cần cọc hay không.

### Slide 12 - Thanh Toán Và Hóa Đơn

Phương thức hỗ trợ trong code:

- `cash`: thanh toán tại salon.
- `vietqr`: chuyển khoản ngân hàng bằng QR.
- `vnpay`: thanh toán qua cổng VNPay nếu cấu hình đủ biến môi trường.

Luồng chính:

1. Sau khi booking được tạo, frontend gọi API tạo payment.
2. Backend kiểm tra chủ lịch, trạng thái lịch, số tiền cần thanh toán.
3. Nếu lịch cần cọc, backend từ chối `cash`.
4. Với VietQR, frontend mở trang QR chuyển khoản.
5. Với VNPay, backend tạo link thanh toán và xử lý return/IPN.
6. Khi thanh toán thành công, payment chuyển sang `paid`.
7. Khách có thể xem bill/invoice.

Code liên quan:

- `backend/src/controllers/paymentController/index.js`.
- `backend/src/models/paymentModel/index.js`.
- `backend/src/utils/vnpay/index.js`.
- `backend/src/utils/vietqr/index.js`.
- `frontend/src/pages/PaymentTransfer/PaymentTransfer.js`.
- `frontend/src/pages/PaymentReturn/PaymentReturn.js`.
- `frontend/src/pages/PaymentInvoice/PaymentInvoice.js`.

### Slide 13 - Chatbot Hỗ Trợ Khách Hàng

Khả năng:

- Tạo hội thoại và lưu tin nhắn.
- Gợi ý câu hỏi nhanh.
- Tìm FAQ.
- Trả lời rule-based bằng dữ liệu dịch vụ/FAQ.
- Nếu có `OPENAI_API_KEY`, dùng OpenAI để trả lời thông minh hơn.
- Có tool/function calling cho các tác vụ: kiểm tra lịch trống, xem dịch vụ, tạo booking, xem lịch hẹn, hủy lịch, xem khuyến mãi, xem nhân viên, giờ làm việc.
- Có sentiment: positive, neutral, negative, complaint.
- Nếu khách phàn nàn, hội thoại có thể được đánh dấu `escalated`.

Code liên quan:

- `frontend/src/pages/ChatBot/ChatBot.js`.
- `backend/src/controllers/chatController/index.js`.
- `backend/src/utils/chatResponseEngine/index.js`.
- `backend/src/utils/openAiChat/index.js`.
- `backend/src/utils/toolRegistry/index.js`.

Gợi ý demo:

- Hỏi: "Có dịch vụ cắt tóc không?"
- Hỏi: "Cho mình xem lịch hẹn của mình."
- Nếu cấu hình OpenAI chưa ổn, demo phần gợi ý/FAQ/rule-based sẽ an toàn hơn.

### Slide 14 - Bảo Mật, Kiểm Tra Dữ Liệu Và Ổn Định Hệ Thống

Các điểm đã có:

- JWT authentication.
- Mật khẩu hash bằng bcrypt.
- Middleware phân quyền admin/staff/customer.
- `express-validator` kiểm tra input.
- `express-rate-limit` giới hạn request chung và login.
- CORS whitelist theo frontend URL.
- Security headers cơ bản.
- Không cho staff thường thao tác lịch của nhân viên khác.
- Upload avatar giới hạn dung lượng và loại file.
- Database có index cho truy vấn lịch/voucher/chat.

Code liên quan:

- `backend/src/middleware/authMiddleware/index.js`.
- `backend/src/middleware/validationMiddleware/index.js`.
- `backend/src/app.js`.
- `backend/database/migration_phase1_security.sql`.

Gợi ý nói:

> Với đồ án giữa kì, nhóm đã quan tâm tới bảo mật ở mức nền tảng: xác thực token, phân quyền theo role, hash mật khẩu, validate input và giới hạn request đăng nhập.

### Slide 15 - Kết Quả Hiện Tại

Có thể nói theo dạng checklist:

- Đã hoàn thành cấu trúc fullstack React + Express + MySQL.
- Có 3 vai trò chính: customer, staff, admin; thêm staff role thu ngân.
- Khách có thể xem dịch vụ, đặt lịch, dùng voucher, thanh toán, xem lịch, hủy/đánh giá.
- Admin có dashboard, quản lý dịch vụ, lịch hẹn, nhân viên, khách hàng, voucher.
- Có PWA và bottom navigation cho mobile.
- Có job nhắc lịch và job RFM.
- Có dashboard realtime bằng Socket.io.
- Có chatbot rule-based/OpenAI optional.

Số liệu từ codebase:

- Backend `src`: khoảng 56 file.
- Frontend `src`: khoảng 102 file.
- Frontend pages: khoảng 51 file JS.
- API routes: khoảng 81 route.
- Database chính: 17 bảng.

### Slide 16 - Hạn Chế Và Hướng Phát Triển

Hạn chế nên nói trung thực:

- Chưa deploy cloud, hiện chạy local.
- Thanh toán online cần cấu hình thật các biến môi trường VNPay/VietQR trước khi demo end-to-end.
- Chatbot AI cần `OPENAI_API_KEY`; nếu không có thì dùng rule-based/fallback.
- Cần test kỹ toàn bộ luồng booking, payment, voucher, RFM bằng dữ liệu thật.
- Chưa có test tự động đầy đủ.

Hướng phát triển:

- Deploy production.
- Thêm test tự động với Jest/Supertest.
- Thêm Swagger/OpenAPI cho backend.
- Tối ưu dashboard bằng một endpoint tổng hợp hoặc cache.
- Thêm audit log cho hành động admin/staff.
- Hoàn thiện notification qua email/Zalo/push.
- Chuẩn hóa đa ngôn ngữ/tiếng Việt có dấu toàn bộ UI.

## 3. Kịch Bản Demo Gợi Ý

Demo an toàn nhất trong 3-5 phút:

1. Trang Home/Services: cho thấy danh sách dịch vụ.
2. Đăng nhập khách hàng.
3. Đặt lịch:
   - chọn nhiều dịch vụ,
   - chọn ngày/giờ,
   - chọn hoặc bỏ trống nhân viên để hệ thống tự sắp xếp,
   - áp voucher nếu tài khoản có voucher,
   - tạo payment record.
4. Vào "Lịch hẹn của tôi":
   - xem trạng thái,
   - xem thanh toán,
   - gửi yêu cầu hủy hoặc đánh giá nếu lịch completed.
5. Đăng nhập admin:
   - xem dashboard,
   - xem quản lý lịch hẹn,
   - cập nhật trạng thái lịch.
6. Mở chatbot:
   - hỏi dịch vụ/giá,
   - thử câu hỏi lịch hẹn hoặc FAQ.

Nên chuẩn bị sẵn:

- Tài khoản admin, customer, staff.
- Một vài dịch vụ active có ảnh đẹp.
- Một vài lịch completed/pending/confirmed.
- Một voucher đã gán cho khách demo.
- Một payment đã paid nếu muốn demo bill.

## 4. Câu Hỏi Giảng Viên Có Thể Hỏi Và Cách Trả Lời

### Vì sao dùng React + Express + MySQL?

React phù hợp xây UI động, chia component và route rõ ràng. Express nhẹ, dễ xây REST API theo module. MySQL phù hợp dữ liệu quan hệ như người dùng, lịch hẹn, dịch vụ, thanh toán, voucher.

### Làm sao chống đặt trùng lịch nhân viên?

Backend kiểm tra xung đột theo `staff_id`, ngày, giờ bắt đầu và giờ kết thúc. Với lịch nhiều dịch vụ, hệ thống tính tổng thời lượng để ra `end_time`, sau đó so với các lịch pending/confirmed hiện có. Ngoài ra có index/constraint hỗ trợ ở DB.

### Staff có thể sửa lịch của người khác không?

Admin có quyền toàn bộ. Thu ngân có quyền vận hành rộng hơn. Staff thường chỉ được xem/cập nhật lịch được phân công cho chính họ. Logic này nằm trong `canManageAppointment` của `appointmentController`.

### RFM dùng để làm gì?

RFM phân loại khách theo lần quay lại gần nhất, tần suất sử dụng và tổng chi tiêu. Kết quả dùng để gắn segment cho khách, hỗ trợ marketing cá nhân hóa như gửi voucher cho khách VIP hoặc khách có nguy cơ rời bỏ.

### Chatbot có thật sự đặt lịch được không?

Code có tool `create_booking` trong tool registry, cho phép AI tạo lịch khi đủ thông tin và khách đã xác nhận. Tuy nhiên để demo ổn định cần cấu hình OpenAI và kiểm thử dữ liệu dịch vụ/nhân viên trước.

### Nếu khách hủy lịch nhiều thì hệ thống xử lý sao?

Hệ thống có cancellation score. Khách có lịch sử hủy/no-show cao, đặt sát giờ hoặc thuộc segment rủi ro sẽ có điểm cao hơn. Nếu vượt ngưỡng, hệ thống yêu cầu đặt cọc online để giữ chỗ.

## 5. Các Điểm Nên Kiểm Tra Trước Khi Demo

Các mục này không nhất thiết phải đưa lên slide, nhưng nên kiểm tra để tránh demo lỗi:

- Frontend đang gọi `bookingService.getCancellationScore()` tới `/bookings/cancellation-score`, trong khi backend hiện khai báo `/api/cancellation-score`. Nên đồng bộ lại endpoint trước khi demo phần "AI chống boom lịch".
- Backend cancellation score route trong `app.js` đang đọc `appointmentDate`, `appointmentTime`, còn frontend gửi `appointment_date`, `appointment_time`. Nên thống nhất tên field.
- `cancellationScoreService.calculateScore()` trả `score`, `requireDeposit`, `depositPercent`, nhưng frontend đang hiển thị `riskLevel`. Nên thêm `riskLevel` hoặc chỉnh UI.
- Một vài tool chatbot trong `toolRegistry` cần kiểm thử lại với schema DB hiện tại trước khi demo chức năng function calling sâu.
- Nếu demo VNPay/VietQR, cần kiểm tra `.env` có đủ biến cấu hình và bảng `payments` đã chạy migration gateway.
- Nếu demo email, cần cấu hình SMTP; nếu không, reminder job chỉ log local.

## 6. Gợi Ý Thiết Kế Slide

Màu chủ đạo:

- Nền sáng, trắng hoặc xanh rất nhạt.
- Màu nhấn xanh teal/xanh lá nhẹ để hợp dashboard hiện tại.
- Tránh nhồi code dài; chỉ đưa flow/sơ đồ.

Ảnh nên chụp từ app:

- Trang đặt lịch nhiều dịch vụ.
- Dashboard admin.
- Trang quản lý lịch hẹn.
- Trang voucher của khách hoặc quản lý voucher.
- Chatbot.
- Trang thanh toán/bill nếu đã có dữ liệu.

Sơ đồ nên tự vẽ:

- Sơ đồ kiến trúc 3 lớp.
- Sơ đồ luồng đặt lịch.
- Sơ đồ database quan hệ chính.
- Sơ đồ realtime dashboard.
- Sơ đồ RFM -> segment -> voucher.

## 7. Thứ Tự Ưu Tiên Nếu Chỉ Có 10 Slide

Nếu bị giới hạn thời gian, dùng 10 slide này:

1. Tiêu đề.
2. Lý do chọn đề tài và mục tiêu.
3. Vai trò người dùng.
4. Công nghệ và kiến trúc.
5. Cơ sở dữ liệu.
6. Luồng đặt lịch.
7. Admin dashboard và quản lý.
8. Tính năng thông minh: voucher, RFM, chống boom lịch.
9. Chatbot, payment, realtime.
10. Kết quả hiện tại, hạn chế, hướng phát triển.

