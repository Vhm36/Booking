# Gợi Ý PPT Báo Cáo - Smart Booking Salon (Bản Chi Tiết)

Tài liệu này cung cấp nội dung chi tiết, các ý chính (bullet points) để đưa lên slide, và kịch bản thuyết trình (những gì sinh viên sẽ nói) cho từng phần.

---

## 1. Trình Bày Tổng Quan Đề Tài

**Tên dự án:** Thiết kế và xây dựng ứng dụng website đặt lịch hẹn trực tuyến kết hợp phân tích dữ liệu hành vi khách hàng.

**A. Lý do chọn đề tài:**
*   **Thực trạng tại các cơ sở làm đẹp (Salon, Spa, Nail):**
    *   **Quản lý thủ công:** Ghi chép sổ sách hoặc file Excel dễ dẫn đến sai sót, nhầm lẫn thời gian, trùng lịch nhân viên (đặc biệt trong giờ cao điểm).
    *   **Trải nghiệm khách hàng kém:** Khách hàng thụ động, phải gọi điện hoặc nhắn tin chờ phản hồi mới biết lịch trống hay giá dịch vụ.
*   **Rủi ro vận hành (Vấn nạn Boom lịch - No show):**
    *   Tình trạng khách hàng đặt lịch nhưng không đến làm lãng phí thời gian của nhân viên, từ chối các khách hàng khác, gây thất thoát doanh thu. Các cửa hàng hiện chưa có công cụ đo lường mức độ uy tín của khách.
*   **Thiếu chiến lược cá nhân hóa (Marketing):**
    *   Các cơ sở thường áp dụng khuyến mãi đại trà. Dữ liệu khách hàng chưa được khai thác để phân loại và chăm sóc đúng đối tượng (như khách VIP cần tri ân, khách lâu không quay lại cần lôi kéo).

**B. Tính cấp thiết của đề tài:**
*   Chuyển đổi số trong ngành dịch vụ làm đẹp không chỉ dừng lại ở việc "đưa lên online". Hệ thống cần thông minh hơn: ứng dụng phân tích dữ liệu và AI để **tối ưu hóa doanh thu**, **giảm thiểu rủi ro**, và **nâng cao lòng trung thành của khách hàng**.

---

## 2. Nội Dung, Phạm Vi, Phương Pháp Nghiên Cứu

**A. Nội dung nghiên cứu:**
*   **Nghiên cứu quy trình nghiệp vụ:** Chuẩn hóa quy trình đặt lịch, thanh toán, quản lý ca làm việc nhân viên của salon.
*   **Tích hợp thuật toán & AI:**
    *   Ứng dụng mô hình RFM (Recency - Frequency - Monetary) để phân cụm khách hàng tự động.
    *   Xây dựng hệ thống tính điểm rủi ro hủy lịch (Cancellation Score).
    *   Nghiên cứu tích hợp Large Language Model (LLM) qua OpenAI API để tạo Chatbot có khả năng thao tác nghiệp vụ (Function Calling).

**B. Phạm vi nghiên cứu:**
*   **Kiến trúc hệ thống:** Ứng dụng Web Fullstack (Client-Server). Giao diện khách hàng hỗ trợ PWA (Progressive Web App) mang lại trải nghiệm như app điện thoại.
*   **Công nghệ sử dụng:** ReactJS (Frontend), Node.js/Express (Backend), MySQL (Database), Socket.io (Realtime).
*   **Giới hạn đề tài:** Tập trung vào mảng dịch vụ làm đẹp (Salon tóc, Spa chăm sóc da).

**C. Phương pháp nghiên cứu:**
*   **Khảo sát & Thu thập số liệu:** Lấy yêu cầu thực tế từ quy trình vận hành salon.
*   **Phân tích & Thiết kế hệ thống (UML/ERD):** Vẽ biểu đồ Use-case, luồng dữ liệu tuần tự (Sequence Diagram), thiết kế cơ sở dữ liệu quan hệ (17 bảng).
*   **Mô hình phát triển:** Phát triển phần mềm theo mô hình linh hoạt (Agile), liên tục kiểm thử và hoàn thiện.

