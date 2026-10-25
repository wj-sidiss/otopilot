/*
 * Video Indirici - localhost paneli
 * Sifir bagimlilik (npm install YOK). Sadece Node + yt-dlp + ffmpeg.
 * Baslat: BASLAT.bat  ->  http://localhost:4190
 *
 * Guvenlik modeli (SOZLESME v1 §6.4 ile ayni, indirici icin uyarlandi):
 *  - yalniz 127.0.0.1 dinler; Host basligi yalniz localhost/127.0.0.1/[::1] + port olabilir
 *    (DNS rebinding), POST'ta Content-Type: application/json sart, Origin varsa kendi adresi olmali
 *  - acilista rastgele JETON uretilir; tum /api cagrilari X-Panel-Token ister (CSRF).
 *    EventSource ve <video> baslik gonderemez: yalniz /api/akis ve /dosya/ icin HttpOnly
 *    SameSite=Strict cerez (indirici_oturum) de kabul edilir.
 *  - indirme klasoru yalniz izinli koklerin altina cevrilebilir; sil / oynat / dosya sunma
 *    islemleri uzanti beyaz listesi + klasor icinde kalma (symlink dahil) kontrolu ister.
 *  - yt-dlp'ye giden her link dogrulanir (http/https, yerel ag adresi degil), `--` ile verilir.
 *
 * Test icin ortam degiskenleri (hepsi istege bagli):
 *  INDIRICI_PORT, INDIRICI_KLASOR, INDIRICI_AYAR_DOSYASI, INDIRICI_KESFET_DOSYASI,
 *  YTDLP_YOL (yt-dlp yerine baska bir komut/betik), OTOMASYON_ENV_DOSYASI, OTOMASYON_URETIM
 */
'use strict';

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const dns = require('dns');
const { spawn } = require('child_process');

const WIN = process.platform === 'win32';
const KOK = __dirname;
const VARSAYILAN_PORT = 4190;
const AYAR_DOSYA = process.env.INDIRICI_AYAR_DOSYASI
  ? path.resolve(process.env.INDIRICI_AYAR_DOSYASI) : path.join(KOK, 'ayarlar.json');
const KESFET_DOSYA = process.env.INDIRICI_KESFET_DOSYASI
  ? path.resolve(process.env.INDIRICI_KESFET_DOSYASI) : path.join(KOK, 'kesfet-veri.json');
const VARSAYILAN_KLASOR = process.env.INDIRICI_KLASOR
  ? path.resolve(process.env.INDIRICI_KLASOR) : path.join(KOK, 'indirilenler');

// otomasyon projesinin icindeyse log uretim/_log'a, tek basina calisiyorsa yaninda log/ klasorune
const LOG_DIZIN = process.env.OTOMASYON_URETIM
  ? path.join(path.resolve(process.env.OTOMASYON_URETIM), '_log')
  : (fs.existsSync(path.join(KOK, '..', 'panel.js'))
    ? path.join(KOK, '..', 'uretim', '_log') : path.join(KOK, 'log'));

const GOVDE_MAX = 1024 * 1024;          // istek govdesi ust siniri (1 MB; en uzun istek = link listesi)
const LINK_MAX = 200;                   // tek istekte en cok link / liste ogesi
const KUYRUK_MAX = 500;                 // bitmemis is ust siniri
const AKIS_MAX = 20;                    // ayni anda en cok SSE baglantisi
const DISK_ESIK_GB = 1;                 // bundan az bos yerde indirme baslatilmaz
const BOSTA_KALMA_MS = 15 * 60 * 1000;  // yt-dlp bu kadar suredir tek satir yazmadiysa takildi say
const KALITELER = ['en-iyi', '2160', '1440', '1080', '720', '480', 'mp3'];
const JETON = crypto.randomBytes(32).toString('hex');
const CEREZ_AD = 'indirici_oturum';

// test icin disaridan degistirilebilen dis bagimliliklar (ag, isletim sistemi)
const ic = { https, ac: platformAc, dns: dns.promises };

let aktifPort = VARSAYILAN_PORT;

// ---------------------------------------------------------------- log
function logYaz(m) {
  const satir = new Date().toISOString() + ' ' + m;
  try { console.error('  ' + m); } catch { /* konsol yoksa gec */ }
  try {
    fs.mkdirSync(LOG_DIZIN, { recursive: true });
    fs.appendFileSync(path.join(LOG_DIZIN, 'indirici-' + satir.slice(0, 10) + '.log'), satir + '\n');
  } catch { /* log yazilamazsa sessiz gec */ }
}

// ---------------------------------------------------------------- yol yardimcilari
// taban'in icinde mi (taban dahil)? startsWith DEGIL: 'C:\a' ile 'C:\ab' karismasin
function icinde(taban, hedef) {
  const g = path.relative(taban, hedef);
  if (g === '') return true;
  return g !== '..' && !g.startsWith('..' + path.sep) && !path.isAbsolute(g);
}

// var olan en yakin ust klasoru realpath'ler, kalani ekler: junction/symlink ile
// izinli kokun disina cikis (ve disinda klasor yaratma) bu sayede yakalanir
function gercekYol(p) {
  const kalan = [];
  let cur = p;
  for (;;) {
    try {
      const r = fs.realpathSync(cur);
      return kalan.length ? path.join(r, ...kalan.reverse()) : r;
    } catch {
      const ust = path.dirname(cur);
      if (ust === cur) return p;
      kalan.push(path.basename(cur));
      cur = ust;
    }
  }
}

function izinliKokler() {
  const ev = os.homedir();
  return [VARSAYILAN_KLASOR, path.join(ev, 'Videos'), path.join(ev, 'Downloads'), path.join(ev, 'Movies')];
}

// Indirme klasoru yalniz izinli koklerin (varsayilan klasor, Videos, Downloads, Movies) altinda olabilir
function klasorDogrula(ham) {
  if (typeof ham !== 'string') return { ok: false, neden: 'Klasör yolu metin olmalı.' };
  const g = ham.trim();
  if (!g || g.length > 300 || g.includes('\0')) return { ok: false, neden: 'Klasör yolu geçersiz.' };
  // ag yollari (\\sunucu\paylasim) ve cihaz yollari (\\?\, \\.\) hic denenmez: erisilemeyen sunucuda
  // dosya sistemi cagrisi saniyelerce takilip tum sunucuyu bekletebilir
  if (/^[\\/]{2}/.test(g)) return { ok: false, neden: 'Ağ (UNC) ve cihaz yolları desteklenmez; bu bilgisayardaki bir klasör ver.' };
  if (!path.isAbsolute(g)) {
    return { ok: false, neden: 'Klasörün tam yolunu ver (örn. ' + path.join(os.homedir(), 'Videos', 'indirilenler') + ').' };
  }
  const y = path.resolve(g);
  const gy = gercekYol(y);
  const kokler = izinliKokler();
  for (const k of kokler) {
    const kr = path.resolve(k);
    if (icinde(kr, y) && icinde(gercekYol(kr), gy)) return { ok: true, yol: y };
  }
  return {
    ok: false,
    neden: 'Güvenlik için indirme klasörü yalnızca şu konumların altında olabilir: ' + kokler.join('  ·  '),
  };
}

// Oynat / Klasorde goster / Sil / onizleme yalniz bu uzantilar icin calisir (calistirilabilir turler YOK).
// yt-dlp birlestirme gerektirmeyen tek dosyali formatlarda (-f b geri dusus) mp4 disinda da uzanti yazabilir:
// .m4v .flv .3gp .ts .ogv .ogg .aac .flac. Bitti gorunen isin Oynat'i 404 vermesin diye hepsi listede.
const VIDEO_UZANTI = new Set([
  '.mp4', '.mkv', '.webm', '.mov', '.m4a', '.mp3', '.opus', '.wav', '.avi',
  '.m4v', '.flv', '.3gp', '.ts', '.ogv', '.ogg', '.aac', '.flac',
]);
const MIME = {
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.mkv': 'video/x-matroska', '.mov': 'video/quicktime',
  '.avi': 'video/x-msvideo', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.opus': 'audio/ogg', '.wav': 'audio/wav',
  '.m4v': 'video/x-m4v', '.flv': 'video/x-flv', '.3gp': 'video/3gpp', '.ts': 'video/mp2t', '.ogv': 'video/ogg',
  '.ogg': 'audio/ogg', '.aac': 'audio/aac', '.flac': 'audio/flac',
};

// ".ts" hem MPEG-TS videosu hem TypeScript kaynagi olabilir (Downloads klasorunde ikincisi de bulunur): uzanti tek basina
// yetmez. MPEG-TS paketleri 188 baytta bir 0x47 ile baslar; ilk iki paketin sync baytina bakilir. Baska uzantilar icin true.
function medyaIcerigiMi(tam, uzanti) {
  if (uzanti !== '.ts') return true;
  let fd;
  try {
    fd = fs.openSync(tam, 'r');
    const b = Buffer.alloc(189);
    const n = fs.readSync(fd, b, 0, 189, 0);
    return n >= 1 && b[0] === 0x47 && (n < 189 || b[188] === 0x47);
  } catch { return false; } finally { if (fd !== undefined) { try { fs.closeSync(fd); } catch { /* kapali */ } } }
}

// ---------------------------------------------------------------- ayarlar
const varsayilanAyar = { klasor: VARSAYILAN_KLASOR, kalite: 'en-iyi', cerez: false };
let ayar = { ...varsayilanAyar };

function ayarYukle() {
  let ham;
  try { ham = JSON.parse(fs.readFileSync(AYAR_DOSYA, 'utf8')); } catch { return; } // ilk calistirma
  if (!ham || typeof ham !== 'object' || Array.isArray(ham)) return;
  if (typeof ham.klasor === 'string') {
    const k = klasorDogrula(ham.klasor);
    if (k.ok) ayar.klasor = k.yol;
    else logYaz('UYARI: ayarlar.json içindeki indirme klasörü reddedildi, varsayılana dönüldü (' + k.neden + ')');
  }
  if (KALITELER.includes(ham.kalite)) ayar.kalite = ham.kalite;
  if (typeof ham.cerez === 'boolean') ayar.cerez = ham.cerez;
}

// gecici dosyaya yaz + yeniden adlandir: yarida kalan yazma ayari bozmasin
function ayarKaydet() {
  const gecici = AYAR_DOSYA + '.' + process.pid + '.tmp';
  try {
    fs.writeFileSync(gecici, JSON.stringify(ayar, null, 2) + '\n');
    fs.renameSync(gecici, AYAR_DOSYA);
    return true;
  } catch (e) {
    try { fs.unlinkSync(gecici); } catch { /* yoksa gec */ }
    logYaz('Ayar kaydedilemedi: ' + e.message);
    return false;
  }
}
function klasorGarantile() {
  try { fs.mkdirSync(ayar.klasor, { recursive: true }); } catch (e) { logYaz('İndirme klasörü açılamadı: ' + e.message); }
}

