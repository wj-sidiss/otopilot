// lib/render-ayar.js — bir isin render ayarlarini tek yerde cozer.
//
// Kaynak: ortak.konuEtkin(is) (konu.json > panel-ayar.json > varsayilan). Bozuk konu.json burada
// OrtakHata('konu_bozuk') olarak yukari cikar -> betik "✗ konu.json bozuk (satir X...)" ile 2 koduyla
// biter; hicbir zaman sessizce varsayilana DUSULMEZ.
//
// Gecis / efekt / renk / muzik ruhu konu.json'da VERILMEMISSE ve cesitlilik acik ise (varsayilan)
// is adinin hash'iyle donusumlu secilir: ayni kanalin videolari birbirinin kopyasi gorunmesin.
"use strict";
const fs = require("fs");
const path = require("path");
const ortak = require("./ortak");

const FPS = 30;
const GRUP = 8;          // bir ara grupta kac klip
const FINAL_MAX = 10;    // finalde en cok kac parca (fazlasi ust gruplara indirilir)
// Gorsel basina azami sure: asilirsa sahnenin gorselleri tekrarlanir (farkli zoom yonuyle)
const MAX_L_YATAY = 11, MAX_L_DIKEY = 6;
const RENDER_SURUM = "3";   // kod degisince eski onbellekler gecersiz olsun (3: BT.709 sinirli aralik, yuv420p ara dosyalar)

// --- renk tonlari ---
const RENKLER = {
  sinematik: "eq=brightness=-0.10:contrast=1.10:saturation=0.82,colorbalance=bs=0.10:bm=0.05:rh=-0.03,vignette=angle=PI/5",
  sicak:     "eq=brightness=-0.04:contrast=1.08:saturation=1.12,colorbalance=rs=0.08:rm=0.05:bh=-0.04,vignette=angle=PI/5",
  soguk:     "eq=brightness=-0.08:contrast=1.12:saturation=0.90,colorbalance=bs=0.14:bm=0.08:rh=-0.05,vignette=angle=PI/5",
  canli:     "eq=brightness=0.02:contrast=1.16:saturation=1.30",
  siyahbeyaz:"hue=s=0,eq=contrast=1.20:brightness=-0.03,vignette=angle=PI/5",
  yok:       "null",
};

// Cesitlilik havuzlari (gorsel olarak guvenli, birbirinden ayirt edilebilir secimler)
const CESIT = {
  gecis: ["fade", "dissolve", "smoothleft", "smoothright", "slideleft", "wipeleft", "circleopen", "fadeblack"],
  efekt: ["zoom", "yavas", "kaydir", "hizli"],
  renk: ["sinematik", "sicak", "soguk", "canli"],
  muzikRuhu: ["sakin", "umut", "gerilim", "enerjik"],
};
const VARSAYILAN_SECIM = { gecis: "fade", efekt: "zoom", renk: "sinematik", muzikRuhu: "sakin" };

const VARSAYILAN_VURGU = "6FD8FF";
const renkKodu = v => (typeof v === "string" && /^[0-9A-Fa-f]{6}$/.test(v) ? v.toUpperCase() : VARSAYILAN_VURGU);

const hashSayi = (is, tuz) => parseInt(ortak.sha1(is + ":" + tuz).slice(0, 8), 16);
const cift = n => Math.max(2, Math.round(n / 2) * 2);    // x264/nvenc: ciftte olmali