---

## 3. Sản Phẩm Của Đề Tài

Sản phẩm là hệ thống **BeautyBook v3.0 (Smart Booking AI-Powered)** với các module chi tiết:

**A. Phân hệ người dùng (4 Vai trò):**
1.  **Khách hàng (Customer):** Đăng ký/Đăng nhập, xem dịch vụ theo danh mục, đặt lịch (chọn ngày/giờ/nhân viên/nhiều dịch vụ), ví Voucher, theo dõi lịch sử và hóa đơn, thanh toán online (VNPay/VietQR).
2.  **Nhân viên (Staff):** Xem lịch làm việc cá nhân, theo dõi lịch hẹn được phân công, đánh dấu hoàn thành dịch vụ, đăng ký nghỉ phép có hiệu lực ngay.
3.  **Thu ngân (Cashier):** Quản lý lịch hẹn tổng thể trong ngày, hỗ trợ check-in, đối soát và xác nhận thanh toán.
4.  **Quản trị viên (Admin):** Quản lý danh mục, dịch vụ, nhân viên, ca làm việc, khách hàng, voucher. Xem Dashboard thống kê tổng quan.

**B. Ba tính năng "Thông minh" cốt lõi (Điểm nhấn đề tài):**
1.  **Hệ thống phân tích rủi ro (Cancellation Score):**
    *   Thuật toán đánh giá khách hàng dựa trên: Lịch sử hủy lịch (40%), Đặt sát giờ (20%), Điểm thành viên (20%), Số lần No-show (10%), Ngày cuối tuần (10%).
    *   *Kết quả:* Nếu điểm > 70/100, hệ thống tự động khóa phương thức thanh toán tiền mặt và yêu cầu phải đặt cọc (Deposit) 20% - 30% qua mạng để giữ chỗ.
2.  **Marketing tự động (Mô hình RFM):**
    *   Hệ thống chạy ngầm hàng đêm (Cron Job lúc 03:00 sáng). Đánh giá khách dựa trên: Lần cuối sử dụng dịch vụ, Tần suất, Tổng tiền.
    *   *Kết quả:* Tự động gắn nhãn khách hàng (Ví dụ: Champions, At Risk) và tự động cấp phát các loại Voucher tương ứng vào ví khách hàng.
3.  **AI Chatbot (Function Calling + Sentiment Analysis):**
    *   Không chỉ là chatbot hỏi đáp FAQ (hỏi đáp theo kịch bản).
    *   *Kết quả:* AI có khả năng nhận diện cảm xúc khách hàng (hài lòng/phàn nàn), trực tiếp truy vấn cơ sở dữ liệu để tìm giờ trống và "tạo lịch hẹn thay" cho khách hàng qua khung chat.

---

## 4. Kế Hoạch Thực Hiện

*(Có thể trình bày dưới dạng Gantt Chart hoặc Timeline các tuần)*

*   **Tuần 1-2:** Khảo sát yêu cầu, thiết kế kiến trúc phần mềm, xây dựng tài liệu thiết kế (ERD, Mockup UI).
*   **Tuần 3-5:** Xây dựng cơ sở dữ liệu (MySQL), tạo bộ API Backend cơ bản (Auth, CRUD) và giao diện Admin Dashboard.
*   **Tuần 6-8:** Phát triển luồng nghiệp vụ cốt lõi: Đặt lịch (kiểm tra trùng lặp), phân công nhân viên, tích hợp thanh toán (VNPay/VietQR).
*   **Tuần 9-11:** Nghiên cứu và triển khai các thuật toán thông minh: Mô hình RFM, Cancellation Score, tích hợp OpenAI Chatbot.
*   **Tuần 12-14:** Triển khai WebSocket (Realtime Dashboard), kiểm thử (Testing), sửa lỗi (Bug fixing) và hoàn thiện báo cáo.

---

## 5. Tiến Độ Thực Hiện Hiện Tại (So Với Kế Hoạch)

