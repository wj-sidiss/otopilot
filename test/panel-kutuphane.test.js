// lib/panel-*.js — saf/yerel parcalar: guvenlik, komut tablosu, yeni is, anahtarlar (sahte https), yayin, dosya islemleri, ses durumu, toplu manifest.
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const ortak = require("../lib/ortak");
const guvenlik = require("../lib/panel-guvenlik");
const komutlar = require("../lib/panel-komutlar");
const anahtar = require("../lib/panel-anahtar");
const yeniIs = require("../lib/panel-yeni-is");
const yayin = require("../lib/panel-yayin");
const dosya = require("../lib/panel-dosya");
const isler = require("../lib/panel-isler");
const toplu = require("../lib/panel-toplu");
const { HttpHata } = require("../lib/panel-http");

function ortamKur() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "panel-kut-"));
  const onceki = ["OTOMASYON_URETIM", "OTOMASYON_AYAR_DOSYASI", "OTOMASYON_ENV_DOSYASI"].map(k => [k, process.env[k]]);
  process.env.OTOMASYON_URETIM = path.join(d, "uretim");
  process.env.OTOMASYON_AYAR_DOSYASI = path.join(d, "panel-ayar.json");
  process.env.OTOMASYON_ENV_DOSYASI = path.join(d, ".env");
  fs.mkdirSync(process.env.OTOMASYON_URETIM, { recursive: true });
  fs.writeFileSync(process.env.OTOMASYON_ENV_DOSYASI, "");
  return {
    d, uretim: process.env.OTOMASYON_URETIM,
    yaz(rel, icerik) { const p = path.join(process.env.OTOMASYON_URETIM, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, typeof icerik === "string" || Buffer.isBuffer(icerik) ? icerik : JSON.stringify(icerik)); return p; },
    geri() {
      for (const [k, v] of onceki) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
      try { fs.rmSync(d, { recursive: true, force: true }); } catch (e) { /* gecici klasor */ }
    },
  };
}

// ---------------------------------------------------------------- guvenlik
test("guvenlik: Host/Origin/Sec-Fetch-Site/jeton karsilastirmasi", () => {
  assert.equal(guvenlik.hostIzinli("localhost:4173", 4173), true);
  assert.equal(guvenlik.hostIzinli("127.0.0.1:4173", 4173), true);
  assert.equal(guvenlik.hostIzinli("[::1]:4173", 4173), true);
  for (const k of ["evil.com", "localhost", "localhost:9999", "localhost.evil.com:4173", "127.0.0.1.nip.io:4173", undefined]) assert.equal(guvenlik.hostIzinli(k, 4173), false, String(k));
  assert.equal(guvenlik.hostIzinli("192.168.1.5:4173", 4173, ["192.168.1.5:4173"]), false, "ag adresi ek listeyle de acilamaz (PANEL_IZINLI_HOST kaldirildi)");
  assert.equal(guvenlik.originIzinli(undefined, 4173), true);
  assert.equal(guvenlik.originIzinli("http://localhost:4173", 4173), true);
  assert.equal(guvenlik.originIzinli("https://localhost:4173", 4173), false);
  assert.equal(guvenlik.originIzinli("http://evil.com", 4173), false);
  assert.equal(guvenlik.originIzinli("null", 4173), false);
  assert.equal(guvenlik.fetchSiteIzinli("same-origin"), true);
  assert.equal(guvenlik.fetchSiteIzinli("none"), true);
  assert.equal(guvenlik.fetchSiteIzinli("cross-site"), false);
  assert.equal(guvenlik.fetchSiteIzinli("same-site"), false);
  const j = guvenlik.jetonUret();
  assert.match(j, /^[0-9a-f]{64}$/);
  assert.notEqual(j, guvenlik.jetonUret());
  assert.equal(guvenlik.jetonEsit(j, j), true);
  assert.equal(guvenlik.jetonEsit(j, j.slice(0, -1) + "0"), j.endsWith("0"));
  assert.equal(guvenlik.jetonEsit("", ""), false);
  assert.equal(guvenlik.jetonEsit(j, "kisa"), false);
});

test("guvenlik: kapi() — API'de jeton, POST'ta Content-Type ve Origin; medya yollarinda cerez", () => {
  const J = "a".repeat(64);
  const sahte = (yontem, baslik) => ({ method: yontem, headers: Object.assign({ host: "localhost:4173" }, baslik) });
  assert.equal(guvenlik.kapi(sahte("GET", {}), "/", 4173, J), null);
  assert.equal(guvenlik.kapi(sahte("GET", {}), "/api/isler", 4173, J).kod, "token");
  assert.equal(guvenlik.kapi(sahte("GET", { "x-panel-token": J }), "/api/isler", 4173, J), null);
  assert.equal(guvenlik.kapi(sahte("GET", { "x-panel-token": "b".repeat(64) }), "/api/isler", 4173, J).kod, "token");
  assert.equal(guvenlik.kapi(sahte("GET", { host: "evil.com" }), "/", 4173, J).kod, "host");
  assert.equal(guvenlik.kapi(sahte("POST", { "x-panel-token": J }), "/api/yeni", 4173, J).durum, 415);
  assert.equal(guvenlik.kapi(sahte("POST", { "x-panel-token": J, "content-type": "text/plain" }), "/api/yeni", 4173, J).durum, 415);
  assert.equal(guvenlik.kapi(sahte("POST", { "x-panel-token": J, "content-type": "application/json; charset=utf-8" }), "/api/yeni", 4173, J), null);
  const o = guvenlik.kapi(sahte("POST", { "x-panel-token": J, "content-type": "application/json", origin: "http://evil.com" }), "/api/yeni", 4173, J);
  assert.equal(o.durum, 403); assert.equal(o.kod, "origin");
  assert.equal(guvenlik.kapi(sahte("POST", { "x-panel-token": J, "content-type": "application/json", "sec-fetch-site": "cross-site" }), "/api/yeni", 4173, J).kod, "origin");
  assert.equal(guvenlik.kapi(sahte("GET", { origin: "http://evil.com", "x-panel-token": J }), "/api/isler", 4173, J).kod, "origin");
  for (const y of ["/video/x", "/onizle/a/b/c.jpg", "/indir/x/video", "/marka/a.png", "/sestesti/abc"]) {
    assert.equal(guvenlik.kapi(sahte("GET", {}), y, 4173, J).kod, "token", y);
    assert.equal(guvenlik.kapi(sahte("GET", { cookie: "panel_oturum=" + J }), y, 4173, J), null, y);
    assert.equal(guvenlik.kapi(sahte("GET", { cookie: "baska=1; panel_oturum=yanlis" }), y, 4173, J).kod, "token", y);
  }
});

