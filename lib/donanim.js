// lib/donanim.js — makinenin donanimini olcer ve Otopilot icin bir PROFIL secer (cok-dusuk | dusuk | orta | yuksek).
//
// Neden: Otopilot'un ana hatti (Edge sesi + ucretsiz gorseller + ffmpeg) ekran karti olmadan da calisir; agir olan yalniz
// render (bellek) ve yerel yapay zeka modelleridir (VoxCPM2 ses, MuseTalk, ACE-Step). Profil bunlari makineye gore ayarlar:
//   - render: toplam bellek azsa bastan dusuk bellek profili ve az paralellik (lib/render-ffmpeg.js)
//   - VoxCPM2: CUDA motoru en az 4 GB NVIDIA bellegi ister (alexturkey/voxcpm2-turkce-ses-tasarimi 4 GB yamasi);
//     yetmiyorsa Edge'e dusulur — dakikalarca bekleyip bellek hatasi almak yerine (lib/ses-motor.js)
// Esikler docs/DUSUK_DONANIM.md'de; olculen sonuclar docs/OLCUMLER.md'de.
//
// Ezme (.env ya da ortam): DONANIM_PROFIL=cok-dusuk|dusuk|orta|yuksek  ·  VOXCPM_ZORLA=1 (bellek esigini atla)
// Olcum ucuzdur ama bedava degildir (nvidia-smi / PowerShell ~0,1-1 sn): sonuc surec boyunca onbellekte tutulur.
"use strict";
const os = require("os");
const { spawnSync } = require("child_process");

const GB = 1073741824;
const PROFILLER = ["cok-dusuk", "dusuk", "orta", "yuksek"];
// Esikler (GB). Degistirirsen docs/DUSUK_DONANIM.md tablosunu da guncelle (test/donanim.test.js karsilastirir).
const ESIK = Object.freeze({
  cokDusukRam: 6,      // toplam bellek bunun altinda: cok-dusuk
  dusukRam: 12,        // bunun altinda (ya da 4 GB'lik NVIDIA yoksa): dusuk
  yuksekRam: 24,       // yuksek icin en az bellek
  voxcpmVram: 4,       // VoxCPM2 CUDA motoru icin en az NVIDIA bellegi
  yuksekVram: 10,      // yuksek icin en az ekran karti bellegi
});

function calistir(komut, args, ms) {
  try {
    const r = spawnSync(komut, args, { encoding: "utf8", timeout: ms || 8000, windowsHide: true, stdio: ["ignore", "pipe", "ignore"] });
    return r.status === 0 ? String(r.stdout || "") : null;
  } catch (e) { return null; }
}
const yuvarla = (x, b) => (Number.isFinite(x) ? Math.round(x * Math.pow(10, b || 1)) / Math.pow(10, b || 1) : null);

function markaBul(ad) {
  const s = String(ad || "").toLowerCase();
  if (/nvidia|geforce|quadro|tesla|rtx|gtx/.test(s)) return "nvidia";
  if (/\bamd\b|radeon|advanced micro/.test(s)) return "amd";
  if (/intel|\barc\b|iris|uhd graphics|hd graphics/.test(s)) return "intel";
  if (/apple|\bm[1-9]\b/.test(s)) return "apple";
  return "diger";
}