**A. Đã làm được (~98% khối lượng công việc):**
*   **Hoàn thiện nền tảng Fullstack:** Toàn bộ luồng đặt lịch, thanh toán, quản lý khách hàng/nhân sự/dịch vụ đã hoạt động trơn tru.
*   **Tích hợp công nghệ Realtime:** Dashboard của quản trị viên và thu ngân tự động nhảy số, nhảy biểu đồ khi có đơn đặt lịch mới (nhờ Socket.io) mà không cần reload trang.
*   **Chạy tự động các tiến trình (Background Jobs):** Mô hình tính điểm rủi ro (Cancellation Score) và phân loại khách hàng (RFM) tính toán chính xác dữ liệu thực tế.
*   **AI Chatbot:** Hoạt động ổn định với tính năng gợi ý câu hỏi (Suggestions) và gọi hàm tạo đặt lịch.

**B. Chưa làm được / Dự kiến nâng cấp:**
*   Chưa triển khai (Deploy) chính thức lên máy chủ Cloud (hiện vẫn đang demo trên Localhost).
*   Chưa tích hợp gửi thông báo đa kênh qua Zalo ZNS hoặc SMS (hiện mới hỗ trợ qua thông báo Realtime trong app và hệ thống cảnh báo).

**C. Khó khăn gặp phải:**
1.  **Bài toán xử lý trùng lịch nhân viên:** Khách hàng có thể chọn *nhiều dịch vụ cùng lúc*, hệ thống phải cộng dồn thời lượng từng dịch vụ, kiểm tra khoảng thời gian đó nhân viên có bị vướng lịch của khách khác hoặc trùng vào giờ nghỉ phép hay không. Việc truy vấn SQL ở phần này khá phức tạp.
2.  **Tối ưu AI Chatbot:** Cần tinh chỉnh Prompt (câu lệnh hướng dẫn AI) rất kỹ để bot không "ảo giác", chỉ trả lời về dịch vụ làm đẹp và tuân thủ đúng định dạng dữ liệu truyền vào API.
3.  **Bảo mật API:** Việc mở API cho WebApp dễ bị spam, phải thiết lập cơ chế Rate-Limit (giới hạn truy cập) để bảo vệ hệ thống.

---

## 6. Tài Liệu Tham Khảo

1. Tài liệu chính thức React.js (react.dev) và Node.js (nodejs.org).
2. Tài liệu thiết kế API RESTful và xác thực bảo mật JWT (JSON Web Tokens).
3. "RFM Analysis for Customer Segmentation" - Các nghiên cứu chuyên sâu về phân tích hành vi khách hàng trong Marketing.
4. Tài liệu lập trình Realtime với Socket.io.
5. Tài liệu tích hợp thanh toán mã QR: VietQR Open API và VNPay API Documentation.
6. Hướng dẫn sử dụng tính năng Function Calling của OpenAI API.

---

## 7. Kịch Bản Demo Sản Phẩm (Dành Cho Buổi Báo Cáo)

**Bước 1: Trải nghiệm khách hàng (Customer Flow) - [3 phút]**
*   Trình chiếu giao diện PWA khách hàng cực kỳ trực quan.
*   Khách hàng đăng nhập, chọn 3 dịch vụ làm đẹp (Cắt tóc, Gội đầu, Uốn), chọn ngày, chọn nhân viên yêu thích.
*   *Nhấn mạnh tính năng hủy lịch:* Dùng 1 tài khoản có lịch sử hủy nhiều lần, lúc đặt lịch hệ thống sẽ bật cảnh báo "Rủi ro cao" và vô hiệu hóa nút "Thanh toán tại quán", bắt buộc quét mã VietQR/VNPay đặt cọc trước 30%.
*   Tiến hành thanh toán và xem lịch sử đơn.

