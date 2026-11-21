// ff-yol.js — ffmpeg ve ffprobe'u nerede olursa bulur.
//
// Once FFMPEG_YOLU / FFPROBE_YOLU ortam degiskenine, sonra WinGet konumuna, yaygin
// kurulum yerlerine, en son PATH'e bakar. Boylece ffmpeg'i nasil kurdugun fark etmez.
//
// Bulunamazsa SUREC OLDURULMEZ: OrtakHata('ffmpeg_yok', cikis 2) firlatilir; betiklerin
// `.catch(ortak.bitir)` kancasi bunu "✗ ffmpeg bulunamadi" + kurulum cozumu olarak yazar.
// (Dogrudan `node ff-yol.js` calistirilinca kurulum talimati basilir ve 2 ile cikilir;
// PANEL.bat bunu kullaniyor.)
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");
const { OrtakHata, CIKIS, envOku } = require("./lib/ortak");

const KURULUM_COZUMU = "ffmpeg'i kur: Windows'ta 'winget install Gyan.FFmpeg' (winget yoksa 'node araclar/ffmpeg-kur.js'), Mac'te 'brew install ffmpeg', " +
  "Linux'ta 'sudo apt install ffmpeg'; kurduktan sonra terminali KAPATIP yeniden aç.";

function adaylar(ad) {
  const exe = process.platform === "win32" ? ad + ".exe" : ad;
  const L = process.env.LOCALAPPDATA, P = process.env.ProgramFiles;
  const liste = [envOku(ad === "ffmpeg" ? "FFMPEG_YOLU" : "FFPROBE_YOLU")];       // .env'e ya da ortama yazilabilir
  if (process.platform === "win32") {
    liste.push(
      L && path.join(L, "Microsoft", "WinGet", "Links", exe),        // winget
      L && path.join(L, "Programs", "ffmpeg", "bin", exe),
      P && path.join(P, "ffmpeg", "bin", exe),                        // elle kurulum
      "C:\\ffmpeg\\bin\\" + exe,
      "C:\\ProgramData\\chocolatey\\bin\\" + exe,                     // chocolatey
      process.env.USERPROFILE && path.join(process.env.USERPROFILE, "scoop", "shims", exe)); // scoop
  } else {
    liste.push("/usr/bin/" + ad, "/usr/local/bin/" + ad, "/opt/homebrew/bin/" + ad);   // linux / mac
  }
  return liste.filter(Boolean);
}

function calisiyorMu(yol) {
  try { execFileSync(yol, ["-version"], { stdio: "ignore", timeout: 8000, windowsHide: true }); return true; }
  catch (e) { return false; }
}

function bul(ad) {
  for (const y of adaylar(ad)) if (fs.existsSync(y)) return y;
  if (calisiyorMu(ad)) return ad;            // PATH'te varsa dogrudan adiyla cagir
  throw new OrtakHata("ffmpeg_yok", ad + " bulunamadı.", { cikis: CIKIS.GIRDI, cozum: KURULUM_COZUMU });
}

// ---------------------------------------------------------------------------
// FILTRE DOSYASI BAYRAGI
// Uzun filtre graflari komut satirina sigmadigi icin dosyadan okutuluyor.
// Bunun bayragi ffmpeg surumune gore DEGISTI:
//   ffmpeg <= 8 : -filter_complex_script <dosya>
//   ffmpeg >= 9 : -/filter_complex <dosya>      (eskisi KALDIRILDI)
// Tahmin etmek yerine bir kez deneyip hangisi calisiyorsa onu kullaniyoruz;
// boylece her iki surumde de calisir.
let _bayrak = null;
function filtreBayragi() {
  if (_bayrak) return _bayrak;
  const tmp = path.join(os.tmpdir(), "ff-filtre-test-" + process.pid + ".txt");
  fs.writeFileSync(tmp, "[0:v]null[out]", "utf8");
  const bos = process.platform === "win32" ? "NUL" : "/dev/null";
  const dene = bayrak => {
    try {
      execFileSync(module.exports.ffmpeg,
        ["-y", "-hide_banner", "-loglevel", "error",
         "-f", "lavfi", "-i", "testsrc2=s=64x64:r=5:d=0.2",
         bayrak, tmp, "-map", "[out]", "-frames:v", "1", "-f", "null", bos],
        { stdio: "ignore", timeout: 20000, windowsHide: true });
      return true;
    } catch (e) { return false; }
  };
  for (const b of ["-/filter_complex", "-filter_complex_script"]) {
    if (dene(b)) { _bayrak = b; break; }
  }
  try { fs.unlinkSync(tmp); } catch (e) { /* gecici dosya zaten yok */ }
  if (!_bayrak) _bayrak = "-filter_complex_script";   // son care
  return _bayrak;
}

let _ff = null, _fp = null, _var = null;
// ffmpeg VE ffprobe bulunabiliyor mu? Hicbir zaman firlatmaz; sonucu onbellekler (testler/CI ffmpeg yoksa
// ffmpeg isteyen testleri atlamak, secim araclari "ffmpeg yok" demek icin kullanir).
function varMi() {
  if (_var === null) { try { void module.exports.ffmpeg; void module.exports.ffprobe; _var = true; } catch (e) { _var = false; } }
  return _var;
}
module.exports = {
  get ffmpeg()  { return _ff || (_ff = bul("ffmpeg")); },
  get ffprobe() { return _fp || (_fp = bul("ffprobe")); },
  get filtreBayragi() { return filtreBayragi(); },
  varMi,
  KURULUM_COZUMU,
};

// Dogrudan calistirilinca kontrol amaclidir: ffmpeg varsa yolu yazip 0 ile,
// yoksa kurulum talimatiyla 2 ile cikar. PANEL.bat bunu kullaniyor.
// (Getter'lar tembel oldugu icin sadece require etmek kontrol yapmiyordu.)
if (require.main === module) {
  try {
    console.log(module.exports.ffmpeg);
    console.log(module.exports.ffprobe);
  } catch (e) {
    console.error("");
    console.error("✗ " + e.message);
    console.error("");
    console.error("  Windows : winget install Gyan.FFmpeg");
    console.error("  Mac     : brew install ffmpeg");
    console.error("  Linux   : sudo apt install ffmpeg");
    console.error("");
    console.error("  Kurduktan sonra terminali KAPATIP yeniden ac.");
    console.error("");
    process.exit(CIKIS.GIRDI);
  }
}
