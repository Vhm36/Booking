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

- Bảng `vouchers`, `voucher_assignments`.
- Voucher mẫu:
  - `WELCOME15`: giảm 15%, tối đa 120000 VNĐ.
  - `VIP120K`: giảm cố định 120000 VNĐ cho VIP.
  - `REENGAGE20`: tạo tự động khi RFM cần kích hoạt lại khách.
- Booking:
  - Validate voucher theo khách.
  - Tính discount.
  - Lưu `original_amount`, `voucher_discount`, `voucher_codes`.
  - Cập nhật lượt dùng, lần dùng gần nhất và tổng tiền giảm ngay trên `voucher_assignments`.

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

## 11. Phân cụm hành vi động (Mô hình DEC)

- File chính backend: [decClusteringService/index.js](file:///d:/Doantotnghiep/Code/backend/src/services/decClusteringService/index.js).
- File chính frontend: [AnalyticsStrategy.js](file:///d:/Doantotnghiep/Code/frontend/src/pages/admin/AnalyticsStrategy/AnalyticsStrategy.js).
- Phân cụm hành vi động (Dynamic Engagement Clustering - DEC) tự động phân nhóm khách hàng dựa trên hành vi giao dịch và đặt hẹn thực tế (Recency, Frequency, Monetary, tỷ lệ hoàn thành, tỷ lệ hủy, sự đa dạng dịch vụ và nhịp đặt theo tháng).
- 7 cụm khách hàng (Cluster Definitions):
  1. **Thường xuyên đặt 1 dịch vụ (`frequent_single_service`)**: Từ 3 lịch trở lên và chỉ dùng một dịch vụ cố định. Chiến lược: gợi ý combo, bán thêm.
  2. **Đặt nhiều nhưng ít đến (`many_bookings_low_arrival`)**: Từ 4 lịch trở lên nhưng tỷ lệ hoàn thành thấp (dưới 45%). Chiến lược: xác nhận kỹ, đặt cọc nhẹ.
  3. **Hay hủy lịch hoặc không đến (`frequent_cancel_no_show`)**: Từ 2 lịch hủy/no-show và tỷ lệ rủi ro từ 35% trở lên. Chiến lược: nhắc hẹn sớm, ưu tiên khung giờ linh hoạt.
  4. **Dùng ít nhưng chọn dịch vụ cao cấp (`low_usage_premium`)**: Dưới 2 lịch hoàn thành nhưng giá trị trung bình thuộc nhóm cao (top 25%). Chiến lược: chăm sóc VIP cá nhân hóa.
  5. **Dùng nhiều dịch vụ bình dân (`high_usage_budget`)**: Từ 3 lịch hoàn thành trở lên nhưng giá trị trung bình ở mức phổ thông. Chiến lược: combo tích điểm, nâng cấp dịch vụ.
  6. **Đặt 1 lần rồi bỏ (`one_time_then_left`)**: Chỉ có 1 lịch và đã qua hơn 21 ngày chưa quay lại. Chiến lược: voucher kích hoạt lại.
  7. **Đặt theo tháng ít (`low_monthly_usage`)**: Nhịp đặt thưa thớt qua nhiều tháng nhưng tần suất trung bình dưới 1.25 lịch/tháng. Chiến lược: nhắc lịch định kỳ theo tháng.
- API Route: `/api/admin/dashboard/dec-clustering` hỗ trợ lọc theo ngày, tuần, tháng, năm.
- Admin Analytics Strategy UI:
  - **Bảng chiến lược**: Xem danh sách khách hàng, nhãn tiềm năng (Potential/Not potential), và xuất Excel báo cáo chiến lược.
  - **Đặc trưng chi tiết từng cụm**: So sánh chỉ số quy mô, chi tiêu trung bình, tỷ lệ hủy, tần suất, và dịch vụ trung bình.
  - **Biểu đồ cụm (Average Profile Chart)**: Trực quan hóa tương quan so sánh các cụm bằng Chart.js.
  - **Chiến lược hành động đề xuất**: Kết hợp hành vi với hành động vận hành, lý do đề xuất và tác động kỳ vọng.

