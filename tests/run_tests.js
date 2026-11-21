import { spawn } from 'child_process';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function isPortListening(port) {
  return new Promise((resolve) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path: '/api/health',
        method: 'GET',
        timeout: 1000,
      },
      (res) => resolve(res.statusCode === 200)
    );
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
    req.end();
  });
}

async function run() {
  const backendDir = path.resolve(__dirname, '../backend');
  const testPort = process.env.PORT || 5001;
  const alreadyRunning = await isPortListening(testPort);

  let serverProcess = null;

  if (alreadyRunning) {
    console.log(`Backend server is already running on port ${testPort}. Reusing live instance for tests...`);
  } else {
    console.log('Starting backend server for test run...');
    serverProcess = spawn('node', ['src/server.js'], {
      cwd: backendDir,
      env: { ...process.env, PORT: testPort.toString() },
      stdio: 'pipe',
    });

    serverProcess.stdout.on('data', (d) => {
      const msg = d.toString();
      if (msg.includes('listening on')) {
        console.log('Backend ready:', msg.trim());
      }
    });

    serverProcess.stderr.on('data', (d) => {
      console.error('Backend stderr:', d.toString());
    });

    // Wait for server to initialize
    await new Promise((r) => setTimeout(r, 2500));
  }

  console.log('Spawning integration test runner...\n');
  const testProcess = spawn('node', ['../tests/integration.test.js'], {
    cwd: backendDir,
    stdio: 'inherit',
  });

  testProcess.on('exit', (code) => {
    console.log(`\nTests finished with exit code ${code}.`);
    if (serverProcess) {
      console.log('Stopping spawned test backend server...');
      serverProcess.kill('SIGINT');
    }
    process.exit(code || 0);
  });
}

run();