// nvidia-smi --query-gpu=name,memory.total,memory.free,driver_version --format=csv,noheader,nounits  (MiB)
function nvidiaCoz(cikti) {
  return String(cikti || "").split(/\r?\n/).map(s => s.trim()).filter(Boolean).map(satir => {
    const [ad, toplam, bos, surucu] = satir.split(",").map(x => x.trim());
    const t = Number(toplam), b = Number(bos);
    return { marka: "nvidia", ad, vramGB: Number.isFinite(t) ? yuvarla(t / 1024) : null, bosVramGB: Number.isFinite(b) ? yuvarla(b / 1024) : null,
      surucu: surucu || null, vramKesin: Number.isFinite(t), kaynak: "nvidia-smi" };
  });
}
// Windows Win32_VideoController (JSON). AdapterRAM 32 bitliktir: 4 GB ve ustunu dogru gostermez -> vramKesin=false.
function windowsCoz(cikti) {
  let liste;
  try { liste = JSON.parse(String(cikti || "").trim() || "[]"); } catch (e) { return []; }
  if (!Array.isArray(liste)) liste = [liste];
  return liste.filter(k => k && k.Name).map(k => {
    const ram = Number(k.AdapterRAM);
    return { marka: markaBul(k.Name), ad: String(k.Name).trim(), vramGB: ram > 0 ? yuvarla(ram / GB) : null, bosVramGB: null,
      surucu: k.DriverVersion || null, vramKesin: false, kaynak: "Win32_VideoController" };
  });
}
// macOS system_profiler SPDisplaysDataType -json. Apple Silicon'da ayri ekran bellegi yok (birlesik bellek).
function macCoz(cikti) {
  let j;
  try { j = JSON.parse(String(cikti || "")); } catch (e) { return []; }
  return (j.SPDisplaysDataType || []).map(k => {
    const ad = k.sppci_model || k._name || "";
    const vram = /(\d+)\s*(GB|MB)/i.exec(String(k.spdisplays_vram || k.spdisplays_vram_shared || ""));
    const gb = vram ? Number(vram[1]) / (/mb/i.test(vram[2]) ? 1024 : 1) : null;
    return { marka: markaBul(ad + " " + (k.sppci_vendor || "")), ad, vramGB: gb, bosVramGB: null, surucu: null, vramKesin: !!vram, kaynak: "system_profiler" };
  });
}

function kartlariOlc(platform) {
  const nv = calistir("nvidia-smi", ["--query-gpu=name,memory.total,memory.free,driver_version", "--format=csv,noheader,nounits"], 8000);
  const nvidia = nv ? nvidiaCoz(nv) : [];
  let diger = [];
  if (platform === "win32") {
    const ps = calistir("powershell", ["-NoProfile", "-NonInteractive", "-Command",
      "Get-CimInstance Win32_VideoController | Select-Object Name,AdapterRAM,DriverVersion | ConvertTo-Json -Compress"], 12000);
    diger = windowsCoz(ps);
  } else if (platform === "darwin") {
    diger = macCoz(calistir("system_profiler", ["SPDisplaysDataType", "-json"], 15000));
  }
  // NVIDIA karti nvidia-smi'den kesin bilgiyle gelir; ayni kartin WMI kaydini atla
  if (nvidia.length) diger = diger.filter(k => k.marka !== "nvidia");
  // sanal/uzak masaustu bagdastiricilari ekran karti degildir
  diger = diger.filter(k => !/basic display|remote display|virtual|parsec|meta virtual|idd/i.test(k.ad));
  return [...nvidia, ...diger];
}

let onbellek = null;
// -> { platform, cpu:{ad,cekirdek}, ram:{toplamGB,bosGB}, kartlar:[{marka,ad,vramGB,bosVramGB,surucu,vramKesin,kaynak}] }
function olc(o) {
  const a = o || {};
  if (onbellek && !a.yenile && !a.kartlar) return onbellek;
  const platform = a.platform || process.platform;
  const cpus = os.cpus() || [];
  const d = {
    platform,
    cpu: { ad: (cpus[0] && cpus[0].model || "").trim(), cekirdek: cekirdekSayisi() },
    ram: { toplamGB: yuvarla(toplamBellekBayt() / GB), bosGB: yuvarla(os.freemem() / GB) },
    kartlar: a.kartlar || kartlariOlc(platform),
  };
  if (!a.kartlar) onbellek = d;
  return d;
}
const sifirla = () => { onbellek = null; };

const envOku = (env, ad) => (typeof env === "function" ? env(ad) : (env || process.env)[ad]);
const enIyiNvidia = d => (d.kartlar || []).filter(k => k.marka === "nvidia" && k.vramGB != null).sort((x, y) => y.vramGB - x.vramGB)[0] || null;

// VoxCPM2 bu donanimda calisir mi? backend: ayarlar.json'daki "backend" (cuda | vulkan).
// -> { ok, neden }
function voxcpmUygun(d, backend, env) {
  if (/^(1|evet|true)$/i.test(String(envOku(env, "VOXCPM_ZORLA") || ""))) return { ok: true, neden: "VOXCPM_ZORLA=1" };
  const b = String(backend || "cuda").toLowerCase();
  if (b === "vulkan") {
    const kart = (d.kartlar || []).find(k => ["nvidia", "amd", "intel"].includes(k.marka));
    return kart ? { ok: true, neden: "Vulkan motoru (deneysel): " + kart.ad } : { ok: false, neden: "Vulkan motoru için ekran kartı bulunamadı" };
  }
  const nv = enIyiNvidia(d);
  if (!nv) return { ok: false, neden: "NVIDIA ekran kartı bulunamadı (VoxCPM2 CUDA motoru NVIDIA ister; AMD/Intel için Vulkan motoru kurulabilir)" };
  if (nv.vramGB < ESIK.voxcpmVram)
    return { ok: false, neden: `${nv.ad} belleği ${nv.vramGB} GB; VoxCPM2 en az ${ESIK.voxcpmVram} GB ister (zorlamak için VOXCPM_ZORLA=1)` };
  return { ok: true, neden: `${nv.ad}, ${nv.vramGB} GB` };
}

