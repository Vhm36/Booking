import api from './api';

const serviceService = {
  getAllServices: () => api.get('/services'),

  getAdminServices: () => api.get('/services/admin/all'),

  getServiceById: (id) => api.get(`/services/${id}`),

  createService: (payload) => api.post('/services', payload),

  updateService: (id, payload) => api.put(`/services/${id}`, payload),

  updateServicePrice: (id, price) => api.put(`/services/${id}/price`, { price }),

  deleteService: (id) => api.delete(`/services/${id}`)
};

export default serviceService;
