// lib/render-ffmpeg.js — render icin ffmpeg/ffprobe calistirma katmani.
//
// Tum video adimlari buradan gecer:
//   - ZAMAN ASIMI: her adim sureye gore makul bir sinirla calisir; takilan ffmpeg oldurulur.
//   - GPU -> CPU: kodlayici hatasi (nvenc/amf/"Error while opening encoder") gorulurse GPU
//     kapatilir, ayni adim x264 ile BIR kez tekrarlanir (render ortasinda da calisir).
//   - ILERLEME: -progress pipe:1 okunur, adim icindeki yuzde disariya verilir.
//   - HATA: stderr'in son satirlari Turkce tek cumlelik OrtakHata'ya cevrilir.
//   - BELLEK: "Cannot allocate memory" / "malloc of size ... failed" / -12 / ENOMEM gorulurse ayni adim DUSUK BELLEK
//     profiliyle (az is parcacigi, kisa x264 on-bakisi, tek tek klip) BIR kez tekrarlanir; bos bellek 3 GB'in altindaysa ya da
//     RENDER_DUSUK_BELLEK=1 ise bastan o profille calisilir. Profil yalniz bellek/hiz ayarlarini degistirir: cozunurluk,
//     kare hizi ve kalite (crf/cq) aynidir.
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn, execFileSync } = require("child_process");
const ortak = require("./ortak");
const ffyol = require("../ff-yol");

const ffmpegYolu = () => ffyol.ffmpeg;
const ffprobeYolu = () => ffyol.ffprobe;

// ---------------------------------------------------------------- calisan cocuklar
// Sunucu ya da kullanici sureci oldurunce ffmpeg cocuklari sahipsiz kalmasin.
const aktif = new Set();
process.on("exit", () => { for (const c of aktif) { try { c.kill("SIGKILL"); } catch (e) { /* zaten bitmis */ } } });

// ---------------------------------------------------------------- kodlayici secimi
// GPU kodlama (NVENC/AMF) CPU'dan ~5 kat hizli ama surucu eskiyse ffmpeg hata verir.
// O yuzden ONCE DENIYORUZ; calisirsa kullaniriz. Render ortasinda hata verirse CPU'ya geceriz.
const CPU_ARA = ["-c:v", "libx264", "-preset", "veryfast", "-crf", "18"];
const CPU_SON = ["-c:v", "libx264", "-preset", "medium", "-crf", "20"];
const durum = { denendi: false, gpu: null, kapali: false };

// RENK BILGISI: HD icin standart BT.709 + SINIRLI (tv) aralik, tum ara dosyalarda ve finalde. Eskiden JPEG kaynakli klipler
// "yuvj420p / tam aralik", PNG kaynakli kartlar "yuv420p / etiketsiz" cikiyor, birlesince final yuvj420p (tam aralik)
// isaretli kaliyordu: etiketi yok sayan/tam araligi bilmeyen oynaticilar (bazi telefonlar, editorler) videoyu soluk gosterir.
const RENK_ETIKET = ["-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-color_range", "tv"];
const RENK_SETPARAMS = "setparams=range=tv:colorspace=bt709:color_primaries=bt709:color_trc=bt709";
const RENK_YUV_SON = "format=yuv420p," + RENK_SETPARAMS;                                              // zaten YUV olan akis icin
const RENK_RGB_YUV = "scale=out_color_matrix=bt709:out_range=tv,format=yuv420p," + RENK_SETPARAMS;    // RGB akisi -> BT.709 tv YUV

function gpuDene() {
  if (ortak.envOku("VIDEO_KODEK").toLowerCase() === "cpu") return null;      // .env'e ya da ortama yazilabilir
  const adaylar = [
    { ad: "NVIDIA NVENC", marka: "nvidia", argv: ["-c:v", "h264_nvenc", "-preset", "p4", "-cq", "20"] },
    { ad: "AMD AMF", marka: "amd", argv: ["-c:v", "h264_amf", "-quality", "balanced", "-rc", "cqp", "-qp_i", "20", "-qp_p", "22"] },
  ];
  for (const a of adaylar) {
    try {
      execFileSync(ffmpegYolu(), ["-y", "-hide_banner", "-loglevel", "error",
        "-f", "lavfi", "-i", "testsrc2=s=640x360:r=30:d=1", ...a.argv, "-an",
        "-f", "null", process.platform === "win32" ? "NUL" : "/dev/null"],
        { stdio: "ignore", timeout: 25000, windowsHide: true });
      return a;
    } catch (e) { /* bu kodlayici yok ya da surucu eski — sonrakine bak */ }
  }
  return null;
}

// Donus: { ad, gpu, marka, ara:[...], son:[...] }  (ara = ara dosyalar, son = final)
function kodekler() {
  if (!durum.denendi) { durum.denendi = true; durum.gpu = gpuDene(); }
  if (durum.gpu && !durum.kapali) {
    return { ad: durum.gpu.ad, gpu: true, marka: durum.gpu.marka, ara: [...durum.gpu.argv, ...RENK_ETIKET], son: [...durum.gpu.argv, ...RENK_ETIKET] };
  }
  return { ad: "libx264", gpu: false, marka: "cpu", ara: [...CPU_ARA, ...RENK_ETIKET], son: [...CPU_SON, ...RENK_ETIKET] };
}
function gpuKapat() { durum.kapali = true; }
function gpuAcikMi() { return !!durum.gpu && !durum.kapali; }
// (test) GPU denemesi (gercek ffmpeg) yapmadan kodlayiciyi sabitler: null = CPU, { ad, marka, argv } = GPU
function kodlayiciSabitle(aday) { durum.denendi = true; durum.gpu = aday || null; durum.kapali = false; }

const KODLAYICI_HATASI = /nvenc|\bamf\b|h264_amf|Error while opening encoder|OpenEncodeSession|Could not open encoder|No capable devices found|Cannot load nvcuda|CUDA_ERROR|encoder.*(fail|not (found|supported))|Failed to create|InitializeEncoder|out of memory/i;
const kodlayiciHatasiMi = e => !!(e && KODLAYICI_HATASI.test(String((e.ffStderr || "") + " " + (e.message || ""))));

