// lib/render-ana.js — video kurma akisi: ses + gorsel + altyazi -> bitmis mp4.
//
//   hazirlik : ayar, kilit, dogrulama (seslendirme guncel mi? parca sayisi = paragraf sayisi mi?)
//   zaman    : sahne -> paragraf araligi -> kare-kesin klip plani; gecis binmeleri (xfade) hesaba katilir
//   uretim   : klipler -> gruplar -> kartlar -> ust gruplar -> final (.part -> yeniden adlandirma)
//   cikti    : altyazi.srt, kapak, yayin paketi, render-sonuc.json, ara dosya temizligi
//
// ZAMAN CIZELGESI (degismezler):
//   bodyStart = (on parcalarin sureleri toplami) - (on parca adedi x CF)      [xfade binmeli]
//   anlatim TAM bodyStart'ta baslar; klip i, anlatimin T_i anindan baslar
//   gövde bitisi = anlatim bitisi (outro varsa outro tam orada baslar; yoksa 0.6 sn sessiz kuyruk)
//   toplam sure ve muzigin sonmesi ffprobe/kare sayisiyla OLCULEN birlesik sureye gore hesaplanir
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const ortak = require("./ortak");
const F = require("./render-ffmpeg");
const A = require("./render-ayar");
const S = require("./render-ses");
const AY = require("./render-altyazi");
const SH = require("./render-sahne");
const K = require("./render-kartlar");
const KL = require("./render-klip");
const M = require("./render-muzik");
const Y = require("./yazi");

const GERI_SAYIM_SN = 5;                // geri-sayim.js sabit 5 sn uretir

// ---------------------------------------------------------------- ilerleme
const AGIRLIK = { hazirlik: [0, 5], klip: [5, 45], grup: [45, 56], kart: [56, 60], ses: [60, 65], final: [65, 96], cikti: [96, 100] };
function ilerlet(asama, ic, ekstra) {
  const [a, b] = AGIRLIK[asama] || [0, 100];
  ortak.ilerleme(asama, a + (b - a) * Math.max(0, Math.min(1, ic)), ekstra);
}

// ---------------------------------------------------------------- disk
// ÖLÇÜLDÜ (2026-10-05): 1920x1080 30 fps, fotograf benzeri (ayrintili+gren) 4 gorselle 8 sn'lik klipler:
//   NVIDIA NVENC cq20  = 1.25 MB / video saniyesi   |   x264 veryfast crf18 = 0.66 MB / video saniyesi
// (_tmp'de klip + grup + ust grup ~3 kopya kalir; final mp4 ayni mertebede). En kotu durum (NVENC) alinir.
// Tahmin ayrica panel-ayar diskEsikGB alt siniriyla birlestirilir.
const MB_SN = 1.3;
function diskTahminGB(ayar, videoSn, anlatimSn) {
  const olcek = (ayar.W * ayar.H) / (1920 * 1080);
  const araMB = videoSn * MB_SN * olcek * 3;           // klip + grup + ust grup
  const sesMB = anlatimSn * 0.096 * 2;                 // anlatim.wav (48 kHz mono 16 bit) + tampon
  const finalMB = videoSn * MB_SN * olcek;
  return Math.round((araMB + sesMB + finalMB) / 1024 * 100) / 100;
}

// ---------------------------------------------------------------- imza (final onbellek)
const dosyaSha = yol => { try { return ortak.sha1(fs.readFileSync(yol)); } catch (e) { return "yok"; } };
const dosyaDurum = yol => { try { const s = fs.statSync(yol); return s.size + ":" + Math.round(s.mtimeMs); } catch (e) { return "yok"; } };
function gorselDurumu(visDir) {
  const out = [];
  let klasorler = [];
  try { klasorler = fs.readdirSync(visDir).filter(x => !x.startsWith("_") && fs.statSync(path.join(visDir, x)).isDirectory()); } catch (e) { return ""; }
  for (const d of klasorler.sort(SH.dogalSirala))
    for (const f of fs.readdirSync(path.join(visDir, d)).filter(x => SH.GORSEL_UZANTI.test(x)).sort(SH.dogalSirala))
      out.push(d + "/" + f + ":" + dosyaDurum(path.join(visDir, d, f)));
  return out.join(",");
}
function finalImzasi(ayar, sesImza, altyaziMetinleri, yollar) {
  const alanlar = {
    s: A.RENDER_SURUM, W: ayar.W, H: ayar.H, FPS: ayar.FPS, dikey: ayar.dikey,
    intro: ayar.intro, konuKarti: ayar.konuKarti, outro: ayar.outro, geriSayim: ayar.geriSayim, markaKose: ayar.markaKose,
    gecis: ayar.gecis, cf: ayar.cfKare, efekt: ayar.efekt, renk: ayar.renk,
    muzik: [ayar.muzikSeviyesi, ayar.muzikDosyasi, ayar.muzikDosyasi ? dosyaDurum(path.isAbsolute(ayar.muzikDosyasi) ? ayar.muzikDosyasi : path.join(ortak.KOK, ayar.muzikDosyasi)) : "", ayar.muzikDucking, ayar.muzikRuhu],
    kanal: ayar.kanal, slogan: ayar.slogan, baslik: ayar.baslik, vurgu: ayar.vurguHex, outroMetni: ayar.outroMetni,
    altyazi: [ayar.altyazi, ayar.altyaziStil, ayar.altyaziDili, ayar.dil],
  };
  return ortak.sha1(JSON.stringify([alanlar, sesImza, ortak.sha1(altyaziMetinleri.join("\n\n")),
    dosyaSha(path.join(yollar.VIS, "manifest.json")), gorselDurumu(yollar.VIS), dosyaSha(path.join(yollar.VOICE, "kelimeler.json"))]));
}

