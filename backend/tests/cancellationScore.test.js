// Mock database query calls BEFORE requiring any modules
jest.mock('../src/config/db', () => ({
  query: jest.fn(),
  ready: Promise.resolve()
}));

const db = require('../src/config/db');
const cancellationScoreService = require('../src/services/cancellationScoreService');

describe('Cancellation Score Service - Chống "Boom" lịch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('Người dùng mới (không có lịch hẹn cũ) sẽ có mức rủi ro Thấp', async () => {
    db.query.mockImplementation((sql, params, callback) => {
      if (sql.includes('FROM users')) {
        callback(null, [{ cancellation_count: 0, cancellation_rate: 0, noshow_count: 0, customer_segment: 'New', rfm_score: '111' }]);
      } else if (sql.includes('FROM appointments')) {
        callback(null, [{ total_bookings: 0, cancelled_count: 0, completed_count: 0 }]);
      }
    });

    const appointmentDate = '2026-06-01'; // Hẹn xa trong tương lai
    const appointmentTime = '10:00:00';
    const result = await cancellationScoreService.calculateScore(1, appointmentDate, appointmentTime);

    expect(result.score).toBeLessThan(70);
    expect(result.requireDeposit).toBe(true);
    expect(result.depositPercent).toBe(20);
    expect(result.history.total_bookings).toBe(0);
    expect(result.history.segment).toBe('New');
  });

  test('Người dùng có tỷ lệ hủy cao (cancellation rate = 100%) và đặt cận giờ sẽ có rủi ro cao và yêu cầu đặt cọc', async () => {
    db.query.mockImplementation((sql, params, callback) => {
      if (sql.includes('FROM users')) {
        callback(null, [{ cancellation_count: 5, cancellation_rate: 100, noshow_count: 0, customer_segment: 'Lost Customers', rfm_score: '111' }]);
      } else if (sql.includes('FROM appointments')) {
        callback(null, [{ total_bookings: 5, cancelled_count: 5, completed_count: 0 }]);
      }
    });

    // Cài đặt đặt lịch cách thời gian hiện tại 1 giờ (Lead time < 2 hours) ở cùng múi giờ địa phương
    const futureDate = new Date(Date.now() + 1 * 60 * 60 * 1000);
    const year = futureDate.getFullYear();
    const month = String(futureDate.getMonth() + 1).padStart(2, '0');
    const date = String(futureDate.getDate()).padStart(2, '0');
    
    const appointmentDate = `${year}-${month}-${date}`;
    const appointmentTime = futureDate.toTimeString().split(' ')[0]; // HH:MM:SS

    const result = await cancellationScoreService.calculateScore(1, appointmentDate, appointmentTime);

    // Điểm rủi ro cao sẽ kích hoạt đặt cọc (Score >= 70)
    expect(result.score).toBeGreaterThanOrEqual(70);
    expect(result.requireDeposit).toBe(true);
  });

  test('Khách hàng no-show nhiều lần (>= 3 lần) bị chấm điểm phạt nặng', async () => {
    db.query.mockImplementation((sql, params, callback) => {
      if (sql.includes('FROM users')) {
        callback(null, [{ cancellation_count: 0, cancellation_rate: 0, noshow_count: 3, customer_segment: 'At Risk', rfm_score: '111' }]);
      } else if (sql.includes('FROM appointments')) {
        callback(null, [{ total_bookings: 10, cancelled_count: 0, completed_count: 10 }]);
      }
    });

    const appointmentDate = '2026-06-01';
    const appointmentTime = '10:00:00';

    const result = await cancellationScoreService.calculateScore(1, appointmentDate, appointmentTime);
    expect(result.breakdown.noshow).toBe(90); // no-show score phạt 90 điểm
  });

  test('Sử dụng cancellation_rate đã lưu trên users theo phần trăm 0-100 thay vì tự xem cancellation_count là từng đơn hủy', async () => {
    db.query.mockImplementation((sql, params, callback) => {
      if (sql.includes('FROM users')) {
        callback(null, [{ cancellation_count: 99, cancellation_rate: 25, noshow_count: 0, customer_segment: 'New', rfm_score: '111' }]);
      } else if (sql.includes('FROM appointments')) {
        callback(null, [{ total_bookings: 4, cancelled_count: 4, completed_count: 0 }]);
      }
    });

    const result = await cancellationScoreService.calculateScore(1, '2026-06-01', '10:00:00');

    expect(result.breakdown.cancellation_rate).toBe(25);
    expect(result.history.cancellation_rate).toBe(25);
    expect(result.history.cancellation_count).toBe(99);
  });
});
