// Donanim profili (lib/donanim.js), SHA256 butunlugu (lib/butunluk.js, araclar/sha256.js) ve olcum belgesi.
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");

const D = require("../lib/donanim");
const B = require("../lib/butunluk");
const KOK = path.join(__dirname, "..");
const GB = 1073741824;

const nv = (vramGB, ad) => ({ marka: "nvidia", ad: ad || "NVIDIA Test", vramGB, bosVramGB: vramGB, vramKesin: true });
const makine = (ramGB, kartlar) => ({ ram: { toplamGB: ramGB, bosGB: ramGB / 2 }, kartlar: kartlar || [] });
const env = o => n => (o || {})[n];

test("profilSec: esikler (cok-dusuk / dusuk / orta / yuksek)", () => {
  assert.equal(D.profilSec(makine(4, [nv(8)]), env()).ad, "cok-dusuk");
  assert.equal(D.profilSec(makine(8, [nv(8)]), env()).ad, "dusuk", "12 GB alti bellek");
  assert.equal(D.profilSec(makine(16, []), env()).ad, "dusuk", "NVIDIA yok");
  assert.equal(D.profilSec(makine(16, [nv(2)]), env()).ad, "dusuk", "2 GB kart");
  assert.equal(D.profilSec(makine(16, [nv(8)]), env()).ad, "orta");
  assert.equal(D.profilSec(makine(32, [nv(12)]), env()).ad, "yuksek");
  assert.equal(D.profilSec(makine(32, [nv(8)]), env()).ad, "orta", "yuksek icin kart da 10 GB olmali");
});

test("profilSec: render ayarlari ve DONANIM_PROFIL ezmesi", () => {
  const c = D.profilSec(makine(4), env());
  assert.equal(c.renderBellek, 2); assert.equal(c.paralelMax, 1); assert.equal(c.voxcpm.ok, false);
  assert.equal(D.profilSec(makine(7), env()).renderBellek, 1, "8 GB alti dusuk profilde dusuk bellek");
  assert.equal(D.profilSec(makine(10), env()).renderBellek, 0);
  const z = D.profilSec(makine(64, [nv(24)]), env({ DONANIM_PROFIL: "dusuk" }));
  assert.equal(z.ad, "dusuk"); assert.match(z.neden, /DONANIM_PROFIL/);
  assert.equal(D.profilSec(makine(64, [nv(24)]), env({ DONANIM_PROFIL: "saçma" })).ad, "yuksek", "gecersiz ezme yok sayilir");
});

test("voxcpmUygun: CUDA icin NVIDIA >= 4 GB; Vulkan icin herhangi bir kart; VOXCPM_ZORLA atlar", () => {
  assert.equal(D.voxcpmUygun(makine(16, []), "cuda", env()).ok, false);
  assert.match(D.voxcpmUygun(makine(16, [nv(2, "GTX 1050")]), "cuda", env()).neden, /2 GB.*4 GB/);
  assert.equal(D.voxcpmUygun(makine(16, [nv(4)]), "cuda", env()).ok, true);
  assert.equal(D.voxcpmUygun(makine(16, [{ marka: "amd", ad: "Radeon RX 580", vramGB: 4 }]), "vulkan", env()).ok, true);
  assert.equal(D.voxcpmUygun(makine(16, [{ marka: "amd", ad: "Radeon RX 580", vramGB: 4 }]), "cuda", env()).ok, false);
  assert.equal(D.voxcpmUygun(makine(16, []), "cuda", env({ VOXCPM_ZORLA: "1" })).ok, true);
});

