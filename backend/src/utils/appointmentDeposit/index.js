const MIN_DEPOSIT_PERCENT = 20;
const MAX_DEPOSIT_PERCENT = 50;

const normalizeDepositPercent = (value, fallback = MIN_DEPOSIT_PERCENT) => {
  const parsed = Number(value);
  const base = Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  return Math.min(MAX_DEPOSIT_PERCENT, Math.max(MIN_DEPOSIT_PERCENT, Math.round(base)));
};

const calculateDepositAmount = (amount, percent = MIN_DEPOSIT_PERCENT) => {
  const total = Number(amount || 0);
  if (!Number.isFinite(total) || total <= 0) {
    return 0;
  }

  const safePercent = normalizeDepositPercent(percent);
  return Math.min(total, Math.round((total * safePercent) / 100));
};

const buildPaidDepositExistsCondition = (appointmentAlias = 'a') => {
  const paymentAlias = `paid_payment_${String(appointmentAlias).replace(/[^a-zA-Z0-9_]/g, '_')}`;

  return `
    EXISTS (
      SELECT 1
      FROM payments ${paymentAlias}
      WHERE ${paymentAlias}.appointment_id = ${appointmentAlias}.id
        AND ${paymentAlias}.payment_status = 'paid'
        AND COALESCE(${paymentAlias}.amount, 0) >= COALESCE(${appointmentAlias}.deposit_amount, 0)
      LIMIT 1
    )
  `;
};

const buildAppointmentLocksTimeCondition = (appointmentAlias = 'a') => `
  (
    COALESCE(${appointmentAlias}.deposit_required, 0) = 0
    OR COALESCE(${appointmentAlias}.deposit_amount, 0) <= 0
    OR ${buildPaidDepositExistsCondition(appointmentAlias)}
  )
`;

const buildAwaitingDepositCondition = (appointmentAlias = 'a') => `
  (
    COALESCE(${appointmentAlias}.deposit_required, 0) = 1
    AND COALESCE(${appointmentAlias}.deposit_amount, 0) > 0
    AND NOT ${buildPaidDepositExistsCondition(appointmentAlias)}
  )
`;

module.exports = {
  MIN_DEPOSIT_PERCENT,
  MAX_DEPOSIT_PERCENT,
  normalizeDepositPercent,
  calculateDepositAmount,
  buildAppointmentLocksTimeCondition,
  buildAwaitingDepositCondition,
  buildPaidDepositExistsCondition
};
