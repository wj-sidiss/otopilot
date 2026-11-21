#!/usr/bin/env node
// ffmpeg yoksa tasinabilir kurulum (Windows): winget'i, yonetici yetkisi ya da Microsoft Store'u olmayan eski Windows icin.
//   node araclar/ffmpeg-kur.js
// Surume sabit GyanD derlemesini (~114 MB) indirir, SHA256'sini data/ffmpeg-sha256.json ile dogrular (tutmazsa siler, durur),
// ~/.otopilot/ffmpeg altina acar ve .env'e FFMPEG_YOLU / FFPROBE_YOLU yazar (ff-yol.js once bunlara bakar). Yonetici yetkisi istemez.
// macOS: brew install ffmpeg · Linux: sudo apt install ffmpeg (paket deposundaki surum yeter).
// Cikis: 0 tamam · 2 bu platformda gerek yok/desteklenmiyor · 3 indirme · 4 SHA256 tutmadi · 5 acma/deneme
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const KOK = path.join(__dirname, "..");
const B = require(path.join(KOK, "lib", "butunluk.js"));
const T = JSON.parse(fs.readFileSync(path.join(KOK, "data", "ffmpeg-sha256.json"), "utf8"));
const HEDEF = process.env.OTOPILOT_FFMPEG_KOK || path.join(os.homedir(), ".otopilot", "ffmpeg");

async function main() {
  if (process.platform !== "win32") {
    console.log(process.platform === "darwin" ? "macOS: brew install ffmpeg" : "Linux: sudo apt-get install -y ffmpeg   (ya da dağıtımının paket yöneticisi)");
    return 2;
  }
  const t = T[`win32-${process.arch === "arm64" ? "arm64" : "x64"}`];
  if (!t) { console.log("✗ Bu Windows mimarisi için hazır derleme yok: winget install Gyan.FFmpeg"); return 2; }
  const zip = path.join(HEDEF, "indirmeler", path.basename(new URL(t.url).pathname));
  console.log(`ffmpeg ${T.surum} (taşınabilir, ${Math.round(t.boyut / 1048576)} MB) → ${HEDEF}\nLisans: ${T.lisans}`);
  try {
    const r = await B.guvenliIndir(t.url, zip, t, { ilerleme: (n, top) => { if (process.stdout.isTTY) process.stdout.write(`\r  ${Math.round(n / 1048576)}/${Math.round(top / 1048576)} MB`); } });
    console.log(`\n  ✔ ${r.indirildi ? "indirildi" : "zaten vardı"}, SHA256 doğru`);
  } catch (e) { console.log("\n✗ " + e.message); return e.kod === "sha256_tutmadi" ? 4 : 3; }
  const bin = path.join(HEDEF, t.klasor, "bin");
  if (!fs.existsSync(path.join(bin, "ffmpeg.exe"))) {
    const winTar = path.join(process.env.SystemRoot || "C:\\Windows", "System32", "tar.exe");
    let a = fs.existsSync(winTar) ? spawnSync(winTar, ["-xf", zip, "-C", HEDEF], { encoding: "utf8", windowsHide: true }) : { status: 1 };
    if (a.status !== 0) a = spawnSync("powershell", ["-NoProfile", "-Command", `Expand-Archive -LiteralPath '${zip}' -DestinationPath '${HEDEF}' -Force`], { encoding: "utf8", windowsHide: true });
    if (a.status !== 0) { console.log("✗ arşiv açılamadı: " + String(a.stderr || "").split("\n")[0]); return 5; }
  }
  const ffmpeg = path.join(bin, "ffmpeg.exe"), ffprobe = path.join(bin, "ffprobe.exe");
  const v = spawnSync(ffmpeg, ["-version"], { encoding: "utf8", windowsHide: true });
  if (v.status !== 0) { console.log("✗ ffmpeg çalışmadı: " + String(v.stderr || v.error || "").split("\n")[0]); return 5; }
  console.log("  ✔ " + v.stdout.split("\n")[0].slice(0, 60));
  try {
    require(path.join(KOK, "lib", "ortak.js")).envYaz({ ayarla: { FFMPEG_YOLU: ffmpeg, FFPROBE_YOLU: ffprobe } });
    console.log("  ✔ .env: FFMPEG_YOLU ve FFPROBE_YOLU yazıldı");
  } catch (e) { console.log(`  ! .env yazılamadı (${e.message}); elle ekle:\n    FFMPEG_YOLU=${ffmpeg}\n    FFPROBE_YOLU=${ffprobe}`); }
  console.log("Kontrol: node araclar/doktor.js");
  return 0;
}
if (require.main === module) main().then(k => { process.exitCode = k; }).catch(e => { console.error("HATA " + e.message); process.exitCode = 1; });
module.exports = { main };
