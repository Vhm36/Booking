const { spawn, spawnSync } = require('child_process');

const DEFAULT_TIMEOUT_MS = 120000;

const getPythonCandidates = () => {
  if (process.env.PYTHON_BIN) {
    return [{ command: process.env.PYTHON_BIN, args: [] }];
  }

  return process.platform === 'win32'
    ? [
        { command: 'python', args: [] },
        { command: 'py', args: ['-3'] },
        { command: 'python3', args: [] }
      ]
    : [
        { command: 'python3', args: [] },
        { command: 'python', args: [] }
      ];
};

const buildSpawnArgs = (candidate, scriptPath, mode) => [
  ...candidate.args,
  scriptPath,
  mode
];

const parseJsonOutput = (stdout, stderr, command) => {
  try {
    return JSON.parse(stdout || '{}');
  } catch (err) {
    const details = stderr ? ` Stderr: ${stderr}` : '';
    throw new Error(`Python command ${command} did not return valid JSON.${details}`);
  }
};

const runPythonJson = (scriptPath, mode, payload, options = {}) =>
  new Promise((resolve, reject) => {
    const candidates = getPythonCandidates();
    let index = 0;
    let lastError = null;
    let firstExitError = null;

    const tryCandidate = () => {
      const candidate = candidates[index];
      const args = buildSpawnArgs(candidate, scriptPath, mode);
      const child = spawn(candidate.command, args, {
        windowsHide: true
      });

      let stdout = '';
      let stderr = '';
      let settled = false;

      const timeout = setTimeout(() => {
        settled = true;
        child.kill('SIGKILL');
        reject(new Error(`Python command timed out after ${options.timeoutMs || DEFAULT_TIMEOUT_MS}ms`));
      }, options.timeoutMs || DEFAULT_TIMEOUT_MS);

      child.stdout.on('data', (chunk) => {
        stdout += chunk.toString('utf8');
      });

      child.stderr.on('data', (chunk) => {
        stderr += chunk.toString('utf8');
      });

      child.on('error', (err) => {
        clearTimeout(timeout);
        if (settled) return;

        lastError = err;
        index += 1;

        if (index < candidates.length) {
          tryCandidate();
          return;
        }

        reject(new Error(`Cannot start Python. Set PYTHON_BIN to a valid Python executable. Last error: ${lastError.message}`));
      });

      child.on('close', (code) => {
        clearTimeout(timeout);
        if (settled) return;

        if (code !== 0) {
          lastError = new Error(stderr || `Python exited with code ${code}`);
          firstExitError = firstExitError || lastError;
          index += 1;

          if (index < candidates.length) {
            tryCandidate();
            return;
          }

          reject(new Error(`Python analytics failed. ${(firstExitError || lastError).message}`));
          return;
        }

        try {
          resolve(parseJsonOutput(stdout, stderr, candidate.command));
        } catch (err) {
          reject(err);
        }
      });

      child.stdin.end(JSON.stringify(payload || {}));
    };

    tryCandidate();
  });

const runPythonJsonSync = (scriptPath, mode, payload, options = {}) => {
  const candidates = getPythonCandidates();
  let lastError = null;
  let firstExitError = null;

  for (const candidate of candidates) {
    const args = buildSpawnArgs(candidate, scriptPath, mode);
    const result = spawnSync(candidate.command, args, {
      input: JSON.stringify(payload || {}),
      encoding: 'utf8',
      timeout: options.timeoutMs || DEFAULT_TIMEOUT_MS,
      windowsHide: true
    });

    if (result.error) {
      lastError = result.error;
      continue;
    }

    if (result.status !== 0) {
      lastError = new Error(result.stderr || `Python exited with code ${result.status}`);
      firstExitError = firstExitError || lastError;
      continue;
    }

    return parseJsonOutput(result.stdout, result.stderr, candidate.command);
  }

  const error = firstExitError || lastError;
  throw new Error(`Cannot run Python analytics. Set PYTHON_BIN to a valid Python executable. Last error: ${error?.message || 'unknown'}`);
};

module.exports = {
  runPythonJson,
  runPythonJsonSync
};
