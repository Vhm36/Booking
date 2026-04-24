const db = require('../../config/db');

const REQUIRED_GATEWAY_COLUMNS = [
  'payment_reference',
  'bank_code',
  'bank_transaction_no',
  'gateway_response_code',
  'gateway_transaction_status',
  'payment_url_expires_at',
  'gateway_payload'
];

let cachedSchemaInfo = null;
let pendingCallbacks = null;

const buildSchemaInfo = (rows) => {
  const columns = new Set((rows || []).map((row) => row.Field));
  return {
    columns,
    hasGatewayColumns: REQUIRED_GATEWAY_COLUMNS.every((column) => columns.has(column))
  };
};

const flushCallbacks = (err, schemaInfo) => {
  const callbacks = pendingCallbacks || [];
  pendingCallbacks = null;
  callbacks.forEach((callback) => callback(err, schemaInfo));
};

const getPaymentSchemaInfo = (callback) => {
  if (cachedSchemaInfo) {
    return process.nextTick(() => callback(null, cachedSchemaInfo));
  }

  if (pendingCallbacks) {
    pendingCallbacks.push(callback);
    return;
  }

  pendingCallbacks = [callback];

  db.query('SHOW COLUMNS FROM payments', (err, rows) => {
    if (err) {
      return flushCallbacks(err);
    }

    cachedSchemaInfo = buildSchemaInfo(rows);
    return flushCallbacks(null, cachedSchemaInfo);
  });
};

module.exports = {
  getPaymentSchemaInfo,
  REQUIRED_GATEWAY_COLUMNS
};
