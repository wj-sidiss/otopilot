// Kurulum doktoru: adres listesi, cikis kodlari ve Codex rehberi baglantilari (gercek aga dokunmaz).
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const D = require("../araclar/doktor.js");
const KOK = path.join(__dirname, "..");

test("ADRESLER: zorunlu ses ve gorsel adresleri var, hepsi gecerli ana bilgisayar adi", () => {
  const hostlar = D.ADRESLER.map(a => a.host);
  assert.ok(hostlar.includes("speech.platform.bing.com") && hostlar.includes("commons.wikimedia.org"));
  assert.ok(D.ADRESLER.filter(a => a.zorunlu).length >= 2);
  for (const a of D.ADRESLER) { assert.match(a.host, /^[a-z0-9.-]+\.[a-z]{2,}$/); assert.ok(a.yol.startsWith("/")); }
  assert.equal(new Set(hostlar).size, hostlar.length, "tekrar eden adres");
});

test("adresDene: ulasilamayan adres hata nedeniyle doner, cokmez", async () => {
  const r = await D.adresDene({ host: "bu-adres-yok.invalid", yol: "/" }, 3000);
  assert.equal(r.ok, false); assert.ok(r.neden);
});

test("belgeler: docs/CODEX.md var, README ve AGENTS ona baglanir, sohbet != ajan aciklamasi yazili", () => {
  const codex = fs.readFileSync(path.join(KOK, "docs", "CODEX.md"), "utf8");
  assert.match(codex, /Sıradan bir \*\*sohbet penceresi\*\*/); assert.match(codex, /doktor\.js/);
  assert.match(fs.readFileSync(path.join(KOK, "README.md"), "utf8"), /docs\/CODEX\.md/);
  assert.match(fs.readFileSync(path.join(KOK, "AGENTS.md"), "utf8"), /node araclar\/doktor\.js/);
  const pk = require("../package.json"); assert.equal(pk.scripts.doktor, "node araclar/doktor.js");
});

test("Codex izin listesi rehberdeki adreslerle tutarli: rehberde gecen her alan adi doktorun listesinde", () => {
  const codex = fs.readFileSync(path.join(KOK, "docs", "CODEX.md"), "utf8");
  const hostlar = new Set(D.ADRESLER.map(a => a.host));
  for (const h of ["speech.platform.bing.com", "commons.wikimedia.org", "upload.wikimedia.org", "api.openverse.org", "images-api.nasa.gov"]) { assert.ok(codex.includes(h), "rehberde yok: " + h); assert.ok(hostlar.has(h), "listede yok: " + h); }
});
