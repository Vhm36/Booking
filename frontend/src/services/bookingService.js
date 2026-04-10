import api from './api';

const bookingService = {
  createBooking: (service_id, staff_id, appointment_date, appointment_time, notes) => {
    return api.post('/bookings', {
      service_id,
      staff_id,
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

  reviewBooking: (id, rating, review) =>
    api.put(`/bookings/${id}/review`, {
      rating,
      review
    })
};

export default bookingService;