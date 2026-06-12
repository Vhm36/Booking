import api from './api';

const dashboardService = {
  getOverview: (params = {}) => {
    return api.get('/admin/dashboard/overview', { params });
  },

  // Lấy tóm tắt dashboard
  getSummary: () => {
    return api.get('/admin/dashboard/summary');
  },

  // Lấy booking theo tháng
  getBookingsByMonth: () => {
    return api.get('/admin/dashboard/bookings-by-month');
  },

  // Lấy dịch vụ phổ biến
  getTopServices: () => {
    return api.get('/admin/dashboard/top-services');
  },

  // Lấy tần suất khách hàng
  getCustomerFrequency: () => {
    return api.get('/admin/dashboard/customer-frequency');
  },

  // Lấy trạng thái appointment
  getAppointmentStatus: () => {
    return api.get('/admin/dashboard/appointment-status');
  },

  // Lấy doanh thu theo tháng
  getRevenueByMonth: () => {
    return api.get('/admin/dashboard/revenue-by-month');
  },

  // Lấy tỷ lệ hủy lịch
  getCancellationRate: () => {
    return api.get('/admin/dashboard/cancellation-rate');
  },

  getCustomerBehaviorBot: () => {
    return api.get('/admin/dashboard/customer-behavior-bot');
  },

  getDecClustering: (params = {}) => {
    return api.get('/admin/dashboard/dec-clustering', { params });
  },

  getStaffCommissionByMonth: (month, year) => {
    const params = new URLSearchParams();
    if (month) params.set('month', String(month));
    if (year) params.set('year', String(year));
    const query = params.toString();
    return api.get(`/admin/dashboard/staff-commission-by-month${query ? `?${query}` : ''}`);
  }
};

export default dashboardService;
