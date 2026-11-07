// Typography runtime: the TYPE block -> FontFace (pinned Fontsource CDN or local fonts/), type set in Canvas 2D by role,
// type motion (stagger, masks, baseline shifts, axis breathing) and a type check (glyphs, phone size, contrast, line
// length). Same code in film.html (inline), starter/type.mjs and the type specimen. KIT/references/typography.md.
//
// TYPE = { lang: 'tr', roles: { display: ROLE, text: ROLE, mono: ROLE | null } }
// ROLE (Fontsource, numbers from references/type-library.json):
//   { family: 'Fraunces', pkg: 'fraunces', version: '5.3.0', weights: [400, 700] }                  static cuts
//   { family: 'Fraunces', pkg: 'fraunces', version: '5.3.0', variable: 'full',                      variable file
//     axes: { wght: [100, 900], opsz: [9, 144], SOFT: [0, 100], WONK: [0, 1] },
//     stops: [{ SOFT: 0 }, { SOFT: 50 }, { SOFT: 100, WONK: 1 }],    faces for non-weight axes (Canvas has no axis API)
//     features: '"ss01", "tnum"', cap: 0.7 }    OpenType features for every face of this role; cap = cap height / em (library metrics)
// ROLE (local, brand or Fontshare fonts; fonts/ stays out of git):
//   { family: 'Brand Sans', files: { 400: 'fonts/brand/BrandSans-Regular.woff2', 700: 'fonts/brand/BrandSans-Bold.woff2' } }
//   { family: 'Basteleur', files: { var: 'fonts/basteleur/Basteleur-Moonlight.woff2' }, axes: { wght: [200, 700] } }
// styles: default ['normal']; ['normal', 'italic'] also loads the italic files (Fontsource names them -italic).
// subsets: default ['latin', 'latin-ext'] (İ Ğ ğ Ş ş live in latin-ext, ı in latin). A font whose library entry has
// one subset ships one file that already carries Turkish: set subsets: ['latin'] and it loads without a unicode range.

const TYPE_SUBSETS = {
  latin: 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD',
  'latin-ext': 'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF',
};
const TYPE_FALLBACK = { display: 'ui-sans-serif, -apple-system, "Helvetica Neue", Arial, sans-serif',
  text: 'ui-sans-serif, -apple-system, "Helvetica Neue", Arial, sans-serif', mono: 'ui-monospace, Menlo, monospace' };
const TYPE_TR_TEST = 'İıĞğŞşÇçÖöÜü';
const STRETCH = [[50, 'ultra-condensed'], [62.5, 'extra-condensed'], [75, 'condensed'], [87.5, 'semi-condensed'], [100, 'normal'],
  [112.5, 'semi-expanded'], [125, 'expanded'], [150, 'extra-expanded'], [200, 'ultra-expanded']];

const stopKey = (stop) => Object.entries(stop).map(([k, v]) => `${k}${v}`).join(',');
const typeRole = (T, name) => (T && T.roles && T.roles[name]) || null;

function roleFaces(r) {                       // every FontFace one role needs: subsets × cuts × axis stops
  const subs = r.subsets || ['latin', 'latin-ext'], ranged = subs.length > 1, out = [];
  for (const style of r.styles || ['normal']) {
  const base = { style };
  if (r.features) base.featureSettings = r.features;
  const variants = [{ name: r.family, extra: {} }, ...(r.stops || []).map((s) => ({ name: `${r.family}~${stopKey(s)}`,
    extra: { variationSettings: Object.entries(s).map(([k, v]) => `"${k}" ${v}`).join(', ') } }))];
  const wr = r.axes?.wght ? `${r.axes.wght[0]} ${r.axes.wght[1]}` : '100 900';
  const sr = r.axes?.wdth ? `${r.axes.wdth[0]}% ${r.axes.wdth[1]}%` : undefined;
  for (const v of variants) {
    if (r.files) {
      for (const [w, file] of Object.entries(r.files)) {
        // local files are named from the film folder (fonts/…); this module sits one level down (engine/, type/)
        const url = /^(https?:|file:|\/)/.test(file) ? file : new URL(file, new URL('../', import.meta.url)).href;
        out.push([v.name, url, { ...base, ...v.extra, weight: w === 'var' ? wr : String(w), ...(w === 'var' && sr ? { stretch: sr } : {}) }]);
      }
      continue;
    }
    for (const sub of subs) {
      const range = ranged ? { unicodeRange: TYPE_SUBSETS[sub] } : {};
      if (r.variable) {
        const url = `https://cdn.jsdelivr.net/npm/@fontsource-variable/${r.pkg}@${r.varVersion || r.version}/files/${r.pkg}-${sub}-${r.variable}-${style}.woff2`;
        out.push([v.name, url, { ...base, ...range, ...v.extra, weight: wr, ...(sr ? { stretch: sr } : {}) }]);
      } else for (const w of r.weights || [400]) {
        const url = `https://cdn.jsdelivr.net/npm/@fontsource/${r.pkg}@${r.version}/files/${r.pkg}-${sub}-${w}-${style}.woff2`;
        out.push([v.name, url, { ...base, ...range, ...v.extra, weight: String(w) }]);
      }
    }
  }
  }
  return out;
}

