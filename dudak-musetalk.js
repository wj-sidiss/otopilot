// MuseTalk dudak senkronu sarmalayicisi (film.js --dudak icin). MuseTalk'i bu depo INDIRMEZ/KURMAZ; kullanici kurar, bu betik onu cagirir.
//   .env:  MUSETALK_KOK=C:\musetalk            (git clone https://github.com/TMElyralab/MuseTalk ; resmi kurulum + download_weights.bat)
//          MUSETALK_PYTHON=C:\musetalk\.venv\Scripts\python.exe   (bos = KOK\.venv\Scripts\python.exe, sonra PATH'teki python)
//          DUDAK_KOMUT=node dudak-musetalk.js --video {video} --ses {ses} --cikti {cikti}
//   node dudak-musetalk.js --kontrol            kurulum + GPU/torch uyumunu denetler, bir sey uretmez
// MuseTalk komut satirinda video/ses almaz; configs yaml'i gerekir: gecici bir yaml yazilir, scripts.inference calistirilir, sonuc kopyalanir.
// Lisans: MuseTalk kodu MIT, agirliklar "her amac icin" (ticari dahil); whisper, sd-vae, dwpose, S3FD kendi lisanslariyla gelir.
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const ortak = require("./lib/ortak.js");

const hata = (m, c) => Object.assign(new Error(m), { cikis: 2, cozum: c });

function pythonBul(kok, env) {
  const aday = [env("MUSETALK_PYTHON"), path.join(kok, ".venv", "Scripts", "python.exe"), path.join(kok, ".venv", "bin", "python"), path.join(kok, "venv", "Scripts", "python.exe")]
    .filter(Boolean).find(p => fs.existsSync(p));
  return aday || "python";
}

// torch + CUDA mimarisi: RTX 50 (Blackwell, sm_120) icin torch >= 2.7 + cu128 gerekir; MuseTalk'in sabit torch 2.0.1 / cu118'i orada CALISMAZ
function gpuKontrol(python, kok, calistir) {
  const r = (calistir || spawnSync)(python, ["-c", "import torch,json;print(json.dumps({'s':torch.__version__,'cuda':torch.cuda.is_available(),'arch':torch.cuda.get_arch_list(),'kart':torch.cuda.get_device_name(0) if torch.cuda.is_available() else ''}))"],
    { cwd: kok, encoding: "utf8", windowsHide: true, timeout: 120000 });
  if (r.status !== 0) return { ok: false, neden: "torch yuklenemedi: " + String(r.stderr || "").trim().split("\n").pop() };
  let b; try { b = JSON.parse(String(r.stdout).trim().split("\n").pop()); } catch (e) { return { ok: false, neden: "torch ciktisi okunamadi" }; }
  if (!b.cuda) return { ok: false, neden: "CUDA gorunmuyor (torch " + b.s + "): GPU'suz calisir ama cok yavas", bilgi: b };
  const kartMi = /RTX\s*50\d\d/i.test(b.kart || "");
  if (kartMi && !(b.arch || []).some(a => /sm_120|compute_120/.test(a)))
    return { ok: false, neden: b.kart + " (Blackwell, sm_120) icin bu torch (" + b.s + ") derlenmemis: torch >= 2.7 cu128 gerekir; MuseTalk'in sabit torch 2.0.1 / cu118 surumu bu kartta calismaz.", bilgi: b };
  return { ok: true, bilgi: b };
}

function kurulumKontrol(env, calistir) {
  const kok = env("MUSETALK_KOK");
  if (!kok) throw hata("MUSETALK_KOK tanımlı değil.", "MuseTalk'ı kur (git clone https://github.com/TMElyralab/MuseTalk + download_weights.bat) ve .env'e MUSETALK_KOK=<klasör> yaz.");
  if (!fs.existsSync(path.join(kok, "scripts", "inference.py"))) throw hata("MUSETALK_KOK içinde scripts/inference.py yok: " + kok, "Klasör MuseTalk deposunun kökü olmalı.");
  for (const m of [path.join("models", "musetalkV15", "unet.pth"), path.join("models", "musetalkV15", "musetalk.json")])
    if (!fs.existsSync(path.join(kok, m))) throw hata("MuseTalk ağırlığı eksik: " + m, "MuseTalk klasöründe download_weights.bat (Linux: download_weights.sh) çalıştır.");
  const python = pythonBul(kok, env);
  return { kok, python, gpu: gpuKontrol(python, kok, calistir) };
}

