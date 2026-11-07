#!/usr/bin/env node
// Deterministic frame capture from a web page with headless Chrome. Zero npm dependencies (Node 22+).
//
// The page must expose:
//   window.READY             Promise resolving to { frames, fps, width, height, renderer }
//   window.captureFrame(i)   renders frame i and returns a data URL (PNG or JPEG)
//
// Usage:
//   node capture.mjs --url engine/index.html --out frames/shot01 [--workers 3] [--start 0] [--end 143]
//                    [--format png|jpeg] [--quality 0.95] [--params "w=1920&h=804&seed=7"]
//   node capture.mjs --url engine/index.html --probe      # print renderer + frame count, render nothing
//   node capture.mjs --url engine/index.html --verify     # check determinism (same frame twice, out of order)
//   node capture.mjs --url film.html --text-check 0.5 --params "w=540&h=960&shutter=0&textcheck=1"
//                                                         # touching lines and lost type, by time (Quick mode film.html)
// Options:
//   --status renders/S07.status.json   write progress as JSON every 5 s (for background jobs)
//   --flags "--use-angle=vulkan"       extra Chrome flags (GPU setup on Linux/Windows)
//   --frames "0,48,96,144"             capture only these frames (preview thumbnails)
//   --video renders/picture-v1.mp4     pipe frames straight into ffmpeg (H.264, BT.709 tags); no frame files on disk
//   --crf 17                           quality for --video (lower = better, bigger)
//   --maxrate 10M                      bitrate ceiling for --video (grain can push CRF 17 past 25 Mbit/s; platforms
//                                      re-encode anyway); drafts: 4M; 0 = no ceiling (an archive master)
//   --fresh                            clear the frames already in --out and render them all again
//   --audio audio/film.wav             export the page's sound: calls window.renderAudio(), which returns a
//                                      Promise<AudioBuffer> (e.g. from OfflineAudioContext.startRendering());
//                                      written as a 32-bit float WAV (no clipping; master it afterwards).
//                                      Works alone (audio only) or together with --out / --video.
// Env: CHROME_PATH=/path/to/chrome to override browser discovery.
// Local frames resume when page/params/loaded local file contents match (not with --video). --fresh regenerates them.
// HTTP pages render afresh. Local pages with changed unpinned remote assets should use --fresh.
//
// Long job in the background with the shell tool's run_in_background (the agent can end its turn; a fresh session
// reads the status file later):
//   node tools/capture.mjs --url engine/index.html --out frames/S07 --workers 3 --status renders/S07.status.json

