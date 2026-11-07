// test/telaffuz.test.js — Turkce telaffuz ve diksiyon paketi: yerlesik sozluk, ekler, kullanici ezmesi, kapatma,
// altyazinin degismemesi, diksiyon raporu ve CLI, konu.json dogrulamasi. Ag kullanmaz.
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const T = require("../lib/telaffuz.js");
const M = require("../lib/ses-metin.js");
const D = require("../lib/diksiyon-rapor.js");
const ortak = require("../lib/ortak.js");

const duz = (s, d, o, sec) => M.metniHazirla(s, d, o, Object.assign({ xml: false }, sec || {}));
const KOK = path.join(__dirname, "..");

test("yerlesik sozluk: en az 80 giris, degerlerde rakam yok, anahtarlar tekil (buyuk/kucuk harf farki gozetmeden)", () => {
  const { girisler } = T.sozlukYukle();
  assert.ok(girisler.length >= 80, "giris sayisi " + girisler.length);
  const gorulen = new Set();
  for (const [k, v] of girisler) {
    assert.doesNotMatch(v, /\d/, k + " okunusunda rakam var (sayi gecisi bozar)");
    assert.ok(v.trim() === v && v.length <= 120, k);
    assert.ok(k.length <= 60, k);
    const kk = k.toLocaleLowerCase("tr");
    assert.ok(!gorulen.has(kk), "tekrarlanan anahtar: " + k);
    gorulen.add(kk);
  }
  for (const k of ["YouTube", "Shorts", "TikTok", "Instagram", "vidIQ", "ChatGPT", "OpenAI", "Claude", "Gemini", "Google",
    "iPhone", "Netflix", "podcast", "thumbnail", "prompt", "AI", "YZ"]) assert.ok(gorulen.has(k.toLocaleLowerCase("tr")), k + " sozlukte yok");
});

test("VoxCPM okunus_sozlugu.tsv ile ortak girisler ayni okunusu tasir (iki sozluk celismez)", () => {
  const tsv = fs.readFileSync(path.join(KOK, "sesler", "voxcpm2", "okunus_sozlugu.tsv"), "utf8");
  const yer = T.yerlesikSozluk();
  for (const l of tsv.split(/\r?\n/)) {
    if (!l.includes("\t") || l.startsWith("#")) continue;
    const [k, v] = l.split("\t").map(x => x.trim());
    if (yer[k] !== undefined) assert.equal(yer[k], v, k);
  }
});

test("Turkce: marka ve teknoloji adlari okunusa cevrilir; kelime siniri gozetilir", () => {
  assert.equal(duz("YouTube Shorts, TikTok ve Instagram Reels.", "tr"), "Yutup Şorts, Tik Tok ve İnstagram Rils.");
  assert.equal(duz("vidIQ, ChatGPT, Claude ve Gemini.", "tr"), "Vid Ay Kyu, Çet ci pi ti, Klod ve Cemini.");
  assert.equal(duz("iPhone ile Netflix izle.", "tr"), "Ayfon ile Netfliks izle.");
  assert.equal(duz("MyYouTubeKanal ve YouTubers", "tr"), "MyYouTubeKanal ve YouTubers", "kelime icinde/bilinmeyen ekle eslesmez");
  assert.equal(duz("Apples ve updated", "tr"), "Apples ve updated", "Turkce ek olmayan bitisik devam: dokunulmaz");
});

test("Turkce: kesmeli ve bitisik ekler korunur; cumle basinda buyuk harf", () => {
  assert.equal(duz("YouTube'da, YouTube'un, ChatGPT'ye ve Claude’a sor.", "tr"),
    "Yutup'da, Yutub'un, Çet ci pi ti'ye ve Klod’a sor.");
  assert.equal(duz("promptlar, podcastlerde, Instagramda.", "tr"), "promtlar, podkestlerde, İnstagramda.");
  assert.equal(duz("Podcast dinle.", "tr"), "Podkest dinle.");
  assert.equal(duz("youtube kanalı", "tr"), "Yutup kanalı", "ozel ad okunusu buyuk harfle kalir");
});

test("Turkce: kisaltmalar buyuk/kucuk harf duyarli; rakamli kisaltma ve sayi gecisi birlikte calisir", () => {
  assert.equal(duz("AI ve YZ ile ai değil.", "tr"), "Ey Ay ve Ye Ze ile ai değil.");
  assert.equal(duz("GPT-4 ile 4K video.", "tr"), "Ci Pi Ti-dört ile dört ka video.");
});