test("guvenlik: htmlEnjekte meta + sarmalayici ekler, head yoksa da calisir; cerez HttpOnly+SameSite=Strict", () => {
  const h1 = guvenlik.htmlEnjekte("<!doctype html><html><head><title>x</title></head><body></body></html>", "TOK123");
  assert.match(h1, /<head><meta name="panel-token" content="TOK123"><script>/);
  assert.match(h1, /X-Panel-Token/);
  assert.match(guvenlik.htmlEnjekte("<html><body>a</body></html>", "T"), /^<meta name="panel-token"/);
  assert.match(guvenlik.htmlEnjekte("<!doctype html><body>a</body>", "T"), /<head><meta name="panel-token" content="T">/);
  assert.match(guvenlik.cerezDegeri("T"), /^panel_oturum=T; HttpOnly; SameSite=Strict; Path=\/$/);
  assert.match(guvenlik.CSP, /frame-ancestors 'none'/);
});

// ---------------------------------------------------------------- komutlar
test("komutlar.zincirAdimlari: sira, atlama kosullari ve motor secimi", () => {
  const o = ortamKur();
  try {
    o.yaz("is1/konu.json", { baslik_en: "x", dil: "tr", altyaziDili: "en", formuller: [{ hedef: "f1" }], promptlar: [{ hedef: "p1" }] });
    const ctx = (anahtarlar, senaryo, ek) => Object.assign({ ayar: ortak.ayarOku(), anahtarVar: a => anahtarlar.includes(a), senaryoVar: () => senaryo, konuHam: ortak.konuHam, uretim: o.uretim }, ek || {});
    // Claude + vidIQ anahtari var, senaryo yok
    let a = komutlar.zincirAdimlari("is1", { bastan: true, temiz: true }, ctx(["ANTHROPIC_API_KEY", "VIDIQ_KEY"], false));
    assert.deepEqual(a.map(x => x.ad), ["baslik-on", "senaryo", "ceviri", "baslik", "gorsel", "kartlar", "ses", "video"]);
    const sen = a.find(x => x.ad === "senaryo");
    assert.equal(sen.komutlar[0].betik, "senaryo-claude.js"); assert.equal(sen.onayDurak, "senaryo");
    // vidIQ dil parametresi almaz: Ingilizce disi (burada Turkce) isde Claude servis hatasi verince vidIQ'ya OTOMATIK dusulmez
    assert.equal(sen.yedek, null);
    assert.deepEqual(a.find(x => x.ad === "gorsel").komutlar[0].argv, ["is1", "--yeniden"]);
    assert.deepEqual(a.find(x => x.ad === "ses").komutlar[0].argv, ["is1", "--yeniden"]);
    assert.deepEqual(a.find(x => x.ad === "video").komutlar[0].argv, ["is1", "--yeniden", "--temiz"]);
    assert.equal(a.find(x => x.ad === "video").agir, true);
    assert.equal(a.find(x => x.ad === "kartlar").komutlar.length, 2);
    assert.equal(a.find(x => x.ad === "baslik-on").istegeBagli, true);
    assert.equal(a.find(x => x.ad === "ceviri").istegeBagli, false);
    // Ingilizce is: ayni anahtarlarla vidIQ yedek motor olarak baglanir (ceviri yok: altyazi dili = dil, kart yok)
    o.yaz("is2/konu.json", { baslik_en: "y", dil: "en" });
    a = komutlar.zincirAdimlari("is2", {}, ctx(["ANTHROPIC_API_KEY", "VIDIQ_KEY"], false));
    assert.deepEqual(a.map(x => x.ad), ["baslik-on", "senaryo", "baslik", "gorsel", "ses", "video"]);
    assert.equal(a.find(x => x.ad === "senaryo").yedek.betik, "senaryo-yaz.js");
    // senaryo dolu: ucretli senaryo adimi YOK; vidIQ yok: baslik adimlari yok
    a = komutlar.zincirAdimlari("is1", {}, ctx(["ANTHROPIC_API_KEY"], true));
    assert.deepEqual(a.map(x => x.ad), ["ceviri", "gorsel", "kartlar", "ses", "video"]);
    assert.deepEqual(a.find(x => x.ad === "gorsel").komutlar[0].argv, ["is1"]);
    // hicbir anahtar yok, senaryo yok -> anahtar_yok
    assert.throws(() => komutlar.zincirAdimlari("is1", {}, ctx([], false)), e => e instanceof HttpHata && e.kod === "anahtar_yok" && e.durum === 400);
    // ayarda motor vidiq secili
    fs.writeFileSync(process.env.OTOMASYON_AYAR_DOSYASI, JSON.stringify({ senaryoMotoru: "vidiq" }));
    a = komutlar.zincirAdimlari("is1", {}, ctx(["ANTHROPIC_API_KEY", "VIDIQ_KEY"], false));
    assert.equal(a.find(x => x.ad === "senaryo").komutlar[0].betik, "senaryo-yaz.js");
    assert.equal(a.find(x => x.ad === "senaryo").yedek, null);
    // konu.json yok
    assert.throws(() => komutlar.zincirAdimlari("yok", {}, ctx(["ANTHROPIC_API_KEY"], true)), e => e.kod === "konu_yok");
  } finally { o.geri(); }
});