import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { closeSync, existsSync, mkdirSync, mkdtempSync, openSync, readFileSync, readSync, readdirSync, rmSync, statSync, writeFileSync, writeSync, renameSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const args = parseArgs(process.argv.slice(2));
if (args.help || args.h) { usage(null); }
if (typeof args.url !== 'string' || !args.url.trim()) usage('missing --url value');
for (const key of ['out', 'video', 'audio', 'status', 'params']) {
  if (args[key] !== undefined && (typeof args[key] !== 'string' || !args[key].trim())) usage(`--${key} needs a value`);
}
const workers = +(args.workers ?? 1);
// One frame, READY or one audio chunk gets this long (CINECODE_FRAME_TIMEOUT seconds, default 180); the whole
// soundtrack gets five times as long.
const EVAL_MS = (Number(process.env.CINECODE_FRAME_TIMEOUT) || 180) * 1000;
if (args.workers === true || !Number.isSafeInteger(workers) || workers < 1) usage('--workers must be a positive integer');
const format = String(args.format ?? 'png').toLowerCase();
if (!['png', 'jpeg', 'jpg'].includes(format)) usage('--format must be png or jpeg');
const quality = +(args.quality ?? 0.95);
if (args.quality === true || !Number.isFinite(quality) || quality < 0 || quality > 1) usage('--quality must be between 0 and 1');
for (const key of ['start', 'end']) {
  if (args[key] !== undefined && (args[key] === true || !Number.isSafeInteger(+args[key]) || +args[key] < 0)) {
    usage(`--${key} must be a non-negative integer`);
  }
}
if (args.frames !== undefined && (typeof args.frames !== 'string' ||
    args.frames.split(',').some((f) => !f.trim() || !Number.isSafeInteger(+f) || +f < 0))) {
  usage('--frames needs comma-separated non-negative integers');
}
const ext = format === 'jpeg' || format === 'jpg' ? 'jpg' : 'png';
const mime = ext === 'jpg' ? 'image/jpeg' : 'image/png';

const pageUrl = buildUrl(args.url, args.params);
const chrome = findChrome();
const extraFlags = typeof args.flags === 'string' ? args.flags.split(/\s+/).filter(Boolean) : [];
const statusFile = typeof args.status === 'string' ? resolve(args.status) : null;
const status = { state: 'starting', url: pageUrl, out: args.out ? resolve(args.out) : null, pid: process.pid,
  started_at: new Date().toISOString() };
writeStatus();
// A failed run closes Chrome and gives its helper processes a moment to stop writing before the profile is removed.
const fail = (e) => {
  status.state = 'failed'; status.error = String(e?.message ?? e); writeStatus(); console.error(e);
  for (const p of browsers) { try { p.kill('SIGKILL'); } catch { /* already gone */ } }
  setTimeout(() => process.exit(1), 700);
};
process.on('uncaughtException', fail);
process.on('unhandledRejection', fail);
let done = 0, skipped = 0;
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { Object.assign(status, { state: 'stopped', done, skipped }); writeStatus(); process.exit(130); });
const browsers = [];                                  // killed on any exit, so no headless Chrome is left running
const profiles = [];                                  // temp Chrome profiles: removed on any exit, a failed run included
// Profiles a crash or a kill left behind are removed, so a machine never collects them: a profile carries the pid of
// the capture that made it and goes only when that process is gone (a long render elsewhere keeps its own); an older
// unnamed profile goes after six hours.
const alive = (pid) => { try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } };
try {
  for (const n of readdirSync(tmpdir())) {
    if (!n.startsWith('cinecode-chrome-')) continue;
    const d = join(tmpdir(), n), pid = Number((/^cinecode-chrome-(\d+)-/.exec(n) || [])[1]);
    if (pid ? !alive(pid) : Date.now() - statSync(d).mtimeMs > 6 * 3600 * 1000) rmSync(d, { recursive: true, force: true });
  }
} catch { /* best effort */ }
process.on('exit', () => {
  for (const p of browsers) { try { p.kill('SIGKILL'); } catch { /* already gone */ } }
  for (const d of profiles) { try { rmSync(d, { recursive: true, force: true }); } catch { /* best effort */ } }
});

const t0 = Date.now();
const first = await openPage(chrome, pageUrl);
const info = await first.ready();
if (!info || !['frames', 'width', 'height'].every((k) => Number.isSafeInteger(info[k]) && info[k] > 0) ||
    !Number.isFinite(info.fps) || info.fps <= 0) {
  throw new Error('READY must provide positive integer frames/width/height and a positive fps');
}
status.renderer = info.renderer;
log(`renderer: ${info.renderer}`);
for (const line of [].concat(info.qc ?? [])) log(`qc: ${line}`);     // warnings the page measured (type check)
log(`page: ${info.width}x${info.height}, ${info.frames} frames @ ${info.fps} fps`);
if (/swiftshader|llvmpipe|software/i.test(String(info.renderer))) {
  log('WARNING: software rendering (no GPU). Expect slow renders. Check Chrome flags / drivers.');
}

if (args.probe) {
  const meta = Object.fromEntries(['title', 'bounds', 'vo', 'palette', 'lookPalette', 'families', 'sfx'].filter((k) => info[k] !== undefined).map((k) => [k, info[k]]));
  if (Object.keys(meta).length) log(`meta: ${JSON.stringify(meta)}`);
  await first.close(); process.exit(0);
}

