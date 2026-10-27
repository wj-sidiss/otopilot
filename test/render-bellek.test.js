// DUSUK BELLEK TESTLERI — render'in bellek yetmeyince cokmemesi (gercek ornek, 2026-10-20: 2.4 GB bos bellekte 44 sn'lik
// dikey Shorts'un finali "[fc#0] Terminating thread with return code -12 (Cannot allocate memory)" ile dustu, ikinci denemede gecti).
//   - bellek hatasi taninir (ffmpeg/x264/NVENC/Windows metinleri), disk dolu ve bozuk girdi KARISTIRILMAZ
//   - adim dusuk bellek profiliyle BIR kez kendiliginden tekrarlanir (sahte calistirici: ilki ENOMEM, ikincisi basarili)
//   - bos bellek 3 GB'in altindaysa ya da RENDER_DUSUK_BELLEK=1 ise bastan dusuk profil; paralel klipler 1'e iner
//   - ikinci bellek hatasi anlasilir Turkce hata + cozum (cikis 5)
//   - profil yalniz bellek/hiz ayarlarini degistirir: cozunurluk, kare hizi, crf/preset ayni
// GPU denemesi sabitlenir (kodlayiciSabitle), ffmpeg sahte calistiriciyla taklit edilir: gercek ffmpeg CALISMAZ
// (yalniz en sondaki, ffmpeg yoksa atlanan kucuk duman testi seceneklerin gercek ffmpeg'de gecerli oldugunu dogrular).
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const fik = require("./render-fikstur");
const kok = fik.ortamKur();                              // OTOMASYON_URETIM / bos .env / panel-ayar gecici klasore
test.after(() => fik.temizle(kok));

const ortak = require("../lib/ortak");
const F = require("../lib/render-ffmpeg");
const KL = require("../lib/render-klip");

const GB = 1073741824;
const asilFreemem = os.freemem;
const asilUyari = ortak.uyari;
const asilPlatform = Object.getOwnPropertyDescriptor(process, "platform");

// Her test temiz durumla baslar: bos bellek sabit (varsayilan 8 GB), ortam degiskeni yok, kodlayici CPU, uyarilar toplanir.
// macOS'ta bosBellekGB gercek vm_stat'i da okur; sahte os.freemem tek olcum olsun diye platform linux gosterilir.
function ortam(o) {
  const ayar = Object.assign({ bosGB: 8, env: undefined, gpu: null }, o || {});
  const uyarilar = [];
  os.freemem = () => ayar.bosGB * GB;
  if (asilPlatform.value === "darwin") Object.defineProperty(process, "platform", { value: "linux", configurable: true });
  if (ayar.env === undefined) delete process.env.RENDER_DUSUK_BELLEK; else process.env.RENDER_DUSUK_BELLEK = ayar.env;
  ortak.uyari = m => uyarilar.push(String(m));
  F.kodlayiciSabitle(ayar.gpu);
  F.bellekSifirla();
  return uyarilar;
}
test.afterEach(() => {
  os.freemem = asilFreemem;
  Object.defineProperty(process, "platform", asilPlatform);
  ortak.uyari = asilUyari;
  delete process.env.RENDER_DUSUK_BELLEK;
  F.bellekSifirla();
});

// sahte ffmpeg: her cagrida sonraki yaniti uygular ("ok" ya da firlatilacak hata), argv'leri kaydeder
function sahteCalistirici(yanitlar) {
  const cagrilar = [];
  const fn = async (argv, secenek) => {
    cagrilar.push({ argv: argv.slice(), secenek });
    const y = yanitlar[Math.min(cagrilar.length - 1, yanitlar.length - 1)];
    if (y === "ok") return { stderr: "" };
    throw y;
  };
  fn.cagrilar = cagrilar;
  return fn;
}
// calistirTek'in urettigi hatanin sekli (stderr ffStderr'de)
function ffHata(stderr, kod) {
  const e = new ortak.OrtakHata(kod || "ffmpeg", "ffmpeg adımı başarısız: " + String(stderr).split("\n").pop(), { cikis: ortak.CIKIS.GENEL });
  e.ffStderr = stderr;
  return e;
}
const GERCEK_ORNEK = "[fc#0] Terminating thread with return code -12 (Cannot allocate memory)";
const X264_MALLOC = "[libx264 @ 000001c4] malloc of size 8294400 failed\n[vost#0:0/libx264 @ 000001c4] Error while opening encoder - maybe incorrect parameters such as bit_rate, rate, width or height.";
const NVENC_BELLEK = "[h264_nvenc @ 000002] OpenEncodeSessionEx failed: out of memory (10): (no details)\n[vost#0:0/h264_nvenc] Error while opening encoder";
const NVENC_GPU = { ad: "NVIDIA NVENC", marka: "nvidia", argv: ["-c:v", "h264_nvenc", "-preset", "p4", "-cq", "20"] };

// final adimina benzeyen argv (kurucu): girdiler + filtre + kodlayici + kalite + cikti
const finalKurucu = K => ["-i", "grp00.mp4", "-i", "grp01.mp4", "-i", "anlatim.wav", "-/filter_complex", "filter-final.txt",
  "-map", "[vout]", "-map", "[aout]", ...K.son, "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-r", "30",
  "-t", "44.000", "-movflags", "+faststart", "final.part.mp4"];
const degeri = (argv, ad) => { const i = argv.lastIndexOf(ad); return i >= 0 ? argv[i + 1] : undefined; };

