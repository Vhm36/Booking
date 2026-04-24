# 🤖 Hướng Dẫn Tích Hợp Chatbot & Fix DB

## 📋 Mục Lục
1. [Fix Lỗi Database](#fix-lỗi-database)
2. [Tích Hợp Backend](#tích-hợp-backend)
3. [Tích Hợp Frontend](#tích-hợp-frontend)
4. [Cấu Hình Chatbot](#cấu-hình-chatbot)
5. [Testing](#testing)

---

## 🔧 Fix Lỗi Database

### Bước 1: Chạy Migration

```bash
# Kết nối MySQL
mysql -u root -p booking_system < database/migration_add_chatbot_and_fix_db.sql
```

### Bước 2: Kiểm Tra Foreign Keys

```sql
-- Kiểm tra tất cả foreign keys
SELECT 
  CONSTRAINT_NAME,
  TABLE_NAME,
  COLUMN_NAME,
  REFERENCED_TABLE_NAME
FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
WHERE TABLE_SCHEMA = 'booking_system'
  AND REFERENCED_TABLE_NAME IS NOT NULL;
```

### Bước 3: Verify Bảng Mới

```sql
-- Kiểm tra các bảng chatbot
SHOW TABLES LIKE 'chat_%';

-- Kiểm tra cấu trúc
DESC chat_conversations;
DESC chat_messages;
DESC chat_suggestions;
DESC chat_faq;
DESC chat_bot_responses;
```

---

## 🚀 Tích Hợp Backend

### Bước 1: Thêm Routes vào App

**File: `backend/src/app.js`**

```javascript
// Thêm import
const chatRoutes = require('./routes/chatRoutes');

// Thêm route (sau các route khác)
app.use('/api/chat', chatRoutes);
```

### Bước 2: Kiểm Tra Middleware

Đảm bảo `authMiddleware` đã được cấu hình đúng:

**File: `backend/src/middleware/authMiddleware.js`**

```javascript
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Token không tồn tại'
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: 'Token không hợp lệ'
    });
  }
};

module.exports = { verifyToken };
```

### Bước 3: Test API Endpoints

```bash
# Start backend
cd backend
npm start

# Test trong Postman hoặc curl
curl -X POST http://localhost:5000/api/chat/conversations \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"subject": "Customer Support"}'
```

---

## 💻 Tích Hợp Frontend

### Bước 1: Thêm ChatBot Component vào App

**File: `frontend/src/App.js`**

```javascript
import ChatBot from './pages/ChatBot';

function App() {
  return (
    <div className="App">
      {/* Các component khác */}
      <ChatBot />
    </div>
  );
}

export default App;
```

### Bước 2: Kiểm Tra API Service

**File: `frontend/src/services/api.js`**

Đảm bảo API client đã được cấu hình:

```javascript
import axios from 'axios';
import authService from './authService';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000'
});

// Add token to requests
api.interceptors.request.use((config) => {
  const token = authService.getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
```

### Bước 3: Kiểm Tra CSS

Đảm bảo `ChatBot.css` được import đúng trong `ChatBot.js`:

```javascript
import './ChatBot.css';
```

---

## ⚙️ Cấu Hình Chatbot

### 1. Thêm Suggestions

**SQL:**

```sql
INSERT INTO chat_suggestions (category, title, description, icon, action_type, action_data, priority)
VALUES
  ('service', 'Cắt tóc nam', 'Dịch vụ cắt tóc chuyên nghiệp', '✂️', 'service', JSON_OBJECT('service_id', 1), 10),
  ('service', 'Nhuộm tóc', 'Nhuộm tóc với màu sắc hiện đại', '🎨', 'service', JSON_OBJECT('service_id', 2), 9),
  ('booking', '??t l?ch nhanh', '??t l?ch h?n v?i nh?n vi?n', '??', 'booking', JSON_OBJECT('action', 'quick_booking'), 8);
```

### 2. Thêm FAQ

**SQL:**

```sql
INSERT INTO chat_faq (question, answer, category, keywords)
VALUES
  ('Salon mở cửa lúc mấy giờ?', 'Salon mở cửa từ 9:00 sáng đến 21:00 tối.', 'Giờ làm việc', 'giờ, mở cửa'),
  ('Làm sao để đặt lịch hẹn?', 'Bạn có thể đặt lịch trực tiếp trên ứng dụng.', 'Đặt lịch', 'đặt lịch, booking');
```

### 3. Thêm Bot Responses

**SQL:**

```sql
INSERT INTO chat_bot_responses (trigger_keyword, response_text, response_type, confidence_score)
VALUES
  ('xin chào|hello|hi', 'Xin chào! 👋 Tôi có thể giúp bạn với điều gì?', 'text', 0.95),
  ('giờ làm việc|mở cửa', 'Salon mở cửa từ 9:00 sáng đến 21:00 tối.', 'suggestion', 0.90),
  ('đặt lịch|booking', 'Bạn muốn đặt lịch hẹn nào?', 'suggestion', 0.92);
```

---

## 🧪 Testing

### 1. Test Backend API

```bash
# 1. Start conversation
curl -X POST http://localhost:5000/api/chat/conversations \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"subject": "Test"}'

# 2. Send message
curl -X POST http://localhost:5000/api/chat/conversations/1/messages \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"messageText": "Xin chào", "messageType": "text"}'

# 3. Chat with bot
curl -X POST http://localhost:5000/api/chat/conversations/1/chat-bot \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"messageText": "Giờ làm việc?"}'

# 4. Get suggestions
curl -X GET http://localhost:5000/api/chat/suggestions \
  -H "Authorization: Bearer TOKEN"

# 5. Search FAQ
curl -X GET "http://localhost:5000/api/chat/faq/search?keyword=giờ" \
  -H "Authorization: Bearer TOKEN"
```

### 2. Test Frontend

1. Mở ứng dụng frontend
2. Đăng nhập
3. Nhấp vào nút chatbot (💬) ở góc dưới phải
4. Gửi tin nhắn
5. Kiểm tra bot response

### 3. Test Escalation

1. Gửi tin nhắn mà bot không hiểu
2. Kiểm tra conversation status thay đổi thành "escalated"
3. Kiểm tra admin nhận được notification

---

## 📊 Database Schema

### chat_conversations
```
id (PK)
user_id (FK → users)
status (open|closed|escalated)
assigned_staff_id (FK → users)
subject
created_at
updated_at
closed_at
```

### chat_messages
```
id (PK)
conversation_id (FK → chat_conversations)
sender_type (customer|bot|staff)
sender_id (FK → users)
message_text
message_type (text|suggestion|quick_reply|system)
metadata (JSON)
is_read
created_at
```

### chat_suggestions
```
id (PK)
category
title
description
icon
action_type (service|booking|faq|contact|promotion)
action_data (JSON)
priority
is_active
created_at
updated_at
```

### chat_faq
```
id (PK)
question
answer
category
keywords
is_active
view_count
helpful_count
created_at
updated_at
```

### chat_bot_responses
```
id (PK)
trigger_keyword
response_text
response_type (text|suggestion|escalate)
confidence_score
is_active
created_at
updated_at
```

---

## 🔐 Security Notes

1. **Token Validation**: Tất cả endpoints yêu cầu authentication
2. **Permission Check**: Kiểm tra user chỉ có thể xem conversation của họ
3. **Input Validation**: Validate tất cả input từ client
4. **SQL Injection**: Sử dụng parameterized queries

---

## 📝 Troubleshooting

### Chatbot không hiển thị
- Kiểm tra user đã đăng nhập
- Kiểm tra token hợp lệ
- Kiểm tra console cho errors

### Bot không trả lời
- Kiểm tra `chat_bot_responses` có dữ liệu
- Kiểm tra trigger keywords
- Kiểm tra confidence score

### Escalation không hoạt động
- Kiểm tra conversation status update
- Kiểm tra admin notification system
- Kiểm tra staff assignment logic

---

## 🎯 Next Steps

1. ✅ Chạy migration database
2. ✅ Tích hợp backend routes
3. ✅ Tích hợp frontend component
4. ✅ Thêm suggestions & FAQ
5. ✅ Test tất cả features
6. ✅ Deploy lên production

---

**Liên hệ hỗ trợ**: Nếu có vấn đề, kiểm tra logs hoặc liên hệ team development.
