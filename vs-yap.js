// VS MOTORU — "dovusseler kim kazanirdi" Shorts'u (9:16, bolunmus ekran, simsek ayrac)
// Kullanim: node vs-yap.js <is-adi>
//
// Girdi : uretim/<is>/vs.json  +  uretim/<is>/Images/ust.jpg, alt.jpg
// Cikti : uretim/<is>/Videos/<is>.mp4
//
// HIZ NOTU: gorseller ve simsek katmani BIR KEZ hazirlanip her bolumde
// yeniden kullaniliyor. Ilk surumde her karede 32 MP jpeg olceklenip simsek
// geq ile yeniden hesaplaniyordu — 36 sn'lik video 10 dakika suruyordu.
//
// DAYANIKLILIK: yazilar lib/yazi.js (textfile; ozel karakter sorunu yok), kodlayici GPU->CPU yedekli,
// her adim zaman asimli, cikti .part'a yazilip yeniden adlandirilir, muzik -14 LUFS (video-yap ile ayni, lib/ses-denge.js).
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const ortak = require("./lib/ortak");
const F = require("./lib/render-ffmpeg");
const Y = require("./lib/yazi");

const W = 1080, H = 1920, ORTA = H / 2, YARIM = H / 2, FPS = 30;
const BPM = 140;

// ---- sabitler: yerlesim ----
// Isimler en uc noktalarda, barlar kendi yarilarinin icinde, olcu adi ORTADA simsegin uzerinde bir
// plaket olarak. Ilk surumde olcu serdi ust hayvanin yuzunu kesiyordu.
const PLAK_W = 720, PLAK_X = (W - PLAK_W) / 2, PLAK_Y = ORTA - 82, PLAK_H = 168;
const BARW = 820, BX = (W - BARW) / 2, BARH = 78;
const UST_BAR_Y = 560, ALT_BAR_Y = 1290;

// ---- vs.json dogrulama ----
function vsDogrula(V) {
  const h = [];
  if (!ortak.duzNesne(V)) throw new ortak.OrtakHata("vs_gecersiz", "vs.json bir JSON nesnesi olmalı.", { cikis: ortak.CIKIS.GIRDI });
  for (const t of ["ust", "alt"]) {
    const x = V[t];
    if (!ortak.duzNesne(x) || typeof x.ad !== "string" || !x.ad.trim()) h.push(t + ".ad eksik");
    else if (typeof x.renk !== "string" || !/^[0-9A-Fa-f]{6}$/.test(x.renk)) h.push(t + ".renk 6 haneli renk kodu olmalı (örn. FF5A36)");
  }
  if (!Array.isArray(V.olculer) || !V.olculer.length) h.push("olculer boş olmamalı");
  else V.olculer.forEach((o, i) => {
    if (!ortak.duzNesne(o) || typeof o.ad !== "string") return h.push("olculer[" + i + "].ad eksik");
    for (const k of ["ustDeger", "altDeger"]) if (typeof o[k] !== "number" || !Number.isFinite(o[k])) h.push("olculer[" + i + "]." + k + " sayı olmalı");
    for (const k of ["ustMetin", "altMetin"]) if (typeof o[k] !== "string") h.push("olculer[" + i + "]." + k + " metin olmalı");
  });
  if (V.kazanan !== "ust" && V.kazanan !== "alt") h.push("kazanan 'ust' ya da 'alt' olmalı");
  if (h.length) throw new ortak.OrtakHata("vs_gecersiz", "vs.json geçersiz: " + h.slice(0, 4).join("; "), { cikis: ortak.CIKIS.GIRDI,
    cozum: "uretim/<iş>/vs.json dosyasını düzelt (panelde VS formu ya da node vs-kur.js ile yeniden üret).", detay: h });
}