// Saf fonksiyon (testlenir). d = olc() ciktisi. -> { ad, neden, renderBellek 0|1|2, paralelMax, voxcpm:{ok,neden}, ozet:[...] }
function profilSec(d, env) {
  const ram = (d.ram && d.ram.toplamGB) || 0;
  const nv = enIyiNvidia(d);
  const vram = nv ? nv.vramGB : 0;
  const zorla = String(envOku(env, "DONANIM_PROFIL") || "").trim().toLowerCase();
  let ad, neden;
  if (PROFILLER.includes(zorla)) { ad = zorla; neden = "DONANIM_PROFIL=" + zorla; }
  else if (ram < ESIK.cokDusukRam) { ad = "cok-dusuk"; neden = `toplam bellek ${ram} GB (< ${ESIK.cokDusukRam} GB)`; }
  else if (ram < ESIK.dusukRam || vram < ESIK.voxcpmVram) {
    ad = "dusuk";
    neden = ram < ESIK.dusukRam ? `toplam bellek ${ram} GB (< ${ESIK.dusukRam} GB)` : (nv ? `${nv.ad} ${vram} GB (< ${ESIK.voxcpmVram} GB)` : "NVIDIA ekran kartı yok");
  } else if (ram >= ESIK.yuksekRam && vram >= ESIK.yuksekVram) { ad = "yuksek"; neden = `${ram} GB bellek, ${nv.ad} ${vram} GB`; }
  else { ad = "orta"; neden = `${ram} GB bellek, ${nv.ad} ${vram} GB`; }
  const ayar = {
    "cok-dusuk": { renderBellek: 2, paralelMax: 1 },
    "dusuk": { renderBellek: ram < 8 ? 1 : 0, paralelMax: 2 },
    "orta": { renderBellek: 0, paralelMax: 3 },
    "yuksek": { renderBellek: 0, paralelMax: 4 },
  }[ad];
  const voxcpm = ad === "cok-dusuk" && !/^(1|evet|true)$/i.test(String(envOku(env, "VOXCPM_ZORLA") || ""))
    ? { ok: false, neden: "çok düşük profil (bellek yetmez); Edge sesi kullanılır" } : voxcpmUygun(d, "cuda", env);
  const ozet = [
    "Ana hat (Edge sesi, ücretsiz görseller, ffmpeg): açık",
    "Render: " + (ayar.renderBellek === 2 ? "en az bellek, klipler tek tek" : ayar.renderBellek === 1 ? "düşük bellek" : "normal") + ", en çok " + ayar.paralelMax + " paralel iş",
    "Ekran kartıyla video kodlama: " + ((d.kartlar || []).some(k => ["nvidia", "amd"].includes(k.marka)) ? "denenir (hata olursa işlemciye geçilir)" : "yok, işlemci (libx264)"),
    "VoxCPM2 yerel ses: " + (voxcpm.ok ? "uygun" : "kapalı — " + voxcpm.neden),
  ];
  return Object.assign({ ad, neden, voxcpm, ozet }, ayar);
}

// Render icin yalniz BELLEK tabanli kisitlar (ekran karti olcmeden, anlik): os.totalmem
function renderKisiti(env) {
  const p = profilSec({ ram: { toplamGB: yuvarla(toplamBellekBayt() / GB) }, kartlar: [{ marka: "nvidia", ad: "-", vramGB: 99 }] }, env);
  return { renderBellek: p.renderBellek, paralelMax: p.paralelMax, profil: p.ad, neden: p.neden };
}

