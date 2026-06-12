# Nhật Ký Dự Án

Cập nhật gần nhất: 2026-05-08

## 2026-04-27 - Smart Booking Salon Phase 1-4

### Đã hoàn thành

- Reset và kiểm tra database `booking_system`.
- Tạo lại tài khoản demo:
  - `admin@beautybook.com` / `Beauty123`
  - `thungan@beautybook.com` / `Beauty123`
  - `nhanvien@beautybook.com` / `Beauty123`
  - `khachhang@beautybook.com` / `Beauty123`
- Đưa voucher vào luồng sử dụng thật:
  - Backend route `/api/vouchers`.
  - Trang admin quản lý voucher.
  - Trang khách hàng xem voucher của tôi.
  - Trang booking chọn voucher, tính giảm giá và lưu lịch sử sử dụng.
- Phase 1:
  - PWA manifest và service worker.
  - Meta PWA trong `frontend/public/index.html`.
  - Bottom navigation cho mobile.
  - Template email nhắc lịch.
  - Cron job `appointmentReminderJob`.
- Phase 2:
  - AI chat hỗ trợ OpenAI API nếu có `OPENAI_API_KEY`.
  - Function calling: kiểm tra lịch trống, tạo booking, xem lịch hẹn sắp tới.
  - Lưu sentiment và đánh dấu escalated nếu khách phàn nàn.
  - ChatBot hiển thị booking card ngay trong khung chat.
- Phase 3:
  - RFM service trên Node.js.
  - Cron job phân loại RFM hằng ngày.
  - Cancellation score service để chống boom lịch.
  - Booking kiểm tra rủi ro và yêu cầu cọc online nếu điểm rủi ro cao.
  - ManageCustomers hiển thị segment RFM.
- Phase 4:
  - Backend socket.io cho dashboard realtime.
  - Dashboard admin nhận event realtime và tự fallback polling nếu socket lỗi.

### File và migration quan trọng

- `database/migration_smart_booking_features.sql`
- `database/migration_add_voucher_system.sql`
- `database/recreate_booking_system.sql`
- `backend/src/jobs/appointmentReminderJob.js`
- `backend/src/jobs/rfmClassificationJob.js`
- `backend/src/services/rfmService/index.js`
- `backend/src/services/cancellationScoreService/index.js`
- `backend/src/utils/openAiChat/index.js`
- `backend/src/utils/realtime/index.js`
- `frontend/src/components/BottomNav/BottomNav.js`
- `frontend/src/pages/Booking/Booking.js`
- `frontend/src/pages/ChatBot/ChatBot.js`
- `frontend/src/pages/admin/Dashboard/Dashboard.js`
- `frontend/src/pages/admin/ManageCustomers/ManageCustomers.js`

### Kiểm tra đã chạy

- Backend syntax check: OK.
- Migration Smart Booking: OK.
- `npm run build` frontend: OK.
- API smoke:
  - Login admin/customer: OK.
  - Cancellation score: OK.
  - RFM stats: OK.
  - Voucher của khách: OK.
  - Socket client: OK.

### Trạng thái local

- Backend: `http://localhost:5000`
- Frontend: `http://localhost:3000`

Nếu gặp lỗi `EADDRINUSE :::5000`, nghĩa là backend cũ đang chạy sẵn. Dùng:

```powershell
netstat -ano | Select-String ":5000"
Stop-Process -Id <PID> -Force
```

## 2026-05-08 - Cải thiện UI/UX và Logic Hạng VIP

### Đã hoàn thành

- Sửa lỗi hiển thị ảnh dịch vụ (cập nhật đúng thư mục lưu trữ tĩnh `uploads/services`).
- Thêm thông báo thành công (Success Toast với hiệu ứng) khi thao tác thêm/sửa/xóa dịch vụ và danh mục.
- Nâng dung lượng upload Avatar lên 5MB và sửa lỗi mất dữ liệu profile (chỉ cập nhật trường `avatar` trong DB).
- Việt hóa biểu đồ "Phân bố trạng thái lịch hẹn" ở trang Analytics (hiển thị UI và xuất Excel).
- Căn chỉnh bảng "Phân tích khách hàng" ở Analytics cho đồng bộ.
- Cập nhật và đồng bộ tiêu chuẩn Hạng VIP trên toàn hệ thống (Frontend và Backend):
  - VVVIP: Từ 40.000.000đ
  - VVIP: Từ 20.000.000đ
  - VIP Vàng: Từ 10.000.000đ
  - VIP Bạc: Từ 5.000.000đ
  - VIP Đồng: Từ 3.000.000đ
  - Thành viên thường: Dưới 3.000.000đ

## 2026-06-12 - Phát triển V7: Hệ thống Phân Cụm Hành Vi Khách Hàng DEC (Dynamic Engagement Clustering)

### Đã hoàn thành

- Thiết kế và cài đặt thuật toán phân cụm hành vi động DEC trên Backend ([decClusteringService/index.js](file:///d:/Doantotnghiep/Code/backend/src/services/decClusteringService/index.js)).
- Xây dựng 7 cụm hành vi đặc trưng của khách hàng salon dựa trên Recency, Frequency, Monetary, Tỷ lệ hủy/Hoàn thành, Đa dạng dịch vụ và Nhịp điệu theo tháng.
- Thiết lập hệ thống nhãn tiềm năng (Potential status/labels) và staff hint riêng cho từng cụm hành vi.
- Tích hợp API Endpoint `/api/admin/dashboard/dec-clustering` hỗ trợ đầy đủ các bộ lọc thời gian động (Day, Week, Month, Year, All) và thuật toán phân ngưỡng phân vị động (Quantile threshold).
- Hoàn thiện UI trang Analytics Strategy (`/admin/analytics/strategy`) dành cho Quản trị viên với 4 góc nhìn phân tích chuyên sâu:
  - **Bảng danh sách chiến lược**: Hiển thị chi tiết khách hàng và chiến lược hành động cụ thể theo tháng, hỗ trợ tìm kiếm/lọc và xuất báo cáo Excel định dạng chuẩn.
  - **Đặc trưng chi tiết**: Hiển thị bảng mô tả đặc tính thống kê trung bình của từng cụm (Table 7).
  - **Biểu đồ cụm (Figure 4)**: Vẽ biểu đồ so sánh các thông số trung bình quy đổi của các cụm bằng Chart.js.
  - **Chiến lược hành động (Table 8)**: Khung ma trận chiến lược liên kết hành động, lý do và tác động kỳ vọng.
- Tích hợp [CustomerInsightBadge.js](file:///d:/Doantotnghiep/Code/frontend/src/components/CustomerInsightBadge/CustomerInsightBadge.js) hiển thị cụm DEC và phân nhóm tiềm năng trên giao diện quản lý lịch hẹn (`ManageAppointments`).


