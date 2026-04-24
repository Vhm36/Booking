# 🔴 BÁO CÁO LỖI ĐỒNG BỘ HÓA ĐĂNG NHẬP/ĐĂNG KÝ

**Ngày phát hiện:** 03/04/2026  
**Mức độ:** TRUNG BÌNH → CAO  
**Số lỗi:** 7 vấn đề chính

---

## 1. ❌ REGISTER KHÔNG TRẢ VỀ USER DATA

### Vấn đề:

```javascript
// Backend - authController.js (Dòng 57-61)
res.status(201).json({
  success: true,
  message: "Đăng ký thành công",
  // ❌ THIẾU user data
});

// Frontend - Register.js (Dòng 22-23)
await authService.register(name, email, password, phone);
setSuccess("Đăng ký thành công! Vui lòng đăng nhập.");
setTimeout(() => navigate("/login"), 2000); // ❌ User phải đăng nhập lại
```

### Tác động:

- User phải chờ 2 giây rồi đăng nhập lại
- Không có xác nhận user được tạo thành công
- Data không đồng bộ giữa front/back

### ✅ Giải pháp:

```javascript
// Trả về user data sau khi đăng ký
res.status(201).json({
  success: true,
  message: "Đăng ký thành công",
  user: {
    id: result.insertId, // Lấy ID mới từ database
    name: normalizedName,
    email: normalizedEmail,
    role: "customer",
  },
});
```

---

## 2. ❌ PHONE KHÔNG ĐƯỢC TRẢ VỀ SAU LOGIN

### Vấn đề:

```javascript
// Backend - authController.js (Dòng 110-115)
res.status(200).json({
  success: true,
  message: "Đăng nhập thành công",
  token,
  user: {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    // ❌ THIẾU phone
  },
});

// Frontend sẽ không có phone trong localStorage
// nhưng Profile page có thể cần phone
```

### Tác động:

- Profile không hiển thị số điện thoại sau đăng nhập
- Dữ liệu người dùng bị thiếu

### ✅ Giải pháp:

```javascript
user: {
  id: user.id,
  name: user.name,
  email: user.email,
  phone: user.phone, // ✅ Thêm phone
  role: user.role
}
```

---

## 3. ❌ EMAIL VALIDATION INCONSISTENCY

### Vấn đề:

```javascript
// validationMiddleware.js - validateRegister
body('email')
  .trim()
  .isEmail().withMessage('Email không hợp lệ')
  .normalizeEmail(), // ✅ Normalize (chuyển thành lowercase)

// authController.js - register
const normalizedEmail = (email || '').trim(); // ❌ Chỉ trim, không normalize
```

**Nếu user nhập:** `John@EXAMPLE.COM`

- Validation middleware sẽ normalize thành: `john@example.com`
- Nhưng controller lại dùng: `John@EXAMPLE.COM`

### Tác động:

- Email không được đồng bộ hóa đúng cách
- Có thể tạo được 2 tài khoản với cùng email (nhưng khác casing)

### ✅ Giải pháp:

```javascript
// authController.js
const normalizedEmail = (email || "").trim().toLowerCase(); // ✅ Thêm toLowerCase()
```

---

## 4. ❌ PASSWORD REQUIREMENTS KHÔNG HIỂN THỊ

### Vấn đề:

**Backend yêu cầu:**

```javascript
body("password")
  .isLength({ min: 6 })
  .withMessage("Mật khẩu phải ít nhất 6 ký tự")
  .matches(/^(?=.*[a-zA-Z])(?=.*\d)/)
  .withMessage("Mật khẩu phải chứa chữ và số");
```

**Frontend:**

```javascript
<input type="password" placeholder="Mật khẩu" required />
// ❌ Không hiển thị yêu cầu: phải ≥6 ký tự, chứa chữ + số
```

### Tác động:

- User nhập sai format mà không biết
- UX xấu, phải thử nhiều lần

