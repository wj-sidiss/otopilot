// Ucretsiz medya araclari (yalniz ffmpeg; yeni bagimlilik yok):
//   sessizlikKes  - konusma kaydindaki sessiz bosluklari keser (auto-editor'un yaptigi isin ffmpeg ile sade hali)
//   sahneBul      - videodaki sahne/plan degisimlerini bulur (PySceneDetect'in "icerik" kipinin ffmpeg `scene` skoru ile karsiligi)
//   yukselt       - resmi/videoyu buyutur (lanczos + hafif keskinlestirme); REALESRGAN_KOK varsa resimde Real-ESRGAN kullanir
// Ilham ve atif: docs/KAYNAKLAR.md. Komut satiri: araclar/medya.js
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const FF = require("../ff-yol");
const { OrtakHata, CIKIS } = require("./ortak");

const hata = (kod, msg, cozum) => new OrtakHata(kod, msg, { cikis: CIKIS.GIRDI, cozum });

function ffcalistir(args, o) {
  const r = spawnSync(FF.ffmpeg, args, Object.assign({ encoding: "utf8", maxBuffer: 1 << 28 }, o));
  if (r.error) throw hata("ffmpeg_calismadi", "ffmpeg çalıştırılamadı: " + r.error.message);
  return r;
}
function sureOku(dosya) {
  const r = spawnSync(FF.ffprobe, ["-v", "error", "-show_entries", "format=duration:stream=codec_type", "-of", "json", dosya], { encoding: "utf8" });
  if (r.status !== 0) throw hata("girdi_okunamadi", "Dosya okunamadı: " + dosya, "Dosya yolunu ve biçimini kontrol et.");
  const j = JSON.parse(r.stdout || "{}");
  return { sure: parseFloat(j.format && j.format.duration) || 0, video: (j.streams || []).some(s => s.codec_type === "video"), ses: (j.streams || []).some(s => s.codec_type === "audio") };
}
function varMi(dosya) { if (!dosya || !fs.existsSync(dosya)) throw hata("girdi_yok", "Dosya yok: " + dosya, "Dosya yolunu kontrol et."); return path.resolve(dosya); }