// ---------------------------------------------------------------- 1) bellek hatasini tanima
test("bellekHatasiMi: ffmpeg/x264/NVENC/Windows bellek metinleri ve ENOMEM taninir; disk dolu, bozuk girdi, siradan kodlayici hatasi tanimaz", () => {
  const evet = [
    GERCEK_ORNEK,
    "@@HATA ffmpeg adimi basarisiz (final): [fc#0] Terminating thread with return code -12 (Cannot allocate memory)",
    X264_MALLOC,
    "[libx264 @ 0x55] malloc of size 123456 failed",
    "Error initializing output stream 0:0 -- Error while opening encoder: Cannot allocate memory",
    "[vist#0:0/h264] Error submitting packet to decoder: Cannot allocate memory",
    "Error while filtering: Cannot allocate memory",
    "Error number -12 occurred",
    "[out#0/mp4] Error code: -12",
    "Terminating thread with return code -12 (Not enough space)",          // Windows'ta ENOMEM metni
    "spawn ENOMEM",
    NVENC_BELLEK,
    "CUDA_ERROR_OUT_OF_MEMORY",
    "Not enough memory resources are available to process this command.",
    "Not enough storage is available to complete this operation.",
    "[h264 @ 0000] get_buffer() failed",
    "Failed to allocate memory for frame",
    "std::bad_alloc",
  ];
  for (const s of evet) {
    assert.equal(F.bellekHatasiMi({ ffStderr: s }), true, "taninmali: " + s);
    assert.equal(F.bellekHatasiMi({ message: s }), true, "mesajda da taninmali: " + s);
  }
  assert.equal(F.bellekHatasiMi({ code: "ENOMEM", message: "spawn failed" }), true, "Node spawn hatasi kodu");
  assert.equal(F.bellekHatasiMi({ kod: "bellek_yetersiz", message: "x" }), true, "kendi hatamiz");
  const hayir = [
    "No space left on device",
    "There is not enough space on the disk.",                               // Windows DISK dolu: bellek degil
    "Invalid data found when processing input",
    "Error while opening encoder for output stream #0:0 - maybe incorrect parameters such as bit_rate, rate, width or height",
    "Cannot load nvcuda.dll",
    "frame=  120 fps= 30 q=-1.0 size=     512kB time=00:00:04.00 bitrate=1048.6kbits/s speed=1.2x",
    "[Parsed_volume_0] volume=-12dB",
    "Conversion failed!",
    "",
  ];
  for (const s of hayir) assert.equal(F.bellekHatasiMi({ ffStderr: s, message: s }), false, "tanimamali: " + s);
  assert.equal(F.bellekHatasiMi(null), false);
  assert.equal(F.bellekHatasiMi(undefined), false);
});

// ---------------------------------------------------------------- 2) dusuk bellek argv: yalniz bellek/hiz
test("dusukBellekArgv: genel filtre is parcacigi + girdi basina -threads 1 + kodlayici -threads 2 + x264 on-bakisi; kalite argumanlari AYNI", () => {
  ortam();
  const K = F.kodekler();
  const ham = finalKurucu(K);
  const d = F.dusukBellekArgv(ham, 1);
  assert.deepEqual(d.slice(0, 4), ["-filter_threads", "1", "-filter_complex_threads", "1"], "genel secenekler en basta, girdilerden once");
  assert.equal(d[d.length - 1], "final.part.mp4", "cikti dosyasi SON eleman kalir");
  // her girdiden hemen once -threads 1 (cozucu basina)
  d.forEach((a, i) => { if (a === "-i") assert.deepEqual(d.slice(i - 2, i), ["-threads", "1"], "girdi " + d[i + 1]); });
  assert.equal(d.filter(a => a === "-i").length, 3);
  // cikti tarafinda tek -threads: 2
  const sonGirdi = d.lastIndexOf("-i");
  const ciktiThreads = d.map((a, i) => (a === "-threads" && i > sonGirdi ? d[i + 1] : null)).filter(Boolean);
  assert.deepEqual(ciktiThreads, ["2"]);
  assert.equal(degeri(d, "-x264-params"), "rc-lookahead=10:sync-lookahead=0");
  // KALITE AYNI: eklenenler cikarilinca argv birebir ayni (crf, preset, cozunurluk, kare hizi, sure, renk etiketi)
  const temiz = [];
  for (let i = 4; i < d.length; i++) {
    if (d[i] === "-threads" || d[i] === "-x264-params") { i++; continue; }
    temiz.push(d[i]);
  }
  assert.deepEqual(temiz, ham, "dusuk bellek profili kalite/cozunurluk/kare hizi argumanlarina dokunmamali");
  assert.equal(degeri(d, "-crf"), degeri(ham, "-crf"));
  assert.equal(degeri(d, "-preset"), degeri(ham, "-preset"));
  assert.equal(degeri(d, "-r"), "30");
  // seviye 2: en az bellek; seviye 0: dokunulmaz
  const d2 = F.dusukBellekArgv(ham, 2);
  assert.equal(degeri(d2, "-threads"), "1");
  assert.equal(degeri(d2, "-x264-params"), "rc-lookahead=5:sync-lookahead=0");
  assert.equal(F.dusukBellekArgv(ham, 0), ham);
});

test("dusukBellekArgv: klip argv'sindeki eski -threads kaldirilir, var olan -x264-params korunup birlestirilir; NVENC/AMF kendi az bellek ayarini alir; ses/kopya adiminda x264 secenegi eklenmez", () => {
  ortam();
  const klip = KL.klipArgv({ efekt: "zoom", SW: 2160, SH: 3840, W: 1080, H: 1920, FPS: 30, renkFiltresi: "null" },
    { kare: 150, zin: true, yol: "01.jpg" }, F.kodekler(), 3).concat(["clip000.part.mp4"]);
  assert.ok(klip.includes("-threads"), "normal klip argv'sinde cekirdek payi var");
  const d = F.dusukBellekArgv(klip, 1);
  const sonGirdi = d.lastIndexOf("-i");
  assert.deepEqual(d.map((a, i) => (a === "-threads" && i > sonGirdi ? d[i + 1] : null)).filter(Boolean), ["2"], "eski -threads degeri kalmamali");
  assert.equal(degeri(d, "-frames:v"), "150", "kare sayisi ayni");
  assert.ok(d.some(a => /zoompan=.*s=1080x1920:fps=30/.test(a)), "cozunurluk/kare hizi filtresi ayni");

  const birlesik = F.dusukBellekArgv(["-i", "a.mp4", "-c:v", "libx264", "-crf", "18", "-x264-params", "keyint=60", "o.mp4"], 1);
  assert.equal(degeri(birlesik, "-x264-params"), "keyint=60:rc-lookahead=10:sync-lookahead=0");
  assert.equal(birlesik.filter(a => a === "-x264-params").length, 1);

  const nv = F.dusukBellekArgv(["-i", "a.mp4", ...NVENC_GPU.argv, "o.mp4"], 1);
  assert.equal(degeri(nv, "-surfaces"), "4");
  assert.equal(degeri(nv, "-cq"), "20", "NVENC kalitesi ayni");
  assert.ok(!nv.includes("-x264-params"));
  const amf = F.dusukBellekArgv(["-i", "a.mp4", "-c:v", "h264_amf", "-quality", "balanced", "o.mp4"], 2);
  assert.equal(degeri(amf, "-async_depth"), "2");

  const ses = F.dusukBellekArgv(["-i", "cd.mp4", "-vn", "-ar", "48000", "-c:a", "pcm_s16le", "cd.wav"], 1);
  assert.ok(!ses.includes("-x264-params") && !ses.includes("-surfaces"));
  assert.equal(ses[ses.length - 1], "cd.wav");
});

