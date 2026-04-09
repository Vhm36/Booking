import api from './api';

const customerService = {
  getAllCustomers: () => api.get('/customers'),

  createCustomer: (payload) => api.post('/customers', payload),

  updateCustomer: (id, payload) => api.put(`/customers/${id}`, payload),

  deleteCustomer: (id) => api.delete(`/customers/${id}`)
};

export default customerService;