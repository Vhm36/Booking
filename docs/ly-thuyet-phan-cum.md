# Kiến thức Học máy & Thuật toán Phân tích trong BeautyBook

Tài liệu này trình bày chi tiết về nền tảng lý thuyết học máy không giám sát (Unsupervised Machine Learning) và các thuật toán phân tích thông minh được thiết kế, cài đặt trực tiếp trong mã nguồn của hệ thống **BeautyBook**.

## 0. Kiến trúc tổng quan và luồng dữ liệu hệ thống

BeautyBook được thiết kế theo kiến trúc web fullstack gồm **React Frontend**, **Express Backend**, **MySQL Database** và một lớp **Python Analytics Runtime** cho các thuật toán phân tích dữ liệu. Frontend chịu trách nhiệm hiển thị giao diện và thu thập thao tác người dùng; backend xử lý API, xác thực, nghiệp vụ đặt lịch, thanh toán, voucher và realtime; database lưu toàn bộ dữ liệu vận hành; còn Python xử lý các mô hình như RFM, K-Means và DEC.

```mermaid
graph TD
    U[Người dùng / Admin / Nhân viên] --> FE[React Frontend + PWA]
    FE --> API[Express REST API]
    FE --> WS[Socket.io Client]

    API --> AUTH[Xác thực JWT + phân quyền]
    AUTH --> C[Controller Layer]
    C --> S[Service Layer]
    S --> M[Model / Query Layer]
    M --> DB[(MySQL Database)]

    S --> PY[Python Analytics Runtime<br/>customer_analytics.py]
    PY --> S

    API --> IO[Socket.io Server]
    IO --> WS

    CRON[node-cron Jobs] --> S
    CRON --> PY
    CRON --> DB
```

### 0.1. Các lớp chính trong hệ thống

| Lớp | Thành phần | Vai trò |
| :--- | :--- | :--- |
| **Frontend** | React, PWA, Axios service layer | Hiển thị giao diện đặt lịch, dịch vụ, dashboard, chatbot, voucher; gửi request tới backend qua REST API. |
| **API Gateway/Application** | Express `app.js`, route middleware, JWT | Nhận request, kiểm tra token, phân quyền `customer`, `staff`, `admin`, chuyển request tới controller phù hợp. |
| **Controller** | `appointmentController`, `serviceController`, `dashboardController`, `voucherController` | Điều phối nghiệp vụ theo từng API, gom dữ liệu request, gọi service/model và trả response JSON. |
| **Service** | `cancellationScoreService`, `clusteringService`, `rfmService`, `decClusteringService`, `serviceRecommendationService` | Chứa logic nghiệp vụ và phân tích dữ liệu: tính điểm rủi ro, gợi ý dịch vụ, phân cụm khách hàng, tạo chiến lược chăm sóc. |
| **Model/Query** | `appointmentModel`, `customerModel`, `serviceModel`, `paymentModel` | Truy vấn MySQL, tạo/cập nhật lịch hẹn, khách hàng, dịch vụ, thanh toán. |
| **Python Analytics** | `backend/ml/customer_analytics.py` | Nhận JSON từ Node.js, chạy RFM, StandardScaler, K-Means, DEC rồi trả kết quả JSON về backend. |
| **Database** | MySQL | Lưu users, appointments, services, payments, vouchers, chat, phân khúc khách hàng và chỉ số hành vi. |
| **Realtime/Jobs** | Socket.io, node-cron | Cập nhật dashboard realtime, nhắc lịch, chạy phân tích RFM/K-Means định kỳ và tự động hóa voucher. |

### 0.2. Luồng dữ liệu chính của hệ thống

Luồng dữ liệu nền tảng của BeautyBook đi theo hướng **Frontend -> API -> Controller -> Service/Model -> MySQL -> Response**. Với các chức năng cần phân tích học máy, backend sẽ gọi thêm Python runtime bằng JSON qua stdin/stdout.

```mermaid
sequenceDiagram
    participant FE as React Frontend
    participant API as Express API
    participant CTL as Controller
    participant SVC as Service
    participant DB as MySQL
    participant PY as Python Analytics

    FE->>API: Request REST + JWT
    API->>API: verifyToken + phân quyền
    API->>CTL: Chuyển tới controller
    CTL->>SVC: Gọi nghiệp vụ
    SVC->>DB: Đọc/ghi dữ liệu
    alt Cần phân tích mô hình
        SVC->>PY: Gửi JSON dữ liệu hành vi
        PY-->>SVC: Trả JSON kết quả mô hình
        SVC->>DB: Lưu segment/score/insight
    end
    SVC-->>CTL: Kết quả xử lý
    CTL-->>FE: Response JSON
```

Ví dụ các dữ liệu đi qua hệ thống:

- Dữ liệu tài khoản đi từ màn hình đăng ký/đăng nhập vào `users`.
- Dữ liệu dịch vụ đi từ trang dịch vụ/admin vào `services` và `service_category`.
- Dữ liệu đặt lịch đi vào `appointments` và `appointment_services`.
- Dữ liệu thanh toán đi vào `payments`.
- Dữ liệu phân tích hành vi được tổng hợp từ `users`, `appointments`, `appointment_services`, `services`, sau đó lưu ngược lại vào `users.customer_segment`, `users.rfm_score`, `users.cancellation_rate` hoặc trả về dashboard.

### 0.3. Luồng chính khi người dùng sử dụng hệ thống

Luồng chính bắt đầu từ việc người dùng truy cập frontend, xem dịch vụ, đăng nhập, đặt lịch, theo dõi trạng thái lịch và nhận voucher/gợi ý phù hợp.

```mermaid
graph TD
    A[Người dùng mở website/PWA] --> B[Xem trang chủ và danh sách dịch vụ]
    B --> C[Đăng nhập hoặc đăng ký]
    C --> D[Chọn dịch vụ, nhân viên, ngày giờ]
    D --> E[Backend kiểm tra lịch trống và rủi ro hủy]
    E --> F[Tạo booking và thanh toán/cọc nếu cần]
    F --> G[Lưu appointments/payments/voucher usage]
    G --> H[Dashboard admin nhận realtime update]
    G --> I[Cron job/Python analytics cập nhật phân khúc khách hàng]
    I --> J[Voucher, DEC strategy, gợi ý dịch vụ cá nhân hóa]
```

Trong luồng này, frontend không tự xử lý nghiệp vụ nhạy cảm như tính rủi ro, kiểm tra voucher hay tính phân khúc. Các phần đó đều được backend kiểm tra lại để tránh sai lệch dữ liệu và đảm bảo phân quyền.

### 0.4. Luồng đặt lịch chi tiết

Luồng đặt lịch là luồng nghiệp vụ quan trọng nhất, kết nối nhiều module: dịch vụ, nhân viên, voucher, cancellation score, payment, realtime dashboard và phân tích khách hàng.

```mermaid
sequenceDiagram
    participant U as Khách hàng
    participant FE as Booking UI
    participant API as Booking API
    participant CS as CancellationScoreService
    participant VS as VoucherService
    participant AM as AppointmentModel
    participant PM as PaymentService
    participant DB as MySQL
    participant IO as Socket.io

    U->>FE: Chọn dịch vụ, nhân viên, ngày giờ, voucher
    FE->>API: POST /api/bookings/cancellation-score
    API->>CS: Tính rủi ro từ users.cancellation_rate, segment, no-show, lead time
    CS->>DB: Đọc users + appointments
    CS-->>FE: score, riskLevel, requireDeposit

    FE->>API: POST /api/bookings
    API->>VS: Validate voucher nếu có
    VS->>DB: Kiểm tra voucher, assignment, điều kiện áp dụng
    API->>AM: Tạo appointment
    AM->>DB: Insert appointments + appointment_services
    API->>PM: Tạo payment/deposit nếu cần
    PM->>DB: Insert payments
    API->>IO: Emit dashboard:update
    API-->>FE: Booking result + payment info
```

Các bước xử lý chính:

1. Khách hàng chọn dịch vụ, ngày giờ, nhân viên và voucher trên frontend.
2. Frontend gọi API `POST /api/bookings/cancellation-score` để tính **Cancellation Score** trước khi tạo lịch.
3. Backend lấy `users.cancellation_rate` theo phần trăm $0 - 100$, lịch sử no-show, phân khúc khách hàng và thời gian đặt lịch để tính điểm rủi ro.
4. Nếu điểm rủi ro cao, hệ thống yêu cầu đặt cọc và hạn chế thanh toán tiền mặt.
5. Backend kiểm tra voucher, kiểm tra dữ liệu dịch vụ/nhân viên, tạo dòng trong `appointments` và `appointment_services`.
6. Nếu có thanh toán online hoặc đặt cọc, backend tạo bản ghi trong `payments`.
7. Dashboard admin nhận sự kiện realtime qua Socket.io.
8. Khi lịch bị hủy hoặc đổi trạng thái, backend refresh lại `users.cancellation_rate` để lần đặt lịch sau phản ánh đúng hành vi mới nhất.

### 0.5. Luồng gợi ý từ mô hình và dữ liệu hành vi

Hệ thống có hai lớp gợi ý: gợi ý dịch vụ trực tiếp trên trang dịch vụ và gợi ý chiến lược/nhóm khách từ mô hình phân tích.

#### 0.5.1. Gợi ý dịch vụ trực tiếp

Luồng này phục vụ người dùng khi đang xem chi tiết một dịch vụ. Backend dựa trên lịch sử đặt dịch vụ của nhiều khách hàng để tìm các dịch vụ thường được đặt cùng hoặc cùng nhóm.

```mermaid
graph TD
    A[ServiceDetail.js] --> B[GET /api/services/recommendations]
    B --> C[serviceController.getServiceRecommendations]
    C --> D[serviceRecommendationService]
    D --> E[Đọc appointments + appointment_services + services]
    E --> F[Tính overlap customers, confidence, support, lift]
    F --> G[Fallback theo category/trending nếu thiếu dữ liệu]
    G --> H[Trả danh sách dịch vụ gợi ý + lý do]
    H --> I[Frontend hiển thị gợi ý dịch vụ đi kèm]
```