// Loads every role; any face that fails stops the render (a silent fallback font would change the film's type).
async function loadType(T) {
  if (!T || !T.roles) return [];
  const jobs = [];
  for (const [name, r] of Object.entries(T.roles)) {
    if (!r) continue;
    for (const [family, url, desc] of roleFaces(r)) {
      const f = new FontFace(family, `url(${url})`, desc);
      jobs.push(f.load().then(() => { document.fonts.add(f); return `${name}: ${family}`; },
        (e) => { throw new Error(`TYPE ${name} "${r.family}" failed to load ${url} (${e?.message || e}); fix the TYPE block or the fonts/ file`); }));
    }
  }
  return [...new Set(await Promise.all(jobs))];
}

// font() returns a ctx.font string for a role at px, weight (any number inside the wght axis) and axes (nearest stop;
// wdth without stops snaps to the CSS stretch keywords). Set it, then draw.
function typeFont(T, role, px, o = {}) {
  const r = typeRole(T, role), fb = TYPE_FALLBACK[role] || TYPE_FALLBACK.text;
  const weight = Math.round(o.weight ?? (role === 'display' ? 700 : role === 'mono' ? 400 : 500));
  if (!r) return `${weight} ${px}px ${fb}`;
  let face = r.family;
  const ax = o.axes || {};
  if (r.stops?.length && Object.keys(ax).length) {
    let best = null, bd = Infinity;
    for (const s of r.stops) {
      let d = 0;
      for (const [k, v] of Object.entries(ax)) {
        const span = r.axes?.[k] ? r.axes[k][1] - r.axes[k][0] || 1 : 1;
        d += ((s[k] ?? r.axes?.[k]?.[2] ?? v) - v) ** 2 / span ** 2;
      }
      if (d < bd) { bd = d; best = s; }
    }
    face = `${r.family}~${stopKey(best)}`;
  }
  const stretch = ax.wdth != null && !r.stops?.some((s) => 'wdth' in s)
    ? STRETCH.reduce((a, b) => Math.abs(b[0] - ax.wdth) < Math.abs(a[0] - ax.wdth) ? b : a)[1] : 'normal';
  return `${o.italic ? 'italic ' : ''}${weight} ${stretch} ${px}px "${face}", ${fb}`;
}

// Tracking by size as a share of the em (typography.md §3): small text opens up, big display tightens, caps open more.
function autoTrack(px, short, caps = false) {
  const s = px / short;
  if (caps) return s < 0.03 ? 0.08 : s < 0.06 ? 0.05 : s < 0.12 ? 0.03 : 0.015;
  return s < 0.025 ? 0.015 : s < 0.06 ? 0.005 : s < 0.12 ? -0.01 : -0.02;
}

function setType(g, T, role, px, o = {}) {
  g.font = typeFont(T, role, px, o);
  g.letterSpacing = `${((o.track ?? autoTrack(px, o.short || 1080, o.caps)) * px).toFixed(2)}px`;
  g.fontKerning = 'normal';
  return g;
}

