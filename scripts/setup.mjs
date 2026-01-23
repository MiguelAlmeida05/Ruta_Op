import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve(process.cwd());

const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, { stdio: 'inherit', ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`Command failed: ${command} ${args.join(' ')}`);
  }
};

const tryCommand = (command, args) => {
  const result = spawnSync(command, args, { stdio: 'ignore' });
  return !result.error && result.status === 0;
};

const resolvePython = () => {
  const candidates = [process.env.PYTHON, 'python', 'py'].filter(Boolean);
  for (const candidate of candidates) {
    if (tryCommand(candidate, ['--version'])) return candidate;
  }
  throw new Error('Python no encontrado. Instala Python 3.9+ y asegúrate de tenerlo en PATH.');
};

const python = resolvePython();

const venvDir = path.join(projectRoot, '.venv');
const venvPython =
  process.platform === 'win32'
    ? path.join(venvDir, 'Scripts', 'python.exe')
    : path.join(venvDir, 'bin', 'python');

if (!fs.existsSync(venvPython)) {
  run(python, ['-m', 'venv', '.venv'], { cwd: projectRoot });
}

run(venvPython, ['-m', 'pip', 'install', '--upgrade', 'pip'], { cwd: projectRoot });
run(venvPython, ['-m', 'pip', 'install', '-r', path.join('backend', 'requirements.txt')], { cwd: projectRoot });

run('npm', ['ci', '--prefix', 'frontend'], { cwd: projectRoot, shell: true });