test("diksiyon: paragraf basinda tek basina Merhaba -> Merhaba!; obekte ve ortada dokunulmaz", () => {
  assert.equal(duz("Merhaba, bugün uzaydayız.", "tr"), "Merhaba! Bugün uzaydayız.");
  assert.equal(duz("Merhaba.", "tr"), "Merhaba!");
  assert.equal(duz("Merhaba", "tr"), "Merhaba!");
  assert.equal(duz("Merhabalar, hoş geldiniz.", "tr"), "Merhabalar! Hoş geldiniz.");
  assert.equal(duz("Merhaba arkadaşlar, başlıyoruz.", "tr"), "Merhaba arkadaşlar, başlıyoruz.");
  assert.equal(duz("Merhaba... dedi.", "tr"), "Merhaba... dedi.");
  assert.equal(duz("Ona merhaba, dedim.", "tr"), "Ona merhaba, dedim.");
});

test("diksiyon: Merhaba kurali cumle basi 'Önce' uretmez; rapor da uyarmaz", () => {
  assert.equal(duz("Merhaba, önce şunu söyleyeyim.", "tr"), "Merhaba, önce şunu söyleyeyim.");
  assert.equal(duz("Merhaba, öncelikle şunu söyleyeyim.", "tr"), "Merhaba! Öncelikle şunu söyleyeyim.");
  const r = D.rapor("Merhaba, önce şunu söyleyeyim.", { dil: "tr", motor: "voxcpm" });
  assert.equal(r.riskler.length, 0);
  assert.ok(!r.uygulanan.some(u => u.okunus === "Merhaba!"));
});

test("Turkce kelimeyle cakisan giris (Gemini ~ gemini) yalniz buyuk harfle; bitisik ek uyumsuzsa dokunulmaz", () => {
  assert.equal(duz("Kaptan, gemini bırakma.", "tr"), "Kaptan, gemini bırakma.");
  assert.equal(duz("Gemini'ye sor, gemini terk etme.", "tr"), "Cemini'ye sor, gemini terk etme.");
  assert.equal(duz("Discordia, Twitterati", "tr"), "Discordia, Twitterati", "ia/ati Turkce ek degil");
  assert.equal(duz("Instagramdaki, Instagramıyla, YouTuberlara", "tr"), "İnstagramdaki, İnstagramıyla, Yutubırlara");
  assert.equal(T.ekGecerli("lar"), true);
  assert.equal(T.ekGecerli("ia"), false);
});

test("unlu onu bicimi: YouTube eksiz/unsuzlu ekte Yutup, unluyle baslayan ekte Yutub", () => {
  assert.equal(duz("YouTube ile YouTube'u, YouTube'a ve YouTube'da.", "tr"), "Yutup ile Yutub'u, Yutub'a ve Yutup'da.");
  assert.equal(duz("Wikipedia'da, thumbnail, LinkedIn'de, DeepSeek'i", "tr"), "Vikipedia'da, tamneyl, Linkdin'de, Dipsiik'i");
});

test("kullanici okunusu yerlesik girisi ezer (buyuk/kucuk harf farki gozetmeden, tum yazilislarda); ciktisi korunur", () => {
  assert.equal(duz("YouTube ve Google", "tr", { YouTube: "Yutüp" }), "Yutüp ve Gugıl");
  assert.equal(duz("YouTube ve youtube", "tr", { youtube: "yutüp" }), "yutüp ve yutüp", "ezen giris tum yazilislara uygulanir");
  assert.equal(duz("YouTube ve youtube ve YOUTUBE", "tr", { YouTube: "Yu Tub" }), "Yu Tub ve Yu Tub ve Yu Tub");
  assert.equal(duz("AI ve ai", "tr", { ai: "a ı" }), "Ey Ay ve a ı", "kisaltma yalniz birebir ayni anahtarla ezilir");
  assert.equal(duz("Google Haritalar", "tr", { "Google Haritalar": "Google Maps" }), "Google Maps");
  assert.equal(D.rapor("YOUTUBE ve youtube", { dil: "tr", okunus: { YouTube: "Yu Tub" } }).riskler.length, 0);
});

test("kapatma: telaffuzPaketi:false ya da Turkce disi dilde yalniz kullanici sozlugu uygulanir (eski davranis)", () => {
  const t = "Merhaba, YouTube'da GPU %15.";
  assert.equal(duz(t, "tr", { GPU: "G P U" }, { telaffuzPaketi: false }), "Merhaba, YouTube'da G P U yüzde on beş.");
  assert.equal(duz("YouTube is great.", "en"), "YouTube is great.");
  assert.equal(M.okunusUygula("YouTube GPU", { GPU: "G P U" }), "YouTube G P U");
});