test("komutlar.tekTur: cagri tablosu (SOZLESME 7.4) ve girdi denetimi", () => {
  const ctx = { ayar: ortak.AYAR_VARSAYILAN, anahtarVar: a => a === "ANTHROPIC_API_KEY", uretim: "/u" };
  const bir = (tur, b) => komutlar.tekTur(tur, Object.assign({ is: "is1" }, b), ctx);
  assert.deepEqual(bir("baslikOn")[0].komutlar[0], { betik: "baslik-analiz.js", argv: ["is1", "--on"] });
  assert.deepEqual(bir("gorselSahne", { sahne: 3, ara: "bal porsugu" })[0].komutlar[0].argv, ["is1", "--sahne", "3", "--ara", "bal porsugu"]);
  assert.deepEqual(bir("nasa", { adet: 5 })[0].komutlar[0], { betik: "gorsel-cek.js", argv: ["is1", "5"] });
  assert.deepEqual(bir("nasa")[0].komutlar[0].argv, ["is1", "12"]);
  assert.deepEqual(bir("onizleme")[0].komutlar[0], { betik: "video-yap.js", argv: ["is1", "--onizleme"] });
  assert.deepEqual(bir("video", { yeniden: true, tut: true })[0].komutlar[0].argv, ["is1", "--yeniden", "--tut"]);
  const sk = bir("shortsKes")[0];
  assert.equal(sk.komutlar.length, 2);
  assert.equal(sk.komutlar[0].betik, "kesit-bul.cjs"); assert.equal(sk.komutlar[1].betik, "shorts-kes.cjs");
  assert.deepEqual(sk.komutlar[0].argv.slice(1, 2), ["--otomatik"]);
  assert.equal(bir("vsHepsi").length, 2);
  assert.deepEqual(komutlar.tekTur("markaYap", { kanal: "Kanal", slogan: "s" }, ctx)[0].komutlar[0].argv.slice(0, 2), ["Kanal", "s"]);
  assert.deepEqual(komutlar.tekTur("trend", { konu: "ai", dil: "tr", min: 1000, platform: "yt", siki: true }, ctx)[0].komutlar[0].argv, ["ai", "--dil", "tr", "--min", "1000", "--platform", "yt", "--siki"]);
  assert.ok(!komutlar.tekTur("trend", { konu: "ai", platform: "hepsi" }, ctx)[0].komutlar[0].argv.includes("--platform"));
  assert.deepEqual(komutlar.tekTur("viral", { konu: "x", dil: "en", min: 5 }, ctx)[0].komutlar[0].argv, ["x", "en", "5"]);
  assert.deepEqual(komutlar.tekTur("performans", {}, ctx)[0].komutlar[0].argv, ["--hepsi"]);
  assert.deepEqual(komutlar.tekTur("performans", { is: "a" }, ctx)[0].komutlar[0].argv, ["--is", "a"]);
  assert.equal(bir("senaryo")[0].komutlar[0].betik, "senaryo-claude.js");
  assert.throws(() => komutlar.tekTur("senaryoV", { is: "is1" }, ctx), e => e.kod === "anahtar_yok");
  for (const kotu of ["", "x", "mix", "tonMuzik"]) assert.throws(() => komutlar.tekTur(kotu, { is: "is1" }, ctx), e => e.kod === "gecersiz_islem");
  assert.throws(() => bir("gorsel", { is: "../x" }), e => e.kod === "gecersiz_is");
  assert.throws(() => bir("gorselSahne", { sahne: 0, ara: "x" }), e => e.kod === "sahne");
  assert.throws(() => bir("gorselSahne", { sahne: 1, ara: "" }), e => e.kod === "ara");
  assert.throws(() => komutlar.tekTur("trend", { konu: "x", platform: "fb" }, ctx), e => e.kod === "platform");
  assert.ok(!komutlar.TURLER.includes("mix") && !komutlar.TURLER.includes("tonMuzik"));
});