// Casing in the text's language: Turkish i/İ and ı/I need the 'tr' locale (istanbul -> İSTANBUL, IŞIK -> ışık).
const up = (s, lang = 'tr') => String(s).toLocaleUpperCase(lang);
const low = (s, lang = 'tr') => String(s).toLocaleLowerCase(lang);

// Lines that fit maxW, with no one-word last line (widow) when it can be avoided; balance: lines of similar length.
function wrap(g, str, maxW, balance = false) {
  const words = String(str).split(/[ \t\n]+/).filter(Boolean);   // a no-break space (\u00A0) keeps '24.990\u00A0₺' together
  const fit = (w) => {
    const lines = []; let cur = '';
    for (const word of words) {
      const t = cur ? `${cur} ${word}` : word;
      if (g.measureText(t).width <= w || !cur) cur = t; else { lines.push(cur); cur = word; }
    }
    if (cur) lines.push(cur);
    return lines;
  };
  let lines = fit(maxW);
  if (balance && lines.length > 1) {
    let lo = maxW * 0.5, hi = maxW;
    for (let i = 0; i < 12; i++) { const mid = (lo + hi) / 2; if (fit(mid).length > lines.length) lo = mid; else hi = mid; }
    lines = fit(hi);
  }
  const n = lines.length;
  if (n > 1 && !lines[n - 1].includes(' ')) {
    const prev = lines[n - 2].split(' ');
    if (prev.length > 2) { lines[n - 1] = `${prev.pop()} ${lines[n - 1]}`; lines[n - 2] = prev.join(' '); }
  }
  return lines;
}

// Ink above the cap height that Turkish and other Latin diacritics need (İ dot, Ğ breve, Ş/Ç cedilla below):
// masks and boxes use these, never the cap height alone.
function headroom(g) {
  const cap = g.measureText('H').actualBoundingBoxAscent, acc = g.measureText('İĞÜÖÂ').actualBoundingBoxAscent;
  const desc = Math.max(g.measureText('ŞÇgy').actualBoundingBoxDescent, 0);
  return { cap, above: acc, below: desc };
}

// Text in by unit (char | word): each unit rises from a baseline shift inside a mask, staggered across `spread` of
// the progress p (0..1). ease: an easing from EASE/MOTION; order: seq | reverse | center. Draw after setType().
function typeReveal(g, str, x, y, p, o = {}) {
  const by = o.by || 'char', spread = o.spread ?? 0.5, rise = o.rise ?? 0.9, ease = o.ease || ((k) => 1 - (1 - k) ** 3);
  const units = by === 'word' ? String(str).split(/(\s+)/) : [...String(str)];
  const hr = headroom(g), top = y - hr.above * 1.08, h = hr.above * 1.08 + hr.below * 1.3 + 2;
  const total = g.measureText(str).width;
  let cx = (g.textAlign === 'center' ? x - total / 2 : g.textAlign === 'right' ? x - total : x);
  const align = g.textAlign; g.textAlign = 'left';
  const n = units.length;
  units.forEach((u, i) => {
    const w = g.measureText(u).width;
    const pos = n < 2 ? 0 : (o.order === 'reverse' ? 1 - i / (n - 1) : o.order === 'center' ? Math.abs(2 * i / (n - 1) - 1) : i / (n - 1));
    const k = ease(Math.min(1, Math.max(0, (p - pos * spread) / (1 - spread || 1))));
    if (k > 0 && u.trim()) {
      g.save();
      if (o.mask !== false) { g.beginPath(); g.rect(cx - 2, top, w + 4 + parseFloat(g.letterSpacing || 0), h); g.clip(); }
      g.globalAlpha *= o.fade ? k : 1;
      g.fillText(u, cx, y + (1 - k) * rise * h);
      g.restore();
    }
    cx += w;
  });
  g.textAlign = align;
}

// A weight that breathes with the beat: wght between lo and hi, peak on each beat (t in s, bpm), cosine-shaped.
const breathe = (t, bpm, lo, hi, phase = 0) => lo + (hi - lo) * (0.5 + 0.5 * Math.cos(2 * Math.PI * (t * bpm / 60 - phase)));