test("hazirlikOzeti: Turkce + paket acik ozeti degistirir; kapali/diger dil eski ozetle ayni", () => {
  const o = { GPU: "G P U" };
  const eski = M.hazirlikOzeti(o);
  assert.equal(M.hazirlikOzeti(o, { dil: "en" }), eski, "Ingilizce sesler yeniden uretilmemeli");
  assert.equal(M.hazirlikOzeti(o, { dil: "tr", telaffuzPaketi: false }), eski);
  assert.notEqual(M.hazirlikOzeti(o, { dil: "tr" }), eski, "paket acikken Turkce sesler yeniden uretilir");
  assert.equal(M.hazirlikOzeti(o, { dil: "tr" }), M.hazirlikOzeti(o, { dil: "tr", telaffuzPaketi: true }));
  assert.match(T.paketOzeti(), /^p\d+-[0-9a-f]{8}$/);
});

test("diksiyon raporu: yabanci kelime, uzun cumle, sapka, VoxCPM'de cumle basi Önce, rakam ve sembol satir numarasiyla", () => {
  const metin = [
    "Merhaba, bugün YouTube'da vidIQ anlatacağım.",       // 1: yalniz otomatik
    "",
    "Önce kanala bakalım. Workshop hala sürüyor ve kar ettik.", // 3: once (voxcpm), yabanci, sapka x2
    "Bu " + Array(30).fill("kelime").join(" ") + ".",       // 4: uzun cumle
    "",
    "GPT4o ile a/b testi https://ornek.com adresinde.",    // 6: rakam, sembol, adres
  ].join("\n");
  const r = D.rapor(metin, { dil: "tr", motor: "voxcpm" });
  const bul = tur => r.riskler.filter(x => x.tur === tur);
  assert.deepEqual(bul("yabanci").map(x => [x.satir, x.parca]), [[3, "Workshop"]]);
  assert.deepEqual(bul("sapka").map(x => [x.satir, x.parca]), [[3, "hala"], [3, "kar"]]);
  assert.deepEqual(bul("once").map(x => x.satir), [3]);
  assert.deepEqual(bul("uzun-cumle").map(x => x.satir), [4]);
  assert.deepEqual(bul("rakam").map(x => [x.satir, x.parca]), [[6, "GPT4o"]]);
  assert.deepEqual(bul("sembol").map(x => x.satir), [6, 6]);
  assert.ok(r.uygulanan.some(u => u.yazilis === "YouTube" && u.okunus === "Yutup"));
  assert.ok(r.uygulanan.some(u => u.okunus === "Merhaba!"));
  assert.ok(!r.riskler.some(x => x.satir === 1), "sozlukte olan kelime risk sayilmaz");
  assert.equal(D.ozetSatiri(r).startsWith(r.riskler.length + " diksiyon riski"), true);

  const edge = D.rapor(metin, { dil: "tr", motor: "edge" });
  assert.equal(edge.riskler.filter(x => x.tur === "once").length, 0, "Önce denetimi yalniz VoxCPM'de");
  assert.equal(D.rapor("Önce bunu yap.", { dil: "tr", motor: "voxcpm" }).riskler.length, 1);
  assert.equal(duz("Önce bunu yap.", "tr"), "Önce bunu yap.", "Önce OTOMATIK degistirilmez");
});

test("diksiyon raporu: kullanici okunusu olan yabanci kelime risk degil; paket kapaliyken yerlesik giris de risk olur", () => {
  assert.equal(D.rapor("Workshop başladı.", { dil: "tr", okunus: { Workshop: "Vörkşop" } }).riskler.length, 0);
  const kapali = D.rapor("Shorts ve Netflix.", { dil: "tr", telaffuzPaketi: false });
  assert.equal(kapali.paket, false);
  assert.equal(kapali.uygulanan.length, 0);
  assert.deepEqual(kapali.riskler.map(x => x.parca), ["Shorts", "Netflix"]);
  assert.equal(D.rapor("Shorts ve Netflix.", { dil: "tr" }).riskler.length, 0);
  assert.equal(D.rapor("Short sentence with Netflix.", { dil: "en" }).riskler.length, 0, "Ingilizcede yabanci kelime denetimi yok");
});

test("diksiyon raporu: Turkce th/sh adlari yabanci sayilmaz; okunusla bozulan kesmeli ek uyarilir", () => {
  assert.equal(D.rapor("Mithat Bey Fethiye'de, İshak ishal oldu.", { dil: "tr" }).riskler.length, 0);
  assert.deepEqual(D.rapor("Workshop başladı.", { dil: "tr" }).riskler.map(x => x.tur), ["yabanci"]);
  const r = D.rapor("API'ye istek, iOS'ta uygulama.\nYouTube'a, Netflix'te, 2026'da.", { dil: "tr" });
  assert.deepEqual(r.riskler.filter(x => x.tur === "ek-uyumu").map(x => [x.satir, x.parca]), [[1, "API'ye"], [1, "iOS'ta"]]);
  assert.equal(D.rapor("API'ye istek.", { dil: "tr", okunus: { "API'ye": "Ey Pi Ay'a" } }).riskler.length, 0);
});

