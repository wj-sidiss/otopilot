// Ses dengesi (-14 LUFS standardi), efekt katmani (yalniz tik/din) ve karisim grafi. Gercek ffmpeg testleri ffmpeg yoksa atlanir.
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const D = require("../lib/ses-denge");
const E = require("../lib/ses-efekt");
const M = require("../lib/render-muzik");
const ortak = require("../lib/ortak");

let FF = null; try { FF = require("../ff-yol").ffmpeg; } catch { /* ffmpeg yok */ }
const atla = { skip: FF ? false : "ffmpeg yok" };
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "sesdenge-"));
test.after(() => fs.rmSync(TMP, { recursive: true, force: true }));

test("HEDEF: tek yayin standardi -14 LUFS / -1.5 dBTP ve render hatti ayni degeri kullanir", () => {
  assert.equal(D.HEDEF.I, -14); assert.equal(D.HEDEF.TP, -1.5);
  assert.match(M.loudnormFiltresi(null), /loudnorm=I=-14:TP=-1\.5/);
  assert.match(M.loudnormFiltresi({ measured_I: "-20", measured_TP: "-3", measured_LRA: "5", measured_thresh: "-30", target_offset: "0" }), /I=-14:TP=-1\.5/);
});

test("ebur128Oku: kareler ve ozet degerleri okunur", () => {
  const m = "[Parsed_ebur128_0] t: 0.0999792  TARGET:-23 LUFS    M: -30.5 S: -inf     I: -70.0 LUFS       LRA:   0.0 LU\n" +
            "[Parsed_ebur128_0] t: 0.199979   TARGET:-23 LUFS    M: -25.1 S: -28.0     I: -26.0 LUFS       LRA:   1.0 LU\n" +
            "[Parsed_ebur128_0] Summary:\n\n  Integrated loudness:\n    I:         -14.2 LUFS\n    Threshold: -24.3 LUFS\n\n  Loudness range:\n    LRA:         7.6 LU\n\n  True peak:\n    Peak:       -1.6 dBFS";
  const o = D.ebur128Oku(m);
  assert.equal(o.kareler.length, 2); assert.equal(o.kareler[0].S, -Infinity); assert.equal(o.kareler[1].M, -25.1);
  assert.equal(o.I, -14.2); assert.equal(o.LRA, 7.6); assert.equal(o.TP, -1.6);
});

test("tepeleriBul: konusmanin ustune cikan patlamalar bulunur, kisa/yakin olanlar birlesir", () => {
  const kareler = []; for (let i = 0; i < 200; i++) { const t = i / 10; kareler.push({ t, M: (t >= 5 && t < 5.6) || (t >= 12 && t < 12.2) ? -10 : -24, S: -24 }); }
  const { taban, tepeler } = D.tepeleriBul(kareler, 6);
  assert.equal(taban, -24); assert.equal(tepeler.length, 2);
  assert.ok(Math.abs(tepeler[0].fazlaLU - 14) < 0.01); assert.equal(tepeler[0].bas, 5);
  assert.equal(D.tepeleriBul(kareler.map(k => ({ t: k.t, M: -24, S: -24 })), 6).tepeler.length, 0);
});

test("efektBusu + sesGrafi: efekt konusmanin altina iner, konusma yan zincirine baglanir, amix girdi sayisi dogru", () => {
  const b = D.efektBusu("efh", "scE");
  assert.match(b.filtre, /volume=-12\.0dB/); assert.match(b.filtre, /sidechaincompress/);
  const g = M.sesGrafi({ anlatim: 0, muzik: 1, efekt: 2 }, { D: 10, bodyStart: 1, bodyEnd: 9, cdSn: 0, sesI: -20, muzik: { I: -18 }, seviye: 0.4, ducking: true });
  assert.match(g.filtre, /\[efd\]amix|\[efd\]/); assert.match(g.filtre, /amix=inputs=3:/);
  const g2 = M.sesGrafi({ anlatim: 0, efekt: 1 }, { D: 10, bodyStart: 1, bodyEnd: 9, cdSn: 0, sesI: -20, ducking: false });
  assert.match(g2.filtre, /\[sesA\]\[efd\]amix=inputs=2:/);
  const g3 = M.sesGrafi({ anlatim: 0, muzik: 1 }, { D: 10, bodyStart: 1, bodyEnd: 9, cdSn: 0, sesI: -20, muzik: { I: -18 }, seviye: 0.4, ducking: true });
  assert.doesNotMatch(g3.filtre, /efh|efd/, "efekt yokken grafik degismez");
});

