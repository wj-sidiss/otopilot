// Muze kaynaklari (Met, AIC, Cleveland): yalniz CC0/kamu mali; sanat sahnesi yonlendirmesi.
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const kaynak = require("../lib/gorsel-kaynak.js");
const sorgu = require("../lib/gorsel-sorgu.js");
const { lisansCoz } = require("../lib/gorsel-lisans.js");

const sahte = yanit => { const g = { cagrilar: [] }; g.json = async u => { g.cagrilar.push(u); return yanit(u); }; return g; };

test("met: yalniz isPublicDomain + gorselli eser; nesne basina ayri istek, 8 uygun eser bulununca durur", async () => {
  const g = sahte(u => u.includes("/search?") ? { objectIDs: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] }
    : u.endsWith("/2") ? { isPublicDomain: false, primaryImage: "https://x/2.jpg" }
    : { isPublicDomain: true, primaryImage: "https://x/a.jpg", primaryImageSmall: "https://x/s.jpg", title: "Vase", objectURL: "https://met/1", objectDate: "300 BC", culture: "Greek" });
  const r = await kaynak.metAra("vase", {}, { getir: g });
  assert.equal(g.cagrilar.length, 10, "arama + 9 nesne (2 numara telifli: 8 uygun icin 9 nesne)");
  assert.equal(r.length, 8);
  assert.equal(r[0].lisansKodu, "cc0"); assert.match(r[0].atif, /Metropolitan/);
  assert.match(g.cagrilar[0], /v1\.1\/search\?.*isPublicDomain=true/);
});

test("aic: IIIF adresi uretir, kamu mali olmayan/gorselsiz elenir; aday indirme basligini (AIC-User-Agent) tasir", async () => {
  const g = sahte(() => ({ config: { iiif_url: "https://www.artic.edu/iiif/2" }, data: [
    { id: 1, title: "A", image_id: "abc", is_public_domain: true, artist_display: "Monet" },
    { id: 2, title: "B", image_id: "def", is_public_domain: false },
    { id: 3, title: "C", image_id: null, is_public_domain: true }] }));
  const r = await kaynak.aicAra("water lilies", {}, { getir: g });
  assert.equal(r.length, 1);
  assert.equal(r[0].url, "https://www.artic.edu/iiif/2/abc/full/1686,/0/default.jpg");
  assert.equal(r[0].kaynakUrl, "https://www.artic.edu/artworks/1");
  assert.match(r[0].indirmeBasliklar["AIC-User-Agent"], /Otopilot/);
  assert.match(g.cagrilar[0], /is_public_domain\]=true/);
});

test("cleveland: cc0 olmayan eser elenir; print birincil, web yedek, boyutlar sayiya cevrilir", async () => {
  const g = sahte(() => ({ data: [
    { title: "A", share_license_status: "CC0", images: { web: { url: "https://c/a.jpg", width: "1239", height: "893" }, print: { url: "https://c/a-print.jpg", width: "3400", height: "2451" } }, url: "https://cma/1" },
    { title: "B", share_license_status: "Copyrighted", images: { web: { url: "https://c/b.jpg" } } },
    { title: "C", share_license_status: "CC0", images: { web: { url: "https://c/c.jpg", width: "900", height: "700" } }, url: "https://cma/3" }] }));
  const r = await kaynak.clevelandAra("armor", {}, { getir: g });
  assert.equal(r.length, 2); assert.equal(r[0].kaynak, "cleveland"); assert.equal(r[0].lisansKodu, "cc0");
  assert.equal(r[0].url, "https://c/a-print.jpg"); assert.equal(r[0].indirmeUrl, "https://c/a-print.jpg");
  assert.deepEqual(r[0].yedekUrl, ["https://c/a.jpg"]);
  assert.equal(r[0].en, 3400); assert.equal(r[0].boy, 2451);
  assert.equal(r[1].url, "https://c/c.jpg", "print yoksa web"); assert.equal(r[1].en, 900);
  assert.match(g.cagrilar[0], /cc0=1/);
});

test("yonetici: muze kaynaklari kayitli, anahtarsiz acik; sanatSahneMi yonlendirir", () => {
  const y = new kaynak.KaynakYonetici({ getir: sahte(() => ({})), anahtarlar: {}, etkin: {} });
  for (const a of ["met", "aic", "cleveland"]) assert.ok(y.acikMi(a), a);
  assert.ok(!y.acikMi("smithsonian"), "anahtar yok");
  assert.equal(lisansCoz("met").kabul, true);
  assert.ok(sorgu.sanatSahneMi("Renaissance painters in Florence"));
  assert.ok(sorgu.sanatSahneMi("Firavunların mezarları"));
  assert.ok(!sorgu.sanatSahneMi("A dog running on the beach"));
});

