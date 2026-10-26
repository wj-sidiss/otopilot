// test/fikstur-kararlilik.test.js — test yardimcilarinin kararliligi (az bellekli makinede ara sira dusen render testleri, 26 Eki 2026):
//   - fikstur ffmpeg'i kodlayiciya -threads 1 verir (mjpeg "auto" 16 kopya acip ENOMEM ile dusuyordu), bellek hatasinda bir kez yeniden dener
//   - betikCalistir CI ile ayni CPU kodlayiciyi varsayar; signal ve temizle() calisan alt sureci kapatir
//   - sahipsiz uretim/_test-* artiklari sonraki kosuda silinir; canli, yeni ve gercek is klasorlerine dokunulmaz
// Ag YOK, ucretli servis YOK. Gercek ffmpeg yalniz tek kare/kisa ses testinde (yoksa o test atlanir).
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync, spawnSync } = require("child_process");
const fik = require("./render-fikstur");
const artik = require("./artik-yardim");

const YANKI = "test/fixtures/ortam-yankila.js";
const gecici = fs.mkdtempSync(path.join(os.tmpdir(), "fikstur-kararlilik-"));
test.after(() => artik.sil(gecici));

// ---------------------------------------------------------------- ff(): is parcacigi + bellek hatasinda yeniden deneme
const sahteCalistir = (davranis) => {
  const cagrilar = [];
  const calistir = (yol, argv, secenek) => { cagrilar.push({ yol, argv, secenek }); return davranis(cagrilar.length); };
  return { cagrilar, calistir };
};
const hata = (alanlar) => Object.assign(new Error("Command failed"), alanlar);

test("ff: kodlayiciya -threads 1 CIKTIDAN hemen once eklenir; onek ve zaman asimi korunur", () => {
  const s = sahteCalistir(() => Buffer.alloc(0));
  fik.ff(["-f", "lavfi", "-i", "testsrc2=s=1280x720:r=1", "-frames:v", "1", "-q:v", "3", "c.jpg"], { ffmpeg: "ffmpeg-sahte", calistir: s.calistir });
  assert.equal(s.cagrilar.length, 1);
  assert.equal(s.cagrilar[0].yol, "ffmpeg-sahte");
  assert.deepEqual(s.cagrilar[0].argv, ["-y", "-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "testsrc2=s=1280x720:r=1",
    "-frames:v", "1", "-q:v", "3", "-threads", "1", "c.jpg"]);
  assert.equal(s.cagrilar[0].secenek.timeout, 120000);
  // ses ve coklu girdili video ciktisi da ayni kural: son arguman cikti kalir
  assert.deepEqual(fik.ffArgv(["-f", "lavfi", "-i", "a", "-f", "lavfi", "-i", "b", "-c:v", "libx264", "-c:a", "aac", "o.mp4"]).slice(-3), ["-threads", "1", "o.mp4"]);
});

test("ff: bellek hatasinda (cikis 4294967284 / ff_frame_thread_encoder_init / Cannot allocate memory / spawn ENOMEM) bir kez bekleyip yeniden dener", () => {
  const bellekHatalari = [
    hata({ status: 4294967284, stderr: Buffer.from("[mjpeg @ 0000] ff_frame_thread_encoder_init failed\nError while opening encoder") }),
    hata({ status: 1, stderr: Buffer.from("[out#0/image2] Cannot allocate memory") }),
    hata({ status: 244, stderr: Buffer.from("") }),
    hata({ code: "ENOMEM", syscall: "spawnSync ffmpeg" }),
  ];
  for (const h of bellekHatalari) {
    const beklemeler = [];
    const s = sahteCalistir(n => { if (n === 1) throw h; return Buffer.from("tamam"); });
    const r = fik.ff(["-f", "lavfi", "-i", "x", "o.jpg"], { ffmpeg: "f", calistir: s.calistir, uyu: ms => beklemeler.push(ms) });
    assert.equal(String(r), "tamam");
    assert.equal(s.cagrilar.length, 2, "yeniden denenmeli: " + (h.status || h.code));
    assert.equal(beklemeler.length, 1);
    assert.ok(beklemeler[0] >= 500, "nefes payi birakilmali");
    assert.deepEqual(s.cagrilar[1].argv, s.cagrilar[0].argv, "ayni komut");
  }
});

