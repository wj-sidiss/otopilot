// GORSEL KAYNAKLARI (GO grubu): Pexels, Pixabay, Wikimedia Commons, Openverse, NASA.
//
// Her kaynak ayni biçimde ADAY dondurur (sozlesme bolum 3 manifest alanlarina uygun):
//   {kaynak, url, yedekUrl[], baslik, etiket, lisans, lisansKodu, lisansSira, atifGerekli, atifOnerilen, atif,
//    kaynakUrl, indirmeUrl, en, boy, sira, uyari?}
// Lisans suzgeci BURADA calisir: NC/ND, serbest olmayan ve taninmayan lisanslar aday listesine hic girmez.
//
// KaynakYonetici: kaynak hatalarini SESSIZCE YUTMAZ — sayar, ilk hatalari yazar, 429/401/ardisik hatada kaynagi
// bu calisma icin kapatir, sonda kaynak bazli rapor verir (manifest.kaynakHatalari).
// Ag, `getir` islevi enjekte edilerek sahtelenir (testler); istemciler de degistirilebilir.
"use strict";
const { lisansCoz } = require("./gorsel-lisans.js");
const { reYap } = require("./gorsel-puan.js");
const { hataOzeti } = require("./gorsel-ag.js");

const enc = encodeURIComponent;
const ADLAR = { pexels: "Pexels", pixabay: "Pixabay", wikimedia: "Wikimedia", openverse: "Openverse", nasa: "NASA",
  met: "The Met", aic: "Art Institute of Chicago", cleveland: "Cleveland Museum of Art",
  smithsonian: "Smithsonian", unsplash: "Unsplash" };
const ANAHTARLI = ["pexels", "pixabay", "smithsonian", "unsplash"];
// Uzman (konu kaynagi) olanlar: yalniz sahne sanat/tarih konusuysa sorgulanir (gorsel-akis `haric`)
const MUZE = ["met", "aic", "cleveland", "smithsonian"];

// NASA'ya ozgu ek kara liste (ekip, toren, laboratuvar, grafik vb. sinematik degil). YALNIZ BASLIKTA aranir (gorsel-puan.js):
// aciklama/anahtar kelimeler tesaduf kelime tasir ("Pillars of Creation" aciklamasinda "instrument").
const KARA_NASA = reYap(["diagrams?", "charts?", "graphs?", "plots?", "schematics?", "spectrum",
  "light curves?", "infographics?", "logos?", "patch(?:es)?", "insignia", "awards?",
  "ceremon(?:y|ies)", "employees?", "staff", "meetings?", "conferences?", "briefings?",
  "cleanrooms?", "laborator(?:y|ies)", "technicians?", "engineers?", "workshops?", "classrooms?", "interviews?",
  "group photo", "test stands?", "badges?", "screenshots?", "map of", "timelines?"]);
// NASA'da bazen KONUNUN kendisi olan turler (Saturn V rampada, teleskop aynasi, sanatci cizimi, astronot portresi,
// simulasyon): elenmez, puan kirilir. Sinematik olmasa da baska aday yoksa kullanilabilir.
const NASA_YUMUSAK = reYap(["simulations?", "illustrations? of", "portraits? of", "headshots?", "facilit(?:y|ies)",
  "assembly", "hardware", "instruments?", "antenna", "dish", "telescope mirrors?", "launch pads?", "control rooms?"]);

const temizMetin = v => String(v == null ? "" : v).replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/gi, " ").replace(/\s+/g, " ").trim();
// "https://www.pexels.com/photo/brown-bear-on-grass-2014422/" -> "brown bear on grass"
function adresSlug(u) {
  try {
    const son = new URL(u).pathname.split("/").filter(Boolean).pop() || "";
    return son.replace(/-\d+$/, "").replace(/[-_]+/g, " ").replace(/\.\w{2,4}$/, "").trim();
  } catch (e) { return ""; }
}
const tekSatir = (s, maks) => temizMetin(s).slice(0, maks || 200);

function yonUygula(o) { return o && o.yon ? o.yon : "yatay"; }

