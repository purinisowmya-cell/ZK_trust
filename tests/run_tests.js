import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function run() {
  const backendDir = path.resolve(__dirname, '../backend');
  
  console.log('Starting backend server for test run...');
  const serverProcess = spawn('node', ['src/server.js'], {
    cwd: backendDir,
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

  // Give server 2.5 seconds to initialize
  await new Promise((r) => setTimeout(r, 2500));

  console.log('Spawning integration test runner...\n');
  const testProcess = spawn('node', ['../tests/integration.test.js'], {
    cwd: backendDir,
    stdio: 'inherit',
  });

  testProcess.on('exit', (code) => {
    console.log(`\nTests finished with exit code ${code}. Stopping backend server...`);
    serverProcess.kill('SIGINT');
    process.exit(code || 0);
  });
}

run();
