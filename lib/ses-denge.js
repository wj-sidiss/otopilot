// SES DENGESI: tek yayin standardi (-14 LUFS), olcum ve duzeltme.
//  * HEDEF: Shorts/Reels/TikTok/YouTube icin -14 LUFS entegre, tepe <= -1.5 dBTP. Tum betikler seviyeyi BURADAN alir.
//  * analiz(): bitmis videonun sesinde konusmanin ustune cikan "patlamalari" (ses efekti/muzik tepeleri) bulur.
//  * duzelt(): patlamalari tutar (sikistirma + limiter) ve iki gecisli loudnorm ile -14 LUFS'a hizalar; goruntu aynen kopyalanir.
//  * efektBusu(): ses efekti katmanini konusmanin ALTINA ve konusurken kisilacak sekilde baglamak icin ffmpeg filtre parcasi.
// Ilham: EBU R128 / ITU-R BS.1770 yontemi; kod bize ait (ffmpeg ebur128 + loudnorm).
"use strict";
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const FF = require("../ff-yol");
const { OrtakHata, CIKIS } = require("./ortak");

const HEDEF = Object.freeze({ I: -14, TP: -1.5, LRA: 11 });
const hata = (kod, msg, cozum) => new OrtakHata(kod, msg, { cikis: CIKIS.GIRDI, cozum });

// ---- olcum --------------------------------------------------------------------------------------------------
function sayi(s) { return /inf/i.test(s) ? -Infinity : parseFloat(s); }
// ffmpeg `ebur128=peak=true` stderr -> { kareler:[{t,M,S}], I, LRA, TP }
function ebur128Oku(metin) {
  const kareler = [];
  for (const m of String(metin).matchAll(/t:\s*([\d.]+)\s+TARGET:[^M]*M:\s*(-?[\d.]+|-?inf)\s+S:\s*(-?[\d.]+|-?inf)/g)) kareler.push({ t: parseFloat(m[1]), M: sayi(m[2]), S: sayi(m[3]) });
  const ozet = String(metin).split("Summary:").pop() || "";
  const al = (ad, birim) => { const m = new RegExp(ad + ":\\s*(-?[\\d.]+|-?inf)\\s*" + birim).exec(ozet); return m ? sayi(m[1]) : null; };
  return { kareler, I: al("I", "LUFS"), LRA: al("LRA", "LU"), TP: al("Peak", "dBFS") };
}
function olc(dosya, af) {
  const r = spawnSync(FF.ffmpeg, ["-hide_banner", "-nostats", "-i", dosya, "-vn", "-af", (af ? af + "," : "") + "ebur128=peak=true", "-f", "null", "-"], { encoding: "utf8", maxBuffer: 1 << 28 });
  if (r.status !== 0 && !/Summary/.test(r.stderr || "")) throw hata("ses_olculemedi", "Ses ölçülemedi: " + path.basename(dosya), "Dosyada ses olduğundan emin ol.");
  const o = ebur128Oku(r.stderr);
  if (!o.kareler.length || o.I === null) throw hata("ses_yok", "Dosyada ölçülebilir ses yok.", "Sesli bir video ya da ses dosyası ver.");
  return o;
}
function ortanca(a) { const s = a.slice().sort((x, y) => x - y); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : null; }

// Patlama bulucu: anlik (M, 400 ms) ses konusmanin tipik duzeyinin `esik` LU ustune cikarsa bir tepe sayilir.
function tepeleriBul(kareler, esik) {
  const duyulan = kareler.filter(k => Number.isFinite(k.M) && k.M > -50);
  const taban = ortanca(duyulan.map(k => k.M));
  if (taban === null) return { taban: null, tepeler: [] };
  const tepeler = []; let akt = null;
  for (const k of kareler) {
    const yuksek = Number.isFinite(k.M) && k.M > taban + esik;
    if (yuksek) { if (akt && k.t - akt.son <= 0.35) { akt.son = k.t; akt.fazla = Math.max(akt.fazla, k.M - taban); } else { akt = { bas: k.t, son: k.t, fazla: k.M - taban }; tepeler.push(akt); } }
  }
  return { taban, tepeler: tepeler.filter(t => t.son - t.bas >= 0.09)  /* 100 ms'lik kare araligi, kayan nokta payi */.map(t => ({ bas: +t.bas.toFixed(1), son: +t.son.toFixed(1), fazlaLU: +t.fazla.toFixed(1) })) };
}
function analiz(dosya, o) {
  const esik = (o && o.esik) || 6;
  const m = olc(dosya);
  const { taban, tepeler } = tepeleriBul(m.kareler, esik);
  const enFazla = tepeler.reduce((s, t) => Math.max(s, t.fazlaLU), 0);
  const sorunlar = [];
  if (Math.abs(m.I - HEDEF.I) > 1) sorunlar.push(`Entegre ses ${m.I.toFixed(1)} LUFS (hedef ${HEDEF.I}).`);
  if (m.TP !== null && m.TP > HEDEF.TP + 0.1) sorunlar.push(`Gerçek tepe ${m.TP.toFixed(1)} dBTP (sınır ${HEDEF.TP}).`);
  if (tepeler.length) sorunlar.push(`${tepeler.length} ses patlaması: konuşmanın tipik düzeyinin ${esik}+ LU üstüne çıkıyor (en fazla ${enFazla} LU).`);
  if (m.LRA !== null && m.LRA > 12) sorunlar.push(`Ses aralığı (LRA) ${m.LRA.toFixed(1)} LU: çok dalgalı.`);
  return { I: m.I, TP: m.TP, LRA: m.LRA, taban, tepeler, enFazla, sorunlar, dengeli: sorunlar.length === 0 };
}