test("sanatSahneMi: tarih/roma/empire/kings/history baglam ister (sanat disi sahne muzeleri acmaz)", () => {
  for (const m of ["Hisse senetleri 15 Mart tarihinde sert düştü. stock market crash", "romantic dinner by candlelight",
    "Empire State Building at night", "history of the iPhone", "Sacramento Kings basketball game", "Romanya'da kış",
    "Doğum tarihi ve son kullanma tarihi", "king size bed in a hotel room", "Queens New York subway"])
    assert.equal(sorgu.sanatSahneMi(m), false, m);
  for (const m of ["Roma İmparatorluğu'nun çöküşü", "Roma'nın kuruluşu", "Romalılar köprü yaptı", "Osmanlı tarihi", "insanlık tarihinin dönüm noktası",
    "tarihi eserler ve harabeler", "tarih öncesi mağara", "tarihsel bir an", "Roman Empire", "Mongol Empire", "King Henry VIII portrait",
    "Queen of Sheba", "ancient history", "art history lecture", "historical battle", "Mısır piramitleri"])
    assert.equal(sorgu.sanatSahneMi(m), true, m);
});

test("smithsonian: anahtarsiz bos; yalniz CC0 medya", async () => {
  assert.deepEqual(await kaynak.smithsonianAra("x", {}, { getir: sahte(() => ({})) }), []);
  const g = sahte(() => ({ response: { rows: [
    { title: "A", content: { descriptiveNonRepeating: { record_link: "https://si/1", online_media: { media: [{ type: "Images", content: "https://si/a.jpg", usage: { access: "CC0" } }] } } } },
    { title: "B", content: { descriptiveNonRepeating: { online_media: { media: [{ type: "Images", content: "https://si/b.jpg", usage: { access: "Usage conditions apply" } }] } } } }] } }));
  const r = await kaynak.smithsonianAra("x", {}, { getir: g, anahtar: "K" });
  assert.equal(r.length, 1); assert.equal(r[0].lisansKodu, "cc0");
});

test("unsplash: anahtarsiz bos; Client-ID basligi, atif; raw + 1920 uzun kenar, yedek full, small yok", async () => {
  assert.deepEqual(await kaynak.unsplashAra("x", {}, { getir: sahte(() => ({})) }), []);
  let ust;
  const raw = "https://images.unsplash.com/photo-1?ixid=abc&ixlib=rb-4.0.3";
  const g = sahte(() => ({ results: [
    { urls: { raw, full: raw + "&q=85", regular: raw + "&w=1080", small: raw + "&w=400" }, user: { name: "Ayse" }, width: 4000, height: 3000, links: { html: "https://unsplash.com/p/1" } },
    { urls: { raw: "https://images.unsplash.com/photo-2", regular: "https://images.unsplash.com/photo-2?w=1080" }, user: { name: "Can" }, width: 2000, height: 3000, links: {} },
  ] }));
  const j = g.json; g.json = (u, o) => { ust = o; return j(u, o); };
  const r = await kaynak.unsplashAra("x", {}, { getir: g, anahtar: "K" });
  assert.equal(ust.basliklar.Authorization, "Client-ID K"); assert.match(r[0].atif, /Ayse/);
  assert.equal(r[0].url, raw + "&fm=jpg&q=80&fit=max&w=1920"); assert.equal(r[0].indirmeUrl, r[0].url);
  assert.deepEqual(r[0].yedekUrl, [raw + "&q=85"], "yedek full; small (400 px) hic gecemez");
  assert.equal(r[1].url, "https://images.unsplash.com/photo-2?fm=jpg&q=80&fit=max&h=1920", "dikey fotograf: yukseklik 1920");
  assert.deepEqual(r[1].yedekUrl, []);
  assert.equal(r[0].lisansKodu, "unsplash");
});

test("rijks: Linked Art zinciri; yalniz PDM/CC0 iiif gorseli, 1920 genislik, Ingilizce ad", async () => {
  const nesne = pd => ({ identified_by: [{ type: "Name", content: "De molen", language: [{ id: "http://vocab.getty.edu/aat/300388256" }] }, { type: "Name", content: "The windmill", language: [{ id: "http://vocab.getty.edu/aat/300388277" }] }],
    subject_of: [{ digitally_carried_by: [{ access_point: [{ id: "https://iiif.micr.io/XWEFp/full/max/0/default.jpg" }], referred_to_by: [{ content: pd }] }] }] });
  const g = sahte(u => u.includes("/search/") ? { orderedItems: [{ id: "https://id.rijksmuseum.nl/1" }, { id: "https://id.rijksmuseum.nl/2" }] }
    : u.endsWith("/1") ? nesne("https://creativecommons.org/publicdomain/mark/1.0/") : nesne("https://rightsstatements.org/vocab/InC/1.0/"));
  const red = [];
  const r = await kaynak.rijksAra("windmill", {}, { getir: g }, (k, n) => red.push(n));
  assert.equal(r.length, 1); assert.equal(r[0].baslik, "The windmill");
  assert.equal(r[0].url, "https://iiif.micr.io/XWEFp/full/1920,/0/default.jpg"); assert.equal(r[0].lisansKodu, "pdm");
  assert.equal(red.length, 1, "InC eser lisans nedeniyle sayilir");
});