// ---------------------------------------------------------------- PEXELS
async function pexelsAra(q, o, c) {
  if (!c.anahtar) return [];
  const yon = yonUygula(o);
  const orient = yon === "dikey" ? "portrait" : yon === "kare" ? "square" : yon === "hepsi" ? "" : "landscape";
  let u = "https://api.pexels.com/v1/search?query=" + enc(q) + "&per_page=" + ((o && o.limit) || 40) + (orient ? "&orientation=" + orient : "");
  if (o && o.locale) u += "&locale=" + enc(o.locale);
  const d = await c.getir.json(u, { basliklar: { Authorization: c.anahtar }, zamanAsimiMs: 25000 });
  const lis = lisansCoz("pexels");
  return (d.photos || []).map((p, i) => {
    const s = p.src || {};
    const taban = s.original || s.large2x || s.large;
    if (!taban) return null;
    // src.large2x en fazla ~1880 px; original + boyut parametresi 2560 px'e kadar verir (bulgu B025)
    const buyuk = s.original
      ? s.original + "?auto=compress&cs=tinysrgb&" + (p.width >= p.height ? "w=" + Math.min(p.width || 2560, 2560) : "h=" + Math.min(p.height || 2560, 2560))
      : s.large2x;
    return Object.assign({
      kaynak: "pexels", url: buyuk, yedekUrl: [s.large2x, s.large].filter(x => x && x !== buyuk),
      baslik: tekSatir(p.alt) || adresSlug(p.url), etiket: adresSlug(p.url),
      atif: tekSatir(p.photographer, 100), kaynakUrl: p.url || "", indirmeUrl: buyuk,
      en: p.width || 0, boy: p.height || 0, sira: i,
    }, lis);
  }).filter(Boolean);
}

// ---------------------------------------------------------------- PIXABAY
async function pixabayAra(q, o, c) {
  if (!c.anahtar) return [];
  const yon = yonUygula(o);
  const orient = yon === "dikey" ? "vertical" : yon === "hepsi" || yon === "kare" ? "all" : "horizontal";
  let u = "https://pixabay.com/api/?key=" + enc(c.anahtar) + "&q=" + enc(q) + "&image_type=photo&per_page=" + ((o && o.limit) || 40) +
          "&safesearch=true&orientation=" + orient;
  // largeImageURL en uzun kenarda ~1280 px: uzun kenar 1280'den kucuk kaynak zaten bunu veremez
  if (yon === "dikey") u += "&min_height=1280"; else if (yon !== "hepsi" && yon !== "kare") u += "&min_width=1280";
  if (o && o.locale) u += "&lang=" + enc(String(o.locale).slice(0, 2));
  const d = await c.getir.json(u, { zamanAsimiMs: 25000 });
  const lis = lisansCoz("pixabay");
  return (d.hits || []).map((h, i) => {
    const url = h.largeImageURL || h.webformatURL;
    if (!url) return null;
    return Object.assign({
      kaynak: "pixabay", url, yedekUrl: [], baslik: tekSatir(h.tags) || adresSlug(h.pageURL), etiket: adresSlug(h.pageURL),
      atif: tekSatir(h.user, 100), kaynakUrl: h.pageURL || "", indirmeUrl: url,
      en: h.imageWidth || 0, boy: h.imageHeight || 0, sira: i,
    }, lis);
  }).filter(Boolean);
}

