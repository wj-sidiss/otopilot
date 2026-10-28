// klip-yerlestir.js: AI klipleri KLIPLER.txt sirasiyla sahne klasorlerine koyar. Ag/kredi yok.
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const kok = fs.mkdtempSync(path.join(os.tmpdir(), "klip-yerlestir-"));
process.env.OTOMASYON_URETIM = kok;
const { yerlestir } = require("../klip-yerlestir.js");

function kur(ad, sahneSayisi, klipSayisi) {
  const dizin = path.join(kok, ad);
  fs.mkdirSync(path.join(dizin, "Voice"), { recursive: true });
  fs.mkdirSync(path.join(dizin, "Clips"), { recursive: true });
  const sahneler = [];
  for (let i = 1; i <= sahneSayisi; i++) { const k = "00" + i + "-sahne"; fs.mkdirSync(path.join(dizin, "Visuals", k), { recursive: true }); sahneler.push({ no: i, klasor: k, gorseller: [] }); }
  fs.writeFileSync(path.join(dizin, "Visuals", "manifest.json"), JSON.stringify({ sahneler }));
  const satirlar = [];
  for (let i = 1; i <= klipSayisi; i++) satirlar.push("istem " + i + " | 5");
  fs.writeFileSync(path.join(dizin, "Voice", "KLIPLER.txt"), satirlar.join("\n") + "\n");
  return dizin;
}
const klipYaz = (dizin, i, dosya) => {
  fs.writeFileSync(path.join(dizin, "Clips", dosya), "mp4-" + i);
  const yol = path.join(dizin, "Clips", "klipler.json");
  const k = fs.existsSync(yol) ? JSON.parse(fs.readFileSync(yol, "utf8")) : { klipler: [] };
  k.klipler.push({ istem: "istem " + i, sure: 5, model: "minimax-h3", dosya });
  fs.writeFileSync(yol, JSON.stringify(k));
};
const sessiz = { log: () => {} };

test("satir i -> sahne i; klibi olmayan sahne atlanir; tekrar calistirma guvenli", () => {
  const dizin = kur("a", 3, 3);
  klipYaz(dizin, 1, "001-minimax-h3.mp4"); klipYaz(dizin, 3, "002-minimax-h3.mp4");     // 2. klip henuz yok
  const r = yerlestir("a", sessiz);
  assert.deepEqual([r.yerlestirilen, r.eksik, r.atlanan], [2, 1, 0]);
  assert.equal(fs.readFileSync(path.join(dizin, "Visuals", "001-sahne", "00-ai-001-minimax-h3.mp4"), "utf8"), "mp4-1");
  assert.equal(fs.readFileSync(path.join(dizin, "Visuals", "003-sahne", "00-ai-002-minimax-h3.mp4"), "utf8"), "mp4-3");
  assert.deepEqual(fs.readdirSync(path.join(dizin, "Visuals", "002-sahne")), []);
  const r2 = yerlestir("a", sessiz);
  assert.deepEqual([r2.yerlestirilen, r2.atlanan, r2.eksik], [0, 2, 1]);
});

test("--yeniden eski AI klibin yerine yenisini koyar; sahne sayisi farkli olunca uyarir", () => {
  const dizin = kur("b", 2, 3);
  klipYaz(dizin, 1, "001-minimax-h3.mp4");
  assert.equal(yerlestir("b", sessiz).yerlestirilen, 1);
  fs.writeFileSync(path.join(dizin, "Clips", "009-yeni.mp4"), "yeni");
  const k = JSON.parse(fs.readFileSync(path.join(dizin, "Clips", "klipler.json"), "utf8"));
  k.klipler.push({ istem: "istem 1", sure: 5, model: "minimax-h3", dosya: "009-yeni.mp4" });      // yeni cekim
  fs.writeFileSync(path.join(dizin, "Clips", "klipler.json"), JSON.stringify(k));
  const r = yerlestir("b", { yeniden: true, log: () => {} });
  assert.equal(r.yerlestirilen, 1);
  assert.deepEqual(fs.readdirSync(path.join(dizin, "Visuals", "001-sahne")), ["00-ai-009-yeni.mp4"]);
  assert.match(r.uyarilar[0], /3 satır.*2 sahne/);
});

test("manifest ya da KLIPLER.txt yoksa acik hata", () => {
  fs.mkdirSync(path.join(kok, "bos"), { recursive: true });
  assert.throws(() => yerlestir("bos", sessiz), /manifest\.json yok/);
  const d = kur("c", 1, 1); fs.rmSync(path.join(d, "Voice", "KLIPLER.txt"));
  assert.throws(() => yerlestir("c", sessiz), /KLIPLER\.txt yok/);
});
