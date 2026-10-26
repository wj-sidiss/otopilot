// GO — gorsel kaynaklari ek duzeltmeleri: AIC indirme basligi, Cleveland print, Unsplash raw/atif/indirme bildirimi/403 limit,
// Europeana anahtar sizintisi, Smithsonian kanonik anahtar, Met 404 kimlikleri, VS'de muzeler, kaynak-dene gercek indirme.
// Ag YOK: getir.json / getir.gorsel sahtelenir; gorseller ffmpeg'siz sentetik JPEG (birim-yardim.jpegUret).
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const Y = require("./birim-yardim.js");
const ortam = Y.ortamKur("gorsel-kaynak-ek");           // .env / uretim / ayar gecici klasore (gercek dosyalara dokunulmaz)
const kaynak = require("../lib/gorsel-kaynak.js");
const lisans = require("../lib/gorsel-lisans.js");
const puan = require("../lib/gorsel-puan.js");
const indir = require("../lib/gorsel-indir.js");
const ag = require("../lib/gorsel-ag.js");
const man = require("../lib/gorsel-manifest.js");
const vs = require("../lib/gorsel-vs.js");
const kaynakDene = require("../kaynak-dene.js");

const bos = async () => {};
const geciciDizin = fs.mkdtempSync(path.join(os.tmpdir(), "gorsel-kaynak-ek-"));
test.after(() => { try { fs.rmSync(geciciDizin, { recursive: true, force: true }); } catch (e) { /* windows kilidi */ } ortam.temizle(); });

// url -> Buffer | Error eslemesiyle sahte getir; json ayri bir islevle yanitlanir. Cagrilar (adres + secenek) kaydedilir.
function sahteGetir(gorseller, jsonYanit) {
  const g = { json: [], gorsel: [] };
  const getir = async () => { throw new Error("duz getir cagrilmamali"); };
  getir.json = async (u, o) => { g.json.push({ u, o }); const y = jsonYanit ? jsonYanit(u, o) : {}; if (y instanceof Error) throw y; return y; };
  getir.gorsel = async (u, o) => {
    g.gorsel.push({ u, o });
    const v = typeof gorseller === "function" ? gorseller(u, o) : gorseller[u];
    if (v instanceof Error) throw v;
    if (!v) throw new ag.AgHatasi("HTTP 404", 404);
    return { govde: v };
  };
  getir.kayit = g;
  return getir;
}
let sahneNo = 0;
const sahneYeni = () => ({ no: ++sahneNo, klasor: String(sahneNo).padStart(3, "0") + "-test", gorseller: [] });
const indirSecenek = (getir, adaylar, ek) => Object.assign({ P: { VIS: geciciDizin }, S: sahneYeni(), adaylar, kac: 1, getir, gorulenUrl: new Set(),
  gorulenSha: new Set(), reddedilen: {}, redUrl: new Set(), indirmeHata: {}, bekle: bos, aralikMs: 0, silinen: { url: new Set(), sha1: new Set() } }, ek || {});

// ------------------------------------------------------------------ 1) AIC: indirme basligi
test("aic: aday indirilirken AIC-User-Agent basligi gonderilir (basliksiz IIIF istegi 403 alir)", async () => {
  const getir = sahteGetir((u, o) => (o && o.basliklar && o.basliklar["AIC-User-Agent"]) ? Y.jpegUret(1686, 1244) : new ag.AgHatasi("HTTP 403", 403),
    () => ({ config: { iiif_url: "https://www.artic.edu/iiif/2" }, data: [{ id: 7, title: "Windmill", image_id: "img7", is_public_domain: true, artist_display: "X" }] }));
  const adaylar = await kaynak.aicAra("windmill", {}, { getir });
  const r = await indir.adaylardanIndir(indirSecenek(getir, adaylar));
  assert.equal(r.eklenen, 1, "baslikla gorsel inmeli: " + JSON.stringify(getir.kayit.gorsel.map(x => x.o)));
  assert.equal(getir.kayit.gorsel[0].u, "https://www.artic.edu/iiif/2/img7/full/1686,/0/default.jpg");
  assert.match(getir.kayit.gorsel[0].o.basliklar["AIC-User-Agent"], /Otopilot/);
  // basliksiz aday (baska kaynak) ikinci arguman almaz: mevcut davranis korunur
  const g2 = sahteGetir({ "https://x/a.jpg": Y.jpegUret(1920, 1080) });
  await indir.indirDene({ kaynak: "wikimedia", url: "https://x/a.jpg" }, { getir: g2, reddedilen: {}, gorulenSha: new Set(), bekle: bos });
  assert.equal(g2.kayit.gorsel[0].o, undefined);
});

