// lib/render-muzik.js — fon muzigi yatagi, ducking ve final ses karisimi.
//
// ESKI SORUNLAR: (1) muzik sabit seviyedeydi, konusma altinda da, konusmasiz intro/outro'da da ayni;
// (2) her 8 sn'lik akor fade ile sifira iniyordu (8 sn'de bir "nefes" centigi); (3) tek bir Am-F-C-G;
// (4) final karisimda ses seviyesi hedefi yoktu; (5) sonme suresi video gercekte bitmeden planlaniyordu.
//
// YENI: akorlar ORTUSEREK (acrossfade benzeri) birlesir ve dikisiz bir dongu olur; kullanici kendi
// muzigini verebilir (muzikDosyasi, dongulenir); muzik anlatimla sidechaincompress'e girer (konusurken
// kisilir, intro/outro'da yukselir); final karisim loudnorm I=-14 (lib/ses-denge.js HEDEF; iki gecisli olcum) + 48 kHz.
"use strict";
const fs = require("fs");
const path = require("path");
const ortak = require("./ortak");
const F = require("./render-ffmpeg");
const { RENDER_SURUM } = require("./render-ayar");

// Akor: sub/kok/uc/bes/par frekanslari (Hz). Enerji 175-800 Hz bandinda (telefon hoparlorunde duyulur).
const AKOR = {
  Am: { sub: 110.00, kok: 220.00, uc: 261.63, bes: 329.63, par: 659.25 },
  F:  { sub:  87.31, kok: 174.61, uc: 220.00, bes: 261.63, par: 523.25 },
  C:  { sub: 130.81, kok: 261.63, uc: 329.63, bes: 392.00, par: 783.99 },
  G:  { sub:  98.00, kok: 196.00, uc: 246.94, bes: 293.66, par: 587.33 },
  Dm: { sub:  73.42, kok: 146.83, uc: 174.61, bes: 220.00, par: 440.00 },
  Bb: { sub: 116.54, kok: 233.08, uc: 293.66, bes: 349.23, par: 466.16 },
  Gm: { sub:  98.00, kok: 196.00, uc: 233.08, bes: 293.66, par: 392.00 },
  A:  { sub: 110.00, kok: 220.00, uc: 277.18, bes: 329.63, par: 440.00 },
  E:  { sub:  82.41, kok: 164.81, uc: 207.65, bes: 246.94, par: 493.88 },
};
// ruh: akor dizisi, akor suresi (sn), tremolo hiz carpani, pembe gurultu seviyesi
const RUHLAR = {
  sakin:   { akorlar: ["Am", "F", "C", "G"],  akorSn: 8, tremolo: 1.0, gurultu: 0.06 },
  umut:    { akorlar: ["C", "G", "Am", "F"],  akorSn: 8, tremolo: 1.2, gurultu: 0.05 },
  gerilim: { akorlar: ["Dm", "Bb", "Gm", "A"], akorSn: 8, tremolo: 2.2, gurultu: 0.10 },
  enerjik: { akorlar: ["Am", "G", "F", "E"],  akorSn: 4, tremolo: 9.0, gurultu: 0.07 },
};
const ORTUSME_SN = 2;          // akorlar arasi ortusme (sifira inen fade YOK, capraz gecis)
const SD = require("./ses-denge");
const HEDEF_YAYIN = SD.HEDEF;     // yayin standardi: -14 LUFS (tek yer)
const HEDEF_LUFS = -18;        // dongu/dosya bu seviyeye getirilir; sonra anlatima gore gostergeli ayarlanir

// ebur128 ozetinden butunlesik ses siddeti (LUFS); olculemezse null
async function lufsOlc(girdiArgs, sureSn, cwd) {
  const argv = [...girdiArgs];
  if (sureSn) argv.push("-t", String(sureSn));
  // stereo olarak olc: karisimda tum kaynaklar stereoya acilir, goreli seviyeler tutarli kalsin
  argv.push("-af", "aformat=channel_layouts=stereo,ebur128=peak=none", "-f", "null", F.NULL_CIHAZ);
  try {
    const r = await F.olc(argv, { cwd, zamanAsimiMs: 180000 });
    const m = Array.from(r.stderr.matchAll(/\bI:\s+(-?\d+(?:\.\d+)?)\s+LUFS/g));
    if (!m.length) return null;
    const v = parseFloat(m[m.length - 1][1]);
    return Number.isFinite(v) && v > -69 ? v : null;
  } catch (e) { return null; }
}