if (args['text-check']) {
  // A frame every --text-check seconds (default 0.5) drawn with the page's text watch (film.html ?textcheck=1);
  // findings of the same kind and strings are merged into time spans. Exit 1 when anything was found.
  if (!await first.eval('typeof window.textCheck === "function"')) {
    log('text check: this page has no textCheck (load it with textcheck=1 in --params; Film mode pages have none yet)');
    await first.close(); process.exit(0);
  }
  const every = Math.max(1, Math.round(info.fps * (+args['text-check'] > 0 ? +args['text-check'] : 0.5)));
  const spans = [], open = new Map();
  for (let f = 0; f < info.frames; f += every) {
    for (const r of await first.eval(`window.textCheck(${f})`)) {
      const key = r.kind === 'overlap' ? `overlap\u0000${[r.a, r.b].sort().join('\u0000')}` : `contrast\u0000${r.s}`;
      const t = f / info.fps, sp = open.get(key);
      if (sp && t - sp.to <= (every / info.fps) * 1.5) { sp.to = t; sp.worst = Math.max(sp.worst, r.px ?? r.share); }
      else { const n = { ...r, from: t, to: t, worst: r.px ?? r.share }; spans.push(n); open.set(key, n); }
    }
  }
  const at = (sp) => (sp.to > sp.from ? `${sp.from.toFixed(1)}-${sp.to.toFixed(1)} s` : `${sp.from.toFixed(1)} s`);
  const clip = (s) => JSON.stringify(s.length > 28 ? `${s.slice(0, 27)}…` : s);
  for (const sp of spans.sort((a, b) => a.from - b.from)) {
    if (sp.kind === 'overlap') log(`TEXT OVERLAP ${at(sp)}: ${clip(sp.a)} and ${clip(sp.b)} share ${sp.worst} px of ink`);
    else log(`LOW CONTRAST ${at(sp)}: ${clip(sp.s)}: ${sp.worst} % of its letters' edges are within 2:1 of their surround`);
  }
  if (!spans.length) log('text check: no overlapping lines, no line lost in its ground');
  await first.close(); process.exit(spans.length ? 1 : 0);
}

if (args.verify) {
  const k = Math.min(info.frames - 1, Math.floor(info.frames / 2));
  const a = await grab(first, k);
  await grab(first, 0);                      // render a different frame in between
  const b = await grab(first, k);
  const same = sha(a) === sha(b);
  log(`frame ${k} rendered twice (with frame 0 in between): ${same ? 'IDENTICAL' : 'DIFFERENT'}`);
  log(same ? 'deterministic: yes' : 'deterministic: NO - find state carried between frames, Date/performance.now, Math.random');
  await first.close();
  process.exit(same ? 0 : 1);
}


if (typeof args.audio === 'string') {
  await exportAudio(first, resolve(args.audio), info);
  if (!args.out && !args.video) { await first.close(); process.exit(0); }
}

if (!args.out && !args.video) usage('missing --out (or --video / --audio)');
const out = args.out ? resolve(args.out) : null;
let list;
if (typeof args.frames === 'string') {
  list = args.frames.split(',').map((s) => +s.trim());
  if (list.some((f) => f >= info.frames)) throw new Error(`--frames must be below ${info.frames}`);
} else {
  const start = +(args.start ?? 0);
  const end = Math.min(+(args.end ?? info.frames - 1), info.frames - 1);
  list = [];
  for (let f = start; f <= end; f++) list.push(f);
}
const total = list.length;
if (total <= 0) throw new Error('empty frame range');
const start = list[0], end = list[list.length - 1];
if (out) {
  mkdirSync(out, { recursive: true });
  // Only actual local inputs loaded before READY participate. Output/status files cannot invalidate themselves.
  const stampFile = join(out, '.capture-stamp'), stamp = pageStamp(first);
  const old = existsSync(stampFile) ? readFileSync(stampFile, 'utf8') : null;
  if (stamp === null || old !== stamp || args.fresh) {
    let count = 0;
    for (const f of readdirSync(out)) if (/^\d{6}\.(png|jpe?g)$/.test(f)) { rmSync(join(out, f)); count++; }
    if (count) log(`${count} old frames cleared (changed inputs, unverified cache, remote page or --fresh)`);
  }
  if (stamp === null) rmSync(stampFile, { force: true });
  else writeFileSync(stampFile, stamp);
}

// Interleaved chunks, one per worker (each worker = its own Chrome process): frames finish nearly in order,
// which keeps the --video reorder buffer small.
const n = Math.min(workers, total);
const chunks = Array.from({ length: n }, (_, w) => list.map((_, k) => k).filter((k) => k % n === w));   // positions in list
const pages = [first];
for (let i = 1; i < chunks.length; i++) {
  const p = await openPage(chrome, pageUrl);
  await p.ready();
  pages.push(p);
}