// ---------------------------------------------------------------- yeni is
test("yeni-is: /api/yeni varsayilanlari (long hizli 0/0/0/12+markaKose2, sinematik 5/10/3/12, short, reels), slug ve cakisma -2", () => {
  const o = ortamKur();
  try {
    const a = yeniIs.yeniIs({ baslik: "Yapay Zekâ Neden Önemli?", nis: "not", format: "long" });
    assert.equal(a.ad, "yapay-zeka-neden-onemli");
    const k = JSON.parse(fs.readFileSync(path.join(a.dizin, "konu.json"), "utf8"));
    assert.deepEqual([k.geriSayim, k.intro, k.konuKarti, k.outro, k.markaKose, k.hedefSaniye, k.muzikSeviyesi, k.acilisStili], [0, 0, 0, 12, 2, 900, 0.4, "hizli"]);
    assert.equal(k.surum, 1); assert.equal(k._not, "not"); assert.equal(k.aspect, "16:9"); assert.deepEqual(k.onay, { senaryo: true, gorsel: false });
    assert.equal(fs.readFileSync(path.join(a.dizin, "Voice", "SESLENDIRME-TAM-METIN.txt"), "utf8"), "");
    const b = yeniIs.yeniIs({ baslik: "Yapay Zekâ Neden Önemli?", acilisStili: "sinematik" });
    assert.equal(b.ad, "yapay-zeka-neden-onemli-2");
    const kb = b.konu;
    assert.deepEqual([kb.geriSayim, kb.intro, kb.konuKarti, kb.outro, kb.markaKose], [5, 10, 3, 12, undefined]);
    assert.deepEqual(yeniIs.yeniIs({ baslik: "k", format: "short" }).konu.hedefSaniye, 40);
    const r = yeniIs.yeniIs({ baslik: "r", format: "reels", sureDk: 2 }).konu;
    assert.deepEqual([r.geriSayim, r.intro, r.konuKarti, r.outro, r.hedefSaniye, r.aspect], [0, 1.5, 0, 0, 120, "9:16"]);
    const t = yeniIs.yeniIs({ baslik: "t", format: "tiktok", dil: "tr", kaynakMetin: "kaynak", kisiselKatki: "ben", tur: "reklam", ton: "samimi", altyaziDili: "en" }).konu;
    assert.deepEqual([t.dil, t.ses, t.altyaziDili, t.arastirma, t.kisiselKatki, t.tur, t.ton, t.hedefSaniye], ["tr", "tr-TR-AhmetNeural", "en", "kaynak", "ben", "reklam", "samimi", 60]);
    // acik ad cakisinca 409
    yeniIs.yeniIs({ baslik: "x", ad: "sabit-ad" });
    assert.throws(() => yeniIs.yeniIs({ baslik: "x", ad: "sabit-ad" }), e => e instanceof yeniIs.GirdiHatasi && e.durum === 409 && e.kod === "is_var");
    assert.ok(ortak.konuDogrula(k).gecerli);
  } finally { o.geri(); }
});

test("yeni-is: gecersiz girdide KLASOR ACILMAZ", () => {
  const o = ortamKur();
  try {
    const sayi = () => fs.readdirSync(o.uretim).length;
    for (const kotu of [{}, { baslik: "" }, { baslik: "x", format: "mp4" }, { baslik: "x", sureDk: -1 }, { baslik: "x", sureDk: 0.1 }, { baslik: "x", sureDk: 61 },
      { baslik: "x", dil: "tr-TR" }, { baslik: "x", sesHizi: "hizli" }, { baslik: "x", tur: "komedi" }, { baslik: "x", acilisStili: "x" },
      { baslik: "x".repeat(301) }, { baslik: "x", kaynakMetin: "k".repeat(20001) }, { baslik: "x", onay: { senaryo: "e" } }, { baslik: "x", ses: "../etc" }, { baslik: 5 }]) {
      assert.throws(() => yeniIs.yeniIs(kotu), e => e instanceof yeniIs.GirdiHatasi, JSON.stringify(kotu).slice(0, 60));
    }
    assert.equal(sayi(), 0);
  } finally { o.geri(); }
});

// ---------------------------------------------------------------- anahtarlar
test("anahtar: izinli adlar, maskeleme, govde cozumu (yeni ve eski bicim)", () => {
  assert.ok(anahtar.IZINLI.includes("UNSPLASH_KEY") && anahtar.IZINLI.includes("SMITHSONIAN_KEY"));
  assert.equal(anahtar.maskele("PEXELS_KEY", "abcdef1234"), "••••••1234");
  assert.equal(anahtar.maskele("ANTHROPIC_MODEL", "claude-x"), "claude-x");
  assert.equal(anahtar.maskele("AZURE_SPEECH_REGION", "westeurope"), "westeurope");
  assert.equal(anahtar.maskele("PEXELS_KEY", ""), "");
  assert.deepEqual(anahtar.govdeCoz({ ayarla: { PEXELS_KEY: " k " }, sil: ["HF_TOKEN"] }), { ayarla: { PEXELS_KEY: "k" }, sil: ["HF_TOKEN"] });
  assert.deepEqual(anahtar.govdeCoz({ PEXELS_KEY: "k", VIDIQ_KEY: "" }), { ayarla: { PEXELS_KEY: "k" }, sil: [] });
  assert.throws(() => anahtar.govdeCoz({ ayarla: { BILINMEYEN_KEY: "x" } }), e => e.kod === "anahtar_adi");
  assert.throws(() => anahtar.govdeCoz({ ayarla: { PATH: "x" } }), e => e.kod === "anahtar_adi");
  assert.throws(() => anahtar.govdeCoz({ ayarla: { PEXELS_KEY: "a\nB=c" } }), e => e.kod === "deger");
  assert.throws(() => anahtar.govdeCoz({ sil: ["LD_PRELOAD"] }), e => e.kod === "anahtar_adi");
  assert.throws(() => anahtar.govdeCoz({ ayarla: { PEXELS_KEY: 5 } }), e => e.kod === "deger");
  assert.deepEqual(anahtar.testlerKaydedilenler(["ANTHROPIC_API_KEY", "ANTHROPIC_MODEL", "PEXELS_KEY", "HF_TOKEN"]).sort(), ["claude", "pexels"]);
});

