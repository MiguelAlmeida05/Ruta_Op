import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve(process.cwd());

const tryCommand = (command, args) => {
  const result = spawnSync(command, args, { stdio: 'ignore' });
  return !result.error && result.status === 0;
};

const resolvePython = () => {
  const candidates = [process.env.PYTHON, 'python', 'py'].filter(Boolean);
  for (const candidate of candidates) {
    if (tryCommand(candidate, ['--version'])) return candidate;
  }
  return null;
};

const python = resolvePython();
if (!python) {
  console.error('Python no encontrado. Ejecuta primero: npm run setup');
  process.exit(1);
}

const venvDir = path.join(projectRoot, '.venv');
const venvPython =
  process.platform === 'win32'
    ? path.join(venvDir, 'Scripts', 'python.exe')
    : path.join(venvDir, 'bin', 'python');

const backendPython = fs.existsSync(venvPython) ? venvPython : python;

const children = [];

const start = (label, command, args, options = {}) => {
  const child = spawn(command, args, { stdio: 'inherit', ...options });
  child.on('exit', (code) => {
    if (code && code !== 0) {
      console.error(`[${label}] exited with code ${code}`);
      process.exitCode = code;
    }
  });
  children.push(child);
  return child;
};

const stopAll = () => {
  for (const child of children) {
    if (!child.killed) {
      child.kill('SIGTERM');
    }
  }
};

process.on('SIGINT', () => {
  stopAll();
  process.exit(0);
});
process.on('SIGTERM', () => {
  stopAll();
  process.exit(0);
});

start(
  'backend',
  backendPython,
  ['-m', 'uvicorn', 'app.main:app', '--reload', '--host', '127.0.0.1', '--port', '8000'],
  { cwd: path.join(projectRoot, 'backend') }
);

start('frontend', 'npm', ['run', 'dev'], {
  cwd: path.join(projectRoot, 'frontend'),
  shell: true
});