// ---- yazi yardimcilari (textfile): her cagri benzersiz dosya adi alir ----
let sayac = 0;
function kurucular(tmp) {
  const dt = (metin, tur, boyut, renk, x, y, ekstra) => Y.drawtext({ font: tur, metin, dizin: tmp, ad: "vs-" + (++sayac), boyut, renk, x, y, ekstra });
  const bol = (V) => {
    const isimler = () => [
      dt(V.ust.ad, "impact", 74, "0x" + V.ust.renk, "(w-text_w)/2", 54, "borderw=7:bordercolor=black"),
      dt(V.alt.ad, "impact", 74, "0x" + V.alt.renk, "(w-text_w)/2", "h-text_h-54", "borderw=7:bordercolor=black"),
    ].join(",");

    // Metin plakete sigmazsa punto kucultulur (lib/yazi.sigdir). Impact/Arial ~0.5-0.52 x punto.
    const plaket = (satir1, satir2, boy1, boy2) => {
      boy1 = Y.sigdir(satir1, PLAK_W - 40, boy1 || 68, 0.50);
      if (satir2) boy2 = Y.sigdir(satir2, PLAK_W - 40, boy2 || 38, 0.52);
      const p = [
        `drawbox=x=${PLAK_X}:y=${PLAK_Y}:w=${PLAK_W}:h=${PLAK_H}:color=black@0.80:t=fill`,
        `drawbox=x=${PLAK_X}:y=${PLAK_Y}:w=${PLAK_W}:h=5:color=0xB4F0FF@0.9:t=fill`,
        `drawbox=x=${PLAK_X}:y=${PLAK_Y + PLAK_H - 5}:w=${PLAK_W}:h=5:color=0xB4F0FF@0.9:t=fill`,
        dt(satir1, "impact", boy1, "white", "(w-text_w)/2", PLAK_Y + 22, "borderw=5:bordercolor=black"),
      ];
      if (satir2) p.push(dt(satir2, "kalin", boy2, "0xBFE6F5", "(w-text_w)/2", PLAK_Y + 104, "borderw=4:bordercolor=black"));
      return p.join(",");
    };

    const introKatman = () => [
      isimler(),
      // buyuk gelip yerine oturan VS
      dt("VS", "impact", `'if(lt(t,0.5),300-160*min(1\\,max(0\\,t/0.5)),140)'`, "white", "(w-text_w)/2", "(h-text_h)/2", "borderw=10:bordercolor=black"),
      dt(V.altBaslik || "WHO WINS?", "impact", 58, "0xFFE04A", "(w-text_w)/2", ORTA + 130, "borderw=6:bordercolor=black:enable='gte(t,1.15)'"),
    ].join(",");

    const olcuKatman = (o) => {
      // Bar olcegi: dogrusal olunca 11 cm / 559 cm gorunmez oluyor, log olunca
      // fark yok gibi duruyor. 0.35 kuvvet ikisinin arasinda dogru duruyor.
      const enB = Math.max(o.ustDeger, o.altDeger) || 1;
      const oran = d => Math.max(0.07, Math.pow(Math.max(d, 0) / enB, 0.35));
      const uW = Math.round(BARW * oran(o.ustDeger));
      const aW = Math.round(BARW * oran(o.altDeger));
      const buyu = w => `'min(${w},${w}*(t/0.8))'`;
      const kaz = (taraf, y) => o.kazanan === taraf
        ? dt("WINNER", "impact", 44, "0xFFE04A", BX, y, "borderw=6:bordercolor=black:enable='gte(t,1.1)'")
        : null;
      return [
        // ust taraf
        dt(o.ustMetin, "impact", 68, "white", BX, UST_BAR_Y - 88, "borderw=6:bordercolor=black"),
        `drawbox=x=${BX}:y=${UST_BAR_Y}:w=${BARW}:h=${BARH}:color=black@0.58:t=fill`,
        `drawbox=x=${BX}:y=${UST_BAR_Y}:w=${buyu(uW)}:h=${BARH}:color=0x${V.ust.renk}@0.94:t=fill`,
        kaz("ust", UST_BAR_Y + BARH + 14),
        // orta plaket
        plaket(o.ad, o.not),
        // alt taraf
        `drawbox=x=${BX}:y=${ALT_BAR_Y}:w=${BARW}:h=${BARH}:color=black@0.58:t=fill`,
        `drawbox=x=${BX}:y=${ALT_BAR_Y}:w=${buyu(aW)}:h=${BARH}:color=0x${V.alt.renk}@0.94:t=fill`,
        dt(o.altMetin, "impact", 68, "white", BX, ALT_BAR_Y + BARH + 16, "borderw=6:bordercolor=black"),
        kaz("alt", ALT_BAR_Y - 58),
        isimler(),
      ].filter(Boolean).join(",");
    };

    const kazananKatman = () => {
      const kazanan = V.kazanan === "ust" ? V.ust : V.alt;
      const karart = V.kazanan === "ust"
        ? `drawbox=x=0:y=${ORTA}:w=${W}:h=${ORTA}:color=black@0.62:t=fill`
        : `drawbox=x=0:y=0:w=${W}:h=${ORTA}:color=black@0.62:t=fill`;
      const y = V.kazanan === "ust" ? 470 : 1180;
      return [
        karart,
        dt("WINNER", "impact", 100, "0xFFE04A", "(w-text_w)/2", y, "borderw=9:bordercolor=black"),
        dt(kazanan.ad, "impact", Y.sigdir(kazanan.ad, W - 120, 96, 0.5), "white", "(w-text_w)/2", y + 118, "borderw=9:bordercolor=black"),
        plaket(V.sonuc || "", V.sonuc2 || "", 46, 40),
        isimler(),
      ].filter(Boolean).join(",");
    };
    return { introKatman, olcuKatman, kazananKatman };
  };
  return { bol };
}

