import api from './api';

const serviceService = {
  getAllServices: () => api.get('/services'),

  getTrendingServices: () => api.get('/services/trending'),

  getAdminServices: () => api.get('/services/admin/all'),

  getServiceById: (id) => api.get(`/services/${id}`),

  getRecommendations: (params) => api.get('/services/recommendations', { params }),

  createService: (data) => api.post('/services', data),

  updateService: (id, data) => api.put(`/services/${id}`, data),

  updateServicePrice: (id, price) => api.put(`/services/${id}/price`, { price }),

  deleteService: (id) => api.delete(`/services/${id}`),

  createCategory: (data) => api.post('/services/categories', data),

  getAllCategories: () => api.get('/services/categories')
};

export default serviceService;
