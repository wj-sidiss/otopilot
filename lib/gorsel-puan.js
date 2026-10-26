// GORSEL ADAYLARINI PUANLAR VE ELER (GO grubu) — saf fonksiyonlar.
//
// Secim KAYNAK ALAKASIYLA yapilir (dosya boyutuyla DEGIL):
//   puan = 40*kaynakSirasi + (35|15)*metinEslesmesi + 10*lisans + kucuk cozunurluk payi + yon cezasi (+ NASA payi)
// Cozunurluk yalnizca ALT ESIK: uzun kenar >=1280 zorunlu, >=1920 tercih.
// Kara liste TEK yerde: harita/diyagram/logo/heykel/oyuncak gibi alakasiz turler elenir;
// ama aramanin kendisi o kelimeyi iceriyorsa ("bronze statue of Lincoln") elenmez.
// Kara listeler YALNIZ BASLIGA bakar (VS videosu haric): NASA aciklamasi ("...instrument..."), Commons aciklama/kategorisi
// ("...scan...") ve etiketler tesaduf kelimeler tasir; "Pillars of Creation" aciklamasindaki "instrument" yuzunden elenmemeli.
// Etiket/aciklama yalniz ALAKA eslesmesinde, zorunlu/yasak kelime denetiminde ve VS'de sayilir.
// ALAKA SUZGECI (ctx.alakaSuzgeci, yalniz gorsel-bul): adayin baslik/aciklama/etiket metni VAR ama aramanin anlamli
// kelimelerinden HICBIRI gecmiyorsa aday `alakasiz` isaretlenir ve puani ALAKA_CEZA kadar duser ("Dünya" aramasinda
// Dunya Kupasi bileti). Akis bu adaylari yalniz alakali aday yetmezse kullanir (sahne bos kalmasin) ve uyarir.
// Pexels/Pixabay muaf: anlamsal/etiket aramasi yaparlar, aciklamalari kisadir (dogru sonucu yanlislikla eleriz).
"use strict";
const { katla, kelimeler } = require("./gorsel-sorgu.js");

const SINIR_ON = "(?<![\\p{L}\\p{N}])", SINIR_ARKA = "(?![\\p{L}\\p{N}])";
const reYap = parcalar => new RegExp(SINIR_ON + "(" + parcalar.join("|") + ")" + SINIR_ARKA, "giu");

// SERT: video icin hicbir konuda kullanisiz turler — elenir. (Para/gazete/pul/el yazmasi/imza/afis/tarama gibi bazen
// KONUNUN KENDISI olan turler burada degil, BELGE listesinde: cezali ama elenmez.)
const KATI = reYap(["maps?", "diagrams?", "charts?", "graphs?", "plots?", "schematics?", "infographics?", "logos?",
  "icons?", "clip ?art", "screenshots?", "coats? of arms", "banners?", "templates?", "mock-?ups?",
  "scanned", "book covers?", "magazine covers?", "album covers?", "cover art", "vectors?", "svg", "pdf",
  "wordmark", "emblems?", "badges?", "crest", "flowcharts?", "timelines?", "harita(?:lar)?", "grafik(?:ler)?"]);

// BELGE: basili/belge turleri (madeni para, banknot, pul, gazete, el yazmasi, imza, afis; "CT scan" gibi tarama). Finans/
// tarih/gazetecilik/saglik konularinda dogru gorsel OLABILIR ("Roman gold coin", "Front page of the New York Times 1969"):
// elenmez, puan kirilir. VS videosunda ELENIR. Portre aramasinda (yumusakKapali) da gecerlidir: pul/banknot portresi son
// tercih olsun.
const BELGE = reYap(["scans?", "posters?", "manuscripts?", "newspapers?", "stamps?", "coins?", "banknotes?",
  "postage", "signatures?"]);