// ---------------------------------------------------------------- WIKIMEDIA COMMONS
async function wikimediaAra(q, o, c, red) {
  const u = "https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=" + enc(q + " filetype:bitmap") +
    "&gsrnamespace=6&gsrlimit=" + ((o && o.limit) || 30) +
    // iiurlwidth=1920: Commons'un standart kucuk resim basamagi (320/640/800/1024/1280/1920/2560/3840); basamak disi
    // genislikler 429 alabildigi icin iiurlheight EKLENMEZ (dikey gorselde bile genislik 1920 kalir)
    "&prop=imageinfo&iiprop=url|size|mime|extmetadata&iiurlwidth=1920" +
    "&iiextmetadatafilter=" + enc("LicenseShortName|Artist|ImageDescription|ObjectName|NonFree|Categories") +
    "&format=json&formatversion=2&origin=*";
  const d = await c.getir.json(u, { zamanAsimiMs: 30000 });
  const sayfalar = (d.query && d.query.pages) || [];
  const dizi = Array.isArray(sayfalar) ? sayfalar : Object.values(sayfalar);
  dizi.sort((a, b) => (a.index || 0) - (b.index || 0));
  const sonuc = [];
  dizi.forEach((p, i) => {
    const ii = p.imageinfo && p.imageinfo[0];
    if (!ii || !ii.thumburl) return;
    if (!/^image\/(jpeg|png)$/i.test(ii.mime || "")) return;
    const m = ii.extmetadata || {};
    const v = k => (m[k] && m[k].value !== undefined ? m[k].value : "");
    const lis = lisansCoz("wikimedia", { kisaAd: temizMetin(v("LicenseShortName")), nonFree: temizMetin(v("NonFree")) });
    if (!lis.kabul) { if (red) red("wikimedia", lis.neden); return; }
    const dosyaAd = String(p.title || "").replace(/^File:/i, "").replace(/\.\w{2,4}$/, "").replace(/[_-]+/g, " ");
    const aciklama = tekSatir(v("ImageDescription"), 200) || tekSatir(v("ObjectName"), 120);
    const kat = temizMetin(v("Categories")).replace(/\|/g, " ").slice(0, 200);
    sonuc.push(Object.assign({
      kaynak: "wikimedia", url: ii.thumburl, yedekUrl: ii.url && ii.url !== ii.thumburl ? [ii.url] : [],
      baslik: dosyaAd.trim(), etiket: [aciklama, kat].filter(Boolean).join(" "),
      atif: tekSatir(v("Artist"), 120), kaynakUrl: ii.descriptionurl || "", indirmeUrl: ii.thumburl,
      en: ii.thumbwidth || ii.width || 0, boy: ii.thumbheight || ii.height || 0, sira: i,
    }, lis));
  });
  return sonuc;
}

// ---------------------------------------------------------------- OPENVERSE
async function openverseAra(q, o, c, red) {
  // sunucu tarafi lisans suzgeci: ticari kullanima + degisikliğe acik olanlar (NC/ND disarida)
  // page_size: anahtarsiz (anonim) kullanimda en cok 20 kabul edilir; fazlasi 400 ile reddedilir (eski kod 40 isteyip hatayi yutuyordu)
  const u = "https://api.openverse.org/v1/images/?q=" + enc(q) + "&page_size=" + Math.min((o && o.limit) || 20, 20) +
            "&mature=false&license_type=" + enc("commercial,modification") + "&extension=" + enc("jpg,png");
  const d = await c.getir.json(u, { zamanAsimiMs: 25000 });
  const sonuc = [];
  (d.results || []).forEach((r, i) => {
    if (!r.url) return;
    const lis = lisansCoz("openverse", { license: r.license, version: r.license_version });      // istemci tarafi: ikinci kontrol
    if (!lis.kabul) { if (red) red("openverse", lis.neden); return; }
    const etiketler = (r.tags || []).map(t => t && t.name).filter(Boolean).join(" ");
    sonuc.push(Object.assign({
      kaynak: "openverse", url: r.url, yedekUrl: [], baslik: tekSatir(r.title) || adresSlug(r.foreign_landing_url),
      etiket: tekSatir(etiketler, 200), atif: tekSatir(r.creator, 120),
      kaynakUrl: r.foreign_landing_url || "", indirmeUrl: r.url,
      en: r.width || 0, boy: r.height || 0, sira: i,
    }, lis));
  });
  return sonuc;
}