// ------------------------------------------------------------------ 2) Cleveland: print birincil, puanlamadan gecer
test("cleveland: canli ornek (web 1239x893 metin, print 3400x2451) puanlamadan gecer ve print indirilir", async () => {
  const getir = sahteGetir({ "https://cma/print.jpg": Y.jpegUret(3400, 2451) }, () => ({ data: [{ title: "Windmill near a farm", share_license_status: "CC0", url: "https://clevelandart.org/art/1",
    images: { web: { url: "https://cma/web.jpg", width: "1239", height: "893" }, print: { url: "https://cma/print.jpg", width: "3400", height: "2451" } } }] }));
  const [a] = await kaynak.clevelandAra("windmill", {}, { getir });
  const p = puan.puanla(a, { sorgu: "windmill", sorguTok: puan.sorguTokenleri("windmill", "en"), aramaDili: "en", yon: "yatay", siraLimiti: 40 });
  assert.equal(p.elendi, null, "eskiden 'çözünürlük düşük (1239x893)' ile eleniyordu");
  const r = await indir.adaylardanIndir(indirSecenek(getir, [a]));
  assert.equal(r.eklenen, 1); assert.equal(getir.kayit.gorsel[0].u, "https://cma/print.jpg");
});

// ------------------------------------------------------------------ 3) Unsplash: raw adresi dogrulamadan gecer
test("unsplash: raw + w=1920 adresi 1280 esigini gecer (regular 1080 px ve small 400 px gecemiyordu)", async () => {
  const raw = "https://images.unsplash.com/photo-9?ixid=a";
  const getir = sahteGetir(u => (/w=1920/.test(u) ? Y.jpegUret(1920, 1280) : /w=1080/.test(u) ? Y.jpegUret(1080, 720) : new ag.AgHatasi("HTTP 404", 404)),
    () => ({ results: [{ urls: { raw, regular: raw + "&w=1080", small: raw + "&w=400" }, user: { name: "Ayse" }, width: 4000, height: 2667, links: { html: "https://unsplash.com/photos/9" } }] }));
  const adaylar = await kaynak.unsplashAra("lake", {}, { getir, anahtar: "K" });
  const r = await indir.adaylardanIndir(indirSecenek(getir, adaylar));
  assert.equal(r.eklenen, 1);
  assert.match(getir.kayit.gorsel[0].u, /w=1920$/);
});

// ------------------------------------------------------------------ 4) Europeana anahtari + atif temizligi
test("europeana/atif: eski manifestteki anahtarli kaynakUrl ATIF ve aciklama satirina SIZMAZ; temizleyici yalniz http/https tek satir kabul eder", () => {
  const eski = { kaynak: "europeana", lisans: "CC BY 4.0", lisansKodu: "by", atifGerekli: true, baslik: "Molen", atif: "X — Y",
    kaynakUrl: "https://www.europeana.eu/item/9/d?utm_source=api&utm_medium=api&utm_campaign=GIZLIANAHTAR", indirmeUrl: "https://e/d.jpg" };
  const satir = lisans.atifMetni(eski);
  assert.ok(!/GIZLIANAHTAR|utm_/.test(satir), satir);
  assert.match(satir, /— https:\/\/www\.europeana\.eu\/item\/9\/d$/);
  const m = { sahneler: [{ gorseller: [eski] }] };
  assert.ok(!man.atifSatirlari(m).join("\n").includes("GIZLIANAHTAR"), "ATIF.txt satirlari");
  const T = lisans.kaynakUrlTemizle;
  assert.equal(T("https://x.test/y?wskey=K&id=5&api_key=Z"), "https://x.test/y?id=5");
  assert.equal(T("javascript:alert(1)"), ""); assert.equal(T("https://a.test/b\n```"), ""); assert.equal(T("https://a.test/b c"), "");
  assert.equal(T("ftp://a.test/x"), ""); assert.equal(T(""), ""); assert.equal(T(undefined), "");
  const turkce = "https://commons.wikimedia.org/wiki/File:Ayasofya_İstanbul.jpg";
  assert.equal(T(turkce), turkce, "parametresiz adres oldugu gibi kalir (normallestirilmez)");
  // kaynakUrl gecersizse indirme adresine duser
  assert.match(lisans.atifMetni({ baslik: "a", atif: "b", lisans: "CC BY", kaynakUrl: "javascript:x", indirmeUrl: "https://e/a.jpg" }), /— https:\/\/e\/a\.jpg$/);
});

