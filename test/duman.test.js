// DUMAN TESTLERI — projenin genel sagligi: soz dizimi, Turkce karakter bozulmasi, sir/anahtar sizintisi, bagimlilik cozumu,
// betiklerin ice alinabilirligi ve komut satiri uyumu. Ag YOK, ucretli servis YOK; gercek .env ASLA okunmaz.
//
// Bu dosya kaynakta bozuk karakterin KENDISINI yazmaz (taramanin kendisi bozuk dosya sanilmasin): desenler kod noktalarindan kurulur.
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const { spawn, spawnSync } = require("child_process");
const Module = require("module");

const KOK = path.resolve(__dirname, "..");
const ATLANAN_KLASOR = new Set(["node_modules", ".git", "uretim", "onizleme", "tmp-test", "indirilenler", "log", "marka", "coverage"]);
const KOD_UZ = new Set([".js", ".cjs", ".mjs"]);
const METIN_UZ = new Set([".js", ".cjs", ".mjs", ".json", ".md", ".html", ".css", ".bat", ".cmd", ".sh", ".yml", ".yaml", ".txt", ".ornek", ".svg", ".upstream", ".gitignore", ".gitattributes"]);
// Uzantisiz lisans metinleri de taranir (LICENSE, LICENSE.upstream)
const METIN_AD = /^LICENSE(\..+)?$/;
// Gitignore'lu CALISMA VERISI (kullanicinin API anahtarlari, karakteri, ciktilari): depoya hic girmez, hijyen taramasi da bakmaz.
// Yola gore atlanir (kok'e goreli): ayni adli baska klasorler (ornegin ai-infapp/src/data) taranmaya devam eder.
const ATLANAN_YOL = new Set(["ai-infapp/data", "ai-infapp/cikti"]);

// ---------------------------------------------------------------- dosya listesi
function yuru(dizin, cikti, kok) {
  const taban = kok || KOK;
  let girdiler = [];
  try { girdiler = fs.readdirSync(dizin, { withFileTypes: true }); } catch (e) { return cikti; }
  for (const g of girdiler) {
    const yol = path.join(dizin, g.name);
    if (g.isDirectory()) { if (!ATLANAN_KLASOR.has(g.name) && !ATLANAN_YOL.has(path.relative(taban, yol).replace(/\\/g, "/"))) yuru(yol, cikti, taban); }
    else if (g.isFile()) cikti.push(yol);
  }
  return cikti;
}
const goreli = y => path.relative(KOK, y).replace(/\\/g, "/");
const TUM = yuru(KOK, []);
const adUzanti = y => { const ad = path.basename(y); return ad.startsWith(".") && ad.indexOf(".", 1) < 0 ? ad : path.extname(ad).toLowerCase(); };
const KODLAR = TUM.filter(y => KOD_UZ.has(path.extname(y).toLowerCase()));
// gercek anahtar dosyalari ASLA okunmaz: .env ve .env.<ad> (yalniz .env.ornek serbest)
const gizliDosyaMi = y => /^\.env(\..+)?$/.test(path.basename(y)) && path.basename(y) !== ".env.ornek";
const METINLER = TUM.filter(y => !gizliDosyaMi(y) && (METIN_UZ.has(adUzanti(y)) || METIN_AD.test(path.basename(y)) || path.basename(y) === ".env.ornek") && path.basename(y) !== "package-lock.json");

async function sinirli(isler, n, calistir) {
  const sonuc = new Array(isler.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, isler.length) }, async () => {
    for (;;) { const k = i++; if (k >= isler.length) return; sonuc[k] = await calistir(isler[k], k); }
  }));
  return sonuc;
}

