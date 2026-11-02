// Yerel yuz degistirme (FaceFusion). Kullanicinin KENDI makinesinde calisir; bu depo FaceFusion'i indirmez/calistirmaz baska kod icermez.
// Kurulum: github.com/facefusion/facefusion -> kendi .venv'i + onnxruntime-gpu; .env'e FACEFUSION_KOK=<klasor>.
// Cok yuzlu pozda (cift) her kisi AYRI gecis: soldan saga sirayla, kisi i -> poz yuzu i (FaceFusion birden cok kaynagi ORTALAR, o yuzden tek tek).
// Lisans/rıza: FaceFusion OpenRAIL-AS; yalniz kendi yuzun ya da yazili izin verilen kisi (studyo.js bunu `riza` onayi olmadan calistirmaz).
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const ortak = require("./ortak.js");

const hata = (m, c) => Object.assign(new Error(m), { cikis: 2, cozum: c });
const BASLATICI = path.join(__dirname, "..", "araclar", "klon-video", "yuz-degistir.py");   // CUDA DLL'lerini onden yukler

function kokBul(env) {
  const oku = env || ortak.envOku;
  const kok = oku("FACEFUSION_KOK");
  if (!kok) throw hata("FACEFUSION_KOK tanımlı değil.", "FaceFusion'ı kur (github.com/facefusion/facefusion, kendi .venv'iyle) ve .env'e FACEFUSION_KOK=<klasör> yaz.");
  if (!fs.existsSync(path.join(kok, "facefusion.py"))) throw hata("FaceFusion bulunamadı: " + kok, "FACEFUSION_KOK, facefusion.py'nin durduğu klasör olmalı.");
  const py = process.platform === "win32" ? path.join(kok, ".venv", "Scripts", "python.exe") : path.join(kok, ".venv", "bin", "python");
  if (!fs.existsSync(py)) throw hata("FaceFusion'ın .venv'i yok: " + py, "FaceFusion klasöründe: python -m venv .venv ve python install.py cuda@13 --skip-conda (ya da default).");
  return { kok, py };
}

// tek gecis icin FaceFusion argumanlari (saf; testlenir)
function gecisArgumanlari(o) {
  const a = [BASLATICI, "headless-run", "--processors", "face_swapper", "-s", o.kaynak, "-t", o.hedef, "-o", o.cikti,
    "--face-selector-order", "left-right", "--execution-providers", o.saglayici || "cuda"];
  if (o.model) a.push("--face-swapper-model", o.model);
  if (o.cokYuz) a.push("--face-selector-mode", "reference", "--reference-face-position", String(o.sira));
  else a.push("--face-selector-mode", "one");
  return a;
}

function calistirVarsayilan(py, argv, cwd) {
  // baslatici bu depodan calisir, FaceFusion paketi ise cwd altinda: PYTHONPATH ile gorunur olur
  const r = spawnSync(py, argv, { cwd, env: Object.assign({}, process.env, { PYTHONPATH: cwd }), encoding: "utf8", windowsHide: true, timeout: 15 * 60 * 1000, maxBuffer: 1 << 26 });
  return { durum: r.status, hata: String(r.stderr || "") + String(r.stdout || "").slice(-400) };
}

// sablon: poz fotografi; kisiler: soldan saga kaynak yuzler; cikti: .jpg/.png. -> cikti yolu
function degistir(o, enj) {
  const e = enj || {};
  const log = e.log || (m => console.log(m));
  const { kok, py } = kokBul(e.env);
  if (!o.kisiler || !o.kisiler.length) throw hata("En az bir kişi fotoğrafı gerekli.");
  if (o.kisiler.length > 4) throw hata("En çok 4 kişi.");
  const calistir = e.calistir || calistirVarsayilan;
  const oku = e.env || ortak.envOku;
  const model = oku("FACEFUSION_MODEL") || "";
  let saglayici = oku("FACEFUSION_SAGLAYICI") || "cuda";
  const ara = fs.mkdtempSync(path.join(os.tmpdir(), "yuz-"));
  try {
    let hedef = o.sablon;
    o.kisiler.forEach((kisi, i) => {
      const cikti = path.join(ara, "gecis-" + (i + 1) + path.extname(o.cikti));
      const arg = () => gecisArgumanlari({ kaynak: kisi, hedef, cikti, sira: i, cokYuz: o.kisiler.length > 1, saglayici, model });
      log("  yüz " + (i + 1) + "/" + o.kisiler.length + " değiştiriliyor (" + saglayici + ")…");
      let r = calistir(py, arg(), kok);
      if (r.durum !== 0 && saglayici !== "cpu") { log("  ! " + saglayici + " başarısız, işlemciyle yeniden deneniyor"); saglayici = "cpu"; r = calistir(py, arg(), kok); }
      if (r.durum !== 0 || !fs.existsSync(cikti)) throw hata("Yüz değiştirme başarısız oldu (" + String(r.hata || "").trim().split("\n").slice(-2).join(" | ").slice(0, 200) + ").", "Fotoğraflarda yüz net görünüyor mu? Poz fotoğrafında en az " + o.kisiler.length + " yüz olmalı.");
      hedef = cikti;
    });
    fs.mkdirSync(path.dirname(o.cikti), { recursive: true });
    fs.copyFileSync(hedef, o.cikti + ".part");
    fs.renameSync(o.cikti + ".part", o.cikti);
    return o.cikti;
  } finally { try { fs.rmSync(ara, { recursive: true, force: true }); } catch (x) { /* gecici klasor */ } }
}

module.exports = { degistir, gecisArgumanlari, kokBul, BASLATICI };