**Bước 2: Trải nghiệm Trợ lý ảo (AI Chatbot) - [2 phút]**
*   Vào trang Chat, gõ: *"Cuối tuần này tôi muốn làm tóc, salon còn giờ nào và có nhân viên nào giỏi không?"*
*   Chatbot tự động tìm thông tin trong DB, phản hồi và hiển thị Form cho phép chốt lịch ngay trong khung chat.

**Bước 3: Trải nghiệm Admin & Dashboard Realtime - [2 phút]**
*   Mở trình duyệt Admin. Để song song 2 màn hình (1 của Admin, 1 của Khách).
*   Bên khách bấm nút "Hủy lịch hẹn" vừa đặt. Ngay lập tức màn hình Admin hiện thông báo chớp nháy (Notification) và biểu đồ "Tỷ lệ hủy" tăng vọt lên mà Admin không hề chạm vào chuột (Tính năng Realtime).

**Bước 4: Marketing tự động (RFM & Voucher) - [2 phút]**
*   Admin vào tab Quản lý khách hàng, show ra danh sách khách đã được dán nhãn tự động ("VIP", "Nguy cơ rời bỏ").
*   Mở phần Voucher, chứng minh các Voucher đã được nhắm mục tiêu chuẩn xác đẩy thẳng vào ví khách hàng thuộc nhóm cần chăm sóc.

---

## 8. Dự Trù Những Câu Hỏi Do Hội Đồng Hỏi

*(Đọc kỹ để chuẩn bị câu trả lời lưu loát nhất)*

**Câu 1: Điểm rủi ro hủy lịch (Cancellation Score) hoạt động cụ thể như thế nào? Có cơ sở khoa học hay tự nhóm nghĩ ra?**
*   *Trả lời:* Hệ thống tính điểm dựa trên 5 tham số có trọng số: Tỷ lệ hủy trước đây (40%), Đặt sát giờ - dưới 2 tiếng (20%), Xếp hạng khách hàng RFM (20%), Lịch sử vắng mặt không báo trước (10%) và Yếu tố ngày cuối tuần đông khách (10%). Công thức này được nhóm nghiên cứu dựa trên các bài toán quản lý rủi ro trong ngành nhà hàng/khách sạn và điều chỉnh riêng cho salon. Nếu tổng điểm > 70, khách phải thanh toán cọc online.

**Câu 2: Làm thế nào hệ thống đảm bảo 2 khách hàng không đặt trùng 1 nhân viên cùng 1 lúc?**
*   *Trả lời:* Backend của em không chỉ lưu "Giờ bắt đầu" mà còn tính toán "Giờ kết thúc" (Bằng Giờ bắt đầu + Tổng thời lượng các dịch vụ đã chọn). Khi lưu dữ liệu, hệ thống sử dụng thuật toán kiểm tra xung đột thời gian (Time Conflict Check) truy vấn SQL xem khoảng thời gian từ `[Bắt đầu] -> [Kết thúc]` của nhân viên đó có giao với bất kỳ lịch hẹn nào đang `Pending` hoặc `Confirmed` hay không. Ngoài ra, Database cũng thiết lập Index để tăng tốc độ truy vấn này.

**Câu 3: Mô hình RFM chạy bằng cách nào? Có tốn tài nguyên server không?**
*   *Trả lời:* Việc phân tích RFM đòi hỏi duyệt qua toàn bộ lịch sử thanh toán và đặt lịch của khách hàng, vì vậy nó rất tốn tài nguyên. Để giải quyết, nhóm không tính RFM mỗi khi khách vào xem, mà sử dụng thư viện `node-cron` tạo một Background Job (Tiến trình chạy ngầm). Cron job này được cài đặt chỉ chạy vào lúc 03:00 sáng hàng ngày - lúc server ít truy cập nhất, để cập nhật điểm RFM cho toàn bộ DB một lần duy nhất.