function diskBosGB(yol) {
  try {
    const s = fs.statfsSync(yol);
    return (s.bavail * s.bsize) / 1073741824;
  } catch { return null; } // olculemediyse engelleme
}

// ---------------------------------------------------------------- yt-dlp bulma
// cocuk surece API anahtarlari gitmesin
const COCUK_ENV = (() => {
  const e = {};
  for (const [k, v] of Object.entries(process.env)) if (!/(KEY|TOKEN|SECRET|PASSWORD)/i.test(k)) e[k] = v;
  return { ...e, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' };
})();
let YT = null;            // {cmd, base:[], surum}
let ffmpegHazir = false;

function agaciOldur(p) {
  if (!p || !p.pid) return;
  try {
    if (WIN) {
      const k = spawn('taskkill', ['/PID', String(p.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
      k.on('error', () => { try { p.kill(); } catch { /* bitmis */ } });
      k.unref();
    } else {
      try { process.kill(-p.pid, 'SIGTERM'); } catch { p.kill('SIGTERM'); }
    }
  } catch { try { p.kill(); } catch { /* bitmis */ } }
}

function komutCalistir(cmd, args, { onLine, cwd, zamanAsimiMs, onSpawn } = {}) {
  return new Promise((resolve) => {
    let p;
    try {
      p = spawn(cmd, args, { cwd: cwd || KOK, env: COCUK_ENV, windowsHide: true, detached: !WIN });
    } catch (e) {
      return resolve({ kod: -1, cikti: '', hata: String(e && e.message || e) });
    }
    if (onSpawn) onSpawn(p);
    let zamanAsimi = false;
    const zaman = zamanAsimiMs ? setTimeout(() => { zamanAsimi = true; agaciOldur(p); }, zamanAsimiMs) : null;
    let cikti = '', hata = '', tampon = '', hTampon = '';
    p.stdout.setEncoding('utf8');
    p.stderr.setEncoding('utf8');
    p.stdout.on('data', (d) => {
      cikti += d;
      if (!onLine) return;
      tampon += d;
      const satirlar = tampon.split(/\r?\n/);
      tampon = satirlar.pop();
      for (const s of satirlar) onLine(s, 'out');
    });
    p.stderr.on('data', (d) => {
      hata += d;
      if (!onLine) return;
      hTampon += d;
      const satirlar = hTampon.split(/\r?\n/);
      hTampon = satirlar.pop();
      for (const s of satirlar) onLine(s, 'err');
    });
    p.on('error', (e) => { clearTimeout(zaman); resolve({ kod: -1, cikti, hata: hata + String(e && e.message || e) }); });
    p.on('close', (kod) => {
      clearTimeout(zaman);
      if (onLine) { if (tampon) onLine(tampon, 'out'); if (hTampon) onLine(hTampon, 'err'); }
      resolve({
        kod: zamanAsimi ? -2 : kod, cikti, zamanAsimi,
        hata: zamanAsimi ? hata + '\nZaman aşımı: komut yanıt vermedi.' : hata,
      });
    });
  });
}

function pythonScriptsKlasorleri() {
  const yollar = [];
  if (WIN) {
    const la = process.env.LOCALAPPDATA;
    if (la) {
      const kok = path.join(la, 'Programs', 'Python');
      try {
        for (const d of fs.readdirSync(kok)) yollar.push(path.join(kok, d, 'Scripts', 'yt-dlp.exe'));
      } catch { /* kurulu degil */ }
    }
    for (const v of ['312', '311', '313', '310']) {
      yollar.push(path.join('C:\\', 'Program Files', 'Python' + v, 'Scripts', 'yt-dlp.exe'));
      yollar.push(path.join('C:\\', 'Python' + v, 'Scripts', 'yt-dlp.exe'));
    }
    yollar.push(path.join(KOK, 'yt-dlp.exe'));
  }
  return yollar;
}

// [komut, on-argumanlar] — pip ve `-m yt_dlp` icin
function pythonAdaylari() {
  return WIN ? [['python', []], ['py', ['-3']]] : [['python3', []], ['python', []]];
}

async function ytDlpBul() {
  const adaylar = [];
  const ozel = process.env.YTDLP_YOL;
  if (ozel) {
    adaylar.push(/\.(c|m)?js$/i.test(ozel) ? { cmd: process.execPath, base: [ozel] } : { cmd: ozel, base: [] });
  }
  adaylar.push({ cmd: 'yt-dlp', base: [] });
  for (const y of pythonScriptsKlasorleri()) {
    if (y.endsWith('.exe') && fs.existsSync(y)) adaylar.push({ cmd: y, base: [] });
  }
  for (const [cmd, on] of pythonAdaylari()) adaylar.push({ cmd, base: [...on, '-m', 'yt_dlp'] });

  for (const a of adaylar) {
    const r = await komutCalistir(a.cmd, [...a.base, '--version'], { zamanAsimiMs: 15000 });
    if (r.kod === 0 && r.cikti.trim()) return { ...a, surum: r.cikti.trim().split(/\r?\n/)[0] };
  }
  return null;
}

async function ffmpegVar() {
  const r = await komutCalistir('ffmpeg', ['-version'], { zamanAsimiMs: 10000 });
  return r.kod === 0;
}

// ---------------------------------------------------------------- hata cevirisi
function temizHata(m) {
  return String(m)
    .replace(/^ERROR:\s*/i, '')
    .replace(/;\s*please report this issue.*/i, '')
    .replace(/\s*Use --list-extractors.*/i, '')
    .trim();
}

// [desen, ozet, cozum] — sirayla denenir; ilk eslesen kazanir
const HATA_TABLOSU = [
  [/No space left on device|ENOSPC|disk full/i,
    'Diskte yer kalmadı.', 'Yer açıp ya da indirme klasörünü başka bir sürücüye alıp "Tekrar dene"ye bas.'],
  [/Sign in to confirm you.?re not a bot|confirm your age|age.restricted|inappropriate for some users|Sign in to confirm/i,
    'Site giriş yapılmış bir hesap istiyor (yaş sınırı ya da bot doğrulaması).',
    '"Chrome çerezleri" kutusunu işaretleyip tekrar dene (Chrome\'da o siteye giriş yapmış olmalısın).'],
  [/Private video|This video is private|members.only|Join this channel|requires? (?:a )?login|login required/i,
    'Video özel ya da yalnızca üyelere/giriş yapanlara açık.',
    'Chrome\'da giriş yapıp "Chrome çerezleri" kutusunu işaretleyerek dene.'],
  [/HTTP Error 429|Too Many Requests|rate.?limit/i,
    'Site kısa sürede çok fazla istek gördü.', 'Birkaç dakika bekleyip tekrar dene.'],
  [/ffmpeg|ffprobe/i,
    'ffmpeg bulunamadı ya da çalışmadı (birleştirme ve MP3 için gerekli).', 'winget install ffmpeg ile kurup indiriciyi yeniden aç.'],
  [/Video unavailable|This video is not available|has been removed|no longer available|does not exist|HTTP Error 404|blocked it in your country/i,
    'Video artık yok ya da bu bölgede açılmıyor.', 'Linki tarayıcıda açıp videonun hâlâ oynadığını kontrol et.'],
  [/Requested format is not available/i,
    'İstenen kalite bu videoda yok.', '"En iyi" kaliteyi seçip tekrar dene.'],
  [/Unsupported URL/i,
    'Bu bağlantı desteklenmiyor.', 'Videonun kendi sayfasının linkini yapıştır (arama ya da ana sayfa değil).'],
  [/getaddrinfo|Name or service not known|Temporary failure in name resolution|Network is unreachable|timed out|Connection (?:reset|refused|aborted)|ECONNRESET|ETIMEDOUT|Failed to establish a new connection|Max retries|Zaman aşımı/i,
    'İnternet bağlantısı kurulamadı ya da site yanıt vermedi.', 'Bağlantını kontrol edip "Tekrar dene"ye bas.'],
  [/Unable to extract|extractor|Signature extraction|HTTP Error 403|nsig/i,
    'yt-dlp bu siteyi şu an çözemedi (site değişmiş olabilir).',
    'yt-dlp\'yi güncelle: üstteki rozete tıkla ya da pip install -U --pre yt-dlp çalıştır.'],
  [/Permission denied|Access is denied|PermissionError/i,
    'İndirme klasörüne yazma izni yok.', 'Klasörü başka bir yere al ya da dosyayı kullanan programı kapat.'],
];

// ham yt-dlp / Node hatasini {ozet, cozum, detay} yapar (kullaniciya Turkce gosterilir)
function hataCevir(ham) {
  const detay = temizHata(ham == null ? '' : (ham.message || ham));
  for (const [desen, ozet, cozum] of HATA_TABLOSU) {
    if (desen.test(detay)) return { ozet, cozum, detay };
  }
  return { ozet: detay || 'Bilinmeyen hata.', cozum: '', detay };
}
function hataMetni(h) { return h.ozet + (h.cozum ? ' ' + h.cozum : ''); }

// ---------------------------------------------------------------- link dogrulama
// IPv4 yerel / ozel / ayrilmis mi? (c = ucuncu bayt; yalniz /24'luk test aglari icin)
function ipv4Yerel(a, b, c) {
  return a === 0 || a === 10 || a === 127 || a >= 224 ||                      // 0/8, 10/8, loopback, coklu yayin + ayrilmis (224/4, 240/4)
    (a === 100 && b >= 64 && b <= 127) ||                                      // 100.64/10 (CGNAT, Tailscale)
    (a === 169 && b === 254) ||                                                // link-local + bulut metadata (169.254.169.254)
    (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) ||
    (a === 192 && b === 0 && (c === 0 || c === 2)) || (a === 192 && b === 88 && c === 99) ||
    (a === 198 && (b === 18 || b === 19)) || (a === 198 && b === 51 && c === 100) || (a === 203 && b === 0 && c === 113);
}

// IPv6 metnini 8 adet 16 bitlik sayiya cozer (:: kisaltmasi ve sondaki a.b.c.d dahil); gecersizse null
function ipv6Coz(s) {
  let a = s;
  const v4 = /(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(a);
  if (v4) {
    const n = v4.slice(1).map(Number);
    if (n.some((x) => x > 255)) return null;
    a = a.slice(0, v4.index) + ((n[0] << 8) | n[1]).toString(16) + ':' + ((n[2] << 8) | n[3]).toString(16);
  }
  const i = a.indexOf('::');
  let parcalar;
  if (i >= 0) {
    if (a.indexOf('::', i + 1) >= 0) return null;
    const bas = a.slice(0, i) ? a.slice(0, i).split(':') : [];
    const son = a.slice(i + 2) ? a.slice(i + 2).split(':') : [];
    if (bas.length + son.length > 7) return null;
    parcalar = bas.concat(new Array(8 - bas.length - son.length).fill('0'), son);
  } else parcalar = a.split(':');
  if (parcalar.length !== 8 || parcalar.some((p) => !/^[0-9a-f]{1,4}$/.test(p))) return null;
  return parcalar.map((p) => parseInt(p, 16));
}

// IPv6 yerel mi? IPv4'u icinde tasiyan bicimler (::ffff:a.b.c.d, NAT64, 6to4) gomulu IPv4'e gore karar verir
function ipv6Yerel(g) {
  const sifir = (...k) => k.every((i) => g[i] === 0);
  const v4 = (ust, alt) => ipv4Yerel(ust >> 8, ust & 255, alt >> 8);
  if (sifir(0, 1, 2, 3, 4, 5, 6) && (g[7] === 0 || g[7] === 1)) return true;                  // :: ve ::1
  if (sifir(0, 1, 2, 3, 4) && g[5] === 0xffff) return v4(g[6], g[7]);                          // IPv4-eslemeli ::ffff:a.b.c.d
  if (sifir(0, 1, 2, 3, 4, 5)) return true;                                                    // IPv4-uyumlu ::a.b.c.d (kullanimdan kalkti)
  if (g[0] === 0x64 && g[1] === 0xff9b) return sifir(2, 3, 4, 5) ? v4(g[6], g[7]) : true;      // NAT64 64:ff9b::/96 (+ yerel kullanim /48)
  if (g[0] === 0x2002) return v4(g[1], g[2]);                                                  // 6to4
  if (g[0] === 0x2001 && (g[1] === 0 || g[1] === 0xdb8)) return true;                          // Teredo, dokumantasyon
  if (g[0] === 0x100 && sifir(1, 2, 3)) return true;                                           // 100::/64 (discard)
  return (g[0] & 0xfe00) === 0xfc00 || (g[0] & 0xffc0) === 0xfe80 || (g[0] & 0xffc0) === 0xfec0 || (g[0] & 0xff00) === 0xff00;   // ULA, link-local, site-local, coklu yayin
}

const YEREL_SONEKLER = ['.localhost', '.local', '.internal', '.localdomain', '.home.arpa', '.lan', '.intranet'];
function yerelAdresMi(h) {
  let a = String(h == null ? '' : h).trim().replace(/^\[|\]$/g, '').toLowerCase();
  if (a.includes('%')) return true;                              // IPv6 bolge kimligi (fe80::1%eth0)
  a = a.replace(/\.+$/, '');                                     // 'localhost.' ve '127.0.0.1.' mutlak alan adlari ayni adrestir
  if (!a) return true;
  if (a.includes(':')) { const g = ipv6Coz(a); return g ? ipv6Yerel(g) : true; }
  // 127.1, 0x7f.1, 2130706433, 0177.0.0.1 gibi kisaltmali bicimleri URL cozucu tek bicime (a.b.c.d) indirir
  try { a = new URL('http://' + a + '/').hostname.replace(/\.+$/, ''); } catch { return true; }
  if (a.startsWith('[')) { const g = ipv6Coz(a.slice(1, -1)); return g ? ipv6Yerel(g) : true; }
  if (a === 'localhost' || YEREL_SONEKLER.some((s) => a.endsWith(s))) return true;
  // tek etiketli ad (http://router/, http://nas/): isletim sisteminin arama son eki yerel agdaki bir makineye cozer; video siteleri hep FQDN'dir
  if (!a.includes('.')) return true;
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(a);
  return m ? ipv4Yerel(Number(m[1]), Number(m[2]), Number(m[3])) : false;
}

// DNS CEVABINDAKI bir adres yerel sayilsin mi? yerelAdresMi gibi, tek farkla: 198.18.0.0/15 (RFC 2544 test blogu) sayilmaz.
// Clash / sing-box TUN ve bazi VPN'ler "fake-ip" kipinde HER alan adini bu bloga cozer; yerel bir servise degil, TUN'a gider
// (TUN adi gercek siteye kendisi baglar). Boyle kullanicida her link reddedilirdi. Bu blogu DOGRUDAN IP olarak yazmak
// (http://198.18.0.1/) hala reddedilir: o durumda yerelAdresMi devrede, DNS cevabi yok.
function dnsAdresiYerelMi(adres) {
  const a = String(adres == null ? '' : adres).trim().replace(/^\[|\]$/g, '').toLowerCase();
  let ust = null;                                                              // IPv4'un ilk iki bayti (dogrudan ya da ::ffff:a.b.c.d icinde)
  const d4 = /^(\d{1,3})\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/.exec(a);
  if (d4) ust = [Number(d4[1]), Number(d4[2])];
  else if (a.includes(':')) {
    const g = ipv6Coz(a);
    if (g && g.slice(0, 5).every((x) => x === 0) && g[5] === 0xffff) ust = [g[6] >> 8, g[6] & 255];
  }
  if (ust && ust[0] === 198 && (ust[1] === 18 || ust[1] === 19)) return false;
  return yerelAdresMi(a);
}

// Alan adi yerel bir adrese cozuluyor mu? (localtest.me, 127.0.0.1.nip.io gibi). Yalniz POZITIF sonuc engeller:
// cozumleme basarisizsa yt-dlp kendi hatasini verir. Sonuc 60 sn onbellekte (cevrimdisi iken her link 3 sn beklemesin).
// Sinir: ayni isim sonradan baska adrese cozulurse (DNS rebinding) yakalanmaz; yt-dlp kendi cozumlemesini yapar.
const DNS_ONBELLEK = new Map();
async function adYerelCozuluyorMu(host) {
  const a = String(host || '').replace(/^\[|\]$/g, '').replace(/\.+$/, '').toLowerCase();
  if (!a || a.includes(':') || /^[\d.]+$/.test(a)) return false;               // IP degeri: yerelAdresMi zaten baktı
  const e = DNS_ONBELLEK.get(a);
  if (e && Date.now() - e.t < 60000) return e.yerel;
  let yerel = false, zaman = null;
  try {
    const adresler = await Promise.race([
      ic.dns.lookup(a, { all: true }),
      new Promise((_, red) => { zaman = setTimeout(() => red(new Error('dns zaman aşımı')), 3000); }),
    ]);
    yerel = adresler.some((x) => dnsAdresiYerelMi(x.address));
  } catch { yerel = false; } finally { clearTimeout(zaman); }
  if (DNS_ONBELLEK.size > 500) DNS_ONBELLEK.clear();
  DNS_ONBELLEK.set(a, { t: Date.now(), yerel });
  return yerel;
}

// Gecerli + alan adi yerel adrese cozulmeyen linkler (sirayi korur). /api/indir ve oynatma listesi ogeleri bundan gecer.
async function linkleriSuz(liste) {
  const gecerli = liste.filter(linkGecerli);
  const sonuc = [];
  for (const l of gecerli) {
    let host = '';
    try { host = new URL(l).hostname; } catch { continue; }
    if (!(await adYerelCozuluyorMu(host))) sonuc.push(l);
  }
  return sonuc;
}

// yt-dlp'ye verilecek link: http/https, bosluksuz, kimlik bilgisiz, yerel ag adresi degil
function linkGecerli(s) {
  if (typeof s !== 'string' || !s || s.length > 2048 || /[\s\u0000-\u001f]/.test(s)) return false;
  let u;
  try { u = new URL(s); } catch { return false; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
  if (u.username || u.password || !u.hostname) return false;
  return !yerelAdresMi(u.hostname);
}

// ---------------------------------------------------------------- isler
let sayac = 0;
const isler = new Map();          // id -> is
const kuyruk = [];                // bekleyen is id'leri
const ES_ZAMANLI = 2;
let aktif = 0;
const BITEN_DURUMLAR = ['bitti', 'hata', 'iptal'];

function isOzet(is) {
  return {
    id: is.id, url: is.url, baslik: is.baslik, kanal: is.kanal, sure: is.sure,
    kapak: is.kapak, site: is.site, durum: is.durum, yuzde: is.yuzde,
    hiz: is.hiz, kalan: is.kalan, boyut: is.boyut, dosya: is.dosya ? path.basename(is.dosya) : '',
    hata: is.hata, kalite: is.kalite, eklendi: is.eklendi,
  };
}

// ---------------------------------------------------------------- SSE
const dinleyiciler = new Set();
function yayinla(tip, veri) {
  const paket = `event: ${tip}\ndata: ${JSON.stringify(veri)}\n\n`;
  for (const r of dinleyiciler) { try { r.write(paket); } catch { /* kopmus baglanti */ } }
}
function isGuncelle(is) { yayinla('is', isOzet(is)); }

// ---------------------------------------------------------------- format secici
function formatSecici(kalite) {
  if (kalite === 'mp3') return null; // ses ayri islenir
  const h = { '2160': 2160, '1440': 1440, '1080': 1080, '720': 720, '480': 480 }[kalite];
  // "En iyi": ne varsa en yuksegi (4K dahil), kodek fark etmez
  if (!h) return 'bv*+ba/b';
  // 1440p+: cozunurluk oncelikli — YouTube 4K'yi sadece VP9/AV1 verir,
  // H.264 sartina takilirsak 1080'e duseriz
  if (h > 1080) return `bv*[height<=${h}]+ba/b[height<=${h}]/b`;
  // 1080p ve alti: once H.264+M4A (her cihazda acilir), yoksa ne varsa
  return `bv*[vcodec^=avc1][height<=${h}]+ba[ext=m4a]/bv*[height<=${h}]+ba/b[height<=${h}]/b`;
}

function siteAdi(url) {
  try {
    const h = new URL(url).hostname.replace(/^www\./, '');
    if (/youtu/.test(h)) return 'YouTube';
    if (/tiktok/.test(h)) return 'TikTok';
    if (/(twitter|x\.com)/.test(h)) return 'X';
    if (/instagram/.test(h)) return 'Instagram';
    if (/facebook|fb\.watch/.test(h)) return 'Facebook';
    if (/reddit/.test(h)) return 'Reddit';
    return h;
  } catch { return '?'; }
}

function ortakArgs() {
  const a = ['--socket-timeout', '30'];
  if (ayar.cerez) a.push('--cookies-from-browser', 'chrome');
  return a;
}

// ---------------------------------------------------------------- bilgi cekme
async function bilgiCek(url, { liste = false, onSpawn } = {}) {
  const args = [
    ...YT.base, '--dump-single-json', '--no-warnings', '--ignore-config',
    ...(liste ? ['--flat-playlist'] : ['--no-playlist']),
    ...ortakArgs(), '--', url,
  ];
  const r = await komutCalistir(YT.cmd, args, { zamanAsimiMs: 180000, onSpawn });
  if (r.kod !== 0) {
    const m = (r.hata || '').split(/\r?\n/).filter(Boolean).pop() || 'Bilgi alınamadı';
    const h = hataCevir(m);
    const e = new Error(hataMetni(h));
    e.detay = h.detay;
    throw e;
  }
  try { return JSON.parse(r.cikti); }
  catch { throw new Error('Yanıt okunamadı (yt-dlp güncel mi?)'); }
}

// ---------------------------------------------------------------- indirme
function indirmeyiBaslat(is) {
  klasorGarantile();
  // klasor -P ile verilir, -o sablonuna GOMULMEZ: klasor adindaki % gibi karakterler yt-dlp sablonu sanilmasin
  const cikti = '%(title).150B [%(id)s].%(ext)s';
  const args = [
    ...YT.base,
    '--ignore-config', '--no-playlist', '--no-mtime', '--windows-filenames',
    '--newline', '--progress', '--no-simulate',
    '--concurrent-fragments', '4', '--retries', '10', '--fragment-retries', '10',
    '--progress-template',
    'download:@P@%(progress.downloaded_bytes)s|%(progress.total_bytes,progress.total_bytes_estimate)s|%(progress.speed)s|%(progress.eta)s',
    '--print', 'after_move:@F@%(filepath)s',
    '-P', ayar.klasor, '-o', cikti,
    ...ortakArgs(),
  ];

  if (is.kalite === 'mp3') {
    args.push('-f', 'ba/b', '-x', '--audio-format', 'mp3', '--audio-quality', '0');
  } else {
    args.push('-f', formatSecici(is.kalite), '--merge-output-format', 'mp4');
  }
  args.push('--', is.url);

  is.durum = 'indiriliyor';
  is.gunluk = [];
  isGuncelle(is);

  let p;
  try {
    p = spawn(YT.cmd, args, { cwd: KOK, env: COCUK_ENV, windowsHide: true, detached: !WIN });
  } catch (e) {
    is.durum = 'hata';
    is.hata = hataMetni(hataCevir(e));
    isGuncelle(is); isBitti(is);
    return;
  }
  is.surec = p;
  is.sonCikti = Date.now();

  let tampon = '';
  const satirIsle = (s) => {
    if (!s) return;
    is.sonCikti = Date.now();
    // Iptal istendiyse (taskkill asenkron: surec 50-200 ms daha satir basabilir) hicbir satir durumu 'iptal'in ustune yazmasin
    if (is.iptalEdildi) return;
    if (s.startsWith('@P@')) {
      const [ind, top, hiz, kalan] = s.slice(3).split('|');
      const i = Number(ind), t = Number(top);
      if (t > 0 && i >= 0) { is.yuzde = Math.min(99.9, (i / t) * 100); is.boyut = t; }
      is.hiz = Number(hiz) || 0;
      is.kalan = Number(kalan) || 0;
      if (is.durum !== 'indiriliyor') is.durum = 'indiriliyor';
      isGuncelle(is);
      return;
    }
    if (s.startsWith('@F@')) { is.dosya = s.slice(3).trim(); return; }
    if (/^\[Merger\]/.test(s)) { is.durum = 'birlestiriliyor'; is.yuzde = 99.9; isGuncelle(is); }
    else if (/^\[ExtractAudio\]/.test(s)) { is.durum = 'sese-cevriliyor'; is.yuzde = 99.9; isGuncelle(is); }
    else if (/^\[(Fixup|VideoConvertor|EmbedThumbnail)/.test(s)) { is.durum = 'isleniyor'; isGuncelle(is); }
    is.gunluk.push(s);
    if (is.gunluk.length > 200) is.gunluk.shift();
  };

  const akisBagla = (akis) => {
    akis.setEncoding('utf8');
    akis.on('data', (d) => {
      tampon += d;
      const satirlar = tampon.split(/\r?\n/);
      tampon = satirlar.pop();
      for (const s of satirlar) satirIsle(s.trim());
    });
  };
  akisBagla(p.stdout);
  akisBagla(p.stderr);

  // takilma bekcisi: uzun sure hic cikti yoksa sureci oldur
  const bekci = setInterval(() => {
    if (Date.now() - is.sonCikti > BOSTA_KALMA_MS && is.surec === p) {
      is.takildi = true;
      agaciOldur(p);
    }
  }, 30000);
  if (bekci.unref) bekci.unref();

  // Is YALNIZ BIR KEZ biter: spawn hic basarmadiysa Node once 'error' sonra 'close' (kod -4058 gibi) yayar; ikisi de
  // isBitti'yi cagirirsa aktif sayaci iki kez duser (ES_ZAMANLI asilir) ve gercek hata mesaji 'yt-dlp -4058 kodu' ile ezilir.
  let bitti = false;
  const bitir = () => {
    if (bitti) return false;
    bitti = true;
    clearInterval(bekci);
    return true;
  };

  p.on('error', (e) => {
    // surec calisirken gelen hata (oldurulemedi vb.): is bitmedi, asil bitis 'close'ta. Yalniz baslatilamayan surec (pid yok) isi bitirir.
    if (p.pid !== undefined) { is.gunluk.push('Süreç hatası: ' + (e && e.message || e)); return; }
    if (!bitir()) return;
    if (is.iptalEdildi) { is.durum = 'iptal'; isBitti(is); return; }
    is.durum = 'hata';
    is.hata = hataMetni(hataCevir(e));
    isGuncelle(is); isBitti(is);
  });

  p.on('close', (kod) => {
    if (!bitir()) return;
    if (tampon) satirIsle(tampon.trim());
    if (is.iptalEdildi || is.durum === 'iptal') { is.durum = 'iptal'; isBitti(is); return; }
    if (kod === 0) {
      is.durum = 'bitti';
      is.yuzde = 100;
      is.hiz = 0; is.kalan = 0;
      if (is.dosya) { try { is.boyut = fs.statSync(is.dosya).size; } catch { /* dosya tasinmis olabilir */ } }
    } else {
      is.durum = 'hata';
      const satir = is.takildi
        ? 'Zaman aşımı: indirme ' + Math.round(BOSTA_KALMA_MS / 60000) + ' dakikadır ilerlemiyordu.'
        : (is.gunluk.filter((l) => /^ERROR/i.test(l)).pop()
          || is.gunluk.filter(Boolean).pop() || `yt-dlp ${kod} kodu ile çıktı`);
      const h = hataCevir(satir);
      is.hata = hataMetni(h);
      is.hataDetay = h.detay;
    }
    isGuncelle(is);
    isBitti(is);
  });
}

function isBitti(is) {
  is.surec = null;
  aktif = Math.max(0, aktif - 1);
  kuyrugaBak();
}

function kuyrugaBak() {
  while (aktif < ES_ZAMANLI && kuyruk.length) {
    const id = kuyruk.shift();
    const is = isler.get(id);
    if (!is || is.durum === 'iptal') continue;
    aktif++;
    isHazirla(is);
  }
}

async function isHazirla(is) {
  try {
    is.durum = 'bilgi-aliniyor';
    isGuncelle(is);
    const bos = diskBosGB(ayar.klasor);
    if (bos !== null && bos < DISK_ESIK_GB) {
      throw new Error('Diskte yeterli boş yer yok (' + bos.toFixed(1) + ' GB kaldı). Yer açıp "Tekrar dene"ye bas.');
    }
    const b = await bilgiCek(is.url, { onSpawn: (p) => { is.surec = p; } });
    is.surec = null;
    is.baslik = b.title || is.url;
    is.kanal = b.uploader || b.channel || b.uploader_id || '';
    is.sure = b.duration || 0;
    is.kapak = typeof b.thumbnail === 'string' && /^https:\/\//i.test(b.thumbnail) ? b.thumbnail : '';
    if (is.durum === 'iptal') { isBitti(is); return; }
    indirmeyiBaslat(is);
  } catch (e) {
    is.surec = null;
    if (is.durum === 'iptal') { isBitti(is); return; }
    is.durum = 'hata';
    is.hata = String(e && e.message || e);
    is.hataDetay = e && e.detay || '';
    isGuncelle(is);
    isBitti(is);
  }
}

function isEkle(url, kalite) {
  const is = {
    id: ++sayac, url: url.trim(), kalite,
    baslik: url.trim(), kanal: '', sure: 0, kapak: '', site: siteAdi(url),
    durum: 'bekliyor', yuzde: 0, hiz: 0, kalan: 0, boyut: 0,
    dosya: '', hata: '', hataDetay: '', gunluk: [], surec: null, eklendi: Date.now(),
    iptalEdildi: false,   // /api/iptal bunu kurar; kurulduktan sonra hicbir cikti satiri/kapanis durumu 'iptal'i degistiremez
  };
  isler.set(is.id, is);
  kuyruk.push(is.id);
  isGuncelle(is);
  kuyrugaBak();
  return is;
}

function hepsiniDurdur() {
  for (const is of isler.values()) if (is.surec) agaciOldur(is.surec);
}

// ---------------------------------------------------------------- youtube arama filtresi
/*
 * YouTube'un "sp" parametresi bir protobuf. Elle kuruyoruz:
 *   alan 1 = siralama (3 = izlenmeye gore)
 *   alan 2 = filtre paketi { 1: yukleme tarihi, 2: tur(1=video), 3: sure(1=kisa,2=uzun) }
 */
function youtubeAramaUrl(sorgu, donem, tur) {
  const tarih = { bugun: 2, hafta: 3, ay: 4, yil: 5 }[donem]; // yoksa: tum zamanlar
  const sure = { kisa: 1, uzun: 2 }[tur];                     // kisa = 4 dk alti (Shorts dahil)

  const filtre = [];
  if (tarih) filtre.push(0x08, tarih);
  filtre.push(0x10, 0x01);                                    // sadece video
  if (sure) filtre.push(0x18, sure);

  const bayt = [0x08, 0x03, 0x12, filtre.length, ...filtre];  // siralama: izlenme + filtreler
  const sp = Buffer.from(bayt).toString('base64');

  return 'https://www.youtube.com/results?search_query=' +
    encodeURIComponent(sorgu) + '&sp=' + encodeURIComponent(sp);
}

// ---------------------------------------------------------------- vidIQ canli kesif
/*
 * Otomasyonun .env'indeki VIDIQ_KEY ile mcp.vidiq.com'a baglanir, haftanin viral videolarini ceker.
 * Anahtar: panel > Anahtarlar ekrani  (app.vidiq.com/account/settings/mcp)
 * MCP istemcisi ve .env okuyucusu projenin ORTAK kutuphaneleridir (lib/vidiq.js, lib/ortak.js: tek kopya).
 * Indirici otomasyon klasorunun disina tek basina kopyalanirsa yalniz "vidIQ'dan tazele" calismaz
 * (Turkce hata verir); indirme ve arama aynen calisir.
 */
function otomasyonLib(ad) {
  try { return require('../lib/' + ad + '.js'); } catch { return null; }
}

function mcpYapili(s) {
  if (!s) return null;
  if (s.structuredContent) return s.structuredContent;
  const t = s.content && s.content.find((x) => x.type === 'text');
  if (!t) return null;
  try { return JSON.parse(t.text); } catch { return t.text; }
}
function mcpMetin(s) {
  if (!s || !s.content) return '';
  return s.content.filter((x) => x.type === 'text').map((x) => x.text).join('\n');
}

// "5.3M" -> 5300000 , "327.2K" -> 327200
function kisaltmaSayi(s) {
  const m = /^([\d.,]+)\s*([KMB])?$/i.exec(String(s).trim());
  if (!m) return 0;
  const c = { k: 1e3, m: 1e6, b: 1e9 }[(m[2] || '').toLowerCase()] || 1;
  return Math.round(parseFloat(m[1].replace(/,/g, '')) * c);
}

// vidIQ'nun IG/TikTok arama ciktisi markdown metin doner — ayristir.
// (arac/kesfet-derle.cjs ile ayni mantik)
// Servisten gelen basliklarda kirik emoji / kodlama kalintisi (U+FFFD, "replacement character") ekranda "???" olarak
// gorunurdu. Karakter kaynakta yazilmaz (kodlama taramasi bozuk dosya sanir): kodu ile uretilir.
const KIRIK_KARAKTER = new RegExp(String.fromCharCode(0xFFFD) + '+', 'g');
function temizBaslik(s) {
  return String(s == null ? '' : s).replace(KIRIK_KARAKTER, '').replace(/\s{2,}/g, ' ').trim();
}

function igTiktokAyristir(ham) {
  const satirlar = String(ham).split('\n');
  const sonuc = [];
  let platform = null, acik = null;
  const bitir = () => { if (acik && acik.url) sonuc.push(acik); acik = null; };

  for (const s of satirlar) {
    if (/^##\s*Instagram/i.test(s)) { bitir(); platform = 'instagram'; continue; }
    if (/^##\s*TikTok/i.test(s)) { bitir(); platform = 'tiktok'; continue; }
    const bas = /^\*\*@([^*]+)\*\*\s*[—-]\s*"?(.*?)"?\s*$/.exec(s);
    if (bas) {
      bitir();
      acik = { platform, kanal: '@' + bas[1].trim(), baslik: temizBaslik((bas[2] || '').replace(/\.\.\.$/, '')),
        izlenme: 0, takipci: 0, sure: 0, katsayi: 0, url: '' };
      continue;
    }
    if (!acik) continue;
    const olcu = /^\s+([\d.,]+[KMB]?)\s+views(?:\s*\(([\d.,]+)x[^)]*\))?/.exec(s);
    if (olcu) {
      acik.izlenme = kisaltmaSayi(olcu[1]);
      acik.katsayi = olcu[2] ? parseFloat(olcu[2].replace(/,/g, '')) : 0;
      const tak = /·\s*([\d.,]+[KMB]?)\s+followers/.exec(s);
      if (tak) acik.takipci = kisaltmaSayi(tak[1]);
      const sr = /·\s*(\d+)s\s*$/.exec(s);
      if (sr) acik.sure = Number(sr[1]);
      continue;
    }
    const tt = /^\s*(https:\/\/www\.tiktok\.com\/@[^\s/]+\/video\/\d+)/.exec(s);
    if (tt) { acik.url = tt[1]; continue; }
    const ig = /^\s*reel:([A-Za-z0-9_-]+)/.exec(s);
    if (ig) { acik.url = 'https://www.instagram.com/reel/' + ig[1] + '/'; continue; }
  }
  bitir();
  return sonuc;
}

// ---------------------------------------------------------------- dosyalar
function indirilenler() {
  klasorGarantile();
  let liste = [];
  try {
    liste = fs.readdirSync(ayar.klasor)
      .filter((a) => VIDEO_UZANTI.has(path.extname(a).toLowerCase()))
      .map((a) => {
        try {
          const tam = path.join(ayar.klasor, a);
          const s = fs.statSync(tam);
          return s.isFile() && medyaIcerigiMi(tam, path.extname(a).toLowerCase()) ? { ad: a, boyut: s.size, tarih: s.mtimeMs } : null;
        } catch { return null; }
      })
      .filter(Boolean)
      .sort((x, y) => y.tarih - x.tarih)
      .slice(0, 200);
  } catch { /* klasor okunamadi: bos liste */ }
  return liste;
}

// Sil / oynat / sun / klasorde goster icin tek kapi:
// yalniz dosya adi (yol parcasi yok), uzanti beyaz listede, indirme klasorunun icinde,
// symlink degil. Gecmezse null.
function guvenliDosya(ad) {
  if (typeof ad !== 'string' || !ad || ad.length > 400 || ad.includes('\0')) return null;
  if (path.basename(ad) !== ad || ad === '.' || ad === '..') return null;
  const uzanti = path.extname(ad).toLowerCase();
  if (!VIDEO_UZANTI.has(uzanti)) return null;
  const kok = path.resolve(ayar.klasor);
  const tam = path.join(kok, ad);
  if (!icinde(kok, tam) || tam === kok) return null;
  try {
    const l = fs.lstatSync(tam);
    if (l.isSymbolicLink() || !l.isFile()) return null;
    if (!icinde(gercekYol(kok), fs.realpathSync(tam))) return null;
  } catch { return null; }
  if (!medyaIcerigiMi(tam, uzanti)) return null;
  return tam;
}

// Tek aralikli Range basligi: {bas,son} | null (aralik yok/anlasilmadi -> tam govde) | 'x' (karsilanamaz -> 416)
function aralikCoz(baslik, boy) {
  const m = /^bytes=(\d*)-(\d*)$/.exec(String(baslik || '').trim());
  if (!m || (m[1] === '' && m[2] === '')) return null;
  let bas, son;
  if (m[1] === '') {                                   // bytes=-N : son N bayt
    const n = parseInt(m[2], 10);
    if (!n || boy === 0) return 'x';
    bas = Math.max(0, boy - n); son = boy - 1;
  } else {
    bas = parseInt(m[1], 10);
    son = m[2] ? Math.min(parseInt(m[2], 10), boy - 1) : boy - 1;
  }
  if (!(bas <= son) || bas >= boy) return 'x';
  return { bas, son };
}

// Isletim sistemine uygun "ac / klasorde goster". hedef = guvenliDosya'dan gelen yol ya da klasor.
// cmd.exe KULLANILMAZ: dosya adindaki & ^ % gibi karakterler komut olarak yorumlanmasin.
function platformAc(hedef, sec) {
  let cmd, args;
  if (WIN) { cmd = 'explorer.exe'; args = sec ? ['/select,', hedef] : [hedef]; }
  else if (process.platform === 'darwin') { cmd = 'open'; args = sec ? ['-R', hedef] : [hedef]; }
  else { cmd = 'xdg-open'; args = [sec ? path.dirname(hedef) : hedef]; }
  const p = spawn(cmd, args, { windowsHide: false, detached: true, stdio: 'ignore' });
  p.on('error', (e) => logYaz('Açılamadı (' + cmd + '): ' + e.message));
  p.unref();
}

// ---------------------------------------------------------------- http
function hostGecerli(host, port = aktifPort) {
  if (typeof host !== 'string') return false;
  const h = host.toLowerCase();
  return h === 'localhost:' + port || h === '127.0.0.1:' + port || h === '[::1]:' + port;
}
function originGecerli(origin, port = aktifPort) {
  if (typeof origin !== 'string') return false;
  const o = origin.toLowerCase();
  return o === 'http://localhost:' + port || o === 'http://127.0.0.1:' + port || o === 'http://[::1]:' + port;
}

function esit(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}
function cerezOku(req, ad) {
  for (const parca of String(req.headers.cookie || '').split(';')) {
    const i = parca.indexOf('=');
    if (i > 0 && parca.slice(0, i).trim() === ad) return parca.slice(i + 1).trim();
  }
  return '';
}
function jetonGecerli(req, cerezOlur) {
  if (esit(req.headers['x-panel-token'], JETON)) return true;
  return !!cerezOlur && esit(cerezOku(req, CEREZ_AD), JETON);
}

// Bu sunucunun tum istek alanlari duz degerdir (metin/sayi/mantik): nesne ve dizi degeri 400 ile reddedilir. {"toString":"x"} gibi bir
// deger String()/Number()/RegExp.test() cagrilarinda TypeError atip 500 uretmesin (guvenlik saldiri turu, 2026-10-06).
function duzDegerler(o) {
  for (const v of Object.values(o)) {
    if (v !== null && typeof v === 'object') {
      const e = new Error('İstek alanları metin, sayı ya da true/false olmalı (nesne/liste gönderilemez).'); e.durum = 400; e.kod = 'govde_tipi';
      throw e;
    }
  }
  return o;
}

function govdeOku(req) {
  return new Promise((coz, red) => {
    const bildirilen = Number(req.headers['content-length']);
    // sinir asilinca kalan govde okunup atilir (yanit, soket sifirlanmadan istemciye ulassin); 32 MB'tan fazlasi kesilir
    const buyuk = () => {
      req.removeAllListeners('data');
      let atilan = 0;
      req.on('data', (c) => { atilan += c.length; if (atilan > 32 * 1024 * 1024) req.destroy(); });
      req.resume();
      const e = new Error('İstek gövdesi çok büyük.'); e.durum = 413; e.kod = 'govde_buyuk'; return e;
    };
    if (bildirilen > GOVDE_MAX) return red(buyuk());
    const parcalar = [];
    let boy = 0, bitti = false;
    req.on('data', (c) => {
      if (bitti) return;
      boy += c.length;
      if (boy > GOVDE_MAX) { bitti = true; return red(buyuk()); }
      parcalar.push(c);
    });
    req.on('end', () => {
      if (bitti) return;
      const metin = Buffer.concat(parcalar).toString('utf8');
      if (!metin.trim()) return coz({});
      try {
        const j = JSON.parse(metin);
        coz(j && typeof j === 'object' && !Array.isArray(j) ? duzDegerler(j) : {});
      } catch (hata) {
        if (hata && hata.durum) return red(hata);                 // duzDegerler: govde_tipi
        const e = new Error('İstek gövdesi geçerli JSON değil.'); e.durum = 400; e.kod = 'json_bozuk'; red(e);
      }
    });
    req.on('error', red);
  });
}

function json(res, veri, kod = 200) {
  const g = Buffer.from(JSON.stringify(veri));
  res.writeHead(kod, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': g.length, 'Cache-Control': 'no-store' });
  res.end(g);
}
function hataYaz(res, kod, slug, mesaj, cozum) {
  const o = { hata: mesaj, kod: slug };
  if (cozum) o.cozum = cozum;
  return json(res, o, kod);
}
function tamam(res, ek) { return json(res, { ok: true, tamam: true, ...(ek || {}) }); }

const GUVENLIK_BASLIKLARI = {
  'Content-Security-Policy': "default-src 'self'; img-src 'self' data: blob: https:; media-src 'self'; " +
    "style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; object-src 'none'; " +
    "frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Cross-Origin-Resource-Policy': 'same-origin',
};

// arayuz dosyalari: yalniz bu beyaz liste sunulur
const STATIK = {
  '/stil.css': ['stil.css', 'text/css; charset=utf-8'],
  '/uygulama.js': ['uygulama.js', 'text/javascript; charset=utf-8'],
};

// ayni anda tek calisabilen agir isler (cift tiklamada cift harcama / cift surec olmasin)
let yenileniyor = false, araniyor = false, guncelleniyor = false;

async function istekIsle(req, res) {
  for (const [k, v] of Object.entries(GUVENLIK_BASLIKLARI)) res.setHeader(k, v);

  if (typeof req.url !== 'string' || !/^\/(?!\/)/.test(req.url)) {
    return hataYaz(res, 400, 'istek', 'Geçersiz istek adresi.');
  }
  const u = new URL(req.url, 'http://localhost');
  const yol = u.pathname;
  const yontem = req.method;

  // 1) Host: DNS rebinding savunmasi
  if (!hostGecerli(req.headers.host)) {
    return hataYaz(res, 403, 'host', 'Bu adres kabul edilmiyor.',
      'İndiriciyi http://localhost:' + aktifPort + ' adresinden aç.');
  }
  if (yontem !== 'GET' && yontem !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return hataYaz(res, 405, 'yontem', 'Bu istek yöntemi desteklenmiyor.');
  }
  // 2) POST: JSON zorunlu (basit "form" istekleri engellenir) ve Origin kendi adresimiz olmali
  if (yontem === 'POST' && !/^application\/json\s*(;|$)/i.test(String(req.headers['content-type'] || ''))) {
    return hataYaz(res, 415, 'icerik_turu', 'İstekler Content-Type: application/json ile gönderilmeli.');
  }
  const apiMi = yol.startsWith('/api/') || yol.startsWith('/dosya/');
  if (apiMi || yontem === 'POST') {
    if (req.headers.origin !== undefined && !originGecerli(req.headers.origin)) {
      return hataYaz(res, 403, 'origin', 'İstek başka bir siteden geldi, reddedildi.');
    }
    const sfs = req.headers['sec-fetch-site'];
    if (apiMi && sfs !== undefined && sfs !== 'same-origin' && sfs !== 'none') {
      return hataYaz(res, 403, 'origin', 'İstek başka bir siteden geldi, reddedildi.');
    }
  }
  // 3) jeton: tum /api ve /dosya cagrilari (cerez yalniz SSE ve medya GET'inde)
  if (apiMi) {
    const cerezOlur = yontem === 'GET' && (yol === '/api/akis' || yol.startsWith('/dosya/'));
    if (!jetonGecerli(req, cerezOlur)) {
      return hataYaz(res, 403, 'token', 'Oturum süresi doldu, sayfayı yenile.');
    }
  }

  // --- arayuz
  if (yontem === 'GET' && (yol === '/' || yol === '/index.html')) {
    const html = fs.readFileSync(path.join(KOK, 'public', 'index.html'), 'utf8').split('__PANEL_JETON__').join(JETON);
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'Set-Cookie': CEREZ_AD + '=' + JETON + '; HttpOnly; SameSite=Strict; Path=/',
    });
    return res.end(html);
  }
  // arayuz dili: /dil.js ve /diller/<kod>.js (lib/dil-yay.js uretir)
  if (yontem === 'GET' && (yol === '/dil.js' || /^\/diller\/[a-z]{2}\.js$/.test(yol))) {
    let dosya;
    try { dosya = fs.readFileSync(path.join(KOK, 'public', yol.slice(1))); } catch (e) { return hataYaz(res, 404, 'yok', 'Bulunamadı.'); }
    res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-cache' });
    return res.end(dosya);
  }
  if (yontem === 'GET' && STATIK[yol]) {
    const [dosya, tip] = STATIK[yol];
    res.writeHead(200, { 'Content-Type': tip, 'Cache-Control': 'no-cache' });
    return res.end(fs.readFileSync(path.join(KOK, 'public', dosya)));
  }

  // --- canli akis
  if (yontem === 'GET' && yol === '/api/akis') {
    if (dinleyiciler.size >= AKIS_MAX) return hataYaz(res, 429, 'cok_baglanti', 'Çok fazla açık indirici sekmesi var; birkaçını kapat.');
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.write('retry: 2000\n\n');
    dinleyiciler.add(res);
    for (const is of isler.values()) res.write(`event: is\ndata: ${JSON.stringify(isOzet(is))}\n\n`);
    const nabiz = setInterval(() => { try { res.write(': nabiz\n\n'); } catch { /* kopmus baglanti */ } }, 20000);
    req.on('close', () => { clearInterval(nabiz); dinleyiciler.delete(res); });
    return;
  }

  if (yontem === 'GET' && yol === '/api/durum') {
    return json(res, {
      surum: 1,
      ytdlp: YT ? YT.surum : null,
      ffmpeg: ffmpegHazir,
      ayar: { klasor: ayar.klasor, kalite: ayar.kalite, cerez: ayar.cerez },
      isler: [...isler.values()].map(isOzet),
      dosyalar: indirilenler(),
      diskBosGB: diskBosGB(ayar.klasor),
    });
  }

  if (yol === '/api/indir' && yontem === 'POST') {
    if (!YT) return hataYaz(res, 500, 'ytdlp_yok', 'yt-dlp bulunamadı.', 'Üstteki "yt-dlp" rozetinden ya da "Şimdi kur" düğmesinden kur.');
    const g = await govdeOku(req);
    if (g.kalite !== undefined && !KALITELER.includes(g.kalite)) return hataYaz(res, 400, 'kalite', 'Geçersiz kalite seçimi.');
    const kalite = g.kalite || ayar.kalite;
    const liste = !!g.liste;
    const ham = String(g.url || '').split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);
    const gecerliLinkler = ham.filter(linkGecerli).slice(0, LINK_MAX);
    const linkler = await linkleriSuz(gecerliLinkler);
    if (!linkler.length) {
      if (gecerliLinkler.length) {            // biçimi doğru ama alan adı yerel bir adrese çözülüyor
        return hataYaz(res, 400, 'link', 'Bu adres bilgisayarındaki ya da yerel ağdaki bir cihaza çözülüyor; güvenlik için indirilmedi.',
          'Adresi yanlış yazmış olabilirsin (modemler var olmayan adresleri kendilerine yönlendirebilir). Videonun gerçek sayfa adresini yapıştır.');
      }
      return hataYaz(res, 400, 'link', 'Geçerli bir link bulamadım (http:// ya da https:// ile başlamalı, yerel adres olmamalı).');
    }
    // Kuyruk siniri GENISLEMEDEN SONRAKI is sayisina uygulanir: bir liste linki LINK_MAX ogeye kadar acilir,
    // 200 liste yapistirilirsa 40 bin is bellege girip SSE'yi bogardi. Once butun linkler acilir (kuyruga HICBIR sey
    // eklenmez), sinir asilirsa ya hep ya hic: kismen eklenmis, neyin girdigi belirsiz bir kuyruk birakilmaz.
    const bekleyenSayisi = () => [...isler.values()].filter((i) => !BITEN_DURUMLAR.includes(i.durum)).length;
    const kuyrukDolu = () => hataYaz(res, 409, 'kuyruk_dolu',
      `İndirme kuyruğu dolu: en çok ${KUYRUK_MAX} bitmemiş iş tutulur, şu an ${bekleyenSayisi()} var; istediklerin (oynatma listeleri açılınca) buna sığmıyor. Hiçbiri eklenmedi.`,
      'Daha az link ya da daha küçük liste ver; ya da işlerin bitmesini bekleyip bitenleri temizle.');
    const yer = KUYRUK_MAX - bekleyenSayisi();
    if (linkler.length > yer) return kuyrukDolu();

    const eklenecek = [];
    for (const l of linkler) {
      if (liste && /list=|\/playlist|\/@|\/channel\//i.test(l)) {
        try {
          const b = await bilgiCek(l, { liste: true });
          const girdiler = (b.entries || []).filter((e) => e && (e.url || e.id)).slice(0, LINK_MAX);
          const tekiller = await linkleriSuz(girdiler
            .map((e) => (e.url && /^https?:/.test(e.url) ? e.url : `https://www.youtube.com/watch?v=${encodeURIComponent(e.id)}`)));
          if (tekiller.length) {
            eklenecek.push(...tekiller);
            if (eklenecek.length > yer) return kuyrukDolu();      // erken kes: kalan listeler icin yt-dlp calistirma
            continue;
          }
        } catch { /* liste degilmis, tekil dene */ }
      }
      eklenecek.push(l);
      if (eklenecek.length > yer) return kuyrukDolu();
    }
    // yukaridaki await'ler sirasinda baska bir istek is ekleyebilirdi: eklemeden hemen once (araya await girmeden) son denetim
    if (bekleyenSayisi() + eklenecek.length > KUYRUK_MAX) return kuyrukDolu();

    if (kalite !== ayar.kalite) { ayar.kalite = kalite; ayarKaydet(); }
    const eklenen = eklenecek.map((u) => isEkle(u, kalite).id);
    return tamam(res, { adet: eklenen.length, atlanan: ham.length - linkler.length });
  }

  if (yol === '/api/iptal' && yontem === 'POST') {
    const g = await govdeOku(req);
    const is = isler.get(Number(g.id));
    if (!is) return hataYaz(res, 404, 'is_yok', 'Böyle bir indirme yok.');
    if (BITEN_DURUMLAR.includes(is.durum)) return tamam(res);
    const i = kuyruk.indexOf(is.id);
    if (i >= 0) kuyruk.splice(i, 1);   // henuz baslamadi: aktif sayilmaz, kimse isBitti cagirmayacak
    is.iptalEdildi = true;             // ONCE bayrak: surec oldurulurken gelen son ilerleme satiri durumu geri yazamasin
    is.durum = 'iptal';
    is.hiz = 0; is.kalan = 0;
    if (is.surec) agaciOldur(is.surec); // calisan surec kapaninca close/catch isBitti'yi cagirir
    isGuncelle(is);
    return tamam(res);
  }

  if (yol === '/api/tekrar' && yontem === 'POST') {
    const g = await govdeOku(req);
    const eski = isler.get(Number(g.id));
    if (!eski) return hataYaz(res, 404, 'is_yok', 'Böyle bir indirme yok.');
    if (!BITEN_DURUMLAR.includes(eski.durum)) return hataYaz(res, 409, 'is_calisiyor', 'Bu indirme zaten sürüyor.');
    const yeni = isEkle(eski.url, eski.kalite);
    return tamam(res, { id: yeni.id });
  }

  if (yol === '/api/temizle' && yontem === 'POST') {
    for (const [id, is] of [...isler]) {
      if (BITEN_DURUMLAR.includes(is.durum)) { isler.delete(id); yayinla('sil', { id }); }
    }
    return tamam(res);
  }

  if (yol === '/api/klasor' && yontem === 'POST') {
    const g = await govdeOku(req);
    const hedef = g.dosya ? guvenliDosya(g.dosya) : null;
    klasorGarantile();
    if (hedef) ic.ac(hedef, true); else ic.ac(ayar.klasor, false);
    return tamam(res);
  }

  if (yol === '/api/oynat' && yontem === 'POST') {
    const g = await govdeOku(req);
    const hedef = guvenliDosya(g.dosya);
    if (!hedef) return hataYaz(res, 404, 'dosya_yok', 'Dosya bulunamadı.');
    ic.ac(hedef, false);
    return tamam(res);
  }

  if (yol === '/api/sil' && yontem === 'POST') {
    const g = await govdeOku(req);
    const hedef = guvenliDosya(g.dosya);
    if (!hedef) return hataYaz(res, 404, 'dosya_yok', 'Dosya bulunamadı.');
    try { fs.unlinkSync(hedef); }
    catch (e) {
      return hataYaz(res, 409, 'dosya_kullanimda', 'Dosya silinemedi.',
        'Dosyayı kullanan bir program (oynatıcı) açıksa kapatıp tekrar dene.');
    }
    return tamam(res);
  }

  if (yol === '/api/ayar' && yontem === 'POST') {
    const g = await govdeOku(req);
    if (g.klasor !== undefined) {
      const k = klasorDogrula(g.klasor);
      if (!k.ok) return hataYaz(res, 400, 'klasor', k.neden);
      if ([...isler.values()].some((i) => !BITEN_DURUMLAR.includes(i.durum))) {
        return hataYaz(res, 409, 'is_calisiyor', 'Devam eden indirme varken klasör değiştirilemez.', 'İndirmeler bitince tekrar dene.');
      }
      try { fs.mkdirSync(k.yol, { recursive: true }); }
      catch (e) { return hataYaz(res, 400, 'klasor', 'Klasör açılamadı: ' + e.message); }
      ayar.klasor = k.yol;
    }
    if (g.cerez !== undefined) {
      if (typeof g.cerez !== 'boolean') return hataYaz(res, 400, 'cerez', 'Çerez ayarı açık/kapalı olmalı.');
      ayar.cerez = g.cerez;
    }
    if (g.kalite !== undefined) {
      if (!KALITELER.includes(g.kalite)) return hataYaz(res, 400, 'kalite', 'Geçersiz kalite seçimi.');
      ayar.kalite = g.kalite;
    }
    const kaydedildi = ayarKaydet();
    return tamam(res, { ayar, kaydedildi });
  }

  if (yol === '/api/guncelle' && yontem === 'POST') {
    if (guncelleniyor) return hataYaz(res, 409, 'mesgul', 'Kurulum zaten sürüyor.');
    guncelleniyor = true;
    try {
      // README: TikTok icin nightly (--pre) sart; arayuzden kurulum da ayni sekilde yapilir
      let r = { kod: -1, cikti: '', hata: 'Python bulunamadı.' };
      for (const [cmd, on] of pythonAdaylari()) {
        r = await komutCalistir(cmd, [...on, '-m', 'pip', 'install', '-U', '--pre', '--disable-pip-version-check', 'yt-dlp'],
          { zamanAsimiMs: 5 * 60 * 1000 });
        if (r.kod !== -1) break;
      }
      YT = await ytDlpBul();
      return json(res, { ok: r.kod === 0, tamam: r.kod === 0, surum: YT ? YT.surum : null, cikti: (r.cikti + r.hata).slice(-1500) });
    } finally { guncelleniyor = false; }
  }

  if (yontem === 'GET' && yol === '/api/gunluk') {
    const is = isler.get(Number(u.searchParams.get('id')));
    return json(res, { gunluk: is ? is.gunluk.slice(-80) : [] });
  }

  // --- kesfet: hazir viral akis (vidIQ verisi, kesfet-veri.json)
  if (yontem === 'GET' && yol === '/api/kesfet') {
    try {
      return json(res, JSON.parse(fs.readFileSync(KESFET_DOSYA, 'utf8')));
    } catch {
      return json(res, { guncellendi: null, videolar: [], adet: 0 });
    }
  }

  // --- kesfet: vidIQ'dan CANLI viral tazeleme (VIDIQ_KEY gerekir, ~10 kredi, ONAY sart)
  if (yol === '/api/kesfet-yenile' && yontem === 'POST') {
    const g = await govdeOku(req);
    if (g.onay !== true) {
      return hataYaz(res, 400, 'onay_gerek', 'Bu işlem yaklaşık 10 vidIQ kredisi harcar; onay vermeden başlatılmaz.',
        'İsteğe onay: true ekle (arayüzde onay penceresinde "Tamam"a bas).');
    }
    const ortak = otomasyonLib('ortak'), vidiq = otomasyonLib('vidiq');
    if (!ortak || !vidiq) {
      return hataYaz(res, 500, 'bilesen_yok', 'vidIQ yenileme bileşeni (lib/vidiq.js) bulunamadı.',
        'İndirici, otopilot klasörünün içindeki video-indirici/ olarak çalışmalı. Liste boş kalır; indirme ve arama çalışmaya devam eder.');
    }
    const anahtar = ortak.envOku('VIDIQ_KEY');
    if (!anahtar) {
      return hataYaz(res, 400, 'anahtar_yok',
        'VIDIQ_KEY girilmemiş. Otopilot panelinin Anahtarlar ekranından ekle (anahtar: app.vidiq.com/account/settings/mcp).',
        'Liste, anahtar girilip tazeleninceye kadar boş kalır; indirme ve arama çalışır.');
    }
    if (yenileniyor) return hataYaz(res, 409, 'mesgul', 'Liste zaten yenileniyor.', 'Bitmesini bekle (yaklaşık 30 sn).');
    yenileniyor = true;
    try {
      const minYT = Math.min(Math.max(Number(g.minIzlenme) || 1000000, 0), 1e9);
      const hatalar = [];
      let ytListe = [], sosyalListe = [];
      const ist = new vidiq.VidiqIstemci(anahtar, { https: ic.https });
      try {
        await ist.baslat();

        // 1) YouTube Shorts — bu haftanin patlayanlari (izlenmeye gore)
        try {
          const d = mcpYapili(await ist.cagirHam('vidiq_outliers', {
            contentType: 'short', language: 'en', publishedWithin: 'thisWeek',
            minViews: minYT, limit: 50, sort: 'viewCount',
          }));
          ytListe = ((d && d.videos) || []).filter((v) => v && /^[A-Za-z0-9_-]{6,20}$/.test(String(v.videoId))).map((v) => ({
            platform: 'youtube', baslik: temizBaslik(v.videoTitle), kanal: v.channelTitle || '',
            izlenme: v.viewCount || 0, takipci: v.subscriberCount || 0, sure: v.videoDuration || 0,
            saatlik: Math.round(v.vph || 0), katsayi: v.breakoutScore || 0, tarih: v.videoPublishedAt || '',
            kapak: 'https://i.ytimg.com/vi/' + v.videoId + '/hqdefault.jpg',
            url: 'https://www.youtube.com/watch?v=' + v.videoId,
          }));
        } catch (e) { hatalar.push('YouTube: ' + e.message); }

        // 2) TikTok + Instagram — son 7 gunun patlayanlari
        try {
          const hafta = new Date(Date.now() - 7 * 86400000).toISOString();
          const s = await ist.cagirHam('vidiq_instagram_tiktok_outlier_search', {
            query: 'viral trending video everyone is sharing this week',
            audienceQuery: 'Culture/Region: Global; Global: true; Demographics: general audience 18-45, entertainment, humor;',
            resultsPerPlatform: 25, viewsMin: 3000000, datePostedAfter: hafta, collapseByCreator: true,
          });
          sosyalListe = igTiktokAyristir(mcpMetin(s));
        } catch (e) { hatalar.push('TikTok/IG: ' + e.message); }
      } catch (e) {
        return hataYaz(res, 502, (e && e.kod) || 'vidiq', 'vidIQ bağlantısı kurulamadı: ' + String(e && e.message || e), e && e.cozum);
      }

      const videolar = [...ytListe, ...sosyalListe]
        .filter((v) => v.url && v.izlenme > 0)
        .sort((a, b) => b.izlenme - a.izlenme);
      if (!videolar.length) {
        return hataYaz(res, 502, 'vidiq_bos', 'vidIQ sonuç döndürmedi' + (hatalar.length ? ' — ' + hatalar.join(' · ') : ''));
      }

      const cikti = {
        guncellendi: new Date().toISOString(), kaynak: 'vidIQ (canlı)',
        adet: videolar.length, videolar,
      };
      const gecici = KESFET_DOSYA + '.' + process.pid + '.tmp';
      try {
        fs.writeFileSync(gecici, JSON.stringify(cikti, null, 1));
        fs.renameSync(gecici, KESFET_DOSYA);
      } catch (e) {
        try { fs.unlinkSync(gecici); } catch { /* yoksa gec */ }
        logYaz('kesfet-veri.json yazılamadı: ' + e.message);
      }
      return json(res, { ...cikti, uyari: hatalar.length ? hatalar.join(' · ') : undefined });
    } finally { yenileniyor = false; }
  }

  // --- kesfet: canli YouTube aramasi (yt-dlp, bedava, sinirsiz)
  if (yol === '/api/kesfet-ara' && yontem === 'POST') {
    if (!YT) return hataYaz(res, 500, 'ytdlp_yok', 'yt-dlp bulunamadı.', 'Üstteki "yt-dlp" rozetinden kur.');
    const g = await govdeOku(req);
    const sorgu = String(g.sorgu || '').trim().slice(0, 200);
    if (!sorgu) return hataYaz(res, 400, 'sorgu', 'Aranacak kelimeyi yaz.');
    if (araniyor) return hataYaz(res, 409, 'mesgul', 'Başka bir arama sürüyor.', 'Bitmesini bekle.');
    araniyor = true;
    try {
      const url = youtubeAramaUrl(sorgu, g.donem, g.tur);
      const adet = Math.min(Math.max(Number(g.adet) || 60, 1), 100);
      const r = await komutCalistir(YT.cmd, [
        ...YT.base, '-J', '--flat-playlist', '--no-warnings', '--ignore-config', '--socket-timeout', '30',
        '--playlist-end', String(adet), '--', url,
      ], { zamanAsimiMs: 120000 });
      if (r.kod !== 0) {
        const h = hataCevir((r.hata || '').split(/\r?\n/).filter(Boolean).pop() || 'arama başarısız');
        return hataYaz(res, 500, 'arama', hataMetni(h));
      }
      const b = JSON.parse(r.cikti.replace(/^\uFEFF/, ''));
      const min = Number(g.minIzlenme) || 0;
      const videolar = (b.entries || [])
        .filter((e) => e && /^[A-Za-z0-9_-]{6,20}$/.test(String(e.id)) && e.view_count >= min)
        .map((e) => ({
          platform: 'youtube', baslik: temizBaslik(e.title), kanal: e.channel || e.uploader || '',
          izlenme: e.view_count || 0, sure: e.duration || 0, takipci: e.channel_follower_count || 0,
          kapak: `https://i.ytimg.com/vi/${e.id}/hqdefault.jpg`,
          url: `https://www.youtube.com/watch?v=${e.id}`,
        }))
        .sort((x, y) => y.izlenme - x.izlenme);
      return json(res, { videolar, adet: videolar.length });
    } catch (e) {
      logYaz('Arama hatası: ' + (e && e.stack || e));
      return hataYaz(res, 500, 'arama', 'Arama sonucu okunamadı (yt-dlp güncel mi?).');
    } finally { araniyor = false; }
  }

  // --- indirilen dosyayi tarayicida onizle (range destekli)
  if (yontem === 'GET' && yol.startsWith('/dosya/')) {
    let ad;
    try { ad = decodeURIComponent(yol.slice('/dosya/'.length)); }
    catch { return hataYaz(res, 400, 'istek', 'Geçersiz dosya adı.'); }
    const hedef = guvenliDosya(ad);
    if (!hedef) return hataYaz(res, 404, 'dosya_yok', 'Dosya bulunamadı.');
    const st = fs.statSync(hedef);
    const tip = MIME[path.extname(hedef).toLowerCase()] || 'application/octet-stream';
    const aralik = aralikCoz(req.headers.range, st.size);
    let basliklar, akim;
    if (aralik === 'x') {
      res.writeHead(416, { 'Content-Range': `bytes */${st.size}`, 'Cache-Control': 'no-store' });
      return res.end();
    } else if (aralik) {
      basliklar = [206, {
        'Content-Range': `bytes ${aralik.bas}-${aralik.son}/${st.size}`, 'Accept-Ranges': 'bytes',
        'Content-Length': aralik.son - aralik.bas + 1, 'Content-Type': tip,
      }];
      akim = fs.createReadStream(hedef, { start: aralik.bas, end: aralik.son });
    } else {
      basliklar = [200, { 'Content-Length': st.size, 'Content-Type': tip, 'Accept-Ranges': 'bytes' }];
      akim = fs.createReadStream(hedef);
    }
    res.writeHead(...basliklar);
    akim.on('error', () => res.destroy());
    res.on('close', () => akim.destroy());
    akim.pipe(res);
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Bulunamadı');
}

const sunucu = http.createServer((req, res) => {
  istekIsle(req, res).catch((e) => {
    if (e && e.durum) {
      if (!res.headersSent) {
        if (e.durum === 413) res.setHeader('Connection', 'close');
        hataYaz(res, e.durum, e.kod || 'istek', e.message);
      }
      return;
    }
    logYaz('İstek hatası (' + req.method + ' ' + String(req.url).slice(0, 120) + '): ' + (e && e.stack || e));
    try {
      if (!res.headersSent) hataYaz(res, 500, 'sunucu', 'Beklenmeyen bir hata oluştu.', 'Ayrıntı log dosyasında: ' + LOG_DIZIN);
      else res.destroy();
    } catch { /* yanit kapanmis */ }
  });
});
sunucu.on('clientError', (e, soket) => { try { soket.end('HTTP/1.1 400 Bad Request\r\n\r\n'); } catch { /* kapali */ } });

// ---------------------------------------------------------------- acilis
async function baslat(secenek = {}) {
  ayarYukle();
  klasorGarantile();
  YT = await ytDlpBul();
  ffmpegHazir = await ffmpegVar();

  let istenen = secenek.port;
  if (istenen === undefined) {
    const e = String(process.env.INDIRICI_PORT || '').trim();
    istenen = /^\d{1,5}$/.test(e) && Number(e) <= 65535 ? Number(e) : VARSAYILAN_PORT;
  }
  await new Promise((coz, red) => {
    sunucu.once('error', red);
    sunucu.listen(istenen, '127.0.0.1', () => { sunucu.removeListener('error', red); coz(); });
  });
  aktifPort = sunucu.address().port;
  return sunucu;
}

function kapat() {
  hepsiniDurdur();
  for (const r of dinleyiciler) { try { r.end(); } catch { /* kopmus */ } }
  dinleyiciler.clear();
  return new Promise((coz) => {
    sunucu.close(() => coz());
    if (sunucu.closeAllConnections) sunucu.closeAllConnections();
  });
}

// Dolu portta kim var? Bu indirici jetonsuz /api/durum'a 403 verir; jetonsuz 200 + indirici JSON'u veren sunucu
// ESKI, guvenlik denetimsiz kopyadir (bu projenin disindaki eski klasor). 'korumasiz' | 'indirici' | 'baska' | 'yanit_yok'
function portDoluTani(port, { zamanAsimiMs = 1500 } = {}) {
  return new Promise((coz) => {
    let bitti = false;
    const son = (v) => { if (!bitti) { bitti = true; coz(v); } };
    try {
      const r = http.get({ host: '127.0.0.1', port, path: '/api/durum', timeout: zamanAsimiMs, headers: { Accept: 'application/json' } }, (res) => {
        const parcalar = [];
        let boyut = 0;
        res.on('data', (c) => { boyut += c.length; if (boyut > 256 * 1024) { res.destroy(); son('baska'); } else parcalar.push(c); });
        res.on('error', () => son('baska'));
        res.on('end', () => {
          if (res.statusCode === 403) return son('indirici');
          if (res.statusCode === 200) {
            try {
              const j = JSON.parse(Buffer.concat(parcalar).toString('utf8'));
              if (j && Array.isArray(j.isler) && j.ayar && typeof j.ayar === 'object') return son('korumasiz');
            } catch { /* indirici JSON'u degil */ }
          }
          son('baska');
        });
      });
      r.on('timeout', () => { r.destroy(); son('yanit_yok'); });
      r.on('error', () => son('yanit_yok'));
    } catch { son('yanit_yok'); }
  });
}

function tarayiciAc(url) {
  let cmd, args;
  if (WIN) { cmd = 'explorer.exe'; args = [url]; }
  else if (process.platform === 'darwin') { cmd = 'open'; args = [url]; }
  else { cmd = 'xdg-open'; args = [url]; }
  const p = spawn(cmd, args, { windowsHide: false, detached: true, stdio: 'ignore' });
  p.on('error', () => { /* tarayici acilamadiysa kullanici adresi elle acar */ });
  p.unref();
}

if (require.main === module) {
  process.on('uncaughtException', (e) => logYaz('uncaughtException: ' + (e && e.stack || e)));
  process.on('unhandledRejection', (e) => logYaz('unhandledRejection: ' + (e && e.stack || e)));
  process.on('exit', hepsiniDurdur);
  for (const s of ['SIGINT', 'SIGTERM']) process.on(s, () => { hepsiniDurdur(); process.exit(0); });

  baslat().then(() => {
    const c = (s) => s;
    console.log('');
    console.log('  ' + c('VİDEO İNDİRİCİ'));
    console.log('  ------------------------------------------');
    console.log('  Panel    : http://localhost:' + aktifPort);
    console.log('  Klasör   : ' + ayar.klasor);
    console.log('  yt-dlp   : ' + (YT ? YT.surum + '  (' + YT.cmd + ')' : 'BULUNAMADI  ->  panelden "Kur/Güncelle"'));
    console.log('  ffmpeg   : ' + (ffmpegHazir ? 'var' : 'YOK (1080p birleştirme çalışmaz)'));
    console.log('  ------------------------------------------');
    console.log('  Yalnızca kendi içeriğini ya da izinli içeriği indir.');
    console.log('  Kapatmak için bu pencereyi kapat.');
    console.log('');
    if (process.argv.includes('--ac')) tarayiciAc('http://localhost:' + aktifPort);
  }).catch(async (e) => {
    if (e && e.code === 'EADDRINUSE') {
      const p = e.port || VARSAYILAN_PORT;
      const tani = await portDoluTani(p);
      if (tani === 'korumasiz') {
        // eski kopya host/jeton/klasor denetimi yapmaz; yeni kopya onun yerine KULLANILMAMALI, eskisi kapatilmali
        console.error('\n  ✗ Port ' + p + '\'de ESKİ, güvenlik denetimi olmayan bir indirici çalışıyor (bu projenin dışındaki eski bir klasör).');
        console.error('    ↳ O pencereyi kapat, sonra bunu yeniden aç. O klasörü bir daha açma: güncellenmiyor.');
        console.error('      (indirilenler/ içindeki dosyaları bu klasörün indirilenler/ içine taşıyıp eski klasörü silebilirsin.)\n');
      } else {
        console.error('\n  ✗ Port ' + p + ' dolu: indirici zaten açık olabilir.');
        console.error('    ↳ http://localhost:' + p + ' adresini tarayıcıda aç; açılmazsa portu kullanan programı kapat.\n');
      }
      process.exit(98);
    }
    logYaz('Başlatılamadı: ' + (e && e.stack || e));
    console.error('\n  ✗ İndirici başlatılamadı: ' + String(e && e.message || e));
    if (e && e.code === 'EACCES') {
      console.error('    ↳ Bu port Windows tarafından ayrılmış olabilir (Hyper-V / WSL). Başka bir port dene: set INDIRICI_PORT=4195');
    }
    console.error('');
    process.exit(1);
  });
}

module.exports = {
  sunucu, baslat, kapat, ic, jeton: () => JETON, CEREZ_AD, isEkle,
  hostGecerli, originGecerli, klasorDogrula, guvenliDosya, linkGecerli, linkleriSuz, adYerelCozuluyorMu, hataCevir,
  aralikCoz, formatSecici, youtubeAramaUrl, igTiktokAyristir, kisaltmaSayi, yerelAdresMi, dnsAdresiYerelMi, portDoluTani,
  KUYRUK_MAX, LINK_MAX,
  durum: () => ({ ayar, YT, isler }),
};