// YUMUSAK: istenmeyen ama baska aday yoksa kullanilabilir (ornek: "Statue of Liberty" fotografi) — puan kirilir.
// VS videosunda bunlar da ELENIR (hayvan yerine heykel/oyuncak gelmesin).
const YUMUSAK = reYap(["drawings?", "paintings?", "illustrations?", "sketch(?:es)?", "engravings?", "lithographs?",
  "etchings?", "museum", "exhibit(?:ion)?s?", "replicas?", "models?", "cgi", "3d render(?:ing)?s?", "renders?",
  "rendering", "artwork", "digital art", "çizim(?:ler)?", "resim", "müze", "statues?", "statuettes?", "sculptures?",
  "bronze", "figurines?", "toys?", "plush", "stuffed", "taxidermy", "dioramas?", "miniatures?", "lego", "tattoos?",
  "cartoons?", "heykel(?:ler)?", "oyuncak(?:lar)?"]);

// VS videosunda (hayvan/nesne karsilastirmasi) yumusaklar da elenir + ekler
const VS_EK = reYap(["costumes?", "masks?", "skulls?", "skeletons?", "bones?", "fossils?", "mascots?", "puppets?",
  "plushies", "balloons?", "cakes?", "shirts?", "jerseys?", "mugs?", "pillows?", "stickers?"]);

function sorguIcerir(sorguKat, eslesme) {
  const e = katla(eslesme).replace(/s$/, "");
  return e.length >= 3 && sorguKat.includes(e);
}

// Metinde (sorgunun kendisinde GECMEYEN) kara kelime var mi? -> eslesen kelime | null
function karaBul(metin, sorgu, re) {
  const sorguKat = katla(sorgu || "");
  const t = String(metin || "");
  re.lastIndex = 0;
  let m;
  while ((m = re.exec(t)) !== null) if (!sorguIcerir(sorguKat, m[0])) { re.lastIndex = 0; return m[0].toLowerCase(); }
  re.lastIndex = 0;
  return null;
}

// ---------------------------------------------------------------- metin eslesmesi
function govdele(w) {
  w = katla(w);
  if (w.length > 4 && w.endsWith("ies")) return w.slice(0, -3) + "y";
  if (w.length > 3 && /(s|x|z|ch|sh)es$/.test(w)) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1);
  return w;
}
function sorguTokenleri(q, dil) {
  return [...new Set(kelimeler(q, dil || "en").map(govdele))];
}
function tokenKumesi(metin) {
  const s = new Set();
  const ham = String(metin == null ? "" : metin);
  // dosya adlarindaki bitisik yazim da sayilir: "FullMoon2010" -> full, moon, 2010 (birlesik hali de kalir)
  const ayrik = ham.replace(/(\p{Ll})(\p{Lu})/gu, "$1 $2").replace(/(\p{L})(\p{N})/gu, "$1 $2").replace(/(\p{N})(\p{L})/gu, "$1 $2");
  for (const m of ayrik === ham ? [ham] : [ham, ayrik])
    for (const w of katla(m).split(/[^\p{L}\p{N}]+/u)) if (w.length > 1) s.add(govdele(w));
  return s;
}
function tokenEsles(t, kume) {
  if (kume.has(t)) return true;
  if (t.length >= 5) for (const k of kume) if (k.length >= 5 && (k.startsWith(t) || t.startsWith(k))) return true;
  return false;
}
// Sorgunun icerik kelimelerinden kaci metinde var? (0..1)
function metinEslesme(sorguTok, metin) {
  if (!sorguTok.length) return 0;
  const kume = tokenKumesi(metin);
  let n = 0;
  for (const t of sorguTok) if (tokenEsles(t, kume)) n++;
  return n / sorguTok.length;
}

// ---------------------------------------------------------------- alaka suzgeci
const ALAKA_CEZA = 60;
const ALAKA_MUAF = new Set(["pexels", "pixabay"]);
// Bicim/nitelik kelimeleri tek basina alaka saymaz: "full moon closeup" icin "Full house" alakali DEGIL
const BICIM_KELIME = new Set(("photo photos photograph photography image images picture pictures pic shot shots view views " +
  "closeup close-up close detail details background wallpaper scene full hd 4k 8k macro aerial beautiful stunning amazing " +
  "dramatic cinematic style vintage stock quality resolution realistic").split(/\s+/).map(govdele));