// video + ses -> dudak senkronlu video (cikti). calistir/env enjekte edilebilir (test).
function uret(o, bag) {
  const b = bag || {};
  const env = b.env || ortak.envOku;
  const calistir = b.calistir || spawnSync;
  const k = kurulumKontrol(env, calistir);
  if (!k.gpu.ok && !/GPU'suz/.test(k.gpu.neden)) throw hata("MuseTalk bu makinede çalışamaz: " + k.gpu.neden, "Çözüm: uyumlu PyTorch (cu128) ile ayrı bir ortam kur, MUSETALK_PYTHON'u ona yönelt; ya da dudak senkronunu bulut GPU'da çalıştır.");
  if (!fs.existsSync(o.video)) throw hata("Video yok: " + o.video);
  if (!fs.existsSync(o.ses)) throw hata("Ses yok: " + o.ses);
  const gecici = fs.mkdtempSync(path.join(os.tmpdir(), "musetalk-"));
  const sonuc = path.join(gecici, "sonuc");
  const yaml = path.join(gecici, "is.yaml");
  // YAML'da yol: tek tirnakli, ters bolu cift (Windows)
  const q = p => "'" + String(p).replace(/'/g, "''") + "'";
  fs.writeFileSync(yaml, "task_0:\n  video_path: " + q(o.video) + "\n  audio_path: " + q(o.ses) + "\n");
  const ffmpegDizin = path.dirname(b.ffmpeg || require("./ff-yol.js").ffmpeg);
  const args = ["-m", "scripts.inference", "--inference_config", yaml, "--result_dir", sonuc,
    "--unet_model_path", path.join("models", "musetalkV15", "unet.pth"), "--unet_config", path.join("models", "musetalkV15", "musetalk.json"),
    "--version", "v15", "--ffmpeg_path", ffmpegDizin];
  const r = calistir(k.python, args, { cwd: k.kok, encoding: "utf8", windowsHide: true, timeout: 30 * 60 * 1000, maxBuffer: 1 << 26 });
  try {
    if (r.status !== 0) throw hata("MuseTalk başarısız (kod " + r.status + "): " + String(r.stderr || r.error || "").trim().split("\n").slice(-3).join(" | "));
    const bul = d => { let en = null; (function gez(x) { for (const f of fs.readdirSync(x, { withFileTypes: true })) { const y = path.join(x, f.name); if (f.isDirectory()) gez(y); else if (/\.mp4$/i.test(f.name) && (!en || fs.statSync(y).mtimeMs > fs.statSync(en).mtimeMs)) en = y; } })(d); return en; };
    const cikti = fs.existsSync(sonuc) ? bul(sonuc) : null;
    if (!cikti) throw hata("MuseTalk çıktı videosu üretmedi: " + sonuc);
    fs.mkdirSync(path.dirname(o.cikti), { recursive: true });
    fs.copyFileSync(cikti, o.cikti);
    return o.cikti;
  } finally { try { fs.rmSync(gecici, { recursive: true, force: true }); } catch (e) { /* yoksay */ } }
}

function calistirCli(args) {
  const d = a => { const i = args.indexOf("--" + a); return i >= 0 ? args[i + 1] : undefined; };
  if (args.includes("--kontrol")) {
    const k = kurulumKontrol(ortak.envOku);
    console.log("MuseTalk: " + k.kok + "\npython : " + k.python + "\nGPU    : " + (k.gpu.ok ? "uyumlu (" + k.gpu.bilgi.kart + ", torch " + k.gpu.bilgi.s + ")" : "SORUN — " + k.gpu.neden));
    return k.gpu.ok ? 0 : 3;
  }
  if (!d("video") || !d("ses") || !d("cikti")) throw hata("Kullanım: node dudak-musetalk.js --video <mp4> --ses <ses> --cikti <mp4>   (ya da --kontrol)");
  console.log("✓ " + uret({ video: d("video"), ses: d("ses"), cikti: d("cikti") }));
  return 0;
}

if (require.main === module) {
  try { process.exit(calistirCli(process.argv.slice(2))); }
  catch (e) { console.error("✗ " + e.message + (e.cozum ? "\n  ↳ " + e.cozum : "")); process.exit(e.cikis || 1); }
}
module.exports = { uret, kurulumKontrol, gpuKontrol, pythonBul };
