# Tính Năng Hệ Thống

## 1. Khách hàng

- Đăng ký, đăng nhập, quản lý hồ sơ.
- Xem danh sách dịch vụ và chi tiết dịch vụ.
- Đặt lịch theo:
  - Một hoặc nhiều dịch vụ.
  - Ngày, giờ.
  - Nhân viên tùy chọn hoặc để hệ thống tự sắp xếp.
- Chọn voucher khi đặt lịch.
- Xem lịch hẹn của tôi.
- Gửi yêu cầu hủy lịch.
- Xem voucher của tôi.
- Chat với AI chatbot để hỏi dịch vụ, giá, lịch trống và tạo booking.
- Sử dụng trên mobile như PWA.

## 2. Admin

- Dashboard tổng quan:
  - Tổng booking.
  - Tổng doanh thu.
  - Tổng khách hàng.
  - Dịch vụ phổ biến.
  - Doanh thu theo tháng.
  - Booking theo tháng.
- Dashboard realtime bằng socket.io.
- Quản lý dịch vụ.
- Quản lý lịch hẹn.
- Quản lý nhân viên và lịch làm việc.
- Quản lý khách hàng.
- Quản lý voucher.
- Xem RFM segment của khách hàng.
- Gửi voucher email cho khách.
- Chạy lại RFM thủ công qua API.

## 3. Thu ngân

- Tài khoản staff có role thu ngân.
- Có thể xử lý lịch hẹn và khách hàng theo quyền vận hành.
- Xác nhận thanh toán chuyển khoản VietQR nếu cần.

## 4. Nhân viên

- Đăng nhập bằng tài khoản staff.
- Xem dashboard nhân viên.
- Xem lịch hẹn được phân công.
- Gửi yêu cầu hủy lịch nếu có vấn đề vận hành.

## 5. Voucher

- Bảng `vouchers`, `voucher_assignments`, `voucher_usage_history`, `voucher_suggestions`.
- Voucher mẫu:
  - `WELCOME15`: giảm 15%, tối đa 120000 VNĐ.
  - `VIP120K`: giảm cố định 120000 VNĐ cho VIP.
  - `REENGAGE20`: tạo tự động khi RFM cần kích hoạt lại khách.
- Booking:
  - Validate voucher theo khách.
  - Tính discount.
  - Lưu `original_amount`, `voucher_discount`, `voucher_codes`.
  - Ghi lịch sử sử dụng voucher.

## 6. PWA và Mobile UX

- `frontend/public/manifest.json`.
- `frontend/public/sw.js`.
- Service worker cache static assets và hỗ trợ push notification cơ bản.
- `index.html` có PWA meta tags và register service worker.
- Bottom navigation mobile:
  - Customer: Home, Dịch vụ, Đặt lịch, Voucher, Lịch hẹn.
  - Admin: Dash, Lịch, Voucher, Nhân viên, Khách.
  - Staff: Dash, Lịch, Tài khoản.

## 7. Nhắc lịch

- Job: `backend/src/jobs/appointmentReminderJob.js`.
- Chạy mỗi 15 phút.
- Tìm lịch trong ngày, trước giờ hẹn khoảng 2 tiếng.
- Gửi email nếu SMTP đã cấu hình.
- Nếu chưa có SMTP thì log local để đồ án không bị crash.
- Cột DB:
  - `appointments.reminder_sent`
  - `appointments.reminder_sent_at`

## 8. AI Agent và Sentiment

- File chính: `backend/src/utils/openAiChat/index.js`.
- Nếu có `OPENAI_API_KEY`, chatbot dùng OpenAI Responses API.
- Tools:
  - `check_availability`
  - `create_booking`
  - `get_my_appointments`
- Sentiment:
  - `positive`
  - `neutral`
  - `negative`
  - `complaint`
- Lưu vào:
  - `chat_messages.sentiment`
  - `chat_messages.escalated`

## 9. RFM Marketing

- File chính: `backend/src/services/rfmService/index.js`.
- RFM:
  - Recency: lần cuối hoàn thành lịch.
  - Frequency: số lần hoàn thành.
  - Monetary: tổng chi tiêu.
- Segment:
  - Champions.
  - Loyal Customers.
  - Potential Loyalists.
  - At Risk.
  - Lost Customers.
  - New Customers.
  - Need Attention.
- Job: `backend/src/jobs/rfmClassificationJob.js`.
- Chạy hằng ngày lúc 03:00.
- Tự động gán voucher cho nhóm phù hợp.

## 10. Chống boom lịch

- File chính: `backend/src/services/cancellationScoreService/index.js`.
- Đầu vào:
  - Lịch sử hủy.
  - Thời gian đặt sát giờ hay xa giờ.
  - Segment khách hàng.
  - Ngày trong tuần.
  - No-show count.
- Nếu score >= 70:
  - `requireDeposit = true`.
  - Cọc 20%.
  - Booking UI khóa thanh toán tiền mặt.
  - Backend payment từ chối cash và chỉ cho online.
