const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const nodeMajor = parseInt(process.versions.node.split('.')[0], 10);
const env = { ...process.env };

// Only append --no-webstorage on Node >= 22 where Web Storage exists and the flag is recognized.
// On Node 20 and below, webstorage does not exist, and passing this flag causes Node to crash.
if (nodeMajor >= 22) {
  env.NODE_OPTIONS = [env.NODE_OPTIONS, '--no-webstorage'].filter(Boolean).join(' ');
}

const isWin = process.platform === 'win32';
const nextCmd = isWin ? 'next.cmd' : 'next';
const nextBin = path.join(__dirname, '..', 'node_modules', '.bin', nextCmd);

const command = fs.existsSync(nextBin) ? nextBin : (isWin ? 'npx.cmd' : 'npx');
const args = fs.existsSync(nextBin) ? ['dev', '-p', '3002'] : ['next', 'dev', '-p', '3002'];

const child = spawn(command, args, {
  stdio: 'inherit',
  env,
  shell: true,
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
  } else {
    process.exit(code ?? 0);
  }
});