// ---- DOVUS MUZIGI ----------------------------------------------------------
// Fon muzigi kucuk hoparlorde duyulmuyordu. Sebep sub-basta kalmasi.
// Vurus bilerek ORTA banda tasindi: trampet gurultusu + 165-330 Hz riff.
// Seviye video-yap.js ile AYNI hedefte: -14 LUFS (tek standart: lib/ses-denge.js), 48 kHz cikis.
function muzik(sure) {
  const v = 60 / BPM;
  const m = `mod(t,${v})`, m2 = `mod(t,${v * 2})`, m4 = `mod(t,${v * 4})`;
  const ifade =
    `0.62*sin(2*PI*60*t)*exp(-${m}*13)` +                                   // kick govde
    `+0.30*sin(2*PI*700*t)*exp(-${m}*90)` +                                 // kick tik
    `+0.42*(random(0)*2-1)*exp(-mod(t+${v},${v * 2})*26)` +                 // trampet
    `+0.20*sin(2*PI*164.81*t)*(0.55+0.45*sin(2*PI*t/${v * 8}))` +           // E riff
    `+0.16*sin(2*PI*246.94*t)*exp(-${m2}*2.2)` +                            // B
    `+0.13*sin(2*PI*329.63*t)*exp(-${m4}*1.6)` +                            // E oktav
    `+0.13*(random(0)*2-1)*exp(-mod(t,${v / 2})*150)`;                      // hi-hat
  return `aevalsrc='${ifade}':s=44100:d=${sure},` +
         `highpass=f=45,alimiter=level_in=1:level_out=0.92:limit=0.95,` +
         `loudnorm=I=-14:TP=-1.5:LRA=9,aresample=48000`;
}

