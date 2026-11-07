// Runs guard.py for a Claude Code hook. Claude Code starts `node -e <finder> <mode>` with no shell in between (exec
// form), so the hook works the same on macOS, Linux and Windows, with or without Git Bash; the finder in SKILL.md
// loads this file. It never blocks the user over its own trouble: no Python yet means the guard stays out of the way.
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const cp = require('child_process');

const CACHE = process.env.CINECODE_PYTHON_CACHE || path.join(os.homedir(), '.cinecode', 'python.txt');
const PROBE = 'import sys; assert sys.version_info >= (3, 9); print(sys.executable)';

function probe(cmd, args) {
  // Windows' python.exe in WindowsApps is often the Microsoft Store's stub: it prints a hint and exits 9009
  const r = cp.spawnSync(cmd, args.concat(['-c', PROBE]), { encoding: 'utf8', windowsHide: true, timeout: 20000 });
  const exe = r.status === 0 ? (r.stdout || '').trim().split(/\r?\n/).pop() : '';
  return exe && fs.existsSync(exe) ? exe : '';
}

function python() {
  if (process.env.CINECODE_PYTHON) return process.env.CINECODE_PYTHON;
  try {
    const exe = fs.readFileSync(CACHE, 'utf8').trim();
    if (exe && fs.existsSync(exe)) return exe;
  } catch (e) { /* not found yet */ }
  const tries = process.platform === 'win32'
    ? [['py', ['-3']], ['python', []], ['python3', []]]        // py comes with python.org's installer even off PATH
    : [['python3', []], ['python', []]];
  for (const [cmd, args] of tries) {
    const exe = probe(cmd, args);
    if (!exe) continue;
    try {
      fs.mkdirSync(path.dirname(CACHE), { recursive: true });
      fs.writeFileSync(CACHE, exe + '\n');
    } catch (e) { /* a read-only home only costs the next hook a probe */ }
    return exe;
  }
  return '';
}

module.exports = function run(mode) {
  let input;
  try { input = fs.readFileSync(0); } catch (e) { input = Buffer.alloc(0); }
  const guard = (exe) => cp.spawnSync(exe, [path.join(__dirname, 'guard.py'), mode], {
    input,
    stdio: ['pipe', 'pipe', 'inherit'],
    windowsHide: true,
    env: Object.assign({}, process.env, { PYTHONUTF8: '1', PYTHONIOENCODING: 'utf-8' }),
  });
  const exe = python();
  if (!exe) process.exit(0);
  let r = guard(exe);
  if (r.error || (r.status !== null && r.status !== 0 && r.status !== 2)) {
    // the guard answers 0 or 2; anything else is the remembered Python gone or broken (an uninstall, the Store's
    // stub in its place): forget it and search once more
    try { fs.unlinkSync(CACHE); } catch (e) { /* already gone */ }
    const again = python();
    if (!again || again === exe) process.exit(0);
    r = guard(again);
  }
  if (r.status !== 0 && r.status !== 2) process.exit(0);
  try { if (r.stdout && r.stdout.length) fs.writeSync(1, r.stdout); } catch (e) { /* nobody reads it */ }
  process.exit(r.status);
};
