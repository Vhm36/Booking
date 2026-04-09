const jwt = require('jsonwebtoken');

// FIX 1: Require JWT_SECRET to be set in environment
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error('ERROR: JWT_SECRET environment variable is not set. Please configure it in .env file');
}

// Middleware xác thực JWT
const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization || '';
  const match = authHeader.match(/^Bearer\s+(.+)$/);
  const token = match ? match[1] : null;

  if (!token) {
    return res.status(401).json({ 
      success: false, 
      message: 'Token không được cung cấp hoặc format không đúng (cần: Bearer {token})' 
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    let message = 'Token không hợp lệ';
    if (err.name === 'TokenExpiredError') {
      message = 'Token đã hết hạn';
    } else if (err.name === 'JsonWebTokenError') {
      message = 'Token không hợp lệ';
    }
    return res.status(401).json({ 
      success: false, 
      message 
    });
  }
};

// Middleware kiểm tra quyền admin
const verifyAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ 
      success: false, 
      message: 'Bạn không có quyền truy cập' 
    });
  }
  next();
};

// Middleware kiểm tra quyền admin hoặc staff
const verifyAdminOrStaff = (req, res, next) => {
  if (req.user.role !== 'admin' && req.user.role !== 'staff') {
    return res.status(403).json({ 
      success: false, 
      message: 'Bạn không có quyền truy cập' 
    });
  }
  next();
};

// FIX 3: Add staff authorization check
// Middleware để kiểm tra staff chỉ có thể update lịch của nhân viên được assign cho họ
const verifyStaffOwnership = (appointmentStaffId, currentUserId, currentUserRole) => {
  if (currentUserRole === 'admin') {
    return true; // Admin có thể sửa bất kỳ lịch nào
  }
  if (currentUserRole === 'staff') {
    return appointmentStaffId === currentUserId; // Staff chỉ có thể sửa lịch của họ
  }
  return false;
};

module.exports = {
  verifyToken,
  verifyAdmin,
  verifyAdminOrStaff,
  verifyStaffOwnership
};