// ---------------------------------------------------------------- bellek yetersizligi
// GERCEK ORNEK (2026-10-20): 2.4 GB bos bellekte 44 sn'lik dikey Shorts'un finali "[fc#0] Terminating thread with return code
// -12 (Cannot allocate memory)" ile dustu, ayni komut ikinci denemede gecti. x264 de "malloc of size ... failed" ile dusebiliyor.
// Windows'ta ENOMEM metni "Not enough space" olabilir; "There is not enough space on the disk" (disk dolu) bundan ayrilir.
const BELLEK_HATASI = new RegExp([
  "Cannot allocate memory", "malloc of size \\d+ failed", "\\bENOMEM\\b",
  "(?:return code|error(?: code| number)?|code)\\s*:?\\s*-12\\b",
  "out[ _]of[ _]memory", "not enough memory", "Not enough storage is available", "Not enough space(?! on)",
  "bad_alloc", "get_buffer\\(\\) failed", "(?:failed to|could not|cannot|unable to) allocate (?:memory|frame|buffer|picture|packet)",
].join("|"), "i");
const bellekHatasiMi = e => !!e && (e.kod === "bellek_yetersiz" || e.code === "ENOMEM" ||
  BELLEK_HATASI.test(String((e.ffStderr || "") + " " + (e.message || ""))));
// Surec HIC baslatilamadiysa (spawn hatasi) sebep bellek/sistem kaynagi mi? Linux/macOS'ta ENOMEM ya da EAGAIN (fork'a bellek yok).
// Windows'ta sanal bellek (sayfa dosyasi) bitince libuv cogu zaman ENOMEM degil UNKNOWN (-4094) dondurur: 2026-10-25'te 1.5 GB
// bos bellekte ffprobe/ffmpeg boyle dustu ve eskiden "ffmpeg kurulu mu?" (cikis 2) diye yanlis anlatiliyordu. ENOENT (ffmpeg yok) AYRIDIR.
function baslatmaBellekHatasiMi(e, platform) {
  if (!e || typeof e !== "object") return false;
  if (e.code === "ENOMEM" || e.code === "EAGAIN") return true;
  return (platform || process.platform) === "win32" && e.code === "UNKNOWN" && /^spawn/i.test(String(e.syscall || ""));
}
const uyu = ms => { try { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); } catch (e) { /* bekleme olmadi */ } };

// Dusuk bellek profili. seviye 1: az is parcacigi + kisa x264 on-bakisi (lookahead) + tek tek klip; seviye 2: en az bellek
// (tek is parcacikli kodlayici). Yalniz bellek/hiz: cozunurluk, kare hizi, crf/cq ve on ayar (preset) DEGISMEZ.
const DUSUK_PROFIL = {
  1: { kodlayiciIs: 2, cozucuIs: 1, x264: "rc-lookahead=10:sync-lookahead=0", nvenc: ["-surfaces", "4"], amf: ["-async_depth", "4"] },
  2: { kodlayiciIs: 1, cozucuIs: 1, x264: "rc-lookahead=5:sync-lookahead=0", nvenc: ["-surfaces", "4"], amf: ["-async_depth", "2"] },
};
const DUSUK_BELLEK_ESIK_GB = 3;
const GB = 1073741824;
const bellek = { karar: null };          // { seviye 0|1|2, kaynak: "ortam"|"esik"|"hata", neden, bosGB }

// Esik icin bos bellek (GB). Windows ve Linux'ta os.freemem() kullanilabilir bellegi verir; macOS'ta ise yalniz "bos" sayfalari
// sayar (onbellekteki geri alinabilir bellek haric) ve 16 GB'lik Mac'te bile cogu zaman 1-2 GB gosterir: orada vm_stat'tan
// bos + etkin olmayan + spekulatif sayfalar alinir (olculemezse os.freemem). Hicbir zaman os.freemem'den kucuk donmez.
function vmStatBosBayt(metin) {
  const sayfa = Number((/page size of (\d+) bytes/.exec(String(metin || "")) || [])[1]);
  if (!sayfa) return null;
  const al = ad => Number((new RegExp("Pages " + ad + ":\\s+(\\d+)").exec(metin) || [])[1] || 0);
  const toplam = al("free") + al("inactive") + al("speculative");
  return toplam > 0 ? toplam * sayfa : null;
}
function bosBellekGB() {
  const ham = os.freemem() / GB;
  if (process.platform !== "darwin") return ham;
  try {
    const b = vmStatBosBayt(execFileSync("vm_stat", [], { timeout: 3000, windowsHide: true, stdio: ["ignore", "pipe", "ignore"] }).toString("utf8"));
    if (b) return Math.max(ham, b / GB);
  } catch (e) { /* vm_stat yok: os.freemem yeter */ }
  return ham;
}

// Karar bir kez verilir (render basinda bellekSifirla ile yenilenir); bellek hatasi seviyeyi yalniz YUKSELTIR.
// RENDER_DUSUK_BELLEK: 1 = bastan dusuk bellek, 2 = bastan en dusuk, 0 = esige bakma (hata olursa yine otomatik denenir), bos = otomatik.
function bellekProfili() {
  if (!bellek.karar) {
    const ham = String(ortak.envOku("RENDER_DUSUK_BELLEK") || "").trim().toLowerCase();
    const bosGB = bosBellekGB();
    if (ham === "2") bellek.karar = { seviye: 2, kaynak: "ortam", neden: "RENDER_DUSUK_BELLEK=2", bosGB };
    else if (/^(1|evet|true|acik|açık|on)$/.test(ham)) bellek.karar = { seviye: 1, kaynak: "ortam", neden: "RENDER_DUSUK_BELLEK=1", bosGB };
    else if (/^(0|hayir|hayır|false|kapali|kapalı|off)$/.test(ham)) bellek.karar = { seviye: 0, kaynak: "ortam", neden: "RENDER_DUSUK_BELLEK=0", bosGB };
    else if (bosGB < DUSUK_BELLEK_ESIK_GB) bellek.karar = { seviye: 1, kaynak: "esik", neden: "boş bellek " + bosGB.toFixed(1) + " GB, " + DUSUK_BELLEK_ESIK_GB + " GB'ın altında", bosGB };
    else bellek.karar = { seviye: 0, kaynak: "esik", neden: "", bosGB };
  }
  return Object.assign({ dusuk: bellek.karar.seviye > 0 }, bellek.karar);
}
const bellekSeviyesi = () => bellekProfili().seviye;
const dusukBellekMi = () => bellekSeviyesi() > 0;
// Bellek hatasindan sonra seviyeyi yukseltir (en cok 2). Yeni bir seviyeye gecildiyse true.
function dusukBellekAc(neden, seviye) {
  const once = bellekSeviyesi(), hedef = Math.min(2, Math.max(1, seviye || 1));
  if (hedef <= once) return false;
  bellek.karar = { seviye: hedef, kaynak: "hata", neden: neden || "bellek hatası", bosGB: os.freemem() / GB };
  return true;
}
function bellekSifirla() { bellek.karar = null; }