// ---- sessizlik ----------------------------------------------------------------------------------------------
function sessizlikleriOku(metin) {
  const out = []; let bas = null;
  for (const m of String(metin).matchAll(/silence_(start|end):\s*(-?[\d.]+)/g)) {
    const t = parseFloat(m[2]);
    if (m[1] === "start") bas = Math.max(0, t); else if (bas !== null) { out.push([bas, t]); bas = null; }
  }
  if (bas !== null) out.push([bas, Infinity]);                       // dosya sessizlikle bitiyor
  return out;
}
// sessizlikleri "pay" kadar daralt (kelime basi/sonu kirpilmasin), kalan parcalari dondur
function tutulanParcalar(sessizlikler, toplam, pay) {
  const kes = [];
  for (const [a, b0] of sessizlikler) {
    const b = Math.min(b0, toplam), x = a + pay, y = b - pay;
    if (y - x > 0.02) kes.push([x, y]);
  }
  const tut = []; let imlec = 0;
  for (const [x, y] of kes) { if (x > imlec + 0.01) tut.push([imlec, x]); imlec = y; }
  if (toplam - imlec > 0.01) tut.push([imlec, toplam]);
  return tut;
}
function filtreBetigi(tut, video, ses) {
  const satir = []; const n = tut.length; const etiket = [];
  tut.forEach(([a, b], i) => {
    if (video) { satir.push(`[0:v]trim=start=${a.toFixed(3)}:end=${b.toFixed(3)},setpts=PTS-STARTPTS[v${i}]`); etiket.push(`[v${i}]`); }
    if (ses) { satir.push(`[0:a]atrim=start=${a.toFixed(3)}:end=${b.toFixed(3)},asetpts=PTS-STARTPTS[a${i}]`); etiket.push(`[a${i}]`); }
  });
  satir.push(`${etiket.join("")}concat=n=${n}:v=${video ? 1 : 0}:a=${ses ? 1 : 0}${video ? "[vo]" : ""}${ses ? "[ao]" : ""}`);
  return satir.join(";\n");
}
// Denenecek filtre argumanlari (sirayla). Windows komut satiri siniri ~32 bin karakter: 20 binin altindaki filtre dogrudan gecer.
function filtreArgumanlari(filtre, dosya) {
  if (filtre.length <= 20000) return [["-filter_complex", filtre]];
  return [["-filter_complex_script", dosya], ["-/filter_complex", dosya]];
}
function sessizlikKes(girdi, o) {
  o = Object.assign({ esik: -35, sure: 0.4, pay: 0.08, sadeceRapor: false, cikti: null }, o || {});
  girdi = varMi(girdi); const b = sureOku(girdi);
  if (!b.ses) throw hata("ses_yok", "Dosyada ses yok; sessizlik bulunamaz.", "Sesli bir video ya da ses dosyası ver.");
  const tara = ffcalistir(["-hide_banner", "-nostats", "-i", girdi, "-vn", "-af", `silencedetect=noise=${o.esik}dB:d=${o.sure}`, "-f", "null", "-"]);
  const sess = sessizlikleriOku(tara.stderr);
  const tut = tutulanParcalar(sess, b.sure, o.pay);
  const sonraki = tut.reduce((s, [x, y]) => s + (y - x), 0);
  const rapor = { once: +b.sure.toFixed(2), sonra: +sonraki.toFixed(2), kesilen: +(b.sure - sonraki).toFixed(2), sessizlik: sess.length, parca: tut.length, cikti: null };
  if (o.sadeceRapor || !tut.length || tut.length === 1 && tut[0][0] < 0.02 && tut[0][1] > b.sure - 0.02) return rapor;
  const cikti = path.resolve(o.cikti || girdi.replace(/(\.[^.\\/]+)?$/, "-kesik$1"));
  const filtre = filtreBetigi(tut, b.video, b.ses);
  const klasor = fs.mkdtempSync(path.join(os.tmpdir(), "sessizlik-")), betik = path.join(klasor, "filtre.txt");
  fs.writeFileSync(betik, filtre);
  const map = [].concat(b.video ? ["-map", "[vo]"] : [], ["-map", "[ao]"]);
  const kod = b.video ? ["-c:v", "libx264", "-crf", "18", "-preset", "medium", "-pix_fmt", "yuv420p"] : [];
  const son = ["-c:a", /\.(wav|flac)$/i.test(cikti) ? "pcm_s16le" : "aac", "-b:a", "192k", cikti];
  let r;
  // Filtre kisaysa dogrudan verilir (her ffmpeg surumunde calisir); uzunsa dosyadan: eski ffmpeg `-filter_complex_script`, yeni ffmpeg (7.1+) `-/filter_complex` ister.
  for (const f of filtreArgumanlari(filtre, betik)) {
    r = ffcalistir(["-hide_banner", "-v", "error", "-y", "-i", girdi, ...f, ...map, ...kod, ...son]);
    if (r.status === 0 || !/Option not found|Unrecognized option|Error splitting the argument list/i.test(r.stderr || "")) break;
  }
  fs.rmSync(klasor, { recursive: true, force: true });
  if (r.status !== 0) throw new OrtakHata("ffmpeg_hata", "Kesme başarısız: " + (r.stderr || "").trim().split("\n").pop(), { cikis: CIKIS.GENEL });
  rapor.cikti = cikti; return rapor;
}

