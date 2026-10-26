// film.js: iskelet, dogrulama, klip istemi dosyasi, srt zamani. Ses/ffmpeg gerektirmeyen kisimlar (ag ve krediye dokunmaz).
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const kok = fs.mkdtempSync(path.join(os.tmpdir(), "film-test-"));
process.env.OTOMASYON_URETIM = kok;
const film = require("../film.js");

test("srtZaman: saat:dakika:saniye,milisaniye", () => {
  assert.equal(film.srtZaman(0), "00:00:00,000");
  assert.equal(film.srtZaman(3.432), "00:00:03,432");
  assert.equal(film.srtZaman(3725.5), "01:02:05,500");
});

test("yeni: iskelet olusur, ikinci kez ayni ada izin vermez; bibliya ve bolum dogrulanir", () => {
  const log = console.log; console.log = () => {};
  try { film.yeni("d1", { ad: "Dizi", dil: "tr" }); } finally { console.log = log; }
  const dizin = path.join(kok, "d1");
  assert.ok(fs.existsSync(path.join(dizin, "bibliya.json")) && fs.existsSync(path.join(dizin, "bolum-001.json")));
  assert.throws(() => film.yeni("d1", {}), /zaten var/);
  const bib = film.bibliyaOku("d1");
  assert.deepEqual(Object.keys(bib.karakterler), ["ayse", "mert"]);
  const bol = film.bolumOku("d1", 1, bib);
  assert.equal(bol.sahneler.length, 2);
});

test("bolumOku: bilinmeyen karakter, bos diyalog ve aksiyonsuz sahne acik hatayla reddedilir", () => {
  const dizin = path.join(kok, "d1");
  const bib = film.bibliyaOku("d1");
  const yaz = s => fs.writeFileSync(path.join(dizin, "bolum-002.json"), JSON.stringify({ sahneler: s }));
  yaz([{ aksiyon: "x", diyalog: [{ karakter: "yok", metin: "merhaba" }] }]);
  assert.throws(() => film.bolumOku("d1", 2, bib), /bilinmeyen karakter 'yok'/);
  yaz([{ aksiyon: "x", diyalog: [{ karakter: "ayse", metin: "  " }] }]);
  assert.throws(() => film.bolumOku("d1", 2, bib), /boş diyalog/);
  yaz([{ diyalog: [] }]);
  assert.throws(() => film.bolumOku("d1", 2, bib), /aksiyon/);
  fs.writeFileSync(path.join(dizin, "bolum-002.json"), "{bozuk");
  assert.throws(() => film.bolumOku("d1", 2, bib), /JSON okunamadı/);
});

test("klipler: Voice/KLIPLER.txt her sahne icin karakter gorunumu + uslup + sure icerir (vidiq-klip girdisi)", () => {
  const log = console.log; console.log = () => {};
  try { film.klipler("d1", 1); } finally { console.log = log; }
  const t = fs.readFileSync(path.join(kok, film.isAdi("d1", 1), "Voice", "KLIPLER.txt"), "utf8");
  const satirlar = t.split("\n").filter(s => s && !s.startsWith("#"));
  assert.equal(satirlar.length, 2);
  assert.match(satirlar[0], /trençkot/); assert.match(satirlar[0], /lacivert palto/);      // sahne 1'de iki karakter de konusuyor
  assert.match(satirlar[0], / \| 6$/);
  const K = require("../lib/vidiq-klip.js");
  assert.deepEqual(K.klipListesi(t, 5).map(k => k.sure), [6, 5]);
});

test("kur: ses uretilmeden acik yonlendirme verir", () => {
  assert.throws(() => film.kur("d1", 1, {}), /Önce sesleri üret/);
});
