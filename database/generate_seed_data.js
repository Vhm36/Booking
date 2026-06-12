/**
 * Script tạo dữ liệu seed lớn cho BeautyBook
 * - 500 dịch vụ
 * - 20,000 khách hàng (tên Việt đầy đủ, ngày sinh 1970 - đủ 16 tuổi)
 * - 20 nhân viên dịch vụ
 * - 10 thu ngân
 * - 5 quản lý
 * - Tự động đặt lịch hẹn từ 2024 đến nay
 */

const fs = require('fs');
const path = require('path');

// ===================== HỌ TÊN VIỆT NAM =====================
const ho = [
  'Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Huỳnh', 'Phan', 'Vũ', 'Võ', 'Đặng',
  'Bùi', 'Đỗ', 'Hồ', 'Ngô', 'Dương', 'Lý', 'Đào', 'Đinh', 'Mai', 'Trịnh',
  'Lương', 'Tạ', 'Cao', 'Tô', 'Châu', 'Tăng', 'Quách', 'Hà', 'Thái', 'Nghiêm'
];

const demNu = [
  'Thị', 'Ngọc', 'Thanh', 'Thu', 'Minh', 'Hoàng', 'Phương', 'Hồng', 'Kim', 'Bích',
  'Quỳnh', 'Diệu', 'Thùy', 'Tường', 'Mỹ', 'Xuân', 'Khánh', 'Ánh', 'Hải', 'Yến'
];

const demNam = [
  'Văn', 'Hữu', 'Đức', 'Công', 'Quốc', 'Minh', 'Thành', 'Tuấn', 'Hùng', 'Trung',
  'Anh', 'Đình', 'Xuân', 'Bá', 'Ngọc', 'Hoàng', 'Trọng', 'Phúc', 'Viết', 'Tiến'
];

const tenNu = [
  'An', 'Anh', 'Bình', 'Chi', 'Châu', 'Diễm', 'Dung', 'Duyên', 'Giang', 'Hà',
  'Hạnh', 'Hằng', 'Hiền', 'Hoa', 'Hương', 'Huyền', 'Khanh', 'Lan', 'Liên', 'Linh',
  'Loan', 'Ly', 'Mai', 'My', 'Nga', 'Ngân', 'Ngọc', 'Nhi', 'Nhung', 'Như',
  'Oanh', 'Phượng', 'Quyên', 'Tâm', 'Thảo', 'Thi', 'Thủy', 'Thương', 'Tiên', 'Trang',
  'Trâm', 'Trinh', 'Trúc', 'Tuyết', 'Uyên', 'Vân', 'Vi', 'Xuân', 'Yến', 'Ý',
  'Phương', 'Hồng', 'Đào', 'Cúc', 'Huệ', 'Sen', 'Lệ', 'Tuyền', 'Hạ', 'Thu'
];

const tenNam = [
  'An', 'Bình', 'Cường', 'Dũng', 'Đạt', 'Hải', 'Hiếu', 'Hoàng', 'Hùng', 'Hưng',
  'Khải', 'Khoa', 'Kiên', 'Lâm', 'Long', 'Minh', 'Nam', 'Nghĩa', 'Nhân', 'Phong',
  'Phú', 'Quang', 'Quân', 'Sơn', 'Tài', 'Thắng', 'Thiện', 'Toàn', 'Trí', 'Trung',
  'Tuấn', 'Tùng', 'Việt', 'Vũ', 'Duy', 'Đức', 'Hào', 'Khánh', 'Bảo', 'Thành'
];

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomDate(start, end) {
  const d = new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
  return d;
}

function formatDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function formatDateTime(d) {
  return `${formatDate(d)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
}

function escapeSQL(str) {
  if (str === null || str === undefined) return 'NULL';
  return str.replace(/'/g, "''").replace(/\\/g, '\\\\');
}

// Tạo tên nữ Việt Nam đầy đủ
function generateFemaleName() {
  return `${randomItem(ho)} ${randomItem(demNu)} ${randomItem(tenNu)}`;
}

// Tạo tên nam Việt Nam đầy đủ
function generateMaleName() {
  return `${randomItem(ho)} ${randomItem(demNam)} ${randomItem(tenNam)}`;
}

// Tạo tên ngẫu nhiên (80% nữ cho salon)
function generateName() {
  return Math.random() < 0.8 ? generateFemaleName() : generateMaleName();
}

// Tạo ngày sinh từ 1970 đến đủ 16 tuổi (tức sinh trước 2010-06-12)
function generateDOB() {
  const start = new Date(1970, 0, 1);
  const end = new Date(2010, 5, 12); // Đủ 16 tuổi tính đến 2026-06-12
  return randomDate(start, end);
}

// Tạo số điện thoại
function generatePhone(index) {
  const prefixes = ['090', '091', '093', '094', '096', '097', '098', '032', '033', '034', '035', '036', '037', '038', '039', '070', '076', '077', '078', '079', '081', '082', '083', '084', '085', '086', '088', '089'];
  const prefix = randomItem(prefixes);
  const suffix = String(index).padStart(7, '0');
  return prefix + suffix;
}

// Tạo email từ tên
function removeVietnameseAccents(str) {
  const map = {
    'à': 'a', 'á': 'a', 'ả': 'a', 'ã': 'a', 'ạ': 'a',
    'ă': 'a', 'ằ': 'a', 'ắ': 'a', 'ẳ': 'a', 'ẵ': 'a', 'ặ': 'a',
    'â': 'a', 'ầ': 'a', 'ấ': 'a', 'ẩ': 'a', 'ẫ': 'a', 'ậ': 'a',
    'đ': 'd',
    'è': 'e', 'é': 'e', 'ẻ': 'e', 'ẽ': 'e', 'ẹ': 'e',
    'ê': 'e', 'ề': 'e', 'ế': 'e', 'ể': 'e', 'ễ': 'e', 'ệ': 'e',
    'ì': 'i', 'í': 'i', 'ỉ': 'i', 'ĩ': 'i', 'ị': 'i',
    'ò': 'o', 'ó': 'o', 'ỏ': 'o', 'õ': 'o', 'ọ': 'o',
    'ô': 'o', 'ồ': 'o', 'ố': 'o', 'ổ': 'o', 'ỗ': 'o', 'ộ': 'o',
    'ơ': 'o', 'ờ': 'o', 'ớ': 'o', 'ở': 'o', 'ỡ': 'o', 'ợ': 'o',
    'ù': 'u', 'ú': 'u', 'ủ': 'u', 'ũ': 'u', 'ụ': 'u',
    'ư': 'u', 'ừ': 'u', 'ứ': 'u', 'ử': 'u', 'ữ': 'u', 'ự': 'u',
    'ỳ': 'y', 'ý': 'y', 'ỷ': 'y', 'ỹ': 'y', 'ỵ': 'y',
    'À': 'A', 'Á': 'A', 'Ả': 'A', 'Ã': 'A', 'Ạ': 'A',
    'Ă': 'A', 'Ằ': 'A', 'Ắ': 'A', 'Ẳ': 'A', 'Ẵ': 'A', 'Ặ': 'A',
    'Â': 'A', 'Ầ': 'A', 'Ấ': 'A', 'Ẩ': 'A', 'Ẫ': 'A', 'Ậ': 'A',
    'Đ': 'D',
    'È': 'E', 'É': 'E', 'Ẻ': 'E', 'Ẽ': 'E', 'Ẹ': 'E',
    'Ê': 'E', 'Ề': 'E', 'Ế': 'E', 'Ể': 'E', 'Ễ': 'E', 'Ệ': 'E',
    'Ì': 'I', 'Í': 'I', 'Ỉ': 'I', 'Ĩ': 'I', 'Ị': 'I',
    'Ò': 'O', 'Ó': 'O', 'Ỏ': 'O', 'Õ': 'O', 'Ọ': 'O',
    'Ô': 'O', 'Ồ': 'O', 'Ố': 'O', 'Ổ': 'O', 'Ỗ': 'O', 'Ộ': 'O',
    'Ơ': 'O', 'Ờ': 'O', 'Ớ': 'O', 'Ở': 'O', 'Ỡ': 'O', 'Ợ': 'O',
    'Ù': 'U', 'Ú': 'U', 'Ủ': 'U', 'Ũ': 'U', 'Ụ': 'U',
    'Ư': 'U', 'Ừ': 'U', 'Ứ': 'U', 'Ử': 'U', 'Ữ': 'U', 'Ự': 'U',
    'Ỳ': 'Y', 'Ý': 'Y', 'Ỷ': 'Y', 'Ỹ': 'Y', 'Ỵ': 'Y'
  };
  return str.split('').map(c => map[c] || c).join('');
}

function nameToEmail(name, index) {
  const clean = removeVietnameseAccents(name).toLowerCase().replace(/\s+/g, '');
  const domains = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com'];
  return `${clean}${index}@${randomItem(domains)}`;
}

// Bcrypt hash cho '123456'
const BCRYPT_HASH = '$2a$10$0pvvqR74Znq9SuBZ0HkOju0Dlar/LZIhcL6fxa7GzUxlBL37liBwG';

// ===================== DỊCH VỤ 500 =====================
const serviceCategories = [
  { name: 'Tóc', services: [] },
  { name: 'Gội/Massage', services: [] },
  { name: 'Nail/Móng', services: [] },
  { name: 'Mi/Mày', services: [] },
  { name: 'Da mặt', services: [] },
  { name: 'Khác', services: [] }
];

// Templates dịch vụ cho mỗi danh mục
const serviceTemplates = {
  'Tóc': [
    { prefix: 'Cắt tóc', descriptions: ['ngắn gọn', 'layer', 'mullet', 'bob', 'pixie', 'tỉa mái', 'tỉa layer dài', 'kiểu Hàn', 'kiểu Nhật', 'undercut', 'taper fade', 'wolf cut', 'shag', 'butterfly', 'curtain bangs'], priceRange: [80000, 250000], durationRange: [30, 60] },
    { prefix: 'Nhuộm tóc', descriptions: ['highlight', 'lowlight', 'balayage', 'ombre', 'sombre', 'phủ bạc', 'tone nâu', 'tone đỏ', 'tone xám khói', 'tone tím', 'tone xanh', 'tone vàng', 'full đầu', 'baby light', 'airtouch'], priceRange: [300000, 3000000], durationRange: [90, 240] },
    { prefix: 'Uốn tóc', descriptions: ['sóng lơi', 'xoăn tự nhiên', 'cụp đuôi', 'phồng chân', 'uốn lạnh', 'uốn nóng', 'uốn digital', 'kiểu xoắn', 'uốn gợn sóng', 'uốn bob', 'xoăn lọn to', 'xoăn lọn nhỏ', 'setting', 'cosmo'], priceRange: [500000, 1500000], durationRange: [90, 180] },
    { prefix: 'Duỗi tóc', descriptions: ['tơ tằm', 'keratin', 'collagen', 'protein', 'cysteine', 'nano', 'siêu mềm mượt', 'chữa xù', 'phục hồi duỗi', 'duỗi cúp'], priceRange: [500000, 1200000], durationRange: [90, 150] },
    { prefix: 'Hấp dầu', descriptions: ['phục hồi', 'dưỡng ẩm', 'collagen', 'keratin', 'argan', 'biotin', 'tóc khô xơ', 'tóc hư tổn', 'tóc nhuộm', 'siêu mượt'], priceRange: [200000, 600000], durationRange: [45, 90] },
    { prefix: 'Tạo kiểu tóc', descriptions: ['dự tiệc', 'cô dâu', 'sự kiện', 'prom', 'bím tóc', 'búi tóc', 'tóc xoăn lọn', 'tóc thẳng suôn', 'retro', 'vintage'], priceRange: [200000, 800000], durationRange: [45, 120] },
    { prefix: 'Nối tóc', descriptions: ['kẹp', 'keo', 'sợi tự nhiên', 'sợi tổng hợp', 'micro ring', 'tape in', 'clip in', 'nano ring', 'tóc thật 100%'], priceRange: [1000000, 5000000], durationRange: [120, 300] },
    { prefix: 'Phục hồi tóc', descriptions: ['olaplex', 'tokio inkarami', 'milbon', 'nano phục hồi', 'tái tạo sợi', 'bổ sung protein', 'liệu trình chuyên sâu', 'moisture recovery'], priceRange: [400000, 2000000], durationRange: [60, 120] },
  ],
  'Gội/Massage': [
    { prefix: 'Gội đầu', descriptions: ['dưỡng sinh', 'thư giãn', 'thảo dược', 'tinh dầu bạc hà', 'tinh dầu oải hương', 'detox', 'trị gàu', 'ngừa rụng', 'kích mọc', 'dầu dừa'], priceRange: [60000, 200000], durationRange: [20, 45] },
    { prefix: 'Massage đầu', descriptions: ['ấn huyệt', 'đả thông kinh lạc', 'giải tỏa stress', 'trị đau đầu', 'thư giãn sâu', 'tăng tuần hoàn', 'liệu pháp Nhật', 'Cranial sacral', 'phong cách Thái'], priceRange: [100000, 300000], durationRange: [30, 60] },
    { prefix: 'Massage body', descriptions: ['toàn thân', 'đá nóng', 'tinh dầu', 'Thái', 'shiatsu', 'Thụy Điển', 'deep tissue', 'bamboo', 'lomi lomi', 'aromatherapy'], priceRange: [200000, 600000], durationRange: [60, 120] },
    { prefix: 'Massage mặt', descriptions: ['nâng cơ', 'trẻ hóa', 'kobido', 'bấm huyệt', 'gua sha', 'roller đá', 'collagen', 'giảm nếp nhăn', 'sáng da', 'thải độc'], priceRange: [150000, 400000], durationRange: [30, 60] },
    { prefix: 'Xông hơi', descriptions: ['thảo dược', 'ozone', 'nano', 'thanh lọc', 'detox da', 'mở lỗ chân lông', 'thư giãn', 'sauna khô', 'hồng ngoại'], priceRange: [100000, 250000], durationRange: [20, 45] },
  ],
  'Nail/Móng': [
    { prefix: 'Sơn gel', descriptions: ['đơn sắc', 'ombre', 'mắt mèo', 'kim cương', 'sơn thạch', 'gương', 'nhũ', 'holographic', 'cat eye', 'chrome', 'aurora', 'velvet', 'marble', 'galaxy'], priceRange: [80000, 300000], durationRange: [30, 60] },
    { prefix: 'Nail art', descriptions: ['vẽ tay', 'đắp bột', 'đính đá', 'foil', 'sticker', 'stamping', 'watercolor', 'ẩn xà cừ', 'hoa 3D', 'thiết kế riêng', 'phong cách Nhật', 'minimalist', 'French'], priceRange: [150000, 500000], durationRange: [45, 90] },
    { prefix: 'Chăm sóc móng', descriptions: ['manicure', 'pedicure', 'combo tay chân', 'nhặt da', 'sửa dáng', 'dưỡng ẩm', 'kem tay chân', 'paraffin', 'scrub', 'chà gót'], priceRange: [50000, 200000], durationRange: [20, 45] },
    { prefix: 'Nối móng', descriptions: ['gel tips', 'acrylic', 'polygel', 'builder gel', 'fiber glass', 'silk wrap', 'coffin', 'stiletto', 'almond', 'ballerina'], priceRange: [200000, 600000], durationRange: [60, 120] },
    { prefix: 'Tháo móng', descriptions: ['gel', 'acrylic', 'dip powder', 'polygel', 'gel tips', 'soak off', 'file off'], priceRange: [50000, 150000], durationRange: [15, 30] },
  ],
  'Mi/Mày': [
    { prefix: 'Nối mi', descriptions: ['classic', 'volume', 'mega volume', 'hybrid', 'wispy', 'wet look', 'katun', 'Kim cương', 'YY', 'fox eye', 'doll eye', 'natural'], priceRange: [150000, 500000], durationRange: [60, 120] },
    { prefix: 'Uốn mi', descriptions: ['collagen', 'keratin', 'lash lift', 'phủ đen', 'dưỡng mi', 'uốn + nhuộm', 'lamination'], priceRange: [100000, 300000], durationRange: [30, 60] },
    { prefix: 'Phun mày', descriptions: ['ombre', 'hairstroke', 'combo', 'powder', 'mist', 'feather', 'nano', 'microblading', 'shading'], priceRange: [1500000, 4000000], durationRange: [90, 180] },
    { prefix: 'Điêu khắc mày', descriptions: ['sợi tự nhiên', '6D', '9D', 'siêu thực', 'nano', 'kết hợp shading', 'theo khuôn mặt', 'châu Âu'], priceRange: [2000000, 5000000], durationRange: [90, 150] },
    { prefix: 'Waxing mày', descriptions: ['tỉa dáng', 'định hình', 'waxing sáp', 'chỉ Ấn Độ', 'kẹp nhíp', 'tạo dáng chuẩn'], priceRange: [40000, 120000], durationRange: [15, 30] },
    { prefix: 'Gỡ mi nối', descriptions: ['nhẹ nhàng', 'dưỡng mi sau gỡ', 'an toàn', 'không đau'], priceRange: [50000, 100000], durationRange: [15, 30] },
  ],
  'Da mặt': [
    { prefix: 'Chăm sóc da', descriptions: ['cơ bản', 'chuyên sâu', 'trị mụn', 'trị nám', 'trắng sáng', 'chống lão hóa', 'cấp ẩm', 'da nhạy cảm', 'da dầu', 'da khô', 'da hỗn hợp', 'detox', 'thu nhỏ lỗ chân lông'], priceRange: [150000, 600000], durationRange: [45, 90] },
    { prefix: 'Peel da', descriptions: ['AHA', 'BHA', 'salicylic', 'glycolic', 'lactic', 'TCA', 'jessner', 'enzyme', 'retinol', 'vitamin C'], priceRange: [200000, 500000], durationRange: [30, 60] },
    { prefix: 'Đắp mặt nạ', descriptions: ['collagen', 'vàng 24k', 'tảo biển', 'than hoạt tính', 'hyaluronic', 'nọc ong', 'yến sào', 'trà xanh', 'nghệ', 'vitamin E'], priceRange: [100000, 400000], durationRange: [30, 60] },
    { prefix: 'Điện di', descriptions: ['vitamin C', 'hyaluronic', 'collagen', 'niacinamide', 'peptide', 'retinol', 'tranexamic'], priceRange: [250000, 600000], durationRange: [45, 75] },
    { prefix: 'Laser trị liệu', descriptions: ['carbon', 'fractional', 'IPL', 'Q-switch', 'Nd:YAG', 'trị nám', 'trị sẹo', 'trẻ hóa', 'se khít', 'xóa xăm'], priceRange: [500000, 2000000], durationRange: [30, 90] },
    { prefix: 'Cấy dưỡng chất', descriptions: ['tảo xoắn', 'hồng sâm', 'HA', 'stem cell', 'placenta', 'DNA cá hồi', 'vitamin', 'glutathione', 'collagen'], priceRange: [300000, 800000], durationRange: [45, 90] },
  ],
  'Khác': [
    { prefix: 'Waxing lông', descriptions: ['tay', 'chân', 'nách', 'bikini', 'toàn thân', 'mép', 'lưng', 'bụng', 'ngực', 'mặt'], priceRange: [50000, 300000], durationRange: [15, 60] },
    { prefix: 'Triệt lông', descriptions: ['diode laser', 'IPL', 'SHR', 'OPT', 'vĩnh viễn', 'nách', 'chân', 'tay', 'bikini', 'mặt'], priceRange: [200000, 800000], durationRange: [15, 60] },
    { prefix: 'Tắm trắng', descriptions: ['phi thuyền', 'collagen', 'nano', 'vitamin C', 'ủ trắng', 'tắm sữa', 'tắm rượu vang', 'tắm thảo dược', 'tắm tinh dầu'], priceRange: [300000, 1000000], durationRange: [60, 120] },
    { prefix: 'Giảm béo', descriptions: ['RF', 'cavitation', 'cryolipolysis', 'HIFU body', 'mesotherapy', 'carboxytherapy', 'laser lipo', 'đắp thuốc'], priceRange: [500000, 2000000], durationRange: [45, 90] },
    { prefix: 'Xăm thẩm mỹ', descriptions: ['xăm môi', 'xăm mí', 'xăm mày', 'xăm nốt ruồi', 'phun thêu hoa hồng', 'touch up'], priceRange: [1000000, 5000000], durationRange: [60, 180] },
  ]
};

function generateServices() {
  const services = [];
  const images = {
    'Tóc': [
      'https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1519699047748-de8e457a634e?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?auto=format&fit=crop&w=800&q=80',
    ],
    'Gội/Massage': [
      'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1600334089648-b0d9d3028eb2?auto=format&fit=crop&w=800&q=80',
    ],
    'Nail/Móng': [
      'https://images.unsplash.com/photo-1604654894610-df63bc536371?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1607779097040-26e80aa78e66?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1632345031435-8727f6897d53?auto=format&fit=crop&w=800&q=80',
    ],
    'Mi/Mày': [
      'https://images.unsplash.com/photo-1512496015851-a90fb38ba796?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1583001931096-959e9a1a6223?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1616394584738-fc6e612e71b9?auto=format&fit=crop&w=800&q=80',
    ],
    'Da mặt': [
      'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1612817159949-195b6eb9e31a?auto=format&fit=crop&w=800&q=80',
    ],
    'Khác': [
      'https://images.unsplash.com/photo-1515377905703-c4788e51af15?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1519014816548-bf5fe059798b?auto=format&fit=crop&w=800&q=80',
    ]
  };

  let id = 1;
  const targetPerCategory = Math.ceil(500 / 6);
  const usedNames = new Set();

  for (const cat of Object.keys(serviceTemplates)) {
    const templates = serviceTemplates[cat];
    let count = 0;
    
    while (count < targetPerCategory && id <= 500) {
      const template = templates[count % templates.length];
      const descIdx = count % template.descriptions.length;
      // Thêm variation
      const variation = Math.floor(count / template.descriptions.length);
      let serviceName = `${template.prefix} ${template.descriptions[descIdx]}`;
      if (variation > 0) {
        const suffixes = ['cao cấp', 'VIP', 'premium', 'đặc biệt', 'chuyên sâu', 'nâng cao', 'exclusive', 'deluxe', 'signature', 'pro'];
        serviceName += ` ${suffixes[variation % suffixes.length]}`;
      }
      
      if (usedNames.has(serviceName)) {
        serviceName += ` v${id}`;
      }
      usedNames.add(serviceName);

      const price = Math.round(randomInt(template.priceRange[0], template.priceRange[1]) / 10000) * 10000;
      const duration = Math.round(randomInt(template.durationRange[0], template.durationRange[1]) / 5) * 5;
      const imageUrl = randomItem(images[cat]);

      services.push({
        id,
        name: serviceName,
        price,
        duration,
        description: `Dịch vụ ${serviceName.toLowerCase()} chuyên nghiệp tại BeautyBook Salon. Được thực hiện bởi đội ngũ chuyên gia giàu kinh nghiệm với sản phẩm cao cấp.`,
        category: cat,
        image_url: imageUrl,
        status: 'active'
      });
      id++;
      count++;
    }
  }

  // Fill remaining if needed
  while (services.length < 500) {
    const cat = randomItem(Object.keys(serviceTemplates));
    const template = randomItem(serviceTemplates[cat]);
    const desc = randomItem(template.descriptions);
    let serviceName = `${template.prefix} ${desc} phiên bản ${services.length + 1}`;
    const price = Math.round(randomInt(template.priceRange[0], template.priceRange[1]) / 10000) * 10000;
    const duration = Math.round(randomInt(template.durationRange[0], template.durationRange[1]) / 5) * 5;
    services.push({
      id: services.length + 1,
      name: serviceName,
      price,
      duration,
      description: `Dịch vụ ${serviceName.toLowerCase()} chuyên nghiệp tại BeautyBook Salon.`,
      category: cat,
      image_url: randomItem(images[cat]),
      status: 'active'
    });
  }

  return services;
}

// ===================== MAIN GENERATION =====================
console.log('🚀 Bắt đầu tạo dữ liệu seed...');

const output = [];
const BATCH_SIZE = 500; // Số row per INSERT

output.push('-- ====================================================================');
output.push('-- SEED DATA KHỔNG LỒ CHO BEAUTYBOOK');
output.push('-- 500 Dịch vụ | 5 Quản lý | 10 Thu ngân | 20 Nhân viên | 20,000 Khách');
output.push('-- Dữ liệu lịch hẹn từ 2024 đến nay');
output.push('-- Tạo tự động bởi generate_seed_data.js');
output.push(`-- Ngày tạo: ${new Date().toISOString()}`);
output.push('-- ====================================================================');
output.push('');
output.push('SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;');
output.push('SET FOREIGN_KEY_CHECKS = 0;');
output.push('SET UNIQUE_CHECKS = 0;');
output.push('SET AUTOCOMMIT = 0;');
output.push('');

// ========== TRUNCATE ==========
output.push('-- Xóa dữ liệu cũ');
output.push('TRUNCATE TABLE chat_messages;');
output.push('TRUNCATE TABLE chat_conversations;');
output.push('TRUNCATE TABLE voucher_assignments;');
output.push('TRUNCATE TABLE vouchers;');
output.push('TRUNCATE TABLE payments;');
output.push('TRUNCATE TABLE appointment_services;');
output.push('TRUNCATE TABLE appointments;');
output.push('TRUNCATE TABLE staff_weekly_availability;');
output.push('DELETE FROM users;');
output.push('DELETE FROM services;');
output.push('DELETE FROM service_category;');
output.push('DELETE FROM staff_role;');
output.push('ALTER TABLE users AUTO_INCREMENT = 1;');
output.push('ALTER TABLE services AUTO_INCREMENT = 1;');
output.push('ALTER TABLE appointments AUTO_INCREMENT = 1;');
output.push('ALTER TABLE appointment_services AUTO_INCREMENT = 1;');
output.push('ALTER TABLE payments AUTO_INCREMENT = 1;');
output.push('');

// ========== STAFF ROLES ==========
output.push('-- ========== STAFF ROLES ==========');
output.push(`INSERT INTO staff_role (id, role_name, description) VALUES`);
output.push(`  (1, 'Nhân viên', 'Nhân viên thực hiện dịch vụ cho khách hàng'),`);
output.push(`  (2, 'Thu ngân', 'Nhân viên xử lý thanh toán và hỗ trợ quầy'),`);
output.push(`  (3, 'Quản lý', 'Nhân viên quản lý vận hành salon');`);
output.push('');

// ========== SERVICE CATEGORIES ==========
output.push('-- ========== SERVICE CATEGORIES ==========');
output.push(`INSERT INTO service_category (id, category_name) VALUES`);
output.push(`  (1, 'Tóc'), (2, 'Gội/Massage'), (3, 'Nail/Móng'), (4, 'Mi/Mày'), (5, 'Da mặt'), (6, 'Khác');`);
output.push('');

// ========== SERVICES ==========
console.log('📦 Tạo 500 dịch vụ...');
const services = generateServices();

output.push('-- ========== 500 DỊCH VỤ ==========');
for (let i = 0; i < services.length; i += BATCH_SIZE) {
  const batch = services.slice(i, i + BATCH_SIZE);
  output.push(`INSERT INTO services (id, name, price, duration, description, category, image_url, status) VALUES`);
  const rows = batch.map(s => 
    `  (${s.id}, '${escapeSQL(s.name)}', ${s.price}, ${s.duration}, '${escapeSQL(s.description)}', '${escapeSQL(s.category)}', '${escapeSQL(s.image_url)}', '${s.status}')`
  );
  output.push(rows.join(',\n') + ';');
  output.push('');
}

// ========== USERS ==========
console.log('👥 Tạo 20,035 users (5 quản lý + 10 thu ngân + 20 nhân viên + 20,000 khách hàng)...');

// Quản lý (admin) - IDs 1-5
const managers = [];
const managerNames = [
  'Nguyễn Văn Minh', 'Trần Thị Hương', 'Lê Hoàng Dũng', 'Phạm Ngọc Lan', 'Hoàng Đức Thắng'
];
for (let i = 0; i < 5; i++) {
  managers.push({
    id: i + 1,
    name: managerNames[i],
    email: `quanly${i + 1}@beautybook.com`,
    phone: `090100000${i + 1}`,
    role: 'admin',
    staff_role_id: 3,
    date_of_birth: formatDate(randomDate(new Date(1975, 0, 1), new Date(1990, 11, 31)))
  });
}

// Thu ngân - IDs 6-15
const cashiers = [];
const cashierNames = [
  'Vũ Thị Tâm', 'Đặng Hồng Nhung', 'Bùi Thanh Hà', 'Đỗ Phương Mai', 'Ngô Thùy Linh',
  'Lý Kim Chi', 'Trịnh Ngọc Ánh', 'Cao Minh Thư', 'Tô Quỳnh Hoa', 'Đinh Bích Ngọc'
];
for (let i = 0; i < 10; i++) {
  cashiers.push({
    id: i + 6,
    name: cashierNames[i],
    email: `thungan${i + 1}@beautybook.com`,
    phone: `09012000${String(i + 1).padStart(2, '0')}`,
    role: 'staff',
    staff_role_id: 2,
    date_of_birth: formatDate(randomDate(new Date(1985, 0, 1), new Date(2000, 11, 31)))
  });
}

// Nhân viên dịch vụ - IDs 16-35
const staffMembers = [];
const staffNames = [
  'Nguyễn Ngọc Trinh', 'Trần Thùy Linh', 'Lê Bảo Ngọc', 'Phạm Phương Anh', 'Hoàng Khánh Vy',
  'Vũ Thanh Trúc', 'Đặng Mỹ Duyên', 'Bùi Hải Yến', 'Đỗ Thu Hằng', 'Ngô Diệu Linh',
  'Lý Hoàng Mai', 'Trịnh Bích Phượng', 'Cao Ánh Tuyết', 'Tô Minh Châu', 'Đinh Xuân Lan',
  'Mai Thanh Huyền', 'Dương Ngọc Hà', 'Phan Thị Trang', 'Hồ Quỳnh Như', 'Lương Thúy An'
];
for (let i = 0; i < 20; i++) {
  staffMembers.push({
    id: i + 16,
    name: staffNames[i],
    email: `nhanvien${i + 1}@beautybook.com`,
    phone: `09013000${String(i + 1).padStart(2, '0')}`,
    role: 'staff',
    staff_role_id: 1,
    date_of_birth: formatDate(randomDate(new Date(1990, 0, 1), new Date(2002, 11, 31)))
  });
}

// Khách hàng - IDs 36-20035
const CUSTOMER_START_ID = 36;
const NUM_CUSTOMERS = 20000;

// Tạo tất cả users INSERT
output.push('-- ========== QUẢN LÝ (5) ==========');
output.push(`INSERT INTO users (id, name, email, password, phone, role, staff_role_id, is_active, date_of_birth, created_at) VALUES`);
const managerRows = managers.map(m => 
  `  (${m.id}, '${escapeSQL(m.name)}', '${m.email}', '${BCRYPT_HASH}', '${m.phone}', '${m.role}', ${m.staff_role_id}, 1, '${m.date_of_birth}', '2024-01-01 08:00:00')`
);
output.push(managerRows.join(',\n') + ';');
output.push('');

output.push('-- ========== THU NGÂN (10) ==========');
output.push(`INSERT INTO users (id, name, email, password, phone, role, staff_role_id, is_active, date_of_birth, created_at) VALUES`);
const cashierRows = cashiers.map(c => 
  `  (${c.id}, '${escapeSQL(c.name)}', '${c.email}', '${BCRYPT_HASH}', '${c.phone}', '${c.role}', ${c.staff_role_id}, 1, '${c.date_of_birth}', '2024-01-01 08:00:00')`
);
output.push(cashierRows.join(',\n') + ';');
output.push('');

output.push('-- ========== NHÂN VIÊN DỊCH VỤ (20) ==========');
output.push(`INSERT INTO users (id, name, email, password, phone, role, staff_role_id, is_active, date_of_birth, created_at) VALUES`);
const staffRows = staffMembers.map(s => 
  `  (${s.id}, '${escapeSQL(s.name)}', '${s.email}', '${BCRYPT_HASH}', '${s.phone}', '${s.role}', ${s.staff_role_id}, 1, '${s.date_of_birth}', '2024-01-01 08:00:00')`
);
output.push(staffRows.join(',\n') + ';');
output.push('');

// Staff weekly availability cho 20 nhân viên
output.push('-- ========== LỊCH LÀM VIỆC NHÂN VIÊN ==========');
output.push(`INSERT INTO staff_weekly_availability (staff_id, day_of_week, start_time, end_time) VALUES`);
const availRows = [];
for (let i = 0; i < 20; i++) {
  const staffId = i + 16;
  const shift = i % 3; // 0=sáng, 1=chiều, 2=xoay
  for (let day = 0; day < 7; day++) {
    let start, end;
    if (shift === 0) {
      start = day < 5 ? '08:00:00' : '07:00:00';
      end = day < 5 ? '16:00:00' : '15:00:00';
    } else if (shift === 1) {
      start = day < 5 ? '12:00:00' : '09:00:00';
      end = day < 5 ? '21:00:00' : '17:00:00';
    } else {
      if (day % 2 === 0) {
        start = '08:00:00'; end = '16:00:00';
      } else {
        start = '12:00:00'; end = '20:00:00';
      }
    }
    availRows.push(`  (${staffId}, ${day}, '${start}', '${end}')`);
  }
}
output.push(availRows.join(',\n') + ';');
output.push('');

// ========== KHÁCH HÀNG 20,000 ==========
console.log('👤 Tạo 20,000 khách hàng...');
output.push('-- ========== KHÁCH HÀNG (20,000) ==========');

const customerEmails = new Set();
const CUSTOMER_BATCH = 1000;

for (let batch = 0; batch < NUM_CUSTOMERS; batch += CUSTOMER_BATCH) {
  const batchEnd = Math.min(batch + CUSTOMER_BATCH, NUM_CUSTOMERS);
  output.push(`INSERT INTO users (id, name, email, password, phone, role, staff_role_id, is_active, date_of_birth, customer_segment, created_at) VALUES`);
  
  const rows = [];
  for (let i = batch; i < batchEnd; i++) {
    const userId = CUSTOMER_START_ID + i;
    const name = generateName();
    let email = nameToEmail(name, userId);
    while (customerEmails.has(email)) {
      email = nameToEmail(name, userId + randomInt(100000, 999999));
    }
    customerEmails.add(email);
    
    const dob = formatDate(generateDOB());
    const phone = generatePhone(userId);
    
    // Ngày tạo tài khoản random từ 2024-01-01 đến nay
    const createdAt = formatDateTime(randomDate(new Date(2024, 0, 1), new Date(2026, 5, 12)));
    
    // Phân hạng RFM ngẫu nhiên
    const segments = ['New Customers', 'Champions', 'Loyal Customers', 'Potential Loyalists', 'Need Attention', 'At Risk', 'About to Sleep', 'Hibernating'];
    const segWeights = [40, 5, 10, 15, 10, 8, 7, 5]; // Phân phối thực tế
    let seg = 'New Customers';
    const r = Math.random() * 100;
    let cum = 0;
    for (let s = 0; s < segments.length; s++) {
      cum += segWeights[s];
      if (r < cum) { seg = segments[s]; break; }
    }
    
    rows.push(`  (${userId}, '${escapeSQL(name)}', '${escapeSQL(email)}', '${BCRYPT_HASH}', '${phone}', 'customer', NULL, 1, '${dob}', '${seg}', '${createdAt}')`);
  }
  output.push(rows.join(',\n') + ';');
  output.push('');
  
  if ((batch + CUSTOMER_BATCH) % 5000 === 0) {
    console.log(`  ✅ ${Math.min(batch + CUSTOMER_BATCH, NUM_CUSTOMERS)} / ${NUM_CUSTOMERS} khách hàng`);
  }
}

// ========== APPOINTMENTS ==========
console.log('📅 Tạo lịch hẹn cho tất cả khách hàng...');

// Mỗi khách đặt trung bình 2-5 lịch hẹn => ~40,000-100,000 appointments
// Giới hạn hợp lý: mỗi khách 2-4 lịch => ~40,000-80,000 appointments
const staffIds = staffMembers.map(s => s.id); // IDs 16-35
const serviceIds = services.map(s => s.id);   // IDs 1-500
const timeSlots = ['08:00:00', '08:30:00', '09:00:00', '09:30:00', '10:00:00', '10:30:00', '11:00:00', 
                   '13:00:00', '13:30:00', '14:00:00', '14:30:00', '15:00:00', '15:30:00', '16:00:00',
                   '16:30:00', '17:00:00', '17:30:00', '18:00:00', '18:30:00', '19:00:00', '19:30:00', '20:00:00'];
const statuses = ['completed', 'completed', 'completed', 'completed', 'completed', 'completed', 'completed', 
                  'confirmed', 'pending', 'cancelled']; // 70% completed, 10% confirmed, 10% pending, 10% cancelled

output.push('-- ========== LỊCH HẸN (appointments) ==========');

let appointmentId = 1;
const appointmentBatchRows = [];
const appointmentServiceRows = [];
const paymentRows = [];

const START_DATE = new Date(2024, 0, 1);
const END_DATE = new Date(2026, 5, 12);

console.log('  Tạo appointments...');

for (let i = 0; i < NUM_CUSTOMERS; i++) {
  const userId = CUSTOMER_START_ID + i;
  
  // Số lịch hẹn mỗi khách: 2-5 (phân phối: phần lớn 2-3)
  const numAppointments = randomInt(2, 5);
  
  for (let j = 0; j < numAppointments; j++) {
    const serviceId = randomItem(serviceIds);
    const service = services[serviceId - 1];
    const staffId = randomItem(staffIds);
    const appointmentDate = randomDate(START_DATE, END_DATE);
    const timeSlot = randomItem(timeSlots);
    const status = randomItem(statuses);
    
    // Tính end_time
    const [hh, mm] = timeSlot.split(':').map(Number);
    const endMinutes = hh * 60 + mm + service.duration;
    const endH = Math.floor(endMinutes / 60);
    const endM = endMinutes % 60;
    const endTime = `${String(Math.min(endH, 23)).padStart(2, '0')}:${String(endM).padStart(2, '0')}:00`;
    
    const totalAmount = service.price;
    const rating = status === 'completed' ? randomInt(3, 5) : null;
    const ratingStr = rating !== null ? String(rating) : 'NULL';
    
    const createdAt = formatDateTime(new Date(appointmentDate.getTime() - randomInt(0, 7) * 86400000));
    
    appointmentBatchRows.push(
      `(${appointmentId}, ${userId}, ${serviceId}, ${staffId}, '${formatDate(appointmentDate)}', '${timeSlot}', '${endTime}', '${status}', ${totalAmount}, ${totalAmount}, ${ratingStr}, '${createdAt}')`
    );
    
    // appointment_services
    appointmentServiceRows.push(
      `(${appointmentId}, ${serviceId}, 0, ${service.price}, ${service.duration}, '${escapeSQL(service.name)}')`
    );
    
    // payments cho completed và confirmed
    if (status === 'completed' || status === 'confirmed') {
      const paymentMethods = ['cash', 'banking', 'momo', 'vnpay', 'vietqr'];
      const method = randomItem(paymentMethods);
      const paymentStatus = status === 'completed' ? 'paid' : 'pending';
      paymentRows.push(
        `(${appointmentId}, ${totalAmount}, '${method}', '${paymentStatus}', '${createdAt}')`
      );
    }
    
    appointmentId++;
  }
  
  if ((i + 1) % 5000 === 0) {
    console.log(`  ✅ ${i + 1} / ${NUM_CUSTOMERS} khách hàng đã tạo lịch hẹn`);
  }
}

console.log(`  📊 Tổng số lịch hẹn: ${appointmentId - 1}`);

// Write appointments in batches
const APPT_BATCH = 2000;
for (let i = 0; i < appointmentBatchRows.length; i += APPT_BATCH) {
  const batch = appointmentBatchRows.slice(i, i + APPT_BATCH);
  output.push(`INSERT INTO appointments (id, user_id, service_id, staff_id, appointment_date, appointment_time, end_time, status, total_amount, original_amount, staff_rating, created_at) VALUES`);
  output.push('  ' + batch.join(',\n  ') + ';');
  output.push('');
}

// Write appointment_services in batches
output.push('-- ========== CHI TIẾT DỊCH VỤ (appointment_services) ==========');
for (let i = 0; i < appointmentServiceRows.length; i += APPT_BATCH) {
  const batch = appointmentServiceRows.slice(i, i + APPT_BATCH);
  output.push(`INSERT INTO appointment_services (appointment_id, service_id, sort_order, price_snapshot, duration_snapshot, service_name_snapshot) VALUES`);
  output.push('  ' + batch.join(',\n  ') + ';');
  output.push('');
}

// Write payments in batches
output.push('-- ========== THANH TOÁN (payments) ==========');
for (let i = 0; i < paymentRows.length; i += APPT_BATCH) {
  const batch = paymentRows.slice(i, i + APPT_BATCH);
  output.push(`INSERT INTO payments (appointment_id, amount, payment_method, payment_status, created_at) VALUES`);
  output.push('  ' + batch.join(',\n  ') + ';');
  output.push('');
}

// ========== COMMIT ==========
output.push('COMMIT;');
output.push('SET FOREIGN_KEY_CHECKS = 1;');
output.push('SET UNIQUE_CHECKS = 1;');
output.push('SET AUTOCOMMIT = 1;');
output.push('');
output.push('-- Cập nhật AUTO_INCREMENT');
output.push(`ALTER TABLE users AUTO_INCREMENT = ${CUSTOMER_START_ID + NUM_CUSTOMERS + 1};`);
output.push(`ALTER TABLE services AUTO_INCREMENT = 501;`);
output.push(`ALTER TABLE appointments AUTO_INCREMENT = ${appointmentId};`);
output.push('');
output.push('-- ====================================================================');
output.push('-- HOÀN TẤT! Đã tạo:');
output.push(`--   ✅ 500 dịch vụ`);
output.push(`--   ✅ 5 quản lý`);
output.push(`--   ✅ 10 thu ngân`);
output.push(`--   ✅ 20 nhân viên dịch vụ`);
output.push(`--   ✅ 20,000 khách hàng`);
output.push(`--   ✅ ${appointmentId - 1} lịch hẹn`);
output.push(`--   ✅ ${appointmentServiceRows.length} chi tiết dịch vụ`);
output.push(`--   ✅ ${paymentRows.length} thanh toán`);
output.push('-- ====================================================================');

// Write to file
const outputPath = path.join(__dirname, 'seed_massive.sql');
console.log(`\n📝 Đang ghi file ${outputPath}...`);
fs.writeFileSync(outputPath, output.join('\n'), 'utf8');

const fileSizeMB = (fs.statSync(outputPath).size / (1024 * 1024)).toFixed(2);
console.log(`\n✅ HOÀN TẤT!`);
console.log(`📁 File: ${outputPath}`);
console.log(`📏 Kích thước: ${fileSizeMB} MB`);
console.log(`\n📊 Thống kê:`);
console.log(`  - 500 dịch vụ`);
console.log(`  - 5 quản lý (admin)`);
console.log(`  - 10 thu ngân (staff/cashier)`);
console.log(`  - 20 nhân viên dịch vụ (staff/service)`);
console.log(`  - 20,000 khách hàng`);
console.log(`  - ${appointmentId - 1} lịch hẹn`);
console.log(`  - ${paymentRows.length} thanh toán`);
console.log(`\n💡 Cách sử dụng:`);
console.log(`  1. Mở phpMyAdmin hoặc MySQL CLI`);
console.log(`  2. Chọn database booking_system`);
console.log(`  3. Import file seed_massive.sql`);
console.log(`  4. Hoặc chạy: mysql -u root booking_system < seed_massive.sql`);