test("ekran karti ciktilari: nvidia-smi, Windows WMI, macOS", () => {
  const n = D.nvidiaCoz("NVIDIA GeForce RTX 5060 Laptop GPU, 8151, 7899, 610.88\nNVIDIA GeForce GTX 1050 Ti, 4096, 3900, 537.13\n");
  assert.equal(n.length, 2);
  assert.deepEqual([n[0].vramGB, n[0].bosVramGB, n[0].surucu, n[0].vramKesin], [8, 7.7, "610.88", true]);
  assert.equal(n[1].vramGB, 4);
  const w = D.windowsCoz(JSON.stringify([{ Name: "AMD Radeon RX 580", AdapterRAM: 4293918720, DriverVersion: "31.0" }, { Name: "Intel(R) UHD Graphics", AdapterRAM: 2147479552 }]));
  assert.deepEqual(w.map(k => k.marka), ["amd", "intel"]);
  assert.equal(w[0].vramKesin, false, "WMI 4 GB ustunu dogru gostermez");
  assert.deepEqual(D.windowsCoz("{\"Name\":\"NVIDIA GeForce GTX 1650\",\"AdapterRAM\":4293918720}").map(k => k.marka), ["nvidia"], "tek kart nesne olarak gelir");
  assert.deepEqual(D.windowsCoz("bozuk"), []);
  const m = D.macCoz(JSON.stringify({ SPDisplaysDataType: [{ sppci_model: "Apple M2", sppci_vendor: "Apple" }] }));
  assert.equal(m[0].marka, "apple");
  assert.equal(D.markaBul("NVIDIA GeForce GTX 1050 Ti"), "nvidia");
});

test("render: az toplam bellekte bastan en dusuk bellek ve tek paralel is (donanim profili)", () => {
  const F = require("../lib/render-ffmpeg");
  const asil = { free: os.freemem, total: os.totalmem };
  const asilEnv = process.env.RENDER_DUSUK_BELLEK;
  try {
    delete process.env.RENDER_DUSUK_BELLEK; delete process.env.DONANIM_PROFIL;
    os.freemem = () => 3.5 * GB; os.totalmem = () => 4 * GB;
    F.kodlayiciSabitle(null); F.bellekSifirla();
    const p = F.bellekProfili();
    assert.equal(p.seviye, 2); assert.equal(p.kaynak, "donanim"); assert.match(p.neden, /cok-dusuk/);
    assert.equal(F.paralellik().n, 1);
    os.totalmem = () => 32 * GB; os.freemem = () => 16 * GB; F.bellekSifirla();
    assert.equal(F.bellekProfili().seviye, 0, "yeterli bellekte etkisiz");
  } finally {
    os.freemem = asil.free; os.totalmem = asil.total; F.bellekSifirla();
    if (asilEnv === undefined) delete process.env.RENDER_DUSUK_BELLEK; else process.env.RENDER_DUSUK_BELLEK = asilEnv;
  }
});