test("ff: bellek disi hata hemen firlatilir (flite yedegi beklemeden devreye girer); bellek hatasi tekrarlarsa ikinci denemeden sonra firlatilir", () => {
  const s1 = sahteCalistir(() => { throw hata({ status: 1, stderr: Buffer.from("No such filter: 'flite'") }); });
  assert.throws(() => fik.ff(["a.mp3"], { ffmpeg: "f", calistir: s1.calistir, uyu: () => assert.fail("beklenmemeli") }), /Command failed/);
  assert.equal(s1.cagrilar.length, 1);

  const s2 = sahteCalistir(() => { throw hata({ status: 4294967284, stderr: Buffer.from("Cannot allocate memory") }); });
  let bekleme = 0;
  assert.throws(() => fik.ff(["a.jpg"], { ffmpeg: "f", calistir: s2.calistir, uyu: () => { bekleme++; } }), e => e.status === 4294967284);
  assert.equal(s2.cagrilar.length, 2, "sonsuz dongu yok: en cok 2 deneme");
  assert.equal(bekleme, 1);
});

test("GERCEK ffmpeg: -threads 1 ile JPEG, PNG ve mp3 fiksturu uretilir (arguman sirasi ffmpeg'ce gecerli)", { skip: !fik.ffmpegVarMi() && "ffmpeg yok" }, () => {
  const jpg = path.join(gecici, "g.jpg"), png = path.join(gecici, "g.png"), mp3 = path.join(gecici, "s.mp3");
  fik.ff(["-f", "lavfi", "-i", "testsrc2=s=1280x720:r=1", "-frames:v", "1", "-q:v", "3", jpg]);
  fik.ff(["-i", jpg, "-c:v", "png", "-f", "image2", png]);
  fik.ff(["-f", "lavfi", "-i", "sine=frequency=200:duration=0.5", "-ar", "24000", "-ac", "1", "-c:a", "libmp3lame", "-b:a", "48k", mp3]);
  const b = fs.readFileSync(jpg);
  assert.equal(b.readUInt16BE(0), 0xFFD8, "JPEG imzasi");
  const boyut = execFileSync(fik.FP(), ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", png],
    { windowsHide: true }).toString().trim();
  assert.equal(boyut, "1280,720");
  assert.ok(fik.sureOlc(mp3) > 0.3, "ses suresi");
});

// ---------------------------------------------------------------- betikCalistir(): varsayilan kodlayici, signal, temizle
async function ortamla(degerler, fn) {
  const eski = {};
  for (const k of Object.keys(degerler)) { eski[k] = process.env[k]; if (degerler[k] === undefined) delete process.env[k]; else process.env[k] = degerler[k]; }
  try { return await fn(); }
  finally { for (const k of Object.keys(eski)) { if (eski[k] === undefined) delete process.env[k]; else process.env[k] = eski[k]; } }
}
const yanki = r => { assert.equal(r.kod, 0, r.stdout + r.stderr); return JSON.parse(r.stdout.trim().split("\n")[0]); };