// ---------------------------------------------------------------- 3) otomatik yeniden deneme
test("calistir: ilk deneme ENOMEM ile duserse ayni adim DUSUK BELLEK profiliyle kendiliginden tekrarlanir ve basarir; kullaniciya Turkce bilgi verilir", async () => {
  const uyarilar = ortam({ bosGB: 8 });
  const sahte = sahteCalistirici([ffHata(GERCEK_ORNEK), "ok"]);
  const gorulenK = [];
  const r = await F.calistir(K => { gorulenK.push({ dusukBellek: K.dusukBellek, seviye: K.bellekSeviyesi }); return finalKurucu(K); },
    { etiket: "final", zamanAsimiMs: 60000, calistirici: sahte });
  assert.deepEqual(r, { stderr: "" });
  assert.equal(sahte.cagrilar.length, 2, "tam bir kez tekrar");
  const [ilk, ikinci] = sahte.cagrilar;
  assert.ok(!ilk.argv.includes("-filter_threads"), "ilk deneme normal profil");
  assert.equal(degeri(ikinci.argv, "-x264-params"), "rc-lookahead=10:sync-lookahead=0");
  assert.equal(ikinci.argv[0], "-filter_threads");
  assert.equal(degeri(ikinci.argv, "-crf"), degeri(ilk.argv, "-crf"), "crf ayni");
  assert.equal(degeri(ikinci.argv, "-r"), "30", "kare hizi ayni");
  assert.equal(ikinci.secenek.zamanAsimiMs, 120000, "dusuk bellekte zaman asimi genisler");
  assert.deepEqual(gorulenK, [{ dusukBellek: false, seviye: 0 }, { dusukBellek: true, seviye: 1 }], "kurucu dusuk bellek bilgisini alir");
  assert.equal(uyarilar.length, 1, uyarilar.join("\n"));
  assert.match(uyarilar[0], /^Bellek az \(8\.0 GB boş\): 'final' adımı düşük bellek moduyla yeniden deneniyor/);
  const p = F.bellekProfili();
  assert.equal(p.seviye, 1); assert.equal(p.kaynak, "hata");
  // sonraki adimlar bastan dusuk profille calisir (ayni hatayi tekrar yasamamak icin)
  const sonraki = sahteCalistirici(["ok"]);
  await F.calistir(finalKurucu, { calistirici: sonraki });
  assert.equal(sonraki.cagrilar.length, 1);
  assert.equal(sonraki.cagrilar[0].argv[0], "-filter_threads");
});

test("calistir: x264 'malloc of size ... failed' de ayni yoldan tekrarlanir; duz argv (kurucusuz) adimlar da tekrarlanir", async () => {
  ortam();
  const sahte = sahteCalistirici([ffHata(X264_MALLOC), "ok"]);
  await F.calistir(["-i", "a.png", "-c:v", "libx264", "-crf", "18", "o.mp4"], { etiket: "kart", calistirici: sahte });
  assert.equal(sahte.cagrilar.length, 2);
  assert.equal(degeri(sahte.cagrilar[1].argv, "-x264-params"), "rc-lookahead=10:sync-lookahead=0");
  assert.equal(degeri(sahte.cagrilar[1].argv, "-crf"), "18");
});

test("calistir: bellek disi hata TEKRARLANMAZ (bozuk girdi, disk dolu): eski davranis aynen", async () => {
  ortam();
  for (const h of [ffHata("Invalid data found when processing input", "ffmpeg_girdi"), ffHata("No space left on device", "disk_dolu")]) {
    const sahte = sahteCalistirici([h, "ok"]);
    await assert.rejects(() => F.calistir(finalKurucu, { calistirici: sahte }), e => e === h);
    assert.equal(sahte.cagrilar.length, 1, h.kod);
  }
  assert.equal(F.bellekSeviyesi(), 0, "bellek disi hata dusuk bellek moduna gecirmez");
});

