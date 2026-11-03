// Yapay zeka kalip denetimi (10 dil): eslesme, joker, Turkce harf duyarsizligi, temiz metin, CLI cikis kodlari. Ag yok.
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const K = require("../lib/ai-kalip.js");
const CLI = require("../ai-kalip-kontrol.js");

test("veri: 10 dil, her birinde yasak kalip ve 11 kanca; kaynak ve lisans yazili", () => {
  const v = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "ai-kaliplari.json"), "utf8"));
  assert.deepEqual(Object.keys(v.diller).sort(), ["de", "en", "es", "fr", "hi", "ja", "ko", "pt-BR", "tr", "zh-CN"]);
  for (const d of Object.values(v.diller)) { assert.ok(d.yasak.length >= 10); assert.equal(d.kancalar.length, 11); }
  assert.match(v.kaynak, /motionforge/); assert.match(v.lisans, /MIT/);
});

test("dilKodu: pt/zh kisaltmalari ve bilinmeyen dil", () => {
  assert.equal(K.dilKodu("pt"), "pt-BR"); assert.equal(K.dilKodu("zh"), "zh-CN"); assert.equal(K.dilKodu("tr-TR"), "tr");
  assert.equal(K.dilKodu("xx"), "en"); assert.equal(K.dilKodu(""), "en");
});

test("Turkce: kalip, buyuk/kucuk harf (I/İ), joker ve satir numarasi", () => {
  const metin = "Bugün yeni bir araç çıktı.\nİnanılmaz bir sonuç aldık.\nPeki ya size bunu söylesem desem?\nAsıl olay şu: fiyat düştü.";
  const b = K.kalipBul(metin, "tr");
  const kalipler = b.map(x => x.kalip);
  assert.ok(kalipler.includes("İnanılmaz / Akıl almaz".split(" / ")[0]) || kalipler.some(k => /nanılmaz/i.test(k)));
  assert.ok(kalipler.includes("Asıl olay şu"));
  assert.ok(b.some(x => x.satir === 4));
  assert.ok(b.some(x => /Peki ya size/.test(x.kalip)));                                   // ... joker
  assert.equal(K.kalipBul("inanılmaz", "tr").length >= 1, true);                            // kucuk i de yakalanir
  assert.equal(K.kalipBul("Kamera sensörü 48 megapiksel ve fiyatı 300 dolar.", "tr").length, 0);
});

test("Ingilizce: X/Y joker, egri tirnak, temiz metin", () => {
  assert.ok(K.kalipBul("It's not just a tool, it's a revolution.", "en").some(x => /not just/.test(x.kalip)));
  assert.ok(K.kalipBul("Here’s the thing: it is fast.", "en").length >= 1);                 // ’ egri tirnak
  assert.ok(K.kalipBul("Let's dive in.", "en").length >= 1);
  assert.equal(K.kalipBul("The camera records 4K at 60 frames per second.", "en").length, 0);
  assert.ok(K.kancalar("tr").length === 11);
});

test("CLI: dosyada kalip varsa 1, temizse 0, girdi yoksa 2; kancalar listelenir", () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "kalip-"));
  const kirli = path.join(d, "a.txt"), temiz = path.join(d, "b.txt");
  fs.writeFileSync(kirli, "Oyun değişti. Kuralları baştan yazıyor.\n"); fs.writeFileSync(temiz, "Fiyat 20 dolar, pil 2 gün gidiyor.\n");
  const log = console.log, hata = console.error; console.log = () => {}; console.error = () => {};
  try {
    assert.equal(CLI.ana([kirli, "--dil", "tr"]), 1);
    assert.equal(CLI.ana([temiz, "--dil", "tr"]), 0);
    assert.equal(CLI.ana([]), 2);
    assert.equal(CLI.ana(["--kancalar", "en"]), 0);
  } finally { console.log = log; console.error = hata; }
});
