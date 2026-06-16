const mysql = require("mysql2");
require("../loadEnv");

const parseDatabaseUrl = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return {};

  try {
    const url = new URL(raw);
    return {
      host: url.hostname,
      port: url.port,
      user: decodeURIComponent(url.username || ""),
      password: decodeURIComponent(url.password || ""),
      database: decodeURIComponent((url.pathname || "").replace(/^\/+/, "")),
      ssl: url.searchParams.get("ssl") || url.searchParams.get("sslmode")
    };
  } catch (err) {
    console.error("Invalid database URL format:", err.message);
    return {};
  }
};

const isLocalHost = (value) => ["localhost", "127.0.0.1", "::1"].includes(String(value || "").trim());
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

const dbName = (
  urlConfig.database ||
  process.env.MYSQLDATABASE ||
  process.env.MYSQL_DATABASE ||
  process.env.DB_NAME
);
const dbHost = (
  urlConfig.host ||
  (shouldPreferRailwayVars ? railwayHost : process.env.DB_HOST) ||
  railwayHost ||
  "127.0.0.1"
);
const dbPort = Number.parseInt(
  urlConfig.port ||
    (shouldPreferRailwayVars ? process.env.MYSQLPORT || process.env.MYSQL_PORT : process.env.DB_PORT) ||
    process.env.DB_PORT ||
    process.env.MYSQLPORT ||
    process.env.MYSQL_PORT ||
    "3306",
  10
);
const dbUser = (
  urlConfig.user ||
  (shouldPreferRailwayVars ? process.env.MYSQLUSER || process.env.MYSQL_USER : process.env.DB_USER) ||
  process.env.DB_USER ||
  process.env.MYSQLUSER ||
  process.env.MYSQL_USER ||
  "root"
);
const dbPassword = (
  urlConfig.password ||
  (shouldPreferRailwayVars ? process.env.MYSQLPASSWORD || process.env.MYSQL_PASSWORD : process.env.DB_PASSWORD) ||
  process.env.DB_PASSWORD ||
  process.env.MYSQLPASSWORD ||
  process.env.MYSQL_PASSWORD ||
  ""
);
const dbConnectTimeout = Number.parseInt(process.env.DB_CONNECT_TIMEOUT_MS || "10000", 10);
const dbSslMode = String(process.env.DB_SSL || urlConfig.ssl || "").trim().toLowerCase();
const isRailwayRuntime = Boolean(
  process.env.RAILWAY_ENVIRONMENT ||
    process.env.RAILWAY_PROJECT_ID ||
    process.env.RAILWAY_SERVICE_ID ||
    process.env.RAILWAY_DEPLOYMENT_ID
);

const normalizedDbPort = Number.isInteger(dbPort) && dbPort > 0 ? dbPort : 3306;
const normalizedConnectTimeout =
  Number.isInteger(dbConnectTimeout) && dbConnectTimeout > 0 ? dbConnectTimeout : 10000;

const connectionOptions = {
  host: dbHost,
  port: normalizedDbPort,
  user: dbUser,
  password: dbPassword,
  database: dbName,
  charset: "utf8mb4",
  connectTimeout: normalizedConnectTimeout
};

if (["1", "true", "required", "require"].includes(dbSslMode)) {
  connectionOptions.ssl = { rejectUnauthorized: false };
}

const db = mysql.createConnection(connectionOptions);

const getConnectionContext = () => ({
  host: connectionOptions.host,
  port: connectionOptions.port,
  user: connectionOptions.user,
  database: dbName,
  connectTimeoutMs: connectionOptions.connectTimeout,
  runtime: isRailwayRuntime ? "railway" : (process.env.NODE_ENV || "development"),
  configSource: urlConfig.host ? "database_url" : (shouldPreferRailwayVars ? "railway_mysql_vars" : "db_vars_or_defaults"),
  hasDatabaseUrl: Boolean(databaseUrl),
  hasMysqlHost: Boolean(railwayHost),
  hasDbHost: Boolean(process.env.DB_HOST)
});

const logConnectionDiagnostics = (err, phase) => {
  const context = getConnectionContext();
  console.error(`Database ${phase} error:`, err);
  console.error("Database connection context:", context);

  if (err?.code === "ETIMEDOUT") {
    console.error(
      "MySQL did not complete the TCP handshake in time. Check that MySQL/MariaDB is fully started and reachable."
    );
  }
};

const ready = new Promise((resolve, reject) => {
  if (!dbName) {
    reject(new Error("Missing database name. Set DB_NAME, MYSQLDATABASE, or include a database name in DATABASE_URL/MYSQL_URL."));
    return;
  }

  if ((isRailwayRuntime || process.env.NODE_ENV === "production") && isLocalHost(connectionOptions.host)) {
    reject(new Error(
      "Database host is localhost in production/Railway. Add Railway MySQL variables to this backend service " +
      "(MYSQLHOST, MYSQLPORT, MYSQLUSER, MYSQLPASSWORD, MYSQLDATABASE) or set DATABASE_URL/MYSQL_URL. " +
      "Do not use DB_HOST=localhost on Railway."
    ));
    return;
  }

  db.connect((connectionErr) => {
    if (connectionErr) {
      logConnectionDiagnostics(connectionErr, "initialization");
      reject(connectionErr);
      return;
    }

    const selectDatabase = (callback) => {
      db.changeUser({ database: dbName }, callback);
    };

    selectDatabase((changeUserErr) => {
      if (!changeUserErr) {
        console.log(`Database ready: ${dbName}`);
        resolve();
        return;
      }

      if (changeUserErr.code !== "ER_BAD_DB_ERROR") {
        reject(changeUserErr);
        return;
      }

      const createDatabaseSql = `CREATE DATABASE IF NOT EXISTS ${mysql.escapeId(dbName)} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`;

      db.query(createDatabaseSql, (createDbErr) => {
        if (createDbErr) {
          reject(createDbErr);
          return;
        }

        selectDatabase((retryErr) => {
          if (retryErr) {
            reject(retryErr);
            return;
          }

          console.log(`Database created and ready: ${dbName}`);
          resolve();
        });
      });
    });
  });
});

db.ready = ready;

db.on("error", (err) => {
  logConnectionDiagnostics(err, "runtime");
  if (err.fatal) {
    console.error("Fatal database error encountered, exiting process to trigger auto-restart...");
    process.exit(1);
  }
});

module.exports = db;
