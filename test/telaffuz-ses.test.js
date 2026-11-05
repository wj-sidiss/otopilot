// test/telaffuz-ses.test.js — telaffuz paketi seslendirme hattinda: okunus yalniz sese gider, altyazi kaynagi (senaryo)
// degismez, paket durumu okunusOzeti'ne girer (kapatinca ses yeniden uretilir). Edge sahte, ses sentetik (gercek ffmpeg).
"use strict";
const fs = require("fs");
const path = require("path");
const test = require("node:test");
const assert = require("node:assert/strict");
const S = require("./ses-sahte.js");

const ortam = S.ortamiYalitla();
const uretim = S.testUretimi();
const testF = S.ffmpegTesti(test);
const U = require("../lib/ses-uret.js");
const M = require("../lib/ses-metin.js");

test.after(() => { uretim.temizle(); ortam.temizle(); });

const PAR = ["Merhaba, bugün YouTube'da ChatGPT'yi anlatacağım.", "İkinci paragraf vidIQ hakkında."];
const gunluk = [];
const calistir = (dizin, ek, sahte) => U.seslendir(Object.assign({
  dizin, ses: "tr-TR-AhmetNeural", hiz: "+7%", dil: "tr", motorSecimi: "edge", okunus: {},
  env: () => "", enjekte: { msedge: sahte }, ayar: S.hizliAyar(), log: m => gunluk.push(m), uyari: () => {}, ilerleme: () => {},
}, ek || {}));

testF("Turkce: okunanMetin paketle hazirlanir, senaryo degismez; paket durumu ses guncelligini belirler", async () => {
  const dizin = S.isOlustur(uretim.taban, "telaffuz1", PAR);
  const txt = path.join(dizin, "Voice", "SESLENDIRME-TAM-METIN.txt");
  const once = fs.readFileSync(txt, "utf8");
  const r = await calistir(dizin, {}, S.sahteEdge());
  assert.equal(r.atlandi, false);
  const kel = JSON.parse(fs.readFileSync(path.join(dizin, "Voice", "kelimeler.json"), "utf8"));
  assert.equal(kel.paragraflar[0].okunanMetin, "Merhaba! Bugün Yutup'da Çet ci pi ti'yi anlatacağım.");
  assert.equal(kel.paragraflar[1].okunanMetin, "İkinci paragraf Vid Ay Kyu hakkında.");
  assert.equal(fs.readFileSync(txt, "utf8"), once, "senaryo (altyazi kaynagi) degismez");
  const zam = JSON.parse(fs.readFileSync(path.join(dizin, "Voice", "zamanlama.json"), "utf8"));
  assert.equal(zam.okunusOzeti, M.hazirlikOzeti({}, { dil: "tr" }));
  assert.ok(gunluk.some(m => /telaffuz paketi/.test(m)), "gunluk paketi soyler");

  assert.equal((await calistir(dizin, {}, S.sahteEdge())).atlandi, true, "ayni ayarla ses guncel");
  const kapali = await calistir(dizin, { telaffuzPaketi: false }, S.sahteEdge());
  assert.equal(kapali.atlandi, false, "paket kapatilinca ses yeniden uretilir");
  const kel2 = JSON.parse(fs.readFileSync(path.join(dizin, "Voice", "kelimeler.json"), "utf8"));
  assert.equal(kel2.paragraflar[0].okunanMetin, "Merhaba, bugün YouTube'da ChatGPT'yi anlatacağım.");
});

testF("Turkce: diksiyon riski gunluge tek satir yazilir, uyari sayilmaz ve isi durdurmaz", async () => {
  const dizin = S.isOlustur(uretim.taban, "telaffuz2", ["Workshop hala sürüyor."]);
  gunluk.length = 0;
  const r = await calistir(dizin, {}, S.sahteEdge());
  assert.equal(r.atlandi, false);
  assert.deepEqual(r.uyarilar.filter(u => /diksiyon/i.test(u)), []);
  assert.ok(gunluk.some(m => /^Diksiyon: 2 diksiyon riski .*node diksiyon\.js telaffuz2$/.test(m)), gunluk.join("\n"));
});