// argv'yi (SON eleman cikti dosyasi) dusuk bellek profiline cevirir:
//   - en basa -filter_threads 1 -filter_complex_threads 1 (genel secenekler, girdilerden once)
//   - her girdiden (-i) once -threads <cozucuIs>: h264 cozucusu cekirdek basina kare tamponu ayirir; finalde 10 girdi x 16 is parcacigi
//     yuzlerce MB demekti
//   - cikti tarafindaki -threads kaldirilip <kodlayiciIs> yazilir; kodlayici libx264 ise -x264-params ile on-bakis kisaltilir,
//     NVENC/AMF ise kendi az bellekli ayari eklenir. -crf/-cq/-preset ve cozunurluk/kare hizi argumanlarina DOKUNULMAZ.
function dusukBellekArgv(argv, seviye) {
  const p = DUSUK_PROFIL[seviye];
  if (!p || !Array.isArray(argv) || argv.length < 2) return argv;
  const cikti = argv[argv.length - 1];
  const govde = argv.slice(0, -1);
  const sonGirdi = govde.lastIndexOf("-i");
  const yeni = ["-filter_threads", "1", "-filter_complex_threads", "1"];
  let kodlayici = "", x264 = "";
  for (let i = 0; i < govde.length; i++) {
    const a = govde[i];
    if (a === "-i" && i + 1 < govde.length) { yeni.push("-threads", String(p.cozucuIs), a, govde[i + 1]); i++; continue; }
    if (i > sonGirdi) {
      if (a === "-threads") { i++; continue; }
      if (a === "-x264-params") { x264 = String(govde[i + 1] || ""); i++; continue; }
      if (/^-(?:c:v|codec:v|vcodec)$/.test(a)) kodlayici = String(govde[i + 1] || "");
    }
    yeni.push(a);
  }
  yeni.push("-threads", String(p.kodlayiciIs));
  if (/libx264/.test(kodlayici)) yeni.push("-x264-params", (x264 ? x264 + ":" : "") + p.x264);
  else {
    if (x264) yeni.push("-x264-params", x264);
    if (/_nvenc$/.test(kodlayici)) yeni.push(...p.nvenc);
    else if (/_amf$/.test(kodlayici)) yeni.push(...p.amf);
  }
  yeni.push(cikti);
  return yeni;
}

// Dusuk bellekle de olmadiysa: anlasilir Turkce hata + cozum (cikis 5 = disk/kaynak).
// seviye: DUSEN denemenin bellek seviyesi. Oneri ona gore: adim zaten en az bellekle (2) denendiyse RENDER_DUSUK_BELLEK=1/2 onermek
// ise yaramaz (ornek: bos bellek 3 GB'in altinda -> esikle 1, tekrarda 2); o zaman yeniden baslat / kisalt denir.
function bellekYetersizHata(e, o, seviye) {
  const bosGB = os.freemem() / GB;
  const env = String(ortak.envOku("RENDER_DUSUK_BELLEK") || "").trim().toLowerCase();
  const envSeviye = env === "2" ? 2 : /^(1|evet|true|acik|açık|on)$/.test(env) ? 1 : 0;
  const oneri = Math.max(Number(seviye) || 0, envSeviye) >= 2
    ? "Bu adım en az bellek ayarıyla (RENDER_DUSUK_BELLEK=2 düzeyinde) de denendi: sürerse bilgisayarı yeniden başlatıp yalnız bu işi çalıştır ya da videoyu kısalt."
    : envSeviye === 1
      ? "Sürerse .env dosyasında RENDER_DUSUK_BELLEK=2 yap (en az bellek, en yavaş)."
      : "Sürerse .env dosyasına RENDER_DUSUK_BELLEK=1 yaz: render baştan düşük bellek moduyla, klipler tek tek kurulur.";
  const h = new ortak.OrtakHata("bellek_yetersiz", "Bilgisayarın boş belleği (RAM) bu adıma yetmedi" + (o && o.etiket ? " (" + o.etiket + ")" : "") +
    "; düşük bellek moduyla da olmadı (" + bosGB.toFixed(1) + " GB boş).", {
    cikis: ortak.CIKIS.KAYNAK, detay: sonSatirlar(e && e.ffStderr).slice(-8),
    cozum: "Diğer programları (tarayıcı sekmeleri, oyun, video düzenleyici) kapatıp aynı komutu tekrar çalıştır: iş kaldığı yerden sürer, " +
      "biten ara dosyalar yeniden üretilmez. " + oneri });
  h.ffStderr = e && e.ffStderr; h.ffArgv = e && e.ffArgv; h.seviye = seviye;
  return h;
}

// ---------------------------------------------------------------- tek ffmpeg calistirma
function sonSatirlar(err) {
  return String(err || "").split(/\r?\n/).map(s => s.trim()).filter(s =>
    s && !/^(built with|configuration:|lib(av|sw|postproc)\w*\s+\d)/i.test(s));
}