test("europeana: lisans adresi basa sabitli (baska makinedeki 'creativecommons.org/...' yolu acik lisans sayilmaz); kaynakUrl guid yoksa id'den", async () => {
  assert.equal(lisans.europeanaLisans("https://kotu.example/creativecommons.org/publicdomain/zero/1.0/").kabul, false);
  assert.equal(lisans.europeanaLisans("https://kotu.example/?r=http://creativecommons.org/licenses/by/4.0/").kabul, false);
  assert.equal(lisans.europeanaLisans("http://creativecommons.org/publicdomain/zero/1.0/").lisansKodu, "cc0");
  assert.equal(lisans.europeanaLisans("https://creativecommons.org/licenses/by-sa/3.0/").lisansKodu, "by-sa");
  const getir = sahteGetir({}, () => ({ items: [{ rights: ["http://creativecommons.org/publicdomain/mark/1.0/"], edmIsShownBy: ["https://e/a.jpg"], title: ["a"], id: "/12/abc_1" }] }));
  const [a] = await kaynak.europeanaAra("x", {}, { getir, anahtar: "K" });
  assert.equal(a.kaynakUrl, "https://www.europeana.eu/item/12/abc_1");
});

// ------------------------------------------------------------------ 5) Smithsonian: sorgu tabanli ucta kimlik korunur
test("kanonikUrl: Smithsonian deliveryService?id= adaylari ayri anahtar alir; statik gorselde sunum parametresi atilir", async () => {
  const k = puan.kanonikUrl;
  assert.notEqual(k("https://ids.si.edu/ids/deliveryService?id=NMAH-1"), k("https://ids.si.edu/ids/deliveryService?id=NMAH-2"));
  assert.equal(k("https://ids.si.edu/ids/deliveryService?id=A&max=200"), k("https://ids.si.edu/ids/deliveryService?id=A"));
  assert.notEqual(k("https://p.example/imagehelper/download?id=239578&x=1"), k("https://p.example/imagehelper/download?id=239579&x=1"));
  assert.equal(k("https://images.unsplash.com/photo-1?ixid=a&fm=jpg&q=80&fit=max&w=1920"), k("https://images.unsplash.com/photo-1?ixid=b&w=1080"));
  assert.equal(k("https://www.europeana.eu/item/9/d?utm_source=api&utm_campaign=K"), "https://www.europeana.eu/item/9/d");
  assert.equal(k("https://X.com/a/b.jpg?w=100#z"), "https://x.com/a/b.jpg");
  assert.equal(k("https://ids.si.edu/ids/deliveryService?b=2&id=A"), k("https://ids.si.edu/ids/deliveryService?id=A&b=2"), "parametre sirasi onemsiz");
  assert.equal(k("https://p.example/get.php?uri=X&f=2"), k("https://p.example/get.php?f=2&uri=X"));
  assert.equal(k("https://K.test/A/?x=1"), "https://k.test/a", "kimlik olmayan parametre uzantisiz adreste de atilir");

  // iki farkli Smithsonian kimligi, kac=2 -> iki gorsel (eskiden 1)
  const getir = sahteGetir({ "https://ids.si.edu/ids/deliveryService?id=A": Y.jpegUret(1920, 1080, { bayt: 5000 }), "https://ids.si.edu/ids/deliveryService?id=B": Y.jpegUret(1920, 1080, { bayt: 5001 }) });
  const aday = id => ({ kaynak: "smithsonian", url: "https://ids.si.edu/ids/deliveryService?id=" + id, indirmeUrl: "https://ids.si.edu/ids/deliveryService?id=" + id, kaynakUrl: "http://n2t.net/ark:/65665/" + id });
  const o = indirSecenek(getir, [aday("A"), aday("B")], { kac: 2 });
  const r = await indir.adaylardanIndir(o);
  assert.equal(r.eklenen, 2);
  // ilk aday icerik nedeniyle reddedilse de ikinci aday kapanmaz
  const g2 = sahteGetir({ "https://ids.si.edu/ids/deliveryService?id=C": Y.htmlHataSayfasi(), "https://ids.si.edu/ids/deliveryService?id=D": Y.jpegUret(1920, 1080, { bayt: 5002 }) });
  const r2 = await indir.adaylardanIndir(indirSecenek(g2, [aday("C"), aday("D")]));
  assert.equal(r2.eklenen, 1);
});