// ---- AKIS ------------------------------------------------------------------
async function main() {
  const { konum } = ortak.argumanCoz(process.argv.slice(2), { deger: [] });
  const IS = konum[0];
  if (!IS) throw new ortak.OrtakHata("girdi", "Kullanım: node vs-yap.js <iş-adı>", { cikis: ortak.CIKIS.GIRDI, cozum: "İş adı zorunlu (uretim/ altındaki klasör adı)." });
  const BASE = ortak.isDizin(IS);
  if (!fs.existsSync(BASE)) throw new ortak.OrtakHata("is_yok", "İş bulunamadı: " + IS, { cikis: ortak.CIKIS.GIRDI, cozum: "Önce node vs-kur.js " + IS + " ile işi kur." });
  const IMG = path.join(BASE, "Images"), OUT = path.join(BASE, "Videos"), TMP = path.join(BASE, "_tmp");
  const V = ortak.jsonOku(path.join(BASE, "vs.json"), null);
  if (V === null) throw new ortak.OrtakHata("vs_yok", "vs.json yok: " + IS, { cikis: ortak.CIKIS.GIRDI, cozum: "node vs-kur.js " + IS + " ile VS işini kur." });
  vsDogrula(V);
  for (const f of ["ust.jpg", "alt.jpg"])
    if (!fs.existsSync(path.join(IMG, f)))
      throw new ortak.OrtakHata("gorsel_yok", "Görsel eksik: Images/" + f, { cikis: ortak.CIKIS.YETERSIZ, cozum: "node vs-kur.js " + IS + " ya da node vs-gorsel-duzelt.js " + IS + " ile görselleri bul." });
  ortak.kilitAl(IS, "vs-yap");
  for (const d of [OUT, TMP]) fs.mkdirSync(d, { recursive: true });
  ortak.partTemizle(TMP); ortak.partTemizle(OUT);
  try { os.setPriority(0, os.constants.priority.PRIORITY_BELOW_NORMAL); } catch (e) { /* izin yok: sorun degil */ }

  const kodek = F.kodekler();
  console.log("KODLAYICI: " + (kodek.gpu ? kodek.ad + " (GPU)" : "CPU libx264"));
  const t0 = Date.now();
  const katman = kurucular(TMP).bol(V);

  const ustPng = path.join(TMP, "ust-yari.png"), altPng = path.join(TMP, "alt-yari.png"), simsekMov = path.join(TMP, "simsek.mov");

  // ---- HAZIRLIK (bir kez) ----
  for (const [kaynak, hedef] of [["ust.jpg", ustPng], ["alt.jpg", altPng]]) {
    await F.uret(hedef, ["-i", path.join(IMG, kaynak),
      "-vf", `scale=${W}:${YARIM}:force_original_aspect_ratio=increase,crop=${W}:${YARIM},eq=brightness=-0.06:saturation=1.12,setsar=1`,
      "-frames:v", "1"], { etiket: "görsel hazırlık " + kaynak });
  }
  // Uc ucgen dalganin toplami = duzensiz zikzak. Tek dalga fazla duzenli duruyor.
  const t = (p, a) => `${a}*(2*(2*abs(X/${p}-floor(X/${p}+0.5)))-1)`;
  const z = `(${t(97, 30)}+${t(41, 15)}+${t(17, 7)})`;
  const kal = `(4.5+1.8*sin(2*PI*T*9))`;
  const d = `abs(Y-${ORTA}-${z})`;
  // 1 saniyelik dongu; her bolumde -stream_loop ile tekrarlanir
  await F.uret(simsekMov, ["-f", "lavfi", "-i", `color=c=black@0:s=${W}x${H}:r=${FPS}:d=1`,
    "-vf", `format=rgba,geq=r='210':g='245':b='255':a='if(lt(${d},${kal}),255,if(lt(${d},${kal}*3.4),110,0))',gblur=sigma=1.2`,
    "-c:v", "qtrle"], { etiket: "şimşek katmanı" });

  // ---- BOLUM RENDER ----
  const bolumYap = (dosya, sure, kat, etiket) => F.uret(dosya, K => [
    "-loop", "1", "-t", String(sure), "-i", ustPng,
    "-loop", "1", "-t", String(sure), "-i", altPng,
    "-stream_loop", "-1", "-t", String(sure), "-i", simsekMov,
    "-filter_complex", `[0:v][1:v]vstack=inputs=2[bg];[bg][2:v]overlay=0:0:shortest=0[base];[base]${kat},format=yuv420p[v]`,
    "-map", "[v]", "-r", String(FPS), ...K.ara, "-t", String(sure)],
    { etiket, zamanAsimiMs: F.zamanAsimi(sure, 40, 120) });

  const INTRO = V.introSure || 4.0, OLCU = V.olcuSure || 5.8, SON = V.sonSure || 7.0;
  const N = V.olculer.length;
  const toplamBolum = N + 2;
  const parcalar = [];
  let biten = 0;
  const ilerlet = () => ortak.ilerleme("bolum", 100 * (++biten) / toplamBolum, { n: biten, toplam: toplamBolum });

  const f0 = path.join(TMP, "00-intro.mp4");
  await bolumYap(f0, INTRO, katman.introKatman(), "giriş"); parcalar.push(f0); ilerlet();
  console.log("  bölüm: giriş");
  for (let i = 0; i < V.olculer.length; i++) {
    const o = V.olculer[i];
    const f = path.join(TMP, String(i + 1).padStart(2, "0") + ".mp4");
    await bolumYap(f, OLCU, katman.olcuKatman(o), "ölçü " + (i + 1)); parcalar.push(f); ilerlet();
    console.log("  bölüm: " + o.ad);
  }
  const fk = path.join(TMP, "99-kazanan.mp4");
  await bolumYap(fk, SON, katman.kazananKatman(), "kazanan"); parcalar.push(fk); ilerlet();
  console.log("  bölüm: kazanan");

  const liste = path.join(TMP, "liste.txt");
  fs.writeFileSync(liste, parcalar.map(F.concatSatiri).join("\n"), "utf8");
  const sessiz = path.join(TMP, "sessiz.mp4");
  await F.uret(sessiz, ["-f", "concat", "-safe", "0", "-i", liste, "-c", "copy"], { etiket: "birleştirme", zamanAsimiMs: 300000 });

  const toplam = INTRO + OLCU * N + SON;
  const cikti = path.join(OUT, IS + ".mp4");
  await F.uret(cikti, ["-i", sessiz, "-f", "lavfi", "-i", muzik(toplam + 0.5),
    "-map", "0:v", "-map", "1:a", "-shortest", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-ar", "48000"],
    { etiket: "ses", zamanAsimiMs: 300000 });

  const sure = F.sureOlc(cikti);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) { /* kilitli */ }
  console.log("=== BİTTİ === " + sure.toFixed(1) + " sn · " + (fs.statSync(cikti).size / 1048576).toFixed(1) + " MB · render " +
              ((Date.now() - t0) / 1000).toFixed(0) + " sn");
  console.log("  " + cikti);
  ortak.sonuc({ video: "Videos/" + IS + ".mp4", sureSn: Math.round(sure * 1000) / 1000 });
}

if (require.main === module) main().catch(ortak.bitir);
module.exports = { main, muzik, vsDogrula };
