// GO — komut satiri: argumanlar, cikis kodlari (sozlesme 7.1), stderr bicimi (✗ ozet, ↳ cozum, @@HATA), eski cagrilar.
// Gercek aga CIKMAZ: yalniz girdi hatalari ve "tum kaynaklar kapali" yolu denenir.
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const yardim = require("./gorsel-yardim.js");

test.after(() => yardim.temizle());
const KOK = yardim.KOK;

function calistir(betik, args, ek) {
  const r = spawnSync(process.execPath, [path.join(KOK, betik)].concat(args || []), { encoding: "utf8", timeout: 60000, env: Object.assign({}, process.env, ek || {}) });
  return { kod: r.status, out: r.stdout || "", err: r.stderr || "" };
}

test("gorsel-bul: arguman yok / is yok / hatali bayrak -> exit 2, Turkce '✗' satiri", () => {
  let r = calistir("gorsel-bul.js", []);
  assert.equal(r.kod, 2); assert.match(r.err, /✗ Kullanım: node gorsel-bul\.js/);
  r = calistir("gorsel-bul.js", ["olmayan-is"]);
  assert.equal(r.kod, 2); assert.match(r.err, /✗ İş bulunamadı: olmayan-is/); assert.match(r.err, /↳ /); assert.match(r.err, /@@HATA \{/);
  yardim.isKur("cli-is", { senaryo: yardim.senaryoUret(2, 30), konu: { format: "long" } });
  r = calistir("gorsel-bul.js", ["cli-is", "--ara", "x"]);
  assert.equal(r.kod, 2); assert.match(r.err, /--sahne/);
  r = calistir("gorsel-bul.js", ["cli-is", "--sahne", "abc"]);
  assert.equal(r.kod, 2); assert.match(r.err, /sahne numarası/);
  r = calistir("gorsel-bul.js", ["cli-is", "--sahne", "1", "--ara"]);
  assert.equal(r.kod, 2);
  r = calistir("gorsel-bul.js", ["cli-is", "--limit-bekle", "-5"]);
  assert.equal(r.kod, 2);
  r = calistir("gorsel-bul.js", ["../kacis"]);
  assert.equal(r.kod, 2, "yol gecisi (..) reddedilmeli");
});

test("gorsel-bul: senaryo yok -> exit 2; bozuk konu.json -> exit 2 ve satir/sutun; tum kaynaklar ayardan kapaliysa exit 2 (aga cikmadan)", () => {
  yardim.isKur("cli-sensiz", { konu: { format: "long" } });
  let r = calistir("gorsel-bul.js", ["cli-sensiz"]);
  assert.equal(r.kod, 2); assert.match(r.err, /Senaryo yok/);

  yardim.isKur("cli-bozuk", { senaryo: yardim.senaryoUret(2, 30), konu: '{"format": "long",\n  "dil": }' });
  r = calistir("gorsel-bul.js", ["cli-bozuk"]);
  assert.equal(r.kod, 2); assert.match(r.err, /konu\.json bozuk \(satır 2/);

  const ayar = path.join(yardim.KOKTEST, "ayar-kapali.json");
  fs.writeFileSync(ayar, JSON.stringify({ surum: 1, kaynaklar: { nasa: false, wikimedia: false, openverse: false, pexels: false, pixabay: false, met: false, aic: false, cleveland: false } }));
  yardim.isKur("cli-kapali", { senaryo: yardim.senaryoUret(2, 30), konu: { format: "long" } });
  r = calistir("gorsel-bul.js", ["cli-kapali"], { OTOMASYON_AYAR_DOSYASI: ayar });
  assert.equal(r.kod, 2); assert.match(r.err, /Hiçbir görsel kaynağı açık değil/);
  assert.ok(!fs.existsSync(path.join(process.env.OTOMASYON_URETIM, "cli-kapali", ".kilit")), "kilit serbest birakilmali");
});

test("diger betikler: argumansiz -> exit 2 (eski varsayilan is adlari kalkti)", () => {
  for (const [betik, ipucu] of [["gorsel-cek.js", /Kullanım: node gorsel-cek\.js/], ["portre-cek.js", /Kullanım: node portre-cek\.js/], ["gorsel-uret.js", /Kullanım: node gorsel-uret\.js/]]) {
    const r = calistir(betik, []);
    assert.equal(r.kod, 2, betik + " exit " + r.kod + " " + r.err); assert.match(r.err, ipucu);
  }
  let r = calistir("gorsel-cek.js", ["cli-is", "abc"]);
  assert.equal(r.kod, 2);
  r = calistir("vs-kur.js", ["hic-yok-boyle-is"]);
  assert.equal(r.kod, 2); assert.match(r.err, /VS tanımı bulunamadı/);
  r = calistir("vs-gorsel-duzelt.js", ["hic-yok-boyle-is"]);
  assert.equal(r.kod, 2); assert.match(r.err, /VS tanımı bulunamadı/);
  r = calistir("vs-gorsel-duzelt.js", ["x", "--taraf", "orta"]);
  assert.equal(r.kod, 2);
  r = calistir("gorsel-uret.js", ["cli-is"]);
  assert.equal(r.kod, 2); assert.match(r.err, /sahneKelimeleri/);
});

test("gorsel-uret --istem: bos istem ve gecersiz boyut exit 2 (aga cikmadan)", () => {
  let r = calistir("gorsel-uret.js", ["--istem"]);
  assert.equal(r.kod, 2);
  r = calistir("gorsel-uret.js", ["--istem", "bir kedi", "--en", "99999"]);
  assert.equal(r.kod, 2); assert.match(r.err, /2048/);
});

test("betikler import edilebilir: saf fonksiyonlar module.exports, ana akis require.main korumali", () => {
  const bul = require("../gorsel-bul.js");
  for (const f of ["calistir", "kelimeler", "ozelIsimler", "genelCapa", "ifadeCikar", "kozmikMi", "sahnePlan"]) assert.equal(typeof bul[f], "function", f);
  assert.equal(typeof require("../gorsel-uret.js").uretBir, "function");
  assert.equal(typeof require("../gorsel-cek.js").calistir, "function");
  assert.equal(typeof require("../portre-cek.js").calistir, "function");
  assert.equal(typeof require("../vs-kur.js").calistir, "function");
  assert.equal(typeof require("../vs-gorsel-duzelt.js").calistir, "function");
});