function anlamliTokenler(sorguTok) {
  const l = (sorguTok || []).filter(t => !BICIM_KELIME.has(t));
  return l.length ? l : (sorguTok || []);
}
// Aday metni aramanin anlamli kelimelerinden hicbirini icermiyor mu? (metin yoksa ya da kaynak muafsa false)
function alakasizMi(a, sorguTok) {
  if (ALAKA_MUAF.has(a.kaynak)) return false;
  const metin = [a.baslik, a.etiket].filter(Boolean).join(" ");
  if (!metin.trim()) return false;
  const anlamli = anlamliTokenler(sorguTok);
  return anlamli.length > 0 && metinEslesme(anlamli, metin) === 0;
}

// ---------------------------------------------------------------- yon / oran
const HEDEF_ORAN = { yatay: 16 / 9, dikey: 9 / 16, vs: 1080 / 960 };
function oranFarki(en, boy, hedef) {
  const r = en / boy;
  return Math.max(r, hedef) / Math.min(r, hedef) - 1;
}

// ---------------------------------------------------------------- puanlama
// a: {kaynak, baslik, etiket, sira, en, boy, lisansSira, nasaKara?, nasaYumusak?}
// ctx: {sorgu, sorguTok, aramaDili, yon:"yatay|dikey|vs", hedefOran?, siraLimiti, kozmik, zorunlu:[], yasak:[], vs:bool,
//       minUzunKenar, oranAgirlik, alakaSuzgeci:bool}
// -> {puan, elendi: null | "neden", alakasiz?: true}
function puanla(a, ctx) {
  const metin = [a.baslik, a.etiket].filter(Boolean).join(" ");   // alaka, zorunlu, yasak (ve VS kara listesi)
  const kara = ctx.vs ? metin : String(a.baslik || "");            // genel kara liste: yalniz BASLIK
  const kati = karaBul(kara, ctx.sorgu, KATI);
  if (kati) return { puan: -Infinity, elendi: "kara liste: " + kati };
  if (a.kaynak === "nasa" && a.nasaKara) {
    const nk = karaBul(kara, ctx.sorgu, a.nasaKara);
    if (nk) return { puan: -Infinity, elendi: "kara liste: " + nk };
  }
  let yumusakCeza = 0;
  // portre/tarihsel aramalarda resim, heykel ve minyatur de gecerli kaynaktir (yumusakKapali); belge/basili turler
  // (BELGE) ve NASA donanim/tesis basliklari ise her modda cezali kalir
  const yum = ctx.yumusakKapali ? null : karaBul(kara, ctx.sorgu, YUMUSAK);
  const belge = karaBul(kara, ctx.sorgu, BELGE);
  const nasaYum = a.kaynak === "nasa" && a.nasaYumusak ? karaBul(kara, ctx.sorgu, a.nasaYumusak) : null;
  if (yum || belge || nasaYum) {
    if (ctx.vs) return { puan: -Infinity, elendi: "tür uyumsuz: " + (yum || belge || nasaYum) };
    yumusakCeza = 25;
  }
  if (ctx.vs) {
    const ek = karaBul(metin, ctx.sorgu, VS_EK);
    if (ek) return { puan: -Infinity, elendi: "tür uyumsuz: " + ek };
  }
  for (const y of ctx.yasak || []) {
    const re = new RegExp(SINIR_ON + katla(y).replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + SINIR_ARKA, "iu");
    if (re.test(katla(metin))) return { puan: -Infinity, elendi: "yasak kelime: " + y };
  }
  if (ctx.zorunlu && ctx.zorunlu.length) {
    const kume = tokenKumesi(metin);
    if (!ctx.zorunlu.some(z => tokenEsles(govdele(z), kume))) return { puan: -Infinity, elendi: "zorunlu kelime yok" };
  }
  const minKenar = ctx.minUzunKenar !== undefined ? ctx.minUzunKenar : 1280;
  const bilinenBoyut = a.en > 0 && a.boy > 0;
  if (bilinenBoyut && Math.max(a.en, a.boy) < minKenar)
    return { puan: -Infinity, elendi: "çözünürlük düşük (" + a.en + "x" + a.boy + ")" };

  const lim = ctx.siraLimiti || 40;
  const siraSkoru = 1 - Math.min(a.sira || 0, lim - 1) / Math.max(1, lim);
  const metinVar = metin.trim().length > 0;
  const metinSkoru = metinVar ? metinEslesme(ctx.sorguTok || [], metin) : 0.35;
  const metinAgirlik = ctx.aramaDili && ctx.aramaDili !== "en" ? 15 : 35;
  const lisansSkoru = [1, 0.6, 0.3, 0][a.lisansSira !== undefined ? a.lisansSira : 0] || 0;

  let coz = 2;
  if (bilinenBoyut) { const u = Math.max(a.en, a.boy); coz = u >= 1920 ? 4 : u >= 1600 ? 3 : 1; }

  let yon = 0;
  if (bilinenBoyut) {
    const hedef = ctx.hedefOran || HEDEF_ORAN[ctx.yon] || HEDEF_ORAN.yatay;
    const fark = oranFarki(a.en, a.boy, hedef);
    if (fark > 0.25) yon = -Math.min(ctx.vs ? 40 : 30, (ctx.oranAgirlik || 20) * fark);
  }
  const nasa = ctx.kozmik && a.kaynak === "nasa" ? 12 : 0;
  const alakasiz = !!ctx.alakaSuzgeci && alakasizMi(a, ctx.sorguTok);

  const puan = 40 * siraSkoru + metinAgirlik * metinSkoru + 10 * lisansSkoru + coz + yon + nasa - yumusakCeza - (alakasiz ? ALAKA_CEZA : 0);
  const r = { puan: Math.round(puan * 10) / 10, elendi: null };
  if (alakasiz) r.alakasiz = true;
  return r;
}