Kết quả trả về không chỉ có dịch vụ, mà còn có lý do gợi ý như: khách từng đặt dịch vụ A cũng thường đặt dịch vụ B, hoặc dịch vụ cùng danh mục/đang được đặt nhiều.

#### 0.5.2. Gợi ý từ mô hình RFM, K-Means và DEC

Luồng này phục vụ admin và hoạt động chăm sóc khách hàng. Dữ liệu lịch sử được tổng hợp, đưa sang Python để phân tích, sau đó backend lưu hoặc trả kết quả về dashboard.

```mermaid
sequenceDiagram
    participant JOB as Cron/Admin Trigger
    participant SVC as Node.js Analytics Service
    participant DB as MySQL
    participant PY as Python customer_analytics.py
    participant UI as Admin Dashboard

    JOB->>SVC: Chạy RFM/K-Means/DEC
    SVC->>DB: Lấy users, appointments, services
    SVC->>PY: Gửi JSON dữ liệu hành vi
    PY->>PY: StandardScaler, RFM scoring, K-Means, DEC rules
    PY-->>SVC: Trả segment, cluster, thresholds, insights
    SVC->>DB: Cập nhật users.customer_segment, rfm_score
    SVC-->>UI: Trả DEC report/strategy
```

Các nguồn dữ liệu chính của luồng mô hình:

- `users`: thông tin khách hàng, phân khúc hiện tại, `cancellation_rate`, `rfm_score`.
- `appointments`: lịch sử đặt lịch, trạng thái hoàn thành/hủy, ngày gần nhất, tổng số booking.
- `appointment_services`: nhiều dịch vụ trong một lịch hẹn, dùng để hiểu khách hay dùng dịch vụ nào.
- `services`: giá, danh mục, thời lượng và trạng thái dịch vụ.
- `payments`: trạng thái thanh toán và dữ liệu cọc/thanh toán online.

Kết quả mô hình được dùng cho ba mục đích:

- **Phân khúc khách hàng**: cập nhật `users.customer_segment` như `Champions`, `Loyal Customers`, `Potential Loyalists`, `Need Attention`, `At Risk`.
- **Chống boom lịch**: dùng segment và `cancellation_rate` làm đầu vào cho Cancellation Score.
- **Gợi ý chăm sóc/marketing**: dashboard DEC đưa ra nhóm hành vi và chiến lược như nhắc lịch, yêu cầu cọc, gửi voucher quay lại, gợi ý combo hoặc chăm sóc VIP.

### 0.6. Tóm tắt đường đi dữ liệu

| Luồng | Dữ liệu vào | Xử lý chính | Dữ liệu ra |
| :--- | :--- | :--- | :--- |
| **Luồng chính** | Request từ frontend, JWT | Xác thực, phân quyền, gọi controller/service/model | Response JSON, cập nhật UI |
| **Luồng đặt lịch** | Dịch vụ, nhân viên, ngày giờ, voucher | Cancellation Score, validate voucher, tạo appointment/payment | Booking mới, payment, realtime dashboard |
| **Luồng hủy lịch** | Appointment đổi sang `cancelled` | Refresh `users.cancellation_rate` từ lịch sử booking | Tỷ lệ hủy user 0-100%, score lần sau chính xác hơn |
| **Luồng RFM/K-Means** | Users + appointments + cancellation rate | Python RFM, StandardScaler, K-Means | `customer_segment`, `rfm_score`, thống kê segment |
| **Luồng DEC** | Booking theo ngày/tuần/tháng/năm | Python tính ngưỡng, gán cụm hành vi, Node tạo strategy | DEC report cho dashboard |
| **Luồng gợi ý dịch vụ** | Service đang xem + lịch sử đặt dịch vụ | Association rule/fallback theo danh mục và độ phổ biến | Danh sách dịch vụ gợi ý và lý do |

---

## 1. Thuật toán Phân cụm Khách hàng K-Means

Dự án triển khai thuật toán phân cụm **K-Means bằng Python** để phân khúc khách hàng tự động dựa trên các chỉ số hành vi. Backend Node.js chịu trách nhiệm truy vấn dữ liệu từ MySQL và cập nhật kết quả vào hệ thống, còn phần học máy như chuẩn hóa dữ liệu, chạy K-Means, tính RFM và phân cụm DEC được xử lý trong script Python.

