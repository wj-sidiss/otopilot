// lib/render-kapak.js — kapak (thumbnail) uretimi: en iyi gorsel + buyuk, konturlu baslik.
//
// Yatay 1280x720, dikey 1080x1920 JPG; en cok 2 MB (kalite dongusu). Baslik en cok 3 satir, genislige
// sigana kadar punto kucultulur. Gorsel yoksa baslikli duz kapak uretilir (video yine de teslim edilir).
"use strict";
const fs = require("fs");
const path = require("path");
const ortak = require("./ortak");
const F = require("./render-ffmpeg");
const A = require("./render-ayar");
const SH = require("./render-sahne");
const Y = require("./yazi");

const MAKS_BAYT = 1950000;             // "en cok 2 MB" icin guvenli ust sinir

// Hedefe en az buyutmeyle oturan gorseli sec (kapak net olsun). Donus: yol | null
async function kapakGorseli(ayar, W, H) {
  const visDir = path.join(ayar.dizin, "Visuals");
  let aday = [];
  try {
    const m = ortak.jsonOku(path.join(visDir, "manifest.json"), null);
    if (m && Array.isArray(m.sahneler))
      for (const s of m.sahneler) for (const g of (s.gorseller || [])) {
        const yol = path.resolve(visDir, String(g && g.dosya || ""));
        if (g && g.dosya && ortak.yolIcinde(visDir, yol) && fs.existsSync(yol)) aday.push(yol);
      }
  } catch (e) { /* manifest bozuksa klasorden bak */ }
  if (!aday.length) aday = SH.klasordenTopla(visDir).map(g => g.yol);
  aday = aday.filter(y => !/\.mp4$/i.test(y));          // kapak durgun gorselden yapilir; stok video klibi kapak adayi degil
  aday = Array.from(new Set(aday));
  if (!aday.length) return null;
  // cok fazla gorselde ornekle: her N'inci
  if (aday.length > 60) { const adim = aday.length / 60; aday = Array.from({ length: 60 }, (_, i) => aday[Math.floor(i * adim)]); }
  const r = await F.paralel(aday, 6, y => F.gorselDogrulaAsync(y));
  let en = null;
  aday.forEach((y, i) => {
    if (!r[i].ok || !r[i].deger.ok) return;
    const { en: gen, boy } = r[i].deger;
    const olcek = Math.max(W / gen, H / boy);          // kirpmali doldurmada gereken buyutme
    const puan = [olcek <= 1 ? 0 : olcek, -gen * boy];  // once az buyutme, sonra buyuk dosya
    if (!en || puan[0] < en.puan[0] || (puan[0] === en.puan[0] && puan[1] < en.puan[1])) en = { yol: y, puan };
  });
  return en ? en.yol : null;
}

// Basligi satirlara bol: en cok 3 satir, hepsi genislige sigsin. Donus: { satirlar, punto }
function baslikDuzeni(metin, genislikPx, enBuyukPunto, enKucukPunto) {
  const oran = 0.5;                                    // Impact: ortalama karakter genisligi ~0.5 x punto
  for (let p = enBuyukPunto; p >= enKucukPunto; p = Math.floor(p * 0.93)) {
    const maks = Math.max(6, Math.floor(genislikPx / (p * oran)));
    const s = Y.satirla(metin, maks);
    if (s.length <= 3 && s.every(l => Array.from(l).length * p * oran <= genislikPx)) return { satirlar: s, punto: p };
  }
  // sigmadi: sert kisalt
  const p = enKucukPunto, maks = Math.max(6, Math.floor(genislikPx / (p * oran)));
  let s = Y.satirla(metin, maks).slice(0, 3);
  const son = Array.from(s[s.length - 1]);
  if (son.length > maks - 1) s[s.length - 1] = son.slice(0, maks - 1).join("") + "…";
  return { satirlar: s, punto: p };
}

async function kapakUret(is, secenek) {
  const o = secenek || {};
  const ayar = A.ayarCoz(is, {});
  const W = ayar.dikey ? 1080 : 1280, H = ayar.dikey ? 1920 : 720;
  const vid = path.join(ayar.dizin, "Videos");
  fs.mkdirSync(vid, { recursive: true });
  const tmp = path.join(ayar.dizin, "_tmp-kapak");
  fs.mkdirSync(tmp, { recursive: true });
  const hedef = path.join(vid, is + "-kapak.jpg");
  try {
    const gorsel = o.gorsel || await kapakGorseli(ayar, W, H);
    const baslik = (ayar.baslik || is).replace(/\s+/g, " ").trim();
    const buyuk = (() => { try { return baslik.toLocaleUpperCase(ayar.dil === "tr" ? "tr-TR" : undefined); } catch (e) { return baslik.toUpperCase(); } })();
    const kenar = Math.round(W * 0.06);
    const duzen = baslikDuzeni(buyuk, W - 2 * kenar, Math.round(H * (ayar.dikey ? 0.075 : 0.17)), Math.round(H * 0.045));
    const punto = duzen.punto, satirAraligi = Math.round(punto * 1.12);
    const blokYuk = duzen.satirlar.length * satirAraligi;
    const ustY = H - kenar - blokYuk;
    const yazilar = duzen.satirlar.map((s, i) => Y.drawtext({
      font: "impact", metin: s, dizin: tmp, ad: "kapak-" + i, boyut: punto,
      renk: (duzen.satirlar.length > 1 && i === duzen.satirlar.length - 1) ? ayar.vurgu : "white",
      x: "(w-text_w)/2", y: ustY + i * satirAraligi,
      ekstra: `borderw=${Math.max(3, Math.round(punto / 11))}:bordercolor=black:shadowcolor=black@0.6:shadowx=3:shadowy=4` }));
    const kaynak = gorsel
      ? ["-i", gorsel]
      : ["-f", "lavfi", "-i", `gradients=s=${W}x${H}:c0=0x0B1218:c1=0x24485A:type=linear:x0=0:y0=0:x1=${W}:y1=${H}`];
    const vf = (gorsel ? `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},eq=brightness=-0.05:contrast=1.12:saturation=1.25,vignette=angle=PI/4.5,` : "") +
      `drawbox=x=0:y=${Math.max(0, ustY - kenar)}:w=iw:h=ih-${Math.max(0, ustY - kenar)}:color=black@0.45:t=fill,` + yazilar.join(",");

    const part = F.partYolu(hedef);
    let kalite = [2, 3, 4, 6, 8, 11, 15, 20, 26, 31], tamam = false;
    for (const q of kalite) {
      try { fs.unlinkSync(part); } catch (e) { /* yok */ }
      await F.calistir([...kaynak, "-vf", vf, "-frames:v", "1", "-q:v", String(q), part], { etiket: "kapak", zamanAsimiMs: 120000 });
      if (fs.statSync(part).size <= MAKS_BAYT) { tamam = true; break; }
    }
    F.partBitir(part, hedef);
    if (!tamam) ortak.uyari("Kapak 2 MB'ın üstünde kaldı; görsel çok ayrıntılı olabilir.");
    console.log("KAPAK: " + hedef + " (" + (fs.statSync(hedef).size / 1024).toFixed(0) + " KB, " + W + "x" + H + (gorsel ? "" : ", görselsiz") + ")");
    return hedef;
  } finally {
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) { /* kilitli */ }
  }
}

module.exports = { kapakUret, kapakGorseli, baslikDuzeni };
