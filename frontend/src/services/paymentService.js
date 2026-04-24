import api from './api';

const paymentService = {
  getPaymentOptions: () => api.get('/payments/options'),

  createPayment: (appointmentId, paymentMethod = 'vietqr') =>
    api.post('/payments/create-payment', {
      appointment_id: appointmentId,
      payment_method: paymentMethod
    }),

  confirmTransferPayment: (paymentId) => api.put(`/payments/${paymentId}/confirm-transfer`),

  getPayment: (paymentId) => api.get(`/payments/${paymentId}`)
};

export default paymentService;
