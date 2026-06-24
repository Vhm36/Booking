// Mock database query calls BEFORE requiring any modules
jest.mock('../src/config/db', () => {
  const mockDb = {
    query: jest.fn(),
    promise: jest.fn(),
    ready: Promise.resolve()
  };
  mockDb.promise.mockReturnValue(mockDb);
  return mockDb;
});

const db = require('../src/config/db');
const voucherService = require('../src/services/voucherService');

describe('Voucher Service - Mã Giảm Giá', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Tính toán số tiền giảm (calculateDiscount)', () => {
    test('Voucher giảm tiền cố định (fixed) chiết khấu đúng số tiền', () => {
      const voucher = { voucher_type: 'fixed', discount_amount: 50000 };
      const subtotal = 150000;
      const discount = voucherService.calculateDiscount(voucher, subtotal);
      expect(discount).toBe(50000);
    });

    test('Voucher giảm tiền cố định không vượt quá tổng tiền đơn hàng', () => {
      const voucher = { voucher_type: 'fixed', discount_amount: 100000 };
      const subtotal = 70000;
      const discount = voucherService.calculateDiscount(voucher, subtotal);
      expect(discount).toBe(70000);
    });

    test('Voucher giảm theo phần trăm (%) chiết khấu đúng tỉ lệ', () => {
      const voucher = { voucher_type: 'percentage', discount_percent: 15 };
      const subtotal = 200000;
      const discount = voucherService.calculateDiscount(voucher, subtotal);
      expect(discount).toBe(30000);
    });

    test('Voucher giảm theo phần trăm (%) bị giới hạn bởi mức giảm tối đa (max_discount_amount)', () => {
      const voucher = { voucher_type: 'percentage', discount_percent: 20, max_discount_amount: 25000 };
      const subtotal = 200000; // 20% của 200k là 40k, nhưng giới hạn max là 25k
      const discount = voucherService.calculateDiscount(voucher, subtotal);
      expect(discount).toBe(25000);
    });
  });

  describe('Xác thực Voucher cho Khách hàng (validateVoucherForCustomer)', () => {
    test('Báo lỗi nếu tổng tiền đơn hàng nhỏ hơn min_order_value', async () => {
      const mockVoucherRow = {
        id: 1,
        code: 'SALE50',
        voucher_type: 'fixed',
        discount_amount: 50000,
        min_order_value: 200000, // Đơn tối thiểu 200k
        customer_type: 'both',
        effective_status: 'active',
        assignment_status: 'active',
        usage_count: 0,
        max_usage_customer: 1
      };

      // Giả lập truy vấn SQL trả về voucher
      db.query
        .mockResolvedValueOnce([{}])
        .mockResolvedValueOnce([[mockVoucherRow]]);
      
      // Mock getCustomerSegment
      jest.spyOn(voucherService, 'getCustomerSegment').mockResolvedValue('regular');

      await expect(
        voucherService.validateVoucherForCustomer({
          customerId: 1,
          code: 'SALE50',
          subtotal: 150000 // Chỉ mua 150k
        })
      ).rejects.toThrow('Voucher cần đơn tối thiểu 200.000 VND');
    });

    test('Áp dụng thành công nếu mọi điều kiện hợp lệ', async () => {
      const mockVoucherRow = {
        id: 1,
        code: 'WELCOME',
        voucher_type: 'percentage',
        discount_percent: 10,
        min_order_value: 100000,
        max_discount_amount: 50000,
        customer_type: 'both',
        effective_status: 'active',
        assignment_status: 'active',
        usage_count: 0,
        max_usage_customer: 1
      };

      db.query
        .mockResolvedValueOnce([{}])
        .mockResolvedValueOnce([[mockVoucherRow]]);
      jest.spyOn(voucherService, 'getCustomerSegment').mockResolvedValue('regular');

      const result = await voucherService.validateVoucherForCustomer({
        customerId: 1,
        code: 'WELCOME',
        subtotal: 120000
      });

      expect(result.discountAmount).toBe(12000); // 10% của 120k
      expect(result.finalAmount).toBe(108000);
    });
  });
});