// ---------------------------------------------------------------- NASA
async function nasaAra(q, o, c) {
  const u = "https://images-api.nasa.gov/search?q=" + enc(q) + "&media_type=image&page_size=" + ((o && o.limit) || 30);
  const d = await c.getir.json(u, { zamanAsimiMs: 30000 });
  const ogeler = (d.collection && d.collection.items) || [];
  const lis = lisansCoz("nasa");
  const sonuc = [];
  ogeler.slice(0, (o && o.limit) || 30).forEach((it, i) => {
    const v = it.data && it.data[0];
    const bag = it.links && it.links[0];
    if (!v || !bag || !bag.href) return;
    const aciklama = tekSatir(v.description, 300);
    if (/©|\bcopyright\b/i.test(aciklama)) return;             // NASA arsivindeki ucuncu taraf telifli goruntuler
    const taban = bag.href.replace(/~(thumb|small|medium|large|orig)\.(jpe?g|png)$/i, "");
    const adaylar = taban !== bag.href ? [taban + "~orig.jpg", taban + "~large.jpg", taban + "~medium.jpg"] : [bag.href];
    sonuc.push(Object.assign({
      kaynak: "nasa", url: adaylar[0], yedekUrl: adaylar.slice(1), baslik: tekSatir(v.title) || q,
      etiket: [aciklama, (v.keywords || []).join(" ")].filter(Boolean).join(" ").slice(0, 300),
      atif: [v.photographer, v.secondary_creator].filter(Boolean).join(" / ") || "NASA",
      kaynakUrl: v.nasa_id ? "https://images.nasa.gov/details/" + enc(v.nasa_id) : "", indirmeUrl: adaylar[0],
      en: 0, boy: 0, sira: i, nasaKara: KARA_NASA, nasaYumusak: NASA_YUMUSAK,
    }, lis));
  });
  return sonuc;
}

// ---------------------------------------------------------------- MUZELER (anahtarsiz, yalniz CC0 / kamu mali)
// The Met: arama kimlik listesi doner, her eser ayri alinir -> en cok 8 eser (nazik davran)
async function metAra(q, o, c) {
  const kok = "https://collectionapi.metmuseum.org/public/collection/v1/";
  const d = await c.getir.json(kok + "search?hasImages=true&isPublicDomain=true&q=" + enc(q), { zamanAsimiMs: 25000 });
  const ids = (d.objectIDs || []).slice(0, Math.min((o && o.limit) || 8, 8));
  const lis = lisansCoz("met");
  const sonuc = [];
  for (let i = 0; i < ids.length; i++) {
    let e;
    try { e = await c.getir.json(kok + "objects/" + ids[i], { zamanAsimiMs: 20000 }); } catch (err) { if (i === 0) throw err; continue; }
    if (!e || !e.isPublicDomain || !e.primaryImage) continue;
    sonuc.push(Object.assign({
      kaynak: "met", url: e.primaryImage, yedekUrl: [e.primaryImageSmall].filter(Boolean),
      baslik: tekSatir(e.title), etiket: tekSatir([e.objectName, e.culture, e.period, e.medium, e.tags && e.tags.map(t => t.term).join(" ")].filter(Boolean).join(" "), 200),
      atif: tekSatir([e.artistDisplayName || e.culture, e.objectDate].filter(Boolean).join(", ") + " — The Metropolitan Museum of Art", 120),
      kaynakUrl: e.objectURL || "", indirmeUrl: e.primaryImage, en: 0, boy: 0, sira: i,
    }, lis));
  }
  return sonuc;
}

async function aicAra(q, o, c) {
  const alan = "id,title,artist_display,date_display,image_id,is_public_domain,thumbnail,subject_titles,style_title";
  const u = "https://api.artic.edu/api/v1/artworks/search?q=" + enc(q) + "&query[term][is_public_domain]=true&fields=" + alan +
            "&limit=" + Math.min((o && o.limit) || 20, 40);
  const d = await c.getir.json(u, { zamanAsimiMs: 25000 });
  const iiif = (d.config && d.config.iiif_url) || "https://www.artic.edu/iiif/2";
  const lis = lisansCoz("aic");
  return (d.data || []).map((e, i) => {
    if (!e.is_public_domain || !e.image_id) return null;
    const url = iiif + "/" + e.image_id + "/full/1686,/0/default.jpg";            // AIC'nin onerdigi guvenli genislik
    return Object.assign({
      kaynak: "aic", url, yedekUrl: [iiif + "/" + e.image_id + "/full/843,/0/default.jpg"],
      baslik: tekSatir(e.title), etiket: tekSatir([e.style_title, (e.subject_titles || []).join(" "), e.thumbnail && e.thumbnail.alt_text].filter(Boolean).join(" "), 200),
      atif: tekSatir(e.artist_display, 100) + " — Art Institute of Chicago", kaynakUrl: "https://www.artic.edu/artworks/" + e.id,
      indirmeUrl: url, en: (e.thumbnail && e.thumbnail.width) || 0, boy: (e.thumbnail && e.thumbnail.height) || 0, sira: i,
    }, lis);
  }).filter(Boolean);
}