// ------------------------------------------------------------------ 6) Met: 404 kimlikler servis hatasi degil
test("met: ilk kimlik 404 ise arama hata sayilmaz, sonraki kimliklere gecilir; servis arizasi (5xx) yine bildirilir", async () => {
  const eser = { isPublicDomain: true, primaryImage: "https://met/a.jpg", title: "King", objectURL: "https://met/o" };
  const yanit = kotu => u => u.includes("/search?") ? { objectIDs: [1, 2, 3] } : u.endsWith("/1") ? kotu : eser;
  const getir = sahteGetir({}, yanit(new ag.AgHatasi("HTTP 404", 404)));
  const r = await kaynak.metAra("king", {}, { getir });
  assert.equal(r.length, 2);
  // yonetici uzerinden: hata/ardisik artmaz
  const y = new kaynak.KaynakYonetici({ getir, anahtarlar: {}, etkin: {}, bekle: bos, aralik: {}, log: () => {}, uyari: () => {} });
  assert.equal((await y.ara("met", "king", {})).length, 2);
  assert.equal(y.durum.met.hata, 0); assert.equal(y.durum.met.ardisik, 0);
  // hic yanit alinmadan 5xx: servis arizasi -> yonetici sayar
  const g5 = sahteGetir({}, yanit(new ag.AgHatasi("HTTP 503", 503)));
  await assert.rejects(() => kaynak.metAra("king", {}, { getir: g5 }), e => e.kod === 503);
  const y5 = new kaynak.KaynakYonetici({ getir: g5, anahtarlar: {}, etkin: {}, bekle: bos, aralik: {}, log: () => {}, uyari: () => {} });
  await y5.ara("met", "king", {});
  assert.equal(y5.durum.met.hata, 1);
  // 404'ten sonra gelen 5xx tek eser sayilir (arama yaniti alinmisti): firlatmaz
  const g45 = sahteGetir({}, u => u.includes("/search?") ? { objectIDs: [1, 2, 3] } : u.endsWith("/1") ? new ag.AgHatasi("HTTP 404", 404) : u.endsWith("/2") ? new ag.AgHatasi("HTTP 500", 500) : eser);
  assert.equal((await kaynak.metAra("king", {}, { getir: g45 })).length, 1);
});

test("met: v1.1 isPublicDomain suzgecini yok saydigi icin 8 kamu mali eser bulunana dek dolasir, en cok 20 nesne ister", async () => {
  const ids = Array.from({ length: 40 }, (_, i) => i + 1);
  const karisik = sahteGetir({}, u => u.includes("/search?") ? { objectIDs: ids } : { isPublicDomain: Number(u.split("/").pop()) % 2 === 0, primaryImage: "https://met/x.jpg", title: "t" });
  const r = await kaynak.metAra("windmill", {}, { getir: karisik });
  assert.equal(r.length, 8);
  assert.equal(karisik.kayit.json.length, 1 + 16, "16. nesnede 8 kamu mali eser tamamlanir");
  const telifli = sahteGetir({}, u => u.includes("/search?") ? { objectIDs: ids } : { isPublicDomain: false, primaryImage: "https://met/x.jpg" });
  assert.deepEqual(await kaynak.metAra("windmill", {}, { getir: telifli }), []);
  assert.equal(telifli.kayit.json.length, 1 + 20, "en cok 20 nesne istegi");
  assert.equal((await kaynak.metAra("windmill", { limit: 3 }, { getir: sahteGetir({}, u => u.includes("/search?") ? { objectIDs: ids } : { isPublicDomain: true, primaryImage: "https://met/x.jpg" }) })).length, 3);
});

