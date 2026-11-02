// Yerel yuz degistirme (FaceFusion sarmalayicisi): arguman kurulumu, cift icin ayri gecisler, cpu'ya dusme, hata mesajlari. FaceFusion'a DOKUNMAZ.
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const Y = require("../lib/yuz-degistir.js");

function sahteKok() {
  const k = fs.mkdtempSync(path.join(os.tmpdir(), "ff-kok-"));
  fs.writeFileSync(path.join(k, "facefusion.py"), "");
  for (const p of [path.join(k, ".venv", "Scripts"), path.join(k, ".venv", "bin")]) { fs.mkdirSync(p, { recursive: true }); fs.writeFileSync(path.join(p, "python.exe"), ""); fs.writeFileSync(path.join(p, "python"), ""); }
  return k;
}
const envOf = o => n => o[n] || "";
const log = { log: () => {} };

test("kokBul: eksik/yanlis yapilandirma acik hata verir", () => {
  assert.throws(() => Y.kokBul(envOf({})), /FACEFUSION_KOK tanımlı değil/);
  assert.throws(() => Y.kokBul(envOf({ FACEFUSION_KOK: path.join(os.tmpdir(), "yok-boyle-bir-klasor") })), /bulunamadı/);
  const k = sahteKok();
  assert.equal(Y.kokBul(envOf({ FACEFUSION_KOK: k })).kok, k);
  const bos = fs.mkdtempSync(path.join(os.tmpdir(), "ff-bos-")); fs.writeFileSync(path.join(bos, "facefusion.py"), "");
  assert.throws(() => Y.kokBul(envOf({ FACEFUSION_KOK: bos })), /\.venv/);
});

test("gecisArgumanlari: tek yuz 'one', cok yuz 'reference' + sira; soldan saga", () => {
  const tek = Y.gecisArgumanlari({ kaynak: "a.jpg", hedef: "p.jpg", cikti: "o.jpg", sira: 0, cokYuz: false, saglayici: "cuda" });
  assert.ok(tek.includes("headless-run") && tek.includes("face_swapper"));
  assert.equal(tek[tek.indexOf("--face-selector-mode") + 1], "one");
  assert.equal(tek[tek.indexOf("--face-selector-order") + 1], "left-right");
  const cift = Y.gecisArgumanlari({ kaynak: "b.jpg", hedef: "p.jpg", cikti: "o.jpg", sira: 1, cokYuz: true, saglayici: "cpu", model: "inswapper_128" });
  assert.equal(cift[cift.indexOf("--face-selector-mode") + 1], "reference");
  assert.equal(cift[cift.indexOf("--reference-face-position") + 1], "1");
  assert.equal(cift[cift.indexOf("--execution-providers") + 1], "cpu");
  assert.equal(cift[cift.indexOf("--face-swapper-model") + 1], "inswapper_128");
});

test("degistir: cift icin iki ayri gecis (sonuc bir sonrakinin hedefi), cikti yazilir", () => {
  const k = sahteKok(), d = fs.mkdtempSync(path.join(os.tmpdir(), "ff-is-"));
  const poz = path.join(d, "poz.jpg"), sol = path.join(d, "sol.jpg"), sag = path.join(d, "sag.jpg");
  for (const f of [poz, sol, sag]) fs.writeFileSync(f, "x");
  const cagrilar = [];
  const calistir = (py, argv, cwd) => { cagrilar.push({ py, argv, cwd }); fs.writeFileSync(argv[argv.indexOf("-o") + 1], "swap" + cagrilar.length); return { durum: 0 }; };
  const cikti = path.join(d, "out", "sonuc.jpg");
  assert.equal(Y.degistir({ sablon: poz, kisiler: [sol, sag], cikti }, Object.assign({ env: envOf({ FACEFUSION_KOK: k }), calistir }, log)), cikti);
  assert.equal(cagrilar.length, 2);
  assert.equal(cagrilar[0].argv[cagrilar[0].argv.indexOf("-t") + 1], poz);
  assert.equal(cagrilar[0].argv[cagrilar[0].argv.indexOf("-s") + 1], sol);
  assert.equal(cagrilar[1].argv[cagrilar[1].argv.indexOf("-s") + 1], sag);
  assert.ok(cagrilar[1].argv[cagrilar[1].argv.indexOf("-t") + 1].includes("gecis-1"));       // 2. gecis 1. gecisin ciktisini kullanir
  assert.equal(cagrilar[1].argv[cagrilar[1].argv.indexOf("--reference-face-position") + 1], "1");
  assert.equal(cagrilar[0].cwd, k);
  assert.equal(fs.readFileSync(cikti, "utf8"), "swap2");
  assert.ok(!fs.existsSync(cikti + ".part"));
});

test("degistir: cuda basarisizsa cpu ile bir kez daha dener; ikisi de basarisizsa acik hata", () => {
  const k = sahteKok(), d = fs.mkdtempSync(path.join(os.tmpdir(), "ff-is-"));
  const poz = path.join(d, "p.jpg"), kisi = path.join(d, "k.jpg"); fs.writeFileSync(poz, "x"); fs.writeFileSync(kisi, "x");
  const saglayicilar = [];
  const dene = durum => (py, argv) => { const s = argv[argv.indexOf("--execution-providers") + 1]; saglayicilar.push(s); const ok = durum(s); if (ok) fs.writeFileSync(argv[argv.indexOf("-o") + 1], "y"); return { durum: ok ? 0 : 1, hata: "no face detected" }; };
  Y.degistir({ sablon: poz, kisiler: [kisi], cikti: path.join(d, "o.jpg") }, Object.assign({ env: envOf({ FACEFUSION_KOK: k }), calistir: dene(s => s === "cpu") }, log));
  assert.deepEqual(saglayicilar, ["cuda", "cpu"]);
  assert.throws(() => Y.degistir({ sablon: poz, kisiler: [kisi], cikti: path.join(d, "o2.jpg") }, Object.assign({ env: envOf({ FACEFUSION_KOK: k }), calistir: dene(() => false) }, log)), /Yüz değiştirme başarısız/);
  assert.throws(() => Y.degistir({ sablon: poz, kisiler: [], cikti: "x.jpg" }, Object.assign({ env: envOf({ FACEFUSION_KOK: k }) }, log)), /En az bir kişi/);
});