async function clevelandAra(q, o, c) {
  const u = "https://openaccess-api.clevelandart.org/api/artworks/?q=" + enc(q) + "&has_image=1&cc0=1&limit=" + Math.min((o && o.limit) || 20, 40);
  const d = await c.getir.json(u, { zamanAsimiMs: 25000 });
  const lis = lisansCoz("cleveland");
  return (d.data || []).map((e, i) => {
    if (String(e.share_license_status || "").toUpperCase() !== "CC0") return null;
    const im = e.images || {};
    const buyuk = (im.web && im.web.url) || (im.print && im.print.url);
    if (!buyuk) return null;
    return Object.assign({
      kaynak: "cleveland", url: buyuk, yedekUrl: [im.print && im.print.url].filter(x => x && x !== buyuk),
      baslik: tekSatir(e.title), etiket: tekSatir([e.type, e.technique, e.culture && e.culture.join(" ")].filter(Boolean).join(" "), 200),
      atif: tekSatir((e.creators && e.creators[0] && e.creators[0].description) || "", 100) + " — Cleveland Museum of Art",
      kaynakUrl: e.url || "", indirmeUrl: buyuk,
      en: (im.web && im.web.width) || 0, boy: (im.web && im.web.height) || 0, sira: i,
    }, lis);
  }).filter(Boolean);
}

// Smithsonian Open Access (api.data.gov ucretsiz anahtari: SMITHSONIAN_KEY). Yalniz CC0 isaretli ve gorselli kayitlar.
async function smithsonianAra(q, o, c) {
  if (!c.anahtar) return [];
  const u = "https://api.si.edu/openaccess/api/v1.0/search?api_key=" + enc(c.anahtar) + "&q=" + enc(q + " AND online_media_type:Images AND media_usage:CC0") +
            "&rows=" + Math.min((o && o.limit) || 20, 40);
  const d = await c.getir.json(u, { zamanAsimiMs: 25000 });
  const lis = lisansCoz("smithsonian");
  const sonuc = [];
  ((d.response && d.response.rows) || []).forEach((r, i) => {
    const icerik = r.content || {};
    const medya = ((icerik.descriptiveNonRepeating || {}).online_media || {}).media || [];
    const m = medya.find(x => x && x.type === "Images" && x.content && x.usage && String(x.usage.access).toUpperCase() === "CC0");
    if (!m) return;
    const yazar = (((icerik.freetext || {}).name || [])[0] || {}).content || "";
    sonuc.push(Object.assign({
      kaynak: "smithsonian", url: m.content, yedekUrl: [m.thumbnail].filter(Boolean),
      baslik: tekSatir(r.title), etiket: tekSatir(((icerik.indexedStructured || {}).topic || []).join(" "), 200),
      atif: tekSatir(yazar, 100) + " — Smithsonian Institution", kaynakUrl: (icerik.descriptiveNonRepeating || {}).record_link || "",
      indirmeUrl: m.content, en: 0, boy: 0, sira: i,
    }, lis));
  });
  return sonuc;
}