### ✅ Giải pháp:

Thêm validation hint trên UI:

```javascript
<div className="password-requirements">
  <p>Mật khẩu phải có:</p>
  <ul>
    <li>Ít nhất 6 ký tự</li>
    <li>Chứa ít nhất 1 chữ cái</li>
    <li>Chứa ít nhất 1 số</li>
  </ul>
</div>
```

---

## 5. ❌ DATA LOSS VÀ INCONSISTENCY

### Vấn đề:

```javascript
// Register trả về: { success, message }
// Login trả về: { success, message, token, user, ... }
```

**Response không consistent:**

- Register: `201` + minimal response
- Login: `200` + full response
- Frontend phải xử lý 2 format khác nhau

### ✅ Giải pháp:

Unify response format:

```javascript
// Cả register và login đều trả về
{
  success: true,
  message: '...',
  token: '...', // Login có, register không
  user: {
    id, name, email, phone, role
  }
}
```

---

## 6. ❌ JWT_SECRET FALLBACK INCONSISTENCY

### Vấn đề:

```javascript
// authController.js - Không có fallback, FAIL nếu không set
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("ERROR: JWT_SECRET must be set in environment variables");
}

// authMiddleware.js - Cũng không có fallback
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("ERROR: JWT_SECRET environment variable is not set...");
}
```

**Nhưng khi tạo token:**

```javascript
// authController.js đã check, OK
// Nhưng nếu ENV thay đổi sau khi server start, không detect lại
```

### ✅ Giải pháp:

Thêm helper function:

```javascript
function getJWTSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET environment variable not set");
  }
  return secret;
}

// Dùng trong authController
const token = jwt.sign(payload, getJWTSecret(), { expiresIn: JWT_EXPIRE });
```

---

## 7. ❌ AUTHORIZATION HEADER VALIDATION

### Vấn đề:

```javascript
// authMiddleware.js
const token = req.headers.authorization?.split(" ")[1];
// ❌ Nếu user set sai format, có thể lỗi

// Ví dụ:
// "Bearer token123" → OK
// "token123" → undefined (lỗi)
// "bearer token123" → lowercase check?
```

### Tác động:

- Frontend format đúng: `Bearer {token}`
- Nhưng middleware không validate strict

### ✅ Giải pháp:

```javascript
const authHeader = req.headers.authorization || "";
const match = authHeader.match(/^Bearer\s+(.+)$/);
const token = match ? match[1] : null;

if (!token) {
  return res.status(401).json({
    success: false,
    message: "Invalid or missing token format",
  });
}
```

---

## 📊 TÓMSẮT HÀNH ĐỘNG CẦN THỰC HIỆN

| Lỗi                           | Mức độ   | File cần fix      | Ưu tiên |
| ----------------------------- | -------- | ----------------- | ------- |
| Register không trả user data  | 🔴 CAO   | authController.js | ⭐⭐⭐  |
| Phone thiếu trong login       | 🟡 TRUNG | authController.js | ⭐⭐⭐  |
| Email normalize inconsistency | 🔴 CAO   | authController.js | ⭐⭐⭐  |
| Password requirements UI      | 🟡 TRUNG | Register.js       | ⭐⭐    |
| Response format inconsistent  | 🟡 TRUNG | authController.js | ⭐⭐    |
| JWT_SECRET runtime check      | 🟢 THẤP  | authController.js | ⭐      |
| Bearer token validation       | 🟡 TRUNG | authMiddleware.js | ⭐⭐    |

---

## 🔧 RECOMMENDED FIX ORDER

1. **NGAY**: Fix email normalization (lỗi data integrity)
2. **NGAY**: Add phone to login response
3. **NGAY**: Make register return full user data
4. **SAU**: Improve Bearer token validation
5. **SAU**: Add password requirements to UI
6. **SAU**: Unify response formats

**Tổng thời gian fix:** 30-45 phút