// secenek: { olcek } (onizleme icin cozunurluk carpani)
function ayarCoz(is, secenek) {
  const o = secenek || {};
  const dizin = ortak.isDizin(is);
  if (!fs.existsSync(dizin))
    throw new ortak.OrtakHata("is_yok", "İş bulunamadı: " + is, { cikis: ortak.CIKIS.GIRDI,
      cozum: "Önce panelden yeni iş oluştur ya da iş adını kontrol et." });

  let konu = ortak.konuEtkin(is);                 // bozuksa OrtakHata firlatir
  const konuYok = konu === null;
  if (konuYok) konu = ortak.konuBirlestir({}, ortak.ayarOku(), is);
  // konuBirlestir baslik_en'e yedek olarak is adini yazar; konu karti ise YALNIZ konu.json'da gercekten baslik varsa cizilir
  let baslikVar = false;
  if (!konuYok) {
    try { const ham = ortak.konuHam(is); baslikVar = !!(ham && typeof ham.baslik_en === "string" && ham.baslik_en.trim()); } catch (e) { baslikVar = false; }
  }
  // vurgu rengi filtre dizgisine girer: yalniz 6 hane hex (elle bozulmus ayar/konu dosyasi filtreyi bozamasin)
  const vurguHex = renkKodu(konu.vurguRenk);

  const dikey = !!konu.dikey;
  const olcek = o.olcek && o.olcek > 0 && o.olcek < 1 ? o.olcek : 1;
  const W0 = dikey ? 1080 : 1920, H0 = dikey ? 1920 : 1080;
  const W = cift(W0 * olcek), H = cift(H0 * olcek);
  const SW = cift(W * 4 / 3), SH = cift(H * 4 / 3);     // zoom icin buyuk ara olcek (2560x1440 / 1440x2560)

  const cesit = konu.cesitlilik !== false;
  const sec = alan => {
    const v = konu[alan];
    if (v !== undefined && v !== null && !(alan === "muzikRuhu" && v === "otomatik")) return { deger: v, otomatik: false };
    if (cesit) return { deger: CESIT[alan][hashSayi(is, alan) % CESIT[alan].length], otomatik: true };
    return { deger: VARSAYILAN_SECIM[alan], otomatik: false };
  };
  const gecis = sec("gecis"), efekt = sec("efekt"), renk = sec("renk"), ruh = sec("muzikRuhu");

  // Gecis suresi KARE sayisina yuvarlanir: tum zaman hesaplari kare-kesin olsun
  let CF = typeof konu.gecisSure === "number" ? konu.gecisSure : (dikey ? 0.4 : 0.8);
  const cfKare = Math.max(1, Math.round(CF * FPS));
  CF = cfKare / FPS;

  const uyarilar = [];
  if (!konu.kanal || String(konu.kanal).trim().toUpperCase() === "KANALIM")
    uyarilar.push("Kanal adı ayarlanmamış (KANALIM): videodaki kanal yazısı yer tutucu kalacak. Panelden Kanal ayarını yaz.");

  const ayar = {
    is, dizin, konuYok, konu, olcek,
    format: konu.format, dikey,
    W, H, SW, SH, FPS, GRUP, FINAL_MAX,
    MAX_L: dikey ? MAX_L_DIKEY : MAX_L_YATAY,
    CF, cfKare,
    geriSayim: konu.geriSayim, intro: konu.intro, konuKarti: konu.konuKarti, outro: konu.outro,
    markaKose: konu.markaKose || 0,
    gecis: gecis.deger, efekt: efekt.deger, renk: renk.deger, muzikRuhu: ruh.deger,
    secimler: { gecis: gecis.deger, efekt: efekt.deger, renk: renk.deger, muzikRuhu: ruh.deger,
      otomatik: { gecis: gecis.otomatik, efekt: efekt.otomatik, renk: renk.otomatik, muzikRuhu: ruh.otomatik } },
    renkFiltresi: RENKLER[renk.deger] || RENKLER.sinematik,
    muzikSeviyesi: konu.muzikSeviyesi, muzikDosyasi: konu.muzikDosyasi || "", muzikDucking: konu.muzikDucking !== false,
    sesEfektleri: Array.isArray(konu.sesEfektleri) ? konu.sesEfektleri : [],
    kanal: String(konu.kanal || "").trim(), slogan: String(konu.slogan || "").trim(),
    baslik: String(konu.baslik_en || "").trim(), baslikVar,
    vurgu: "0x" + vurguHex, vurguHex,
    outroMetni: konu.outroMetni,
    dil: konu.dil, altyaziDili: konu.altyaziDili, altyazi: konu.altyazi !== false, altyaziStil: konu.altyaziStil,
    // libass PlayResY=288 varsayar; Fontsize/MarginV bu olcege gore (piksel DEGIL).
    altyaziBoyut: dikey ? 13 : 22, altyaziKenar: dikey ? 75 : 55,
    uyarilar,
  };
  ayar.TS = k => Math.round(k * ayar.W / 2560);          // 2560 genislige gore olcekli yazi boyutu
  return ayar;
}

// Ara dosyalarin onbellek anahtarina giren, goruntuyu etkileyen render alanlari
function gorunumOzeti(ayar, kodekAdi) {
  return [RENDER_SURUM, ayar.W, ayar.H, ayar.FPS, ayar.gecis, ayar.cfKare, ayar.efekt, ayar.renk, kodekAdi || ""].join("|");
}

module.exports = { ayarCoz, gorunumOzeti, RENKLER, CESIT, FPS, GRUP, FINAL_MAX, RENDER_SURUM, hashSayi, renkKodu };
