const mysql = require("mysql2");
require("../loadEnv");

const dbName = process.env.DB_NAME;
const dbHost = process.env.DB_HOST || "127.0.0.1";
const dbPort = Number.parseInt(process.env.DB_PORT || "3306", 10);
const dbUser = process.env.DB_USER || "root";
const dbConnectTimeout = Number.parseInt(process.env.DB_CONNECT_TIMEOUT_MS || "10000", 10);

const normalizedDbPort = Number.isInteger(dbPort) && dbPort > 0 ? dbPort : 3306;
const normalizedConnectTimeout =
  Number.isInteger(dbConnectTimeout) && dbConnectTimeout > 0 ? dbConnectTimeout : 10000;

const connectionOptions = {
  host: dbHost,
  port: normalizedDbPort,
  user: dbUser,
  password: process.env.DB_PASSWORD ?? "",
  charset: "utf8mb4",
  connectTimeout: normalizedConnectTimeout
};

const db = mysql.createConnection(connectionOptions);

const getConnectionContext = () => ({
  host: connectionOptions.host,
  port: connectionOptions.port,
  user: connectionOptions.user,
  database: dbName,
  connectTimeoutMs: connectionOptions.connectTimeout
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
    reject(new Error("Missing required environment variable: DB_NAME"));
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
});

module.exports = db;