// Sentetik dikisiz dongu uretir (telifsiz): akorlar ORTUSEREK birlesir, sonu basina dikisiz baglanir.
async function sentetikDongu(ruhAd, tmp) {
  const r = RUHLAR[ruhAd] || RUHLAR.sakin;
  const hedef = path.join(tmp, "muzik-dongu-" + ruhAd + "-" + RENDER_SURUM + ".wav");
  if (F.gecerliMi(hedef)) return hedef;
  const T = r.akorSn + ORTUSME_SN;               // her akor dosyasi: kendi suresi + ortusme
  const akorDosyalari = [];
  for (let i = 0; i < r.akorlar.length; i++) {
    const a = AKOR[r.akorlar[i]];
    const o = path.join(tmp, "akor-" + ruhAd + "-" + i + ".wav");
    const s = (f) => `sine=frequency=${f}:duration=${T}:sample_rate=48000`;
    const tr = (f, d) => `tremolo=f=${(f * r.tremolo).toFixed(3)}:d=${d}`;
    await F.calistir(["-f", "lavfi", "-i", s(a.kok), "-f", "lavfi", "-i", s(a.uc), "-f", "lavfi", "-i", s(a.bes),
      "-f", "lavfi", "-i", s(a.par), "-f", "lavfi", "-i", s(a.sub),
      "-f", "lavfi", "-i", `anoisesrc=d=${T}:c=pink:a=${r.gurultu}:sample_rate=48000`,
      "-filter_complex",
        `[0]volume=0.50,${tr(0.15, 0.25)}[a];[1]volume=0.40,${tr(0.12, 0.28)}[b];[2]volume=0.38,${tr(0.13, 0.26)}[c];` +
        `[3]volume=0.20,${tr(0.10, 0.35)}[d];[4]volume=0.28[e];[5]bandpass=f=2400:width_type=o:w=2,volume=0.50[f];` +
        // normalize=0 SART: yoksa amix girdi sayisina boluyor
        `[a][b][c][d][e][f]amix=inputs=6:duration=longest:normalize=0,` +
        `afade=t=in:d=${ORTUSME_SN},afade=t=out:st=${r.akorSn}:d=${ORTUSME_SN},aformat=sample_rates=48000:channel_layouts=mono`,
      "-c:a", "pcm_s16le", o], { etiket: "akor " + ruhAd, zamanAsimiMs: 120000 });
    akorDosyalari.push(o);
  }
  // dizi: akor i, i*akorSn'de baslar; son akorun ortusme kuyrugu donguyu bastaki ortusmeye sarar
  const n = akorDosyalari.length, dongu = n * r.akorSn;
  const girdiler = [];
  akorDosyalari.forEach(f => girdiler.push("-i", f));
  const f = akorDosyalari.map((_, i) => `[${i}:a]adelay=${i * r.akorSn * 1000}:all=1[k${i}]`);
  f.push(akorDosyalari.map((_, i) => `[k${i}]`).join("") + `amix=inputs=${n}:duration=longest:normalize=0[seq]`);
  f.push(`[seq]asplit=2[s1][s2]`);
  f.push(`[s1]atrim=0:${dongu},asetpts=PTS-STARTPTS[bas]`);
  f.push(`[s2]atrim=${dongu}:${dongu + ORTUSME_SN},asetpts=PTS-STARTPTS[kuyruk]`);
  f.push(`[bas][kuyruk]amix=inputs=2:duration=first:normalize=0[dongu]`);
  const ham = path.join(tmp, "muzik-dongu-" + ruhAd + "-ham.wav");
  await F.calistir([...girdiler, "-filter_complex", f.join(";"), "-map", "[dongu]", "-t", String(dongu), "-c:a", "pcm_s16le", ham],
    { etiket: "muzik dongusu", zamanAsimiMs: 120000 });
  // dongunun siddetini HEDEF_LUFS'a getir (sabit kazanc: dongu icinde seviye oynamasi olmasin)
  const I = await lufsOlc(["-i", ham], 0, tmp);
  const kazanc = I === null ? 0 : HEDEF_LUFS - I;
  await F.uret(hedef, ["-i", ham, "-af", `volume=${kazanc.toFixed(2)}dB,alimiter=limit=0.9`, "-c:a", "pcm_s16le"], { etiket: "muzik seviye" });
  for (const x of akorDosyalari.concat([ham])) { try { fs.unlinkSync(x); } catch (e) { /* yok */ } }
  return hedef;
}

