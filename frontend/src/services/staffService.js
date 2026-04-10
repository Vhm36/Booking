import api from './api';

const staffService = {
  getAllStaff: () => {
    return api.get('/staff');
  },

  getBookableStaff: () => {
    return api.get('/staff/bookable');
  },

  getAvailableStaff: (date, time, serviceId) => {
    const params = new URLSearchParams();
    params.set('date', date);
    params.set('time', time);
    if (serviceId) {
      params.set('serviceId', serviceId);
    }

    return api.get(`/staff/available?${params.toString()}`);
  },

  createStaff: (name, email, password, phone, is_active = true) => {
    return api.post('/staff', {
      name,
      email,
      password,
      phone,
      is_active
    });
  },

  updateStaff: (id, payload) => {
    return api.put(`/staff/${id}`, payload);
  }
};

export default staffService;
