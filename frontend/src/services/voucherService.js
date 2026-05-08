import api from './api';

const voucherService = {
  getAllVouchers: () => api.get('/vouchers'),

  getAnalytics: () => api.get('/vouchers/analytics'),

  createVoucher: (payload) => api.post('/vouchers', payload),

  updateVoucher: (id, payload) => api.put(`/vouchers/${id}`, payload),

  deleteVoucher: (id) => api.delete(`/vouchers/${id}`),

  assignVoucher: (id, payload) => api.post(`/vouchers/${id}/assign`, payload),

  getMyVouchers: () => api.get('/vouchers/my-vouchers'),

  validateVoucher: (code, subtotal) =>
    api.post('/vouchers/validate', {
      code,
      subtotal
    })
};

export default voucherService;