function sahteHttps(cevaplar) {
  const cagrilar = [];
  return {
    cagrilar,
    request(secenek, cb) {
      cagrilar.push(secenek);
      const cevap = cevaplar(secenek);
      const { EventEmitter } = require("events");
      const req = new EventEmitter(); req.destroy = () => {}; req.end = () => {
        if (cevap.hata) return setImmediate(() => req.emit("error", new Error(cevap.hata)));
        const res = new EventEmitter(); res.statusCode = cevap.durum;
        setImmediate(() => { cb(res); res.emit("data", Buffer.from(cevap.govde || "")); res.emit("end"); });
      };
      return req;
    },
  };
}
test("anahtar.testler: Anthropic /v1/models (token harcamaz), model adi, durum kodlari, Pexels/Pixabay — ag sahte", async () => {
  let h = sahteHttps(() => ({ durum: 200 }));
  let r = await anahtar.testler.claude("sk-x", { https: h, model: "" });
  assert.equal(r.ok, true);
  assert.equal(h.cagrilar[0].hostname, "api.anthropic.com"); assert.match(h.cagrilar[0].path, /^\/v1\/models/);
  assert.equal(h.cagrilar[0].headers["x-api-key"], "sk-x"); assert.ok(h.cagrilar[0].headers["anthropic-version"]);
  h = sahteHttps(s => (/\/models\/yok-model/.test(s.path) ? { durum: 404 } : { durum: 200 }));
  r = await anahtar.testler.claude("sk-x", { https: h, model: "yok-model" });
  assert.equal(r.ok, false); assert.match(r.mesaj, /model bulunamadı/);
  r = await anahtar.testler.claude("sk-x", { https: sahteHttps(() => ({ durum: 401 })) });
  assert.equal(r.ok, false); assert.match(r.mesaj, /geçersiz/);
  r = await anahtar.testler.claude("sk-x", { https: sahteHttps(() => ({ durum: 429 })) }); assert.equal(r.ok, false);
  r = await anahtar.testler.claude("sk-x", { https: sahteHttps(() => ({ hata: "ENOTFOUND" })) }); assert.match(r.mesaj, /ulaşılamadı/);
  r = await anahtar.testler.claude("", {}); assert.equal(r.ok, false);
  assert.equal((await anahtar.testler.pexels("k", { https: sahteHttps(() => ({ durum: 200 })) })).ok, true);
  assert.equal((await anahtar.testler.pexels("k", { https: sahteHttps(() => ({ durum: 401 })) })).ok, false);
  assert.equal((await anahtar.testler.pixabay("k", { https: sahteHttps(() => ({ durum: 200 })) })).ok, true);
  assert.equal((await anahtar.testler.pixabay("k", { https: sahteHttps(() => ({ durum: 400 })) })).ok, false);
  const vid = await anahtar.testler.vidiq("k", { vidiq: { test: async (k) => ({ ok: k === "k", mesaj: "tamam" }) } });
  assert.deepEqual(vid, { ok: true, mesaj: "tamam" });
});

// ---------------------------------------------------------------- yayin
test("yayin: video kimligi cikarma, durum isaretleme, performans onerisi", () => {
  assert.equal(yayin.videoIdCikar("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=5"), "dQw4w9WgXcQ");
  assert.equal(yayin.videoIdCikar("https://youtu.be/dQw4w9WgXcQ"), "dQw4w9WgXcQ");
  assert.equal(yayin.videoIdCikar("https://www.youtube.com/shorts/dQw4w9WgXcQ"), "dQw4w9WgXcQ");
  assert.equal(yayin.videoIdCikar(null, "dQw4w9WgXcQ"), "dQw4w9WgXcQ");
  assert.equal(yayin.videoIdCikar("https://example.com/x"), null);
  const o = ortamKur();
  try {
    o.yaz("v1/konu.json", { baslik_en: "x" });
    const d = yayin.yayinIsaretle("v1", { platform: "yt", durum: "yuklendi", url: "https://youtu.be/dQw4w9WgXcQ" });
    assert.equal(d.platformlar.youtube.videoId, "dQw4w9WgXcQ"); assert.equal(d.surum, 1);
    yayin.yayinIsaretle("v1", { platform: "instagram", durum: "planli" });
    const kayit = JSON.parse(fs.readFileSync(path.join(o.uretim, "v1", "yayin-durum.json"), "utf8"));
    assert.deepEqual(Object.keys(kayit.platformlar).sort(), ["instagram", "youtube"]);
    assert.throws(() => yayin.yayinIsaretle("v1", { platform: "facebook", durum: "hazir" }), e => e.kod === "platform");
    assert.throws(() => yayin.yayinIsaretle("v1", { platform: "yt", durum: "silindi" }), e => e.kod === "durum");
    assert.throws(() => yayin.yayinIsaretle("v1", { platform: "yt", durum: "hazir", url: "javascript:alert(1)" }), e => e.kod === "url");
    assert.throws(() => yayin.yayinIsaretle("v1", { platform: "yt", durum: "hazir", videoId: "kisa" }), e => e.kod === "video_id");
    // performans
    for (const [is, izl, sn] of [["p1", 100, 30], ["p2", 5000, 30], ["p3", 20, 700], ["p4", 10, 800]]) {
      o.yaz(is + "/performans.json", { surum: 1, izlenme: izl }); o.yaz(is + "/render-sonuc.json", { surum: 1, sureSn: sn });
    }
    const p = yayin.performansOzeti();
    assert.equal(p.isler[0].is, "p2"); assert.match(p.oneri, /1 dakikadan kısa/);
    assert.match(yayin.oneriUret([{ izlenme: 1, sureSn: 10 }]), /en az 3/);
  } finally { o.geri(); }
});

