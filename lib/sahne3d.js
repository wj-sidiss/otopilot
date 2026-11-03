// 3B SAHNE CIZICI (ucretsiz, yerel): three.js sahnesini kendi Chrome/Edge'inle kare kare cizip ffmpeg ile MP4 yapar. Kredi harcamaz.
// Her kare = f(t): sahne `window.__seek(t)` ile zamana kurulur, Chrome DevTools Protocol'ten (ws) ekran goruntusu alinir, ffmpeg'e akar.
// three.js depoda YOK: ilk kullanimda `npm install three` ile uretim/_3d/three altina iner (MIT, ~30 MB); sablonlar sahne3d/ icinde.
// Fikir ve sablon yapisi: motionforge (github.com/aykutucesai/motionforge, MIT); kod ve sablonlar bu depoda yeniden yazildi.
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const http = require("http");
const { spawn, spawnSync } = require("child_process");
const ortak = require("./ortak.js");

const THREE_SURUM = "0.170.0";
const SABLON_DIZIN = path.join(__dirname, "..", "sahne3d");
const SABLONLAR = Object.freeze({
  urun: { ad: "Ürün platformu (döner)", varsayilan: { baslik: "Yeni ürün", altBaslik: "", renk: "#c8f53a", renk2: "#111317" } },
  dunya: { ad: "Dünya ve uçuş yayları", varsayilan: { baslik: "Dünya çapında", altBaslik: "", renk: "#4fd1ff", renk2: "#0b1020", noktalar: [[41, 29], [51.5, -0.1], [40.7, -74], [35.7, 139.7], [-33.9, 151.2]] } },
  karakter: { ad: "3B sunucu karakter", varsayilan: { baslik: "", altBaslik: "", onAyar: "yaratici", renk: "#ffb347", renk2: "#16181d" } },
});
const KARAKTER_AYARLARI = ["yaratici", "ogretmen", "sef", "koc", "analist"];
const hata = (m, c, k) => Object.assign(new Error(m), { cikis: k || 2, cozum: c });

function chromeBul(env) {
  const oku = env || ortak.envOku;
  const liste = [oku("CHROME_YOLU"),
    "C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    (process.env.LOCALAPPDATA || "") + "/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
    "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"];
  return liste.find(y => y && fs.existsSync(y)) || "";
}
const threeDizin = () => path.join(ortak.uretimDizini(), "_3d", "three");
const threeHazirMi = () => fs.existsSync(path.join(threeDizin(), "node_modules", "three", "build", "three.module.min.js"));

function threeKur(log) {
  if (threeHazirMi()) return;
  log("  three.js indiriliyor (bir kez, ~30 MB)…");
  fs.mkdirSync(threeDizin(), { recursive: true });
  const r = spawnSync(process.platform === "win32" ? "npm.cmd" : "npm", ["install", "three@" + THREE_SURUM, "--prefix", threeDizin(), "--ignore-scripts", "--no-audit", "--no-fund", "--loglevel", "error"],
    { encoding: "utf8", windowsHide: true, shell: process.platform === "win32", timeout: 5 * 60 * 1000 });
  if (r.status !== 0 || !threeHazirMi()) throw hata("three.js kurulamadı.", "İnternet bağlantısını kontrol et; elle: npm install three@" + THREE_SURUM + " --prefix " + threeDizin(), 3);
}

