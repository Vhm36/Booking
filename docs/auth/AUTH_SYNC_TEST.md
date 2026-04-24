# 🧪 TEST CHECKLIST - AUTH SYNC FIXES

Ngày: 03/04/2026

---

## ✅ FIX #1: Email Normalization (toLowerCase)

### Code thay đổi:

- Backend: `authController.js` - Line 17 & 74 thêm `.toLowerCase()`

### Test:

```bash
# Scenario 1: Email với uppercase
POST http://localhost:5000/api/auth/register
{
  "name": "User Test",
  "email": "JOHN@EXAMPLE.COM",
  "password": "Test1234",
  "phone": "0987654321"
}

# Expected: Email được lưu là 'john@example.com'
# Verify query DB: SELECT email FROM users WHERE id = ?;
# Result: john@example.com ✓
```

```bash
# Scenario 2: Login với casing khác
POST http://localhost:5000/api/auth/login
{
  "email": "john@EXAMPLE.COM",
  "password": "Test1234"
}

# Expected: Đăng nhập thành công (email matched)
# Result: {success: true, message: "...", token: "...", user: {...}} ✓
```

---

## ✅ FIX #2: Register Response - Return User Data

### Code thay đổi:

- Backend: `authController.js` - Line 58-68 thêm user object vào response

### Test:

```bash
POST http://localhost:5000/api/auth/register
{
  "name": "John Doe",
  "email": "john@test.com",
  "password": "Test1234",
  "phone": "0987654321"
}

# Expected response:
{
  "success": true,
  "message": "Đăng ký thành công",
  "user": {
    "id": 123,                          # ✓ Có ID
    "name": "John Doe",                 # ✓ Có tên
    "email": "john@test.com",           # ✓ Có email
    "phone": "0987654321",              # ✓ Có phone
    "role": "customer"                  # ✓ Có role
  }
}
```

### Verify Frontend:

- Frontend `authService.register` nhận response này
- Có thể tự động login ngay nếu có token (improvement)

---

## ✅ FIX #3: Login Response - Add Phone Field

### Code thay đổi:

- Backend: `authController.js` - Line 126 thêm `phone: user.phone`

### Test:

```bash
POST http://localhost:5000/api/auth/login
{
  "email": "john@test.com",
  "password": "Test1234"
}

# Expected response:
{
  "success": true,
  "message": "Đăng nhập thành công",
  "token": "eyJhbGc...",
  "user": {
    "id": 123,
    "name": "John Doe",
    "email": "john@test.com",
    "phone": "0987654321",              # ✓ MỚI - Trước đó không có
    "role": "customer"
  }
}
```

### Verify localStorage:

```javascript
// Frontend console
const user = JSON.parse(localStorage.getItem("user"));
console.log(user.phone); // ✓ Phải có phone
```

---

## ✅ FIX #4: Frontend Password Requirements UI

### Code thay đổi:

- Frontend: `Register.js` - Thêm password requirements indicator
- Thêm real-time validation feedback

### Test:

1. Mở http://localhost:3000/register
2. Xem form "Đăng ký"
3. Bắt đầu nhập mật khẩu
4. **Expected:**
   - ❌ Chỉ 5 ký tự: "✗ Ít nhất 6 ký tự" (màu đỏ/xám)
   - ✓ 6+ ký tự: "✓ Ít nhất 6 ký tự" (màu xanh)
   - ✓ Chứa chữ: "✓ Chứa ít nhất 1 chữ cái" (màu xanh)
   - ✓ Chứa số: "✓ Chứa ít nhất 1 số" (màu xanh)
5. Button "Đăng ký" bị disable cho đến khi tất cả yêu cầu được đáp ứng

---

## ✅ FIX #5: Bearer Token Validation Improvement

### Code thay đổi:

- Backend: `authMiddleware.js` - Cải thiện token extraction logic

### Test:

```bash
# Scenario 1: Invalid format - missing "Bearer"
GET http://localhost:5000/api/auth/profile
Headers: Authorization: eyJhbGc...

# Expected: 401 error
{
  "success": false,
  "message": "Token không được cung cấp hoặc format không đúng (cần: Bearer {token})"
}

# Scenario 2: Valid format
GET http://localhost:5000/api/auth/profile
Headers: Authorization: Bearer eyJhbGc...

# Expected: 200 OK (hoặc 401 nếu token invalid)
# Phải parse đúng token từ header
```

---

## 🔍 INTEGRATION TEST

### Test đầy đủ flow:

```bash
# 1. Register user
POST http://localhost:5000/api/auth/register
{
  "name": "Integration Test User",
  "email": "test@integration.com",
  "password": "Test12345",
  "phone": "0123456789"
}
✓ Response: {success: true, user: {...}}
✓ Email normalized: test@integration.com
✓ Has phone: 0123456789

# 2. Login (case-insensitive)
POST http://localhost:5000/api/auth/login
{
  "email": "TEST@INTEGRATION.COM",
  "password": "Test12345"
}
✓ Response: {success: true, token: "...", user: {...}}
✓ User includes phone: 0123456789

# 3. Get profile (with Bearer token)
GET http://localhost:5000/api/auth/profile
Headers: Authorization: Bearer {token}
✓ Response: {success: true, data: {id, name, email, phone, role}}

# 4. Frontend localStorage
localStorage.getItem('token') ✓ có token
localStorage.getItem('user') ✓ có user object với phone
```

---

## 📋 TEST EXECUTION GUIDE

### Requirement:

- Node.js server running
- Frontend dev server running
- MySQL/database có users table

### Run tests:

1. **Terminal 1 - Backend**

   ```bash
   cd backend
   npm start
   # Expected: Server running on http://localhost:5000
   ```

2. **Terminal 2 - Frontend**

   ```bash
   cd frontend
   npm start
   # Expected: App running on http://localhost:3000
   ```

3. **Manual Testing (Postman/Insomnia):**
   - Tạo Register collection dùng các scenario trên
   - Test từng endpoint
   - Verify responses

4. **Frontend Testing:**
   - Test Register form UX
   - Test Login form
   - Check localStorage after login
   - Check network tab - verify Authorization header format

---

## ✅ SUCCESS CRITERIA

| Test                                 | Expected                                      | Status     |
| ------------------------------------ | --------------------------------------------- | ---------- |
| Register with uppercase email        | Email normalized to lowercase                 | 🔄 PENDING |
| Register response has user data      | user object with id, name, email, phone, role | 🔄 PENDING |
| Login returns phone field            | user.phone present in response                | 🔄 PENDING |
| Frontend shows password requirements | Interactive hints visible on Register page    | 🔄 PENDING |
| Bearer token validation              | Strict format checking in middleware          | 🔄 PENDING |
| Email case-insensitive login         | Login works with any case variation           | 🔄 PENDING |

---

## 🐛 KNOWN ISSUES TO MONITOR

1. **Database migration:** Ensure users table has phone field
2. **Backward compatibility:** Old tokens might fail with new Bearer format validation
3. **localStorage sync:** Clear localStorage in dev tools after changes
4. **CORS:** If frontend/backend different ports, ensure CORS configured

---

## 📝 NOTES

- Tất cả fix đã apply vào code
- Kiểm tra xem có lỗi syntax không (run `npm start` backend)
- Frontend có thể cần rebuild sau khi frontend file thay đổi
