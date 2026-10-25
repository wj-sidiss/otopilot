// Muze kaynaklari (Met, AIC, Cleveland): yalniz CC0/kamu mali; sanat sahnesi yonlendirmesi.
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const kaynak = require("../lib/gorsel-kaynak.js");
const sorgu = require("../lib/gorsel-sorgu.js");
const { lisansCoz } = require("../lib/gorsel-lisans.js");

const sahte = yanit => { const g = { cagrilar: [] }; g.json = async u => { g.cagrilar.push(u); return yanit(u); }; return g; };

test("met: yalniz isPublicDomain + gorselli eser; nesne basina ayri istek, en cok 8", async () => {
  const g = sahte(u => u.includes("/search?") ? { objectIDs: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] }
    : u.endsWith("/2") ? { isPublicDomain: false, primaryImage: "https://x/2.jpg" }
    : { isPublicDomain: true, primaryImage: "https://x/a.jpg", primaryImageSmall: "https://x/s.jpg", title: "Vase", objectURL: "https://met/1", objectDate: "300 BC", culture: "Greek" });
  const r = await kaynak.metAra("vase", {}, { getir: g });
  assert.equal(g.cagrilar.length, 9);
  assert.equal(r.length, 7);
  assert.equal(r[0].lisansKodu, "cc0"); assert.match(r[0].atif, /Metropolitan/);
  assert.match(g.cagrilar[0], /isPublicDomain=true/);
});

test("aic: IIIF adresi uretir, kamu mali olmayan/gorselsiz elenir", async () => {
  const g = sahte(() => ({ config: { iiif_url: "https://www.artic.edu/iiif/2" }, data: [
    { id: 1, title: "A", image_id: "abc", is_public_domain: true, artist_display: "Monet" },
    { id: 2, title: "B", image_id: "def", is_public_domain: false },
    { id: 3, title: "C", image_id: null, is_public_domain: true }] }));
  const r = await kaynak.aicAra("water lilies", {}, { getir: g });
  assert.equal(r.length, 1);
  assert.equal(r[0].url, "https://www.artic.edu/iiif/2/abc/full/1686,/0/default.jpg");
  assert.equal(r[0].kaynakUrl, "https://www.artic.edu/artworks/1");
  assert.match(g.cagrilar[0], /is_public_domain\]=true/);
});

test("cleveland: cc0 olmayan eser elenir", async () => {
  const g = sahte(() => ({ data: [
    { title: "A", share_license_status: "CC0", images: { web: { url: "https://c/a.jpg", width: 900, height: 700 } }, url: "https://cma/1" },
    { title: "B", share_license_status: "Copyrighted", images: { web: { url: "https://c/b.jpg" } } }] }));
  const r = await kaynak.clevelandAra("armor", {}, { getir: g });
  assert.equal(r.length, 1); assert.equal(r[0].kaynak, "cleveland"); assert.equal(r[0].lisansKodu, "cc0");
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

test("smithsonian: anahtarsiz bos; yalniz CC0 medya", async () => {
  assert.deepEqual(await kaynak.smithsonianAra("x", {}, { getir: sahte(() => ({})) }), []);
  const g = sahte(() => ({ response: { rows: [
    { title: "A", content: { descriptiveNonRepeating: { record_link: "https://si/1", online_media: { media: [{ type: "Images", content: "https://si/a.jpg", usage: { access: "CC0" } }] } } } },
    { title: "B", content: { descriptiveNonRepeating: { online_media: { media: [{ type: "Images", content: "https://si/b.jpg", usage: { access: "Usage conditions apply" } }] } } } }] } }));
  const r = await kaynak.smithsonianAra("x", {}, { getir: g, anahtar: "K" });
  assert.equal(r.length, 1); assert.equal(r[0].lisansKodu, "cc0");
});

test("unsplash: anahtarsiz bos; Client-ID basligi, atif", async () => {
  assert.deepEqual(await kaynak.unsplashAra("x", {}, { getir: sahte(() => ({})) }), []);
  let ust;
  const g = sahte(() => ({ results: [{ urls: { regular: "https://u/a.jpg" }, user: { name: "Ayse" }, width: 4000, height: 3000, links: { html: "https://unsplash.com/p/1" } }] }));
  const j = g.json; g.json = (u, o) => { ust = o; return j(u, o); };
  const r = await kaynak.unsplashAra("x", {}, { getir: g, anahtar: "K" });
  assert.equal(ust.basliklar.Authorization, "Client-ID K"); assert.match(r[0].atif, /Ayse/);
});

test("rijks: Linked Art zinciri; yalniz PDM/CC0 iiif gorseli, 1920 genislik, Ingilizce ad", async () => {
  const nesne = pd => ({ identified_by: [{ type: "Name", content: "De molen", language: [{ id: "http://vocab.getty.edu/aat/300388256" }] }, { type: "Name", content: "The windmill", language: [{ id: "http://vocab.getty.edu/aat/300388277" }] }],
    subject_of: [{ digitally_carried_by: [{ access_point: [{ id: "https://iiif.micr.io/XWEFp/full/max/0/default.jpg" }], referred_to_by: [{ content: pd }] }] }] });
  const g = sahte(u => u.includes("/search/") ? { orderedItems: [{ id: "https://id.rijksmuseum.nl/1" }, { id: "https://id.rijksmuseum.nl/2" }] }
    : u.endsWith("/1") ? nesne("https://creativecommons.org/publicdomain/mark/1.0/") : nesne("https://rightsstatements.org/vocab/InC/1.0/"));
  const r = await kaynak.rijksAra("windmill", {}, { getir: g });
  assert.equal(r.length, 1); assert.equal(r[0].baslik, "The windmill");
  assert.equal(r[0].url, "https://iiif.micr.io/XWEFp/full/1920,/0/default.jpg"); assert.equal(r[0].lisansKodu, "pdm");
});

test("europeana: anahtarsiz bos; yalniz acik lisans (NC/ND/InC elenir)", async () => {
  assert.deepEqual(await kaynak.europeanaAra("x", {}, { getir: sahte(() => ({})) }), []);
  const it = (rights, id) => ({ rights: [rights], edmIsShownBy: ["https://e/" + id + ".jpg"], title: [id], guid: "https://eu/" + id });
  const g = sahte(() => ({ items: [it("http://creativecommons.org/publicdomain/zero/1.0/", "a"), it("http://creativecommons.org/licenses/by-nc/4.0/", "b"),
    it("http://rightsstatements.org/vocab/InC/1.0/", "c"), it("http://creativecommons.org/licenses/by/4.0/", "d")] }));
  const r = await kaynak.europeanaAra("x", {}, { getir: g, anahtar: "K" });
  assert.deepEqual(r.map(x => x.baslik), ["a", "d"]); assert.equal(r[1].atifGerekli, true);
  assert.match(g.cagrilar[0], /reusability=open/);
});