// ---------------------------------------------------------------- dosya islemleri
test("dosya: konu yazma — bozuk JSON satir/sutunla reddedilir, gecerli yazilir ve .bak alinir", () => {
  const o = ortamKur();
  try {
    o.yaz("k1/konu.json", { baslik_en: "ilk", gecis: "fade" });
    assert.throws(() => dosya.dosyaYaz("k1", "konu", '{\n "baslik_en": "x",\n}'), e => e.durum === 400 && e.kod === "konu_bozuk" && e.satir === 3);
    assert.throws(() => dosya.dosyaYaz("k1", "konu", '{"hedefSaniye": 1}'), e => e.kod === "konu_gecersiz" && e.alanlar[0].alan === "hedefSaniye");
    assert.throws(() => dosya.dosyaYaz("k1", "konu", "[1]"), e => e.kod === "konu_gecersiz");
    assert.equal(JSON.parse(fs.readFileSync(path.join(o.uretim, "k1", "konu.json"), "utf8")).baslik_en, "ilk", "reddedilen yazma dosyayi bozmamali");
    assert.equal(fs.existsSync(path.join(o.uretim, "k1", "konu.json.bak")), false);
    const r = dosya.dosyaYaz("k1", "konu", JSON.stringify({ baslik_en: "yeni", ozelAlan: 1 }));
    assert.equal(r.ok, true);
    const yeni = JSON.parse(fs.readFileSync(path.join(o.uretim, "k1", "konu.json"), "utf8"));
    assert.equal(yeni.baslik_en, "yeni"); assert.equal(yeni.ozelAlan, 1, "bilinmeyen alan korunur");
    assert.equal(JSON.parse(fs.readFileSync(path.join(o.uretim, "k1", "konu.json.bak"), "utf8")).baslik_en, "ilk");
    assert.throws(() => dosya.dosyaYaz("k1", "iddia", "x"), e => e.kod === "yalniz_okuma");
    assert.throws(() => dosya.dosyaYaz("k1", "senaryo", "x".repeat(2 * 1024 * 1024 + 1)), e => e.durum === 413);
  } finally { o.geri(); }
});

test("dosya: senaryo degisince Voice/yedek/ kopyasi; kaynakmetin konu.arastirma'ya yazilir; bozuk konu 409", () => {
  const o = ortamKur();
  try {
    o.yaz("s1/konu.json", { baslik_en: "x" });
    const eski = "Eski senaryo metni yeterince uzun olsun diye elli karakterden fazla yazildi.\n";
    o.yaz("s1/Voice/SESLENDIRME-TAM-METIN.txt", eski);
    dosya.dosyaYaz("s1", "senaryo", "Yeni metin");
    const yedekler = fs.readdirSync(path.join(o.uretim, "s1", "Voice", "yedek"));
    assert.equal(yedekler.length, 1); assert.match(yedekler[0], /^SESLENDIRME-\d{8}-\d{6}\.txt$/);
    assert.equal(fs.readFileSync(path.join(o.uretim, "s1", "Voice", "yedek", yedekler[0]), "utf8"), eski);
    dosya.dosyaYaz("s1", "senaryo", "Yeni metin");        // degismedi: yeni yedek yok
    assert.equal(fs.readdirSync(path.join(o.uretim, "s1", "Voice", "yedek")).length, 1);
    dosya.dosyaYaz("s1", "kaynakmetin", "Kaynak: 1969'da Ay'a inildi.");
    assert.equal(dosya.dosyaOku("s1", "kaynakmetin").icerik, "Kaynak: 1969'da Ay'a inildi.");
    assert.equal(JSON.parse(fs.readFileSync(path.join(o.uretim, "s1", "konu.json"), "utf8")).arastirma, "Kaynak: 1969'da Ay'a inildi.");
    o.yaz("bz/konu.json", "{bozuk");
    assert.throws(() => dosya.dosyaYaz("bz", "kaynakmetin", "x"), e => e.durum === 409 && e.kod === "konu_bozuk");
    assert.throws(() => dosya.gorunumUygula("bz", { gecis: "fade" }), e => e.durum === 409);
    assert.equal(fs.readFileSync(path.join(o.uretim, "bz", "konu.json"), "utf8"), "{bozuk", "bozuk dosya ustune yazilmaz");
  } finally { o.geri(); }
});

