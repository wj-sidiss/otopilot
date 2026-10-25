'use strict';
// Arayuzde kod enjeksiyonuna yol acan kaliplarin geri gelmesini engeller (B064).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const pub = path.join(__dirname, '..', 'public');
const oku = (a) => fs.readFileSync(path.join(pub, a), 'utf8');

test('uygulama.js: innerHTML / satır içi olay / eval / document.write yok', () => {
  const js = oku('uygulama.js');
  const yasak = [
    [/\.innerHTML\b/, 'innerHTML'], [/\.outerHTML\b/, 'outerHTML'], [/insertAdjacentHTML/, 'insertAdjacentHTML'],
    [/document\.write/, 'document.write'], [/\beval\s*\(/, 'eval'], [/new Function\s*\(/, 'new Function'],
    [/setTimeout\s*\(\s*['"`]/, 'setTimeout(string)'],
    // HTML ozniteligi bicimi (onclick='...' / onerror="..."); es.onerror = () => {} gibi JS ozellik atamasi serbest
    [/\bon(click|error|load|mouseover|mouseenter|focus|input|change|submit|keydown)\s*=\s*['"`\\]/i, 'satır içi olay özniteliği'],
    [/\.setAttribute\(\s*['"]on/i, 'setAttribute(on...)'], [/\.setAttribute\(\s*['"]style['"]/i, 'setAttribute(style)'],
    [/\.srcdoc\b/, 'srcdoc'], [/javascript:/i, 'javascript: url'],
  ];
  for (const [desen, ad] of yasak) assert.ok(!desen.test(js), 'uygulama.js içinde yasak kalıp: ' + ad);
});

test('index.html: satır içi script ve olay özniteliği yok; script yalnız /uygulama.js', () => {
  const html = oku('index.html');
  assert.ok(!/\son[a-z]+\s*=/i.test(html.replace(/<svg[\s\S]*?<\/svg>/g, '')), 'satır içi olay özniteliği (onclick=...) olmamalı');
  const scriptler = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
  // yalniz iki DIS betik: uygulama ve arayuz dili (/dil.js); ikisi de ayni kaynaktan, govdesiz
  assert.equal(scriptler.length, 2);
  assert.match(scriptler[0][1], /src="\/uygulama\.js"/);
  assert.match(scriptler[1][1], /src="\/dil\.js"/);
  for (const sc of scriptler) assert.equal(sc[2].trim(), '', 'satır içi script gövdesi olmamalı');
  assert.ok(!/javascript:/i.test(html));
  assert.ok(!/<(iframe|object|embed|base)\b/i.test(html));
  assert.ok(html.includes('__PANEL_JETON__'), 'sunucu jetonu bu yer tutucuya enjekte eder');
});

test('metin yeri yalnız textContent: el() yardımcısı metni düğüm olarak ekler', () => {
  const js = oku('uygulama.js');
  assert.match(js, /k === 'metin'\) e\.textContent = v/);
  assert.match(js, /document\.createTextNode\(String\(c\)\)/);
  // href / src yalniz guvenliUrl'den gecer
  assert.match(js, /function guvenliUrl/);
  assert.ok(/href: url,/.test(js) && /guvenliUrl\(v\.url\)/.test(js));
});

test('arayüz metinleri: bozuk karakter (Ã, �) yok', () => {
  for (const a of ['index.html', 'uygulama.js', 'stil.css', '../server.js', '../README.md']) {
    const s = fs.readFileSync(path.join(pub, a), 'utf8');
    assert.ok(!/Ã|Ä±|Ã¼|�/.test(s), a + ' içinde bozuk kodlama');
    assert.ok(!s.startsWith('﻿'), a + ' BOM içermemeli');
  }
});