// ---------------------------------------------------------------- ana akis
// bayrak: { yeniden, temiz, tut, onizleme (true | sn) }
// Bir adim girdisinin icinden bozuk cikarsa (F.uret bozuk ara dosyayi siler ve 'ara_dosya_bozuk' firlatir) is BIR kez
// kendiliginden yeniden kurulur: gecerli ara dosyalar onbellekten gelir, yalniz silinenler yeniden uretilir.
async function render(is, bayrak) {
  // bellek karari (bos bellek esigi / RENDER_DUSUK_BELLEK) her render basinda yeniden verilir; onarim tekrarinda korunur
  if (!(bayrak && bayrak.onarimDenendi)) F.bellekSifirla();
  try { return await renderTek(is, bayrak); }
  catch (e) {
    if (e && e.kod === "ara_dosya_bozuk" && !(bayrak && bayrak.onarimDenendi)) {
      ortak.uyari(e.message + " — iş bir kez yeniden deneniyor.");
      return render(is, Object.assign({}, bayrak, { onarimDenendi: true }));
    }
    throw e;
  }
}

async function renderTek(is, bayrak) {
  bayrak = bayrak || {};
  const t0 = Date.now();
  const onizleme = bayrak.onizleme ? (bayrak.onizleme === true ? 25 : Math.max(5, Math.min(300, Number(bayrak.onizleme) || 25))) : 0;
  const envOlcek = Number(process.env.RENDER_OLCEK);       // testler icin cozunurluk carpani (0-1)
  const olcek = onizleme ? 1 / 3 : (envOlcek > 0 && envOlcek < 1 ? envOlcek : 1);

  const ayar = A.ayarCoz(is, { olcek });                   // bozuk konu.json burada 2 koduyla durur
  ortak.kilitAl(is, "video-yap");
  try { if (ortak.envOku("RENDER_ONCELIK").toLowerCase() !== "normal") os.setPriority(0, os.constants.priority.PRIORITY_BELOW_NORMAL); } catch (e) { /* izin yok: sorun degil */ }

  const yollar = {
    BASE: ayar.dizin, VOICE: path.join(ayar.dizin, "Voice"), VIS: path.join(ayar.dizin, "Visuals"), VID: path.join(ayar.dizin, "Videos"),
    TMP: path.join(ayar.dizin, onizleme ? "_tmp-onizleme" : "_tmp"),
  };
  fs.mkdirSync(yollar.VID, { recursive: true });
  fs.mkdirSync(yollar.TMP, { recursive: true });
  const uyarilar = [];
  const uyar = m => { uyarilar.push(m); ortak.uyari(m); };
  for (const m of ayar.uyarilar) uyar(m);
  ilerlet("hazirlik", 0);

  // --- kodlayici
  const kodek = F.kodekler();
  console.log(kodek.gpu ? "KODLAYICI: " + kodek.ad + " (GPU) — hızlı mod" : "KODLAYICI: libx264 (CPU). GPU için sürücüyü güncelle.");
  // bos bellek 3 GB'in altindaysa ya da RENDER_DUSUK_BELLEK=1 ise bastan dusuk bellek profili (bellek hatasinda zaten kendiliginden gecilir)
  const bp = F.bellekProfili();
  if (bp.dusuk) console.log("BELLEK: " + bp.bosGB.toFixed(1) + " GB boş — düşük bellek modu (" + bp.neden + "): klipler tek tek, az iş parçacığıyla kurulur; daha yavaş, görüntü kalitesi aynı.");

  // --- erken dogrulamalar: pahali is baslamadan bilinen girdi hatalari yakalansin
  M.muzikDosyasiDogrula(ayar);                             // muzikDosyasi yok/bozuksa cikis 2
  Y.fontDosyasi("kalin"); Y.fontDosyasi("normal");         // yazi tipi yoksa cikis 2 (font_yok)

  // --- yarim kalmis dosyalar (Durdur / cokme sonrasi)
  const silinen = ortak.partTemizle(yollar.TMP) + ortak.partTemizle(yollar.VID);
  // is kokundeki yarim atomik yazmalar (<dosya>.<pid>.tmp, sahibi OLU surec): render-sonuc.json, altyazi.srt, yayin.json...
  let kokTmp = 0;
  try {
    for (const ad of fs.readdirSync(yollar.BASE)) {
      const m = /\.(\d+)\.tmp$/.exec(ad);
      if (!m) continue;
      let canli = false;
      try { process.kill(Number(m[1]), 0); canli = true; } catch (e) { canli = e.code === "EPERM"; }
      if (!canli) { try { fs.unlinkSync(path.join(yollar.BASE, ad)); kokTmp++; } catch (e) { /* kilitli */ } }
    }
  } catch (e) { /* klasor okunamadi: onemli degil */ }
  if (silinen + kokTmp) console.log("  önceki yarım kalan " + (silinen + kokTmp) + " ara dosya temizlendi");
  if (bayrak.temiz) { try { fs.rmSync(yollar.TMP, { recursive: true, force: true }); fs.mkdirSync(yollar.TMP, { recursive: true }); console.log("  --temiz: ara dosyalar silindi"); } catch (e) { /* kilitli olabilir */ } }
  try { fs.unlinkSync(path.join(yollar.BASE, "_filter_final.txt")); } catch (e) { /* eski surumden kalma, yok olabilir */ }

  // --- 1) SES DOGRULAMA (cheap): guncel mi? parca sayisi = paragraf sayisi mi?
  const kanon = S.kanonikParagraflar(yollar.VOICE);
  const bul = S.parcalariBul(yollar.VOICE, kanon);
  const sesImza = S.sesImzasi(bul, kanon);
  const altyaziMetni = AY.altyaziMetni({ is, dizin: ayar.dizin, dil: ayar.dil, altyaziDili: ayar.altyaziDili }, kanon);
  for (const m of bul.uyarilar.concat(altyaziMetni.uyarilar)) uyar(m);

  // --- 2) FINAL IMZA: degisiklik yoksa atla
  const imza = finalImzasi(ayar, sesImza, altyaziMetni.paragraflar, yollar);
  const cikis = path.join(yollar.VID, is + ".mp4");
  const sonucYolu = path.join(yollar.BASE, "render-sonuc.json");
  // --yeniden de --temiz de "bastan kur" demektir: ikincisi onbellegi silip sonra "video guncel" diye cikmamali (panelin "Temiz kur" kutusu yalniz --temiz yollar)
  if (!onizleme && !bayrak.yeniden && !bayrak.temiz && fs.existsSync(cikis)) {
    let onceki = null;
    try { onceki = ortak.jsonOku(sonucYolu, null); } catch (e) { onceki = null; }
    if (onceki && onceki.imza === imza && F.gecerliMi(cikis, onceki.sureSn, 0.6)) {
      console.log("Video güncel (girdiler ve ayarlar değişmemiş) — yeniden kurulmadı. Zorlamak için --yeniden.");
      await yanCiktilar(is, ayar, yollar, uyar, { sadeceEksik: true });
      if (!bayrak.tut) { try { fs.rmSync(yollar.TMP, { recursive: true, force: true }); } catch (e) { /* kilitli */ } }
      ortak.sonuc({ atlandi: true, neden: "video güncel", video: path.relative(yollar.BASE, cikis).replace(/\\/g, "/"), sureSn: onceki.sureSn });
      return { atlandi: true };
    }
  }

  // --- 3) ANLATIM SESI: parcalar PCM'e cozulup tek dosya + GERCEK sureler
  console.log("SES: " + kanon.length + " parça birleştiriliyor...");
  const ses = await S.sesHazirla({ is, dizin: ayar.dizin }, path.join(yollar.TMP, "anlatim.wav"), y => ilerlet("hazirlik", 0.2 + 0.8 * y / 100));
  for (const m of ses.uyarilar) if (!bul.uyarilar.includes(m)) uyar(m);
  console.log("SES: " + ses.N + " parça -> " + (ses.toplam / 60).toFixed(2) + " dakika (" + ses.kaynak + ")");

  // --- 4) GORSEL / SAHNE
  const sahne = await SH.sahneleriTopla(ayar, ses);
  for (const m of sahne.uyarilar) uyar(m);
  for (const g of sahne.gecersiz) uyar("Görsel " + g.ad + " bozuk, panelden sil (" + g.neden + "; atlandı)");
  const ilkGorsel = (sahne.sahneler.find(s => s.gorseller.length) || { gorseller: [{}] }).gorseller[0].yol;

  // --- 5) ZAMAN CIZELGESI (kare-kesin)
  const FPS = ayar.FPS, cf = ayar.cfKare;
  const kisaltilan = [];
  const onKare = sn => {                                  // on parca/outro: en az 2 x CF (xfade bindirmesi sigsin)
    if (!(sn > 0)) return 0;
    const k = Math.round(sn * FPS), asgari = 2 * cf;
    if (k < asgari) { kisaltilan.push(sn); return asgari; }
    return k;
  };
  const onParcalar = [];                                  // [{tur, kare}]
  if (ayar.geriSayim > 0) onParcalar.push({ tur: "cd", kare: GERI_SAYIM_SN * FPS });
  if (ayar.intro > 0) onParcalar.push({ tur: "intro", kare: onKare(ayar.intro) });
  // konu karti yalniz konu.json'da gercek bir baslik varsa (baslik yoksa ayar.baslik is klasoru adina duser: '001-time-travel' yazilmasin)
  const konuKartiVar = ayar.konuKarti > 0 && !!ayar.baslikVar;
  if (konuKartiVar) onParcalar.push({ tur: "topic", kare: onKare(ayar.konuKarti) });
  const outroKare = ayar.outro > 0 ? onKare(ayar.outro) : 0;
  if (kisaltilan.length) uyar("Çok kısa intro/kart/outro süreleri geçiş süresine uyduruldu (en az " + (2 * cf / FPS).toFixed(1) + " sn).");
  const nOn = onParcalar.length;
  const bodyStartKare = onParcalar.reduce((a, p) => a + p.kare, 0) - nOn * cf;
  const bodyStart = bodyStartKare / FPS;
  const kuyrukKare = outroKare > 0 ? cf : Math.max(Math.round(0.6 * FPS), cf);

  let klipler, ozgunSayisi = null;
  if (sahne.mod === "manifest") klipler = SH.klipPlani(ayar, sahne.sahneler, kuyrukKare);
  else {
    const hepsi = sahne.sahneler[0].gorseller;
    const e = SH.esitKlipPlani(ayar, ses, hepsi, kuyrukKare);
    klipler = e.klipler; ozgunSayisi = e.ozgun;
  }
  // onizleme: yalniz ilk SN saniye icin gereken klipler, outro yok
  let outroKareKullan = outroKare;
  if (onizleme) {
    outroKareKullan = 0;
    const gerekliKare = Math.max(1, Math.round((onizleme - bodyStart) * FPS));
    let n = klipler.findIndex(k => k.basKare >= gerekliKare);
    if (n < 0) n = klipler.length;
    klipler = klipler.slice(0, Math.max(1, n));
    const son = klipler[klipler.length - 1];
    son.kare = (son.sonKare - son.basKare) + Math.max(Math.round(0.6 * FPS), cf);
  }
  if (!onizleme && sahne.mod === "manifest") console.log("SAHNE: " + sahne.sahneler.length + " sahne, " + sahne.gorselSayisi + " görsel -> " + klipler.length + " klip (anlatım süresine göre dağıtıldı)");
  if (sahne.mod === "eski") console.log("GÖRSEL: " + (ozgunSayisi || klipler.length) + " özgün -> " + klipler.length + " kare, eşit süre (eski yol)");

  const govdeKare = klipler.reduce((a, k) => a + k.kare, 0) - (klipler.length - 1) * cf;
  const toplamKare = onParcalar.reduce((a, p) => a + p.kare, 0) + klipler.reduce((a, k) => a + k.kare, 0) + outroKareKullan
    - (nOn + klipler.length + (outroKareKullan > 0 ? 1 : 0) - 1) * cf;
  const D = (onizleme ? Math.min(toplamKare / FPS, onizleme) : toplamKare / FPS);
  const bodyEnd = bodyStart + ses.toplam;
  console.log("ZAMAN: anlatım " + bodyStart.toFixed(2) + " sn'de başlıyor, " + bodyEnd.toFixed(2) + " sn'de bitiyor; video " + D.toFixed(2) + " sn (geçiş " + ayar.CF.toFixed(2) + " sn)");
  if (!onizleme) {
    const beklenen = bodyEnd + (outroKare > 0 ? outroKare / FPS : kuyrukKare / FPS);
    if (Math.abs(D - beklenen) > 2 / FPS) uyar("Zaman çizelgesi tutarsız (hesaplanan " + D.toFixed(2) + ", beklenen " + beklenen.toFixed(2) + " sn); ses-görüntü kayabilir.");
    const sinir = ortak.formatSiniri(ayar.format);
    if (D > sinir.teknikMaxSn)
      uyar((ayar.format === "short" ? "Shorts" : ayar.format === "reels" ? "Reels" : ayar.format === "tiktok" ? "TikTok" : "Video") + " " + D.toFixed(0) +
        " sn: platform sınırı " + sinir.teknikMaxSn + " sn. Seslendirme metnini kısalt (hedef gövde: " + Math.max(0, Math.floor(sinir.teknikMaxSn - bodyStart - (outroKare / FPS))) + " sn).");
  }

  // --- 6) DISK
  const gerekGB = diskTahminGB(ayar, D, ses.toplam);
  const esik = Math.max(Number(ortak.ayarOku().diskEsikGB) || 0, gerekGB + 0.5);
  const disk = ortak.diskKontrol(yollar.TMP, esik);
  console.log("DİSK: " + (disk.bosGB === null ? "ölçülemedi" : disk.bosGB + " GB boş") + " (tahmini ihtiyaç ~" + gerekGB + " GB)");

  // --- 7) ADLAR + ESKI ONBELLEK TEMIZLIGI
  const kodekAd = kodek.ad;
  klipler.forEach(k => { k.imza = KL.klipImzasi(ayar, k, kodekAd); k.dosya = path.join(yollar.TMP, KL.klipAdi(k.i, k.imza)); k.ad8 = path.basename(k.dosya); });
  const onSha = (tur, ekstra) => KL.imza8([A.RENDER_SURUM, tur, ayar.W, ayar.H, ayar.FPS, kodekAd, ayar.vurguHex, ...ekstra]);
  const adlar = {
    cd: "aa0-geri-sayim-" + K.geriSayimImzasi(ayar) + ".mp4",
    intro: "aa-intro-" + onSha("intro", [ayar.kanal, ayar.slogan, ayar.intro]) + ".mp4",
    topic: "ab-topic-" + onSha("topic", [ayar.baslik, ayar.konuKarti, ilkGorsel && dosyaDurum(ilkGorsel)]) + ".mp4",
    outro: "zz-outro-" + onSha("outro", [JSON.stringify(ayar.outroMetni), ayar.kanal, ayar.outro]) + ".mp4",
  };
  // gruplar (1. seviye)
  const grupSayisi = Math.ceil(klipler.length / ayar.GRUP);
  const grupOgeleri = [];
  for (let g = 0; g < grupSayisi; g++) {
    const uyeler = klipler.slice(g * ayar.GRUP, (g + 1) * ayar.GRUP);
    grupOgeleri.push({ uyeler, ad: uyeler.length === 1 ? uyeler[0].ad8 : KL.grupAdi("grp", g, uyeler.map(u => ({ ad: u.ad8 })), ayar, kodekAd) });
  }
  const beklenen = new Set(klipler.map(k => k.ad8).concat(grupOgeleri.map(g => g.ad)).concat(Object.values(adlar)));
  // Ust grup (ara kademe) adlari da onceden hesaplanir ve 'beklenen' kumesine girer: temizlik imzasi
  // GUNCEL olan hicbir ara dosyayi silmez, yalniz imzasi eskimis/yetim olanlari siler.
  const ustPlan = [];                                     // [{kademe, ogeler:[{ad, parca}]}]; ustPlan.final = finalde birlesecek ogeler
  {
    let siradaki = [...(onParcalar.filter(p => p.tur === "cd").length ? [{ ad: adlar.cd, kare: GERI_SAYIM_SN * FPS }] : []),
      ...(onParcalar.some(p => p.tur === "intro") ? [{ ad: adlar.intro, kare: onParcalar.find(p => p.tur === "intro").kare }] : []),
      ...(konuKartiVar ? [{ ad: adlar.topic, kare: onParcalar.find(p => p.tur === "topic").kare }] : []),
      ...grupOgeleri.map(g => ({ ad: g.ad, kare: KL.birlesikKare(g.uyeler, cf) })),
      ...(outroKareKullan > 0 ? [{ ad: adlar.outro, kare: outroKareKullan }] : [])];
    let kademe = 0;
    while (siradaki.length > ayar.FINAL_MAX) {
      kademe++;
      const yeni = [], ogeler = [];
      for (let g = 0; g * ayar.GRUP < siradaki.length; g++) {
        const parca = siradaki.slice(g * ayar.GRUP, (g + 1) * ayar.GRUP);
        if (parca.length === 1) { yeni.push(parca[0]); continue; }
        const ad = KL.grupAdi("ust" + kademe + "_", g, parca, ayar, kodekAd);
        ogeler.push({ ad, parca });
        beklenen.add(ad);
        yeni.push({ ad, kare: KL.birlesikKare(parca, cf) });
      }
      ustPlan.push({ kademe, ogeler });
      siradaki = yeni;
    }
    ustPlan.final = siradaki;
  }
  let temizlenen = 0;
  for (const ad of fs.readdirSync(yollar.TMP)) {
    if (/^(clip|grp|ust|aa0-|aa-|ab-|zz-)/.test(ad) && /\.mp4$/.test(ad) && !beklenen.has(ad)) { try { fs.unlinkSync(path.join(yollar.TMP, ad)); temizlenen++; } catch (e) { /* kilitli */ } }
  }
  if (temizlenen) console.log("  imzası eski olan " + temizlenen + " ara dosya silindi");
  ilerlet("hazirlik", 1);

  // --- 8) KLIPLER
  const pk = F.paralellik();
  console.log("1/3 Klipler oluşturuluyor... (" + pk.n + " paralel, " + pk.bosGB.toFixed(1) + " GB boş bellek" + (pk.dusukBellek ? ", düşük bellek modu" : "") + ")");
  const kRes = await KL.klipleriUret(ayar, klipler, yollar.TMP, (b, t) => {
    ilerlet("klip", b / t, { n: b, toplam: t });
  }, uyar);
  console.log("  klipler: " + kRes.uretilen + " üretildi, " + kRes.onbellekten + " önbellekten");

  // --- 9) GRUPLAR
  console.log("2/3 Gruplar birleştiriliyor...");
  const dosyaOf = new Map();                              // ad -> {dosya, kare}
  klipler.forEach(k => dosyaOf.set(k.ad8, { dosya: k.dosya, kare: k.kare }));
  let gi = 0;
  for (const g of grupOgeleri) {
    if (g.uyeler.length > 1) {
      const sonuc = await KL.grupUret(ayar, yollar.TMP, g.uyeler.map(u => ({ dosya: u.dosya, kare: u.kare })), path.join(yollar.TMP, g.ad),
        f => ilerlet("grup", (gi + f) / grupOgeleri.length, { n: gi + 1, toplam: grupOgeleri.length }));
      dosyaOf.set(g.ad, { dosya: sonuc.dosya, kare: sonuc.kare });
    }
    gi++; ilerlet("grup", gi / grupOgeleri.length, { n: gi, toplam: grupOgeleri.length });
  }

  // --- 10) KARTLAR (intro, konu karti, outro, geri sayim)
  console.log("2b/3 Intro/outro üretiliyor...");
  // Geri sayim yalniz cozunurluge baglidir (isten bagimsiz): ORTAK onbellekte (uretim/_onbellek) tutulur;
  // 1080p'de uretimi dakikalar surdugu icin her videoda yeniden uretilmez. _tmp silinse de kalir.
  const cdDosya = path.join(ortak.uretimDizini(), "_onbellek", adlar.cd);
  let cdWav = null;
  if (ayar.geriSayim > 0) {
    fs.mkdirSync(path.dirname(cdDosya), { recursive: true });
    ortak.partTemizle(path.dirname(cdDosya));
    cdWav = path.join(yollar.TMP, "geri-sayim.wav");
    if (!F.gecerliMi(cdDosya, GERI_SAYIM_SN, 0.2)) { try { fs.unlinkSync(cdDosya); } catch (e) { /* yok */ } await K.geriSayimUret(ayar, yollar.TMP, cdDosya); }
    else if (!F.gecerliMi(cdWav)) { await F.uret(cdWav, ["-i", cdDosya, "-vn", "-ar", "48000", "-ac", "2", "-c:a", "pcm_s16le"], { etiket: "geri-sayim-ses" }); }
    dosyaOf.set(adlar.cd, { dosya: cdDosya, kare: GERI_SAYIM_SN * FPS });
    console.log("GERİ SAYIM: " + GERI_SAYIM_SN + " sn film lideri eklendi");
  }
  const kartUret = async (ad, kare, uretici) => {
    const hedef = path.join(yollar.TMP, ad);
    if (!F.gecerliMi(hedef, kare / FPS, 0.15)) { try { fs.unlinkSync(hedef); } catch (e) { /* yok */ } await uretici(hedef); }
    dosyaOf.set(ad, { dosya: hedef, kare });
  };
  const introKare = (onParcalar.find(p => p.tur === "intro") || {}).kare;
  if (introKare) await kartUret(adlar.intro, introKare, h => K.introUret({ ...ayar, intro: introKare / FPS }, yollar.TMP, h));
  const topicKare = (onParcalar.find(p => p.tur === "topic") || {}).kare;
  if (topicKare) await kartUret(adlar.topic, topicKare, h => K.konuKartiUret({ ...ayar, konuKarti: topicKare / FPS }, yollar.TMP, h, ilkGorsel));
  if (outroKareKullan > 0) await kartUret(adlar.outro, outroKareKullan, h => K.outroUret({ ...ayar, outro: outroKareKullan / FPS }, yollar.TMP, h));
  console.log("  intro " + (introKare ? (introKare / FPS).toFixed(1) : 0) + " sn + konu " + (topicKare ? (topicKare / FPS).toFixed(1) : 0) + " sn + outro " + (outroKareKullan / FPS).toFixed(1) + " sn");
  ilerlet("kart", 1);

  // --- 11) COK PARCA VARSA ARA KADEME (ust gruplar)
  // OLCULEN: 30 dakikalik videoda 42 grup olustu, final 46 dosyayi tek filtre grafinda birlestirmeye calisip
  // bellek tuketti ([h264] get_buffer() failed). 10'dan fazla parca kalirsa once 8'erli ust gruplara indiriliyor.
  for (const k of ustPlan) {
    console.log("  ara kademe " + k.kademe + ": " + k.ogeler.reduce((a, o) => a + o.parca.length, 0) + " parça -> " + k.ogeler.length);
    let i = 0;
    for (const o of k.ogeler) {
      const uyeler = o.parca.map(p => dosyaOf.get(p.ad));
      const sonuc = await KL.grupUret(ayar, yollar.TMP, uyeler, path.join(yollar.TMP, o.ad), f => ilerlet("grup", 1, { n: i + 1, toplam: k.ogeler.length, f: Math.round(f * 100) }));
      dosyaOf.set(o.ad, { dosya: sonuc.dosya, kare: sonuc.kare });
      i++; ilerlet("grup", 1, { n: i, toplam: k.ogeler.length });
    }
  }
  const finalElemanlar = ustPlan.final.map(p => ({ ...dosyaOf.get(p.ad), ad: p.ad }));
  if (finalElemanlar.some(e => !e.dosya)) throw new ortak.OrtakHata("render_tutarsiz", "Dahili hata: final parçaları eksik.", { cikis: ortak.CIKIS.GENEL });
  // degismez: ust gruplar dahil tum birlesimlerden sonra kare sayisi planlananla AYNI olmali
  const finalKare = KL.birlesikKare(finalElemanlar, cf);
  if (Math.abs(finalKare - Math.round(toplamKare)) > 1)
    uyar("Birleşik süre planlanandan farklı (" + (finalKare / FPS).toFixed(2) + " sn, plan " + (toplamKare / FPS).toFixed(2) + " sn): ses-görüntü kayabilir.");

  // --- 12) ALTYAZI (SRT)
  const cues = AY.altyaziKur(altyaziMetni.paragraflar, ses, bodyStart, { stil: ayar.altyaziStil, dikey: ayar.dikey, dil: ayar.altyaziDili });
  const srt = AY.srtMetni(cues);
  const srtKonum = onizleme ? path.join(yollar.TMP, "altyazi.srt") : path.join(yollar.BASE, "altyazi.srt");
  ortak.atomikYaz(srtKonum, srt);
  // videoya gomulen kopya: libass'a ozel karakterler (ters egik cizgi, <i> gibi etiketler) kacirilmis; kullaniciya giden
  // altyazi.srt / Videos/<is>.srt temiz kalir
  ortak.atomikYaz(path.join(yollar.TMP, "altyazi-gomme.srt"), AY.srtMetni(cues.map(c => ({ ...c, metin: AY.libassKacis(c.metin) }))));
  console.log("ALTYAZI: " + cues.length + " satır (" + altyaziMetni.kaynak + ")");

  // --- 13) SES KARISIMI + FINAL
  console.log("3/3 Final render...");
  const muzik = await M.muzikKaynagi(ayar, yollar.TMP);
  const sesI = (await M.lufsOlc(["-i", ses.wav], 0, yollar.TMP));
  const girdi = [];
  finalElemanlar.forEach(e => girdi.push("-i", e.dosya));
  const sesGirdiBas = finalElemanlar.length;
  const sesGirdileri = ["-i", ses.wav];
  const idx = { anlatim: sesGirdiBas };
  let say = sesGirdiBas + 1;
  if (muzik) { sesGirdileri.push(...muzik.args); idx.muzik = say++; }
  if (cdWav) { sesGirdileri.push("-i", cdWav); idx.cd = say++; }
  const sesGraf = M.sesGrafi(idx, { D, bodyStart, bodyEnd, cdSn: ayar.geriSayim > 0 ? GERI_SAYIM_SN : 0, sesI: sesI === null ? -20 : sesI,
    muzik, seviye: ayar.muzikSeviyesi, ducking: ayar.muzikDucking });
  if (muzik) console.log("MÜZİK: " + (muzik.tur === "dosya" ? "kullanıcı dosyası (" + muzik.ad + ", döngülenir)" : "sentetik '" + ayar.muzikRuhu + "' yatağı") +
    " — seviye " + ayar.muzikSeviyesi + (ayar.muzikDucking ? ", konuşma altında kısılır" : ""));
  const olcum = await M.loudnormOlc([...girdi, ...sesGirdileri], sesGraf, D, yollar.TMP);
  ilerlet("ses", 1);

  const xf = KL.xfadeGrafi(ayar, finalElemanlar, 0);
  const fc = xf.satirlar.slice();
  const altyaziVar = ayar.altyazi && cues.length > 0;
  fc.push(`[vm]${F.RENK_YUV_SON}[vq]`);                   // xfade 4:4:4 verebilir: 4:2:0 + BT.709 sinirli aralik
  let son = "vq";
  if (altyaziVar) {
    fc.push(`[${son}]subtitles=altyazi-gomme.srt:force_style='FontName=Arial,Fontsize=${ayar.altyaziBoyut},Bold=1,` +
      `PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=1,Outline=2,Shadow=1,MarginV=${ayar.altyaziKenar}'[vsub]`);
    son = "vsub";
  }
  if (ayar.markaKose > 0 && ayar.kanal) {
    const s = bodyStart, e = bodyStart + ayar.markaKose;
    const dt = Y.drawtext({ font: "kalin", metin: ayar.kanal, dizin: yollar.TMP, ad: "marka-kose", boyut: ayar.TS(46), renk: "white",
      x: Math.round(ayar.W * 0.03), y: `h-text_h-${Math.round(ayar.H * 0.06)}`,
      ekstra: `alpha='if(lt(t,${s.toFixed(3)}+0.5),(t-${s.toFixed(3)})/0.5,if(gt(t,${e.toFixed(3)}-0.5),(${e.toFixed(3)}-t)/0.5,1))':` +
              `enable='between(t,${s.toFixed(3)},${e.toFixed(3)})':shadowcolor=black@0.7:shadowx=2:shadowy=2` });
    fc.push(`[${son}]${dt}[vmk]`);
    son = "vmk";
  }
  fc.push(`[${son}]null[vout]`);
  fc.push(sesGraf.filtre);
  fc.push(`[${sesGraf.cikis}]${M.loudnormFiltresi(olcum)}[aout]`);
  const fcDosya = path.join(yollar.TMP, "filter-final.txt");
  fs.writeFileSync(fcDosya, fc.join(";\n"), "utf8");

  const hedefMp4 = onizleme ? path.join(yollar.VID, is + "-onizleme.mp4") : cikis;
  const cwdSrt = yollar.TMP;                              // subtitles=altyazi-gomme.srt goreli yol: _tmp icinde
  await F.uret(hedefMp4, Kc => [...girdi, ...sesGirdileri, require("../ff-yol").filtreBayragi, fcDosya,
    "-map", "[vout]", "-map", "[aout]", ...Kc.son, "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-r", String(FPS), "-t", D.toFixed(3), "-movflags", "+faststart"],
    { cwd: cwdSrt, etiket: "final", zamanAsimiMs: F.zamanAsimi(D, 8, 300), girdiler: finalElemanlar.map(e => e.dosya),
      ilerleme: sn => ilerlet("final", sn / D, { n: Math.round(sn), toplam: Math.round(D) }),
      // eski Videos/<is>.mp4 oynaticida acikken yeni final yerlestirilemez: kullanici kapatana kadar beklenir, olmazsa
      // bitmis sonuc _tmp'ye saklanir ve sonraki calisma ayni imzayla yeniden kodlamadan yerlestirir (saatler kaybolmaz)
      kilitBeklemeSn: 90, park: onizleme ? undefined : { klasor: yollar.TMP, imza, beklenenSn: D } });
  ilerlet("final", 1);

  // --- 14) DOGRULAMA
  const b = F.bilgi(hedefMp4);
  if (b.sure === null || Math.abs(b.sure - D) > 0.5) uyar("Çıktı süresi beklenenden farklı: " + (b.sure === null ? "?" : b.sure.toFixed(2)) + " sn (beklenen " + D.toFixed(2) + " sn).");
  if (!b.sesVar) uyar("Çıktıda ses akışı görünmüyor.");

  if (onizleme) {
    console.log("\n=== ÖNİZLEME HAZIR ===\n  " + hedefMp4 + "\n  Süre: " + (b.sure || 0).toFixed(1) + " sn");
    try { fs.rmSync(yollar.TMP, { recursive: true, force: true }); } catch (e) { /* kilitli */ }
    ortak.sonuc({ onizleme: true, video: path.relative(yollar.BASE, hedefMp4).replace(/\\/g, "/"), sureSn: b.sure });
    return { onizleme: true };
  }

  // --- 15) YAN CIKTILAR
  const srtKopya = path.join(yollar.VID, is + ".srt");
  ortak.atomikYaz(srtKopya, srt);
  ortak.atomikJsonYaz(path.join(yollar.BASE, "paragraflar.json"), ses.kanon);
  const sonucNesne = {
    surum: 1, tamamlanma: new Date().toISOString(), is, video: "Videos/" + is + ".mp4",
    sureSn: Math.round(b.sure * 1000) / 1000, boyutBayt: fs.statSync(cikis).size, genislik: b.genislik, yukseklik: b.yukseklik, fps: FPS,
    kodek: kodekAd, gpu: F.gpuAcikMi(), dusukBellek: F.bellekSeviyesi(),          // 0 normal, 1 dusuk, 2 en dusuk bellek profili
    anlatimBaslangicSn: Math.round(bodyStart * 1000) / 1000, anlatimBitisSn: Math.round(bodyEnd * 1000) / 1000,
    gecisSn: ayar.CF,
    parcalar: { geriSayimSn: ayar.geriSayim > 0 ? GERI_SAYIM_SN : 0, introSn: introKare ? introKare / FPS : 0, konuKartiSn: topicKare ? topicKare / FPS : 0,
      govdeSn: Math.round(govdeKare / FPS * 1000) / 1000, outroSn: outroKareKullan / FPS },
    imza, secimler: { gecis: ayar.gecis, efekt: ayar.efekt, renk: ayar.renk, muzikRuhu: ayar.muzikRuhu },
    altyaziSatir: cues.length, tmpSilindi: false, uyarilar,
    // ek alan (sozlesmede olmayan, okuyanlar yok sayar): her paragrafin VIDEO zamani, kare-kesin
    // (bolum/kesit zamanlari buradan kurulur; intro/geri sayim kaymasi dahil)
    paragrafBaslangic: ses.baslangic.map(s => Math.round((bodyStart + s) * 1000) / 1000),
  };
  ortak.atomikJsonYaz(sonucYolu, sonucNesne);
  ilerlet("cikti", 0.3);

  await yanCiktilar(is, ayar, yollar, uyar, { sadeceEksik: false });
  ilerlet("cikti", 0.9);

  if (!bayrak.tut) {
    try { fs.rmSync(yollar.TMP, { recursive: true, force: true }); sonucNesne.tmpSilindi = true; ortak.atomikJsonYaz(sonucYolu, sonucNesne); }
    catch (e) { uyar("Ara dosyalar silinemedi (" + e.message + ")."); }
  }
  ilerlet("cikti", 1);

  console.log("\n=== BİTTİ ===");
  console.log("  " + cikis);
  console.log("  Süre: " + (b.sure / 60).toFixed(2) + " dk");
  console.log("  Boyut: " + (sonucNesne.boyutBayt / 1048576).toFixed(1) + " MB");
  console.log("  Render: " + Math.round((Date.now() - t0) / 1000) + " sn");
  ortak.sonuc({ video: sonucNesne.video, sureSn: sonucNesne.sureSn, boyutBayt: sonucNesne.boyutBayt, genislik: b.genislik, yukseklik: b.yukseklik,
    anlatimBaslangicSn: sonucNesne.anlatimBaslangicSn, tmpSilindi: sonucNesne.tmpSilindi });
  return sonucNesne;
}

// Kapak + yayin paketi: video'yu bozmaz, hata olursa @@UYARI
async function yanCiktilar(is, ayar, yollar, uyar, o) {
  const kapakYolu = path.join(yollar.VID, is + "-kapak.jpg");
  try {
    if (!o.sadeceEksik || !fs.existsSync(kapakYolu)) { const KP = require("./render-kapak"); await KP.kapakUret(is); }
  } catch (e) { uyar("Kapak üretilemedi: " + String(e.message).split("\n")[0]); }
  try {
    if (!o.sadeceEksik || !fs.existsSync(path.join(yollar.BASE, "YAYIN-PAKETI.md"))) { const YP = require("./render-yayin"); YP.yayinPaketiUret(is); }
  } catch (e) { uyar("Yayın paketi üretilemedi: " + String(e.message).split("\n")[0]); }
}

module.exports = { render, diskTahminGB, finalImzasi, MB_SN };
