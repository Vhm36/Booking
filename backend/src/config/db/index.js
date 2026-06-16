const mysql = require("mysql2/promise");
const mysqlCore = require("mysql2");
require("../loadEnv");

const DEFAULT_LOCAL_DATABASE = "booking_system";

const parseDatabaseUrl = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return {};

  try {
    const url = new URL(raw);
    const database = decodeURIComponent((url.pathname || "").replace(/^\/+/, ""));

    return {
      host: url.hostname || undefined,
      port: url.port || undefined,
      user: url.username ? decodeURIComponent(url.username) : undefined,
      password: url.password ? decodeURIComponent(url.password) : undefined,
      database: database || undefined,
      ssl: url.searchParams.get("ssl") || url.searchParams.get("sslmode") || undefined
    };
  } catch (err) {
    console.error("Invalid database URL format:", err.message);
    return {};
  }
};

const parsePositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const isLocalHost = (value) => {
  const host = String(value || "").trim().toLowerCase();
  return ["localhost", "127.0.0.1", "::1"].includes(host);
};

const databaseUrl =
  process.env.DATABASE_URL ||
  process.env.MYSQL_URL ||
  process.env.MYSQL_PRIVATE_URL ||
  process.env.MYSQL_PUBLIC_URL ||
  process.env.DATABASE_PRIVATE_URL ||
  process.env.DATABASE_PUBLIC_URL ||
  process.env.RAILWAY_DATABASE_URL;

const urlConfig = parseDatabaseUrl(databaseUrl);
const railwayHost = process.env.MYSQLHOST || process.env.MYSQL_HOST;
const shouldPreferRailwayVars = railwayHost && (!process.env.DB_HOST || isLocalHost(process.env.DB_HOST));

const configuredDbName =
  urlConfig.database ||
  process.env.MYSQLDATABASE ||
  process.env.MYSQL_DATABASE ||
  process.env.DB_NAME;
const dbName = configuredDbName || DEFAULT_LOCAL_DATABASE;
const dbHost =
  urlConfig.host ||
  railwayHost ||
  (process.env.DB_HOST && !isLocalHost(process.env.DB_HOST) ? process.env.DB_HOST : undefined) ||
  "127.0.0.1";
const dbPort = parsePositiveInt(
  urlConfig.port ||
    (shouldPreferRailwayVars ? process.env.MYSQLPORT || process.env.MYSQL_PORT : process.env.DB_PORT) ||
    process.env.DB_PORT ||
    process.env.MYSQLPORT ||
    process.env.MYSQL_PORT,
  3306
);
const dbUser =
  urlConfig.user ||
  (shouldPreferRailwayVars ? process.env.MYSQLUSER || process.env.MYSQL_USER : process.env.DB_USER) ||
  process.env.DB_USER ||
  process.env.MYSQLUSER ||
  process.env.MYSQL_USER ||
  "root";
const dbPassword =
  urlConfig.password ||
  (shouldPreferRailwayVars ? process.env.MYSQLPASSWORD || process.env.MYSQL_PASSWORD : process.env.DB_PASSWORD) ||
  process.env.DB_PASSWORD ||
  process.env.MYSQLPASSWORD ||
  process.env.MYSQL_PASSWORD ||
  "";
const dbConnectTimeout = parsePositiveInt(process.env.DB_CONNECT_TIMEOUT_MS, 10000);
const dbConnectionLimit = parsePositiveInt(process.env.DB_CONNECTION_LIMIT, 15);
const dbSslMode = String(process.env.DB_SSL || urlConfig.ssl || "").trim().toLowerCase();
const isRailwayRuntime = Boolean(
  process.env.RAILWAY_ENVIRONMENT ||
    process.env.RAILWAY_PROJECT_ID ||
    process.env.RAILWAY_SERVICE_ID ||
    process.env.RAILWAY_DEPLOYMENT_ID
);
const isProductionRuntime = isRailwayRuntime || process.env.NODE_ENV === "production";

const connectionOptions = {
  host: dbHost,
  port: dbPort,
  user: dbUser,
  password: dbPassword,
  database: dbName,
  waitForConnections: true,
  connectionLimit: dbConnectionLimit,
  queueLimit: 0,
  charset: "utf8mb4",
  connectTimeout: dbConnectTimeout
};

if (["1", "true", "yes", "required", "require"].includes(dbSslMode)) {
  connectionOptions.ssl = { rejectUnauthorized: false };
}

const pool = mysql.createPool(connectionOptions);
let transactionConnection = null;

const getConnectionContext = () => ({
  host: connectionOptions.host,
  port: connectionOptions.port,
  user: connectionOptions.user,
  database: dbName,
  connectTimeoutMs: connectionOptions.connectTimeout,
  connectionLimit: connectionOptions.connectionLimit,
  runtime: isRailwayRuntime ? "railway" : (process.env.NODE_ENV || "development"),
  configSource: urlConfig.host ? "database_url" : (shouldPreferRailwayVars ? "railway_mysql_vars" : "db_vars_or_defaults"),
  hasDatabaseUrl: Boolean(databaseUrl),
  hasMysqlHost: Boolean(railwayHost),
  hasDbHost: Boolean(process.env.DB_HOST),
  hasConfiguredDatabase: Boolean(configuredDbName)
});

