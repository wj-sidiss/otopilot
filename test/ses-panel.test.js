// test/ses-panel.test.js — panelin ses testi ucu (POST /api/ses-testi): motor listesi konu.json/CLI ile ayni (ortak.SES_MOTORLARI);
// 'sistem' motoru reddedilmez ve seslendir.js'e aynen gecer. Gercek panel sureci, sahte betik klasoru (ag yok).
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const Y = require("./panel-yardim");
const ortak = require("../lib/ortak.js");

let ortam, panel, c;
test.before(async () => {
  ortam = Y.geciciOrtam("ses-panel");
  panel = await Y.panelBaslat(ortam);
  c = panel.istemci;
});
test.after(async () => {
  if (panel) await panel.kapat();
  if (ortam) ortam.temizle();
  try { fs.rmSync(path.join(os.tmpdir(), "otomasyon-sestesti"), { recursive: true, force: true }); } catch (e) { /* gecici ornekler */ }
});

test("/api/ses-testi: bilinmeyen motor 400 ve mesaj TUM gecerli motorlari (sistem dahil) sayar", async () => {
  assert.ok(ortak.SES_MOTORLARI.includes("sistem"));
  const r = await c.post("/api/ses-testi", { motor: "gtts" });
  assert.equal(r.durum, 400);
  for (const m of ortak.SES_MOTORLARI) assert.ok(r.json.hata.includes(m), m + " mesajda yok: " + r.json.hata);
  assert.equal((await c.post("/api/ses-testi", { motor: ["edge"] })).durum, 400, "dizi motor kabul edilmez");
});

test("/api/ses-testi: 'sistem' (ve voxcpm) motoru kabul edilir, seslendir.js'e --motor ile gecer", async () => {
  const yol = path.join(ortam.betik, "seslendir.js");
  const eski = fs.readFileSync(yol);
  fs.writeFileSync(yol, [
    "const fs=require('fs');const a=process.argv;const i=a.indexOf('--test');",
    "if(i<0){process.exit(0)}",
    "fs.writeFileSync(a[i+1],'MP3VERISI');",
    "console.log('@@SONUC '+JSON.stringify({dosya:a[i+1],sureSn:2.5,motor:a[a.indexOf('--motor')+1]}));",
  ].join("\n"));
  try {
    for (const motor of ["sistem", "voxcpm"]) {
      const r = await c.post("/api/ses-testi", { motor, ses: "tr-TR-AhmetNeural", dil: "tr" });
      assert.equal(r.durum, 200, motor + ": " + r.metin);
      assert.equal(r.json.motor, motor);
    }
  } finally { fs.writeFileSync(yol, eski); }
});
