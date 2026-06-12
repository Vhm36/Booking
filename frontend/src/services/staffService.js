import api from './api';

const staffService = {
  getAllStaff: () => {
    return api.get('/staff');
  },

  getBookableStaff: () => {
    return api.get('/staff/bookable');
  },

  getAvailableStaff: (date, time, serviceIds = []) => {
    const params = new URLSearchParams();
    params.set('date', date);
    params.set('time', time);
    const normalizedServiceIds = Array.isArray(serviceIds)
      ? serviceIds.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0)
      : [];

    if (normalizedServiceIds.length > 0) {
      params.set('serviceId', String(normalizedServiceIds[0]));
      params.set('serviceIds', normalizedServiceIds.join(','));
    }

    return api.get(`/staff/available?${params.toString()}`);
  },

  getBusyTimeSlots: (staffId, date) => {
    const params = new URLSearchParams();
    params.set('date', date);
    return api.get(`/staff/${staffId}/busy-slots?${params.toString()}`);
  },

  createStaff: (name, email, password, phone, staff_role_id, is_active = true) => {
    return api.post('/staff', {
      name,
      email,
      password,
      phone,
      staff_role_id,
      is_active
    });
  },

  getAllStaffRoles: () => {
    return api.get('/staff/roles');
  },

  createStaffRole: (role_name) => {
    return api.post('/staff/roles', { role_name });
  },

  updateStaff: (id, payload) => {
    return api.put(`/staff/${id}`, payload);
  },

  getStaffWeeklyAvailability: (id) => {
    return api.get(`/staff/${id}/weekly-availability`);
  },

  replaceStaffWeeklyAvailability: (id, slots) => {
    return api.put(`/staff/${id}/weekly-availability`, { slots });
  },

  getMyWeeklyAvailability: () => {
    return api.get('/staff/me/weekly-availability');
  },

  replaceMyWeeklyAvailability: (slots) => {
    return api.put('/staff/me/weekly-availability', { slots });
  },

  startWork: () => {
    return api.post('/staff/me/start-work');
  },

  requestLeave: (leaveData) => {
    return api.post('/staff/leave-request', leaveData);
  },

  getMyLeaveRequests: () => {
    return api.get('/staff/my-leave-requests');
  },

  getAllLeaveRequests: () => {
    return api.get('/staff/leave-requests');
  },

  updateLeaveRequestStatus: (id, status) => {
    return api.put(`/staff/leave-requests/${id}/status`, { status });
  }
};

export default staffService;