test("calistir + GPU: once GPU'nun dusuk bellek ayari denenir, o da kodlayici bellegiyle duserse CPU'ya (dusuk bellekle) gecilir", async () => {
  const uyarilar = ortam({ gpu: NVENC_GPU });
  const sahte = sahteCalistirici([ffHata(NVENC_BELLEK), ffHata(NVENC_BELLEK), "ok"]);
  await F.calistir(finalKurucu, { etiket: "final", calistirici: sahte });
  assert.equal(sahte.cagrilar.length, 3);
  const [a, b, c] = sahte.cagrilar.map(x => x.argv);
  assert.equal(degeri(a, "-c:v"), "h264_nvenc"); assert.ok(!a.includes("-surfaces"));
  assert.equal(degeri(b, "-c:v"), "h264_nvenc", "CPU'ya dusmeden once GPU dusuk bellekle denenmeli");
  assert.equal(degeri(b, "-surfaces"), "4"); assert.equal(degeri(b, "-cq"), "20");
  assert.equal(degeri(c, "-c:v"), "libx264");
  assert.equal(degeri(c, "-x264-params"), "rc-lookahead=10:sync-lookahead=0");
  assert.equal(F.gpuAcikMi(), false);
  assert.ok(uyarilar.some(u => /düşük bellek moduyla yeniden deneniyor/.test(u)), uyarilar.join("\n"));
  assert.ok(uyarilar.some(u => /GPU belleği yetmedi, CPU'ya geçildi/.test(u)), uyarilar.join("\n"));
});

test("calistir + GPU: GPU dusuk bellekte SISTEM bellegi (filtre is parcacigi) yetmezse CPU'ya gecilmez, anlasilir hata verilir", async () => {
  ortam({ gpu: NVENC_GPU });
  const sahte = sahteCalistirici([ffHata(GERCEK_ORNEK), ffHata(GERCEK_ORNEK), "ok"]);
  await assert.rejects(() => F.calistir(finalKurucu, { etiket: "final", calistirici: sahte }), e => e.kod === "bellek_yetersiz");
  assert.equal(sahte.cagrilar.length, 2);
  assert.equal(F.gpuAcikMi(), true, "kodlayici hatasi degil: GPU acik kalir");
});

// ---------------------------------------------------------------- 4) ikinci bellek hatasi: anlasilir hata + cozum
test("calistir: dusuk bellekle de duserse 'bellek_yetersiz' (cikis 5) + Turkce cozum: diger programlari kapat, RENDER_DUSUK_BELLEK=1", async () => {
  ortam({ bosGB: 4 });
  const sahte = sahteCalistirici([ffHata(GERCEK_ORNEK)]);
  let hata = null;
  await assert.rejects(() => F.calistir(finalKurucu, { etiket: "final", calistirici: sahte }), e => { hata = e; return true; });
  assert.equal(sahte.cagrilar.length, 2, "yalniz BIR bellek tekrari");
  assert.equal(hata.kod, "bellek_yetersiz");
  assert.equal(hata.cikis, ortak.CIKIS.KAYNAK);
  assert.equal(hata.cikis, 5);
  assert.match(hata.message, /^Bilgisayarın boş belleği \(RAM\) bu adıma yetmedi \(final\); düşük bellek moduyla da olmadı \(4\.0 GB boş\)\.$/);
  assert.match(hata.cozum, /Diğer programları .*kapatıp aynı komutu tekrar çalıştır/);
  assert.match(hata.cozum, /RENDER_DUSUK_BELLEK=1/);
  assert.ok(Array.isArray(hata.detay) && hata.detay.some(s => /Cannot allocate memory/.test(s)), "ffmpeg satiri detayda");
  // betiklerin cikis yolu (ortak.bitir) bu hatayi aynen ozetler
  const c = ortak.hataCevir(hata);
  assert.equal(c.kod, "bellek_yetersiz"); assert.equal(c.ozet, hata.message); assert.equal(c.cozum, hata.cozum);
  // hic bir Turkce karakter bozulmamis
  assert.ok(!(hata.message + hata.cozum).includes(String.fromCharCode(0xFFFD)));
});

test("ikinci hata cozumu DENENEN seviyeye gore: en az bellekle (2) de dustuyse RENDER_DUSUK_BELLEK=1/2 onerilmez, yeniden baslat/kisalt denir", async () => {
  // RENDER_DUSUK_BELLEK=1: 1 -> 2 tekrar edildi ve 2 de dustu. "=2 yap" demek ise yaramaz (adim zaten 2'de dustu).
  ortam({ env: "1" });
  let s = sahteCalistirici([ffHata(GERCEK_ORNEK)]);
  let hata = null;
  await assert.rejects(() => F.calistir(finalKurucu, { calistirici: s }), e => { hata = e; return e.kod === "bellek_yetersiz"; });
  assert.equal(s.cagrilar.length, 2, "1 -> 2 seviyesine bir kez tekrar");
  assert.equal(degeri(s.cagrilar[1].argv, "-threads"), "1");
  assert.equal(hata.seviye, 2);
  assert.match(hata.cozum, /en az bellek ayarıyla \(RENDER_DUSUK_BELLEK=2 düzeyinde\) de denendi/);
  assert.match(hata.cozum, /yeniden başlatıp/);
  assert.doesNotMatch(hata.cozum, /RENDER_DUSUK_BELLEK=[12] (yaz|yap)/);

  ortam({ env: "2" });
  s = sahteCalistirici([ffHata(GERCEK_ORNEK)]);
  await assert.rejects(() => F.calistir(finalKurucu, { calistirici: s }), e => e.kod === "bellek_yetersiz" && /yeniden başlatıp/.test(e.cozum));
  assert.equal(s.cagrilar.length, 1, "en dusuk seviyede tekrar edilecek profil kalmadi");

  // GERCEK ORNEGIN durumu: 2.4 GB bos -> esikle bastan 1, tekrarda 2; ortam degiskeni yok. Eskiden "RENDER_DUSUK_BELLEK=1 yaz"
  // deniyordu (zaten 1 ve 2 denenmisti)
  ortam({ bosGB: 2.4 });
  s = sahteCalistirici([ffHata(GERCEK_ORNEK)]);
  await assert.rejects(() => F.calistir(finalKurucu, { etiket: "final", calistirici: s }), e => { hata = e; return e.kod === "bellek_yetersiz"; });
  assert.equal(s.cagrilar.length, 2);
  assert.equal(s.cagrilar[0].argv[0], "-filter_threads", "esik: ilk deneme de dusuk bellekle");
  assert.equal(degeri(s.cagrilar[1].argv, "-x264-params"), "rc-lookahead=5:sync-lookahead=0", "tekrar en az bellekle");
  assert.match(hata.message, /^Bilgisayarın boş belleği \(RAM\) bu adıma yetmedi \(final\); düşük bellek moduyla da olmadı \(2\.4 GB boş\)\.$/);
  assert.match(hata.cozum, /^Diğer programları .*kapatıp aynı komutu tekrar çalıştır/);
  assert.match(hata.cozum, /yeniden başlatıp yalnız bu işi çalıştır ya da videoyu kısalt/);
  assert.doesNotMatch(hata.cozum, /RENDER_DUSUK_BELLEK=1 yaz/);
});

// ---------------------------------------------------------------- surec hic baslatilamadi (spawn): bellek/kaynak
test("baslatmaBellekHatasiMi: spawn ENOMEM/EAGAIN her yerde; Windows'ta spawn UNKNOWN (-4094) da bellek; ENOENT (ffmpeg yok) ve cikis kodu hatasi DEGIL", () => {
  const unk = { code: "UNKNOWN", errno: -4094, syscall: "spawnSync C:\\ff\\ffprobe.exe", message: "spawnSync C:\\ff\\ffprobe.exe UNKNOWN" };
  assert.equal(F.baslatmaBellekHatasiMi(unk, "win32"), true);
  assert.equal(F.baslatmaBellekHatasiMi(Object.assign({}, unk, { syscall: "spawn C:\\ff\\ffmpeg.exe" }), "win32"), true);
  assert.equal(F.baslatmaBellekHatasiMi(unk, "linux"), false, "UNKNOWN yalniz Windows'ta bellek isareti");
  assert.equal(F.baslatmaBellekHatasiMi({ code: "UNKNOWN", syscall: "read" }, "win32"), false, "spawn disi UNKNOWN degil");
  assert.equal(F.baslatmaBellekHatasiMi({ code: "EAGAIN", syscall: "spawn ffmpeg" }, "linux"), true);
  assert.equal(F.baslatmaBellekHatasiMi({ code: "ENOMEM", syscall: "spawn ffmpeg" }, "darwin"), true);
  assert.equal(F.baslatmaBellekHatasiMi({ code: "ENOENT", syscall: "spawn ffmpeg" }, "win32"), false, "ffmpeg yok: ayri hata");
  assert.equal(F.baslatmaBellekHatasiMi({ code: 1, status: 1 }, "win32"), false);
  assert.equal(F.baslatmaBellekHatasiMi(null), false);
});

test("calistirTek: ffmpeg surecI bellek yetmedigi icin BASLATILAMAZSA 'ffmpeg kurulu mu?' (cikis 2) DEGIL bellek hatasi; calistir dusuk bellekle bir kez tekrarlar", async () => {
  const uyarilar = ortam({ bosGB: 8 });
  // calistirTek'in gercek yolu: spawn sahtelenmis AYRI bir render-ffmpeg ornegi (gercek ffmpeg calismaz)
  const cp = require("child_process");
  const { EventEmitter } = require("events");
  const anahtar = require.resolve("../lib/render-ffmpeg");
  const asilMod = require.cache[anahtar], asilSpawn = cp.spawn;
  const asilYol = process.env.FFMPEG_YOLU;
  if (!fik.ffmpegVarMi()) process.env.FFMPEG_YOLU = process.execPath;   // CI'da ffmpeg yoksa yol bulunabilsin (spawn zaten sahte)
  let kod = "EAGAIN";
  const argvler = [];
  cp.spawn = (yol, argv) => {
    argvler.push(argv);
    const c = new EventEmitter();
    c.stdout = new EventEmitter(); c.stderr = new EventEmitter(); c.kill = () => {};
    process.nextTick(() => c.emit("error", Object.assign(new Error("spawn " + yol + " " + kod), { code: kod, syscall: "spawn " + yol, errno: kod === "UNKNOWN" ? -4094 : -11 })));
    return c;
  };
  let F2;
  try { delete require.cache[anahtar]; F2 = require(anahtar); }
  finally { cp.spawn = asilSpawn; require.cache[anahtar] = asilMod; }
  try {
    F2.kodlayiciSabitle(null); F2.bellekSifirla();
    let hata = null;
    await assert.rejects(() => F2.calistir(finalKurucu, { etiket: "final" }), e => { hata = e; return true; });
    assert.equal(hata.kod, "bellek_yetersiz", hata.message);
    assert.equal(hata.cikis, 5);
    assert.equal(argvler.length, 2, "bir kez dusuk bellekle tekrar");
    assert.ok(argvler[1].includes("-filter_threads"), "tekrar dusuk bellek profiliyle");
    assert.ok(uyarilar.some(u => /'final' adımı düşük bellek moduyla yeniden deneniyor/.test(u)), uyarilar.join("\n"));
    if (process.platform === "win32") {               // Windows'ta bellek bitince libuv UNKNOWN doner
      kod = "UNKNOWN"; argvler.length = 0; F2.bellekSifirla();
      await assert.rejects(() => F2.calistir(finalKurucu, { etiket: "final" }), e => e.kod === "bellek_yetersiz");
      assert.equal(argvler.length, 2);
    }
    // ffmpeg gercekten yoksa (ENOENT) eski davranis: ffmpeg_yok (cikis 2), tekrar yok
    kod = "ENOENT"; argvler.length = 0; F2.bellekSifirla();
    await assert.rejects(() => F2.calistir(finalKurucu, { etiket: "final" }), e => e.kod === "ffmpeg_yok" && e.cikis === 2);
    assert.equal(argvler.length, 1);
  } finally {
    if (asilYol === undefined) delete process.env.FFMPEG_YOLU; else process.env.FFMPEG_YOLU = asilYol;
  }
});

// ---------------------------------------------------------------- ffprobe bellek darken: saglam dosya "bozuk" sayilmaz
function ffprobeSahte(yanitlar) {
  const asil = F._ic.ffprobeSync;
  const kayit = { n: 0 };
  F._ic.ffprobeSync = () => {
    const y = yanitlar[Math.min(kayit.n++, yanitlar.length - 1)];
    if (y instanceof Error) throw y;
    return Buffer.from(JSON.stringify(y));
  };
  kayit.geri = () => { F._ic.ffprobeSync = asil; };
  return kayit;
}
const spawnBellek = () => Object.assign(new Error("spawnSync ffprobe EAGAIN"), { code: "EAGAIN", syscall: "spawnSync ffprobe" });
const PROBE_OK = { format: { duration: "1.000" }, streams: [{ codec_type: "video", codec_name: "h264", width: 320, height: 180 }] };

test("bilgi: ffprobe bellekten baslatilamazsa kisa beklemeyle BIR kez daha denenir; yine olmazsa 'bellek_yetersiz' (dosya_okunamadi DEGIL)", () => {
  ortam();
  const d = path.join(kok, "probe"); fs.mkdirSync(d, { recursive: true });
  const dosya = path.join(d, "clip.mp4"); fs.writeFileSync(dosya, "saglam");
  let s = ffprobeSahte([spawnBellek(), PROBE_OK]);
  try { assert.equal(F.bilgi(dosya).sure, 1); assert.equal(s.n, 2, "bir kez tekrar"); } finally { s.geri(); }

  s = ffprobeSahte([spawnBellek()]);
  try {
    assert.throws(() => F.bilgi(dosya), e => e.kod === "bellek_yetersiz" && e.cikis === 5 && /ffprobe çalıştırılamadı \(clip\.mp4\)/.test(e.message));
    assert.equal(s.n, 2);
  } finally { s.geri(); }

  // ffprobe CALISIP bellek hatasi yazdiysa: bir kez tekrar (anlik darlik gecebilir), gecerse sonuc doner
  const stderrBellek = Object.assign(new Error("Command failed"), { status: 1, stderr: Buffer.from("[mov,mp4] Cannot allocate memory\n") });
  s = ffprobeSahte([stderrBellek, PROBE_OK]);
  try { assert.equal(F.bilgi(dosya).sure, 1); assert.equal(s.n, 2); } finally { s.geri(); }
  // ...hep ayni hatayi veriyorsa dosya_okunamadi KALIR: bozuk dosya (dev atom boyutu) da bunu her seferinde yazar; bellek sayilsa
  // bozuk ara dosya hic yeniden uretilmez, is takili kalirdi
  s = ffprobeSahte([stderrBellek]);
  try {
    assert.throws(() => F.bilgi(dosya), e => e.kod === "dosya_okunamadi");
    assert.equal(s.n, 2);
    assert.equal(F.gecerliMi(dosya, 1, 0.2, { bellekFirlat: true }), false, "bozuk ara dosya gecersiz sayilir (yeniden uretilir)");
  } finally { s.geri(); }

  // gercekten bozuk dosya: eski davranis (dosya_okunamadi, cikis 4), tekrar YOK
  const bozuk = Object.assign(new Error("Command failed"), { status: 1, stderr: Buffer.from("moov atom not found\n") });
  s = ffprobeSahte([bozuk, PROBE_OK]);
  try { assert.throws(() => F.bilgi(dosya), e => e.kod === "dosya_okunamadi" && e.cikis === 4); assert.equal(s.n, 1); } finally { s.geri(); }
});

test("gecerliMi: bellekFirlat verilirse ffprobe'un bellek hatasi FIRLATILIR (dosya gecersiz sayilmaz); verilmezse eski davranis (false)", () => {
  ortam();
  const d = path.join(kok, "probe2"); fs.mkdirSync(d, { recursive: true });
  const dosya = path.join(d, "clip.mp4"); fs.writeFileSync(dosya, "saglam");
  let s = ffprobeSahte([spawnBellek()]);
  try {
    assert.equal(F.gecerliMi(dosya, 1, 0.2), false, "bayraksiz: eski davranis");
    assert.throws(() => F.gecerliMi(dosya, 1, 0.2, { bellekFirlat: true }), e => e.kod === "bellek_yetersiz");
  } finally { s.geri(); }
  const bozuk = Object.assign(new Error("Command failed"), { status: 1, stderr: Buffer.from("Invalid data found when processing input\n") });
  s = ffprobeSahte([bozuk]);
  try { assert.equal(F.gecerliMi(dosya, 1, 0.2, { bellekFirlat: true }), false, "bozuk dosya yine false"); } finally { s.geri(); }
  s = ffprobeSahte([PROBE_OK]);
  try { assert.equal(F.gecerliMi(dosya, 1, 0.2, { bellekFirlat: true }), true); } finally { s.geri(); }
});

test("bilgiAsync: ffprobe bellekten baslatilamazsa yarim saniye sonra bir kez daha denenir (gorsel 'okunamadi' sayilip videodan dusmesin)", async () => {
  ortam();
  const asil = F._ic.ffprobeAsync;
  let n = 0;
  F._ic.ffprobeAsync = (argv, o, cb) => {
    n++;
    if (n === 1) return setImmediate(() => cb(Object.assign(new Error("spawn ffprobe EAGAIN"), { code: "EAGAIN", syscall: "spawn ffprobe" }), "", ""));
    setImmediate(() => cb(null, JSON.stringify(PROBE_OK), ""));
  };
  try {
    const b = await F.bilgiAsync("x.jpg");
    assert.equal(b.genislik, 320); assert.equal(n, 2);
    // bellek disi hata: tekrar yok
    n = 1;
    F._ic.ffprobeAsync = (argv, o, cb) => { n++; setImmediate(() => cb(Object.assign(new Error("Command failed"), { code: 1 }), "", "Invalid data found")); };
    await assert.rejects(() => F.bilgiAsync("x.jpg"));
    assert.equal(n, 2, "yalniz bir cagri");
  } finally { F._ic.ffprobeAsync = asil; }
});

test("calistir bellekTekrar=false (paralel klip): tekrar yok, dusuk bellek moduna gecilir ve hata cagirana firlatilir", async () => {
  const uyarilar = ortam();
  const h = ffHata(GERCEK_ORNEK, "bellek_yetersiz");
  const sahte = sahteCalistirici([h, "ok"]);
  await assert.rejects(() => F.calistir(finalKurucu, { calistirici: sahte, bellekTekrar: false }), e => e === h);
  assert.equal(sahte.cagrilar.length, 1);
  assert.equal(F.bellekSeviyesi(), 1);
  assert.equal(uyarilar.length, 1);
  assert.match(uyarilar[0], /düşük bellek moduna geçildi/);
});

// ---------------------------------------------------------------- 5) onleyici: esik / ortam degiskeni
test("bellekProfili: bos bellek 3 GB'in altindaysa bastan dusuk profil; RENDER_DUSUK_BELLEK=1/2 zorlar, =0 esigi kapatir (hata tekrari yine calisir)", async () => {
  ortam({ bosGB: 2.4 });
  let p = F.bellekProfili();
  assert.equal(p.seviye, 1); assert.equal(p.kaynak, "esik"); assert.equal(p.dusuk, true);
  assert.match(p.neden, /boş bellek 2\.4 GB, 3 GB'ın altında/);
  let s = sahteCalistirici(["ok"]);
  await F.calistir(finalKurucu, { calistirici: s });
  assert.equal(s.cagrilar.length, 1);
  assert.equal(s.cagrilar[0].argv[0], "-filter_threads", "ilk denemeden dusuk profil");
  assert.equal(F.paralellik().n, 1, "dusuk bellekte klipler tek tek");
  assert.equal(F.paralellik().dusukBellek, true);

  ortam({ bosGB: 8 });
  assert.equal(F.bellekProfili().seviye, 0);
  assert.ok(F.paralellik().n >= 1);
  s = sahteCalistirici(["ok"]);
  await F.calistir(finalKurucu, { calistirici: s });
  assert.ok(!s.cagrilar[0].argv.includes("-filter_threads"), "bellek yeterliyse normal profil");

  ortam({ bosGB: 8, env: "1" });
  p = F.bellekProfili();
  assert.equal(p.seviye, 1); assert.equal(p.kaynak, "ortam"); assert.equal(p.neden, "RENDER_DUSUK_BELLEK=1");
  assert.equal(F.paralellik().n, 1);

  ortam({ bosGB: 8, env: "2" });
  assert.equal(F.bellekSeviyesi(), 2);

  ortam({ bosGB: 1, env: "0" });
  assert.equal(F.bellekSeviyesi(), 0, "=0: esige bakilmaz");
  s = sahteCalistirici([ffHata(GERCEK_ORNEK), "ok"]);
  await F.calistir(finalKurucu, { calistirici: s });
  assert.equal(s.cagrilar.length, 2, "=0 iken de bellek hatasinda otomatik tekrar");
  assert.equal(F.bellekSeviyesi(), 1);
});

test("bellekProfili: karar bir kez verilir (render basinda bellekSifirla ile yenilenir); bellek hatasi seviyeyi yalniz yukseltir", () => {
  ortam({ bosGB: 8 });
  assert.equal(F.bellekSeviyesi(), 0);
  os.freemem = () => 1 * GB;                              // render ortasinda bos bellek degisse de karar sabit
  assert.equal(F.bellekSeviyesi(), 0);
  assert.equal(F.dusukBellekAc("deneme"), true);
  assert.equal(F.dusukBellekAc("deneme"), false, "ayni seviyeye ikinci gecis yeni degil");
  assert.equal(F.dusukBellekAc("deneme", 2), true);
  assert.equal(F.dusukBellekAc("deneme", 1), false, "seviye dusurulmez");
  assert.equal(F.bellekSeviyesi(), 2);
  F.bellekSifirla();
  assert.equal(F.bellekSeviyesi(), 1, "yeniden olcum: 1 GB bos -> esik");
});

test("vmStatBosBayt (macOS): bos + etkin olmayan + spekulatif sayfalar x sayfa boyutu; okunamazsa null (os.freemem'e dusulur)", () => {
  const ornek = "Mach Virtual Memory Statistics: (page size of 16384 bytes)\nPages free:                               65536.\n" +
    "Pages active:                            400000.\nPages inactive:                          131072.\nPages speculative:                         65536.\n" +
    "Pages throttled:                              0.\nPages wired down:                         98765.\n";
  assert.equal(F.vmStatBosBayt(ornek), (65536 + 131072 + 65536) * 16384);          // 4 GB
  assert.equal(F.vmStatBosBayt(""), null);
  assert.equal(F.vmStatBosBayt("Pages free: 10."), null, "sayfa boyutu yoksa olcum yok");
});

// ---------------------------------------------------------------- paralel havuz + klip uretimi
test("paralel: sinir islev olarak verilirse is sirasinda dusurulebilir; fazla isciler elindekini bitirip cekilir", async () => {
  let sinir = 3, ayni = 0, enCok = 0, dususSonrasiEnCok = 0, dustu = false;
  const sonuc = await F.paralel(Array.from({ length: 12 }, (_, i) => i), () => sinir, async i => {
    ayni++; enCok = Math.max(enCok, ayni);
    if (dustu) dususSonrasiEnCok = Math.max(dususSonrasiEnCok, ayni);      // dusus sonrasi baslarken kac is ayni anda
    await new Promise(c => setTimeout(c, 15));
    if (i === 1) { sinir = 1; dustu = true; }
    ayni--;
    return i * 2;
  });
  assert.equal(enCok, 3);
  assert.ok(dususSonrasiEnCok <= 1, "sinir dustukten sonra baslayan isler tek tek yurumeli: " + dususSonrasiEnCok);
  assert.deepEqual(sonuc.map(s => s.deger), Array.from({ length: 12 }, (_, i) => i * 2), "hicbir is kaybolmaz");
  // sayi verilince eski davranis
  const r = await F.paralel([1, 2, 3], 2, async x => x + 1);
  assert.deepEqual(r.map(s => s.deger), [2, 3, 4]);
});

function klipKur(ad, n) {
  const tmp = path.join(kok, ad); fs.mkdirSync(tmp, { recursive: true });
  const klipler = [];
  for (let i = 0; i < n; i++) {
    const g = path.join(tmp, "g" + i + ".jpg"); fs.writeFileSync(g, "saglam-" + i);
    klipler.push({ i, ad: "001/0" + i + ".jpg", yol: g, kare: 30, dosya: path.join(tmp, "clip00" + i + "-aaaaaaa" + i + ".mp4") });
  }
  return { tmp, klipler, ayar: { FPS: 30, W: 320, H: 180, SW: 428, SH: 240, efekt: "zoom", renk: "yok", renkFiltresi: "null" } };
}
function klipSahte(davranis) {
  const asil = { uret: F.uret, gecerliMi: F.gecerliMi, paralellik: F.paralellik };
  const kayit = { cagrilar: [], ayni: 0, enCok: 0, dususSonrasiEnCok: 0 };
  F.uret = async (hedef, kurucu, secenek) => {
    const argv = kurucu(Object.assign({ ara: [], son: [], gpu: false }));
    const yol = argv[argv.indexOf("-i") + 1];
    const dusukBasta = F.dusukBellekMi();
    kayit.cagrilar.push({ hedef: path.basename(hedef), yol: path.basename(yol), bellekTekrar: secenek.bellekTekrar, dusuk: dusukBasta });
    kayit.ayni++; kayit.enCok = Math.max(kayit.enCok, kayit.ayni);
    if (dusukBasta) kayit.dususSonrasiEnCok = Math.max(kayit.dususSonrasiEnCok, kayit.ayni);
    try {
      await new Promise(c => setTimeout(c, 10));
      davranis(path.basename(hedef), kayit.cagrilar.filter(c => c.hedef === path.basename(hedef)).length, dusukBasta);
      fs.writeFileSync(hedef, "klip");
      return hedef;
    } finally { kayit.ayni--; }
  };
  F.gecerliMi = d => { try { return fs.statSync(d).size > 0; } catch (e) { return false; } };
  F.paralellik = () => ({ n: 3, bosGB: 8 });
  kayit.geri = () => Object.assign(F, asil);
  return kayit;
}

test("klipleriUret: paralel klipte bellek hatasi -> dusuk bellek moduna gecilir, havuz tek isciye iner, dusen klip TEK TEK tekrarlanir (komsu gorselle DEGISTIRILMEZ)", async () => {
  ortam({ bosGB: 8 });
  const { tmp, klipler, ayar } = klipKur("klip-bellek", 6);
  const kayit = klipSahte((ad, kacinci, dusuk) => {
    // clip001 ilk (paralel) denemede bellekten duser; dusuk bellek modunda gecer
    if (ad.startsWith("clip001") && !dusuk) { const e = ffHata(GERCEK_ORNEK, "bellek_yetersiz"); throw e; }
  });
  const uyarilar = [];
  try {
    const r = await KL.klipleriUret(ayar, klipler, tmp, () => {}, m => uyarilar.push(m));
    assert.deepEqual(r.yedeklenen, [], "bellek hatasi gorsel bozuklugu sayilmamali");
    assert.equal(r.uretilen, 6);
    const c1 = kayit.cagrilar.filter(c => c.hedef.startsWith("clip001"));
    assert.equal(c1.length, 2, "dusen klip bir kez daha (tek tek) denenir");
    assert.equal(c1[0].bellekTekrar, false, "paralel asamada ffmpeg ayni anda birden cok tekrar yapmaz");
    assert.equal(c1[1].bellekTekrar, undefined, "tek tek asamada normal (otomatik tekrarli) calistirma");
    assert.ok(c1.every(c => c.yol === "g1.jpg"), "kendi gorselinden uretilir: " + JSON.stringify(c1));
    assert.ok(kayit.dususSonrasiEnCok <= 1, "dusuk bellek moduna gecildikten sonra baslayan klipler tek tek: " + kayit.dususSonrasiEnCok);
    assert.equal(kayit.enCok, 3, "baslangicta paralel");
    assert.ok(uyarilar.some(u => /Bellek az: düşük bellek moduna geçildi, kalan klipler tek tek üretiliyor/.test(u)), uyarilar.join("\n"));
    assert.ok(!uyarilar.some(u => /bozuk, panelden sil/.test(u)), uyarilar.join("\n"));
    assert.equal(F.bellekSeviyesi(), 1);
  } finally { kayit.geri(); }
});

test("klipleriUret: tek tek denemede de bellek yetmezse anlasilir bellek hatasi yukari gider (gorsel_bozuk DEGIL, komsu gorsel kullanilmaz)", async () => {
  ortam({ bosGB: 8 });
  const { tmp, klipler, ayar } = klipKur("klip-bellek-2", 3);
  const kayit = klipSahte(ad => {
    if (ad.startsWith("clip002")) throw F.bellekYetersizHata(ffHata(GERCEK_ORNEK), { etiket: "klip 3/3" }, 1);
  });
  try {
    let hata = null;
    await assert.rejects(() => KL.klipleriUret(ayar, klipler, tmp, () => {}, () => {}),
      e => { hata = e; return e.kod === "bellek_yetersiz" && e.cikis === 5 && /klip 3\/3/.test(e.message); });
    // hep ayni klipte oluyorsa sebep cok buyuk gorsel olabilir: cozum hangi gorsel oldugunu soyler
    assert.match(hata.cozum, /^Diğer programları/);
    assert.match(hata.cozum, /Hep bu klipte oluyorsa \(görsel 001\/02\.jpg\) görsel çok büyük olabilir/);
    assert.ok(!kayit.cagrilar.some(c => c.hedef.startsWith("clip002") && c.yol !== "g2.jpg"), "komsu gorselle denenmemeli: " + JSON.stringify(kayit.cagrilar));
    assert.ok(!fs.existsSync(path.join(tmp, "klip-yedekleri.json")), "yedek kaydi yazilmaz");
  } finally { kayit.geri(); }
});

test("klipleriUret: klip uretildikten sonra ffprobe BELLEKTEN olcemezse klip/gorsel bozuk sayilmaz (komsu gorsel yok, dosya silinmez)", async () => {
  ortam({ bosGB: 8 });
  const { tmp, klipler, ayar } = klipKur("klip-probe-bellek", 3);
  const kayit = klipSahte(() => {});
  const bellekProbe = () => F.bellekYetersizHata(ffHata("Cannot allocate memory"), { etiket: "ffprobe" }, 1);
  const bayraklar = [];
  let olcum = 0, kalici = false;
  // clip001'in uretim SONRASI ilk olcumu bellekten duser (kalici=true iken hep duser); diger olcumler gercek dosya varligina bakar
  F.gecerliMi = (d, sn, tol, o) => {
    bayraklar.push(!!(o && o.bellekFirlat));
    const var_ = (() => { try { return fs.statSync(d).size > 0; } catch (e) { return false; } })();
    if (/clip001/.test(d) && var_ && (kalici || olcum++ === 0)) { if (o && o.bellekFirlat) throw bellekProbe(); return false; }
    return var_;
  };
  const uyarilar = [];
  try {
    const r = await KL.klipleriUret(ayar, klipler, tmp, () => {}, m => uyarilar.push(m));
    assert.deepEqual(r.yedeklenen, [], "olculemeyen klip yedek gorselle DEGISTIRILMEMELI");
    assert.ok(bayraklar.length && bayraklar.every(Boolean), "klip denetimleri bellekFirlat ile yapilir");
    const c1 = kayit.cagrilar.filter(c => c.hedef.startsWith("clip001"));
    assert.ok(c1.length >= 2 && c1.every(c => c.yol === "g1.jpg"), JSON.stringify(c1));
    assert.ok(!uyarilar.some(u => /bozuk, panelden sil/.test(u)), uyarilar.join("\n"));
    assert.equal(F.bellekSeviyesi(), 1, "bellek hatasi dusuk bellek moduna gecirir");

    // bellek hic acilmazsa: gorsel_bozuk DEGIL bellek hatasi yukari gider, uretilen klip SILINMEZ
    for (const k of klipler) { try { fs.unlinkSync(k.dosya); } catch (e) { /* yok */ } }
    ortam({ bosGB: 8 });
    kalici = true; kayit.cagrilar.length = 0;
    await assert.rejects(() => KL.klipleriUret(ayar, klipler, tmp, () => {}, () => {}), e => e.kod === "bellek_yetersiz" && e.cikis === 5);
    assert.ok(!kayit.cagrilar.some(c => c.hedef.startsWith("clip001") && c.yol !== "g1.jpg"), "komsu gorselle denenmemeli: " + JSON.stringify(kayit.cagrilar));
    assert.ok(fs.existsSync(klipler[1].dosya), "olculemeyen (saglam olabilecek) klip silinmemeli");
    assert.ok(!fs.existsSync(path.join(tmp, "klip-yedekleri.json")), "yedek kaydi yazilmaz");
  } finally { kayit.geri(); }
});

test("uret: bellek hatasinda girdi ara dosyalari 'bozuk' sanilip SILINMEZ", async () => {
  ortam();
  const d = path.join(kok, "uret-bellek"); fs.mkdirSync(d, { recursive: true });
  const girdi = path.join(d, "grp00.mp4"); fs.writeFileSync(girdi, "saglam ara dosya");
  // ffmpeg bellek yetmeyince "Error submitting packet to decoder" de yazar: eskiden bu girdi-bozuk denetimini tetikleyebilirdi
  const sahte = sahteCalistirici([ffHata("[vist#0:0/h264] Error submitting packet to decoder: Cannot allocate memory")]);
  await assert.rejects(() => F.uret(path.join(d, "o.mp4"), K => ["-i", girdi, ...K.ara, "-an"], { girdiler: [girdi], calistirici: sahte }),
    e => e.kod === "bellek_yetersiz");
  assert.ok(fs.existsSync(girdi), "saglam girdi silinmemeli");
  assert.equal(sahte.cagrilar.length, 2);
});

// ---------------------------------------------------------------- gercek ffmpeg (yoksa atlanir): secenekler gecerli mi?
test("GERCEK ffmpeg (kucuk duman): dusuk bellek secenekleri ffmpeg'de gecerli, cikti cozunurlugu/kare hizi ayni", { skip: !fik.ffmpegVarMi() && "ffmpeg yok" }, async () => {
  ortam({ env: "1" });                                   // GPU denemesi YOK (CPU sabit), dusuk profil acik
  const d = path.join(kok, "duman"); fs.mkdirSync(d, { recursive: true });
  const cikti = path.join(d, "o.mp4");
  await F.uret(cikti, K => ["-f", "lavfi", "-i", "testsrc2=s=160x90:r=30:d=1", "-f", "lavfi", "-i", "testsrc2=s=160x90:r=30:d=1",
    "-filter_complex", "[0:v][1:v]xfade=transition=fade:duration=0.5:offset=0.5,format=yuv420p[v]", "-map", "[v]", ...K.ara, "-an"],
    { etiket: "duman", zamanAsimiMs: 60000 });
  const b = F.bilgi(cikti);
  assert.equal(b.genislik, 160); assert.equal(b.yukseklik, 90);
  assert.ok(Math.abs(b.sure - 1.5) < 0.1, String(b.sure));
});