// --- yerel sunucu: sahne html'i, ortak modul, three (yalniz bu klasorden), istege bagli GLB model
function sunucu(htmlGovde, modelYolu) {
  const kok = path.join(threeDizin(), "node_modules", "three");
  const TUR = { ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json", ".glb": "model/gltf-binary", ".html": "text/html; charset=utf-8" };
  const s = http.createServer((req, res) => {
    let p; try { p = decodeURIComponent(new URL(req.url, "http://x").pathname); } catch (e) { res.statusCode = 400; return res.end(); }
    const gonder = (dosya, tur) => { try { const b = fs.readFileSync(dosya); res.writeHead(200, { "Content-Type": tur || TUR[path.extname(dosya)] || "application/octet-stream", "Cache-Control": "no-store" }); res.end(b); } catch (e) { res.statusCode = 404; res.end(); } };
    if (p === "/") { res.writeHead(200, { "Content-Type": TUR[".html"] }); return res.end(htmlGovde); }
    if (p === "/ortak.js") return gonder(path.join(SABLON_DIZIN, "ortak.js"));
    if (p === "/model.glb" && modelYolu) return gonder(modelYolu);
    if (p.startsWith("/three/")) {
      const hedef = path.resolve(kok, "." + p.slice("/three".length));
      if (!ortak.yolIcinde(kok, hedef) || !/\.(m?js|json)$/.test(hedef)) { res.statusCode = 403; return res.end(); }
      return gonder(hedef);
    }
    res.statusCode = 404; res.end();
  });
  return new Promise(coz => s.listen(0, "127.0.0.1", () => coz({ sunucu: s, port: s.address().port })));
}

// --- Chrome DevTools Protocol (ws): kucuk istemci
function cdp(WebSocket, url) {
  const ws = new WebSocket(url, { perMessageDeflate: false, maxPayload: 256 * 1024 * 1024 });
  let id = 0; const bekleyen = new Map(); const olaylar = [];
  ws.on("message", m => {
    let j; try { j = JSON.parse(m); } catch (e) { return; }
    if (j.id && bekleyen.has(j.id)) { const [coz, red] = bekleyen.get(j.id); bekleyen.delete(j.id); j.error ? red(new Error(j.error.message)) : coz(j.result); }
    else if (j.method) olaylar.push(j);
  });
  const hazir = new Promise((coz, red) => { ws.on("open", coz); ws.on("error", red); });
  return { hazir, olaylar, kapat: () => { try { ws.close(); } catch (e) { /* kapali */ } },
    cagir: (method, params) => new Promise((coz, red) => { const i = ++id; bekleyen.set(i, [coz, red]); ws.send(JSON.stringify({ id: i, method, params: params || {} })); }) };
}
const bekle = ms => new Promise(r => setTimeout(r, ms));

// sablon html'ine parametre gomer (</script> kacisi)
function sahneHtml(sablon, parametre) {
  const html = fs.readFileSync(path.join(SABLON_DIZIN, "sablonlar", sablon + ".html"), "utf8");
  const json = JSON.stringify(parametre).replace(/</g, "\\u003c");
  return html.replace("/*PARAMETRE*/", json);
}

// o.sablon, o.parametre, o.sure (sn), o.genislik/yukseklik, o.fps, o.cikti, o.model (GLB yolu, ops.), o.log
async function ciz(o, enj) {
  const e = enj || {};
  const log = o.log || (m => console.log(m));
  if (!SABLONLAR[o.sablon]) throw hata("Bilinmeyen 3B şablon: " + o.sablon, "Geçerli: " + Object.keys(SABLONLAR).join(", "));
  const chrome = chromeBul(e.env);
  if (!chrome) throw hata("Chrome ya da Edge bulunamadı.", ".env'e CHROME_YOLU=<chrome.exe yolu> yaz.");
  threeKur(log);
  const W = Math.max(64, Number(o.genislik) | 0) & ~1, H = Math.max(64, Number(o.yukseklik) | 0) & ~1, fps = Number(o.fps) || 30;
  const kare = Math.max(1, Math.round(Number(o.sure) * fps));
  const parametre = Object.assign({}, SABLONLAR[o.sablon].varsayilan, o.parametre || {}, { fps, sure: Number(o.sure), model: o.model ? "/model.glb" : "" });
  const WebSocket = require("ws");
  const { sunucu: srv, port } = await sunucu(sahneHtml(o.sablon, parametre), o.model && fs.existsSync(o.model) ? o.model : "");
  const profil = fs.mkdtempSync(path.join(os.tmpdir(), "sahne3d-"));
  const proc = spawn(chrome, ["--headless=new", "--remote-debugging-port=0", "--user-data-dir=" + profil, "--no-first-run", "--no-default-browser-check", "--disable-extensions",
    "--disable-background-networking", "--disable-sync", "--mute-audio", "--hide-scrollbars", "--force-device-scale-factor=1", "--window-size=" + W + "," + H,
    "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "about:blank"], { stdio: "ignore", windowsHide: true });
  let ff = null, c = null;
  try {
    let port2 = 0;
    for (let i = 0; i < 100 && !port2; i++) { try { port2 = Number(fs.readFileSync(path.join(profil, "DevToolsActivePort"), "utf8").split("\n")[0]); } catch (x) { await bekle(100); } }
    if (!port2) throw hata("Chrome başlatılamadı.", "Açık Chrome'u kapatıp yeniden dene.", 3);
    const hedefler = await (await fetch("http://127.0.0.1:" + port2 + "/json")).json();
    const sayfa = hedefler.find(t => t.type === "page");
    c = cdp(WebSocket, sayfa.webSocketDebuggerUrl); await c.hazir;
    await c.cagir("Page.enable"); await c.cagir("Runtime.enable");
    await c.cagir("Emulation.setDeviceMetricsOverride", { width: W, height: H, deviceScaleFactor: 1, mobile: false });
    await c.cagir("Page.navigate", { url: "http://127.0.0.1:" + port + "/" });
    let hazir = false;
    for (let i = 0; i < 300 && !hazir; i++) {
      const hatali = c.olaylar.find(x => x.method === "Runtime.exceptionThrown");
      if (hatali) throw hata("3B sahnede hata: " + String((hatali.params.exceptionDetails.exception || {}).description || hatali.params.exceptionDetails.text).slice(0, 200), "Sahne parametrelerini kontrol et.", 3);
      hazir = (await c.cagir("Runtime.evaluate", { expression: "window.READY === true" })).result.value === true;
      if (!hazir) await bekle(100);
    }
    if (!hazir) throw hata("3B sahne hazır olmadı (30 sn).", "WebGL çalışmıyor olabilir; Chrome'u güncelle.", 3);
    fs.mkdirSync(path.dirname(o.cikti), { recursive: true });
    const gecici = o.cikti + ".part.mp4";
    ff = spawn(require("../ff-yol.js").ffmpeg, ["-y", "-hide_banner", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(fps), "-c:v", "mjpeg", "-i", "-",
      "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18", "-preset", "veryfast", "-r", String(fps), gecici], { stdio: ["pipe", "ignore", "pipe"], windowsHide: true });
    let ffHata = ""; ff.stderr.on("data", d => { ffHata += d; });
    const ffBitti = new Promise(coz => ff.on("close", coz));
    ff.stdin.on("error", () => { /* ffmpeg erken kapandiysa asagida kodu okunur */ });
    for (let i = 0; i < kare; i++) {
      await c.cagir("Runtime.evaluate", { expression: "window.__seek(" + (i / fps).toFixed(5) + ")" });
      const r = await c.cagir("Page.captureScreenshot", { format: "jpeg", quality: 92 });
      if (!ff.stdin.write(Buffer.from(r.data, "base64"))) await new Promise(coz => ff.stdin.once("drain", coz));
      if (i % 30 === 0) log("    3B kare " + i + "/" + kare);
    }
    ff.stdin.end();
    const kod = await ffBitti;
    if (kod !== 0 || !fs.existsSync(gecici)) throw hata("3B sahne kodlanamadı: " + ffHata.trim().split("\n").slice(-2).join(" | "), "ffmpeg çıktısına bak.", 3);
    fs.renameSync(gecici, o.cikti);
    return { cikti: o.cikti, kare };
  } finally {
    try { if (ff && !ff.killed) ff.kill(); } catch (x) { /* bitti */ }
    if (c) c.kapat();
    try { proc.kill(); } catch (x) { /* kapali */ }
    srv.close();
    await bekle(300);
    try { fs.rmSync(profil, { recursive: true, force: true }); } catch (x) { /* chrome dosyayi tutuyor olabilir */ }
  }
}

module.exports = { ciz, chromeBul, threeKur, threeHazirMi, SABLONLAR, KARAKTER_AYARLARI, THREE_SURUM, sahneHtml };