// ------------------------------------------------------------------ 7) Unsplash lisans kodu ve atif
test("unsplash: lisansKodu 'unsplash', atif listesine girer (ATIF.txt / aciklama); eski 'pixabay' kodlu Unsplash kaydi da girer", async () => {
  assert.equal(lisans.lisansCoz("unsplash").lisansKodu, "unsplash");
  assert.equal(lisans.atifListesineGirer({ lisansKodu: "unsplash" }), true);
  assert.equal(lisans.atifListesineGirer({ kaynak: "unsplash", lisansKodu: "pixabay" }), true, "eski manifest");
  assert.equal(lisans.atifListesineGirer({ kaynak: "pixabay", lisansKodu: "pixabay" }), false);
  assert.equal(lisans.atifListesineGirer(null), false);
  const getir = sahteGetir({}, () => ({ results: [{ urls: { raw: "https://images.unsplash.com/photo-3" }, description: "Lake", user: { name: "Ayse" }, width: 4000, height: 3000, links: { html: "https://unsplash.com/photos/3" } }] }));
  const [a] = await kaynak.unsplashAra("lake", {}, { getir, anahtar: "K" });
  const kayit = man.kayitOlustur("001-x/01.jpg", a, { en: 1920, boy: 1440, bayt: 1, sha1: "x" });
  assert.equal(kayit.lisansKodu, "unsplash");
  const satirlar = man.atifSatirlari({ sahneler: [{ gorseller: [kayit] }] });
  assert.equal(satirlar.length, 1); assert.match(satirlar[0], /Ayse — Unsplash — Unsplash License — https:\/\/unsplash\.com\/photos\/3/);
  assert.equal(kayit.indirmeBildir, undefined, "islev manifeste yazilmaz");
});

// ------------------------------------------------------------------ 8) Unsplash indirme bildirimi
test("unsplash: indirilen fotograf icin download_location bir kez (Client-ID ile) bildirilir; inmeyen icin bildirilmez; anahtar adayda VERI olarak yok", async () => {
  const sonuc = (id, dl) => ({ urls: { raw: "https://images.unsplash.com/photo-" + id }, user: { name: "A" }, width: 4000, height: 3000,
    links: { html: "https://unsplash.com/photos/" + id, download_location: dl } });
  const getir = sahteGetir(u => (u.includes("photo-1") ? Y.jpegUret(1920, 1440) : new ag.AgHatasi("HTTP 404", 404)),
    u => (u.includes("/search/photos") ? { results: [sonuc(2, "https://api.unsplash.com/photos/2/download?ixid=b"), sonuc(1, "https://api.unsplash.com/photos/1/download?ixid=a"),
      sonuc(3, "https://kotu.example/photos/3/download")] } : { url: "https://images.unsplash.com/photo-1" }));
  const adaylar = await kaynak.unsplashAra("lake", {}, { getir, anahtar: "GIZLI-K" });
  assert.equal(typeof adaylar[0].indirmeBildir, "function");
  assert.equal(adaylar[2].indirmeBildir, undefined, "api.unsplash.com disina anahtar gitmez");
  assert.ok(!JSON.stringify(adaylar).includes("GIZLI-K"), "anahtar JSON'a girmez");
  const r = await indir.adaylardanIndir(indirSecenek(getir, adaylar, { kac: 2 }));
  assert.equal(r.eklenen, 1, "yalniz photo-1 iner");
  const bildirimler = getir.kayit.json.filter(x => x.u.includes("/download"));
  assert.equal(bildirimler.length, 1);
  assert.equal(bildirimler[0].u, "https://api.unsplash.com/photos/1/download?ixid=a");
  assert.equal(bildirimler[0].o.basliklar.Authorization, "Client-ID GIZLI-K");
  // bildirim hatasi indirmeyi bozmaz
  const hatali = { kaynak: "unsplash", url: "https://images.unsplash.com/photo-1", indirmeBildir: async () => { throw new Error("ag yok"); } };
  assert.equal((await indir.adaylardanIndir(indirSecenek(getir, [hatali]))).eklenen, 1);
});