// Ayni gorseli iki kez almamak icin kanonik anahtar (# ve sunum parametreleri atilir, kucuk harf).
// Gorsel uzantili (statik) adreste sorgu dizgesi yalniz SUNUM ayaridir (?w=1920, ?auto=compress): tamamen atilir.
// Uzantisiz/dinamik uclarda KIMLIK sorgudadir (Smithsonian ids.si.edu/ids/deliveryService?id=X, Europeana saglayicilarinin
// .../imagehelper/download?id=Y): eskiden atiliyordu, o kaynagin TUM gorselleri tek anahtara dusuyordu (is basina 1 gorsel;
// ilk red tum kaynagi kapatiyordu). Bu uclarda yalniz KIMLIK parametreleri (id, uri, file ...) SIRALI tutulur; sunum/izleme/
// anahtar parametreleri (w, ixid, utm_*, wskey ...) yine atilir. Eski manifestler etkilenmez: anahtar her calismada kayittaki
// tam adresten yeniden hesaplanir.
const GORSEL_UZANTI = /\.(jpe?g|png|gif|webp|tiff?|jp2|bmp|avif|heic)$/i;
const KIMLIK_PARAM = /^(id|ids|iid|pid|guid|uri|url|file|filename|f|image|img|imageid|image_id|media|mediaid|media_id|asset|assetid|asset_id|object|objectid|object_id|record|recordid|record_id|item|itemid|item_id|doc|docid|handle|path|name|src)$/i;
function kanonikUrl(u) {
  const ham = String(u || "").split("#")[0];
  const s = ham.indexOf("?");
  const yol = (s < 0 ? ham : ham.slice(0, s)).replace(/\/+$/, "");
  let ek = "";
  if (s >= 0 && !GORSEL_UZANTI.test(yol)) {
    const ad = p => { const k = p.split("=")[0]; try { return decodeURIComponent(k); } catch (e) { return k; } };
    const kalan = ham.slice(s + 1).split("&").filter(p => p && KIMLIK_PARAM.test(ad(p))).sort();
    if (kalan.length) ek = "?" + kalan.join("&");
  }
  return (yol + ek).toLowerCase();
}

module.exports = {
  puanla, karaBul, KATI, BELGE, YUMUSAK, VS_EK, metinEslesme, sorguTokenleri, tokenKumesi, govdele, oranFarki,
  HEDEF_ORAN, kanonikUrl, reYap, alakasizMi, anlamliTokenler, ALAKA_CEZA, ALAKA_MUAF, BICIM_KELIME,
};
