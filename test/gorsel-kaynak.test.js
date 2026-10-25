// GO — kaynak istemcileri (Pexels, Pixabay, Wikimedia, Openverse, NASA) ve KaynakYonetici.
// Ag sahtelenir: getir.json(url, secenek) cagrilarini kaydeder, hazir JSON doner.
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const yardim = require("./gorsel-yardim.js");
const kaynak = require("../lib/gorsel-kaynak.js");
const ag = require("../lib/gorsel-ag.js");

test.after(() => yardim.temizle());

// url -> JSON eslemesiyle sahte getir
function sahteGetir(yanitlar) {
  const cagrilar = [];
  const getir = async (url, o) => { cagrilar.push({ url, o }); const y = yanitlar(url, o); if (y instanceof Error) throw y; return { govde: Buffer.from(JSON.stringify(y)), durum: 200, basliklar: {} }; };
  getir.json = async (url, o) => { cagrilar.push({ url, o }); const y = yanitlar(url, o); if (y instanceof Error) throw y; return y; };
  getir.gorsel = getir;
  getir.cagrilar = cagrilar;
  return getir;
}

test("pexels: orientation/locale, Authorization basligi, original+boyut parametresi, alt yoksa URL slug'i etiket olur", async () => {
  const g = sahteGetir(() => ({ photos: [
    { id: 1, width: 4000, height: 3000, url: "https://www.pexels.com/photo/brown-bear-on-grass-1/", photographer: "Ayse", alt: "",
      src: { original: "https://images.pexels.com/photos/1/pexels-photo-1.jpeg", large2x: "https://images.pexels.com/photos/1/l2x.jpeg", large: "https://images.pexels.com/photos/1/l.jpeg" } },
    { id: 2, width: 1500, height: 2400, url: "https://www.pexels.com/photo/portrait-2/", photographer: "Can", alt: "a portrait",
      src: { original: "https://images.pexels.com/photos/2/pexels-photo-2.jpeg" } },
  ] }));
  const r = await kaynak.pexelsAra("polar bear", { yon: "yatay", locale: "tr-TR" }, { getir: g, anahtar: "PEXELS-ANAHTAR" });
  const c = g.cagrilar[0];
  assert.match(c.url, /orientation=landscape/); assert.match(c.url, /locale=tr-TR/); assert.match(c.url, /per_page=40/);
  assert.equal(c.o.basliklar.Authorization, "PEXELS-ANAHTAR");
  assert.match(r[0].url, /pexels-photo-1\.jpeg\?auto=compress&cs=tinysrgb&w=2560$/);
  assert.deepEqual(r[0].yedekUrl, ["https://images.pexels.com/photos/1/l2x.jpeg", "https://images.pexels.com/photos/1/l.jpeg"]);
  assert.match(r[1].url, /h=2400$/);                          // dikey: yukseklik parametresi
  assert.equal(r[0].baslik, "brown bear on grass");           // alt bos -> slug
  assert.equal(r[0].lisansKodu, "pexels"); assert.equal(r[0].atif, "Ayse"); assert.equal(r[0].kaynakUrl, "https://www.pexels.com/photo/brown-bear-on-grass-1/");
  assert.equal(r[0].sira, 0); assert.equal(r[1].sira, 1);     // lisans alani kaynak sirasini EZMEMELI
  assert.equal(r[0].en, 4000);
  assert.deepEqual(await kaynak.pexelsAra("x", {}, { getir: g, anahtar: "" }), []);   // anahtar yok -> bos
});

