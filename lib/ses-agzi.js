// Sesten agiz acikligi egrisi: ses dosyasi -> kare basina 0..1 (3B karakterin dudak hareketi). ffmpeg ile, yerel, ucretsiz.
// Kare basina RMS (dB) olculur; 0..1'e esitlenir, kisa atak/yavas birakma ile yumusatilir (agiz titremesin).
// Fikir: motionforge tools/mouth_curve.py; kod bu depoda yeniden yazildi.
"use strict";
const { spawnSync } = require("child_process");

// dB -> 0..1: -48 dB ve alti kapali, -16 dB ve ustu tam acik
const esle = db => (Number.isFinite(db) ? Math.min(1, Math.max(0, (db + 48) / 32)) : 0);

function yumusat(degerler) {
  const cikti = []; let onceki = 0;
  for (const v of degerler) {
    const hedef = v < 0.08 ? 0 : v;                                       // sessizlikte kapat
    onceki = hedef > onceki ? onceki + (hedef - onceki) * 0.75 : onceki + (hedef - onceki) * 0.35;   // hizli ac, yavas kapa
    cikti.push(Math.round(onceki * 1000) / 1000);
  }
  return cikti;
}

// dosya: ses/video yolu, fps: kare hizi -> [0..1]
function agizEgrisi(dosya, fps, enj) {
  const hz = 16000, n = Math.max(1, Math.round(hz / (fps || 30)));
  const ffmpeg = (enj && enj.ffmpeg) || require("../ff-yol.js").ffmpeg;
  const r = spawnSync(ffmpeg, ["-hide_banner", "-nostats", "-i", dosya, "-vn", "-af",
    "aresample=" + hz + ",asetnsamples=n=" + n + ":p=0,astats=metadata=1:reset=1,ametadata=print:key=lavfi.astats.Overall.RMS_level:file=-", "-f", "null", "-"],
    { encoding: "utf8", windowsHide: true, maxBuffer: 1 << 28 });
  if (r.status !== 0) throw Object.assign(new Error("Ses analizi başarısız: " + String(r.stderr || "").trim().split("\n").slice(-2).join(" | ")), { cikis: 3 });
  const dbler = [];
  for (const satir of String(r.stdout).split(/\r?\n/)) {
    const m = /lavfi\.astats\.Overall\.RMS_level=(-?[\d.]+|-inf|inf|nan)/.exec(satir);
    if (m) dbler.push(Number(m[1]));
  }
  if (!dbler.length) throw Object.assign(new Error("Seste ölçülecek veri yok."), { cikis: 2 });
  return yumusat(dbler.map(esle));
}

module.exports = { agizEgrisi, esle, yumusat };