// Kullanicinin muzik dosyasi (konu.json muzikDosyasi) var mi, okunuyor mu? Render BASLAMADAN once
// cagrilir: dakikalarca klip uretip sonunda "muzik yok" demesin. Donus: mutlak yol | null
function muzikDosyasiDogrula(ayar) {
  if (!(ayar.muzikSeviyesi > 0) || !ayar.muzikDosyasi) return null;
  const yol = path.isAbsolute(ayar.muzikDosyasi) ? ayar.muzikDosyasi : path.join(ortak.KOK, ayar.muzikDosyasi);
  if (!fs.existsSync(yol) || !fs.statSync(yol).isFile())
    throw new ortak.OrtakHata("muzik_yok", "Müzik dosyası bulunamadı: " + ayar.muzikDosyasi, { cikis: ortak.CIKIS.GIRDI,
      cozum: "konu.json'daki muzikDosyasi yolunu düzelt (mutlak yol ya da proje klasörüne göre) ya da alanı sil." });
  try { F.bilgi(yol); } catch (e) {
    throw new ortak.OrtakHata("muzik_bozuk", "Müzik dosyası okunamadı: " + path.basename(yol), { cikis: ortak.CIKIS.GIRDI,
      cozum: "Geçerli bir ses dosyası (mp3/wav/m4a) seç." });
  }
  return yol;
}

// Muzik kaynagi: kullanicinin dosyasi (dongulenir) ya da sentetik dongu. Donus: { args, I, tur } | null
async function muzikKaynagi(ayar, tmp) {
  if (!(ayar.muzikSeviyesi > 0)) return null;
  if (ayar.muzikDosyasi) {
    const yol = muzikDosyasiDogrula(ayar);
    const I = await lufsOlc(["-i", yol], 120, tmp);
    return { args: ["-stream_loop", "-1", "-i", yol], I: I === null ? HEDEF_LUFS : I, tur: "dosya", ad: path.basename(yol) };
  }
  const dongu = await sentetikDongu(ayar.muzikRuhu, tmp);
  return { args: ["-stream_loop", "-1", "-i", dongu], I: HEDEF_LUFS, tur: "sentetik", ad: ayar.muzikRuhu };
}

// ----------------------------------------------------------------------------------------------
// SES KARISIMI (filtre grafi). Dizinler: girdi sirasi (ffmpeg -i sirasi) verilir.
//   idx.anlatim, idx.muzik (varsa), idx.cd (varsa)
//   p: { D, bodyStart, bodyEnd, cdSn, sesI, muzik:{I}, seviye, ducking }
// Donus: { filtre (noktali virgulle birlesik), cikis:"mix" }
function sesGrafi(idx, p) {
  const f = [];
  const ms = Math.round(p.bodyStart * 1000);
  f.push(`[${idx.anlatim}:a]aformat=sample_rates=48000:channel_layouts=stereo,adelay=${ms}|${ms},apad=whole_dur=${p.D.toFixed(3)}[ses]`);
  const girdiler = [];
  if (idx.muzik !== undefined && idx.muzik !== null && p.muzik) {
    // Taban: anlatimin 3 dB altinda (ducking acikken konusurken ~9 dB daha kisilir => ~12 dB alti),
    // muzikSeviyesi 0.40 varsayilan referanstir (0.20 -> 6 dB daha kisik).
    const refDb = p.ducking ? -3 : -8;
    const gainDb = (p.sesI - 0) + refDb - p.muzik.I + 20 * Math.log10(Math.max(0.01, p.seviye) / 0.40);
    // intro/outro (konusma yok) 3.5 dB yukselir; gecisler 2 sn'lik rampa
    const rampa = `min(1,max(0,(${p.bodyStart.toFixed(3)}-t)/2))+min(1,max(0,(t-${p.bodyEnd.toFixed(3)})/2))`;
    const fo = Math.min(5, p.D / 3).toFixed(2);
    f.push(`[${idx.muzik}:a]aformat=sample_rates=48000:channel_layouts=stereo,volume=${gainDb.toFixed(2)}dB,` +
           `volume='1+0.5*(${rampa})':eval=frame,afade=t=in:st=${p.cdSn.toFixed(2)}:d=3,afade=t=out:st=${Math.max(0, p.D - Number(fo)).toFixed(2)}:d=${fo}[mus]`);
    if (p.ducking) {
      // Algilayici dali anlatimin seviyesinden bagimsiz olsun: anlatim -20 LUFS'e olceklenir, esik sabit kalir
      const scDb = Math.max(-20, Math.min(20, -20 - p.sesI));
      f.push(`[ses]asplit=2[ses1][sc0]`);
      f.push(`[sc0]volume=${scDb.toFixed(2)}dB[sc]`);
      f.push(`[mus][sc]sidechaincompress=threshold=0.06:ratio=4:attack=30:release=500:makeup=1[musd]`);
      girdiler.push("[ses1]", "[musd]");
    } else girdiler.push("[ses]", "[mus]");
  } else girdiler.push("[ses]");
  if (idx.cd !== undefined && idx.cd !== null) { f.push(`[${idx.cd}:a]aformat=sample_rates=48000:channel_layouts=stereo[cd]`); girdiler.push("[cd]"); }
  // SES EFEKTI KATMANI (whoosh, vurus, bip...): konusmanin ALTINDA (varsayilan -12 dB) ve konusurken ayrica kisilir.
  // Konusma yan zincirine anlatimin kendi kopyasindan baglanir; ana anlatim yolu degismez.
  if (idx.efekt !== undefined && idx.efekt !== null) {
    const scDb = Math.max(-20, Math.min(20, -20 - p.sesI));
    const i0 = girdiler.indexOf("[ses]") !== -1 ? "[ses]" : "[ses1]";
    f.push(`${i0}asplit=2[${i0 === "[ses]" ? "sesA" : "ses1A"}][scE0]`);
    girdiler[girdiler.indexOf(i0)] = i0 === "[ses]" ? "[sesA]" : "[ses1A]";
    f.push(`[scE0]volume=${scDb.toFixed(2)}dB[scE]`);
    f.push(`[${idx.efekt}:a]aformat=sample_rates=48000:channel_layouts=stereo[efh]`);
    const eb = SD.efektBusu("efh", "scE", { altDb: p.efektAltDb === undefined ? 12 : p.efektAltDb });
    f.push(eb.filtre); girdiler.push(`[${eb.cikis}]`);
  }
  f.push(`${girdiler.join("")}amix=inputs=${girdiler.length}:duration=longest:dropout_transition=0:normalize=0[mix]`);
  return { filtre: f.join(";"), cikis: "mix" };
}

