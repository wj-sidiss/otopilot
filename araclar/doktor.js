#!/usr/bin/env node
// Kurulum doktoru: Otopilot'un bu makinede/ortamda calisip calismayacagini tek komutla olcer ve her eksik icin TAM duzeltme komutunu yazar.
//   node araclar/doktor.js            kontrol et (zorunlular + istege bagli), eksikse cikis 2
//   node araclar/doktor.js --codex    ek olarak Codex (ChatGPT bulut) ortami icin kurulum betigi + internet izin listesi
//   node araclar/doktor.js --ag       yalniz ag kontrolu
//   node araclar/doktor.js --json     makine okur cikti
// Cikis kodlari: 0 hazir, 2 zorunlu bir sey eksik, 3 yalniz ag sorunu (internet kapali/engelli).
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const https = require("https");
const { spawnSync } = require("child_process");

const KOK = path.join(__dirname, "..");
const WIN = process.platform === "win32", MAC = process.platform === "darwin";
const KURULUM = {
  ffmpeg: WIN ? "winget install Gyan.FFmpeg   (sonra terminali KAPATIP yeniden aç; winget yoksa: node araclar/ffmpeg-kur.js — taşınabilir, SHA256 doğrulamalı, yönetici istemez)" : MAC ? "brew install ffmpeg" : "sudo apt-get update && sudo apt-get install -y ffmpeg",
  node: WIN ? "winget install OpenJS.NodeJS.LTS" : MAC ? "brew install node" : "https://nodejs.org (Node 22 ya da üstü: nvm install 22)",
  python: WIN ? "winget install Python.Python.3.12" : MAC ? "brew install python" : "sudo apt-get install -y python3",
  espeak: "sudo apt-get install -y espeak-ng",
};
// Otopilot'un ucretsiz hattinin ihtiyac duydugu adresler (Codex bulutunda "domain allowlist"e yazilacak)
const ADRESLER = [
  { ad: "ses (Edge sesli okuma)", host: "speech.platform.bing.com", yol: "/consumer/speech/synthesize/readaloud/voices/list?trustedclienttoken=6A5AA1D4EAFF4E9FB37E23D68491D6F4", zorunlu: true },
  { ad: "görsel: Wikimedia Commons", host: "commons.wikimedia.org", yol: "/w/api.php?action=query&meta=siteinfo&format=json", zorunlu: true },
  { ad: "görsel: Wikimedia dosyaları", host: "upload.wikimedia.org", yol: "/", zorunlu: false },
  { ad: "görsel: Openverse", host: "api.openverse.org", yol: "/v1/", zorunlu: false },
  { ad: "görsel: NASA", host: "images-api.nasa.gov", yol: "/search?q=moon&media_type=image&page_size=1", zorunlu: false },
  { ad: "görsel: The Met", host: "collectionapi.metmuseum.org", yol: "/public/collection/v1/departments", zorunlu: false },
  { ad: "görsel: Art Institute of Chicago", host: "api.artic.edu", yol: "/api/v1/artworks?limit=1", zorunlu: false },
  { ad: "görsel: Rijksmuseum", host: "data.rijksmuseum.nl", yol: "/", zorunlu: false },
  { ad: "görsel: Cleveland Museum", host: "openaccess-api.clevelandart.org", yol: "/api/artworks/?limit=1", zorunlu: false },
  { ad: "npm paketleri", host: "registry.npmjs.org", yol: "/ws", zorunlu: false },
  { ad: "GitHub (güncelleme)", host: "api.github.com", yol: "/", zorunlu: false },
];

