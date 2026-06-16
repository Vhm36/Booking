const path = require('path');
const dotenv = require('dotenv');
const fs = require('fs');

const envCandidates = [
  path.resolve(__dirname, '..', '..', '..', '.env'),
  path.resolve(process.cwd(), '.env')
];

const envPath = envCandidates.find((candidate) => fs.existsSync(candidate));

dotenv.config(envPath ? { path: envPath } : undefined);

const frontendEnvCandidates = [
  path.resolve(__dirname, '..', '..', '..', '..', 'frontend', '.env'),
  path.resolve(process.cwd(), '..', 'frontend', '.env')
];

const publicFrontendKeys = new Set([
  'REACT_APP_GOOGLE_CLIENT_ID',
  'REACT_APP_ZALO_APP_ID',
  'REACT_APP_ZALO_CALLBACK_URL'
]);

const frontendEnvPath = frontendEnvCandidates.find((candidate) => fs.existsSync(candidate));

if (frontendEnvPath) {
  const parsedFrontendEnv = dotenv.parse(fs.readFileSync(frontendEnvPath));
  Object.entries(parsedFrontendEnv).forEach(([key, value]) => {
    if (publicFrontendKeys.has(key) && typeof process.env[key] === 'undefined') {
      process.env[key] = value;
    }
  });
}