test("rijks: yanittaki adresler sabit makinelere bagli (baska makinedeki kimlik/iiif yolu istenmez/kabul edilmez)", async () => {
  const nesne = ap => ({ identified_by: [{ type: "Name", content: "X" }],
    subject_of: [{ digitally_carried_by: [{ access_point: [{ id: ap }], referred_to_by: [{ content: "https://creativecommons.org/publicdomain/zero/1.0/" }] }] }] });
  const g = sahte(u => u.includes("/search/") ? { orderedItems: [{ id: "https://kotu.example/1" }, { id: "https://id.rijksmuseum.nl/2" }, { id: "https://id.rijksmuseum.nl/3" }] }
    : u.endsWith("/2") ? nesne("https://kotu.example/iiif.micr.io/a/full/max/0/default.jpg") : nesne("https://iiif.micr.io/b/full/max/0/default.jpg"));
  const r = await kaynak.rijksAra("x", {}, { getir: g });
  assert.ok(!g.cagrilar.some(u => u.includes("kotu.example")), "yabanci kimlik adresi istenmez");
  assert.deepEqual(r.map(x => x.url), ["https://iiif.micr.io/b/full/1920,/0/default.jpg"]);
});

test("europeana: anahtarsiz bos; yalniz acik lisans (NC/ND/InC elenir, sayaca yazilir); kaynakUrl anahtari TASIMAZ", async () => {
  assert.deepEqual(await kaynak.europeanaAra("x", {}, { getir: sahte(() => ({})) }), []);
  // canli guid bicimi: anahtar utm_campaign olarak adrese yapisir
  const it = (rights, id) => ({ rights: [rights], edmIsShownBy: ["https://e/" + id + ".jpg"], title: [id], id: "/9/" + id,
    guid: "https://www.europeana.eu/item/9/" + id + "?utm_source=api&utm_medium=api&utm_campaign=GIZLIANAHTAR" });
  const g = sahte(() => ({ items: [it("http://creativecommons.org/publicdomain/zero/1.0/", "a"), it("http://creativecommons.org/licenses/by-nc/4.0/", "b"),
    it("http://rightsstatements.org/vocab/InC/1.0/", "c"), it("http://creativecommons.org/licenses/by/4.0/", "d")] }));
  const red = [];
  const r = await kaynak.europeanaAra("x", {}, { getir: g, anahtar: "GIZLIANAHTAR" }, (k, n) => red.push(k + ":" + n));
  assert.deepEqual(r.map(x => x.baslik), ["a", "d"]); assert.equal(r[1].atifGerekli, true);
  assert.equal(r[1].kaynakUrl, "https://www.europeana.eu/item/9/d");
  assert.ok(!JSON.stringify(r).includes("GIZLIANAHTAR"), "anahtar adayin hicbir alaninda olmamali");
  assert.equal(red.length, 2); assert.ok(red.every(x => x.startsWith("europeana:")));
  assert.match(g.cagrilar[0], /reusability=open/);
});

test("muzeSorgu: dolgu kelimeleri atilir, en cok 3 kelime kalir", () => {
  const { muzeSorgu } = require("../lib/gorsel-kaynak.js");
  assert.equal(muzeSorgu("Rembrandt Night Watch painting"), "Rembrandt Night Watch");
  assert.equal(muzeSorgu("Night Watch painting detail restoration"), "Night Watch");
  assert.equal(muzeSorgu("painting"), "painting");
});

test("kayit butunlugu: her istemci ADLAR'da, ARALIK'ta, ayar izin listesinde; yonetici hepsini sorgular", () => {
  const ortak = require("../lib/ortak.js");
  for (const ad of Object.keys(kaynak.ISTEMCILER)) {
    assert.ok(kaynak.ADLAR[ad], ad + " ADLAR'da yok");
    assert.ok(ortak.AYAR_VARSAYILAN.kaynaklar[ad] === true, ad + " ayar varsayilaninda yok");
  }
  const y = new kaynak.KaynakYonetici({ getir: sahte(() => ({})), anahtarlar: {}, etkin: {} });
  for (const ad of ["met", "aic", "cleveland", "rijks"]) assert.ok(y.acikMi(ad), ad);
  for (const ad of ["smithsonian", "unsplash", "europeana"]) assert.ok(!y.acikMi(ad), ad + " anahtarsiz kapali olmali");
});