Object.assign(status, { state: 'running', total, start, end, workers: chunks.length, format: ext });
const progress = () => {
  const s = (Date.now() - t0) / 1000;
  const fps = done / Math.max(s, 0.001);
  Object.assign(status, { done, skipped, fps: +fps.toFixed(2), eta_s: fps > 0 ? Math.round((total - done - skipped) / fps) : null });
  writeStatus();
  return fps;
};
progress();
const tick = setInterval(() => {
  const fps = progress();
  log(`${done + skipped}/${total} frames (${skipped} skipped) - ${fps.toFixed(1)} fps`);
}, 5000);

const enc = args.video ? startEncoder(resolve(args.video), info.fps) : null;
const pending = new Map();                       // list position -> buffer, so repeated frame indexes stay distinct
let next = 0;                                    // position in `list` the encoder needs next
async function toEncoder(position, buf) {
  pending.set(position, buf);
  while (pending.has(next)) {
    const b = pending.get(next); pending.delete(next); next++;
    if (!enc.stdin.write(b)) await new Promise((r) => enc.stdin.once('drain', r));
  }
}

try {
  await Promise.all(chunks.map(async (positions, i) => {
    for (const k of positions) {
      const f = list[k];
      const file = out ? join(out, `${String(f).padStart(6, '0')}.${ext}`) : null;
      if (file && !enc && existsSync(file)) { skipped++; continue; }
      while (enc && k - next > 4 * n) await sleep(5);   // the worker holding list[next] never waits
      const buf = await grab(pages[i], f);
      if (file) {
        writeFileSync(file + '.part', buf);
        renameSync(file + '.part', file);         // never leave a half-written frame behind
      }
      if (enc) await toEncoder(k, buf);
      done++;
    }
  }));
} finally {
  clearInterval(tick);
  for (const p of pages) await p.close();
}
if (enc) await enc.finish();
const secs = (Date.now() - t0) / 1000;
progress();
Object.assign(status, { state: 'done', eta_s: 0, seconds: +secs.toFixed(1), finished_at: new Date().toISOString(),
  pattern: out ? `${out}/%06d.${ext}` : null, video: args.video ? resolve(args.video) : null });
writeStatus();
log(`done: ${done} rendered, ${skipped} skipped, ${secs.toFixed(1)} s total, ${(done / secs).toFixed(2)} fps, ${chunks.length} worker(s)`);
if (out) log(`frames: ${out}/%06d.${ext}`);
if (enc) log(`video: ${resolve(args.video)} (${total} frames @ ${info.fps} fps, no audio yet)`);

// ---------------------------------------------------------------------------

function startEncoder(file, fps) {
  mkdirSync(dirname(file), { recursive: true });
  const vf = 'scale=out_color_matrix=bt709:out_range=tv,format=yuv420p,' +
    'setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=tv';
  const p = spawn('ffmpeg', ['-hide_banner', '-nostdin', '-loglevel', 'error', '-y',
    '-f', 'image2pipe', '-framerate', String(fps), '-c:v', ext === 'jpg' ? 'mjpeg' : 'png', '-i', '-',
    '-vf', vf, '-c:v', 'libx264', '-preset', 'slow', '-crf', String(args.crf ?? 17), '-g', String(fps * 2),
    ...(String(args.maxrate ?? '10M') === '0' ? [] : ['-maxrate', String(args.maxrate ?? '10M'),
      '-bufsize', String(args.maxrate ?? '10M').replace(/^(\d+(?:\.\d+)?)/, (n) => String(2 * n))]),
    '-movflags', '+faststart', file], { stdio: ['pipe', 'ignore', 'pipe'] });
  let err = '';
  p.stderr.on('data', (d) => { err += d; });
  p.on('error', (e) => { throw new Error(`ffmpeg could not start: ${e.message}`); });
  p.finish = () => new Promise((ok, fail) => {
    p.on('close', (code) => code === 0 ? ok() : fail(new Error(`ffmpeg exited ${code}\n${err.slice(-2000)}`)));
    p.stdin.end();
  });
  return p;
}

