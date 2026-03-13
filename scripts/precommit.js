const { spawnSync } = require('child_process');
const { readFileSync } = require('fs');
const path = require('path');

function run(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, Object.assign({ stdio: 'inherit', shell: false }, opts));
  if (res.status !== 0) process.exit(res.status || 1);
}

function getStagedFiles() {
  const res = spawnSync('git', ['diff', '--cached', '--name-only'], { encoding: 'utf8' });
  if (res.error) throw res.error;
  return res.stdout.split(/\r?\n/).filter(Boolean);
}

function main() {
  console.log('\x1b[33m🔍 Running pre-commit checks...\x1b[0m');

  const staged = getStagedFiles();
  const frontendChanged = staged.some(f => f.startsWith('frontend/'));

  if (frontendChanged) {
    console.log('\x1b[33m📝 Frontend files changed, running checks...\x1b[0m');

    // Run ESLint (via npm script to keep behavior consistent)
    console.log('\x1b[33m🔧 Running ESLint...\x1b[0m');
    run(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['next', 'lint'], { cwd: path.join(process.cwd(), 'frontend') });
    console.log('\x1b[32m✅ ESLint passed\x1b[0m');

    // Type check
    console.log('\x1b[33m📘 Running TypeScript type check...\x1b[0m');
    run(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['tsc', '--noEmit'], { cwd: path.join(process.cwd(), 'frontend') });
    console.log('\x1b[32m✅ TypeScript check passed\x1b[0m');

    // lint-staged (auto fixes)
    console.log('\x1b[33m🎨 Running lint-staged...\x1b[0m');
    run(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['lint-staged'], { cwd: path.join(process.cwd(), 'frontend') });
    console.log('\x1b[32m✅ lint-staged passed\x1b[0m');
  }

  console.log('\x1b[32m✅ All pre-commit checks passed!\x1b[0m');
}

try {
  main();
} catch (err) {
  console.error('Pre-commit script failed:', err);
  process.exit(1);
}
