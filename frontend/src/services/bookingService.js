import api from './api';

const bookingService = {
  createBooking: (selectedServiceIds, staff_id, appointment_date, appointment_time, notes) => {
    const normalizedServiceIds = Array.isArray(selectedServiceIds)
      ? selectedServiceIds.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0)
      : [];

    return api.post('/bookings', {
      service_id: normalizedServiceIds[0],
      selected_service_ids: normalizedServiceIds,
      staff_id: staff_id || undefined,
      appointment_date,
      appointment_time,
      notes
    });
  },

  getMyBookings: () => api.get('/bookings/my-bookings'),

  getAllBookings: () => api.get('/bookings'),

  getBookingById: (id) => api.get(`/bookings/${id}`),

  updateBookingStatus: (id, status) =>
    api.put(`/bookings/${id}/status`, {
      status
    }),

  cancelBooking: (id) => api.put(`/bookings/${id}/cancel`),

  confirmCancelBooking: (id) => api.put(`/bookings/${id}/confirm-cancel`),

  rejectCancelBooking: (id) => api.put(`/bookings/${id}/reject-cancel`),

  requestCancelBooking: (id) => api.put(`/bookings/${id}/request-cancel`),

  reviewBooking: (id, rating, review) =>
    api.put(`/bookings/${id}/review`, {
      rating,
      review
    })
};

export default bookingService;
