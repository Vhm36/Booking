/**
 * Socket Event Emitter — Utility to emit real-time events from controllers
 *
 * Usage in controllers:
 *   const { emitNewBooking, emitPaymentSuccess } = require('../../utils/socketEvents');
 *   emitNewBooking(req.app, bookingData);
 */

/**
 * Emit to admin room when new booking is created
 */
const emitNewBooking = (app, data) => {
  const io = app.get('io');
  if (!io) return;

  io.to('admin-room').emit('new-booking', {
    type: 'new-booking',
    timestamp: new Date().toISOString(),
    data: {
      id: data.id,
      customerName: data.customerName,
      serviceName: data.serviceName,
      date: data.date,
      time: data.time,
      amount: data.amount
    }
  });
};

/**
 * Emit when payment is successful
 */
const emitPaymentSuccess = (app, data) => {
  const io = app.get('io');
  if (!io) return;

  io.to('admin-room').emit('payment-success', {
    type: 'payment-success',
    timestamp: new Date().toISOString(),
    data: {
      paymentId: data.paymentId,
      appointmentId: data.appointmentId,
      amount: data.amount,
      method: data.method
    }
  });
};

/**
 * Emit when booking is cancelled
 */
const emitBookingCancelled = (app, data) => {
  const io = app.get('io');
  if (!io) return;

  io.to('admin-room').emit('booking-cancelled', {
    type: 'booking-cancelled',
    timestamp: new Date().toISOString(),
    data: {
      id: data.id,
      customerName: data.customerName,
      serviceName: data.serviceName
    }
  });
};

/**
 * Emit booking status update
 */
const emitBookingStatusUpdate = (app, data) => {
  const io = app.get('io');
  if (!io) return;

  io.to('admin-room').emit('booking-status-update', {
    type: 'booking-status-update',
    timestamp: new Date().toISOString(),
    data
  });

  // Also notify the specific staff
  if (data.staffId) {
    io.to(`staff-${data.staffId}`).emit('booking-status-update', {
      type: 'booking-status-update',
      timestamp: new Date().toISOString(),
      data
    });
  }
};

/**
 * Emit dashboard refresh signal
 */
const emitDashboardRefresh = (app) => {
  const io = app.get('io');
  if (!io) return;

  io.to('admin-room').emit('dashboard-refresh', {
    type: 'dashboard-refresh',
    timestamp: new Date().toISOString()
  });
};

module.exports = {
  emitNewBooking,
  emitPaymentSuccess,
  emitBookingCancelled,
  emitBookingStatusUpdate,
  emitDashboardRefresh
};