test("surum.js: en ustteki [Yayınlanmamış] bolumu yeni surum basligina donusur; yoksa TASLAK eklenir", () => {
  const { changelogBolumu } = require("../surum.js");
  const cl = "# G\n\n## [Yayınlanmamış] — Paket\n\n### Eklenenler\n- x\n\n## [1.0.0] — 2026-01-01 — A\n\n## [Yayınlanmamış] — eski\n";
  const y = changelogBolumu(cl, "1.1.0", "2026-11-06", "Telaffuz");
  assert.match(y, /^## \[1\.1\.0\] — 2026-11-06 — Telaffuz\n\n### Eklenenler\n- x\n\n## \[1\.0\.0\]/m);
  assert.doesNotMatch(y, /TASLAK/);
  assert.match(y, /## \[Yayınlanmamış\] — eski/, "alttaki eski bolume dokunulmaz");
  const t = changelogBolumu("# G\n\n## [1.0.0] — x\n", "1.0.1", "2026-11-06", "B");
  assert.match(t, /## \[1\.0\.1\] — 2026-11-06 — B\n\n### Eklenenler\n- TASLAK: buraya yaz\n\n## \[1\.0\.0\]/);
});

test("diksiyon.js CLI: dosya ile metin raporu, --json, cikis 0/1/2", () => {
  const kok = fs.mkdtempSync(path.join(os.tmpdir(), "diksiyon-"));
  try {
    const temiz = path.join(kok, "temiz.txt"), riskli = path.join(kok, "riskli.txt");
    fs.writeFileSync(temiz, "﻿Merhaba, bugün YouTube'da kısa bir video var.\n", "utf8");
    fs.writeFileSync(riskli, "Önce Workshop hala sürüyor.\n", "utf8");
    const { ana } = require("../diksiyon.js");
    const cikti = [];
    assert.equal(ana([temiz], s => cikti.push(s)), 0);
    assert.match(cikti.join("\n"), /YouTube → Yutup/);
    assert.match(cikti.join("\n"), /riski bulunmadı/);
    cikti.length = 0;
    assert.equal(ana([riskli, "--motor", "voxcpm"], s => cikti.push(s)), 1);
    assert.match(cikti.join("\n"), /satır 1 \[yabanci\] "Workshop"/);
    assert.match(cikti.join("\n"), /\[once\]/);
    cikti.length = 0;
    assert.equal(ana([riskli, "--json"], s => cikti.push(s)), 1);
    const j = JSON.parse(cikti.join("\n"));
    assert.equal(j.dil, "tr");
    assert.ok(j.riskler.every(x => Number.isInteger(x.satir)));
    assert.equal(j.riskler.some(x => x.tur === "once"), false, "--motor verilmeden Önce denetlenmez");
    const hata = console.error; console.error = () => {};
    try {
      assert.equal(ana([], () => {}), 2);
      assert.equal(ana([riskli, "--esik", "abc"], () => {}), 2);
      assert.equal(ana(["boyle-bir-is-yok-" + Date.now()], () => {}), 2);
    } finally { console.error = hata; }
  } finally { fs.rmSync(kok, { recursive: true, force: true }); }
});

test("konu.json: telaffuzPaketi true/false dogrulanir, bilinmeyen alan sayilmaz; varsayilan acik", () => {
  assert.equal(ortak.konuDogrula({ telaffuzPaketi: false }).gecerli, true);
  assert.equal(ortak.konuDogrula({ telaffuzPaketi: true }).uyarilar.length, 0);
  const kotu = ortak.konuDogrula({ telaffuzPaketi: "hayir" });
  assert.equal(kotu.gecerli, false);
  assert.equal(kotu.hatalar[0].alan, "telaffuzPaketi");
  assert.equal(ortak.konuBirlestir({ dil: "tr" }, {}, "x").telaffuzPaketi, true);
  assert.equal(ortak.konuBirlestir({ dil: "tr", telaffuzPaketi: false }, {}, "x").telaffuzPaketi, false);
});

test("panel: telaffuzPaketi konu ayari olarak yazilabilir (Ses ve dil sekmesi)", () => {
  const kaynak = fs.readFileSync(path.join(KOK, "lib", "panel-dosya.js"), "utf8");
  assert.match(kaynak, /telaffuzPaketi: "b"/);
  const ses = fs.readFileSync(path.join(KOK, "seslendir.js"), "utf8");
  assert.equal((ses.match(/telaffuzPaketi: bayrak\["telaffuz-kapali"\]/g) || []).length >= 2, true,
    "--telaffuz-kapali hem is hem --test (ornekUret) yoluna iletilir");
  assert.match(fs.readFileSync(path.join(KOK, "panel-public", "panel-is-ayar.js"), "utf8"), /sKutu\("telaffuzPaketi"/);
});