const logConnectionDiagnostics = (err, phase) => {
  const context = getConnectionContext();
  console.error(`Database ${phase} error:`, err);
  console.error("Database connection context:", context);

  if (err?.code === "ECONNREFUSED" && isLocalHost(connectionOptions.host)) {
    console.error(
      "MySQL is still configured as localhost. On Railway, add MYSQLHOST, MYSQLPORT, MYSQLUSER, MYSQLPASSWORD, and MYSQLDATABASE to the backend service."
    );
  }

  if (err?.code === "ETIMEDOUT") {
    console.error(
      "MySQL did not complete the TCP handshake in time. Check that MySQL/MariaDB is fully started and reachable."
    );
  }
};

const getStandaloneConnectionOptions = () => {
  const standaloneOptions = { ...connectionOptions };
  delete standaloneOptions.database;
  delete standaloneOptions.waitForConnections;
  delete standaloneOptions.connectionLimit;
  delete standaloneOptions.queueLimit;
  return standaloneOptions;
};

const assertProductionConfig = () => {
  if (isProductionRuntime && !configuredDbName) {
    throw new Error(
      "Missing database name. Set MYSQLDATABASE, DB_NAME, or include a database name in DATABASE_URL/MYSQL_URL."
    );
  }

  if (isProductionRuntime && isLocalHost(connectionOptions.host)) {
    throw new Error(
      "Database host is localhost in production/Railway. Add Railway MySQL variables to this backend service " +
        "(MYSQLHOST, MYSQLPORT, MYSQLUSER, MYSQLPASSWORD, MYSQLDATABASE) or set DATABASE_URL/MYSQL_URL. " +
        "Do not use DB_HOST=localhost on Railway."
    );
  }
};

const pingPool = async () => {
  const connection = await pool.getConnection();
  try {
    await connection.ping();
  } finally {
    connection.release();
  }
};

const createDatabaseIfMissing = async () => {
  const connection = await mysql.createConnection(getStandaloneConnectionOptions());
  try {
    await connection.query(
      `CREATE DATABASE IF NOT EXISTS ${mysqlCore.escapeId(dbName)} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
  } finally {
    await connection.end();
  }
};

const initializePool = async () => {
  assertProductionConfig();

  try {
    await pingPool();
    console.log(`Database pool ready: ${dbName}`);
  } catch (err) {
    if (err?.code === "ER_BAD_DB_ERROR" && !isProductionRuntime) {
      await createDatabaseIfMissing();
      await pingPool();
      console.log(`Database created and pool ready: ${dbName}`);
      return;
    }

    throw err;
  }
};

const ready = initializePool().catch((err) => {
  logConnectionDiagnostics(err, "initialization");
  throw err;
});

const normalizeQueryArgs = (params, callback) => {
  if (typeof params === "function") {
    return { params: [], callback: params };
  }

  return {
    params: typeof params === "undefined" ? [] : params,
    callback
  };
};

const getExecutor = () => transactionConnection || pool;

const withQueryCallback = (promise, callback) => {
  if (typeof callback !== "function") {
    return promise;
  }

  promise
    .then(([rows, fields]) => callback(null, rows, fields))
    .catch((err) => callback(err));

  return undefined;
};

const withVoidCallback = (promise, callback) => {
  if (typeof callback !== "function") {
    return promise;
  }

  promise
    .then(() => callback(null))
    .catch((err) => callback(err));

  return undefined;
};

const beginTransactionAsync = async () => {
  if (transactionConnection) {
    throw new Error("A database transaction is already active.");
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    transactionConnection = connection;
  } catch (err) {
    connection.release();
    throw err;
  }
};

const commitTransactionAsync = async () => {
  if (!transactionConnection) {
    throw new Error("No active database transaction to commit.");
  }

  const connection = transactionConnection;
  try {
    await connection.commit();
  } finally {
    transactionConnection = null;
    connection.release();
  }
};

const rollbackTransactionAsync = async () => {
  if (!transactionConnection) {
    return;
  }

  const connection = transactionConnection;
  try {
    await connection.rollback();
  } finally {
    transactionConnection = null;
    connection.release();
  }
};

const query = (sql, params, callback) => {
  const queryArgs = normalizeQueryArgs(params, callback);
  return withQueryCallback(getExecutor().query(sql, queryArgs.params), queryArgs.callback);
};

const execute = (sql, params, callback) => {
  const queryArgs = normalizeQueryArgs(params, callback);
  return withQueryCallback(getExecutor().execute(sql, queryArgs.params), queryArgs.callback);
};

const promiseAdapter = {
  query: (sql, params) => getExecutor().query(sql, typeof params === "undefined" ? [] : params),
  execute: (sql, params) => getExecutor().execute(sql, typeof params === "undefined" ? [] : params),
  getConnection: () => pool.getConnection(),
  beginTransaction: beginTransactionAsync,
  commit: commitTransactionAsync,
  rollback: rollbackTransactionAsync,
  end: () => pool.end()
};

const db = {
  ready,
  query,
  execute,
  beginTransaction: (callback) => withVoidCallback(beginTransactionAsync(), callback),
  commit: (callback) => withVoidCallback(commitTransactionAsync(), callback),
  rollback: (callback) => withVoidCallback(rollbackTransactionAsync(), callback),
  getConnection: () => pool.getConnection(),
  promise: () => promiseAdapter,
  end: (callback) => withVoidCallback(
    (async () => {
      await rollbackTransactionAsync();
      await pool.end();
    })(),
    callback
  ),
  on: (eventName, listener) => {
    if (typeof pool.on === "function") {
      pool.on(eventName, listener);
    }
    return db;
  },
  escape: mysqlCore.escape,
  escapeId: mysqlCore.escapeId,
  format: mysqlCore.format
};

module.exports = db;