test("pixabay: yon parametreleri, anahtar URL'de, hata mesajina anahtar SIZMAZ", async () => {
  const g = sahteGetir(() => ({ hits: [{ largeImageURL: "https://pixabay.com/get/x_1280.jpg", tags: "polar bear, arctic", user: "Mehmet", pageURL: "https://pixabay.com/photos/polar-bear-123/", imageWidth: 5000, imageHeight: 3000 }] }));
  const r = await kaynak.pixabayAra("polar bear", { yon: "dikey", locale: "tr-TR" }, { getir: g, anahtar: "PIX-ANAHTAR" });
  assert.match(g.cagrilar[0].url, /orientation=vertical/); assert.match(g.cagrilar[0].url, /min_height=1280/); assert.match(g.cagrilar[0].url, /lang=tr/);
  assert.equal(r[0].lisansKodu, "pixabay"); assert.equal(r[0].atifGerekli, false);
  const y = new kaynak.KaynakYonetici({ getir: sahteGetir(() => new ag.AgHatasi("HTTP 500", 500)), anahtarlar: { pixabay: "PIX-ANAHTAR" }, etkin: { pexels: false }, log: m => logl.push(m), bekle: yardim.uyku0 });
  const logl = [];
  await y.ara("pixabay", "bear", {});
  assert.ok(!logl.some(m => /PIX-ANAHTAR/.test(m)), "log anahtar icermemeli");
});

test("wikimedia: NC/ND/GFDL/non-free ELENIR, yalniz jpeg/png, kaynak sirasi `index`e gore, atif+lisans toplanir", async () => {
  const sayfa = (i, ad, mime, lisans, ek) => ({ pageid: i, title: "File:" + ad, index: i, imageinfo: [{ thumburl: "https://upload.wikimedia.org/thumb/" + ad, url: "https://upload.wikimedia.org/orig/" + ad, descriptionurl: "https://commons.wikimedia.org/wiki/File:" + ad,
    width: 3000, height: 2000, thumbwidth: 1920, thumbheight: 1280, mime, extmetadata: Object.assign({ LicenseShortName: { value: lisans }, Artist: { value: '<a href="x">Ali <b>Veli</b></a>' }, ImageDescription: { value: "A <i>polar bear</i> on ice" } }, ek || {}) }] });
  const g = sahteGetir(() => ({ query: { pages: [
    sayfa(3, "Ice_NC.jpg", "image/jpeg", "CC BY-NC 4.0"), sayfa(2, "Bear_BYSA.jpg", "image/jpeg", "CC BY-SA 4.0"), sayfa(1, "Bear_PD.jpg", "image/jpeg", "Public domain"),
    sayfa(4, "Bear_ND.jpg", "image/jpeg", "CC BY-ND 2.0"), sayfa(5, "Bear.svg", "image/svg+xml", "CC0"), sayfa(6, "Bear_NF.jpg", "image/jpeg", "CC BY 4.0", { NonFree: { value: "true" } }),
    sayfa(7, "Bear_GFDL.jpg", "image/jpeg", "GFDL 1.2"), sayfa(8, "Bear_BY.png", "image/png", "CC BY 2.0"),
  ] } }));
  const elenen = [];
  const r = await kaynak.wikimediaAra("polar bear", {}, { getir: g }, (k, n) => elenen.push(n));
  assert.deepEqual(r.map(x => x.baslik), ["Bear PD", "Bear BYSA", "Bear BY"], "index sirasi + lisans/mime suzgeci");
  assert.equal(r[0].lisansKodu, "pdm"); assert.equal(r[1].lisansKodu, "by-sa"); assert.ok(r[1].uyari);
  assert.equal(r[2].lisansKodu, "by"); assert.equal(r[2].atifGerekli, true);
  assert.equal(r[0].atif, "Ali Veli", "HTML etiketleri atilmali");
  assert.match(r[0].etiket, /polar bear/);
  assert.equal(r[0].en, 1920); assert.equal(r[0].boy, 1280);
  assert.ok(elenen.some(n => /NC/.test(n)) && elenen.some(n => /ND/.test(n)));
  assert.match(g.cagrilar[0].url, /filetype%3Abitmap/);
});