test("dosya.gorunumUygula: dogrular, tur cevirir, outroMetni birlestirir, null siler, yedek alir", () => {
  const o = ortamKur();
  try {
    o.yaz("g1/konu.json", { baslik_en: "x", muzikDosyasi: "m.mp3" });
    const r = dosya.gorunumUygula("g1", { is: "g1", gecis: "wipeleft", gecisSure: "1.2", muzikSeviyesi: "0.3", geriSayim: 5, altyazi: "false", markaKose: 2,
      outroMetni: { baslik: "ABONE OL" }, muzikDosyasi: null, bilinmeyen: 1, slogan: "" });
    assert.deepEqual(r.yoksayilan, ["bilinmeyen"]);
    const k = JSON.parse(fs.readFileSync(path.join(o.uretim, "g1", "konu.json"), "utf8"));
    assert.deepEqual([k.gecis, k.gecisSure, k.muzikSeviyesi, k.geriSayim, k.altyazi, k.markaKose], ["wipeleft", 1.2, 0.3, 5, false, 2]);
    assert.deepEqual(k.outroMetni, { baslik: "ABONE OL" }); assert.equal(k.muzikDosyasi, undefined);
    assert.ok(fs.existsSync(path.join(o.uretim, "g1", "konu.json.bak")));
    assert.throws(() => dosya.gorunumUygula("g1", { gecis: "yok-boyle-gecis" }), e => e.kod === "konu_gecersiz");
    assert.throws(() => dosya.gorunumUygula("g1", { gecisSure: "abc" }), e => e.kod === "konu_gecersiz");
    assert.throws(() => dosya.gorunumUygula("g1", { geriSayim: 3 }), e => e.kod === "konu_gecersiz");
    assert.equal(JSON.parse(fs.readFileSync(path.join(o.uretim, "g1", "konu.json"), "utf8")).gecis, "wipeleft", "gecersiz istek dosyayi degistirmemeli");
    assert.throws(() => dosya.gorunumUygula("yok", { gecis: "fade" }), e => e.durum === 404);
  } finally { o.geri(); }
});

test("dosya.gorselSil: '..' ve basename kacislari reddedilir; manifestten kayit cikar; silinenler.json'a yazar", () => {
  const o = ortamKur();
  try {
    o.yaz("m1/konu.json", { baslik_en: "x" });
    const icerik = Buffer.from("gorsel-icerigi");
    o.yaz("m1/Visuals/001-a/01.jpg", icerik); o.yaz("m1/Visuals/001-a/02.jpg", "baska");
    o.yaz("m1/Visuals/manifest.json", { surum: 1, toplamGorsel: 2, sahneler: [{ no: 1, klasor: "001-a", durum: "tamam", gorseller: [
      { dosya: "001-a/01.jpg", kaynakUrl: "https://ornek/1", sha1: "abc" }, { dosya: "001-a/02.jpg", kaynakUrl: "https://ornek/2" }] }] });
    o.yaz("DOKUNMA.txt", "x");
    for (const [sahne, ad] of [["..", "x.jpg"], ["001-a", "../../DOKUNMA.txt"], ["001-a", "..\\..\\x.jpg"], ["../..", "x.png"], ["001-a", ".env"], ["001-a", "01.txt"], ["001-a/../..", "a.jpg"], ["", "a.jpg"], ["001-a", ""]])
      assert.throws(() => dosya.gorselSil("m1", sahne, ad), e => e instanceof HttpHata && [400, 404].includes(e.durum), sahne + " | " + ad);
    assert.equal(fs.existsSync(path.join(o.uretim, "DOKUNMA.txt")), true);
    assert.equal(fs.existsSync(path.join(o.uretim, "m1", "Visuals", "001-a", "01.jpg")), true, "reddedilen istek dosyayi silmemeli");
    dosya.gorselSil("m1", "001-a", "01.jpg");
    assert.equal(fs.existsSync(path.join(o.uretim, "m1", "Visuals", "001-a", "01.jpg")), false);
    const man = JSON.parse(fs.readFileSync(path.join(o.uretim, "m1", "Visuals", "manifest.json"), "utf8"));
    assert.equal(man.toplamGorsel, 1); assert.equal(man.sahneler[0].gorseller.length, 1);
    const sl = JSON.parse(fs.readFileSync(path.join(o.uretim, "m1", "silinenler.json"), "utf8"));
    assert.equal(sl.surum, 1); assert.equal(sl.silinenler[0].kaynakUrl, "https://ornek/1"); assert.equal(sl.silinenler[0].sha1, "abc"); assert.ok(sl.silinenler[0].zaman);
    dosya.gorselSil("m1", "001-a", "02.jpg");
    assert.equal(JSON.parse(fs.readFileSync(path.join(o.uretim, "m1", "Visuals", "manifest.json"), "utf8")).sahneler[0].durum, "eksik");
    assert.throws(() => dosya.gorselSil("m1", "001-a", "02.jpg"), e => e.durum === 404);
  } finally { o.geri(); }
});