// Renders the page's sound in the page (window.renderAudio -> AudioBuffer), packs it as a 32-bit float WAV
// inside the page and moves it over in base64 chunks, so long films do not hit message-size limits.
async function exportAudio(page, file, info) {
  const has = await page.eval('typeof window.renderAudio === "function"');
  if (!has) usage('--audio: the page has no window.renderAudio()');
  const t = Date.now();
  const meta = await page.eval(`(async () => {
    const b = await window.renderAudio();
    const ch = b.numberOfChannels, n = b.length, sr = b.sampleRate;
    const data = Array.from({ length: ch }, (_, c) => b.getChannelData(c));
    const head = 58, bytes = new ArrayBuffer(head + n * ch * 4), v = new DataView(bytes);
    const str = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    str(0, 'RIFF'); v.setUint32(4, bytes.byteLength - 8, true); str(8, 'WAVE');
    str(12, 'fmt '); v.setUint32(16, 18, true); v.setUint16(20, 3, true); v.setUint16(22, ch, true);
    v.setUint32(24, sr, true); v.setUint32(28, sr * ch * 4, true); v.setUint16(32, ch * 4, true);
    v.setUint16(34, 32, true); v.setUint16(36, 0, true);
    str(38, 'fact'); v.setUint32(42, 4, true); v.setUint32(46, n, true);
    str(50, 'data'); v.setUint32(54, n * ch * 4, true);
    const f = new Float32Array(n * ch);           // the 58-byte header leaves the data unaligned for a direct view
    let peak = 0;
    for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) {
      const s = data[c][i]; f[i * ch + c] = s; const a = Math.abs(s); if (a > peak) peak = a;
    }
    new Uint8Array(bytes, head).set(new Uint8Array(f.buffer));
    window.__cinecodeWav = new Uint8Array(bytes);
    return { ch, n, sr, size: bytes.byteLength, peak };
  })()`, EVAL_MS * 5);
  mkdirSync(dirname(file), { recursive: true });
  const fd = openSync(file + '.part', 'w');
  const CHUNK = 6 * 1024 * 1024;
  for (let a = 0; a < meta.size; a += CHUNK) {
    const b64 = await page.eval(`new Promise((ok) => { const r = new FileReader();
      r.onload = () => ok(r.result.slice(r.result.indexOf(',') + 1));
      r.readAsDataURL(new Blob([window.__cinecodeWav.subarray(${a}, ${Math.min(a + CHUNK, meta.size)})])); })`);
    writeSync(fd, Buffer.from(b64, 'base64'));
  }
  closeSync(fd);
  renameSync(file + '.part', file);
  await page.eval('delete window.__cinecodeWav, true');
  const secs = meta.n / meta.sr, film = info.frames / info.fps;
  const peakDb = meta.peak > 0 ? (20 * Math.log10(meta.peak)).toFixed(1) : '-inf';
  log(`audio: ${file} (${secs.toFixed(3)} s, ${meta.sr} Hz, ${meta.ch} ch, 32-bit float, peak ${peakDb} dBFS, ${((Date.now() - t) / 1000).toFixed(1)} s)`);
  if (Math.abs(secs - film) > 1 / info.fps) log(`WARNING: audio is ${secs.toFixed(3)} s but the picture is ${film.toFixed(3)} s`);
  if (meta.peak === 0) log('WARNING: the audio is silent');
}

// Chrome records the files the page actually loaded: imports, fonts, images and query-supplied stills alike.
// Content hashes catch replacements that preserve size/date. Read in chunks so a large video does not fill RAM.
// Remote pages are rendered afresh because their complete inputs cannot be verified from the local filesystem.
function pageStamp(page) {
  if (!pageUrl.startsWith('file:')) return null;
  const h = createHash('sha256').update(JSON.stringify([pageUrl, format, quality]));
  const buffer = Buffer.allocUnsafe(1024 * 1024);
  for (const file of page.localFiles()) {
    h.update('\0').update(file).update('\0');
    const fd = openSync(file, 'r');
    try {
      let length;
      while ((length = readSync(fd, buffer, 0, buffer.length, null)) > 0) h.update(buffer.subarray(0, length));
    } finally { closeSync(fd); }
  }
  return h.digest('hex');
}

async function grab(page, frame) {
  const dataUrl = await page.eval(`window.captureFrame(${frame}, ${JSON.stringify(mime)}, ${quality})`);
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) throw new Error(`frame ${frame}: captureFrame did not return a data URL`);
  return Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64');
}

function sha(buf) { return createHash('sha256').update(buf).digest('hex'); }