test("openverse: sorguya license_type=commercial,modification eklenir; NC/ND donse bile istemci tarafinda elenir", async () => {
  const g = sahteGetir(() => ({ results: [
    { url: "https://flickr/1.jpg", title: "Bear", license: "by", license_version: "2.0", creator: "Zeynep", foreign_landing_url: "https://flickr.com/p/1", width: 2000, height: 1300, tags: [{ name: "bear" }, { name: "arctic" }] },
    { url: "https://flickr/2.jpg", title: "Bear NC", license: "by-nc", license_version: "2.0", creator: "X", foreign_landing_url: "https://flickr.com/p/2", width: 2000, height: 1300 },
    { url: "https://flickr/3.jpg", title: "Bear ND", license: "by-nd", license_version: "2.0", creator: "Y", foreign_landing_url: "https://flickr.com/p/3", width: null, height: null },
    { url: "https://flickr/4.jpg", title: "Bear CC0", license: "cc0", license_version: "1.0", creator: "", foreign_landing_url: "https://flickr.com/p/4", width: null, height: null },
  ] }));
  const elenen = [];
  const r = await kaynak.openverseAra("bear", {}, { getir: g }, (k, n) => elenen.push(n));
  assert.match(decodeURIComponent(g.cagrilar[0].url), /license_type=commercial,modification/);
  assert.deepEqual(r.map(x => x.baslik), ["Bear", "Bear CC0"]);
  assert.equal(r[0].lisans, "CC BY 2.0"); assert.equal(r[0].atif, "Zeynep"); assert.match(r[0].etiket, /arctic/);
  assert.equal(r[1].en, 0, "boyut bilinmiyorsa uydurma yok (indirince dosyadan okunur)");
  assert.equal(elenen.length, 2);
});

test("nasa: kamu mali, ~orig/~large/~medium yedekleri, telifli aciklama ve kara liste elenir, boyut UYDURULMAZ", async () => {
  const oge = (id, baslik, aciklama) => ({ data: [{ title: baslik, description: aciklama, nasa_id: id, keywords: ["galaxy"], photographer: "NASA/ESA" }], links: [{ href: "https://images-assets.nasa.gov/image/" + id + "/" + id + "~thumb.jpg" }] });
  const g = sahteGetir(() => ({ collection: { items: [oge("A1", "Spiral galaxy M51", "A beautiful galaxy"), oge("B2", "Image Credit: someone", "Copyright 2020 © Foo"), oge("C3", "Team meeting at JPL", "staff")] } }));
  const r = await kaynak.nasaAra("galaxy", {}, { getir: g });
  assert.equal(r.length, 2, "telifli aciklama elenir (kara liste puanlamada)");
  assert.match(r[0].url, /A1~orig\.jpg$/); assert.deepEqual(r[0].yedekUrl.map(u => u.split("~")[1]), ["large.jpg", "medium.jpg"]);
  assert.equal(r[0].lisansKodu, "nasa"); assert.equal(r[0].en, 0); assert.equal(r[0].kaynakUrl, "https://images.nasa.gov/details/A1");
  assert.ok(r[1].nasaKara, "kara liste regex'i adaya eklenmeli");
});