test("butunluk: sha256, SHA256SUMS bicimi ve dogrulama (bozuk / eksik)", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "otopilot-sha-"));
  try {
    fs.mkdirSync(path.join(dir, "alt"));
    fs.writeFileSync(path.join(dir, "alt", "a.bin"), Buffer.from([0, 1, 2, 255]));
    fs.writeFileSync(path.join(dir, "b.wav"), "RIFF");
    const beklenen = crypto.createHash("sha256").update(Buffer.from([0, 1, 2, 255])).digest("hex");
    assert.equal(await B.sha256Dosya(path.join(dir, "alt", "a.bin")), beklenen);
    const liste = [{ yol: "b.wav", sha: await B.sha256Dosya(path.join(dir, "b.wav")) }, { yol: "alt/a.bin", sha: beklenen }];
    const metin = B.sumsYaz(liste);
    assert.match(metin, /^[0-9a-f]{64} {2}alt\/a\.bin\n[0-9a-f]{64} {2}b\.wav\n$/, "sirali, iki bosluk, / ayirac");
    assert.deepEqual(B.sumsCoz(metin.replace(/\n/g, "\r\n")).map(x => x.yol), ["alt/a.bin", "b.wav"], "CRLF de okunur");
    let s = await B.sumsDogrula(dir, B.sumsCoz(metin));
    assert.equal(s.tamam.length, 2);
    fs.writeFileSync(path.join(dir, "b.wav"), "RIFX");
    fs.rmSync(path.join(dir, "alt", "a.bin"));
    s = await B.sumsDogrula(dir, B.sumsCoz(metin));
    assert.deepEqual(s.hatali.map(h => h.yol), ["b.wav"]); assert.deepEqual(s.eksik, ["alt/a.bin"]);
    // onbellek: ayni boyut+tarih -> yeniden okunmaz
    const ob = path.join(dir, "ob.json");
    const r1 = await B.sha256Onbellekli(path.join(dir, "b.wav"), ob);
    const r2 = await B.sha256Onbellekli(path.join(dir, "b.wav"), ob);
    assert.equal(r1.onbellek, false); assert.equal(r2.onbellek, true); assert.equal(r1.sha, r2.sha);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("depo: SHA256SUMS guncel (ikili dosya ekleyen/degistiren `node araclar/sha256.js --yaz` calistirmali)", async (t) => {
  const S = require("../araclar/sha256.js");
  let kapsam;
  try { kapsam = S.kapsamDosyalari(); } catch (e) { return t.skip("git yok"); }
  assert.ok(kapsam.length > 0);
  const s = await S.depoDogrula();
  assert.deepEqual({ hatali: s.hatali.map(h => h.yol), eksik: s.eksik, yeni: s.yeni }, { hatali: [], eksik: [], yeni: [] });
});

test("data/model-sha256.json: gecerli sha256 ve kur.ps1 ile ayni model boyutu", () => {
  const m = JSON.parse(fs.readFileSync(path.join(KOK, "data", "model-sha256.json"), "utf8"));
  for (const d of m.voxcpm2.dosyalar) assert.match(d.sha256, /^[0-9a-f]{64}$/, d.ad);
  const model = m.voxcpm2.dosyalar.find(d => d.ayar === "model");
  assert.equal(model.boyut, 2955000480);
  assert.match(model.url, /\/resolve\/[0-9a-f]{40}\//, "URL bir commit'e sabit (main degil)");
});

test("belgeler: profil tablosu esiklerle, sorun teshisi hata tablosuyla uyumlu", () => {
  const dd = fs.readFileSync(path.join(KOK, "docs", "DUSUK_DONANIM.md"), "utf8");
  const tablo = dd.slice(dd.indexOf("<!-- PROFIL-BASLA -->"), dd.indexOf("<!-- PROFIL-BIT -->"));
  for (const p of D.PROFILLER) assert.match(tablo, new RegExp("`" + p + "`"), p);
  const E = D.ESIK;
  assert.match(tablo, new RegExp("< " + E.cokDusukRam + " GB"));
  assert.match(tablo, new RegExp("< " + E.dusukRam + " GB"));
  assert.match(tablo, new RegExp("≥ " + E.yuksekRam + " GB ve NVIDIA ≥ " + E.yuksekVram + " GB"));
  assert.match(tablo, new RegExp(E.voxcpmVram + " GB"));
  const st = fs.readFileSync(path.join(KOK, "docs", "SORUN_TESHIS.md"), "utf8");
  for (const t of require("../lib/ortak").HATA_TABLOSU) assert.ok(st.includes("`" + t.kod + "`"), "SORUN_TESHIS.md'de yok: " + t.kod);
});

test("olcum: belge satiri ve OLCUMLER.md isaretleri", () => {
  const O = require("../araclar/olcum.js");
  const satir = O.belgeSatiri({ tarih: "2026-11-21", surum: "1.28.0", profil: "orta",
    donanim: { cpu: { ad: "Test CPU" }, ram: { toplamGB: 16 }, kartlar: [{ marka: "nvidia", ad: "RTX Test", vramGB: 8 }] },
    kodlama: [{ etiket: "nvidia", donanim: true, ok: true, saniye: 1.7, gercekZamanOrani: 11.96 }, { etiket: "intel", donanim: true, ok: true, saniye: 5.3, gercekZamanOrani: 3.77 },
      { etiket: "cpu", ok: true, saniye: 56.9, gercekZamanOrani: 0.35 }, { etiket: "cpu-hafif", ok: true, saniye: 12, gercekZamanOrani: 1.67 }],
    ses: null, piper: { ok: true, saniye: 0.9, sesSaniye: 8.1 } });
  assert.equal(satir, "| 2026-11-21 | Test CPU | 16 GB | RTX Test 8 GB | orta | 56.9 sn (0.35x) | 12 sn (1.67x) | NVENC 1.7 sn · Quick Sync 5.3 sn | Piper 0.9 sn → 8.1 sn | 1.28.0 |");
  const md = fs.readFileSync(path.join(KOK, "docs", "OLCUMLER.md"), "utf8");
  assert.ok(md.indexOf("<!-- OLCUM-BASLA -->") < md.indexOf("<!-- OLCUM-BIT -->"));
  for (const f of fs.readdirSync(path.join(KOK, "olcumler")).filter(f => f.endsWith(".json"))) {
    const j = JSON.parse(fs.readFileSync(path.join(KOK, "olcumler", f), "utf8"));
    assert.ok(j.kodlama && j.donanim && j.surum, f);
    assert.ok(!/Users[\\/]|@|\.env/i.test(JSON.stringify(j)), "olcum dosyasinda kisisel veri olmamali: " + f);
  }
});

// ---------------------------------------------------------------- en kotu PC: hafif mod, zaman asimi, 720p, kodlayicilar, indirme
function sahteMakine(ramGB, cekirdek, fn) {
  const asil = { total: os.totalmem, ap: os.availableParallelism, cm: process.constrainedMemory };
  os.totalmem = () => ramGB * GB;
  os.availableParallelism = () => cekirdek;
  process.constrainedMemory = () => 0;
  try { return fn(); } finally { os.totalmem = asil.total; os.availableParallelism = asil.ap; process.constrainedMemory = asil.cm; }
}

test("hafifRender / zamanCarpani / cozunurlukOlcek: zayif makine ve ezmeler", () => {
  sahteMakine(32, 16, () => {
    assert.equal(D.hafifRender(env()).ok, false);
    assert.equal(D.zamanCarpani(env()), 1);
    assert.equal(D.cozunurlukOlcek(env()).olcek, 1);
    assert.equal(D.hafifRender(env({ DONANIM_PROFIL: "cok-dusuk" })).ok, true, "profil ezmesi hafif modu acar");
    assert.equal(D.zamanCarpani(env({ DONANIM_PROFIL: "cok-dusuk" })), 3);
    assert.equal(D.cozunurlukOlcek(env({ RENDER_COZUNURLUK: "720" })).olcek, 2 / 3);
  });
  sahteMakine(16, 4, () => {
    assert.match(D.hafifRender(env()).neden, /4 mantıksal çekirdek/);
    assert.equal(D.zamanCarpani(env()), 2);
    assert.equal(D.hafifRender(env({ RENDER_HAFIF: "0" })).ok, false, "RENDER_HAFIF=0 ezer");
  });
  sahteMakine(4, 2, () => {
    assert.equal(D.zamanCarpani(env()), 3);
    assert.equal(D.cozunurlukOlcek(env()).olcek, 2 / 3, "cok-dusuk -> 720p");
    assert.equal(D.cozunurlukOlcek(env({ RENDER_COZUNURLUK: "1080" })).olcek, 1, "1080 ezer");
    assert.equal(D.zamanCarpani(env({ ZAMAN_ASIMI_CARPANI: "5" })), 5);
  });
});

test("konteyner: cgroup bellek siniri os.totalmem'den kucukse o kullanilir", () => {
  const asil = { total: os.totalmem, cm: process.constrainedMemory };
  try {
    os.totalmem = () => 64 * GB; process.constrainedMemory = () => 2 * GB;
    assert.equal(D.toplamBellekBayt(), 2 * GB);
    assert.equal(D.renderKisiti(env()).profil, "cok-dusuk");
    process.constrainedMemory = () => 0;
    assert.equal(D.toplamBellekBayt(), 64 * GB, "sinir yoksa toplam");
  } finally { os.totalmem = asil.total; process.constrainedMemory = asil.cm; }
});

test("render: zaman asimi zayif makinede uzar; kodlayici adaylari platforma gore", () => {
  const F = require("../lib/render-ffmpeg");
  const hizli = sahteMakine(32, 16, () => F.zamanAsimi(60, 20, 90));
  const yavas = sahteMakine(4, 2, () => F.zamanAsimi(60, 20, 90));
  assert.equal(yavas, hizli * 3);
  const ad = p => F.kodlayiciAdaylari(p).map(a => a.ad);
  assert.deepEqual(ad("win32"), ["NVIDIA NVENC", "AMD AMF", "Intel Quick Sync", "Windows MediaFoundation"]);
  assert.deepEqual(ad("darwin"), ["NVIDIA NVENC", "AMD AMF", "Intel Quick Sync", "Apple VideoToolbox"]);
  assert.deepEqual(ad("linux"), ["NVIDIA NVENC", "AMD AMF", "Intel Quick Sync"]);
  for (const s of ["[h264_qsv @ 0] Error initializing an MFX session", "[h264_mf @ 0] MFT not found", "[h264_videotoolbox @ 0] session failed"])
    assert.equal(F.kodlayiciHatasiMi({ ffStderr: s }), true, "donanim kodlayici hatasi taninmali (CPU'ya gecis icin): " + s);
  assert.equal(F.kodlayiciHatasiMi({ ffStderr: "frame=  401 fps= 30 size= 429kB" }), false);
  assert.deepEqual(F.CPU_SON_HAFIF.slice(0, 4), ["-c:v", "libx264", "-preset", "veryfast"]);
});

test("guvenliIndir: dogru dosya kaydedilir; SHA256 ya da boyut tutmazsa .part silinir, hedef yazilmaz", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "otopilot-indir-"));
  const veri = Buffer.from("otopilot dogrulama verisi");
  const dogru = { sha256: crypto.createHash("sha256").update(veri).digest("hex"), boyut: veri.length };
  const sahte = govde => async () => ({ ok: true, status: 200, body: (async function* () { yield govde.subarray(0, 5); yield govde.subarray(5); })() });
  try {
    const h = path.join(dir, "a.bin");
    const r = await B.guvenliIndir("https://ornek.test/a", h, dogru, { fetch: sahte(veri) });
    assert.equal(r.indirildi, true); assert.deepEqual(fs.readFileSync(h), veri);
    const r2 = await B.guvenliIndir("https://ornek.test/a", h, dogru, { fetch: async () => { throw new Error("ag cagrilmamali"); } });
    assert.equal(r2.indirildi, false, "dogru dosya varsa yeniden inmez");
    const h2 = path.join(dir, "b.bin");
    await assert.rejects(B.guvenliIndir("https://ornek.test/b", h2, dogru, { fetch: sahte(Buffer.from("degistirilmis veri!!!!!!!")) }), e => e.kod === "sha256_tutmadi");
    assert.ok(!fs.existsSync(h2) && !fs.existsSync(h2 + ".part"), "bozuk dosya diskte kalmaz");
    await assert.rejects(B.guvenliIndir("https://ornek.test/c", path.join(dir, "c.bin"), dogru, { fetch: sahte(veri.subarray(0, 10)) }), /SHA256 tutmadı/);
    await assert.rejects(B.guvenliIndir("https://ornek.test/d", path.join(dir, "d.bin"), dogru, { fetch: async () => ({ ok: false, status: 404 }) }), /HTTP 404/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("sabit indirmeler (Piper, ffmpeg): gecerli sha256, boyut ve SURUME SABIT url (latest/main yok)", () => {
  const piper = JSON.parse(fs.readFileSync(path.join(KOK, "data", "piper-sha256.json"), "utf8"));
  const ff = JSON.parse(fs.readFileSync(path.join(KOK, "data", "ffmpeg-sha256.json"), "utf8"));
  const hepsi = [...Object.values(piper.program), ...Object.values(piper.sesler).flatMap(s => [s.model, s.ayar]), ff["win32-x64"]];
  for (const x of hepsi) {
    assert.match(x.sha256, /^[0-9a-f]{64}$/, x.url);
    assert.ok(Number.isInteger(x.boyut) && x.boyut > 0, x.url);
    assert.ok(!/\/latest\/|\/main\/|\/master\//.test(x.url), "sabit olmayan url: " + x.url);
    assert.match(x.url, /^https:\/\//);
  }
  for (const s of Object.values(piper.sesler)) assert.ok(s.lisans && s.modelKarti, "ses lisansi yazili olmali: " + s.ad);
  assert.match(piper.sesler.tr.lisans, /NC|TİCARİ OLMAYAN/, "Turkce ses ticari olmayan lisans uyarisi tasimali");
});