function writeStatus() {
  if (!statusFile) return;
  status.updated_at = new Date().toISOString();
  try {
    mkdirSync(dirname(statusFile), { recursive: true });
    writeFileSync(statusFile + '.part', JSON.stringify(status, null, 2) + '\n');
    renameSync(statusFile + '.part', statusFile);
  } catch (e) { console.error(`[capture] could not write status file: ${e.message}`); }
}

async function openPage(chromePath, url) {
  const profile = mkdtempSync(join(tmpdir(), `cinecode-chrome-${process.pid}-`));
  profiles.push(profile);
  const flags = [
    '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--mute-audio',
    '--use-mock-keychain', '--password-store=basic',   // never ask the system keychain (a macOS dialog)
    '--hide-scrollbars', '--enable-gpu', '--ignore-gpu-blocklist',
    '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
    '--allow-file-access-from-files',
  ];
  if (process.platform === 'darwin') flags.push('--use-angle=metal');
  flags.push(...extraFlags);
  const proc = spawn(chromePath, [...flags, url], { stdio: ['ignore', 'ignore', 'pipe'] });
  browsers.push(proc);
  let stderr = '';
  proc.stderr.on('data', (d) => { stderr += d; if (stderr.length > 20000) stderr = stderr.slice(-20000); });

  const portFile = join(profile, 'DevToolsActivePort');
  const deadline = Date.now() + 20000;
  while (!existsSync(portFile)) {
    if (Date.now() > deadline || proc.exitCode !== null) throw new Error(`Chrome did not start.\n${stderr.slice(-2000)}`);
    await sleep(50);
  }
  let port;
  while (!port) {
    try { port = readFileSync(portFile, 'utf8').split('\n')[0].trim(); } catch (e) {
      if (!['EBUSY', 'EPERM', 'EACCES', 'ENOENT'].includes(e.code)) throw e;   // Windows: Chrome still holds the file
    }
    if (!port) {
      if (Date.now() > deadline) throw new Error(`Chrome did not report its port.\n${stderr.slice(-2000)}`);
      await sleep(50);
    }
  }

  let target;
  while (!target) {
    if (Date.now() > deadline) throw new Error('page target not found');
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      target = list.find((t) => t.type === 'page');
    } catch { /* not ready yet */ }
    if (!target) await sleep(50);
  }

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((ok, fail) => { ws.onopen = ok; ws.onerror = () => fail(new Error('CDP websocket failed')); });
  let id = 0;
  const pending = new Map();
  const pageErrors = [];
  const pageExceptions = [];
  const loadedUrls = new Set([url]);
  ws.onmessage = (m) => {
    const msg = JSON.parse(typeof m.data === 'string' ? m.data : m.data.toString());
    if (msg.id && pending.has(msg.id)) {
      const { ok, fail } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? fail(new Error(msg.error.message)) : ok(msg.result);
    } else if (msg.method === 'Network.responseReceived' && msg.params.response.status >= 200 && msg.params.response.status < 400) {
      loadedUrls.add(msg.params.response.url);
    } else if (msg.method === 'Runtime.exceptionThrown') {
      const d = msg.params.exceptionDetails;
      const where = d.url ? ` (${decodeURIComponent(d.url.split('/').pop())}:${(d.lineNumber ?? 0) + 1})` : '';
      const text = (d.exception?.description ?? d.text) + where;   // file and line on every route a load error is reported
      pageErrors.push(text);
      pageExceptions.push({ at: Date.now(), text });
    } else if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
      pageErrors.push(msg.params.args.map((a) => a.value ?? a.description).join(' '));
    }
  };
  // A call that never answers (a frame that never finishes, a texture that never loads, a lost WebGL context) fails
  // after `ms` instead of hanging the render for hours; a crashed page fails every waiting call at once.
  const send = (method, params = {}, ms = 0) => new Promise((ok, fail) => {
    const i = ++id;
    const t = ms ? setTimeout(() => {
      pending.delete(i);
      fail(new Error(`the page gave no answer in ${Math.round(ms / 1000)} s (a frame that never finishes, a texture that `
        + `never loads, a lost WebGL context); render this frame alone with --start/--end to see it`));
    }, ms) : null;
    pending.set(i, { ok: (v) => { clearTimeout(t); ok(v); }, fail: (e) => { clearTimeout(t); fail(e); } });
    ws.send(JSON.stringify({ id: i, method, params }));
  });
  ws.onclose = () => {
    for (const { fail } of pending.values()) fail(new Error('Chrome closed the page: it crashed or ran out of memory'));
    pending.clear();
  };
  await send('Runtime.enable');
  await send('Network.enable');
  await send('Network.setCacheDisabled', { cacheDisabled: true });
  await send('Page.reload', { ignoreCache: true });   // reload so errors thrown during first load are reported

  // Wait for the page script to define READY.
  const loadDeadline = Date.now() + 30000;
  for (;;) {
    const r = await send('Runtime.evaluate', { expression: 'typeof window.READY !== "undefined" && typeof window.captureFrame === "function"', returnByValue: true });
    if (r.result?.value === true) break;
    if (pageErrors.length || Date.now() > loadDeadline) {
      proc.kill('SIGTERM');
      throw new Error(`page never defined window.READY / window.captureFrame\n${[...new Set(pageErrors)].join('\n') || '(no page error reported)'}`);
    }
    await sleep(100);
  }

  return {
    localFiles() {
      return [...new Set([...loadedUrls].filter((u) => u.startsWith('file:')).map((u) => fileURLToPath(new URL(u))))].sort();
    },
    async eval(expression, ms = EVAL_MS) {
      const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, ms);
      if (r.exceptionDetails) throw new Error(`page error: ${r.exceptionDetails.exception?.description ?? r.exceptionDetails.text}`);
      return r.result.value;
    },
    // A page that throws while loading (a syntax error in a module, a scene that fails as it builds) never resolves
    // READY: it fails a few seconds after the error, with the error, instead of after the whole frame timeout.
    async ready() {
      const settled = this.eval('window.READY');
      for (;;) {
        if (await Promise.race([settled.then(() => true, () => true), sleep(250).then(() => false)])) return settled;
        if (pageExceptions.length && Date.now() - pageExceptions[0].at > 8000) {
          throw new Error(`the page threw while loading and never became READY:\n${[...new Set(pageExceptions.map((e) => e.text))].join('\n')}`);
        }
      }
    },
    async close() {
      try { ws.close(); } catch { /* ignore */ }
      proc.kill('SIGTERM');
      await sleep(300);
      try { rmSync(profile, { recursive: true, force: true }); } catch { /* temp browser profile only */ }
    },
  };
}