test("betikCalistir: varsayilan VIDEO_KODEK=cpu (CI ile ayni yol); TEST_GPU=1, kabuktaki VIDEO_KODEK ve secenek.env bunu ezer", async () => {
  await ortamla({ VIDEO_KODEK: undefined, TEST_GPU: undefined, RENDER_OLCEK: undefined }, async () => {
    assert.deepEqual(yanki(await fik.betikCalistir(YANKI, [])), { VIDEO_KODEK: "cpu", RENDER_OLCEK: "0.25" });
    assert.equal(yanki(await fik.betikCalistir(YANKI, [], { env: { VIDEO_KODEK: "otomatik" } })).VIDEO_KODEK, "otomatik", "testin kendi secimi kazanir");
  });
  await ortamla({ VIDEO_KODEK: undefined, TEST_GPU: "1" }, async () => {
    assert.equal(yanki(await fik.betikCalistir(YANKI, [])).VIDEO_KODEK, null, "TEST_GPU=1: GPU yolu acik (betik kendisi secer)");
  });
  await ortamla({ VIDEO_KODEK: "nvidia", TEST_GPU: undefined, RENDER_OLCEK: "0.5" }, async () => {
    assert.deepEqual(yanki(await fik.betikCalistir(YANKI, [])), { VIDEO_KODEK: "nvidia", RENDER_OLCEK: "0.5" }, "kabuktan verilen deger korunur");
  });
});

// alt surec ilk satirini yazana dek bekle (o zaman gercekten calisiyor)
const basladi = () => { let coz; const p = new Promise(r => { coz = r; }); return { p, cikti: () => coz() }; };

test("betikCalistir: signal iptal edilince (test zaman asimi) alt surec OLDURULUR; onceden iptal edilmis signal hic bekletmez", async () => {
  const ac = new AbortController(), b = basladi();
  const t0 = Date.now();
  const sonuc = fik.betikCalistir(YANKI, ["--bekle"], { signal: ac.signal, cikti: b.cikti, zamanAsimiMs: 60000 });
  await b.p;
  ac.abort();
  const r = await sonuc;
  assert.notEqual(r.kod, 0, "oldurulen surec basarili sayilmamali");
  assert.ok(Date.now() - t0 < 30000, "zaman asimini (60 sn) beklememeli");

  const r2 = await fik.betikCalistir(YANKI, ["--bekle"], { signal: AbortSignal.abort(), zamanAsimiMs: 60000 });
  assert.notEqual(r2.kod, 0);
});

test("temizle: dosya sonunda hala calisan alt surec kapatilir ve test klasoru silinir", async () => {
  const kok = path.join(gecici, "_test-render-temizle");
  fs.mkdirSync(path.join(kok, "is", "Videos"), { recursive: true });
  fs.writeFileSync(path.join(kok, "is", "Videos", "x.mp4"), "x");
  const b = basladi();
  const sonuc = fik.betikCalistir(YANKI, ["--bekle"], { cikti: b.cikti, zamanAsimiMs: 60000 });
  await b.p;
  fik.temizle(kok);
  const r = await sonuc;                       // temizle oldurmeseydi 60 sn sonra zaman asimiyla biterdi
  assert.notEqual(r.kod, 0);
  assert.equal(fs.existsSync(kok), false, "test klasoru kalmamali");
});

// ---------------------------------------------------------------- eskiArtiklariTemizle(): sahipsiz uretim/_test-* klasorleri
function klasor(kok, ad, dakikaOnce) {
  const d = path.join(kok, ad);
  fs.mkdirSync(path.join(d, "is", "Visuals"), { recursive: true });
  fs.writeFileSync(path.join(d, "is", "Visuals", "01.jpg"), "x");
  const t = new Date(Date.now() - dakikaOnce * 60000);
  fs.utimesSync(d, t, t);                      // icerik yazildiktan SONRA: klasorun mtime'i
  return d;
}