// ------------------------------------------------------------------ 9) VS: muzeler sorgulanmaz
test("vs: kapak gorseli aramasinda muze kaynaklari (Met/AIC/Cleveland/Rijks) hic cagrilmaz; aday indirme basligi ve bildirimi calisir", async () => {
  const muzeCagri = [];
  const muze = ad => async () => { muzeCagri.push(ad); return []; };
  let bildirim = 0;
  const getir = sahteGetir({ "https://img.test/kurt.jpg": Y.jpegUret(1600, 1400) });
  const aday = { kaynak: "pexels", url: "https://img.test/kurt.jpg", indirmeUrl: "https://img.test/kurt.jpg", yedekUrl: [], baslik: "gray wolf in snow", etiket: "", atif: "F",
    kaynakUrl: "https://www.pexels.com/photo/1/", en: 1600, boy: 1400, sira: 0, indirmeBasliklar: { "X-Deneme": "1" }, indirmeBildir: async () => { bildirim++; } };
  const yonetici = new kaynak.KaynakYonetici({ getir, anahtarlar: { pexels: "x" }, etkin: {}, bekle: bos, aralik: {}, log: () => {}, uyari: () => {},
    istemciler: { pexels: async () => [Object.assign({}, aday, lisans.lisansCoz("pexels"))], pixabay: async () => [], wikimedia: async () => [], openverse: async () => [], nasa: muze("nasa"),
      met: muze("met"), aic: muze("aic"), cleveland: muze("cleveland"), rijks: muze("rijks") } });
  const r = await vs.tarafGorseliSec({ taraf: { ad: "WOLF", renk: "FFB020", ara: "gray wolf", zorunlu: ["wolf"] }, getir, yonetici, bekle: bos });
  assert.ok(r.buf, "gorsel secilmeli: " + JSON.stringify(r.reddedilen || r.elenme));
  assert.deepEqual(muzeCagri, [], "muze/NASA cagrilmamali");
  assert.deepEqual(vs.VS_HARIC.slice().sort(), ["aic", "cleveland", "europeana", "met", "nasa", "rijks", "smithsonian"]);
  assert.equal(getir.kayit.gorsel[0].o.basliklar["X-Deneme"], "1");
  assert.equal(bildirim, 1);
});

// ------------------------------------------------------------------ 12) Unsplash 403 istek limiti
test("yonetici: Unsplash 403 + X-Ratelimit-Remaining 0 (ya da 'Rate Limit Exceeded') 'anahtar gecersiz' DEGIL, 'istek limiti' diye kapanir", async () => {
  const yap = hata => new kaynak.KaynakYonetici({ getir: {}, anahtarlar: { unsplash: "K", pexels: "P" }, etkin: {}, bekle: bos, aralik: {}, log: () => {}, uyari: () => {},
    istemciler: { unsplash: async () => { throw hata; }, pexels: async () => { throw hata; } } });
  const y1 = yap(new ag.AgHatasi("HTTP 403", 403, { basliklar: { "x-ratelimit-remaining": "0" } }));
  await y1.ara("unsplash", "a", {});
  assert.equal(y1.acikMi("unsplash"), false);
  assert.match(y1.durum.unsplash.kapaliNeden, /istek limiti/); assert.doesNotMatch(y1.durum.unsplash.kapaliNeden, /anahtar geçersiz/);
  const y2 = yap(new ag.AgHatasi("HTTP 403", 403, { basliklar: {}, govde: "Rate Limit Exceeded" }));
  await y2.ara("unsplash", "a", {});
  assert.match(y2.durum.unsplash.kapaliNeden, /istek limiti/);
  const y3 = yap(new ag.AgHatasi("HTTP 403", 403, { basliklar: { "x-ratelimit-remaining": "37" } }));
  await y3.ara("unsplash", "a", {});
  assert.match(y3.durum.unsplash.kapaliNeden, /anahtar geçersiz ya da saatlik istek limiti doldu \(HTTP 403\)/);
  await y3.ara("pexels", "a", {});
  assert.match(y3.durum.pexels.kapaliNeden, /^anahtar geçersiz \(HTTP 403\)/);
  // istemci hata govdesini ister (limit ile gecersiz anahtari ayirmak icin)
  const getir = sahteGetir({}, () => ({ results: [] }));
  await kaynak.unsplashAra("x", {}, { getir, anahtar: "K" });
  assert.equal(getir.kayit.json[0].o.hataGovdesi, true);
});