function findChrome() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const candidates = {
    darwin: [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
      '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    ],
    linux: ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/snap/bin/chromium'],
    win32: [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
      ...(process.env.LOCALAPPDATA ? [join(process.env.LOCALAPPDATA, 'Google', 'Chrome', 'Application', 'chrome.exe')] : []),
    ],
  }[process.platform] ?? [];
  const found = candidates.find((p) => existsSync(p));
  if (!found) usage('no Chrome/Chromium found; set CHROME_PATH');
  return found;
}

function buildUrl(u, params) {
  const base = /^[a-z]+:\/\//i.test(u) ? new URL(u) : pathToFileURL(resolve(u));
  base.searchParams.set('capture', '1');
  if (params) for (const [k, v] of new URLSearchParams(params)) base.searchParams.set(k, v);
  return base.href;
}

function parseArgs(argv) {
  const o = {};
  const alwaysValue = new Set(['flags']);            // its value itself starts with "--"
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const eq = a.indexOf('=');
    if (eq > 2) { o[a.slice(2, eq)] = a.slice(eq + 1); continue; }   // --key=value
    const key = a.slice(2);
    const next = argv[i + 1];
    if (alwaysValue.has(key) && next !== undefined) { o[key] = next; i++; continue; }
    if (next === undefined || next.startsWith('--')) o[key] = true; else { o[key] = next; i++; }
  }
  return o;
}

function usage(msg) {
  (msg ? console.error : console.log)((msg ? `capture.mjs: ${msg}\n` : '') +
    'usage: node capture.mjs --url <page.html|http://...> --out <dir> [--workers N] [--start A] [--end B]\n' +
    '                        [--format png|jpeg] [--quality 0.95] [--params "w=1920&h=804"] [--probe] [--verify] [--text-check 0.5]\n' +
    '                        [--status progress.json] [--flags "--extra-chrome-flag ..."] [--frames "0,48,96"]\n' +
    '                        [--video picture.mp4 [--crf 17] [--maxrate 10M]] [--fresh] [--audio sound.wav]');
  process.exit(msg ? 2 : 0);
}
function log(s) { console.log(`[capture] ${s}`); }
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