// ---- sahne bulma ----------------------------------------------------------------------------------------------
function sahneZamanlariniOku(metin) {
  const t = []; for (const m of String(metin).matchAll(/pts_time:\s*([\d.]+)/g)) t.push(parseFloat(m[1]));
  return t.sort((a, b) => a - b);
}
function sahneParcalari(kesimler, toplam, enAz) {
  const sinir = [0]; for (const t of kesimler) if (t - sinir[sinir.length - 1] >= enAz && toplam - t >= enAz) sinir.push(t);
  sinir.push(toplam);
  return sinir.slice(0, -1).map((a, i) => ({ no: i + 1, bas: +a.toFixed(3), son: +sinir[i + 1].toFixed(3), sure: +(sinir[i + 1] - a).toFixed(3) }));
}
function sahneBul(girdi, o) {
  o = Object.assign({ esik: 0.3, enAz: 1.0, kes: null }, o || {});
  girdi = varMi(girdi); const b = sureOku(girdi);
  if (!b.video) throw hata("video_yok", "Dosyada görüntü yok.", "Bir video dosyası ver.");
  const r = ffcalistir(["-hide_banner", "-nostats", "-i", girdi, "-an", "-vf", `select='gt(scene,${o.esik})',showinfo`, "-f", "null", "-"]);
  const sahneler = sahneParcalari(sahneZamanlariniOku(r.stderr), b.sure, o.enAz);
  if (o.kes) {
    const klasor = path.resolve(o.kes); fs.mkdirSync(klasor, { recursive: true });
    for (const s of sahneler) {
      s.dosya = path.join(klasor, "sahne-" + String(s.no).padStart(3, "0") + ".mp4");
      const k = ffcalistir(["-hide_banner", "-v", "error", "-y", "-ss", String(s.bas), "-i", girdi, "-t", String(s.sure), "-c:v", "libx264", "-crf", "18", "-pix_fmt", "yuv420p", "-c:a", "aac", s.dosya]);
      if (k.status !== 0) throw new OrtakHata("ffmpeg_hata", "Sahne kesilemedi: " + s.no, { cikis: CIKIS.GENEL });
    }
  }
  return { sure: +b.sure.toFixed(2), esik: o.esik, sahneler };
}

// ---- yukseltme ----------------------------------------------------------------------------------------------
function yukselt(girdi, o) {
  o = Object.assign({ olcek: 2, cikti: null, yapayZeka: true }, o || {});
  if (![2, 3, 4].includes(+o.olcek)) throw hata("olcek_gecersiz", "Ölçek 2, 3 ya da 4 olmalı.");
  girdi = varMi(girdi); const b = sureOku(girdi);
  const resim = /\.(png|jpe?g|webp|bmp)$/i.test(girdi);
  const cikti = path.resolve(o.cikti || girdi.replace(/(\.[^.\\/]+)$/, `-x${o.olcek}$1`));
  const exe = process.env.REALESRGAN_KOK && path.join(process.env.REALESRGAN_KOK, process.platform === "win32" ? "realesrgan-ncnn-vulkan.exe" : "realesrgan-ncnn-vulkan");
  if (resim && o.yapayZeka && exe && fs.existsSync(exe)) {      // opsiyonel yapay zeka yolu (kullanicinin kendi kurulumu; Otopilot indirmez)
    const r = spawnSync(exe, ["-i", girdi, "-o", cikti, "-n", "realesrgan-x4plus", "-s", String(o.olcek)], { cwd: path.dirname(exe), encoding: "utf8" });
    if (r.status === 0 && fs.existsSync(cikti)) return { cikti, yontem: "realesrgan", olcek: +o.olcek };
  }
  const vf = `scale=iw*${o.olcek}:ih*${o.olcek}:flags=lanczos,unsharp=5:5:0.6:5:5:0.0`;
  const args = ["-hide_banner", "-v", "error", "-y", "-i", girdi, "-vf", vf];
  if (!resim && b.video) args.push("-c:v", "libx264", "-crf", "17", "-pix_fmt", "yuv420p", "-c:a", "copy");
  args.push(cikti);
  const r = ffcalistir(args);
  if (r.status !== 0) throw new OrtakHata("ffmpeg_hata", "Yükseltme başarısız: " + (r.stderr || "").trim().split("\n").pop(), { cikis: CIKIS.GENEL });
  return { cikti, yontem: "lanczos", olcek: +o.olcek };
}

module.exports = { sessizlikKes, sahneBul, yukselt, sessizlikleriOku, tutulanParcalar, filtreBetigi, filtreArgumanlari, sahneZamanlariniOku, sahneParcalari };