// ------------------------------------------------------------------ yonetici
const bos = () => Promise.resolve();
test("KaynakYonetici: 429 kaynagi kapatir (nedenle), sayilir, digerleri calisir; rapor kaynak bazli", async () => {
  const mesajlar = [];
  const y = new kaynak.KaynakYonetici({ getir: {}, anahtarlar: { pexels: "k" }, etkin: { pixabay: false, met: false, aic: false, cleveland: false, smithsonian: false, unsplash: false, rijks: false, europeana: false }, log: m => mesajlar.push(m), uyari: m => mesajlar.push("UYARI " + m), bekle: bos, aralik: {},
    istemciler: {
      pexels: async () => { throw new ag.AgHatasi("HTTP 429", 429, { bekleSn: 1800 }); },
      wikimedia: async () => [{ kaynak: "wikimedia", url: "u", baslik: "b", sira: 0 }],
      openverse: async () => { throw new ag.AgHatasi("HTTP 500", 500); },
      nasa: async () => [],
    } });
  assert.deepEqual(y.aktifler().sort(), ["nasa", "openverse", "pexels", "wikimedia"], "pixabay ayardan kapali");
  const r = await y.hepsindeAra("bear", {}, {});
  assert.equal(r.length, 1);
  assert.equal(y.acikMi("pexels"), false);
  assert.match(y.durum.pexels.kapaliNeden, /429.*30 dk/);
  const kh = y.kaynakHatalari();
  assert.match(kh.pexels, /^kapali \(.*429/);
  assert.equal(kh.openverse, 1);
  assert.equal(kh.pixabay, undefined, "ayardan kapali kaynak hata sayilmaz");
  assert.ok(mesajlar.some(m => /Pexels kapatıldı/.test(m)));
  assert.match(y.ozetMetni({ wikimedia: 3 }), /Wikimedia 3 görsel/);
  assert.match(y.ozetMetni({}), /Pexels 0 görsel.*kapandı/);
});

test("KaynakYonetici: 3 ardisik hata kaynagi kapatir; basarili cagri sayaci sifirlar; 401 hemen kapatir", async () => {
  let n = 0;
  const y = new kaynak.KaynakYonetici({ getir: {}, anahtarlar: {}, etkin: { pexels: false, pixabay: false, openverse: false, nasa: false, met: false, aic: false, cleveland: false, smithsonian: false, unsplash: false, rijks: false, europeana: false }, bekle: bos, aralik: {}, log: () => {}, uyari: () => {},
    istemciler: { wikimedia: async () => { n++; if (n === 2) return []; throw new ag.AgHatasi("HTTP 502", 502); } } });
  await y.ara("wikimedia", "a", {}); await y.ara("wikimedia", "b", {});     // hata, basari (sayac sifirlanir)
  assert.equal(y.durum.wikimedia.ardisik, 0);
  await y.ara("wikimedia", "c", {}); await y.ara("wikimedia", "d", {});
  assert.equal(y.acikMi("wikimedia"), true);
  await y.ara("wikimedia", "e", {});
  assert.equal(y.acikMi("wikimedia"), false);
  assert.match(y.durum.wikimedia.kapaliNeden, /3 ardışık hata/);
  const y2 = new kaynak.KaynakYonetici({ getir: {}, anahtarlar: { pexels: "yanlis" }, etkin: { pixabay: false, wikimedia: false, openverse: false, nasa: false, met: false, aic: false, cleveland: false, smithsonian: false, unsplash: false, rijks: false, europeana: false }, bekle: bos, aralik: {}, log: () => {}, uyari: () => {},
    istemciler: { pexels: async () => { throw new ag.AgHatasi("HTTP 401", 401); } } });
  await y2.ara("pexels", "a", {});
  assert.equal(y2.acikMi("pexels"), false);
  assert.match(y2.durum.pexels.kapaliNeden, /anahtar geçersiz/);
  assert.equal(y2.tumuKapaliMi(), true);
});

test("KaynakYonetici: ayni sorgu bellekte tutulur (tek ag cagrisi), basarisiz sonuc tutulmaz; anahtarsiz Pexels/Pixabay devre disi", async () => {
  let n = 0, basarisiz = 0;
  const y = new kaynak.KaynakYonetici({ getir: {}, anahtarlar: {}, bekle: bos, aralik: {}, log: () => {}, uyari: () => {},
    istemciler: { wikimedia: async (q) => { n++; return q === "hata" ? (basarisiz++, (() => { throw new ag.AgHatasi("x", 500); })()) : [{ kaynak: "wikimedia", url: "u" + n, sira: 0 }]; }, openverse: async () => [], nasa: async () => [] } });
  assert.equal(y.acikMi("pexels"), false); assert.equal(y.acikMi("pixabay"), false);
  assert.match(y.durum.pexels.kapaliNeden, /anahtar yok/);
  await y.ara("wikimedia", "bear", { yon: "yatay" }); await y.ara("wikimedia", "bear", { yon: "yatay" });
  assert.equal(n, 1);
  await y.ara("wikimedia", "bear", { yon: "dikey" });
  assert.equal(n, 2, "yon farkliysa yeni sorgu");
  await y.ara("wikimedia", "hata", {}); await y.ara("wikimedia", "hata", {});
  assert.equal(basarisiz, 2, "basarisiz sonuc onbellege alinmaz");
  assert.deepEqual(y.kaynakHatalari().pexels, undefined, "anahtar yoklugu hata degil");
});