test("dosya: arsivle (silme yok), ara dosyalari temizle, VS tanimi dogrulama", () => {
  const o = ortamKur();
  try {
    o.yaz("a1/konu.json", { baslik_en: "x" }); o.yaz("a1/_tmp/clip.mp4", Buffer.alloc(2048)); o.yaz("a1/Videos/a1.mp4", "v");
    const t = dosya.araDosyalariTemizle("a1");
    assert.equal(t.ok, true); assert.equal(fs.existsSync(path.join(o.uretim, "a1", "_tmp")), false); assert.equal(fs.existsSync(path.join(o.uretim, "a1", "Videos", "a1.mp4")), true);
    const r = dosya.arsivle("a1");
    assert.match(r.arsiv, /^_arsiv\/a1-\d{8}-\d{6}$/);
    assert.equal(fs.existsSync(path.join(o.uretim, "a1")), false);
    assert.equal(fs.existsSync(path.join(o.uretim, r.arsiv, "Videos", "a1.mp4")), true, "arsivlenen is SILINMEZ");
    assert.throws(() => dosya.arsivle("a1"), e => e.durum === 404);
    const iyi = { baslik: "KUTUP AYISI vs BAL PORSUGU", ust: { ad: "KUTUP AYISI", renk: "3BE07A", ara: "polar bear", zorunlu: ["bear"] }, alt: { ad: "BAL PORSUGU", renk: "FFB020", ara: "honey badger" },
      olculer: [{ ad: "AGIRLIK", ustDeger: 450, ustMetin: "450 kg", altDeger: 12, altMetin: "12 kg", kazanan: "ust", not: "ortalama" }], kazanan: "ust", sonuc: "Biri kazanir.", sonuc2: "" };
    assert.deepEqual(dosya.vsDogrula(iyi), []);
    const v = dosya.vsYeni(iyi);
    assert.equal(v.ok, true);
    const tanim = JSON.parse(fs.readFileSync(path.join(o.uretim, v.ad, "vs-tanim.json"), "utf8"));
    assert.equal(tanim.surum, 1); assert.equal(tanim.ust.ara, "polar bear"); assert.deepEqual(tanim.ust.zorunlu, ["bear"]); assert.equal(tanim.olculer[0].ustDeger, 450);
    for (const kotu of [{}, Object.assign({}, iyi, { olculer: [] }), Object.assign({}, iyi, { kazanan: "orta" }), Object.assign({}, iyi, { ust: { ad: "x" } }),
      Object.assign({}, iyi, { olculer: [{ ad: "a", ustDeger: "5", ustMetin: "x", altDeger: 1, altMetin: "y", kazanan: "ust" }] })])
      assert.throws(() => dosya.vsYeni(kotu), e => e.kod === "vs_gecersiz");
    o.yaz("normal/konu.json", { baslik_en: "x" });
    assert.throws(() => dosya.vsYeni(Object.assign({}, iyi, { ad: "normal" })), e => e.durum === 409);
  } finally { o.geri(); }
});

// ---------------------------------------------------------------- isler: ses durumu
test("isler.sesDurumu: zamanlama.json kurali (ozet+dosyalar+sayi) ve eski is (kesintisiz 0..N-1)", () => {
  const o = ortamKur();
  try {
    const par = ["Birinci.", "Ikinci."];
    o.yaz("e1/Voice/parts/000.mp3", "m"); o.yaz("e1/Voice/parts/001.mp3", "m");
    const b = path.join(o.uretim, "e1");
    assert.equal(isler.sesDurumu(b, par).tamam, true, "zamanlama.json yok + kesintisiz = eski yol");
    fs.unlinkSync(path.join(b, "Voice", "parts", "000.mp3"));
    o.yaz("e1/Voice/parts/002.mp3", "m");
    assert.equal(isler.sesDurumu(b, par).tamam, false, "delikli numaralama");
    o.yaz("e1/Voice/parts/000.mp3", "m"); fs.unlinkSync(path.join(b, "Voice", "parts", "002.mp3"));
    o.yaz("e1/Voice/zamanlama.json", { surum: 1, metinOzeti: ortak.paragrafOzeti(par), paragrafSayisi: 2, paragraflar: [{ no: 0, dosya: "parts/000.mp3" }, { no: 1, dosya: "parts/001.mp3" }] });
    assert.equal(isler.sesDurumu(b, par).tamam, true);
    assert.equal(isler.sesDurumu(b, ["Birinci.", "Degisti."]).tamam, false); assert.equal(isler.sesDurumu(b, ["Birinci.", "Degisti."]).eski, true);
    assert.equal(isler.sesDurumu(b, ["Birinci.", "Ikinci.", "Ucuncu."]).tamam, false);
    fs.unlinkSync(path.join(b, "Voice", "parts", "001.mp3"));
    assert.equal(isler.sesDurumu(b, par).tamam, false, "parca dosyasi eksik");
    assert.equal(isler.sesDurumu(path.join(o.uretim, "bos"), []).tamam, false);
  } finally { o.geri(); }
});

// ---------------------------------------------------------------- toplu manifest
test("toplu.manifestOku: dizi ve {kanal,varsayilan,isler} bicimi, hatalar", () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "toplu-man-"));
  const yaz = (ad, o) => { const p = path.join(d, ad); fs.writeFileSync(p, JSON.stringify(o)); return p; };
  const iyi = { slug: "a-1", baslik_en: "B", paragraflar: ["p1", "p2"] };
  assert.equal(toplu.manifestOku(yaz("dizi.json", [iyi])).isler.length, 1);
  const m = toplu.manifestOku(yaz("nesne.json", { kanal: "KANAL", varsayilan: { dil: "tr" }, isler: [iyi] }));
  assert.equal(m.kok.kanal, "KANAL"); assert.equal(m.varsayilan.dil, "tr");
  for (const kotu of [{ isler: "x" }, [{ slug: "../x", baslik_en: "b", paragraflar: ["p"] }], [{ slug: "a", baslik_en: "", paragraflar: ["p"] }], [{ slug: "a", baslik_en: "b", paragraflar: [] }],
    [{ slug: "a", baslik_en: "b", paragraflar: ["p", ""] }], [iyi, iyi], [5]])
    assert.throws(() => toplu.manifestOku(yaz("kotu.json", kotu)), e => e.kod === "manifest" && e.cikis === 2, JSON.stringify(kotu).slice(0, 50));
  assert.throws(() => toplu.manifestOku(path.join(d, "yok.json")), e => e.kod === "manifest");
  fs.rmSync(d, { recursive: true, force: true });
});