// Unsplash (ucretsiz gelistirici anahtari: UNSPLASH_KEY). Unsplash Lisansi ticari kullanima izin verir; yonerge geregi fotografciyi anariz.
async function unsplashAra(q, o, c) {
  if (!c.anahtar) return [];
  const yon = yonUygula(o);
  const orient = yon === "dikey" ? "portrait" : yon === "kare" ? "squarish" : yon === "hepsi" ? "" : "landscape";
  const u = "https://api.unsplash.com/search/photos?query=" + enc(q) + "&per_page=" + Math.min((o && o.limit) || 30, 30) + (orient ? "&orientation=" + orient : "");
  const d = await c.getir.json(u, { basliklar: { Authorization: "Client-ID " + c.anahtar }, zamanAsimiMs: 25000 });
  const lis = lisansCoz("unsplash");
  return (d.results || []).map((p, i) => {
    const s = p.urls || {};
    const url = s.regular || s.full;
    if (!url) return null;
    return Object.assign({
      kaynak: "unsplash", url, yedekUrl: [s.small].filter(Boolean),
      baslik: tekSatir(p.description || p.alt_description), etiket: tekSatir((p.tags || []).map(t => t.title).join(" "), 200),
      atif: tekSatir(p.user && p.user.name, 100) + " — Unsplash", kaynakUrl: (p.links && p.links.html) || "", indirmeUrl: url,
      en: p.width || 0, boy: p.height || 0, sira: i,
    }, lis);
  }).filter(Boolean);
}

const ISTEMCILER = { pexels: pexelsAra, pixabay: pixabayAra, wikimedia: wikimediaAra, openverse: openverseAra, nasa: nasaAra,
  met: metAra, aic: aicAra, cleveland: clevelandAra, smithsonian: smithsonianAra, unsplash: unsplashAra };
// Kaynaklar arasi en kisa aralik (ms): nazik davran, hiz sinirina takilma
const ARALIK = { pexels: 0, pixabay: 0, wikimedia: 1000, openverse: 600, nasa: 300, met: 400, aic: 400, cleveland: 400, smithsonian: 300, unsplash: 0 };

// ---------------------------------------------------------------- YONETICI
class KaynakYonetici {
  // secenek: {getir, anahtarlar:{pexels,pixabay}, etkin:{pexels:true,...}, istemciler, log, uyari, bekle, aralik}
  constructor(secenek) {
    const o = secenek || {};
    this.getir = o.getir;
    this.anahtarlar = o.anahtarlar || {};
    this.istemciler = Object.assign({}, ISTEMCILER, o.istemciler || {});
    this.log = o.log || (() => {});
    this.uyari = o.uyari || (() => {});
    this.bekleFn = o.bekle || (ms => new Promise(r => setTimeout(r, ms)));
    this.aralik = Object.assign({}, ARALIK, o.aralik || {});
    this.memo = new Map();
    this.sonCagri = {};
    this.durum = {};
    const etkin = o.etkin || {};
    for (const ad of Object.keys(ADLAR)) {
      const anahtarGerekli = ANAHTARLI.includes(ad);
      const kapali = etkin[ad] === false ? "ayardan kapatıldı"
        : (anahtarGerekli && !this.anahtarlar[ad]) ? "anahtar yok" : null;
      this.durum[ad] = { acik: !kapali, devreDisi: !!kapali, kapaliNeden: kapali, basarili: 0, hata: 0, ardisik: 0,
                         lisansElenen: 0, lisansNedenleri: {}, yazilanHata: 0, kapandi: false };
    }
  }

  aktifler() { return Object.keys(this.durum).filter(a => this.durum[a].acik); }
  acikMi(ad) { return !!(this.durum[ad] && this.durum[ad].acik); }
  tumuKapaliMi() { return this.aktifler().length === 0; }

  kapat(ad, neden) {
    const d = this.durum[ad];
    if (!d.acik) return;
    d.acik = false; d.kapandi = true; d.kapaliNeden = neden;
    const m = ADLAR[ad] + " kapatıldı: " + neden + " — diğer kaynaklarla devam ediliyor.";
    this.log("  ! " + m);
    this.uyari(m);
  }

  hataIsle(ad, e, sorgu) {
    const d = this.durum[ad];
    d.hata++; d.ardisik++;
    const kod = e && e.kod;
    if (d.yazilanHata < 3) {
      d.yazilanHata++;
      this.log("  ! " + ADLAR[ad] + ": " + hataOzeti(e) + (sorgu ? ' (arama: "' + sorgu + '")' : ""));
    }
    if (kod === 401 || kod === 403) {
      this.kapat(ad, (ANAHTARLI.includes(ad) ? "anahtar geçersiz" : "erişim reddedildi") + " (HTTP " + kod + ")");
    } else if (kod === 429) {
      const bk = e.bekleSn > 0 ? ", yaklaşık " + Math.max(1, Math.ceil(e.bekleSn / 60)) + " dk sonra açılır" : "";
      this.kapat(ad, "istek limiti doldu (429" + bk + ")");
    } else if (kod === 400 && ad === "pixabay") {
      this.kapat(ad, "istek reddedildi (HTTP 400, anahtarı kontrol et)");
    } else if (d.ardisik >= 3) {
      this.kapat(ad, "3 ardışık hata (" + hataOzeti(e) + ")");
    }
  }