// ------------------------------------------------------------------ 13) kaynak-dene: gercek indirme + puanlama
test("kaynak-dene: aramayi, puanlamayi ve ilk adayin GERCEK indirmesini ayri raporlar; yalniz gorsel inen kaynak 'calisiyor' sayilir", async () => {
  const aday = (kaynakAd, url, ek) => Object.assign({ kaynak: kaynakAd, url, indirmeUrl: url, yedekUrl: [], baslik: "Windmill at dusk", etiket: "", atif: "A",
    kaynakUrl: "https://k.test/" + kaynakAd, en: 0, boy: 0, sira: 0, lisans: "CC0", lisansKodu: "cc0", lisansSira: 0 }, ek || {});
  const getir = sahteGetir((u, o) => {
    if (u === "https://k.test/met.jpg") return Y.jpegUret(1920, 1280);
    if (u === "https://k.test/aic.jpg") return o && o.basliklar && o.basliklar["AIC-User-Agent"] ? Y.jpegUret(1686, 1244) : new ag.AgHatasi("HTTP 403", 403);
    if (u.startsWith("https://k.test/si")) return new ag.AgHatasi("HTTP 403", 403);
    return undefined;
  });
  const istemciler = {
    met: async () => [aday("met", "https://k.test/met.jpg")],
    aic: async () => [aday("aic", "https://k.test/aic.jpg", { indirmeBasliklar: { "AIC-User-Agent": "Otopilot (test)" } })],
    cleveland: async () => [aday("cleveland", "https://k.test/c1.jpg", { en: 1239, boy: 893 }), aday("cleveland", "https://k.test/c2.jpg", { en: 1258, boy: 893 })],
    smithsonian: async () => [aday("smithsonian", "https://k.test/si1.jpg"), aday("smithsonian", "https://k.test/si2.jpg")],
    rijks: async () => { throw new ag.AgHatasi("HTTP 500", 500); },
    nasa: async () => [],
    pexels: async () => { throw new Error("anahtarsiz cagrilmamali"); },
  };
  const satirlar = [];
  const r = await kaynakDene.dene({ q: "windmill", getir, istemciler, anahtarOku: k => (k === "SMITHSONIAN_KEY" ? "K" : ""), log: m => satirlar.push(m), bekle: bos });
  const satir = ad => r.sonuclar.find(s => s.ad === ad);
  assert.equal(r.calisan, 2, satirlar.join("\n"));
  assert.equal(satir("met").durum, "ok"); assert.match(satir("met").satir, /^OK .*arama 1 aday · puanlama 1\/1 · görsel 1920x1280 indi/);
  assert.equal(satir("aic").durum, "ok", "AIC basligi indirmede gitmeli");
  assert.equal(satir("cleveland").durum, "gorsel_yok"); assert.match(satir("cleveland").satir, /^! .*puanlama 0\/2 geçti \(çözünürlük düşük 2\)/);
  assert.equal(satir("smithsonian").durum, "gorsel_yok"); assert.match(satir("smithsonian").satir, /görsel inmedi \(indirilemedi \(HTTP 403\) 2\)/);
  assert.equal(satir("rijks").durum, "hata"); assert.match(satir("rijks").satir, /^X .*HTTP 500/);
  assert.equal(satir("nasa").durum, "bos"); assert.match(satir("nasa").satir, /^\? /);
  assert.equal(satir("pexels").durum, "atlandi"); assert.match(satir("pexels").satir, /atlandi \(PEXELS_KEY yok\)/);
  assert.match(satirlar[satirlar.length - 1], /2 kaynaktan görsel indi; 2 kaynakta arama çalışıyor ama görsel inmedi/);
  assert.equal(r.aramaCalisan, 4);
});