**Câu 4: AI Chatbot của em gọi API từ OpenAI, vậy nhược điểm của nó là gì?**
*   *Trả lời:* Nhược điểm thứ nhất là độ trễ (Latency), đôi khi mất 2-3 giây để API trả lời. Nhược điểm thứ hai là phụ thuộc vào mạng internet và chi phí sử dụng API. Nhược điểm thứ ba là hiện tượng "ảo giác" (Hallucination) - AI có thể trả lời sai nếu không được cấp Context (Ngữ cảnh) đầy đủ. Nhóm đã khắc phục bằng cách cấu hình Prompt rất chặt chẽ, đóng khung vai trò chỉ là "Trợ lý Salon", nếu khách hỏi về chính trị/xã hội, AI sẽ từ chối trả lời.

**Câu 5: Dashboard realtime của em dùng cơ chế gì? Nếu mất kết nối mạng thì sao?**
*   *Trả lời:* Nhóm sử dụng thư viện `Socket.io` chạy trên nền công nghệ WebSocket. Khi có sự kiện (như thanh toán thành công), Server gửi Event đẩy sang Client thay vì Client phải gọi lên hỏi (Polling). Nếu Client bị đứt cáp/mất mạng, hệ thống có cơ chế "Fallback" (dự phòng) tự động chuyển sang gọi HTTP API chu kỳ 30 giây/lần để đảm bảo dữ liệu không bị lỗi thời, và tự nối lại Socket khi có mạng.

**Câu 6: Em quản lý bảo mật phân quyền trong dự án như thế nào?**
*   *Trả lời:* Hệ thống sử dụng JWT (JSON Web Token) cho xác thực. Phía Frontend ẩn/hiện menu dựa vào role của Token. Phía Backend quan trọng hơn, nhóm thiết kế các `Middleware` kiểm tra Token ở mọi API (trừ API public). Nếu Nhân viên (Staff) cố tình gọi API xóa dịch vụ của Admin bằng công cụ như Postman, Middleware sẽ chặn lại và trả về lỗi 403 Forbidden. Mật khẩu khách hàng cũng được mã hóa một chiều bằng chuỗi Hash (Bcrypt) trước khi lưu vào Database.

**Câu 7: Tại sao hệ thống này lại chọn Cơ sở dữ liệu quan hệ (SQL/MySQL) thay vì NoSQL (như MongoDB)?**
*   *Trả lời:* Nhóm quyết định chọn SQL (MySQL) vì 3 lý do cốt lõi phù hợp với đặc thù của hệ thống đặt lịch:
    1.  **Tính quan hệ dữ liệu cực kỳ cao (Highly Relational):** Nghiệp vụ đặt lịch liên kết chặt chẽ với nhau: 1 *Lịch hẹn* thuộc về 1 *Khách hàng*, do 1 *Nhân viên* làm, bao gồm nhiều *Dịch vụ*, áp dụng 1 *Voucher* và có 1 *Hóa đơn thanh toán*. SQL với các bảng (Tables) và khóa ngoại (Foreign Keys), lệnh JOIN sinh ra để xử lý các mối quan hệ chằng chịt này một cách tối ưu. Nếu dùng MongoDB (Document-based), việc nhúng (embed) hay tham chiếu (reference) dữ liệu chéo nhau sẽ rất phức tạp và khó đồng bộ khi cập nhật (ví dụ: đổi giá dịch vụ).
    2.  **Tính toàn vẹn dữ liệu (ACID) & Giao dịch thanh toán:** Khi khách thanh toán, hệ thống phải thực hiện cùng lúc 3 việc: Cập nhật trạng thái lịch, Tạo record thanh toán, Cập nhật trạng thái Voucher. SQL đảm bảo tính toàn vẹn tuyệt đối qua Transaction (Giao dịch). Nếu 1 bước lỗi, toàn bộ tiến trình sẽ Rollback lại (hủy bỏ) để không bị sai lệch số liệu tiền bạc.
    3.  **Hỗ trợ truy vấn phân tích (Analytics & RFM):** Dự án có tính năng tính điểm RFM và Dashboard thống kê doanh thu. Các câu lệnh tính tổng (SUM), đếm (COUNT), gom nhóm (GROUP BY) theo thời gian của SQL mạnh mẽ và tối ưu hơn rất nhiều so với Aggregation Pipeline của MongoDB.