  async aralikBekle(ad) {
    const gerek = this.aralik[ad] || 0;
    if (!gerek) return;
    const gecen = Date.now() - (this.sonCagri[ad] || 0);
    if (gecen < gerek) await this.bekleFn(gerek - gecen);
    this.sonCagri[ad] = Date.now();
  }

  // Asla firlatmaz; hata/kapali ise [] doner (hata sayilir ve loglanir).
  async ara(ad, q, o) {
    const d = this.durum[ad];
    if (!d || !d.acik) return [];
    const opt = o || {};
    const anahtar = `${ad}|${q}|${opt.yon || ""}|${opt.locale || ""}|${opt.limit || ""}`;
    if (this.memo.has(anahtar)) return this.memo.get(anahtar);
    const is = (async () => {
      await this.aralikBekle(ad);
      if (!d.acik) return [];
      try {
        const kayit = (kaynak, neden) => { d.lisansElenen++; d.lisansNedenleri[neden] = (d.lisansNedenleri[neden] || 0) + 1; };
        const r = await this.istemciler[ad](q, opt, { getir: this.getir, anahtar: this.anahtarlar[ad] }, kayit);
        d.basarili++; d.ardisik = 0;
        return (r || []).map(a => Object.assign({ aramaIfadesi: q }, a));
      } catch (e) {
        this.memo.delete(anahtar);                  // basarisiz sonucu onbellekte tutma: sonraki deneme yeniden sorar
        this.hataIsle(ad, e, q);
        return [];
      }
    })();
    this.memo.set(anahtar, is);
    return is;
  }

  // Tum acik kaynaklari paralel sorgular -> birlesik aday listesi
  async hepsindeAra(q, o, secenek) {
    const haric = (secenek && secenek.haric) || [];
    const adlar = this.aktifler().filter(a => !haric.includes(a) && !(secenek && secenek.yalniz && !secenek.yalniz.includes(a)));
    const sonuc = await Promise.all(adlar.map(a => this.ara(a, q, o)));
    return [].concat(...sonuc);
  }

  // manifest.kaynakHatalari: {wikimedia: 2, openverse: "kapali (429...)"}
  kaynakHatalari() {
    const r = {};
    for (const [ad, d] of Object.entries(this.durum)) {
      if (d.devreDisi) continue;
      if (d.kapandi) r[ad] = "kapali (" + d.kapaliNeden + ")";
      else if (d.hata > 0) r[ad] = d.hata;
    }
    return r;
  }

  // gelen: {kaynak: indirilenGorselSayisi}
  ozetMetni(gelen) {
    const g = gelen || {};
    const parca = [];
    for (const ad of Object.keys(ADLAR)) {
      const d = this.durum[ad];
      if (d.devreDisi && !g[ad]) continue;
      let s = ADLAR[ad] + " " + (g[ad] || 0) + " görsel";
      const ek = [];
      if (d.hata) ek.push(d.hata + " hata");
      if (d.lisansElenen) ek.push(d.lisansElenen + " lisans nedeniyle elendi");
      if (d.kapandi) ek.push("kapandı: " + d.kapaliNeden);
      if (ek.length) s += " (" + ek.join(", ") + ")";
      parca.push(s);
    }
    return parca.join(" · ");
  }
}

module.exports = { KaynakYonetici, ISTEMCILER, ADLAR, KARA_NASA, NASA_YUMUSAK, pexelsAra, pixabayAra, wikimediaAra, openverseAra, nasaAra, metAra, aicAra, clevelandAra, smithsonianAra, unsplashAra, MUZE, adresSlug, temizMetin };