// ---- talking-head captions (optional style; typography.md §8) ----
// CAPTIONS from tools/captions.py: { words: [{ w, t0, t1, group, accent, punch }], groups: [{ t0, t1, words: [i…] }] }.
// Words appear on their own spoken time (word-locked): a short pop from 0.86 scale, the spoken word in o.hi, accent
// words in o.accentRole (a contrasting face) and o.accent colour. Screen space, centred at o.y (share of H, default
// above the 9:16 UI zone). o: { role, accentRole, size (share of the short side), caps, ink, hi, accent, box, y, lang }.
function kineticCaptions(g, T, cap, t, W, H, o = {}) {
  if (!cap) return;
  const gi = cap.groups.findIndex((gr, i) => t >= gr.t0 - 0.04 && t < (cap.groups[i + 1]?.t0 ?? gr.t1 + 0.35));
  if (gi < 0) return;
  const short = Math.min(W, H), px = short * (o.size ?? 0.062), lang = o.lang ?? T?.lang ?? 'tr';
  const words = cap.groups[gi].words.map((i) => cap.words[i]);
  const faceOf = (w) => typeFont(T, w.accent && o.accentRole ? o.accentRole : (o.role || 'display'), px,
    { weight: w.accent ? (o.accentWeight ?? 800) : (o.weight ?? 700), italic: w.accent && o.accentItalic });
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.textBaseline = 'alphabetic'; g.textAlign = 'left';
  g.letterSpacing = `${(autoTrack(px, short, o.caps) * px).toFixed(2)}px`;
  const items = words.map((w) => { const s = o.caps ? up(w.w, lang) : w.w; g.font = faceOf(w); return { w, s, wd: g.measureText(s).width }; });
  const space = px * 0.28, maxW = W * 0.84, lines = [[]];
  let lw = 0;
  for (const it of items) {
    if (lw && lw + space + it.wd > maxW) { lines.push([]); lw = 0; }
    lines[lines.length - 1].push(it); lw += (lw ? space : 0) + it.wd;
  }
  const lead = px * 1.12, y0 = H * (o.y ?? (H > W ? 0.66 : 0.8)) - (lines.length - 1) * lead / 2;
  lines.forEach((ln, li) => {
    const total = ln.reduce((a, it, i) => a + it.wd + (i ? space : 0), 0);
    let x = (W - total) / 2;
    for (const it of ln) {
      const k = Math.min(1, Math.max(0, (t - it.w.t0) / 0.12));
      if (k > 0) {
        const s = 0.86 + 0.14 * (1 + 2.2 * (k - 1) ** 3 + 1.2 * (k - 1) ** 2), y = y0 + li * lead;
        g.save(); g.translate(x + it.wd / 2, y - px * 0.35); g.scale(s, s); g.translate(-(x + it.wd / 2), -(y - px * 0.35));
        g.font = faceOf(it.w); g.globalAlpha = Math.min(1, k * 1.6);
        if (o.box) { const hr = headroom(g); g.fillStyle = o.box; g.fillRect(x - px * 0.12, y - hr.above - px * 0.1, it.wd + px * 0.24, hr.above + hr.below + px * 0.22); }
        const speaking = t >= it.w.t0 && t < it.w.t1;
        g.fillStyle = it.w.accent ? (o.accent || '#ffd23f') : speaking ? (o.hi || o.ink || '#ffffff') : (o.ink || '#ffffff');
        if (o.shadow !== false) { g.shadowColor = 'rgba(0,0,0,0.45)'; g.shadowBlur = px * 0.12; g.shadowOffsetY = px * 0.04; }
        g.fillText(it.s, x, y);
        g.restore();
      }
      x += it.wd + space;
    }
  });
  g.restore();
}

// Punch-in on emphasis: a frame scale for the words marked punch (1 -> 1 + amount in 0.08 s, back over 0.5 s).
function captionPunch(cap, t, amount = 0.07) {
  let s = 1;
  for (const w of cap?.words || []) {
    if (!w.punch || t < w.t0 || t > w.t0 + 0.6) continue;
    const u = t - w.t0, k = u < 0.08 ? 1 - (1 - u / 0.08) ** 3 : Math.max(0, 1 - ((u - 0.08) / 0.5)) ** 2;
    s = Math.max(s, 1 + amount * k);
  }
  return s;
}