function surum(komut, args) {
  try { const r = spawnSync(komut, args, { encoding: "utf8", timeout: 8000, windowsHide: true }); if (r.status === 0) return (r.stdout || r.stderr).split("\n")[0].trim(); } catch (e) { /* yok */ }
  return null;
}
function ffmpegBul() {
  try { const f = require(path.join(KOK, "ff-yol.js")); const v = surum(f.ffmpeg, ["-version"]); return v ? { yol: f.ffmpeg, ffprobe: f.ffprobe, surum: v } : null; } catch (e) { return null; }
}
function kodlayicilar(ffmpeg) {
  const r = spawnSync(ffmpeg, ["-hide_banner", "-encoders"], { encoding: "utf8", timeout: 15000, windowsHide: true });
  const m = r.stdout || "";
  return { libx264: /libx264/.test(m), aac: /\baac\b/.test(m) };
}
function adresDene(a, zamanMs) {
  return new Promise((ok) => {
    const t0 = Date.now();
    const q = https.request({ hostname: a.host, path: a.yol, method: "GET", timeout: zamanMs, headers: { "user-agent": "otopilot-doktor" } }, (r) => { r.resume(); ok({ ok: true, durum: r.statusCode, ms: Date.now() - t0 }); });
    q.on("timeout", () => { q.destroy(); ok({ ok: false, neden: "zaman aşımı" }); });
    q.on("error", (e) => ok({ ok: false, neden: e.code || e.message }));
    q.end();
  });
}
const yaz = (isaret, ad, ek) => console.log(`  ${isaret} ${ad}${ek ? "  " + ek : ""}`);