// argv: -y/-hide_banner/-loglevel BURADA eklenir. secenek:
//   cwd, etiket, zamanAsimiMs, ilerleme(sn) -> adim icinde cikti suresi (sn)
function calistirTek(argv, secenek) {
  const o = secenek || {};
  return new Promise((coz, red) => {
    const tam = ["-y", "-hide_banner", "-loglevel", "error", "-nostats"];
    if (o.ilerleme) tam.push("-progress", "pipe:1");
    tam.push(...argv);
    const c = spawn(ffmpegYolu(), tam, { cwd: o.cwd, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
    aktif.add(c);
    let err = "", tampon = "", zamanAsimi = false, bitti = false;
    const sinir = o.zamanAsimiMs || 600000;
    const t = setTimeout(() => { zamanAsimi = true; try { c.kill("SIGKILL"); } catch (e) { /* bitmis */ } }, sinir);
    const bitir = (fn, v) => { if (bitti) return; bitti = true; clearTimeout(t); aktif.delete(c); fn(v); };
    c.stdout.on("data", d => {
      if (!o.ilerleme) return;
      tampon += d.toString("utf8");
      let i;
      while ((i = tampon.indexOf("\n")) >= 0) {
        const satir = tampon.slice(0, i).trim(); tampon = tampon.slice(i + 1);
        const m = /^out_time_(?:us|ms)=(\d+)/.exec(satir);
        if (m) { try { o.ilerleme(Number(m[1]) / 1e6); } catch (e) { /* ilerleme hatasi isi bozmasin */ } }
      }
    });
    c.stderr.on("data", d => { err += d.toString("utf8"); if (err.length > 300000) err = err.slice(-150000); });
    c.on("error", e => {
      if (bellekHatasiMi(e) || baslatmaBellekHatasiMi(e)) {   // spawn ENOMEM/EAGAIN (Windows'ta UNKNOWN): surec acacak bellek bile yok
        const h = new ortak.OrtakHata("bellek_yetersiz", "ffmpeg başlatılamadı: bilgisayarın belleği (RAM) ya da sistem kaynağı yetmedi (" + e.message + ")", { cikis: ortak.CIKIS.KAYNAK,
          cozum: "Diğer programları kapatıp aynı komutu tekrar çalıştır (iş kaldığı yerden sürer)." });
        h.ffStderr = "ENOMEM " + e.message;
        return bitir(red, h);
      }
      bitir(red, new ortak.OrtakHata("ffmpeg_yok", "ffmpeg başlatılamadı: " + e.message, { cikis: ortak.CIKIS.GIRDI,
        cozum: "ffmpeg kurulu mu? Windows'ta 'winget install Gyan.FFmpeg' ile kur." }));
    });
    c.on("close", kod => {
      if (zamanAsimi) {
        const sure = sinir < 60000 ? Math.round(sinir / 1000) + " saniyede" : (Math.round(sinir / 6000) / 10) + " dakikada";
        const e = new ortak.OrtakHata("ffmpeg_zaman_asimi", "ffmpeg adımı " + sure + " bitmedi" +
          (o.etiket ? " (" + o.etiket + ")" : "") + "; durduruldu.", { cikis: ortak.CIKIS.GENEL,
          cozum: "Bilgisayar çok yoğun olabilir; diğer programları kapatıp tekrar dene (iş kaldığı yerden sürer)." });
        e.ffStderr = err; return bitir(red, e);
      }
      if (kod === 0) return bitir(coz, { stderr: err });
      const satirlar = sonSatirlar(err);
      const son = satirlar[satirlar.length - 1] || ("çıkış kodu " + kod);
      let e;
      if (/No space left on device|ENOSPC/i.test(err)) {
        e = new ortak.OrtakHata("disk_dolu", "Diskte boş yer kalmadı; ffmpeg yazamadı.", { cikis: ortak.CIKIS.DISK,
          cozum: "Disk alanı aç (panelde Disk bölümünden ara dosyaları temizle) ve tekrar dene.", detay: satirlar.slice(-6) });
      } else if (bellekHatasiMi({ ffStderr: err })) {
        // calistir() bunu gorunce adimi dusuk bellek profiliyle tekrarlar; buraya kadar gelirse mesaj yine anlasilir olsun
        e = new ortak.OrtakHata("bellek_yetersiz", "ffmpeg adımı bellek yetmediği için durdu" + (o.etiket ? " (" + o.etiket + ")" : "") + ": " + son,
          { cikis: ortak.CIKIS.KAYNAK, detay: satirlar.slice(-12),
            cozum: "Diğer programları kapatıp aynı komutu tekrar çalıştır (iş kaldığı yerden sürer). Sürerse .env dosyasına RENDER_DUSUK_BELLEK=1 yaz." });
      } else if (/Invalid data found when processing input|moov atom not found/i.test(err)) {
        e = new ortak.OrtakHata("ffmpeg_girdi", "ffmpeg bir girdi dosyasını okuyamadı" + (o.etiket ? " (" + o.etiket + ")" : "") + ": " + son,
          { cikis: ortak.CIKIS.YETERSIZ, detay: satirlar.slice(-12) });
      } else {
        e = new ortak.OrtakHata("ffmpeg", "ffmpeg adımı başarısız" + (o.etiket ? " (" + o.etiket + ")" : "") + ": " + son,
          { cikis: ortak.CIKIS.GENEL, detay: satirlar.slice(-12),
            cozum: "İş kaldığı yerden devam eder: aynı işlemi tekrar çalıştır. Sürerse günlükteki (log) ffmpeg satırlarına bak." });
      }
      e.ffStderr = err; e.ffArgv = tam.slice(0, 14);
      bitir(red, e);
    });
  });
}

// girdi: argv dizisi YA DA (K)=>argv kurucu (K = kodekler() + dusukBellek). Kurucu verilirse kodlayici hatasinda
// GPU kapatilip ayni adim CPU ile bir kez tekrarlanir.
// BELLEK: bellek hatasinda adim dusuk bellek profiliyle BIR kez tekrarlanir (GPU varsa once GPU'nun az bellekli ayariyla;
// o da kodlayici bellegiyle duserse CPU'ya gecilir). Ikinci bellek hatasi 'bellek_yetersiz' (cikis 5) olarak firlatilir.
// secenek.bellekTekrar === false: tekrar YAPMA, yalniz dusuk bellek moduna gec ve hatayi firlat (paralel klipler: cagiran tek tek tekrarlar).
// secenek.calistirici (test): calistirTek yerine kullanilacak (argv, secenek) => Promise.
async function calistir(girdi, secenek) {
  const o = secenek || {};
  const kurucu = typeof girdi === "function";
  const calistirici = typeof o.calistirici === "function" ? o.calistirici : calistirTek;
  let bellekTekrarlandi = false;
  for (let deneme = 1; ; deneme++) {
    const seviye = bellekSeviyesi();
    const K = Object.assign(kodekler(), { dusukBellek: seviye > 0, bellekSeviyesi: seviye });
    const ham = kurucu ? girdi(K) : girdi;
    const argv = seviye > 0 ? dusukBellekArgv(ham, seviye) : ham;
    // dusuk bellek profili daha yavas: takilma siniri da ona gore genisler
    const so = seviye > 0 && o.zamanAsimiMs ? Object.assign({}, o, { zamanAsimiMs: o.zamanAsimiMs * (1 + seviye) }) : o;
    try { return await calistirici(argv, so); }
    catch (e) {
      const bellekHatasi = bellekHatasiMi(e);
      if (deneme >= 4) throw (bellekHatasi ? bellekYetersizHata(e, o, seviye) : e);
      if (bellekHatasi && !bellekTekrarlandi && seviye < 2) {
        bellekTekrarlandi = true;
        const yeni = dusukBellekAc("ffmpeg bellek hatası" + (o.etiket ? " (" + o.etiket + ")" : ""), seviye + 1);
        const bosGB = (os.freemem() / GB).toFixed(1);
        if (o.bellekTekrar === false) {
          if (yeni) ortak.uyari("Bellek az (" + bosGB + " GB boş): düşük bellek moduna geçildi, kalan adımlar tek tek ve az iş parçacığıyla çalışacak (daha yavaş, görüntü kalitesi aynı).");
          throw e;
        }
        ortak.uyari("Bellek az (" + bosGB + " GB boş): " + (o.etiket ? "'" + o.etiket + "' adımı" : "adım") +
          " düşük bellek moduyla yeniden deneniyor (daha yavaş, görüntü kalitesi aynı).");
        continue;
      }
      if (kurucu && K.gpu && kodlayiciHatasiMi(e)) {
        if (gpuAcikMi()) { gpuKapat(); ortak.uyari(bellekHatasi ? "GPU belleği yetmedi, CPU'ya geçildi (düşük bellek modu)" : "GPU hatası, CPU'ya geçildi"); }
        continue;
      }
      if (bellekHatasi) throw bellekYetersizHata(e, o, seviye);
      throw e;
    }
  }
}

// stderr metnini dondurur (ebur128, loudnorm olcumu icin): -loglevel info ile, hata atmaz. Dusuk bellek modunda o profille.
function olc(argv, secenek) {
  const o = secenek || {};
  const seviye = bellekSeviyesi();
  const a = seviye > 0 ? dusukBellekArgv(argv, seviye) : argv;
  return new Promise((coz, red) => {
    const c = spawn(ffmpegYolu(), ["-hide_banner", "-nostats", "-loglevel", "info", ...a],
      { cwd: o.cwd, stdio: ["ignore", "ignore", "pipe"], windowsHide: true });
    aktif.add(c);
    let err = "";
    const t = setTimeout(() => { try { c.kill("SIGKILL"); } catch (e) { /* bitmis */ } }, o.zamanAsimiMs || 300000);
    c.stderr.on("data", d => { err += d.toString("utf8"); if (err.length > 400000) err = err.slice(-200000); });
    c.on("error", e => { clearTimeout(t); aktif.delete(c); red(e); });
    c.on("close", kod => { clearTimeout(t); aktif.delete(c); coz({ kod, stderr: err }); });
  });
}

// ---------------------------------------------------------------- ffprobe
// ffprobe cagrilari (testler _ic'i degistirir; gercek ffprobe calistirmadan bellek hatasini taklit eder)
const _ic = {
  ffprobeSync: (argv, o) => execFileSync(ffprobeYolu(), argv, o),
  ffprobeAsync: (argv, o, cb) => require("child_process").execFile(ffprobeYolu(), argv, o, cb),
};
const BILGI_ARGV = ["-v", "error", "-show_entries", "format=duration:stream=codec_type,codec_name,width,height,sample_rate", "-of", "json"];
// ffprobe bellek/kaynak yetmedigi icin mi calisamadi (surec baslatilamadi ya da stderr'de bellek hatasi)?
const ffprobeBellekHatasiMi = (e, err) => baslatmaBellekHatasiMi(e) || BELLEK_HATASI.test(String(err || (e && e.stderr) || ""));
function ffprobeBellekHata(dosya, e) {
  return new ortak.OrtakHata("bellek_yetersiz", "ffprobe çalıştırılamadı (" + path.basename(dosya) + "): bilgisayarın belleği (RAM) ya da sistem kaynağı yetmedi.", {
    cikis: ortak.CIKIS.KAYNAK, detay: String((e && (e.stderr || e.message)) || "").slice(-300),
    cozum: "Diğer programları (tarayıcı sekmeleri, oyun, video düzenleyici) kapatıp aynı komutu tekrar çalıştır (iş kaldığı yerden sürer). " +
      "Sürerse .env dosyasına RENDER_DUSUK_BELLEK=1 yaz." });
}
// Bellek darken ffprobe da baslatilamayabilir. Eskiden bu "dosya okunamadi" sayiliyordu: gecerliMi false donup SAGLAM ara dosya
// silinir, klip asamasinda saglam gorsel "bozuk" denip komsu gorselle degistirilirdi. Simdi kisa bir bekleyisle BIR kez daha denenir;
// surec yine BASLATILAMAZSA 'bellek_yetersiz' (cikis 5) firlatilir. ffprobe calisip "Cannot allocate memory" yazdiysa da bir kez
// tekrar edilir ama sonra eskisi gibi 'dosya_okunamadi' kalir: bozuk bir dosya (dev atom boyutu) da bu hatayi HER SEFERINDE verir;
// onu bellek sayarsak bozuk ara dosya hic yeniden uretilmez, is takili kalirdi.
function bilgi(dosya) {
  let j;
  for (let deneme = 1; ; deneme++) {
    try {
      j = JSON.parse(_ic.ffprobeSync([...BILGI_ARGV, dosya], { timeout: 30000, windowsHide: true, maxBuffer: 1 << 22 }).toString("utf8"));
      break;
    } catch (e) {
      const baslatilamadi = baslatmaBellekHatasiMi(e);
      if (deneme < 2 && (baslatilamadi || ffprobeBellekHatasiMi(e))) { uyu(500); continue; }
      if (baslatilamadi) throw ffprobeBellekHata(dosya, e);
      throw new ortak.OrtakHata("dosya_okunamadi", "Dosya okunamadı: " + path.basename(dosya), { cikis: ortak.CIKIS.YETERSIZ,
        detay: String(e.stderr || e.message).slice(-300) });
    }
  }
  const v = (j.streams || []).find(s => s.codec_type === "video");
  const a = (j.streams || []).find(s => s.codec_type === "audio");
  const sure = Number(j.format && j.format.duration);
  return { sure: Number.isFinite(sure) ? sure : null, genislik: v ? v.width : null, yukseklik: v ? v.height : null,
    videoKodek: v ? v.codec_name : null, sesVar: !!a, sesOrnekleme: a ? Number(a.sample_rate) : null };
}
function sureOlc(dosya) {
  const b = bilgi(dosya);
  if (b.sure === null) throw new ortak.OrtakHata("dosya_okunamadi", "Dosyanın süresi okunamadı: " + path.basename(dosya), { cikis: ortak.CIKIS.YETERSIZ });
  return b.sure;
}
// bozuksa false (silmek/yeniden uretmek icin); beklenenSn verilirse +-tol ile karsilastirir
// o.bellekFirlat: ffprobe bellek yetmedigi icin calisamadiysa false DONME, 'bellek_yetersiz' firlat (dosya bozuk degil, olculemedi:
// cagiran saglam dosyayi silmesin / gorseli komsusuyla degistirmesin). Verilmezse eski davranis: her hata false.
function gecerliMi(dosya, beklenenSn, tol, o) {
  try {
    if (!fs.existsSync(dosya) || fs.statSync(dosya).size === 0) return false;
    const b = bilgi(dosya);
    if (b.sure === null || b.sure <= 0) return false;
    if (beklenenSn !== undefined && beklenenSn !== null && Math.abs(b.sure - beklenenSn) > (tol === undefined ? 0.15 : tol)) return false;
    return true;
  } catch (e) {
    if (o && o.bellekFirlat && bellekHatasiMi(e)) throw e;
    return false;
  }
}

// ---------------------------------------------------------------- gorsel dogrulama
const IMZALAR = [
  { ad: "jpeg", ok: b => b.length > 3 && b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF },
  { ad: "png", ok: b => b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47 },
  { ad: "webp", ok: b => b.length > 12 && b.toString("latin1", 0, 4) === "RIFF" && b.toString("latin1", 8, 12) === "WEBP" },
];
// { ok, en, boy, neden } — sihirli bayt + ffprobe ile boyut. HTML hata sayfasi, 0 bayt, bozuk dosya elenir.
function gorselDogrula(dosya, yalnizImza) {
  let boyut = 0;
  try { boyut = fs.statSync(dosya).size; } catch (e) { return { ok: false, neden: "dosya yok" }; }
  if (boyut < 200) return { ok: false, neden: "dosya boş ya da çok küçük" };
  let bas;
  try {
    const fd = fs.openSync(dosya, "r");
    try { bas = Buffer.alloc(16); fs.readSync(fd, bas, 0, 16, 0); } finally { fs.closeSync(fd); }
  } catch (e) { return { ok: false, neden: "dosya okunamadı" }; }
  if (!IMZALAR.some(i => i.ok(bas))) return { ok: false, neden: "görsel biçimi tanınmadı (JPEG/PNG/WebP değil)" };
  if (yalnizImza) return { ok: true, bayt: boyut };
  try {
    const b = bilgi(dosya);
    if (!b.genislik || !b.yukseklik) return { ok: false, neden: "görsel boyutu okunamadı" };
    return { ok: true, en: b.genislik, boy: b.yukseklik, bayt: boyut };
  } catch (e) { return { ok: false, neden: "görsel okunamadı" }; }
}

// Ayni dogrulama, olay dongusunu bloklamadan (yuzlerce gorseli paralel dogrulamak icin)
// Bellek/kaynak yetmeyip ffprobe baslatilamadiysa yarim saniye sonra BIR kez daha denenir (bellek darken gorsel "okunamadi" sayilip
// videodan dusmesin).
function bilgiAsync(dosya, deneme) {
  return new Promise((coz, red) => {
    _ic.ffprobeAsync([...BILGI_ARGV, dosya], { timeout: 30000, windowsHide: true, maxBuffer: 1 << 22 }, (e, out, err) => {
      if (e && !deneme && ffprobeBellekHatasiMi(e, err)) return setTimeout(() => bilgiAsync(dosya, 2).then(coz, red), 500);
      if (e) return red(e);
      try {
        const j = JSON.parse(String(out));
        const v = (j.streams || []).find(s => s.codec_type === "video");
        const sure = Number(j.format && j.format.duration);
        coz({ sure: Number.isFinite(sure) ? sure : null, genislik: v ? v.width : null, yukseklik: v ? v.height : null });
      } catch (e2) { red(e2); }
    });
  });
}
async function gorselDogrulaAsync(dosya) {
  const on = gorselDogrula(dosya, true);      // yalniz boyut/imza (ffprobe'suz)
  if (!on.ok) return on;
  try {
    const b = await bilgiAsync(dosya);
    if (!b.genislik || !b.yukseklik) return { ok: false, neden: "görsel boyutu okunamadı" };
    return { ok: true, en: b.genislik, boy: b.yukseklik, bayt: on.bayt };
  } catch (e) { return { ok: false, neden: "görsel okunamadı" }; }
}

// ---------------------------------------------------------------- paralel calistirma
// Her is kendi hatasini dondurur; digerlerini durdurmaz (bellek darken seri tekrar icin).
// n sayi YA DA () => sayi: islev verilirse her yeni iste yeniden okunur ve azalinca fazla isciler (elindeki isi bitirip)
// cekilir. Boylece bellek hatasiyla dusuk bellek moduna gecilince kalan isler hemen tek tek yurur.
async function paralel(liste, n, calis) {
  const sonuc = new Array(liste.length);
  const sinir = typeof n === "function" ? () => Math.max(1, Math.floor(Number(n()) || 1)) : () => Math.max(1, n);
  let sira = 0;
  const adet = Math.max(1, Math.min(sinir(), liste.length));
  let isciSayisi = adet;
  const isci = async () => {
    for (;;) {
      if (isciSayisi > sinir()) { isciSayisi--; return; }
      const i = sira++;
      if (i >= liste.length) return;
      try { sonuc[i] = { ok: true, deger: await calis(liste[i], i) }; }
      catch (e) { sonuc[i] = { ok: false, hata: e }; }
    }
  };
  await Promise.all(Array.from({ length: adet }, isci));
  return sonuc;
}

// Surenin (sn) ffmpeg adimi icin makul zaman asimi (ms): taban + sure x carpan
const zamanAsimi = (sn, carpan, tabanSn) => Math.round(((tabanSn || 90) + Math.max(0, sn) * (carpan || 20)) * 1000);

// Isletim sistemine gore bos cihaz
const NULL_CIHAZ = process.platform === "win32" ? "NUL" : "/dev/null";

// Paralellik: cekirdek + bos bellek ile sinirli; NVIDIA tuketici kartlarinda eszamanli
// kodlama oturumu siniri nedeniyle en cok 3. Dusuk bellek modunda 1 (klipler tek tek).
function paralellik() {
  const bosGB = os.freemem() / GB;
  let n = Math.max(1, Math.min(4, os.cpus().length - 2, Math.floor(bosGB / 1.2)));
  const K = kodekler();
  if (K.gpu && K.marka === "nvidia") n = Math.min(n, 3);
  const dusukBellek = dusukBellekMi();
  if (dusukBellek) n = 1;
  return { n, bosGB, dusukBellek };
}

// concat demuxer satiri: yoldaki tek tirnak '\'' ile kacirilir
const concatSatiri = yol => "file '" + String(yol).replace(/\\/g, "/").replace(/'/g, "'\\''") + "'";

// ---------------------------------------------------------------- atomik cikti (.part -> yeniden adlandir)
// ffmpeg ciktisi dogrudan hedefe YAZILMAZ: <ad>.part.<uzanti>'ya yazilir, basariliysa yeniden adlandirilir.
// Boylece yarida kesilen (Durdur, elektrik, disk dolu) bir adim yarim dosyayi "bitmis" gibi birakmaz.
const partYolu = hedef => hedef.replace(/(\.[^./\\]+)$/, ".part$1");
const KILIT_KODLARI = ["EPERM", "EBUSY", "EACCES"];
const kilitHatasiMi = e => !!e && KILIT_KODLARI.includes(e.code);
const bekle = ms => new Promise(coz => setTimeout(coz, ms));

function kilitliHata(hedef, son, parkta) {
  const ad = path.basename(hedef);
  return new ortak.OrtakHata("cikti_kilitli", "Hazır dosya yeniden adlandırılamadı: " + ad + " başka bir program tarafından açık olabilir.", {
    cikis: ortak.CIKIS.GENEL, detay: son && son.message,
    cozum: parkta
      ? ad + " dosyasını açan programı (video oynatıcı, önizleme) kapatıp işi tekrar çalıştır: bitmiş sonuç saklandı, yeniden kodlanmaz."
      : ad + " dosyasını açan programı (video oynatıcı, önizleme, virüs taraması) kapatıp işi tekrar çalıştır." });
}

// Kisa, ESZAMANLI yeniden adlandirma (kapak gibi kucuk cikti icin). Uzun sure beklemesi gereken adimlar partBitirBekle kullanir.
function partBitir(part, hedef) {
  let son = null;
  for (let i = 0; i < 6; i++) {
    try { fs.renameSync(part, hedef); return; }
    catch (e) {
      son = e;
      if (!kilitHatasiMi(e)) break;
      try { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 60 * (i + 1)); } catch (e2) { /* bekleme olmadi */ }
    }
  }
  throw kilitliHata(hedef, son, false);
}

// Hedef dosya baska bir programda acikken (Windows'ta oynatici, paylasimsiz sayac) yeniden adlandirma BASARISIZ olur. Saatler
// suren final kodlamasi bu yuzden kaybolmasin diye: (1) hedef ACILANA kadar beklenir (o.kilitBeklemeSn; yoksa 3 sn, ortamdan
// RENDER_KILIT_BEKLEME_SN ile degistirilir), kullanici programi kapatinca islem kendiliginden surer; (2) sure dolarsa ve
// o.park verilmisse bitmis dosya park klasorune (.bekleyen) tasinir — .part gibi baslangicta SILINMEZ — ve sonraki calisma
// ayni imzayla onu bulup yeniden kodlamadan hedefe yerlestirir.
// o: { kilitBeklemeSn, park:{klasor, imza, beklenenSn}, yenidenAdlandir (test) }
async function partBitirBekle(part, hedef, o) {
  const op = o || {};
  const ren = op.yenidenAdlandir || fs.renameSync;
  const envHam = String(ortak.envOku("RENDER_KILIT_BEKLEME_SN") || "").trim();
  const envSn = envHam !== "" ? Number(envHam) : NaN;
  const bekleSn = Number.isFinite(envSn) && envSn >= 0 ? envSn : (op.kilitBeklemeSn !== undefined ? op.kilitBeklemeSn : 3);
  const bas = Date.now();
  let son = null, uyarildi = false, sonYazi = 0;
  for (let i = 0; ; i++) {
    try { ren(part, hedef); return; }
    catch (e) {
      son = e;
      if (!kilitHatasiMi(e)) break;
      const gecen = (Date.now() - bas) / 1000;
      if (gecen >= bekleSn) break;
      if (bekleSn > 5) {
        if (!uyarildi && gecen >= 2) {
          uyarildi = true; sonYazi = gecen;
          ortak.uyari(path.basename(hedef) + " başka bir programda açık görünüyor: kapatırsan işlem kendiliğinden sürer (en çok " + Math.round(bekleSn) + " sn beklenecek).");
        } else if (uyarildi && gecen - sonYazi >= 15) {
          sonYazi = gecen;
          console.log("  " + path.basename(hedef) + " hâlâ açık, bekleniyor... (" + Math.round(gecen) + "/" + Math.round(bekleSn) + " sn)");
        }
      }
      await bekle(i < 5 ? 60 * (i + 1) : 500);
    }
  }
  if (!kilitHatasiMi(son))
    throw new ortak.OrtakHata("cikti_yazilamadi", "Hazır dosya yerine konamadı: " + path.basename(hedef) + " (" + (son && son.code || (son && son.message)) + ")", {
      cikis: ortak.CIKIS.GENEL, detay: son && son.message, cozum: "Klasörün var ve yazılabilir olduğundan emin olup işi tekrar çalıştır." });
  const parkYolu = op.park ? bekletKaydet(part, hedef, op.park) : null;
  throw kilitliHata(hedef, son, !!parkYolu);
}

// ---- bekleyen (kilitli hedef yuzunden yerlestirilemeyen) bitmis sonuc
const bekleyenYolu = (hedef, klasor) => path.join(klasor, path.basename(hedef).replace(/(\.[^./\\]+)$/, ".bekleyen$1"));
function bekletKaydet(part, hedef, park) {
  try {
    fs.mkdirSync(park.klasor, { recursive: true });
    const b = bekleyenYolu(hedef, park.klasor);
    try { fs.unlinkSync(b); } catch (e) { /* yok */ }
    fs.renameSync(part, b);
    ortak.atomikJsonYaz(b + ".json", { surum: 1, imza: park.imza, hedef: path.basename(hedef), beklenenSn: park.beklenenSn,
      bayt: fs.statSync(b).size, zaman: new Date().toISOString() });
    return b;
  } catch (e) { return null; }          // park edilemedi (ornegin baska surucu): .part yerinde kalir, hata yine verilir
}
// Onceki calismadan kalan bekleyen sonuc AYNI imzada ve saglamsa hedefe yerlestirilir (true); degilse silinir (false).
async function bekleyeniUygula(hedef, o) {
  const b = bekleyenYolu(hedef, o.park.klasor), j = b + ".json";
  if (!fs.existsSync(b)) { try { fs.unlinkSync(j); } catch (e) { /* yok */ } return false; }
  let m = null;
  try { m = JSON.parse(fs.readFileSync(j, "utf8")); } catch (e) { m = null; }
  let saglam = false;
  try { saglam = !!m && m.imza === o.park.imza && (!m.bayt || fs.statSync(b).size === m.bayt) && gecerliMi(b, o.park.beklenenSn, 0.5); } catch (e) { saglam = false; }
  if (!saglam) { for (const x of [b, j]) { try { fs.unlinkSync(x); } catch (e) { /* yok */ } } return false; }
  console.log("  " + path.basename(hedef) + ": önceki çalışmada tamamlanıp hedef dosya açık olduğu için saklanan sonuç bulundu — yeniden kodlanmıyor");
  try { await partBitirBekle(b, hedef, Object.assign({}, o, { park: null })); }
  catch (e) { if (e && e.kod === "cikti_kilitli") throw kilitliHata(hedef, e, true); throw e; }
  try { fs.unlinkSync(j); } catch (e) { /* yok */ }
  return true;
}
// Kurucu (K)=>argv, SON argumani cikti yolu OLMAYAN dizi doner; cikti burada eklenir.
// secenek.girdiler: bu adimin girdisi olan ara dosyalar. Adim "girdi okunamadi" ile dusuyorsa bozuk olan girdi
// (ffprobe sureyi okur ama kare verisi bozuk olabilir) bulunup SILINIR ve cagirana 'ara_dosya_bozuk' firlatilir:
// aksi halde bozuk dosya onbellekte kalir ve her yeniden denemede ayni hata tekrarlanirdi.
// secenek.kilitBeklemeSn / secenek.park: hedef baska programda aciksa beklenir, hala aciksa bitmis sonuc saklanir (partBitirBekle).
async function uret(hedef, kurucu, secenek) {
  const part = partYolu(hedef);
  if (secenek && secenek.park && await bekleyeniUygula(hedef, secenek)) return hedef;
  try { fs.unlinkSync(part); } catch (e) { /* yok */ }
  try {
    await calistir(K => [...(typeof kurucu === "function" ? kurucu(K) : kurucu), part], secenek);
  } catch (e) {
    try { fs.unlinkSync(part); } catch (e2) { /* yok */ }
    const girdiler = secenek && Array.isArray(secenek.girdiler) ? secenek.girdiler : [];
    // bellek hatasi girdi bozuklugu DEGILDIR: tam cozumleme (bellek darken) saglam ara dosyayi yanlislikla sildirmesin
    if (girdiler.length && !bellekHatasiMi(e) && (e.kod === "ffmpeg_girdi" || /Invalid data|moov atom|Error submitting packet|decoder/i.test(String(e.ffStderr || e.message)))) {
      const bozuk = [];
      for (const g of girdiler) if (!(await tamDogrula(g))) bozuk.push(g);
      for (const g of bozuk) { try { fs.unlinkSync(g); } catch (e2) { /* kilitli: sonraki calismada tekrar denenir */ } }
      if (bozuk.length) {
        const h = new ortak.OrtakHata("ara_dosya_bozuk", "Ara dosya bozuk çıktı ve silindi: " + bozuk.map(g => path.basename(g)).join(", "), {
          cikis: ortak.CIKIS.GENEL, cozum: "İşi aynı şekilde tekrar çalıştır: silinen ara dosyalar yeniden üretilir (başka bir şey yapmana gerek yok)." });
        h.silinen = bozuk;
        throw h;
      }
    }
    throw e;
  }
  await partBitirBekle(part, hedef, secenek);
  return hedef;
}

// Ara dosyanin ICINDEKI bozulmayi yakalar (ffprobe yalniz basligi/sureyi okur): video akisini bastan sona cozer, ilk
// hatada durur. Pahali oldugundan yalniz bir adim "girdi okunamadi" ile dustugunde, suclu girdiyi bulmak icin cagrilir.
function tamDogrula(dosya, zamanAsimiMs) {
  return new Promise(coz => {
    let c, bitti = false, t = null;
    const bit = v => { if (bitti) return; bitti = true; clearTimeout(t); if (c) aktif.delete(c); coz(v); };
    try {
      c = spawn(ffmpegYolu(), ["-v", "error", "-xerror", "-i", dosya, "-map", "0:v:0", "-f", "null", NULL_CIHAZ], { stdio: ["ignore", "ignore", "pipe"], windowsHide: true });
    } catch (e) { return bit(true); }                    // calistirilamadi: dosyayi suclama
    aktif.add(c);
    let err = "";
    t = setTimeout(() => { try { c.kill("SIGKILL"); } catch (e) { /* bitmis */ } bit(true); }, zamanAsimiMs || 300000);   // takildi: suclama
    c.stderr.on("data", d => { err += d.toString("utf8"); if (err.length > 20000) err = err.slice(-10000); });
    c.on("error", () => bit(true));
    c.on("close", kod => bit(kod === 0 && !err.trim()));
  });
}

module.exports = {
  ffmpegYolu, ffprobeYolu, kodekler, gpuKapat, gpuAcikMi, kodlayiciSabitle, kodlayiciHatasiMi,
  bellekHatasiMi, baslatmaBellekHatasiMi, bellekProfili, bellekSeviyesi, dusukBellekMi, dusukBellekAc, bellekSifirla, dusukBellekArgv, bellekYetersizHata,
  DUSUK_BELLEK_ESIK_GB, DUSUK_PROFIL, vmStatBosBayt, _ic,
  calistir, calistirTek, olc, bilgi, bilgiAsync, sureOlc, gecerliMi, gorselDogrula, gorselDogrulaAsync,
  paralel, zamanAsimi, paralellik, NULL_CIHAZ, concatSatiri, sonSatirlar,
  partYolu, partBitir, partBitirBekle, bekleyenYolu, uret, tamDogrula, RENK_ETIKET, RENK_SETPARAMS, RENK_YUV_SON, RENK_RGB_YUV,
};