test("ses-efekt.dogrula: whoosh/riser/boom reddedilir, bilinmeyen tur reddedilir, seyreklik zorlanir", () => {
  for (const t of ["whoosh", "Swoosh", "riser", "boom", "impact", "glitch"]) assert.throws(() => E.dogrula([{ t: 1, tur: t }], 30), /yasak/);
  assert.throws(() => E.dogrula([{ t: 1, tur: "zil" }], 30), /Bilinmeyen/);
  assert.throws(() => E.dogrula([{ t: 99, tur: "tik" }], 30), /zaman/);
  assert.throws(() => E.dogrula([{ t: 1, tur: "tik", guc: 2 }], 30), /gücü/);
  const r = E.dogrula([{ t: 1, tur: "tik" }, { t: 1.8, tur: "din" }, { t: 3, tur: "din" }], 30);
  assert.deepEqual(r.olaylar.map(o => o.t), [1, 3]); assert.equal(r.uyarilar.length, 1);
  const cok = []; for (let i = 0; i < 10; i++) cok.push({ t: 2 + i * 2, tur: "tik" });
  assert.equal(E.dogrula(cok, 60).olaylar.length, E.SINIR.dakikadaEnCok);
});

test("ses-efekt.olustur: tik ve din uretilir, tepe sinirli, WAV 48 kHz stereo, sure dogru", () => {
  const dosya = path.join(TMP, "efekt.wav");
  const r = E.olustur([{ t: 1, tur: "tik" }, { t: 4, tur: "din" }], 8, dosya);
  const b = fs.readFileSync(dosya);
  assert.equal(b.toString("ascii", 0, 4), "RIFF"); assert.equal(b.readUInt32LE(24), 48000); assert.equal(b.readUInt16LE(22), 2);
  assert.equal((b.length - 44) / 4, 8 * 48000);
  let tepe = 0; for (let i = 44; i < b.length; i += 2) tepe = Math.max(tepe, Math.abs(b.readInt16LE(i)) / 32767);
  assert.ok(tepe > 0.2 && tepe <= 0.55, "tepe " + tepe);
  assert.equal(r.olaylar.length, 2);
});

test("konu.json: sesEfektleri dogrulanir (whoosh reddedilir, tik/din kabul)", () => {
  const kotu = ortak.konuDogrula({ sesEfektleri: [{ t: 1, tur: "whoosh" }] });
  assert.equal(kotu.gecerli, false); assert.equal(kotu.hatalar[0].alan, "sesEfektleri");
  assert.equal(ortak.konuDogrula({ sesEfektleri: [{ t: 2, tur: "din" }] }).hatalar.filter(h => h.alan === "sesEfektleri").length, 0);
});

function sentetik(dosya) {   // "konusma" (modüle sinus) + 3 sert gurultu patlamasi
  const r = spawnSync(FF, ["-v", "error", "-y", "-f", "lavfi", "-i", "sine=f=220:d=20", "-f", "lavfi", "-i", "anoisesrc=d=20:c=white:a=0.9", "-filter_complex",
    "[0]volume='0.22*(0.7+0.3*sin(2*PI*3.5*t))':eval=frame[k];[1]volume='if(between(t,4,4.6)+between(t,9,9.7)+between(t,14,14.5),0.35,0)':eval=frame[e];[k][e]amix=inputs=2:duration=first:normalize=0", "-ar", "48000", dosya], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
}
test("analiz + duzelt (gercek ffmpeg): patlamalar bulunur, duzeltme -14 LUFS'a hizalar ve patlamalari bitirir", atla, () => {
  const g = path.join(TMP, "patlamali.wav"); sentetik(g);
  const once = D.analiz(g);
  assert.ok(once.tepeler.length >= 3, JSON.stringify(once.tepeler)); assert.equal(once.dengeli, false);
  const r = D.duzelt(g, path.join(TMP, "dengeli.wav"));
  assert.ok(Math.abs(r.sonra.I - D.HEDEF.I) <= 1, "I=" + r.sonra.I);
  assert.ok(r.sonra.TP <= D.HEDEF.TP + 0.2, "TP=" + r.sonra.TP);
  assert.equal(r.sonra.tepeler.length, 0, JSON.stringify(r.sonra.tepeler));
  assert.ok(r.sonra.LRA < once.LRA, `LRA ${once.LRA} -> ${r.sonra.LRA}`);
});

test("komut satiri: kullanim 2, bilinmeyen komut 2", () => {
  const { main } = require("../araclar/ses-denge.js");
  const l = console.log, e = console.error; console.log = () => {}; console.error = () => {};
  try { assert.equal(main([]), 2); assert.equal(main(["yok", "x"]), 2); } finally { console.log = l; console.error = e; }
});
