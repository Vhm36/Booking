const emitDashboardUpdateFromApp = (app, type, payload = {}) => {
  try {
    const io = app?.get?.('io');
    if (!io) {
      return;
    }

    const eventPayload = {
      type,
      payload,
      emitted_at: new Date().toISOString()
    };

    io.to('admin-room').emit('dashboard:update', eventPayload);

    // Also notify specific staff if applicable
    if (payload.staffId) {
      io.to(`staff-${payload.staffId}`).emit('dashboard:update', eventPayload);
    }

    if (payload.userId) {
      io.to(`user-${payload.userId}`).emit('dashboard:update', eventPayload);
    }
  } catch (err) {
    console.error('[REALTIME_EMIT_ERROR]', err.message);
  }
};

const emitDashboardUpdate = (req, type, payload = {}) => {
  emitDashboardUpdateFromApp(req?.app, type, payload);
};

module.exports = { emitDashboardUpdate, emitDashboardUpdateFromApp };