function alt(args, secenek) {
  return new Promise(coz => {
    const o = secenek || {};
    const c = spawn(process.execPath, args, { cwd: o.cwd || KOK, env: o.env || process.env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    let out = "", err = "";
    c.stdout.on("data", d => { out += d; }); c.stderr.on("data", d => { err += d; });
    const t = setTimeout(() => { try { c.kill("SIGKILL"); } catch (e) { /* bitmis */ } }, o.zamanAsimiMs || 60000);
    c.on("close", kod => { clearTimeout(t); coz({ kod, out, err }); });
    c.on("error", e => { clearTimeout(t); coz({ kod: -1, out, err: String(e) }); });
  });
}

test("kapsam: dosyalar bulundu (tarama bos kalip sahte yesil vermesin)", () => {
  assert.ok(KODLAR.length >= 60, "kod dosyasi sayisi: " + KODLAR.length);
  assert.ok(METINLER.length >= 80, "metin dosyasi sayisi: " + METINLER.length);
  for (const beklenen of ["panel.js", "video-yap.js", "seslendir.js", "gorsel-bul.js", "lib/ortak.js", "video-indirici/server.js", "test/duman.test.js", ".env.ornek", "package.json"])
    assert.ok(TUM.map(goreli).includes(beklenen), beklenen + " listede yok");
  assert.ok(!TUM.some(gizliDosyaMi), "gizli (.env) dosyalari taramaya GIRMEMELI");
  // uzantisiz / sira disi uzantili metin dosyalari da taranir (kabuk betigi, lisans metinleri)
  const taranan = METINLER.map(goreli);
  for (const beklenen of ["ai-infapp/baslat.sh", "ai-infapp/LICENSE", "ai-infapp/src/kutuphane/LICENSE.upstream"])
    assert.ok(taranan.includes(beklenen), beklenen + " metin taramasinda yok");
});

test("tarama yuruyusu: gitignore'lu calisma verisi (ai-infapp/data, ai-infapp/cikti) atlanir; ayni adli BASKA klasorler atlanmaz", () => {
  const gecici = fs.mkdtempSync(path.join(os.tmpdir(), "duman-yuru-"));
  try {
    const yaz = (g, ic) => { const y = path.join(gecici, ...g.split("/")); fs.mkdirSync(path.dirname(y), { recursive: true }); fs.writeFileSync(y, ic); };
    yaz("ai-infapp/data/providers.json", "{}");
    yaz("ai-infapp/data/images/a.json", "{}");
    yaz("ai-infapp/cikti/ozet.md", "x");
    yaz("ai-infapp/src/data/bilgi.json", "{}");                  // ayni ad, baska yer: taranmali
    yaz("video-indirici/data/ayar.json", "{}");
    yaz("data/kok.json", "{}");
    yaz("ai-infapp/server.js", "x");
    yaz("node_modules/x/y.js", "x");
    const bulunan = yuru(gecici, [], gecici).map(y => path.relative(gecici, y).replace(/\\/g, "/")).sort();
    assert.deepEqual(bulunan, ["ai-infapp/server.js", "ai-infapp/src/data/bilgi.json", "data/kok.json", "video-indirici/data/ayar.json"]);
  } finally { try { fs.rmSync(gecici, { recursive: true, force: true }); } catch (e) { /* kilitli */ } }
});

// ---------------------------------------------------------------- 1) soz dizimi
test("her .js/.cjs/.mjs dosyasi 'node --check' ile soz dizimi hatasiz", async () => {
  const sonuclar = await sinirli(KODLAR, 8, async y => {
    const r = await alt(["--check", y], { zamanAsimiMs: 30000 });
    return { y, kod: r.kod, err: r.err };
  });
  const bozuk = sonuclar.filter(s => s.kod !== 0).map(s => goreli(s.y) + ": " + s.err.split("\n").filter(Boolean).slice(0, 4).join(" | "));
  assert.deepEqual(bozuk, []);
});

test("her .json dosyasi gecerli JSON (BOM'suz)", () => {
  const bozuk = [];
  for (const y of TUM.filter(x => path.extname(x).toLowerCase() === ".json" && !gizliDosyaMi(x))) {
    let s;
    try { s = fs.readFileSync(y, "utf8"); } catch (e) { bozuk.push(goreli(y) + ": okunamadi"); continue; }
    if (s.charCodeAt(0) === 0xFEFF) bozuk.push(goreli(y) + ": BOM var");
    try { JSON.parse(s); } catch (e) { bozuk.push(goreli(y) + ": " + e.message); }
  }
  assert.deepEqual(bozuk, []);
});

// ---------------------------------------------------------------- 2) Turkce bozulma
// UTF-8 baytlarinin Latin-1/Windows-1252 olarak yanlis okunmasindan kalan izler: A-tilde / A-ring / A-diaeresis / A-circumflex +
// (U+0080-00BF ya da cp1252'nin tipografik karakterleri). Desen kod noktalarindan kurulur.
const IKINCI = [];
for (let k = 0x80; k <= 0xBF; k++) IKINCI.push(k);
IKINCI.push(0x152, 0x153, 0x160, 0x161, 0x178, 0x17D, 0x17E, 0x192, 0x2C6, 0x2DC, 0x2013, 0x2014, 0x2018, 0x2019, 0x201A, 0x201C, 0x201D, 0x201E, 0x2020, 0x2021, 0x2022, 0x2026, 0x2030, 0x2039, 0x203A, 0x20AC, 0x2122);
const kk = k => String.fromCharCode(k);
const MOJIBAKE = new RegExp("[" + [0xC2, 0xC3, 0xC4, 0xC5].map(kk).join("") + "][" + IKINCI.map(kk).join("") + "]|" + kk(0xE2) + kk(0x20AC) + "[" + kk(0x2122) + kk(0x153) + kk(0x201C) + kk(0x201D) + kk(0x201A) + "]");
// U+200C/U+200D (ZWNJ/ZWJ) taranmaz: emoji dizilerinde (aile, bayrak, meslek emojileri) mesru olarak bulunur
const GIZLI_KARAKTER = new RegExp("[" + ["\\u0000-\\u0008", "\\u000B", "\\u000C", "\\u000E-\\u001F", "\\u007F", "\\u200B", "\\u2060"].join("") + "]");
const KIRIK = kk(0xFFFD);
// Bu dosyalar bozuk kodlama desenini bilerek (test amaciyla) kaynakta tasir
const BOZUK_KARAKTER_MUAF = {
  "video-indirici/test/indirici-xss.test.js": "arayuz metinlerinde bozuk kodlama arayan testin kendi deseni",
};

test("tarama deseninin kendisi: bozuk kodlanmis Turkce yakalanir, temiz Turkce yakalanmaz", () => {
  const temiz = "Şehrin eski limanı; çarşı, ığdır, üzüm, öğle, İstanbul, ÇĞİÖŞÜ — “tırnak” … ® © ° ± ½ é ñ ü";
  assert.equal(MOJIBAKE.test(temiz), false, "temiz metin yanlis isaretlendi");
  for (const m of ["ğüşiöçİı", "Şehrin çarşı İstanbul", "kullanıcı ayarları", "– — “ ” … €"]) {
    const bozuk = Buffer.from(m, "utf8").toString("latin1");                     // UTF-8 -> Latin-1 olarak okunmus
    if (/[^\u0000-\u007F]/.test(m)) assert.equal(MOJIBAKE.test(bozuk), /[ğüşöçİıŞÇÖÜĞ]/.test(m), "yakalanmadi: " + JSON.stringify(m));
  }
  assert.equal(MOJIBAKE.test(Buffer.from("ü", "utf8").toString("latin1")), true);
  assert.equal(MOJIBAKE.test(Buffer.from("İ", "utf8").toString("latin1")), true);
  assert.equal(GIZLI_KARAKTER.test("a" + kk(0x200B) + "b"), true);
  assert.equal(GIZLI_KARAKTER.test("a b\tc\r\nd"), false);
});

// TextDecoder BOM'u SESSIZCE soyar (ignoreBOM:false varsayilani): decode() sonrasi charCodeAt(0)===0xFEFF hicbir zaman dogru olmaz.
// Bu yuzden BOM ham baytlardan aranir.
const bomVar = ham => ham.length >= 3 && ham[0] === 0xEF && ham[1] === 0xBB && ham[2] === 0xBF;

test("BOM denetiminin kendisi: ham baytlardaki UTF-8 BOM yakalanir, BOM'suz metin yakalanmaz", () => {
  assert.equal(bomVar(Buffer.from([0xEF, 0xBB, 0xBF, 0x61])), true);
  assert.equal(bomVar(Buffer.from("a﻿")), false, "metin ortasindaki U+FEFF BOM degildir");
  assert.equal(bomVar(Buffer.from("merhaba")), false);
  assert.equal(bomVar(Buffer.alloc(0)), false);
  // dekoder BOM'u soydugu icin eski denetim kordu: bunu kanitlar (denetim ham bayta bakmali)
  assert.equal(new TextDecoder("utf-8", { fatal: true }).decode(Buffer.from([0xEF, 0xBB, 0xBF, 0x61])).charCodeAt(0), 0x61);
});

test("hicbir metin dosyasinda Turkce bozulmasi (A-tilde/A-ring dizileri), U+FFFD, BOM, gecersiz UTF-8 ya da gorunmez karakter yok", () => {
  const sorunlar = [];
  const dekoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
  for (const y of METINLER) {
    const ad = goreli(y);
    const ham = fs.readFileSync(y);
    let s;
    try { s = dekoder.decode(ham); } catch (e) { sorunlar.push(ad + ": gecersiz UTF-8 (Windows-1254/ANSI kaydedilmis olabilir)"); continue; }
    if (bomVar(ham)) sorunlar.push(ad + ": BOM var (UTF-8 BOM'suz olmali)");
    if (BOZUK_KARAKTER_MUAF[ad]) continue;
    const satirlar = s.split("\n");
    satirlar.forEach((l, i) => {
      if (l.includes(KIRIK)) sorunlar.push(ad + ":" + (i + 1) + ": U+FFFD (kirik karakter)");
      const m = MOJIBAKE.exec(l);
      if (m) sorunlar.push(ad + ":" + (i + 1) + ": bozuk kodlama izi 'U+" + m[0].charCodeAt(0).toString(16).toUpperCase() + " U+" + m[0].charCodeAt(1).toString(16).toUpperCase() + "'");
      const g = GIZLI_KARAKTER.exec(l);
      if (g) sorunlar.push(ad + ":" + (i + 1) + ": gorunmez kontrol karakteri U+" + g[0].charCodeAt(0).toString(16).toUpperCase().padStart(4, "0"));
    });
  }
  assert.deepEqual(sorunlar, []);
});

test("kullaniciya gorunen kaynak dizgilerinde Turkce karakter korunmus (ASCII'ye dusmus 'Is bulunamadi' yok)", () => {
  const sorunlar = [];
  const kotu = [/["'`]Is bulunamadi/, /["'`]Hata olustu/, /["'`]Basarisiz oldu/, /["'`]Gecersiz is adi/, /["'`]Kullanim: node/];
  for (const y of KODLAR.filter(x => !goreli(x).startsWith("test/") && !goreli(x).includes("/test/"))) {
    const s = fs.readFileSync(y, "utf8");
    for (const d of kotu) if (d.test(s)) sorunlar.push(goreli(y) + ": " + d.source);
  }
  assert.deepEqual(sorunlar, []);
});

// ---------------------------------------------------------------- 3) sir / anahtar taramasi
function entropi(s) {
  const say = new Map();
  for (const c of s) say.set(c, (say.get(c) || 0) + 1);
  let e = 0;
  for (const n of say.values()) { const p = n / s.length; e -= p * Math.log2(p); }
  return e;
}
const YER_TUTUCU = /test|sahte|fake|dummy|ornek|örnek|example|xxx|gizli|placeholder|your|anahtar|sample|demo|deger|değer|secret|token|key|\.\.\.|<|>/i;
const ANAHTAR_DESENLERI = [
  ["Anthropic anahtari", /sk-ant-[A-Za-z0-9_-]{20,}/],
  ["OpenAI benzeri anahtar", /\bsk-[A-Za-z0-9]{32,}\b/],
  ["OpenAI proje/servis anahtari", /\bsk-(?:proj|svcacct|admin)-[A-Za-z0-9_-]{20,}/],
  ["Replicate jetonu", /\br8_[A-Za-z0-9]{30,}\b/],
  ["AWS erisim anahtari", /\bAKIA[0-9A-Z]{16}\b/],
  ["Google API anahtari", /\bAIza[0-9A-Za-z_-]{35}\b/],
  ["GitHub jetonu", /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36,}\b|\bgithub_pat_[A-Za-z0-9_]{40,}/],
  ["Slack jetonu", /\bxox[baprs]-[A-Za-z0-9-]{10,}/],
  ["Hugging Face jetonu", /\bhf_[A-Za-z0-9]{30,}\b/],
  ["Ozel anahtar blogu", /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----/],
  ["Bearer jetonu", /\bBearer\s+[A-Za-z0-9._~+/-]{30,}={0,2}/],
];
const ATAMA = /^\s*(?:export\s+)?(ANTHROPIC_API_KEY|VIDIQ_KEY|PEXELS_KEY|PIXABAY_KEY|UNSPLASH_KEY|AZURE_SPEECH_KEY|CF_API_TOKEN|CF_ACCOUNT_ID|TOGETHER_KEY|HF_TOKEN)\s*=\s*["']?([^\s"'#]+)/;
function gercekGibiMi(deger) {
  return deger.length >= 16 && /[A-Za-z]/.test(deger) && /\d/.test(deger) && entropi(deger) >= 3.2 && !YER_TUTUCU.test(deger);
}
function sirTara(metin) {
  const bulunan = [];
  metin.split("\n").forEach((l, i) => {
    for (const [ad, re] of ANAHTAR_DESENLERI) if (re.test(l)) bulunan.push({ satir: i + 1, tur: ad });
    const a = ATAMA.exec(l);
    if (a && gercekGibiMi(a[2])) bulunan.push({ satir: i + 1, tur: a[1] + " icin gercek gibi deger" });
  });
  return bulunan;
}

test("sir taramasinin kendisi: gercek gibi anahtarlari yakalar, yer tutuculari ve belge ornegini yakalamaz", () => {
  const rastgele = n => crypto.randomBytes(n).toString("base64url") + "a7";   // en az bir harf ve bir rakam garanti: rastgele dizi nadiren rakamsiz cikip testi dalgalandiriyordu
  assert.equal(sirTara("anahtar = " + "sk-ant-" + "api03-" + rastgele(40)).length, 1);
  assert.equal(sirTara("PEXELS_KEY=" + rastgele(30)).length, 1);
  assert.equal(sirTara("ANTHROPIC_API_KEY=" + "sk-ant-" + rastgele(30)).length >= 1, true);
  assert.equal(sirTara("x " + "AKIA" + "ABCDEFGHIJKLMNOP").length, 1);
  assert.equal(sirTara("-----BEGIN " + "PRIVATE KEY-----").length, 1);
  // ai-infapp'in sakladigi guncel bicimler: tireli OpenAI proje/servis anahtari, Replicate jetonu
  for (const onek of ["sk-" + "proj-", "sk-" + "svcacct-", "sk-" + "admin-"]) assert.equal(sirTara("anahtar: " + onek + rastgele(60)).length, 1, onek);
  assert.equal(sirTara("token " + "r8" + "_" + crypto.randomBytes(20).toString("hex")).length, 1);
  for (const guvenli of ["PEXELS_KEY=", "PEXELS_KEY=buraya-yaz", "VIDIQ_KEY=GIZLI-DEGER", "ANTHROPIC_API_KEY=sk-ant-...", "PIXABAY_KEY=test123", "HF_TOKEN=xxxxxxxxxxxxxxxxxxxx", "# ANTHROPIC_API_KEY=anahtarini_yaz", "const x = process.env.PEXELS_KEY;"])
    assert.deepEqual(sirTara(guvenli), [], guvenli);
});

test("hicbir dosyada gercek anahtar/jeton/ozel anahtar bicimi yok (kaynak, test, belge, veri)", () => {
  const sorunlar = [];
  for (const y of METINLER) {
    for (const b of sirTara(fs.readFileSync(y, "utf8"))) sorunlar.push(goreli(y) + ":" + b.satir + ": " + b.tur);
  }
  assert.deepEqual(sorunlar, [], "olasi sizinti (deger yazilmaz, yalniz konum): " + sorunlar.join("; "));
});

test(".env hijyeni: .gitignore .env/uretim/panel-ayar.json'u yok sayar; .env.ornek yalniz bos/yer tutucu deger tasir; git .env izlemez", () => {
  const gi = fs.readFileSync(path.join(KOK, ".gitignore"), "utf8").split(/\r?\n/).map(s => s.trim());
  for (const kural of [".env", "uretim/", "node_modules/", "panel-ayar.json"]) assert.ok(gi.includes(kural), ".gitignore'da yok: " + kural);
  assert.ok(gi.includes("!.env.ornek"), ".env.ornek istisnasi yok");
  assert.ok(!gi.includes("package-lock.json"), "package-lock.json depoya girmeli (npm ci)");
  const ornek = fs.readFileSync(path.join(KOK, ".env.ornek"), "utf8");
  const atamalar = ornek.split(/\r?\n/).map(l => /^([A-Z][A-Z0-9_]*)=(.*)$/.exec(l)).filter(Boolean);       // bos degerler de dahil
  assert.ok(atamalar.length >= 10, ".env.ornek anahtar adlarini listelemeli (" + atamalar.length + ")");
  for (const a of atamalar) assert.ok(a[2].trim() === "" || !gercekGibiMi(a[2].trim()), ".env.ornek icinde gercek gibi deger: " + a[1]);
  for (const ad of ["ANTHROPIC_API_KEY", "ANTHROPIC_MODEL", "VIDIQ_KEY", "PEXELS_KEY", "PIXABAY_KEY", "AZURE_SPEECH_KEY", "AZURE_SPEECH_REGION", "PIPER_YOL", "PIPER_MODEL"])
    assert.match(ornek, new RegExp("^#?\\s*" + ad + "=", "m"), ad + " .env.ornek'te yok");
  assert.match(ornek, /^UNSPLASH_KEY=\s*$/m, "Unsplash anahtari bos yer tutucu olmali");
  const git = spawnSync("git", ["ls-files"], { cwd: KOK, encoding: "utf8", windowsHide: true });
  if (git.status === 0 && git.stdout.trim()) {
    const izlenen = git.stdout.split(/\r?\n/).filter(Boolean);
    const kotu = izlenen.filter(f => /^\.env(\..+)?$/.test(f) && f !== ".env.ornek" || /^panel-ayar\.json$/.test(f) || /^uretim\//.test(f) || /^node_modules\//.test(f));
    assert.deepEqual(kotu, [], "git'in izledigi gizli/uretilen dosyalar");
  }
});

test("README: yalniz process.env'den okunan portlar (PANEL_PORT, AIINFAPP_PORT) '.env dosyasina yazilabilir' tablosunda ilan edilmez; ayri 'yalniz ortam degiskeni' notunda durur", () => {
  const readme = fs.readFileSync(path.join(KOK, "README.md"), "utf8");
  const panelKodu = fs.readFileSync(path.join(KOK, "panel.js"), "utf8");
  const bas = readme.indexOf("`.env` dosyasına (ya da ortam değişkeni olarak) yazılabilir");
  const son = readme.indexOf("**Portlar yalnızca ortam değişkeni", bas);
  assert.ok(bas > 0 && son > bas, ".env tablosu ve port notu README'de bulunamadi");
  const envTablosu = readme.slice(bas, son);
  for (const ad of ["PANEL_PORT", "AIINFAPP_PORT"]) {
    assert.match(panelKodu, new RegExp("process\\.env\\." + ad + "\\b"), ad + " panel.js'te process.env'den okunmuyor: test eskidi");
    assert.doesNotMatch(panelKodu, new RegExp("envOku\\(\\s*[\"']" + ad + "[\"']"), ad + " .env'den okunuyorsa README tablosuna geri konabilir");
    assert.ok(!envTablosu.includes("`" + ad + "`"), ad + " .env tablosunda: panel .env'i okumuyor, deger sessizce yok sayilir");
    assert.ok(readme.slice(son).includes("`" + ad + "`"), ad + " ortam degiskeni notunda yok");
  }
});

// ---------------------------------------------------------------- 4) bagimlilik cozumu
const YAPI = JSON.parse(fs.readFileSync(path.join(KOK, "package.json"), "utf8"));

test("package.json: surum/engines/test betigi var; bagimliliklar YALNIZ sdk + msedge-tts + ws (baska yeni paket eklenmemis); sahte yesil icin 'test' tum test dosyalarini kapsar", () => {
  assert.match(YAPI.version, /^\d+\.\d+\.\d+$/);
  assert.ok(YAPI.engines && /\d/.test(YAPI.engines.node), "engines.node yok");
  // ws: msedge-tts'in zaten getirdigi paket; Edge sesi onarimi (lib/ses-motor-edge.js) onu DOGRUDAN kullandigi icin acikca bildirilir
  assert.deepEqual(Object.keys(YAPI.dependencies || {}).sort(), ["@anthropic-ai/sdk", "msedge-tts", "ws"]);
  assert.match(YAPI.scripts.test, /node --test/);
  assert.match(YAPI.scripts.test, /test\/\*\*\/\*\.test\.js/, "test betigi test/**/*.test.js desenini icermeli");
  const testler = TUM.filter(y => /\.test\.js$/.test(y) && goreli(y).startsWith("test/")).map(goreli);
  assert.ok(testler.includes("test/duman.test.js"));
  assert.ok(testler.filter(t => t.startsWith("test/birim-")).length >= 6, "birim testleri: " + testler.filter(t => t.startsWith("test/birim-")).join());
  const lock = JSON.parse(fs.readFileSync(path.join(KOK, "package-lock.json"), "utf8"));
  assert.equal(lock.packages[""].dependencies["msedge-tts"] !== undefined, true, "package-lock.json package.json ile uyumlu olmali");
});

const YERLESIK = new Set(Module.builtinModules.map(m => m.replace(/^node:/, "")));
function requireler(kod) {
  const sonuc = [];
  kod.split("\n").forEach((l, i) => {
    const t = l.trim();
    if (t.startsWith("//") || t.startsWith("*") || t.startsWith("/*")) return;
    for (const m of l.matchAll(/(?<![.\w])require\(\s*(["'])([^"']+)\1\s*\)/g)) sonuc.push({ satir: i + 1, ad: m[2] });
  });
  return sonuc;
}
function cozulur(kaynakDosya, ad, bagimlilik) {
  if (ad.startsWith(".")) {
    const taban = path.resolve(path.dirname(kaynakDosya), ad);
    return [taban, taban + ".js", taban + ".cjs", taban + ".json", path.join(taban, "index.js")].some(x => { try { return fs.statSync(x).isFile(); } catch (e) { return false; } });
  }
  const duz = ad.replace(/^node:/, "");                       // "node:test" gibi onekli yerlesik modul adlari
  const kok = duz.startsWith("@") ? duz.split("/").slice(0, 2).join("/") : duz.split("/")[0];
  // Node 22'de builtinModules "node:test" gibi YALNIZ onekli modulleri icermez (Node 24 icerir); isBuiltin ikisini de bilir
  return YERLESIK.has(kok) || YERLESIK.has(duz) || Module.isBuiltin(ad) || bagimlilik.has(kok);
}

test("her require() cozulur: goreli yollar var olan dosyaya, cplak adlar yerlesik modul ya da package.json bagimliligina gider", () => {
  const sorunlar = [];
  const bag = new Set(Object.keys(YAPI.dependencies || {}));
  for (const y of KODLAR) {
    const r = goreli(y);
    // video-indirici bagimsiz paket: kendi package.json'una gore
    const ind = r.startsWith("video-indirici/");
    let bagimlilik = bag;
    if (ind) { try { bagimlilik = new Set(Object.keys(JSON.parse(fs.readFileSync(path.join(KOK, "video-indirici", "package.json"), "utf8")).dependencies || {})); } catch (e) { bagimlilik = new Set(); } }
    for (const q of requireler(fs.readFileSync(y, "utf8"))) {
      if (!cozulur(y, q.ad, ind && r.includes("/test/") ? new Set([...bagimlilik, ...bag]) : bagimlilik)) sorunlar.push(r + ":" + q.satir + ": require('" + q.ad + "')");
    }
  }
  assert.deepEqual(sorunlar, []);
});

// ---------------------------------------------------------------- 5) ice alinabilirlik (require.main korumasi)
const ICE_ALINABILIR = KODLAR.map(goreli).filter(r => !r.includes("/") && !/^toplu-uret/.test(r));      // kok betikler (toplu-uret*.cjs yalniz komut satiri kabugudur)

test("kok betikler ice alinabilir: require() ne cikis yapar, ne yazdirir, ne is klasoru acar, ne ag/sunucu baslatir", async () => {
  const gecici = fs.mkdtempSync(path.join(os.tmpdir(), "duman-ice-"));
  try {
    const env = Object.assign({}, process.env, { OTOMASYON_URETIM: path.join(gecici, "uretim"), OTOMASYON_ENV_DOSYASI: path.join(gecici, ".env"),
      OTOMASYON_AYAR_DOSYASI: path.join(gecici, "ayar.json"), PANEL_PORT: "4399", PANEL_INDIRICI_KAPALI: "1" });
    fs.writeFileSync(env.OTOMASYON_ENV_DOSYASI, "");
    for (const k of ["ANTHROPIC_API_KEY", "VIDIQ_KEY", "PEXELS_KEY", "PIXABAY_KEY"]) delete env[k];
    const sonuclar = await sinirli(ICE_ALINABILIR, 6, async r => {
      const x = await alt(["-e", "const m = require('./" + r + "'); setTimeout(() => process.exit(0), 150);"], { env, zamanAsimiMs: 30000 });
      return { r, kod: x.kod, out: x.out.trim(), err: x.err.trim() };
    });
    const sorun = sonuclar.filter(s => s.kod !== 0 || s.out || s.err).map(s => s.r + " (kod " + s.kod + ") " + (s.out + " " + s.err).slice(0, 120));
    assert.deepEqual(sorun, []);
    assert.equal(fs.existsSync(env.OTOMASYON_URETIM) ? fs.readdirSync(env.OTOMASYON_URETIM).length : 0, 0, "ice alma is klasoru acmamali");
  } finally { try { fs.rmSync(gecici, { recursive: true, force: true }); } catch (e) { /* kilitli */ } }
});

// ---------------------------------------------------------------- 6) komut satiri uyumu ve hata davranisi
const IS_ALAN = ["senaryo-claude.js", "senaryo-yaz.js", "gorsel-bul.js", "gorsel-cek.js", "portre-cek.js", "gorsel-uret.js", "formul-kart.js", "prompt-kart.js",
  "seslendir.js", "video-yap.js", "kapak-yap.js", "yayin-paketi.js", "baslik-analiz.js", "altyazi-cevir.js", "vs-yap.js", "vs-gorsel-duzelt.js", "vs-kur.js"];
const ARGUMANSIZ_HATA = IS_ALAN.filter(s => s !== "vs-kur.js").concat(["performans.js", "yeni-is.js", "video-seslendir.js", "shorts-kes.cjs", "kesit-bul.cjs", "toplu-uret.cjs", "toplu-uret-uzun.cjs"]);
const yigin = /\n\s+at\s+\S+.*\(.*:\d+:\d+\)|\n\s+at\s+.*\.js:\d+:\d+/;

function izoleOrtam() {
  const kok = fs.mkdtempSync(path.join(os.tmpdir(), "duman-cli-"));
  const env = Object.assign({}, process.env, { OTOMASYON_URETIM: path.join(kok, "uretim"), OTOMASYON_ENV_DOSYASI: path.join(kok, ".env"), OTOMASYON_AYAR_DOSYASI: path.join(kok, "ayar.json") });
  fs.mkdirSync(env.OTOMASYON_URETIM, { recursive: true });
  fs.writeFileSync(env.OTOMASYON_ENV_DOSYASI, "");
  for (const k of ["ANTHROPIC_API_KEY", "ANTHROPIC_MODEL", "VIDIQ_KEY", "PEXELS_KEY", "PIXABAY_KEY", "AZURE_SPEECH_KEY"]) delete env[k];
  return { kok, env, uretim: env.OTOMASYON_URETIM, temizle: () => { try { fs.rmSync(kok, { recursive: true, force: true }); } catch (e) { /* kilitli */ } } };
}

test("argumansiz cagri: kullanim mesaji + cikis 2 (yigin izi yok, ag/ucretli cagri yok)", async () => {
  const o = izoleOrtam();
  try {
    const sonuclar = await sinirli(ARGUMANSIZ_HATA, 6, async s => { const r = await alt([s], { env: o.env, zamanAsimiMs: 45000 }); return Object.assign({ s }, r); });
    const sorun = [];
    for (const r of sonuclar) {
      if (r.kod !== 2) sorun.push(r.s + ": cikis " + r.kod + " (2 bekleniyordu) " + r.err.slice(0, 100));
      else if (!/Kullanım|✗/.test(r.err + r.out)) sorun.push(r.s + ": kullanim mesaji yok");
      else if (yigin.test(r.err)) sorun.push(r.s + ": yigin izi sizdi");
    }
    assert.deepEqual(sorun, []);
    assert.deepEqual(fs.readdirSync(o.uretim), [], "argumansiz cagri is klasoru acmamali");
  } finally { o.temizle(); }
});

test("olmayan ya da gecersiz is adi: cikis 2, Turkce '✗' satiri, yigin izi yok, HAYALET is klasoru acilmaz (kapak-yap/yayin-paketi hatasi)", async () => {
  const o = izoleOrtam();
  try {
    for (const ad of ["hayalet-is", "..\\disari", "../disari", "a/b", "con"]) {
      const sonuclar = await sinirli(IS_ALAN, 6, async s => { const r = await alt([s, ad], { env: o.env, zamanAsimiMs: 45000 }); return Object.assign({ s }, r); });
      const sorun = [];
      for (const r of sonuclar) {
        if (r.kod !== 2) sorun.push(r.s + " " + ad + ": cikis " + r.kod + " (2 bekleniyordu) " + r.err.slice(0, 100));
        else if (!/✗ /.test(r.err)) sorun.push(r.s + " " + ad + ": '✗' satiri yok");
        else if (yigin.test(r.err)) sorun.push(r.s + " " + ad + ": yigin izi sizdi");
      }
      assert.deepEqual(sorun, [], "is adi: " + ad);
      assert.deepEqual(fs.readdirSync(o.uretim), [], "is adi '" + ad + "' icin klasor acilmis: " + fs.readdirSync(o.uretim).join());
      assert.equal(fs.existsSync(path.join(o.kok, "disari")), false, "uretim disina yazilmis");
    }
    // kesitli betikler
    fs.writeFileSync(path.join(o.kok, "k.json"), JSON.stringify([{ ad: "a", bas: 1, sure: 5 }]));
    for (const [betik, args] of [["shorts-kes.cjs", ["hayalet-is", path.join(o.kok, "k.json")]], ["kesit-bul.cjs", ["hayalet-is", "--otomatik", path.join(o.kok, "o.json")]]]) {
      const r = await alt([betik, ...args], { env: o.env, zamanAsimiMs: 45000 });
      assert.equal(r.kod, 2, betik + ": " + r.err.slice(0, 120));
    }
    assert.deepEqual(fs.readdirSync(o.uretim), []);
  } finally { o.temizle(); }
});

test("anahtar gerektiren araclar anahtar yokken '✗ ... VIDIQ_KEY' + cikis 2 (sessiz 0 degil)", async () => {
  const o = izoleOrtam();
  try {
    for (const args of [["trend-ara.js", "uzay"], ["viral-analiz.js", "uzay", "en", "100000"]]) {
      const r = await alt(args, { env: o.env, zamanAsimiMs: 45000 });
      assert.equal(r.kod, 2, args[0] + ": " + r.err.slice(0, 120));
      assert.match(r.err, /VIDIQ_KEY/);
    }
  } finally { o.temizle(); }
});

test("eski komut satiri bicimleri kabul edilir (argumanCoz): konumsal, --ad deger, --ad=deger, '--' sonrasi; yeni bayraklar eskilerle birlikte", () => {
  const ortak = require("../lib/ortak");
  const r = ortak.argumanCoz(["is1", "--yeniden", "--sahne", "3", "--ara=polar bear", "--", "--tuhaf-ad"], { deger: ["sahne"] });
  assert.deepEqual(r.konum, ["is1", "--tuhaf-ad"]);
  assert.deepEqual(r.bayrak, { yeniden: true, sahne: "3", ara: "polar bear" });
  assert.deepEqual(ortak.argumanCoz(["--test", "o.mp3", "--motor", "edge"], { deger: ["test", "motor"] }).bayrak, { test: "o.mp3", motor: "edge" });
  assert.deepEqual(ortak.argumanCoz(["--onizleme=30"], {}).bayrak, { onizleme: "30" });
  assert.deepEqual(ortak.argumanCoz(["--onizleme"], {}).bayrak, { onizleme: true });
  assert.deepEqual(ortak.argumanCoz([], {}), { konum: [], bayrak: {} });
  assert.deepEqual(ortak.argumanCoz(null, {}), { konum: [], bayrak: {} });
  // sozlesme 7.1: 0 basari, 1 genel, 2 girdi/yapilandirma, 3 dis servis, 4 yetersiz sonuc, 5 disk, 6 kilit, 7 maliyet siniri
  const c = ortak.CIKIS;
  assert.deepEqual([c.BASARI, c.GENEL, c.GIRDI, c.SERVIS, c.YETERSIZ, c.DISK, c.KILIT, c.MALIYET], [0, 1, 2, 3, 4, 5, 6, 7]);
});