test("eskiArtiklariTemizle: yalniz sahibi OLU ve ESKI test klasorleri silinir; canli/kendi pid, yeni, gercek is ve benzer adlara dokunulmaz", () => {
  const ur = path.join(gecici, "uretim-1");
  fs.mkdirSync(ur, { recursive: true });
  const silinmeli = ["_test-render-999991-aaaaaa", "_test-gorsel-999992", "_test-ses-999993-bbbbbb", "_test-render-999990-"];
  const kalmali = ["_test-render-999994-cccccc", "_test-render-999995-dddddd", "_test-render-" + process.pid + "-eeeeee", "nightwatch",
    "_test-render-abc", "_test-baska-999996", "_test-render-999998-gggggg-x", "_test-render-999999-BUYUK"];
  for (const ad of silinmeli) klasor(ur, ad, 60);
  for (const ad of kalmali) klasor(ur, ad, ad === "_test-render-999994-cccccc" ? 1 : 60);   // 999994: olu ama YENI
  fs.writeFileSync(path.join(ur, "_test-render-999997-ffffff"), "klasor degil");           // dosya: dokunulmaz
  const t = new Date(Date.now() - 3600000); fs.utimesSync(path.join(ur, "_test-render-999997-ffffff"), t, t);

  const sorulan = [];
  const silinen = artik.eskiArtiklariTemizle(ur, { yasiyorMu: pid => { sorulan.push(pid); return pid === 999995; } });
  assert.deepEqual(silinen.sort(), [...silinmeli].sort());
  for (const ad of silinmeli) assert.equal(fs.existsSync(path.join(ur, ad)), false, ad + " silinmeliydi");
  for (const ad of kalmali) assert.equal(fs.existsSync(path.join(ur, ad)), true, ad + " kalmaliydi");
  assert.ok(fs.existsSync(path.join(ur, "_test-render-999997-ffffff")));
  assert.ok(!sorulan.includes(process.pid), "kendi pid'imiz sorulmadan atlanir");
  assert.ok(!sorulan.includes(999994), "yeni klasor icin pid sorulmaz (once yas)");

  assert.deepEqual(artik.eskiArtiklariTemizle(path.join(gecici, "olmayan-uretim")), [], "uretim/ yoksa sessizce bos");
});

test("eskiArtiklariTemizle varsayilan pid yoklamasi: bitmis surecin klasoru silinir, canli surecinki (kendi ebeveynimiz) kalir", () => {
  const olu = spawnSync(process.execPath, ["-e", ""], { windowsHide: true }).pid;
  assert.equal(artik.yasiyorMu(process.pid), true);
  assert.equal(artik.yasiyorMu(olu), false, "bitmis surec yasiyor gorunmemeli");
  const ur = path.join(gecici, "uretim-2");
  klasor(ur, "_test-render-" + olu + "-olu123", 30);
  klasor(ur, "_test-render-" + process.ppid + "-canli1", 30);
  assert.deepEqual(artik.eskiArtiklariTemizle(ur), ["_test-render-" + olu + "-olu123"]);
  assert.ok(fs.existsSync(path.join(ur, "_test-render-" + process.ppid + "-canli1")));
});

test("ortamKur: gercek uretim/ altindaki sahipsiz eski _test-render artigini siler, kendi klasorunu acar; temizle onu da kaldirir", () => {
  const olu = spawnSync(process.execPath, ["-e", ""], { windowsHide: true }).pid;
  const artikYol = klasor(path.join(fik.KOK, "uretim"), "_test-render-" + olu + "-kalnt1", 30);
  const ortamYedek = { OTOMASYON_URETIM: process.env.OTOMASYON_URETIM, OTOMASYON_AYAR_DOSYASI: process.env.OTOMASYON_AYAR_DOSYASI,
    OTOMASYON_ENV_DOSYASI: process.env.OTOMASYON_ENV_DOSYASI };
  let kok = null;
  try {
    kok = fik.ortamKur();
    assert.equal(fs.existsSync(artikYol), false, "onceki kosunun artigi silinmeliydi");
    assert.ok(fs.existsSync(kok) && path.basename(kok).startsWith("_test-render-" + process.pid + "-"));
  } finally {
    if (kok) fik.temizle(kok);
    artik.sil(artikYol);
    for (const [k, v] of Object.entries(ortamYedek)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
  }
  assert.equal(fs.existsSync(kok), false, "temizle kendi klasorunu silmeli");
});
