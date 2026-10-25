// Arayuz dili (15 dil): kaynak cikarma, ceviri dogrulama, dagitim ve uc uygulamanin ayni dil.js'i kullanmasi.
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { cikarDizin, DILLER } = require("../lib/dil-cikar.js");
const { gecerliMi, korunacaklar } = require("../lib/dil-yay.js");

const KOK = path.join(__dirname, "..");
const UYGULAMALAR = ["panel-public", "video-indirici/public", "ai-infapp/public"];

test("dil.js uc uygulamada BIREBIR ayni; her sayfa dil.js'i yukler", () => {
  const ana = fs.readFileSync(path.join(KOK, "panel-public", "dil.js"), "utf8");
  for (const d of UYGULAMALAR) assert.equal(fs.readFileSync(path.join(KOK, d, "dil.js"), "utf8"), ana, d + "/dil.js farkli");
  for (const h of ["panel-public/panel.html", "video-indirici/public/index.html", "ai-infapp/public/index.html"])
    assert.match(fs.readFileSync(path.join(KOK, h), "utf8"), /<script src="\/dil\.js"/, h + " dil.js'i yuklemiyor");
});

test("15 dil: tr kaynak, 14 hedef dil ve dagitilan sozluk dosyalari gecerli JS", () => {
  assert.equal(DILLER.length, 14);
  for (const d of UYGULAMALAR) for (const kod of DILLER) {
    const dosya = path.join(KOK, d, "diller", kod + ".js");
    assert.ok(fs.existsSync(dosya), dosya + " yok (npm run dil:yay)");
    const pencere = { __OTOPILOT_DIL: {} };
    vm.runInNewContext(fs.readFileSync(dosya, "utf8"), { window: pencere });
    assert.equal(typeof pencere.__OTOPILOT_DIL[kod], "object");
  }
});

test("her dilde her uygulamanin metinlerinin >= %80'i cevrilmis (kalan: ceviri gerekmeyen/adlar)", () => {
  for (const d of UYGULAMALAR) {
    const kaynak = cikarDizin(d);
    for (const kod of DILLER) {
      const pencere = { __OTOPILOT_DIL: {} };
      vm.runInNewContext(fs.readFileSync(path.join(KOK, d, "diller", kod + ".js"), "utf8"), { window: pencere });
      const t = pencere.__OTOPILOT_DIL[kod];
      const oran = Object.keys(t).length / kaynak.length;
      assert.ok(oran >= 0.8, d + " " + kod + " ceviri orani " + Math.round(oran * 100) + "%");
    }
  }
});

test("gecerliMi: bos, yer tutucu kaybi ve cok uzun ceviri reddedilir; dogru ceviri kabul", () => {
  assert.equal(gecerliMi("Kaydet", "Save"), "");
  assert.match(gecerliMi("Kaydet", "  "), /bos/);
  assert.equal(gecerliMi("«Sil»e bas", "Press “Delete”"), "", "tirnak ici ad cevrilir, tirnak biçimi dile gore degisir");
  assert.match(gecerliMi("<span class=\"mono\">x</span> yaz", "write x"), /kayip/);
  assert.match(gecerliMi("PEXELS_KEY gir", "Enter the key"), /kayip/);
  assert.match(gecerliMi("Tamam", "x".repeat(200)), /uzun/);
  assert.deepEqual(korunacaklar("`.env` içine PEXELS_KEY yaz"), ["`.env`", "PEXELS_KEY"]);
});

test("dil.js tarayici kodu: sozluk esleme, yer tutucu, bosluk koruma (sahte DOM ile)", () => {
  // cevir() = window.otopilotCevir: metni degistirmeden kalan boslugu korur; sozluk yoksa metni aynen dondurur
  const dugumler = [];
  const sahteBelge = {
    readyState: "complete", documentElement: { setAttribute() {}, hasAttribute() { return false; }, nodeType: 1, nodeName: "HTML", firstChild: null },
    createElement: () => ({ style: {}, appendChild() {}, setAttribute() {}, addEventListener() {} }), getElementById: () => null, body: null, head: { appendChild: e => dugumler.push(e) }, title: "",
  };
  const pencere = { localStorage: { getItem: () => "en", setItem() {} }, __OTOPILOT_DIL: { en: { Kaydet: "Save" } } };
  pencere.window = pencere;
  vm.runInNewContext(fs.readFileSync(path.join(KOK, "panel-public", "dil.js"), "utf8"), { window: pencere, document: sahteBelge, navigator: { language: "en-US" }, WeakMap, Object, Array, String, Math });
  assert.equal(pencere.otopilotCevir("  Kaydet \n"), "  Save \n");
  assert.equal(pencere.otopilotCevir("Bilinmeyen"), "Bilinmeyen");
  assert.equal(pencere.otopilotDil.diller.length, 15);
  assert.equal(pencere.otopilotDil.secili(), "en");
});