// Anlik (olcumsuz) makine ozeti: toplam bellek + mantiksal cekirdek. Testler os.totalmem / os.cpus'u sahteleyebilir.
// Konteyner/sanal makinede os.totalmem() ve os.cpus() SUNUCUNUN tamamini gosterir: 2 GB'lik Docker kendini 64 GB sanardi.
// process.constrainedMemory() (cgroup bellek siniri) ve os.availableParallelism() (cpuset/affinity) gercek siniri verir.
function toplamBellekBayt() {
  const t = os.totalmem();
  let c = 0;
  try { c = typeof process.constrainedMemory === "function" ? Number(process.constrainedMemory()) || 0 : 0; } catch (e) { c = 0; }
  return c > 0 && c < t ? c : t;
}
function cekirdekSayisi() {
  try { if (typeof os.availableParallelism === "function") return Math.max(1, os.availableParallelism()); } catch (e) { /* eski node */ }
  return Math.max(1, (os.cpus() || []).length);
}
const anlik = () => ({ ramGB: toplamBellekBayt() / GB, cekirdek: cekirdekSayisi() });
const ezilenProfil = env => { const z = String(envOku(env, "DONANIM_PROFIL") || "").trim().toLowerCase(); return PROFILLER.includes(z) ? z : null; };
const evetMi = v => /^(1|evet|true|acik|açık|on)$/i.test(String(v || "").trim());
const hayirMi = v => /^(0|hayir|hayır|false|kapali|kapalı|off)$/i.test(String(v || "").trim());

// Hafif render: donanim kodlayicisi yokken (lib/render-ffmpeg.js) final libx264 "veryfast". Zayif makinede: <= 4 mantiksal cekirdek
// (2 cekirdek + hyperthreading) ya da < 12 GB bellek. RENDER_HAFIF=1/0 ezer. -> { ok, neden }
function hafifRender(env) {
  const v = envOku(env, "RENDER_HAFIF");
  if (evetMi(v)) return { ok: true, neden: "RENDER_HAFIF=1" };
  if (hayirMi(v)) return { ok: false, neden: "RENDER_HAFIF=0" };
  const z = ezilenProfil(env);
  if (z) return z === "cok-dusuk" || z === "dusuk" ? { ok: true, neden: "DONANIM_PROFIL=" + z } : { ok: false, neden: "DONANIM_PROFIL=" + z };
  const a = anlik();
  if (a.cekirdek <= 4) return { ok: true, neden: a.cekirdek + " mantıksal çekirdek" };
  if (a.ramGB < ESIK.dusukRam) return { ok: true, neden: Math.round(a.ramGB) + " GB bellek" };
  return { ok: false, neden: "" };
}

// Zaman asimi carpani (1-3): ayni ffmpeg adimi yavas makinede uzun surer; sabit sure orada isi yarida keserdi.
// ZAMAN_ASIMI_CARPANI (1-10) ezer.
function zamanCarpani(env) {
  const z = Number(envOku(env, "ZAMAN_ASIMI_CARPANI"));
  if (Number.isFinite(z) && z >= 1) return Math.min(10, z);
  const ez = ezilenProfil(env);
  if (ez) return ez === "cok-dusuk" ? 3 : ez === "dusuk" ? 2 : 1;
  const a = anlik();
  if (a.cekirdek <= 2 || a.ramGB < ESIK.cokDusukRam) return 3;
  if (a.cekirdek <= 4 || a.ramGB < 8) return 2;
  return 1;
}

// Render cozunurluk carpani: cok-dusuk profilde 720p (1080x1920 -> 720x1280; YouTube Shorts kabul eder), digerlerinde tam.
// RENDER_COZUNURLUK=720|1080 ezer. -> { olcek, neden }
function cozunurlukOlcek(env) {
  const v = String(envOku(env, "RENDER_COZUNURLUK") || "").trim();
  if (v === "720") return { olcek: 2 / 3, neden: "RENDER_COZUNURLUK=720" };
  if (v === "1080") return { olcek: 1, neden: "RENDER_COZUNURLUK=1080" };
  const k = renderKisiti(env);
  return k.profil === "cok-dusuk" ? { olcek: 2 / 3, neden: "çok düşük profil (" + k.neden + "): 720p" } : { olcek: 1, neden: "" };
}

module.exports = { toplamBellekBayt, cekirdekSayisi, olc, sifirla, profilSec, voxcpmUygun, renderKisiti, hafifRender, zamanCarpani, cozunurlukOlcek, markaBul, nvidiaCoz, windowsCoz, macCoz, PROFILLER, ESIK };