// ---- duzeltme -------------------------------------------------------------------------------------------------
function loudnormJson(metin) { const m = /\{[^{}]*"input_i"[^{}]*\}/.exec(String(metin)); return m ? JSON.parse(m[0]) : null; }
function loudnormFiltre(olcum, h) {
  h = Object.assign({}, HEDEF, h || {});
  const taban = `loudnorm=I=${h.I}:TP=${h.TP}:LRA=${h.LRA}`;
  if (!olcum || !Number.isFinite(Number(olcum.input_i))) return taban + ",aresample=48000";
  return `${taban}:measured_I=${olcum.input_i}:measured_TP=${olcum.input_tp}:measured_LRA=${olcum.input_lra}:measured_thresh=${olcum.input_thresh}:offset=${olcum.target_offset}:linear=true,aresample=48000`;
}
// Patlama tutucu: esik = konusma duzeyinin ~9 dB ustu (konusma tepeleri korunur, efekt tepeleri sikisir) + limiter
function tutucuFiltre(taban, oran) {
  const esik = Math.max(-30, Math.min(-6, (taban === null ? -20 : taban) + 9));
  return `acompressor=threshold=${esik.toFixed(1)}dB:ratio=${oran || 4}:attack=3:release=120:knee=4:makeup=1,alimiter=limit=0.89:level=disabled`;
}
function duzelt(girdi, cikti, o) {
  o = Object.assign({ esik: 6, oran: 4, lra: 9 }, o || {});
  if (!fs.existsSync(girdi)) throw hata("girdi_yok", "Dosya yok: " + girdi);
  const once = analiz(girdi, { esik: o.esik });
  const zincir = tutucuFiltre(once.taban, o.oran);
  const h = { LRA: o.lra };
  const p1 = spawnSync(FF.ffmpeg, ["-hide_banner", "-nostats", "-i", girdi, "-vn", "-af", `${zincir},loudnorm=I=${HEDEF.I}:TP=${HEDEF.TP}:LRA=${o.lra}:print_format=json`, "-f", "null", "-"], { encoding: "utf8", maxBuffer: 1 << 28 });
  const olcum = loudnormJson(p1.stderr);
  if (!olcum) throw new OrtakHata("ses_olculemedi", "Ses seviyesi ölçülemedi.", { cikis: CIKIS.GENEL });
  const video = spawnSync(FF.ffprobe, ["-v", "error", "-select_streams", "v", "-show_entries", "stream=codec_type", "-of", "csv=p=0", girdi], { encoding: "utf8" }).stdout.trim() !== "";
  const cikti2 = path.resolve(cikti);
  fs.mkdirSync(path.dirname(cikti2), { recursive: true });
  const kod = /\.(wav|flac)$/i.test(cikti2) ? ["-c:a", "pcm_s16le"] : ["-c:a", "aac", "-b:a", "192k"];
  const r = spawnSync(FF.ffmpeg, ["-hide_banner", "-v", "error", "-y", "-i", girdi, ...(video ? ["-c:v", "copy"] : ["-vn"]), "-af", `${zincir},${loudnormFiltre(olcum, h)}`, ...kod, "-ar", "48000", cikti2], { encoding: "utf8", maxBuffer: 1 << 28 });
  if (r.status !== 0) throw new OrtakHata("ffmpeg_hata", "Ses düzeltme başarısız: " + (r.stderr || "").trim().split("\n").pop(), { cikis: CIKIS.GENEL });
  const sonra = analiz(cikti2, { esik: o.esik });
  return { cikti: cikti2, once, sonra };
}

// ---- karisim kurali (render hatti icin) ---------------------------------------------------------------------
// Ses efektleri (whoosh, vurus, bip) konusmanin ALTINDA durur ve konusurken kisilir.
//  efekt tabani konusmanin `altDb` altindadir (varsayilan 12 dB) ve konusma yan zincirine gore sikisir.
//  Donus: { filtre, cikis } ; girdi etiketleri: [<efekt>] ve [<sc>] (konusma yan zinciri, 'asplit' ile ayrilmis olmali)
function efektBusu(efektEtiket, scEtiket, o) {
  o = Object.assign({ altDb: 12, esik: 0.05, oran: 8, cikis: "efd" }, o || {});
  const kazanc = -o.altDb;      // efekt seviyesi mutlak degil, konusmaya gore (konusma kanali zaten -14 LUFS'a olcekli gelir)
  const f = [`[${efektEtiket}]volume=${kazanc.toFixed(1)}dB[efv]`,
             `[efv][${scEtiket}]sidechaincompress=threshold=${o.esik}:ratio=${o.oran}:attack=5:release=250:makeup=1[${o.cikis}]`];
  return { filtre: f.join(";"), cikis: o.cikis };
}

module.exports = { HEDEF, ebur128Oku, olc, tepeleriBul, analiz, duzelt, loudnormFiltre, loudnormJson, tutucuFiltre, efektBusu };