// ---- type check ----
const lum = (hex) => {
  const v = hex.replace('#', ''), c = [0, 2, 4].map((i) => parseInt(v.length === 3 ? v[i / 2].repeat(2) : v.slice(i, i + 2), 16) / 255);
  const l = c.map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
  return 0.2126 * l[0] + 0.7152 * l[1] + 0.0722 * l[2];
};
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };

// Characters the role's family does not draw (the browser would substitute another font): measured against two
// different fallbacks; a width that changes with the fallback means the glyph came from the fallback.
function missingGlyphs(g, family, str) {
  const miss = new Set();
  g.save(); g.letterSpacing = '0px';
  for (const ch of new Set([...String(str)].filter((c) => c.trim()))) {
    const w = (fb) => { g.font = `400 60px "${family}", ${fb}`; return g.measureText(ch).width; };
    const a = w('monospace'), b = w('serif'), c = w('cursive');
    if (Math.abs(a - b) > 0.01 || Math.abs(b - c) > 0.01) miss.add(ch);
  }
  g.restore();
  return [...miss].join('');
}

// Minimum cap height in delivered pixels for text that must be read on a phone (typography.md §2).
function minCap(W, H, kind = 'text') {
  const short = Math.min(W, H), ar = W / H;
  const base = ar < 1.25 ? 0.026 : 0.037;     // 9:16 and 1:1 fill the phone's width; 16:9 inline is ~0.56x as tall
  return Math.round(short * base * (kind === 'legal' ? 0.8 : kind === 'display' ? 1.6 : 1));
}

// TYPE.check = { strings: { display: ['TITLE'], text: ['a line'] }, sizes: { text: 0.034, legal: 0.024 } (share of the
// short side), maxChars: 32, palette: { bg, ink } }. Errors stop the render; warnings go to the capture log.
function typeCheck(g, T, W, H, palette) {
  const errors = [], warnings = [], c = (T && T.check) || {};
  for (const [name, r] of Object.entries((T && T.roles) || {})) {
    if (!r) continue;
    const strs = [...(c.strings?.[name] || []), ...(T.lang === 'tr' || T.lang == null ? [TYPE_TR_TEST] : [])].join('');
    const m = missingGlyphs(g, r.family, strs);
    if (m) errors.push(`${name} "${r.family}" has no glyphs for: ${m}`);
  }
  for (const [kind, share] of Object.entries(c.sizes || {})) {
    const role = kind === 'legal' ? 'text' : kind, px = share * Math.min(W, H);
    g.save(); g.font = typeFont(T, role, px); const cap = g.measureText('H').actualBoundingBoxAscent; g.restore();
    const need = minCap(W, H, kind);
    if (Math.round(cap) < need) warnings.push(`${kind}: cap height ${cap.toFixed(0)} px < ${need} px for phone viewing at ${W}x${H}`);
  }
  const pal = c.palette || palette;
  if (pal?.bg && pal?.ink) {
    const k = contrast(pal.ink, pal.bg);
    if (k < 3) errors.push(`ink on bg contrast ${k.toFixed(2)}:1 (needs 4.5:1 for text, 3:1 for large display)`);
    else if (k < 4.5) warnings.push(`ink on bg contrast ${k.toFixed(2)}:1: large display only, not body or legal lines`);
  }
  const maxC = c.maxChars || (W < H ? 32 : 42);
  for (const s of Object.values(c.strings || {}).flat())
    if (s.length > maxC && !s.includes('\n')) warnings.push(`"${s.slice(0, 24)}…" is ${s.length} characters on one line (max ${maxC}); wrap() it`);
  return { errors, warnings };
}

export { TYPE_SUBSETS, TYPE_FALLBACK, TYPE_TR_TEST, loadType, typeFont, autoTrack, setType, up, low, wrap, headroom, typeReveal, breathe, kineticCaptions, captionPunch, contrast, missingGlyphs, minCap, typeCheck };
