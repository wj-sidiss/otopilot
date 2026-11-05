// Panel / Stüdyo lens profili uçları: durum, arama, kaydetme + doğrulama, kaldırma. Sahte küçük Lensfun veritabanı; ağa ve gerçek veritabanına dokunmaz.
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const Y = require("./panel-yardim");

let ortam, panel, c, dbDizin;
const XML = `<lensdatabase version="1">
  <lens><maker>Test &amp; Co</maker><model>Test 35mm f/2</model><mount>TestMount</mount><cropfactor>1</cropfactor>
    <calibration><distortion model="ptlens" focal="35" a="0.01" b="-0.02" c="0.0"/></calibration></lens>
  <camera><maker>Test</maker><model>Cam One</model><mount>TestMount</mount><cropfactor>1</cropfactor></camera>
</lensdatabase>`;

test.before(async () => {
  ortam = Y.geciciOrtam("lenspanel");
  dbDizin = path.join(ortam.kok, "lensdb");
  fs.mkdirSync(dbDizin, { recursive: true });
  fs.writeFileSync(path.join(dbDizin, "test.xml"), XML);
  panel = await Y.panelBaslat(ortam, { env: { LENSFUN_DB: dbDizin } });
  c = panel.istemci;
  assert.equal((await c.post("/api/studyo/yeni", { ad: "lensli", stil: "serbest" })).durum, 200);
});
test.after(async () => { if (panel) await panel.kapat(); if (ortam) ortam.temizle(); });

test("detay: lens durumu ve bos profil", async () => {
  const r = (await c.get("/api/studyo/detay?ad=lensli")).json;
  assert.deepEqual(r.lens, { hazir: true, kameralar: 1, lensler: 1 });
  assert.equal(r.ayar.lensProfili, null);
});

test("lens-ara: kamera ve lens, kisa sorgu bos doner", async () => {
  const k = (await c.get("/api/studyo/lens-ara?tur=kamera&q=cam")).json;
  assert.equal(k.sonuclar[0].model, "Cam One");
  const l = (await c.get("/api/studyo/lens-ara?tur=lens&q=test%20co")).json;
  assert.equal(l.sonuclar[0].maker, "Test & Co");
  assert.deepEqual((await c.get("/api/studyo/lens-ara?tur=lens&q=a")).json.sonuclar, []);
  assert.deepEqual((await c.get("/api/studyo/lens-ara?tur=kamera&q=yokboyle")).json.sonuclar, []);
});

test("kaydet: gecerli profil yazilir, gecersiz reddedilir ve eski dosya bozulmaz, null kaldirir", async () => {
  const r = await c.post("/api/studyo/kaydet", { ad: "lensli", lensProfili: { kamera: "Cam One", lens: "Test 35mm f/2", odak: 35, diyafram: 2, yon: "duzelt" } });
  assert.equal(r.durum, 200, r.metin);
  let d = (await c.get("/api/studyo/detay?ad=lensli")).json;
  assert.deepEqual(d.ayar.lensProfili, { kamera: "Cam One", lens: "Test 35mm f/2", odak: 35, diyafram: 2, yon: "duzelt" });

  assert.equal((await c.post("/api/studyo/kaydet", { ad: "lensli", lensProfili: { kamera: "Yok", lens: "Yok" } })).durum, 400);
  assert.equal((await c.post("/api/studyo/kaydet", { ad: "lensli", lensProfili: { kamera: "Cam One" } })).durum, 400);
  assert.equal((await c.post("/api/studyo/kaydet", { ad: "lensli", lensProfili: { kamera: "Cam One", lens: "Test 35mm f/2", odak: -5 } })).durum, 400);
  d = (await c.get("/api/studyo/detay?ad=lensli")).json;
  assert.equal(d.ayar.lensProfili.kamera, "Cam One");                     // reddedilen kayit eskisini bozmadi

  assert.equal((await c.post("/api/studyo/kaydet", { ad: "lensli", lensProfili: null })).durum, 200);
  d = (await c.get("/api/studyo/detay?ad=lensli")).json;
  assert.equal(d.ayar.lensProfili, null);
});

test("lens veritabani yokken durum hazir=false, arama bos", async () => {
  const o2 = Y.geciciOrtam("lensyok");
  const p2 = await Y.panelBaslat(o2, { env: { LENSFUN_DB: path.join(o2.kok, "yok-db") } });
  try {
    await p2.istemci.post("/api/studyo/yeni", { ad: "x1", stil: "serbest" });
    const r = (await p2.istemci.get("/api/studyo/detay?ad=x1")).json;
    assert.deepEqual(r.lens, { hazir: false, kameralar: 0, lensler: 0 });
    assert.deepEqual((await p2.istemci.get("/api/studyo/lens-ara?tur=kamera&q=canon")).json.sonuclar, []);
  } finally { await p2.kapat(); o2.temizle(); }
});