async function main(argv) {
  const json = argv.includes("--json"), yalnizAg = argv.includes("--ag"), codex = argv.includes("--codex");
  const rapor = { platform: process.platform, zorunlu: [], istege: [], ag: [], sorunlar: [] };
  const say = (liste, ad, ok, ek, cozum) => { liste.push({ ad, ok, ek: ek || "", cozum: cozum || "" }); if (!json) yaz(ok ? "✔" : (liste === rapor.zorunlu ? "✗" : "·"), ad, ek); if (!ok && cozum && !json) console.log("      → " + cozum); };

  if (!yalnizAg) {
    if (!json) console.log("\nZorunlu");
    const nodeSurum = parseInt(process.versions.node.split(".")[0], 10);
    say(rapor.zorunlu, "Node.js 22 ya da üstü", nodeSurum >= 22, "bulunan " + process.versions.node, KURULUM.node);
    const bag = ["ws", "@anthropic-ai/sdk", "msedge-tts"].map(p => fs.existsSync(path.join(KOK, "node_modules", p)));
    say(rapor.zorunlu, "npm paketleri kurulu", bag.every(Boolean), bag.every(Boolean) ? "" : "eksik", "npm ci --ignore-scripts   (depo klasöründe)");
    const ff = ffmpegBul();
    say(rapor.zorunlu, "ffmpeg ve ffprobe", !!ff, ff ? ff.surum.slice(0, 40) : "", KURULUM.ffmpeg);
    if (ff) { const k = kodlayicilar(ff.yol); say(rapor.zorunlu, "ffmpeg: libx264 (video) + aac (ses) kodlayıcıları", k.libx264 && k.aac, k.libx264 && k.aac ? "" : "eksik", "tam ffmpeg yapısı kur (" + KURULUM.ffmpeg + ")"); }
    let yazilir = true; try { const d = path.join(KOK, "uretim"); fs.mkdirSync(d, { recursive: true }); fs.accessSync(d, fs.constants.W_OK); } catch (e) { yazilir = false; }
    say(rapor.zorunlu, "uretim/ klasörüne yazılabiliyor", yazilir, "", "depo klasörünün yazma iznini kontrol et");

    if (!json) console.log("\nİsteğe bağlı (yoksa o özellik kapalı, ana hat çalışır)");
    const py = surum(WIN ? "python" : "python3", ["--version"]);
    say(rapor.istege, "Python 3.9+ (cinecode filmleri)", !!py, py || "", KURULUM.python);
    const chrome = [process.env.CHROME_PATH, "C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"].filter(Boolean).find(p => fs.existsSync(p));
    say(rapor.istege, "Chrome ya da Edge (3B sahneler, cinecode, PNG/PDF)", !!chrome, chrome || "", "Chrome/Edge kur; yoksa 3B ve cinecode kapalı kalır");
    if (!WIN && !MAC) { const e = surum("espeak-ng", ["--version"]) || surum("espeak", ["--version"]); say(rapor.istege, "espeak-ng (Edge sesi kapanırsa yedek ses)", !!e, e || "", KURULUM.espeak); }
    const gpu = surum("nvidia-smi", ["--query-gpu=name,memory.total", "--format=csv,noheader"]);
    say(rapor.istege, "NVIDIA ekran kartı (VoxCPM2, MuseTalk, ACE-Step)", !!gpu, gpu || "", "gerekmez; yalnız yerel yapay zekâ modelleri için");
    try {
      const dn = require(path.join(KOK, "lib", "donanim.js"));
      const p = dn.profilSec(dn.olc(), n => process.env[n]);
      rapor.donanimProfili = p.ad;
      say(rapor.istege, "Donanım profili: " + p.ad, true, p.neden, "");
      if (!json) console.log("      ayrıntı: node araclar/donanim.js · model doğrulama: node araclar/sha256.js --modeller");
    } catch (e) { /* olcum yapilamadi: doktor yine calisir */ }
    say(rapor.istege, ".env dosyası (anahtarlar)", fs.existsSync(path.join(KOK, ".env")), "", "anahtar gerekmez; isteğe bağlı: .env.ornek dosyasını .env olarak kopyala");
  }

  if (!json) console.log("\nİnternet (ücretsiz hattın ihtiyacı)");
  const sonuc = await Promise.all(ADRESLER.map(a => adresDene(a, 8000).then(r => ({ a, r }))));
  let zorunluAgSorunu = false;
  for (const { a, r } of sonuc) {
    const ok = r.ok; if (!ok && a.zorunlu) zorunluAgSorunu = true;
    rapor.ag.push({ ad: a.ad, host: a.host, ok, ek: ok ? "HTTP " + r.durum : r.neden, zorunlu: a.zorunlu });
    if (!json) yaz(ok ? "✔" : (a.zorunlu ? "✗" : "·"), `${a.ad} (${a.host})`, ok ? "" : r.neden);
  }
  const agKapali = sonuc.every(x => !x.r.ok);
  if (!json && agKapali) {
    console.log("\n  ! Hiçbir adrese ulaşılamadı: internet kapalı ya da engelli görünüyor.");
    console.log("    Codex bulutunda (ChatGPT kenar çubuğu) ajanın interneti varsayılan KAPALIDIR: Environment ayarlarında 'Agent internet access'i aç ve alan adı izin listesine aşağıdaki adresleri ekle (node araclar/doktor.js --codex).");
  } else if (!json && zorunluAgSorunu) console.log("\n  ! Zorunlu adreslerden biri engelli (ses ya da görsel çalışmaz). İzin listesini genişlet (node araclar/doktor.js --codex).");

  if (codex && !json) {
    console.log("\n── CODEX BULUT KURULUMU ──────────────────────────────────────────");
    console.log("1) chatgpt.com/codex → Environments → depoyu seç → 'Setup script' alanına yapıştır:");
    console.log("     apt-get update && apt-get install -y ffmpeg espeak-ng && npm ci --ignore-scripts");
    console.log("2) Aynı ortamda 'Agent internet access' = ON (izin listesi: aşağıdakiler) ve 'Node.js' sürümü 22 ya da üstü.");
    console.log("   İzin listesi: " + ADRESLER.map(a => a.host).join(", "));
    console.log("3) Ajanın ilk istemi: \"AGENTS.md'yi oku, `node araclar/doktor.js` çalıştır, sonra isteğimi yap.\"");
    console.log("(Arayüz adları ve izin listesi zamanla değişebilir; bir adres engelli çıkarsa `node araclar/doktor.js --ag` hangisi olduğunu gösterir.)");
    console.log("Bulutta olmayanlar: ekran kartı, Chrome (3B/cinecode), bilgisayarındaki dosyalar. Onlar için Codex'in yerel uygulamasını ya da komut satırını kullan (docs/CODEX.md).");
  }

  const eksik = rapor.zorunlu.filter(x => !x.ok);
  rapor.sorunlar = eksik.map(x => x.ad);
  if (json) console.log(JSON.stringify(rapor, null, 2));
  else console.log(eksik.length ? `\nSonuç: ${eksik.length} zorunlu eksik var. Yukarıdaki → komutlarını sırayla çalıştır, sonra bunu yeniden çalıştır.` : (agKapali || zorunluAgSorunu ? "\nSonuç: kurulum tamam, ama internet engelli (yukarıya bak)." : "\nSonuç: hazır. AGENTS.md'yi oku ve isteğini yaz."));
  return eksik.length ? 2 : (agKapali || zorunluAgSorunu ? 3 : 0);
}
if (require.main === module) main(process.argv.slice(2)).then(k => { process.exitCode = k; }).catch(e => { console.error("  HATA " + e.message); process.exitCode = 1; });
module.exports = { main, ADRESLER, adresDene };