// Ilk gecis: karisimin LUFS/TP/LRA'sini olc (loudnorm print_format=json). Basarisizsa null.
async function loudnormOlc(girdiArgs, grafi, D, cwd) {
  const filtre = grafi.filtre + `;[${grafi.cikis}]loudnorm=I=${HEDEF_YAYIN.I}:TP=${HEDEF_YAYIN.TP}:LRA=${HEDEF_YAYIN.LRA}:print_format=json[o]`;
  try {
    const r = await F.olc([...girdiArgs, "-filter_complex", filtre, "-map", "[o]", "-t", D.toFixed(3), "-f", "null", F.NULL_CIHAZ],
      { cwd, zamanAsimiMs: F.zamanAsimi(D, 3, 120) });
    const m = /\{[^{}]*"input_i"[^{}]*\}/.exec(r.stderr);
    if (!m) return null;
    const j = JSON.parse(m[0]);
    const v = k => Number(j[k]);
    const ok = ["input_i", "input_tp", "input_lra", "input_thresh", "target_offset"].every(k => Number.isFinite(v(k)));
    if (!ok) return null;
    return { measured_I: v("input_i"), measured_TP: v("input_tp"), measured_LRA: v("input_lra"), measured_thresh: v("input_thresh"), offset: v("target_offset") };
  } catch (e) { return null; }
}

// Ikinci gecis filtresi: olcum varsa dogrusal (linear), yoksa tek gecisli dinamik loudnorm. 48 kHz'e doner.
function loudnormFiltresi(olcum) {
  if (olcum) {
    return `loudnorm=I=${HEDEF_YAYIN.I}:TP=${HEDEF_YAYIN.TP}:LRA=${HEDEF_YAYIN.LRA}:measured_I=${olcum.measured_I}:measured_TP=${olcum.measured_TP}:` +
           `measured_LRA=${olcum.measured_LRA}:measured_thresh=${olcum.measured_thresh}:offset=${olcum.offset}:linear=true,aresample=48000`;
  }
  return `loudnorm=I=${HEDEF_YAYIN.I}:TP=${HEDEF_YAYIN.TP}:LRA=${HEDEF_YAYIN.LRA},aresample=48000`;
}

module.exports = { muzikKaynagi, muzikDosyasiDogrula, sesGrafi, loudnormOlc, loudnormFiltresi, lufsOlc, sentetikDongu, RUHLAR, HEDEF_LUFS };
