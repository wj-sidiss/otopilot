// GitHub duzeni: issue formlari (.github/ISSUE_TEMPLATE), PR sablonu ve 'npm run guncelle' kaydi.
// Sifir bagimlilik: YAML ayristirici yok; formlar blok blok metin olarak denetlenir (GitHub'in kurallari: tekil id/label,
// markdown ogesinde validations yok, sekme karakteri yok). Ag yok.
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const KOK = path.resolve(__dirname, "..");
const oku = g => fs.readFileSync(path.join(KOK, ...g.split("/")), "utf8");
const FORMLAR = ["hata.yml", "istek.yml"];

// "body:" altindaki "  - type: x" ogelerini blok blok ayirir
function ogeler(metin) {
  const govde = metin.slice(metin.indexOf("\nbody:") + 6);
  return govde.split(/^  - type: /m).slice(1).map(blok => {
    const tur = blok.split(/\r?\n/)[0].trim();
    const id = (/^    id: (\S+)/m.exec(blok) || [])[1];
    const etiket = (/^      label: "?(.+?)"?\s*$/m.exec(blok) || [])[1];
    const zorunlu = /^    validations:\s*\r?\n\s+required: true/m.test(blok);
    return { tur, id, etiket, zorunlu, blok };
  });
}

test("issue sablonlari: config.yml bos issue'yu kapatir ve 'video siparisi degil' aciklamasini README'ye baglar (iki dilli)", () => {
  const c = oku(".github/ISSUE_TEMPLATE/config.yml");
  assert.match(c, /^blank_issues_enabled: false\s*$/m);
  assert.match(c, /^contact_links:\s*$/m);
  assert.match(c, /name: "Video siparişi değil \/ Not a video ordering service"/);
  assert.match(c, /url: https:\/\/github\.com\/wj-sidiss\/otopilot#readme/);
  assert.match(c, /TR:/); assert.match(c, /EN:/);
  assert.match(c, /Claude Code/); assert.match(c, /Codex/);
  assert.match(c, /npm run guncelle/, "hata bildirmeden once guncelleme yonlendirmesi");
  assert.ok(!/\t/.test(c), "YAML'da sekme olmaz");
});

for (const ad of FORMLAR) {
  test("issue formu " + ad + ": gecerli yapi (name/description/title/labels/body), tekil id ve etiket, markdown'da zorunluluk yok, iki dilli etiketler", () => {
    const m = oku(".github/ISSUE_TEMPLATE/" + ad);
    for (const alan of ["name", "description", "title", "labels", "body"]) assert.match(m, new RegExp("^" + alan + ":", "m"), alan + " yok");
    assert.ok(!/\t/.test(m), "YAML'da sekme olmaz");
    assert.match(m, /^name: ".+ \/ .+"/m, "ad iki dilli (TR / EN) olmali");
    assert.match(m, /^description: ".+ \/ .+"/m, "aciklama iki dilli olmali");
    const o = ogeler(m);
    assert.ok(o.length >= 5, "oge sayisi: " + o.length);
    for (const g of o) assert.ok(["markdown", "textarea", "input", "dropdown", "checkboxes"].includes(g.tur), "bilinmeyen oge turu: " + g.tur);
    const md = o.filter(g => g.tur === "markdown");
    assert.equal(md.length, 1, "ustte tek bilgi kutusu");
    assert.match(md[0].blok, /\*\*TR:\*\*/); assert.match(md[0].blok, /\*\*EN:\*\*/);
    assert.match(md[0].blok, /hizmet değil|not a service/i, "'bu bir hizmet degil' notu");
    assert.ok(!/validations:/.test(md[0].blok), "markdown ogesinde validations olmaz");
    const idler = o.filter(g => g.id).map(g => g.id);
    assert.equal(new Set(idler).size, idler.length, "tekrarlanan id: " + idler.join());
    const etiketler = o.filter(g => g.tur !== "markdown").map(g => g.etiket);
    assert.ok(etiketler.every(Boolean), "etiketsiz oge var");
    assert.equal(new Set(etiketler).size, etiketler.length, "tekrarlanan etiket");
    for (const g of o.filter(x => x.tur !== "markdown" && x.id !== "surum" && x.id !== "alternatif" && x.id !== "hata-mesaji")) assert.match(g.etiket, / \/ /, g.id + " etiketi iki dilli degil: " + g.etiket);
    for (const g of o.filter(x => x.tur === "dropdown")) {
      const secenekler = [...g.blok.matchAll(/^\s+- "?(.+?)"?\s*$/gm)].map(x => x[1]);
      assert.equal(new Set(secenekler).size, secenekler.length, g.id + " secenekleri tekrar ediyor");
      assert.ok(secenekler.length >= 3, g.id + " secenek sayisi");
    }
  });
}

test("hata.yml: ne yaptin / ne bekledin / ne oldu / ajan / isletim sistemi / node -v zorunlu; hata mesaji ve surum istege bagli; ajan secenekleri", () => {
  const o = ogeler(oku(".github/ISSUE_TEMPLATE/hata.yml"));
  const by = id => o.find(g => g.id === id);
  for (const id of ["yapilan", "beklenen", "olan", "ajan", "isletim-sistemi", "node"]) assert.ok(by(id) && by(id).zorunlu, id + " zorunlu olmali");
  for (const id of ["hata-mesaji", "surum"]) assert.ok(by(id) && !by(id).zorunlu, id + " istege bagli olmali");
  assert.equal(by("node").tur, "input");
  assert.match(by("node").blok, /node -v/);
  assert.match(by("hata-mesaji").blok, /render: text/);
  assert.match(by("hata-mesaji").blok, /çıkış kodu/i);
  assert.match(by("ajan").blok, /Claude Code/);
  assert.match(by("ajan").blok, /Codex/);
  for (const s of ["Windows", "macOS", "Linux"]) assert.match(by("isletim-sistemi").blok, new RegExp("- " + s));
  const kontrol = by("kontrol").blok;
  assert.equal([...kontrol.matchAll(/required: true/g)].length, 2, "iki onay kutusu da zorunlu");
  assert.match(kontrol, /npm run guncelle/);
  assert.match(kontrol, /API anahtar/i);
  assert.match(oku(".github/ISSUE_TEMPLATE/hata.yml"), /^labels: \["bug"\]/m);
});

test("istek.yml: sorun zorunlu, cozum zorunlu, 'siparis degil' onayi zorunlu; hangi bolum secimi", () => {
  const m = oku(".github/ISSUE_TEMPLATE/istek.yml");
  const o = ogeler(m);
  const by = id => o.find(g => g.id === id);
  for (const id of ["sorun", "cozum", "alan"]) assert.ok(by(id) && by(id).zorunlu, id + " zorunlu olmali");
  assert.ok(by("alternatif") && !by("alternatif").zorunlu, "alternatif istege bagli olmali");
  assert.match(by("kontrol").blok, /video sipariş talebi değil/);
  assert.match(by("kontrol").blok, /not a video order/);
  assert.equal([...by("kontrol").blok.matchAll(/required: true/g)].length, 2);
  for (const b of ["Video hattı", "Panel", "Video indirici", "Ai Infapp", "Belgeler"]) assert.match(by("alan").blok, new RegExp(b));
  assert.match(m, /^labels: \["enhancement"\]/m);
});

test("PR sablonu: iki dilli kisa kontrol listesi (npm test, test eklendi, kisisel veri/anahtar yok, yeni bagimlilik yok)", () => {
  const p = oku(".github/pull_request_template.md");
  const maddeler = [...p.matchAll(/^- \[ \] (.+)$/gm)].map(x => x[1]);
  assert.ok(maddeler.length >= 4 && maddeler.length <= 7, "madde sayisi: " + maddeler.length);
  for (const madde of maddeler) assert.match(madde, / \/ /, "iki dilli degil: " + madde);
  assert.match(p, /npm test/);
  assert.match(p, /API anahtarı/);
  assert.match(p, /API keys/);
  assert.match(p, /bağımlılığı eklemedim/);
  // depoda bagimlilik var (package.json): sablon "sifir bagimlilik" diye yanlis bilgi vermemeli
  if (Object.keys(JSON.parse(oku("package.json")).dependencies || {}).length) assert.doesNotMatch(p, /sıfır bağımlılık|zero[- ]dependency/i);
  assert.match(p, /Ne değişti ve neden\? \/ What changed and why\?/);
  assert.ok(p.length < 1500, "sablon kisa kalmali");
});

test("package.json: 'npm run guncelle' lib/guncelle.js'i calistirir; yeni bagimlilik eklenmedi", () => {
  const p = JSON.parse(oku("package.json"));
  assert.equal(p.scripts.guncelle, "node lib/guncelle.js");
  assert.ok(fs.existsSync(path.join(KOK, "lib", "guncelle.js")));
  assert.deepEqual(Object.keys(p.dependencies).sort(), ["@anthropic-ai/sdk", "msedge-tts", "ws"]);   // ws: Edge sesi onarimi dogrudan kullanir (msedge-tts ile zaten gelir)
});
