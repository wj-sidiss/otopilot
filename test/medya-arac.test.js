// Ucretsiz medya araclari: sessizlik kesme, sahne bulma, yukseltme (ffmpeg ile gercek sentetik medya; ffmpeg yoksa atlanir).
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const M = require("../lib/medya-arac");

let FF = null, FP = null;
try { const f = require("../ff-yol"); FF = f.ffmpeg; FP = f.ffprobe; } catch { /* ffmpeg yok: gercek ffmpeg testleri atlanir */ }
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "medya-"));
test.after(() => fs.rmSync(TMP, { recursive: true, force: true }));
const atla = { skip: FF ? false : "ffmpeg yok" };
const sure = (d) => parseFloat(spawnSync(FP, ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", d], { encoding: "utf8" }).stdout);
const uret = (args) => { const r = spawnSync(FF, ["-v", "error", "-y", ...args], { encoding: "utf8" }); assert.equal(r.status, 0, r.stderr); };

test("sessizlikleriOku: baslangic/bitis ciftleri ve sessizlikle biten dosya", () => {
  const m = "[silencedetect] silence_start: 1.5\n[silencedetect] silence_end: 3.25 | silence_duration: 1.75\n[silencedetect] silence_start: 9.1";
  assert.deepEqual(M.sessizlikleriOku(m), [[1.5, 3.25], [9.1, Infinity]]);
  assert.deepEqual(M.sessizlikleriOku("hicbir sey"), []);
});

test("tutulanParcalar: sessizlik 'pay' kadar daraltilir, parcalar dogru kalir", () => {
  const t = M.tutulanParcalar([[2, 4]], 10, 0.1);                // 2.1-3.9 kesilir
  assert.equal(t.length, 2);
  assert.ok(Math.abs(t[0][1] - 2.1) < 1e-9 && Math.abs(t[1][0] - 3.9) < 1e-9 && t[1][1] === 10);
  assert.deepEqual(M.tutulanParcalar([], 10, 0.1), [[0, 10]]);
  assert.deepEqual(M.tutulanParcalar([[0, 3]], 10, 0.1), [[0, 0.1], [2.9, 10]]);   // bastaki sessizlik: 'pay' kadari korunur
  assert.deepEqual(M.tutulanParcalar([[8, Infinity]], 10, 0.1), [[0, 8.1], [9.9, 10]]);   // sondaki sessizlik: 'pay' kadari korunur
  assert.deepEqual(M.tutulanParcalar([[2, 2.15]], 10, 0.1), [[0, 10]]);          // pay'dan kisa bosluk kesilmez
});

test("filtreBetigi: video+ses ve yalniz ses icin concat dogru kurulur", () => {
  const vs = M.filtreBetigi([[0, 1], [2, 3]], true, true);
  assert.match(vs, /\[0:v\]trim=start=0\.000:end=1\.000/); assert.match(vs, /concat=n=2:v=1:a=1\[vo\]\[ao\]/);
  const s = M.filtreBetigi([[0, 1]], false, true);
  assert.match(s, /concat=n=1:v=0:a=1\[ao\]/); assert.doesNotMatch(s, /\[0:v\]/);
});

test("sahneZamanlariniOku + sahneParcalari: yakin kesimler ve kisa sahneler birlestirilir", () => {
  assert.deepEqual(M.sahneZamanlariniOku("x pts_time:4.5 y\n pts_time:2.0 z"), [2, 4.5]);
  const p = M.sahneParcalari([2, 2.3, 5], 8, 1);
  assert.deepEqual(p.map(s => [s.bas, s.son]), [[0, 2], [2, 5], [5, 8]]);
  assert.deepEqual(M.sahneParcalari([0.4, 7.8], 8, 1).map(s => [s.bas, s.son]), [[0, 8]]);     // basa/sona yakin kesim yok sayilir
});

test("sessizlikKes: gercek ses; 1 sn ses + 1 sn sessizlik x3 -> sessizlik kesilir, sure kisalir", atla, () => {
  const g = path.join(TMP, "konusma.wav");
  uret(["-f", "lavfi", "-i", "sine=f=440:d=6", "-af", "volume='if(lt(mod(t,2),1),0.8,0)':eval=frame", g]);
  const rapor = M.sessizlikKes(g, { sadeceRapor: true });
  assert.ok(rapor.sessizlik >= 2, JSON.stringify(rapor));
  assert.ok(rapor.sonra < rapor.once - 1.5, JSON.stringify(rapor));
  const c = M.sessizlikKes(g, { cikti: path.join(TMP, "kesik.wav") });
  assert.ok(fs.existsSync(c.cikti)); assert.ok(sure(c.cikti) < 5.0 && sure(c.cikti) > 2.5);
});

test("sessizlikKes: sessiz dosya ve olmayan dosya acik hata verir", atla, () => {
  const v = path.join(TMP, "sessiz.mp4");
  uret(["-f", "lavfi", "-i", "color=c=black:s=64x64:d=1", "-an", "-pix_fmt", "yuv420p", v]);
  assert.throws(() => M.sessizlikKes(v), /ses yok/i);
  assert.throws(() => M.sessizlikKes(path.join(TMP, "yok.mp4")), /Dosya yok/);
});

test("sahneBul: kirmizi-mavi-yesil 2'ser sn -> 3 sahne; --kes klipleri yazar", atla, () => {
  const v = path.join(TMP, "uc.mp4");
  uret(["-f", "lavfi", "-i", "color=c=red:s=160x90:d=2:r=25", "-f", "lavfi", "-i", "color=c=blue:s=160x90:d=2:r=25", "-f", "lavfi", "-i", "color=c=lime:s=160x90:d=2:r=25",
    "-filter_complex", "[0][1][2]concat=n=3:v=1:a=0", "-pix_fmt", "yuv420p", v]);
  const r = M.sahneBul(v, { kes: path.join(TMP, "klipler") });
  assert.equal(r.sahneler.length, 3, JSON.stringify(r.sahneler));
  assert.ok(Math.abs(r.sahneler[1].bas - 2) < 0.2 && Math.abs(r.sahneler[2].bas - 4) < 0.2);
  for (const s of r.sahneler) { assert.ok(fs.existsSync(s.dosya)); assert.ok(Math.abs(sure(s.dosya) - 2) < 0.25); }
});

test("yukselt: resim 2x ve 4x; gecersiz olcek reddedilir", atla, () => {
  const r = path.join(TMP, "kucuk.png");
  uret(["-f", "lavfi", "-i", "testsrc=s=64x48:d=1", "-frames:v", "1", r]);
  const o = M.yukselt(r, { olcek: 2 });
  assert.equal(o.yontem, "lanczos");
  const bil = spawnSync(FP, ["-v", "error", "-show_entries", "stream=width,height", "-of", "csv=p=0", o.cikti], { encoding: "utf8" }).stdout.trim();
  assert.equal(bil, "128,96");
  assert.throws(() => M.yukselt(r, { olcek: 5 }), /Ölçek/);
});

test("komut satiri: kullanim 2 ile cikar, bilinmeyen komut 2", () => {
  const { main } = require("../araclar/medya.js");
  const eski = console.log; console.log = () => {}; const e2 = console.error; console.error = () => {};
  try { assert.equal(main([]), 2); assert.equal(main(["yok", "x"]), 2); } finally { console.log = eski; console.error = e2; }
});