**Vị trí mã nguồn**: [clusteringService/index.js](file:///d:/Doantotnghiep/Code/backend/src/services/clusteringService/index.js)
**Mã thuật toán Python**: [customer_analytics.py](file:///d:/Doantotnghiep/Code/backend/ml/customer_analytics.py)
**Yêu cầu môi trường**: máy chủ cần cài Python 3 và có lệnh `python`/`python3` trong `PATH`, hoặc cấu hình biến môi trường `PYTHON_BIN` trỏ tới file thực thi Python.

### Quy trình phân cụm 5 bước trong hệ thống:

```mermaid
graph TD
    A[Node.js trích xuất RFM + Cancel Rate từ DB] --> B[Gửi dữ liệu JSON sang Python]
    B --> C[Python chuẩn hóa StandardScaler]
    C --> D[Python chạy K-Means++ và K-Means]
    D --> E[Python trả kết quả cụm về Node.js]
    E --> F[Cập nhật segment vào bảng users]
```

### 1.1. Trích xuất đặc trưng (Feature Extraction)
Hệ thống trích xuất 4 thuộc tính hành vi cốt lõi từ bảng `appointments` của từng khách hàng:
- **Recency ($R$)**: Số ngày kể từ lần hẹn gần nhất của khách hàng tới thời điểm hiện tại.
- **Frequency ($F$)**: Tổng tần suất đặt lịch hẹn (giao dịch) phát sinh của khách.
- **Monetary ($M$)**: Tổng số tiền đã thanh toán cho các lịch hẹn hoàn thành.
- **Cancel Rate ($C$)**: Tỷ lệ hủy lịch hẹn hoặc không đến, tính bằng công thức:
  $$C = \frac{\text{Số lịch hủy} + \text{Số lịch không đến (No-Show)}}{\text{Tổng số lịch đặt}} \times 100$$

### 1.2. Chuẩn hóa đặc trưng (StandardScaler)
Do các thuộc tính có đơn vị đo lường và khoảng giá trị khác nhau (ví dụ: $Monetary$ có giá trị hàng triệu đồng trong khi $Frequency$ chỉ từ $1$ đến $10$), script Python sử dụng phương pháp **StandardScaler** để đưa từng biến đặc trưng về dạng có trung bình $0$ và độ lệch chuẩn $1$, tránh việc thuộc tính có thang đo lớn lấn át các thuộc tính khác:
$$x_{\text{scaled}} = \frac{x - \mu}{\sigma}$$
Trong đó $\mu$ là giá trị trung bình và $\sigma$ là độ lệch chuẩn của từng đặc trưng. Nếu $\sigma = 0$, giá trị chuẩn hóa được đặt bằng $0$ để tránh lỗi chia cho $0$.
*Cài đặt trong script Python `backend/ml/customer_analytics.py`, mode `kmeans`*.

### 1.3. Khởi tạo tâm cụm thông minh bằng K-Means++
Để giải quyết nhược điểm lớn của K-Means truyền thống (dễ rơi vào cực trị cục bộ do chọn tâm cụm ngẫu nhiên), script Python triển khai phương pháp khởi tạo **K-Means++**:
1. Chọn ngẫu nhiên tâm cụm đầu tiên ($c_1$) từ tập dữ liệu.
2. Với mỗi điểm dữ liệu $x$, tính khoảng cách ngắn nhất từ nó đến tâm cụm gần nhất đã được chọn: $D(x)$.
3. Chọn điểm dữ liệu tiếp theo làm tâm cụm mới với xác suất tỷ lệ thuận với bình phương khoảng cách: $P(x) = \frac{D(x)^2}{\sum D(y)^2}$.
4. Lặp lại bước 2 và 3 cho đến khi đủ $K$ tâm cụm.

### 1.4. Vòng lặp tối ưu hóa K-Means
- **Bước gán cụm (Assignment)**: Tính khoảng cách Euclidean giữa điểm dữ liệu đã chuẩn hóa $x$ và các tâm cụm (centroid) $c_j$:
  $$d(x, c_j) = \sqrt{\sum_{i=1}^{D} (x_{\text{norm}, i} - c_{j, i})^2}$$
  Điểm dữ liệu được gán vào cụm có khoảng cách ngắn nhất: $Cluster(x) = \arg\min_j d(x, c_j)$.
- **Bước cập nhật tâm cụm (Update)**: Định vị lại tâm cụm bằng cách lấy trung bình cộng tọa độ các điểm thuộc cụm đó.
- **Điều kiện dừng**: Thuật toán hội tụ khi các chỉ định cụm không còn thay đổi qua các vòng lặp hoặc khi đạt giới hạn `maxIterations = 100`.

### 1.5. Xếp hạng và Gán nhãn tự động cho cụm (Cluster Labeling)
Để biến các mã cụm thuần túy ($C_0, C_1...$) thành thông tin nghiệp vụ có nghĩa, hệ thống tính **Điểm chất lượng tâm cụm (Quality Score)** cho mỗi centroid dựa trên giá trị đã chuẩn hóa bằng StandardScaler:
$$Score = -R_{\text{scaled}} \times 0.25 + F_{\text{scaled}} \times 0.30 + M_{\text{scaled}} \times 0.30 - C_{\text{scaled}} \times 0.15$$
Các cụm được sắp xếp giảm dần theo điểm số này và gán nhãn lần lượt:
1. **Champions (Khách VIP)**: Điểm chất lượng cao nhất.
2. **Loyal Customers (Khách trung thành)**: Đặt hẹn đều đặn, chi tiêu ổn định.
3. **Potential Loyalists (Khách tiềm năng)**: Có xu hướng tương tác tốt.
4. **Need Attention (Cần chú ý)**: Tần suất giảm, bắt đầu thưa lịch.
5. **At Risk (Nguy cơ rời bỏ)**: Không hoạt động lâu ngày, tỷ lệ hủy cao.

Kết quả phân khúc được ghi nhận trực tiếp vào trường `customer_segment` và `rfm_score` trong bảng `users` nhằm phục vụ việc phân phối Voucher tự động.

### 1.6. RFM Scoring chạy bằng Python

Bên cạnh phân cụm K-Means, hệ thống vẫn sử dụng mô hình **RFM (Recency - Frequency - Monetary)** để chấm điểm khách hàng theo ba chiều hành vi chính. Điểm khác biệt là phần tính toán RFM không còn xử lý trực tiếp bằng JavaScript nữa, mà được chuyển sang Python:

1. Node.js truy vấn danh sách khách hàng và các chỉ số `recency`, `frequency`, `monetary` từ MySQL.
2. Dữ liệu được truyền sang `backend/ml/customer_analytics.py` qua stdin dưới dạng JSON.
3. Python sắp xếp khách hàng theo phân vị/quartile để gán điểm $R$, $F$, $M$ từ $1$ đến $4$.
4. Python ghép điểm thành `rfm_score` và gán nhãn như `Champions`, `Loyal Customers`, `Potential Loyalists`, `At Risk`, `Lost Customers`, `New Customers`, `Need Attention`.
5. Node.js nhận kết quả JSON từ Python và cập nhật lại bảng `users`.

Nhờ cách tách này, backend vẫn giữ luồng API và cron job hiện tại, nhưng phần thuật toán học máy/phân tích dữ liệu được thực thi bằng Python, phù hợp hơn với định hướng mở rộng sang các thư viện như Pandas, NumPy hoặc scikit-learn trong tương lai.

---

## 2. Mô hình Chống "Boom" Lịch (Cancellation Score Service)

Để bảo vệ các cửa hàng và nhân viên khỏi thiệt hại do khách hàng đặt hẹn ảo hoặc hủy lịch sát giờ, hệ thống xây dựng mô hình tính điểm rủi ro **Cancellation Score** dựa trên phương pháp kết hợp đa biến có trọng số (Weighted Scoring Model).

**Vị trí mã nguồn**: [cancellationScoreService/index.js](file:///d:/Doantotnghiep/Code/backend/src/services/cancellationScoreService/index.js)

### Cơ cấu tính điểm rủi ro và trọng số:

| Biến Đặc Trưng | Cơ Chế Tính Điểm | Trọng Số | Ý Nghĩa Thực Tế |
| :--- | :--- | :--- | :--- |
| **Lịch sử hủy hẹn (Cancellation Rate)** | Tỷ lệ lịch hủy trong tổng số lịch hẹn đã đặt của khách hàng, được lưu trực tiếp tại `users.cancellation_rate` theo thang $0 - 100\%$. | **40%** | Phản ánh thói quen hủy hẹn của khách hàng trong quá khứ ở cấp người dùng, không lưu rời rạc theo từng đơn hủy. |
| **Thời gian chuẩn bị (Lead Time)** | Thời gian từ lúc tạo lịch đến thời điểm hẹn thực tế.<br>- $<2$h: 90 điểm rủi ro.<br>- $<6$h: 60 điểm rủi ro.<br>- $<12$h: 40 điểm rủi ro.<br>- $<24$h: 20 điểm rủi ro.<br>- $\ge 24$h: 10 điểm rủi ro. | **20%** | Đặt lịch quá sát giờ phục vụ làm tăng tỷ lệ rủi ro không đến hoặc hủy đột ngột. |
| **Phân cụm khách hàng (K-Means Segment)** | Liên kết trực tiếp kết quả phân cụm từ K-Means:<br>- `Lost Customers`: 80 điểm.<br>- `At Risk`: 65 điểm.<br>- `New Customers`/`New`: 50 điểm.<br>- `Need Attention`: 40 điểm.<br>- `Potential Loyalists`: 20 điểm.<br>- `Loyal Customers`: 10 điểm.<br>- `Champions`: 5 điểm. | **20%** | Áp dụng tri thức học máy từ phân cụm K-Means vào đánh giá rủi ro trực tiếp. |
| **Ngày trong tuần (Day of Week)** | Đánh giá theo ngày của lịch hẹn:<br>- Thứ hai (đầu tuần nhiều biến động): 45 điểm.<br>- Các ngày thường (Thứ ba - Thứ sáu): 30 điểm.<br>- Cuối tuần (Thứ bảy, CN ổn định): 15 điểm. | **10%** | Xu hướng rủi ro hủy hẹn thay đổi theo tâm lý ngày làm việc/ngày nghỉ. |
| **Lịch sử bỏ hẹn (No-Show)** | Dựa trên hành vi bỏ hẹn không thông báo:<br>- $\ge 3$ lần: 90 điểm.<br>- $2$ lần: 60 điểm.<br>- $1$ lần: 30 điểm.<br>- $0$ lần: 0 điểm. | **10%** | Lịch sử bỏ hẹn không báo trước là dấu hiệu cảnh báo cao nhất về độ uy tín. |

### Quy tắc xử lý nghiệp vụ thông minh:
Khi khách hàng đặt hẹn mới, hệ thống tự động tính toán tổng điểm rủi ro hủy lịch ($Score$ từ 0 đến 100):
- **Nếu $Score \le 70$**: Cho phép đặt hẹn trực tiếp, chấp nhận mọi phương thức thanh toán bao gồm thanh toán tại quầy (tiền mặt).
- **Nếu $Score > 70$**:
  - Kích hoạt chế độ **Bắt buộc đặt cọc (Deposit Required)**.
  - Vô hiệu hóa thanh toán bằng tiền mặt, yêu cầu thanh toán trực tuyến qua thẻ hoặc Ví điện tử.
  - **Tỷ lệ đặt cọc**:
    - Nếu $70 < Score \le 85$: Yêu cầu cọc **20%** giá trị đơn dịch vụ.
    - Nếu $Score > 85$: Yêu cầu cọc **30%** giá trị đơn dịch vụ.

Sau mỗi lần trạng thái lịch hẹn thay đổi, backend refresh lại `users.cancellation_rate` theo công thức:
$$CancellationRate(user) = \frac{\text{Số lịch đã hủy của user}}{\text{Tổng số lịch của user}} \times 100$$
Giá trị này luôn được chặn trong khoảng $0$ đến $100$ và được dùng trực tiếp khi tính Cancellation Score.

---

## 3. Phân cụm Hành vi Động DEC (Dynamic Engagement Clustering)

Bên cạnh mô hình K-Means chu kỳ dài, hệ thống triển khai dịch vụ **Phân cụm hành vi động DEC** để phân nhóm khách hàng tức thời theo các chu kỳ thời gian tùy chỉnh (Ngày, Tuần, Tháng, Năm) dựa trên phân vị động. Node.js chuẩn bị dữ liệu truy vấn theo kỳ, sau đó gọi Python để tính ngưỡng phân vị, chuẩn hóa hồ sơ khách hàng và gán cụm hành vi.

**Vị trí mã nguồn**: [decClusteringService/index.js](file:///d:/Doantotnghiep/Code/backend/src/services/decClusteringService/index.js)
**Mã thuật toán Python**: [customer_analytics.py](file:///d:/Doantotnghiep/Code/backend/ml/customer_analytics.py)

### Cơ chế phân vị động (Quantile Thresholds):
Để xác định các mức giá trị dịch vụ của khách hàng là cao cấp hay bình dân mà không sử dụng các con số cứng (Hard-coded), thuật toán Python sử dụng hàm phân vị (`quantile`) để quét dữ liệu thực tế tại các điểm mốc:
- **Premium Threshold**: Phân vị 75% (`quantile(0.75)`) của giá dịch vụ hoặc tổng chi tiêu, đại diện cho nhóm giá trị cao.
- **Budget Threshold**: Phân vị 40% (`quantile(0.4)`) đại diện cho nhóm bình dân.

### 7 Nhóm hành vi động và quy tắc phân loại:
1. **Frequent Cancel/No-Show (`frequent_cancel_no_show`)**: Số lịch rủi ro (hủy hoặc bỏ hẹn) $\ge 2$ và tỷ lệ hủy lịch $\ge 35\%$.
2. **Many Bookings Low Arrival (`many_bookings_low_arrival`)**: Tổng số lịch đặt $\ge 4$ nhưng tỷ lệ hoàn thành $\le 45\%$.
3. **One Time Then Left (`one_time_then_left`)**: Khách hàng chỉ đặt đúng 1 lần và lần hẹn gần nhất đã trôi qua $\ge 21$ ngày.
4. **Low Usage Premium (`low_usage_premium`)**: Số lịch hoàn thành tối đa là 2 lần nhưng giá trị đơn hàng trung bình thuộc nhóm Premium ($\ge$ Premium Threshold).
5. **High Usage Budget (`high_usage_budget`)**: Tần suất đặt hẹn cao ($\ge 3$ lần hoàn thành) nhưng chi tiêu trung bình thuộc nhóm bình dân ($\le$ Budget Threshold).
6. **Frequent Single Service (`frequent_single_service`)**: Khách quay lại nhiều lần ($\ge 3$ lần đặt lịch) nhưng trung thành với duy nhất 1 dịch vụ nhất định.
7. **Low Monthly Usage (`low_monthly_usage`)**: Khách hàng có lịch đặt trải dài qua nhiều tháng ($\ge 2$ tháng) nhưng tần suất trung bình cực thấp ($\le 1.25$ lịch/tháng).

### Công cụ tạo chiến lược động (Dynamic Strategy Builder):
Hàm `buildDynamicStrategy` tự động ánh xạ cấu hình nhóm khách hàng với chu kỳ thời gian truy vấn để sinh ra các chiến dịch chăm sóc khách hàng tức thời gửi đến quản trị viên, giúp quyết định khuyến mãi linh hoạt theo diễn biến vận hành thực tế.

---

## 4. Chương 4 - Kết quả nghiên cứu

### 4.1. Mục tiêu đánh giá kết quả

Chương này trình bày kết quả đạt được sau quá trình nghiên cứu, thiết kế và xây dựng hệ thống **BeautyBook - Smart Booking Salon**. Mục tiêu chính là chứng minh sản phẩm không chỉ dừng lại ở một website đặt lịch cơ bản, mà có khả năng hỗ trợ vận hành thực tế cho các cơ sở làm đẹp thông qua đặt lịch trực tuyến, quản lý dữ liệu tập trung, phân tích hành vi khách hàng, cảnh báo rủi ro hủy lịch và gợi ý chiến lược chăm sóc khách hàng.

Sản phẩm hướng đến việc trả lời câu hỏi trọng tâm: **BeautyBook có thể được sử dụng ở đâu và mang lại giá trị gì cho người dùng cũng như đơn vị vận hành?** Dựa trên kết quả triển khai, hệ thống có thể ứng dụng tại salon tóc, spa, nail, clinic làm đẹp, startup cung cấp dịch vụ đặt lịch, hoặc bộ phận nội bộ của tổ chức cần quản lý lịch hẹn theo nhân viên và khung giờ.

### 4.2. Các chức năng đã xây dựng

Hệ thống đã hoàn thiện các nhóm chức năng chính phục vụ nhiều vai trò người dùng khác nhau:

| Nhóm chức năng | Nội dung đã xây dựng | Giá trị mang lại |
| :--- | :--- | :--- |
| Quản lý tài khoản và phân quyền | Đăng ký, đăng nhập, xác thực JWT, phân quyền `admin`, `staff`, `user`, thu ngân theo vai trò nhân viên. | Bảo vệ dữ liệu, đảm bảo mỗi người dùng chỉ truy cập đúng chức năng nghiệp vụ. |
| Đặt lịch trực tuyến | Khách hàng chọn dịch vụ, ngày giờ, nhân viên, voucher và phương thức thanh toán. | Giảm phụ thuộc vào gọi điện hoặc nhắn tin thủ công, hạn chế sai sót khi ghi nhận lịch. |
| Quản lý lịch hẹn | Admin, thu ngân và nhân viên theo dõi lịch hẹn, trạng thái xử lý, thanh toán và yêu cầu hủy. | Hỗ trợ vận hành hằng ngày, giúp cửa hàng kiểm soát lịch làm việc và doanh thu. |
| Quản lý dịch vụ, nhân viên, khách hàng | Admin quản lý danh mục dịch vụ, hồ sơ nhân viên, lịch làm việc, thông tin khách hàng. | Chuẩn hóa dữ liệu, giảm rời rạc thông tin giữa nhiều file hoặc sổ ghi chép. |
| Voucher và marketing | Quản lý voucher, gán voucher cho khách hàng, kiểm tra điều kiện sử dụng khi đặt lịch. | Cá nhân hóa khuyến mãi, tăng khả năng giữ chân khách hàng. |
| Thiết kế hồ sơ hành vi và gợi ý dịch vụ cá nhân hóa | Bổ sung mô hình dữ liệu để lưu các tương tác của từng tài khoản với dịch vụ như xem chi tiết, tìm kiếm, thêm vào booking, đặt lịch, hoàn thành, hủy lịch và phản hồi gợi ý. | Tạo nền tảng đề xuất dịch vụ riêng cho từng khách hàng thay vì chỉ hiển thị danh sách chung. |
| RFM và K-Means | Phân tích Recency, Frequency, Monetary, Cancel Rate để phân nhóm khách hàng. | Nhận diện khách VIP, khách trung thành, khách tiềm năng và khách có nguy cơ rời bỏ. |
| Cancellation Score | Tính điểm rủi ro hủy lịch dựa trên lịch sử hủy, no-show, thời gian đặt lịch, ngày trong tuần và phân khúc khách hàng. | Giảm tình trạng "boom" lịch bằng cách yêu cầu đặt cọc với khách rủi ro cao. |
| DEC Clustering | Phân cụm hành vi động theo ngày, tuần, tháng, năm dựa trên dữ liệu đặt lịch thực tế. | Cung cấp chiến lược chăm sóc khách hàng linh hoạt theo từng giai đoạn vận hành. |
| Dashboard realtime | Cập nhật số liệu booking, doanh thu, trạng thái lịch và biểu đồ thông qua Socket.io. | Admin nắm bắt tình hình vận hành gần như tức thời, không cần tải lại trang. |
| AI Chatbot | Hỗ trợ hỏi đáp dịch vụ, kiểm tra lịch trống, tạo booking, xem lịch hẹn và nhận diện cảm xúc. | Cải thiện trải nghiệm khách hàng, giảm tải cho nhân viên tư vấn. |
| PWA và trải nghiệm mobile | Manifest, service worker, bottom navigation, giao diện tối ưu cho điện thoại. | Khách hàng có thể sử dụng như ứng dụng di động mà không cần cài app native. |

#### 4.2.1. Danh sách API theo nhóm người dùng

Phần này tổng hợp các API chính của hệ thống BeautyBook theo từng nhóm chức năng và vai trò sử dụng. Mỗi API được trình bày theo ba thông tin: phương thức gọi, đường dẫn endpoint và chức năng nghiệp vụ tương ứng.

- **Nhóm API xác thực người dùng**

Nhóm API xác thực người dùng đảm nhiệm các chức năng đăng ký, đăng nhập, đăng nhập bằng mạng xã hội, khôi phục mật khẩu và quản lý hồ sơ cá nhân. Sau khi đăng nhập thành công, hệ thống tạo JWT token để xác thực cho các request tiếp theo.

| Method | Endpoint | Chức năng |
| :--- | :--- | :--- |
| POST | /api/user/register | Đăng ký tài khoản người dùng mới. |
| POST | /api/user/login | Đăng nhập và tạo JWT token. |
| POST | /api/user/google-login | Đăng nhập bằng tài khoản Google. |
| POST | /api/user/zalo-login | Đăng nhập bằng tài khoản Zalo. |
| POST | /api/user/forgot-password | Gửi yêu cầu quên mật khẩu. |
| POST | /api/user/reset-password | Đặt lại mật khẩu bằng token khôi phục. |
| GET | /api/user/profile | Lấy thông tin hồ sơ người dùng đang đăng nhập. |
| PUT | /api/user/profile | Cập nhật thông tin cá nhân. |
| POST | /api/user/avatar | Upload hoặc thay đổi ảnh đại diện. |

<p align="center"><i>Bảng 4.8: Nhóm API xác thực người dùng</i></p>

- **Nhóm API công khai và tra cứu dịch vụ**

Nhóm API công khai phục vụ các màn hình không yêu cầu quyền quản trị như trang chủ, danh sách dịch vụ, danh mục dịch vụ, dịch vụ nổi bật và các thông tin tra cứu ban đầu cho người dùng.

| Method | Endpoint | Chức năng |
| :--- | :--- | :--- |
| GET | / | Kiểm tra trạng thái hoạt động của API. |
| GET | /api/services/categories | Lấy danh sách danh mục dịch vụ. |
| GET | /api/services/trending | Lấy danh sách dịch vụ đang được đặt nhiều. |
| GET | /api/services/recommendations | Lấy gợi ý dịch vụ cho trang người dùng. |
| GET | /api/services | Lấy danh sách dịch vụ đang hiển thị. |
| GET | /api/services/:id | Xem chi tiết một dịch vụ. |
| GET | /api/chat/suggestions | Lấy danh sách câu hỏi hoặc gợi ý nhanh cho chatbot. |
| GET | /api/chat/faq/search | Tìm kiếm câu hỏi thường gặp. |
| GET | /api/chat/faq/category/:category | Lấy câu hỏi thường gặp theo danh mục. |

<p align="center"><i>Bảng 4.9: Nhóm API công khai và tra cứu dịch vụ</i></p>

- **Nhóm API người dùng/User**

Nhóm API người dùng phục vụ luồng đặt lịch trực tuyến, chọn nhân viên, kiểm tra khung giờ trống, áp dụng voucher, theo dõi lịch hẹn cá nhân và thực hiện thanh toán cho lịch đã đặt.

| Method | Endpoint | Chức năng |
| :--- | :--- | :--- |
| GET | /api/staff/bookable | Lấy danh sách nhân viên có thể nhận booking. |
| GET | /api/staff/available | Tìm nhân viên rảnh theo ngày, giờ và dịch vụ. |
| GET | /api/staff/:id/busy-slots | Lấy các khung giờ bận của một nhân viên. |
| POST | /api/bookings/cancellation-score | Tính điểm rủi ro hủy lịch trước khi đặt hẹn. |
| POST | /api/bookings | Tạo lịch hẹn mới, có kiểm tra dịch vụ, nhân viên, voucher và rủi ro hủy. |
| GET | /api/bookings/my-bookings | Xem danh sách lịch hẹn của tài khoản hiện tại. |
| PUT | /api/bookings/:id/cancel | Người dùng hủy lịch hẹn nếu còn trong trạng thái cho phép. |
| PUT | /api/bookings/:id/review | Đánh giá nhân viên sau khi lịch hẹn hoàn thành. |
| GET | /api/vouchers/my-vouchers | Xem danh sách voucher của người dùng. |
| POST | /api/vouchers/validate | Kiểm tra voucher có hợp lệ khi đặt lịch hay không. |
| GET | /api/payments/options | Lấy danh sách phương thức thanh toán được hỗ trợ. |
| POST | /api/payments/create-payment | Tạo giao dịch thanh toán cho lịch hẹn. |
| POST | /api/payments/verify-payment | Endpoint xác nhận thanh toán thủ công cũ, hiện không còn hỗ trợ. |
| GET | /api/payments/:payment_id | Xem thông tin thanh toán thuộc quyền của người dùng. |

<p align="center"><i>Bảng 4.10: Nhóm API người dùng/User</i></p>

- **Nhóm API nhân viên/Staff và thu ngân**

Nhóm API nhân viên và thu ngân hỗ trợ theo dõi lịch hẹn được phân công, cập nhật trạng thái phục vụ, gửi yêu cầu hủy lịch, đăng ký ca làm, đăng ký nghỉ phép có hiệu lực ngay, quản lý thông tin khách hàng cơ bản và xác nhận thanh toán tại quầy.

| Method | Endpoint | Chức năng |
| :--- | :--- | :--- |
| GET | /api/bookings | Xem danh sách lịch hẹn; staff thường xem lịch được phân công, thu ngân/quản lý có thể xem rộng hơn. |
| GET | /api/bookings/:id | Xem chi tiết một lịch hẹn được phép quản lý. |
| PUT | /api/bookings/:id/status | Cập nhật trạng thái lịch hẹn như xác nhận, hoàn thành hoặc hủy. |
| PUT | /api/bookings/:id/request-cancel | Nhân viên gửi yêu cầu hủy lịch hẹn đang phụ trách. |
| PUT | /api/bookings/:id/confirm-cancel | Xác nhận yêu cầu hủy lịch hẹn. |
| PUT | /api/bookings/:id/reject-cancel | Từ chối yêu cầu hủy và giữ lại lịch hẹn. |
| GET | /api/staff/me/weekly-availability | Nhân viên xem lịch làm việc hoặc ca đăng ký của bản thân. |
| PUT | /api/staff/me/weekly-availability | Nhân viên đăng ký hoặc cập nhật lịch làm việc hằng tuần. |
| POST | /api/staff/me/start-work | Nhân viên xác nhận bắt đầu làm và tự động xác nhận các lịch đang chờ. |
| POST | /api/staff/leave-request | Nhân viên đăng ký nghỉ phép; hệ thống ghi nhận ngay và loại nhân viên khỏi lịch đặt trong khoảng ngày nghỉ. |
| GET | /api/staff/my-leave-requests | Nhân viên xem lịch sử nghỉ phép của bản thân. |
| GET | /api/customers | Nhân viên/thu ngân xem danh sách khách hàng để phục vụ vận hành. |
| POST | /api/customers | Tạo hồ sơ khách hàng mới. |
| PUT | /api/customers/:id | Cập nhật thông tin khách hàng. |
| DELETE | /api/customers/:id | Xóa hồ sơ khách hàng khi có quyền. |
| GET | /api/payments/:payment_id | Nhân viên xem thanh toán của lịch hẹn được phân công. |
| PUT | /api/payments/:payment_id/confirm-transfer | Xác nhận thanh toán tiền mặt, chuyển khoản hoặc VietQR. |

<p align="center"><i>Bảng 4.11: Nhóm API nhân viên/Staff và thu ngân</i></p>

- **Nhóm API quản trị viên/Admin**

Nhóm API quản trị viên đảm nhiệm toàn bộ chức năng cấu hình và quản lý hệ thống như quản lý dịch vụ, nhân viên, tài khoản admin, voucher, dashboard, phân tích doanh thu, phân cụm khách hàng RFM/K-Means và kết quả DEC.

| Method | Endpoint | Chức năng |
| :--- | :--- | :--- |
| GET | /api/services/admin/all | Lấy toàn bộ dịch vụ cho màn hình quản trị, bao gồm cả dịch vụ ẩn/ngưng hoạt động. |
| POST | /api/services | Tạo dịch vụ mới. |
| PUT | /api/services/:id | Cập nhật thông tin dịch vụ. |
| PUT | /api/services/:id/price | Cập nhật riêng giá dịch vụ. |
| DELETE | /api/services/:id | Xóa hoặc ngưng hiển thị dịch vụ. |
| POST | /api/services/categories | Tạo danh mục dịch vụ mới. |
| GET | /api/staff/roles | Lấy danh sách vai trò nhân viên. |
| POST | /api/staff/roles | Tạo vai trò nhân viên mới, ví dụ thu ngân hoặc kỹ thuật viên. |
| GET | /api/staff/:id/weekly-availability | Xem lịch làm việc hằng tuần của một nhân viên. |
| PUT | /api/staff/:id/weekly-availability | Cập nhật lịch làm việc hằng tuần cho nhân viên. |
| GET | /api/staff/leave-requests | Xem toàn bộ lịch nghỉ đã ghi nhận của nhân viên. |
| GET | /api/staff | Lấy danh sách nhân viên. |
| POST | /api/staff | Tạo tài khoản nhân viên mới. |
| PUT | /api/staff/:id | Cập nhật hồ sơ, trạng thái, mật khẩu hoặc vai trò nhân viên. |
| GET | /api/admin-users | Lấy danh sách tài khoản admin. |
| POST | /api/admin-users | Tạo tài khoản admin mới. |
| PUT | /api/admin-users/:id | Cập nhật thông tin tài khoản admin. |
| GET | /api/vouchers/analytics | Xem thống kê hiệu quả voucher. |
| GET | /api/vouchers | Lấy danh sách voucher trong hệ thống. |
| POST | /api/vouchers | Tạo voucher mới. |
| GET | /api/vouchers/:id | Xem chi tiết voucher. |
| PUT | /api/vouchers/:id | Cập nhật voucher. |
| DELETE | /api/vouchers/:id | Xóa voucher. |
| POST | /api/vouchers/:id/assign | Gán voucher cho khách hàng. |
| POST | /api/customers/:id/send-voucher-email | Tạo và gửi voucher qua email cho một khách hàng. |
| GET | /api/admin/dashboard/summary | Lấy số liệu tóm tắt dashboard. |
| GET | /api/admin/dashboard/overview | Lấy dữ liệu tổng quan theo ngày, tháng hoặc năm. |
| GET | /api/admin/dashboard/bookings-by-month | Thống kê số lượng booking theo tháng. |
| GET | /api/admin/dashboard/top-services | Thống kê dịch vụ được sử dụng nhiều nhất. |
| GET | /api/admin/dashboard/customer-frequency | Thống kê tần suất đặt lịch của khách hàng. |
| GET | /api/admin/dashboard/appointment-status | Thống kê lịch hẹn theo trạng thái. |
| GET | /api/admin/dashboard/revenue-by-month | Thống kê doanh thu theo tháng. |
| GET | /api/admin/dashboard/cancellation-rate | Thống kê tỷ lệ hủy lịch. |
| GET | /api/admin/dashboard/customer-behavior-bot | Lấy dữ liệu phân tích hành vi khách hàng cho bot hoặc gợi ý chiến lược. |
| GET | /api/admin/dashboard/dec-clustering | Lấy kết quả phân cụm hành vi động DEC. |
| GET | /api/admin/dashboard/staff-commission-by-month | Thống kê hoa hồng nhân viên theo tháng. |
| POST | /api/admin/rfm/run | Chạy thủ công job phân cụm RFM/K-Means. |
| GET | /api/admin/rfm/stats | Lấy thống kê khách hàng theo phân khúc RFM/K-Means. |

<p align="center"><i>Bảng 4.12: Nhóm API quản trị viên/Admin</i></p>

- **Nhóm API chatbot và thanh toán callback**

Nhóm API này phục vụ hội thoại chatbot của người dùng đã đăng nhập và các callback từ cổng thanh toán. Chatbot hỗ trợ lưu hội thoại, gửi tin nhắn, nhận phản hồi tự động, còn callback VNPay dùng để đối soát kết quả thanh toán với hệ thống.

| Method | Endpoint | Chức năng |
| :--- | :--- | :--- |
| POST | /api/chat/conversations | Tạo cuộc trò chuyện mới. |
| GET | /api/chat/conversations | Lấy danh sách cuộc trò chuyện của tài khoản hiện tại. |
| GET | /api/chat/conversations/:conversationId | Xem chi tiết một cuộc trò chuyện. |
| PUT | /api/chat/conversations/:conversationId/close | Đóng cuộc trò chuyện. |
| POST | /api/chat/conversations/:conversationId/messages | Gửi tin nhắn trong cuộc trò chuyện. |
| GET | /api/chat/conversations/:conversationId/messages | Lấy danh sách tin nhắn của cuộc trò chuyện. |
| POST | /api/chat/conversations/:conversationId/chat-bot | Gửi nội dung cho chatbot và nhận phản hồi tự động. |
| GET | /api/payments/vnpay-return | Nhận kết quả trả về từ VNPay và chuyển hướng về frontend. |
| GET | /api/payments/vnpay-ipn | Nhận IPN từ VNPay để đối soát trạng thái thanh toán. |

<p align="center"><i>Bảng 4.13: Nhóm API chatbot và thanh toán callback</i></p>

#### 4.2.2. Dữ liệu lưu trữ hành vi người dùng và đề xuất dịch vụ theo từng tài khoản

Để hệ thống có thể đề xuất dịch vụ riêng cho từng tài khoản, BeautyBook cần một lớp dữ liệu hành vi liên kết trực tiếp với `users.id`. Thay vì chỉ dựa vào danh sách dịch vụ phổ biến chung, mỗi thao tác có giá trị của khách hàng được ghi nhận thành sự kiện, sau đó tổng hợp thành hồ sơ sở thích và danh sách gợi ý cá nhân hóa.

Các nhóm dữ liệu đề xuất gồm:

| Bảng dữ liệu | Trường chính | Vai trò |
| :--- | :--- | :--- |
| `user_service_events` | `id`, `user_id`, `service_id`, `appointment_id`, `event_type`, `event_weight`, `keyword`, `metadata`, `occurred_at` | Lưu nhật ký hành vi thô của từng tài khoản khi xem dịch vụ, tìm kiếm, chọn dịch vụ, đặt lịch, hủy lịch hoặc bấm vào gợi ý. |
| `user_service_profiles` | `user_id`, `service_id`, `view_count`, `search_count`, `booking_count`, `completed_count`, `cancelled_count`, `last_viewed_at`, `last_booked_at`, `avg_rating`, `interest_score`, `updated_at` | Tổng hợp hồ sơ quan tâm của từng khách hàng theo từng dịch vụ để truy vấn nhanh khi cần đề xuất. |
| `user_service_recommendations` | `id`, `user_id`, `service_id`, `source`, `score`, `reason`, `status`, `generated_at`, `expires_at`, `shown_at`, `clicked_at`, `booked_at` | Lưu danh sách dịch vụ được đề xuất cho từng tài khoản, kèm lý do gợi ý và trạng thái phản hồi của người dùng. |
| `service_recommendation_feedback` | `id`, `user_id`, `service_id`, `recommendation_id`, `feedback_type`, `created_at` | Ghi nhận phản hồi như đã xem, đã bấm, đã đặt, bỏ qua hoặc không quan tâm để cải thiện lần gợi ý sau. |

Các giá trị `event_type` có thể sử dụng trong bảng `user_service_events`:

| Sự kiện | Ý nghĩa | Trọng số tham khảo |
| :--- | :--- | :--- |
| `view_service` | Người dùng mở trang chi tiết dịch vụ. | 1 |
| `search_service` | Người dùng tìm kiếm tên dịch vụ, danh mục hoặc từ khóa liên quan. | 1.5 |
| `add_to_booking` | Người dùng chọn dịch vụ trong luồng đặt lịch nhưng chưa hoàn tất. | 3 |
| `book_service` | Người dùng tạo booking có chứa dịch vụ đó. | 5 |
| `complete_service` | Lịch hẹn hoàn thành thành công. | 6 |
| `cancel_service` | Lịch hẹn bị hủy. | -2 |
| `no_show_service` | Khách không đến lịch hẹn đã đặt. | -4 |
| `click_recommendation` | Người dùng bấm vào một dịch vụ được hệ thống gợi ý. | 2 |
| `positive_review` | Người dùng đánh giá tốt sau khi sử dụng dịch vụ. | 3 |

Điểm quan tâm của một khách hàng $u$ với dịch vụ $s$ được tính bằng tổng trọng số hành vi có xét đến độ mới của sự kiện:

$$Interest(u, s) = \sum_{e \in E(u,s)} weight(e) \times e^{-\lambda \Delta days(e)}$$

Trong đó, $\Delta days(e)$ là số ngày từ lúc sự kiện xảy ra đến thời điểm tính toán, còn $\lambda$ là hệ số giảm dần theo thời gian. Nhờ đó, các hành vi gần đây như vừa xem dịch vụ, vừa tìm kiếm hoặc vừa đặt lịch sẽ có ảnh hưởng lớn hơn hành vi quá cũ.

Điểm đề xuất cuối cùng có thể kết hợp nhiều nguồn tín hiệu:

$$RecommendationScore(u, s) = 0.35 \times Interest(u, s) + 0.25 \times Similarity(u, s) + 0.20 \times SegmentFit(u, s) + 0.10 \times Trend(s) + 0.10 \times VoucherFit(u, s)$$

Trong đó:

- **Interest**: mức độ quan tâm cá nhân từ lịch sử xem, tìm kiếm, đặt lịch và đánh giá.
- **Similarity**: độ tương đồng với các khách hàng có hành vi giống nhau, ví dụ khách từng đặt dịch vụ A thường đặt thêm dịch vụ B.
- **SegmentFit**: mức phù hợp với phân khúc RFM/K-Means hoặc cụm hành vi DEC của khách.
- **Trend**: mức phổ biến hiện tại của dịch vụ trong toàn hệ thống.
- **VoucherFit**: mức phù hợp giữa dịch vụ được gợi ý và voucher mà tài khoản đang có.

Quy trình đề xuất cá nhân hóa:

1. Khi khách hàng xem dịch vụ, tìm kiếm, chọn dịch vụ, đặt lịch hoặc tương tác với chatbot, backend ghi một dòng vào `user_service_events`.
2. Job tổng hợp định kỳ hoặc sau mỗi booking cập nhật bảng `user_service_profiles` để phản ánh mức quan tâm mới nhất của từng tài khoản.
3. Service đề xuất loại bỏ các dịch vụ đang ẩn, dịch vụ vừa sử dụng quá gần hoặc dịch vụ không phù hợp với trạng thái tài khoản.
4. Hệ thống tính `RecommendationScore` cho từng dịch vụ còn lại, chọn Top-N dịch vụ cao nhất và lưu vào `user_service_recommendations`.
5. Frontend, chatbot hoặc trang đặt lịch đọc danh sách gợi ý theo `user_id`, hiển thị kèm lý do như "Bạn thường quan tâm dịch vụ chăm sóc da" hoặc "Khách cùng nhóm với bạn hay đặt thêm dịch vụ này".
6. Khi người dùng bấm, bỏ qua hoặc đặt lịch từ gợi ý, hệ thống ghi nhận vào `service_recommendation_feedback` để tăng độ chính xác cho các lần sau.

Với thiết kế này, mỗi tài khoản có một hồ sơ hành vi riêng. Hai khách hàng cùng mở trang dịch vụ có thể nhận danh sách đề xuất khác nhau: khách thường dùng dịch vụ cao cấp được ưu tiên gợi ý gói premium, khách có lịch sử đặt dịch vụ giá thấp nhưng tần suất cao được gợi ý combo tiết kiệm, còn khách lâu ngày chưa quay lại được gợi ý dịch vụ kèm voucher kích hoạt lại.

### 4.3. Trình bày sản phẩm và kịch bản demo

Sản phẩm được triển khai theo kiến trúc web fullstack gồm **React Frontend**, **Express Backend** và **MySQL Database**. Giao diện được chia theo vai trò để phù hợp với nhu cầu sử dụng thực tế:

1. **Giao diện khách hàng**
   - Xem danh sách dịch vụ và thông tin chi tiết.
   - Đặt lịch với một hoặc nhiều dịch vụ.
   - Chọn nhân viên, ngày giờ, voucher và phương thức thanh toán.
   - Theo dõi lịch hẹn cá nhân, voucher đang có và thông tin hồ sơ.
   - Sử dụng chatbot để hỏi dịch vụ, kiểm tra lịch trống hoặc tạo lịch hẹn.

2. **Giao diện nhân viên và thu ngân**
   - Theo dõi lịch hẹn được phân công.
   - Hỗ trợ xử lý trạng thái lịch hẹn và xác nhận thanh toán.
   - Nắm bắt các lịch cần phục vụ trong ngày, tránh bỏ sót khách.

3. **Giao diện quản trị viên**
   - Quản lý dịch vụ, nhân viên, khách hàng, voucher và lịch hẹn.
   - Xem dashboard thống kê tổng quan.
   - Theo dõi dữ liệu realtime khi có lịch mới, thanh toán hoặc thay đổi trạng thái.
   - Xem phân khúc RFM, cụm hành vi DEC và chiến lược đề xuất cho từng nhóm khách.

Kịch bản demo tiêu biểu có thể thực hiện như sau:

1. Khách hàng đăng nhập, chọn dịch vụ, chọn ngày giờ và tiến hành đặt lịch.
2. Hệ thống gọi API tính **Cancellation Score** trước khi xác nhận booking.
3. Nếu khách có điểm rủi ro cao, giao diện khóa thanh toán tiền mặt và yêu cầu đặt cọc trực tuyến.
4. Sau khi đặt lịch thành công, admin dashboard nhận sự kiện realtime và cập nhật số liệu.
5. Admin mở trang quản lý khách hàng để xem phân khúc RFM như `Champions`, `Loyal Customers`, `Need Attention`, `At Risk`.
6. Admin mở trang phân tích chiến lược để xem cụm DEC, biểu đồ hồ sơ trung bình và hành động đề xuất.
7. Khách hàng sử dụng chatbot để hỏi lịch trống hoặc tạo booking nhanh trong khung chat.

Qua kịch bản này, sản phẩm thể hiện được đầy đủ luồng vận hành từ phía khách hàng, nhân viên, thu ngân đến quản trị viên. Điểm khác biệt quan trọng là mỗi booking không chỉ được lưu lại như dữ liệu giao dịch, mà còn trở thành đầu vào cho các mô hình phân tích khách hàng và rủi ro vận hành.

### 4.4. Khả năng ứng dụng thực tế

BeautyBook có thể triển khai trong các môi trường sau:

| Môi trường triển khai | Cách ứng dụng |
| :--- | :--- |
| Salon tóc, spa, nail, thẩm mỹ viện nhỏ và vừa | Quản lý lịch hẹn, khách hàng, nhân viên, voucher, thanh toán và nhắc lịch. |
| Chuỗi cửa hàng dịch vụ làm đẹp | Tập trung dữ liệu khách hàng, chuẩn hóa quy trình đặt lịch và hỗ trợ phân tích hành vi theo từng giai đoạn. |
| Startup cung cấp nền tảng booking | Dùng làm nền tảng MVP để phát triển thành SaaS đặt lịch cho ngành làm đẹp. |
| Bộ phận chăm sóc khách hàng nội bộ | Quản lý các lịch hẹn tư vấn, chăm sóc khách hàng, nhắc hẹn và đánh giá lịch sử tương tác. |
| Cơ sở đào tạo nghề làm đẹp | Quản lý lịch thực hành, lịch phục vụ mẫu, phân công học viên/nhân viên theo khung giờ. |

Đối tượng người dùng chính của hệ thống gồm:

- **Khách hàng cuối**: người cần đặt lịch làm đẹp nhanh, xem giá dịch vụ, nhận voucher và theo dõi lịch cá nhân.
- **Nhân viên salon**: người cần biết lịch làm việc, khách được phân công và trạng thái phục vụ.
- **Thu ngân**: người xác nhận thanh toán, hỗ trợ check-in và theo dõi lịch trong ngày.
- **Quản trị viên/chủ cửa hàng**: người cần quản lý toàn bộ dữ liệu, xem doanh thu, theo dõi rủi ro và ra quyết định marketing.
- **Nhân sự marketing/chăm sóc khách hàng**: người khai thác phân khúc RFM và DEC để gửi voucher hoặc chăm sóc đúng nhóm khách.

Như vậy, sản phẩm không chỉ dùng cho một cá nhân đặt lịch, mà có thể phục vụ cả quy trình vận hành của một cơ sở dịch vụ.

### 4.5. So sánh với các giải pháp đã khảo sát

Dựa trên các giải pháp đã khảo sát ở Chương 2, có thể chia thành ba nhóm phổ biến: quản lý thủ công, phần mềm đặt lịch cơ bản và nền tảng quản lý salon có sẵn. BeautyBook được so sánh theo các tiêu chí chính như sau:

| Tiêu chí | Quản lý thủ công qua sổ/Excel/Facebook | Phần mềm booking cơ bản | Nền tảng salon có sẵn | BeautyBook |
| :--- | :--- | :--- | :--- | :--- |
| Đặt lịch trực tuyến | Phụ thuộc nhân viên phản hồi thủ công. | Có hỗ trợ đặt lịch nhưng thường ít tùy biến. | Có hỗ trợ, tùy gói dịch vụ. | Hỗ trợ đặt lịch theo dịch vụ, ngày giờ, nhân viên và voucher. |
| Kiểm soát trùng lịch | Dễ sai sót khi đông khách. | Có kiểm tra cơ bản. | Có kiểm tra tương đối đầy đủ. | Kiểm tra theo luồng backend, gắn với lịch nhân viên và trạng thái booking. |
| Chống boom lịch | Gần như không có công cụ đo lường. | Thường chỉ có đặt cọc cố định. | Có thể có nhưng phụ thuộc nền tảng. | Tính **Cancellation Score** theo hành vi từng khách và tự động yêu cầu cọc khi rủi ro cao. |
| Cá nhân hóa marketing | Chủ yếu gửi khuyến mãi đại trà. | Có voucher nhưng ít phân tích hành vi. | Có CRM ở một số gói cao. | Tự động phân khúc RFM/K-Means và gợi ý voucher phù hợp. |
| Phân tích hành vi động | Không có. | Thường không có. | Có thể có báo cáo tổng hợp. | Có DEC Clustering theo chu kỳ ngày, tuần, tháng, năm. |
| Dashboard realtime | Không có. | Ít phổ biến. | Có ở một số nền tảng. | Cập nhật realtime bằng Socket.io và có fallback polling. |
| AI hỗ trợ khách hàng | Không có. | Thường chỉ chatbot FAQ đơn giản. | Tùy nền tảng. | Chatbot có thể kiểm tra lịch trống, tạo booking và nhận diện cảm xúc. |
| Khả năng tùy biến theo đồ án/nghiệp vụ | Cao nhưng thủ công, không tự động. | Phụ thuộc nhà cung cấp. | Phụ thuộc gói và chính sách nền tảng. | Chủ động tùy biến mã nguồn, thuật toán và giao diện theo nghiệp vụ BeautyBook. |

Từ bảng so sánh có thể thấy BeautyBook tập trung vào hai điểm khác biệt chính. Thứ nhất, hệ thống không chỉ ghi nhận giao dịch mà còn khai thác dữ liệu để dự đoán rủi ro và chăm sóc khách hàng. Thứ hai, sản phẩm được thiết kế theo hướng có thể tùy biến, phù hợp với yêu cầu của một đề tài tốt nghiệp và có khả năng mở rộng thành sản phẩm thực tế.

### 4.6. Điểm mạnh của sản phẩm

1. **Tích hợp đầy đủ quy trình đặt lịch**

   Hệ thống bao phủ nhiều bước từ xem dịch vụ, đặt lịch, chọn voucher, thanh toán, nhắc lịch, quản lý trạng thái đến thống kê. Điều này giúp dữ liệu không bị phân tán giữa nhiều công cụ khác nhau.

2. **Có lớp phân tích dữ liệu khách hàng**

   BeautyBook không chỉ lưu dữ liệu lịch hẹn mà còn sử dụng RFM, K-Means và DEC để biến dữ liệu thành thông tin có giá trị. Quản trị viên có thể biết nhóm khách nào cần tri ân, nhóm nào cần kích hoạt lại và nhóm nào có rủi ro cao.

3. **Giảm rủi ro boom lịch**

   Cancellation Score giúp hệ thống đánh giá rủi ro trước khi xác nhận booking. Với khách có điểm rủi ro cao, hệ thống yêu cầu đặt cọc trực tuyến, từ đó giảm khả năng khách đặt lịch nhưng không đến.

4. **Cập nhật realtime**

   Dashboard realtime giúp admin và thu ngân theo dõi thay đổi ngay khi có lịch mới hoặc thanh toán mới. Đây là yếu tố quan trọng trong môi trường salon, nơi lịch hẹn thay đổi liên tục trong ngày.

5. **Trải nghiệm mobile tốt**

   PWA và bottom navigation giúp khách hàng sử dụng thuận tiện trên điện thoại. Điều này phù hợp với hành vi thực tế vì đa số khách thường đặt lịch bằng thiết bị di động.

6. **Có khả năng mở rộng**

   Kiến trúc React - Express - MySQL, phân tách frontend/backend rõ ràng, có route API và service riêng cho từng nghiệp vụ. Điều này giúp hệ thống dễ bổ sung tính năng như đa chi nhánh, thanh toán thật, SMS/Zalo hoặc báo cáo nâng cao.

### 4.7. Điểm hạn chế

Bên cạnh các kết quả đạt được, sản phẩm vẫn còn một số hạn chế cần tiếp tục cải thiện:

1. **Chưa triển khai chính thức trên môi trường cloud**

   Hệ thống hiện phù hợp để demo local và kiểm thử chức năng. Để sử dụng thực tế cần triển khai lên máy chủ, cấu hình domain, HTTPS, backup database và giám sát vận hành.

2. **Dữ liệu đánh giá mô hình còn phụ thuộc vào dữ liệu mẫu**

   Các thuật toán RFM, K-Means, DEC và Cancellation Score cần dữ liệu lịch sử đủ lớn để phản ánh đúng hành vi khách hàng. Nếu dữ liệu ít hoặc chưa cân bằng, kết quả phân cụm có thể chưa thật sự ổn định.

3. **Cancellation Score còn là mô hình điểm có trọng số**

   Mô hình hiện tại dễ giải thích và phù hợp với phạm vi đồ án, nhưng chưa phải mô hình dự đoán học có giám sát. Trong tương lai có thể huấn luyện mô hình dự báo no-show dựa trên dữ liệu thực tế.

4. **AI Chatbot phụ thuộc vào API bên ngoài**

   Khi sử dụng mô hình ngôn ngữ, hệ thống có thể phát sinh chi phí, độ trễ hoặc lỗi khi mất kết nối mạng. Cần có cơ chế fallback bằng kịch bản rule-based cho các câu hỏi phổ biến.

5. **Chưa hỗ trợ đầy đủ bài toán đa chi nhánh**

   Hệ thống phù hợp với một cơ sở hoặc mô hình nhỏ và vừa. Nếu triển khai cho chuỗi cửa hàng, cần bổ sung quản lý chi nhánh, phân quyền theo chi nhánh và báo cáo so sánh giữa các điểm kinh doanh.

### 4.8. Giá trị đóng góp của sản phẩm

Sản phẩm mang lại giá trị ở ba nhóm chính: tiết kiệm thời gian/chi phí, tăng hiệu quả xử lý và cải thiện trải nghiệm người dùng.

#### 4.8.1. Tiết kiệm thời gian và chi phí vận hành

- Khách hàng tự đặt lịch trực tuyến, giảm thời gian nhân viên phải nghe điện thoại hoặc trả lời tin nhắn.
- Admin quản lý dịch vụ, nhân viên, voucher và khách hàng trong một hệ thống tập trung, giảm thao tác ghi chép thủ công.
- Cron job tự động nhắc lịch và phân loại khách hàng, giảm công việc lặp lại cho nhân viên chăm sóc khách hàng.
- Dashboard realtime giúp người quản lý không phải tổng hợp số liệu thủ công nhiều lần trong ngày.

#### 4.8.2. Tăng hiệu quả xử lý nghiệp vụ

- Hệ thống kiểm tra rủi ro hủy lịch trước khi tạo booking, giúp cửa hàng chủ động yêu cầu đặt cọc với khách có nguy cơ cao.
- Dữ liệu RFM và DEC giúp admin chọn đúng nhóm khách để gửi voucher, thay vì khuyến mãi đại trà.
- Hồ sơ hành vi theo tài khoản tạo cơ sở để hệ thống đề xuất dịch vụ dựa trên sở thích thật của từng khách, giảm tình trạng hiển thị khuyến mãi hoặc dịch vụ không liên quan.
- Quản lý lịch hẹn theo trạng thái giúp thu ngân và nhân viên phối hợp tốt hơn trong quá trình phục vụ.
- Phân tích cụm hành vi giúp phát hiện các nhóm khách như khách dùng nhiều dịch vụ giá thấp, khách dùng ít nhưng chọn dịch vụ cao cấp, khách đặt nhiều nhưng tỷ lệ đến thấp.

#### 4.8.3. Cải thiện trải nghiệm người dùng

- Khách hàng có thể đặt lịch mọi lúc mà không cần chờ nhân viên phản hồi.
- Giao diện mobile/PWA giúp thao tác nhanh trên điện thoại.
- Voucher cá nhân hóa làm khách hàng cảm thấy được chăm sóc đúng nhu cầu.
- Chatbot hỗ trợ tìm thông tin và đặt lịch nhanh, giúp trải nghiệm gần với tư vấn trực tiếp.
- Nhắc lịch tự động giúp khách hạn chế quên hẹn.

### 4.9. Kết luận chương 4: Sản phẩm dùng ở đâu và mang lại giá trị gì?

BeautyBook có thể sử dụng tại các cơ sở dịch vụ làm đẹp như salon tóc, spa, nail, thẩm mỹ viện nhỏ và vừa, hoặc phát triển thành nền tảng đặt lịch cho startup trong lĩnh vực dịch vụ. Sản phẩm cũng có thể áp dụng cho các tổ chức cần quản lý lịch hẹn theo nhân viên, khung giờ và lịch sử khách hàng.

Giá trị cốt lõi của sản phẩm là giúp đơn vị vận hành **chuyển từ quản lý thủ công sang quản lý dựa trên dữ liệu**. Hệ thống giúp tiết kiệm thời gian tiếp nhận lịch, giảm rủi ro boom lịch, tự động hóa chăm sóc khách hàng, hỗ trợ ra quyết định marketing và nâng cao trải nghiệm đặt lịch của khách hàng. Đây là cơ sở quan trọng để chứng minh sản phẩm có khả năng ứng dụng thực tế và có tiềm năng mở rộng sau đồ án.

---

## 5. Chương 5 - Kết luận và đề xuất

### 5.1. Tóm tắt kết quả đạt được

Đề tài đã hoàn thành việc nghiên cứu, thiết kế và xây dựng hệ thống **BeautyBook - Smart Booking Salon**, một ứng dụng web hỗ trợ đặt lịch và quản lý vận hành cho ngành dịch vụ làm đẹp. Sản phẩm được phát triển theo mô hình fullstack với frontend React, backend Node.js/Express và cơ sở dữ liệu MySQL.

Các kết quả chính đã đạt được gồm:

- Xây dựng luồng đặt lịch trực tuyến cho khách hàng, hỗ trợ chọn dịch vụ, nhân viên, ngày giờ, voucher và thanh toán.
- Xây dựng hệ thống quản trị cho admin, nhân viên và thu ngân, bao gồm quản lý lịch hẹn, dịch vụ, khách hàng, nhân viên và voucher.
- Tích hợp dashboard thống kê và cập nhật realtime bằng Socket.io.
- Xây dựng hệ thống nhắc lịch tự động bằng cron job.
- Ứng dụng RFM, K-Means và DEC để phân tích hành vi khách hàng, phân nhóm và đề xuất chiến lược chăm sóc.
- Bổ sung hướng lưu trữ hành vi theo từng tài khoản để tạo cơ sở cho đề xuất dịch vụ cá nhân hóa.
- Xây dựng mô hình Cancellation Score để đánh giá rủi ro hủy lịch/no-show và yêu cầu đặt cọc với khách hàng có nguy cơ cao.
- Tích hợp AI Chatbot có khả năng hỗ trợ hỏi đáp, kiểm tra lịch trống, tạo booking và nhận diện cảm xúc.
- Tối ưu trải nghiệm mobile bằng PWA và giao diện điều hướng phù hợp với người dùng điện thoại.

Nhìn chung, hệ thống đã đáp ứng được mục tiêu ban đầu là xây dựng một sản phẩm đặt lịch thông minh, có khả năng hỗ trợ vận hành và khai thác dữ liệu khách hàng thay vì chỉ lưu trữ thông tin booking đơn thuần.

### 5.2. Đánh giá mức độ đáp ứng nhu cầu thực tế

So với nhu cầu thực tế của các salon, spa hoặc cơ sở làm đẹp nhỏ và vừa, BeautyBook đáp ứng tốt các bài toán thường gặp:

| Nhu cầu thực tế | Mức độ đáp ứng của hệ thống |
| :--- | :--- |
| Khách hàng muốn đặt lịch nhanh, không cần gọi điện | Đã hỗ trợ đặt lịch trực tuyến và chatbot hỗ trợ thao tác nhanh. |
| Cửa hàng cần tránh trùng lịch nhân viên | Hệ thống quản lý lịch hẹn theo nhân viên, ngày giờ và trạng thái booking. |
| Chủ cửa hàng cần theo dõi doanh thu, booking, khách hàng | Dashboard admin cung cấp số liệu tổng quan và cập nhật realtime. |
| Cần giảm khách đặt lịch rồi không đến | Cancellation Score và cơ chế đặt cọc giúp kiểm soát nhóm khách rủi ro cao. |
| Cần chăm sóc khách hàng đúng nhóm | RFM, K-Means, DEC và voucher hỗ trợ cá nhân hóa marketing. |
| Cần vận hành trên điện thoại | PWA và giao diện mobile giúp khách hàng sử dụng thuận tiện. |

Mức độ đáp ứng hiện tại phù hợp cho demo đồ án, thử nghiệm nội bộ hoặc triển khai thử tại một cơ sở nhỏ. Để triển khai thương mại rộng rãi, hệ thống cần bổ sung các yếu tố vận hành như deploy cloud, bảo mật nâng cao, backup dữ liệu, giám sát lỗi, thanh toán production và tài liệu hướng dẫn người dùng.

### 5.3. Đề xuất hướng mở rộng

Trong tương lai, hệ thống có thể được mở rộng theo các hướng sau:

1. **Triển khai đa chi nhánh**

   Bổ sung mô hình quản lý nhiều chi nhánh, phân quyền admin theo chi nhánh, so sánh doanh thu giữa các cơ sở và đồng bộ dữ liệu khách hàng toàn chuỗi.

2. **Tích hợp thanh toán production**

   Hoàn thiện kết nối với các cổng thanh toán thực tế như VNPay, VietQR, MoMo hoặc ZaloPay, đồng thời bổ sung đối soát giao dịch và hoàn tiền khi khách hủy đúng chính sách.

3. **Nâng cấp mô hình dự đoán no-show**

   Khi có đủ dữ liệu lịch sử, có thể thay Cancellation Score dạng trọng số bằng mô hình machine learning có giám sát như Logistic Regression, Random Forest hoặc Gradient Boosting để dự đoán xác suất khách không đến.

4. **Mở rộng kênh thông báo**

   Bổ sung email production, SMS, Zalo ZNS, push notification và thông báo trong app để nhắc lịch, xác nhận đặt cọc và gửi voucher cá nhân hóa.

5. **Hoàn thiện CRM và chiến dịch marketing**

   Phát triển module tạo chiến dịch tự động theo phân khúc RFM/DEC, theo dõi tỷ lệ mở voucher, tỷ lệ quay lại và doanh thu phát sinh sau chiến dịch.

6. **Cá nhân hóa đề xuất dịch vụ theo từng tài khoản**

   Triển khai đầy đủ bảng hành vi `user_service_events`, hồ sơ quan tâm `user_service_profiles`, bảng cache `user_service_recommendations` và API lấy gợi ý theo tài khoản đăng nhập. Hướng mở rộng này giúp trang dịch vụ, chatbot và voucher đưa ra đề xuất khác nhau cho từng khách hàng dựa trên lịch sử xem, tìm kiếm, đặt lịch, phân khúc RFM/DEC và phản hồi trước đó.

7. **Bổ sung quản lý tồn kho và sản phẩm**

   Với các salon/spa có bán mỹ phẩm hoặc dùng vật tư theo dịch vụ, hệ thống có thể mở rộng quản lý tồn kho, định mức vật tư và cảnh báo hết hàng.

8. **Tối ưu AI Chatbot**

   Bổ sung bộ tri thức nội bộ, cơ chế kiểm soát câu trả lời, fallback rule-based và đánh giá chất lượng hội thoại để giảm phụ thuộc vào API bên ngoài.

9. **Tăng cường bảo mật và kiểm thử**

   Bổ sung kiểm thử tự động, kiểm thử tải, kiểm thử phân quyền, logging tập trung, audit log cho thao tác quan trọng và cơ chế backup/restore database.

### 5.4. Khả năng triển khai thực tế

BeautyBook có khả năng triển khai thực tế theo lộ trình từng bước:

1. **Giai đoạn thử nghiệm nội bộ**

   Cài đặt hệ thống cho một salon hoặc nhóm người dùng nội bộ, nhập dữ liệu dịch vụ, nhân viên, khách hàng mẫu và kiểm thử luồng đặt lịch, thanh toán, voucher, dashboard.

2. **Giai đoạn pilot tại một cơ sở**

   Cho khách hàng thật sử dụng đặt lịch online trong phạm vi một cửa hàng. Theo dõi số lượng booking, tỷ lệ hủy lịch, phản hồi người dùng và độ chính xác của phân nhóm khách hàng.

3. **Giai đoạn vận hành chính thức**

   Deploy lên cloud, cấu hình domain/HTTPS, kết nối thanh toán thật, bật email/SMS/Zalo, thiết lập backup dữ liệu định kỳ và phân quyền nhân sự rõ ràng.

4. **Giai đoạn mở rộng**

   Bổ sung đa chi nhánh, báo cáo nâng cao, CRM tự động và mô hình dự báo rủi ro dựa trên dữ liệu thực tế.

Với kiến trúc hiện tại, sản phẩm có nền tảng tốt để chuyển từ bản demo đồ án sang bản thử nghiệm thực tế. Các module đã được tách theo service và API, giúp việc mở rộng tính năng hoặc thay đổi thuật toán không ảnh hưởng quá lớn đến toàn bộ hệ thống.

### 5.5. Kết luận chung

Đề tài đã xây dựng được một hệ thống đặt lịch salon thông minh có tính ứng dụng thực tế, kết hợp giữa nghiệp vụ booking, quản lý vận hành và phân tích dữ liệu khách hàng. Điểm đóng góp nổi bật của sản phẩm là đưa các kỹ thuật phân tích như RFM, K-Means, DEC và mô hình điểm rủi ro vào quy trình đặt lịch hằng ngày, từ đó giúp cơ sở làm đẹp ra quyết định tốt hơn.

BeautyBook mang lại giá trị cho cả khách hàng và đơn vị vận hành. Khách hàng có trải nghiệm đặt lịch nhanh, tiện lợi và cá nhân hóa hơn. Chủ cửa hàng và nhân viên có công cụ quản lý tập trung, theo dõi realtime, giảm rủi ro boom lịch và chăm sóc khách hàng hiệu quả hơn. Vì vậy, sản phẩm đáp ứng được yêu cầu của đề tài và có tiềm năng phát triển tiếp thành giải pháp quản lý đặt lịch thông minh cho ngành dịch vụ làm đẹp.
