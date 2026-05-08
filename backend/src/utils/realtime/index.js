const emitDashboardUpdate = (req, type, payload = {}) => {
  try {
    const io = req?.app?.get?.('io');
    if (!io) {
      return;
    }

    io.to('admin-room').emit('dashboard:update', {
      type,
      payload,
      emitted_at: new Date().toISOString()
    });

    // Also notify specific staff if applicable
    if (payload.staffId) {
      io.to(`staff-${payload.staffId}`).emit('dashboard:update', {
        type,
        payload,
        emitted_at: new Date().toISOString()
      });
    }
  } catch (err) {
    console.error('[REALTIME_EMIT_ERROR]', err.message);
  }
};

module.exports = { emitDashboardUpdate };

