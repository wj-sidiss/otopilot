// GO — gorsel arama ISABETI (20 Eki 2026 gercek ornegi: Turkce Shorts "Ay neden hep aynı yüzünü gösterir?" icin
// "aynı" / "Dünya" arandi; Ay videosuna adam portresi, nehir, Dunya Kupasi bileti geldi).
//   1) dolgu kelimeler arama terimi/capa olmaz; Turkce gok cisimleri/somut isimler Ingilizceye cevrilir
//   2) Voice/ARAMALAR.txt (ajan, Ingilizce, "|" yedekli): okuma, paragraf eslemesi, uyarilar, --ara onceligi, degisince yenileme
//   3) alaka suzgeci: baslik/aciklama aramayla eslesmeyen aday yalniz alakali aday yetmezse alinir (alakaZayif + uyari)
// Ag SAHTELENIR; gorseller ffmpeg gerektirmeyen sentetik JPEG iskeletleridir (test/birim-yardim.js). Gercek aga/.env'e cikmaz.
"use strict";
const Y = require("./birim-yardim");
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const ag = require("../lib/gorsel-ag.js");
const sorgu = require("../lib/gorsel-sorgu.js");
const sozluk = require("../lib/gorsel-sozluk.js");
const puan = require("../lib/gorsel-puan.js");
const man = require("../lib/gorsel-manifest.js");
const { calistir, aramalariBelirle } = require("../lib/gorsel-akis.js");

const ortam = Y.ortamKur("gorsel-isabet");
test.after(() => ortam.temizle());

// ------------------------------------------------------------------ Ay ornegi (gercek vakaya sadik)
const AY = [
  "Ay neden hep aynı yüzünü gösterir? Gökyüzüne her baktığında aynı kraterleri ve aynı karanlık lekeleri görürsün, hiç değişmez.",
  "Bunun nedeni kütleçekimsel kilitlenme. Dünya'nın çekim gücü milyarlarca yıl boyunca Ay'ın dönüşünü yavaşlattı ve sonunda onu kilitledi.",
  "Şimdi Ay, kendi ekseni etrafında tam olarak Dünya'nın etrafında bir tur attığı sürede döner. Bu yüzden hep aynı yüz bize bakar.",
  "Ay'ın uzak yüzünü ilk kez 1959'da Sovyet uzay sondası Luna 3 fotoğrafladı. Uzayın sırlarını kaçırmamak için takip et.",
];
const AY_METIN = AY.join("\n\n");
// arama terimi/capa olarak ASLA secilmemesi gerekenler (katlanmis bicimde karsilastirilir)
const DOLGU = ["ayni", "hep", "neden", "nedeni", "gosterir", "yuzunu", "yuz", "bunun", "simdi", "bu", "her", "hic", "yuzden",
  "bakar", "doner", "gorursun", "baktiginda", "kendi", "etrafinda", "takip", "dunya", "degismez", "karanlik", "uzak"];
const dolguVar = ifade => sorgu.katla(ifade).split(/[^\p{L}\p{N}]+/u).some(t => DOLGU.includes(t));

function ayBaglami() {
  const dil = "tr", sen = AY_METIN;
  const kucuk = sorgu.kucukSozluk(sen, dil), ozelKanit = sorgu.ozelKanitlari(sen), ingilizce = new Set();
  const genelSayim = {};
  for (const w of sorgu.kelimeler(sen, dil)) genelSayim[w] = (genelSayim[w] || 0) + 1;
  const toplamKelime = Object.values(genelSayim).reduce((a, b) => a + b, 0);
  const sahneler = sorgu.sahnePlan(AY, { kisa: true });
  const paragrafta = {};
  for (const s of sahneler) for (const w of new Set(sorgu.kelimeler(s.metin, dil))) paragrafta[w] = (paragrafta[w] || 0) + 1;
  const capa = sorgu.genelCapa(sen, sahneler.map(s => s.metin), { dil, kucuk, ozelKanit, ingilizce });
  const ikiliGenel = sorgu.ikiliSayimlari(sen, dil);
  const listeler = sahneler.map(s => sorgu.ifadeCikar(s.metin, { dil, genelSayim, toplamKelime, capa, paragrafta, kucuk, ikiliGenel, senaryo: sen, ozelKanit, ingilizce }));
  return { sahneler, capa, listeler, ingilizce };
}

test("Ay ornegi: 'aynı'/'hep'/'neden' ve 'Dünya' ASLA terim/capa olmaz; capa Moon, sahne 1 Moon ile baslar, Dünya -> Earth", () => {
  const b = ayBaglami();
  assert.equal(b.sahneler.length, 4, "her paragraf ayri sahne");
  assert.equal(b.capa[0], "Moon", "konu capasi: " + b.capa.join(" · "));
  for (const x of b.capa) assert.ok(!dolguVar(x), "capada dolgu kelime: " + x);
  assert.equal(b.listeler[0][0], "Moon", "sahne 1: " + b.listeler[0].join(" / "));
  b.listeler.forEach((l, i) => {
    assert.ok(l.length >= 1, "sahne " + (i + 1) + " bos");
    for (const x of l) assert.ok(!dolguVar(x), "sahne " + (i + 1) + " dolgu terimi secti: " + x + " (" + l.join(" / ") + ")");
    assert.notEqual(sorgu.katla(l[0]), "dunya", "Turkce 'Dünya' aranmamali (Dunya Kupasi bileti getiriyordu)");
  });
  assert.ok(b.listeler[1].includes("Earth") && b.listeler[2].includes("Earth"), "Dünya'nın -> Earth");
  assert.ok(b.listeler[0].includes("crater") && b.listeler[0].includes("sky"), "kraterleri/Gökyüzüne -> crater/sky: " + b.listeler[0]);
  assert.ok(b.listeler[3].includes("space probe"), "uzay sondası -> space probe: " + b.listeler[3]);
  // cevrilenler Ingilizce aranmak uzere isaretlenir; Turkce kalanlar isaretlenmez
  for (const x of ["Moon", "Earth", "crater", "sky", "space probe"]) assert.ok(b.ingilizce.has(x), x);
  assert.ok(!b.ingilizce.has("lekeleri"));
});

test("sozluk: ekli bicimler, iki kelimelik kavramlar, ozel adlar yalniz buyuk harfle; belirsiz kokler cevrilmez", () => {
  const c = w => (sozluk.cevir(w) || {}).en || null;
  assert.equal(c("kraterleri"), "crater");
  assert.equal(c("yıldızların"), "star");
  assert.equal(c("şehrin"), "city", "unlu dusmesi");
  assert.equal(c("kitabı"), "book", "unsuz yumusamasi");
  assert.equal(c("kurdu"), "wolf");
  assert.equal(c("gökyüzüne"), "sky");
  for (const w of ["kara", "aynı", "yüzünü", "ayın", "altına", "kanun", "adam", "film", "başla", "parça", "dünya"]) assert.equal(c(w), null, w);
  const t = (p, s) => sozluk.terimler(p, { senaryo: s }).liste.map(x => x.en);
  assert.deepEqual(t("Kara deliğin çevresinde ışık bükülür."), ["black hole"], "'kara' tek basina kar degil");
  assert.deepEqual(t("Dünya Kupası'nda Messi parladı."), ["FIFA World Cup"], "Dünya Kupası -> Earth DEGIL");
  assert.deepEqual(t("Kutup ayısı buzların üstünde yürür."), ["polar bear", "ice"]);
  assert.deepEqual(t("Mısır'da piramitler ve mısır tarlaları."), ["Egypt", "pyramid"], "kucuk 'mısır' misirdir");
  assert.deepEqual(t("Galata Kulesi ve Yunus Emre heykeli."), [], "cumle ortasi buyuk harf ozel adin parcasi: tower/dolphin degil");
  // "Ay" cumle basinda: senaryoda kucuk 'ay' (30 gun) geciyorsa cevrilmez; kesmeli ya da cumle ortasinda her zaman Moon
  assert.deepEqual(t("Ay sonunda faturalar geldi.", "Ay sonunda faturalar geldi. Her ay ödüyoruz."), []);
  assert.deepEqual(t("Ay sonunda faturalar geldi.", "Ay sonunda faturalar geldi."), ["Moon"]);
  assert.deepEqual(t("Bu ay Ay'ın en parlak hâli."), ["Moon"]);
  assert.deepEqual(t("Dünyanın en büyük şelalesi."), ["waterfall"], "kucuk dünya (alem) Earth degil");
});

test("dolgu/sifat/fiil cekimleri terim olamaz (Turkce); somut isimler olur; es/de/fr temel durak sozcukler", () => {
  for (const w of ["aynı", "hep", "gösteriyor", "baktığında", "görürsün", "değişmez", "yavaşlattı", "kütleçekimsel", "dönerek",
    "bakınca", "olması", "geleceğini", "eski", "önemliydi", "yüzünü", "sırlarını", "milyonlarca", "takip", "abone"])
    assert.equal(sorgu.terimOlabilir(w, "tr"), false, w);
  for (const w of ["kraterler", "deniz", "lekeleri", "nehirler", "kadın"]) assert.equal(sorgu.terimOlabilir(w, "tr"), true, w);
  // cumle sonu yuklemi (genis zaman) baglamla elenir
  const son = sorgu.cumleSonlari("Ay hep aynı yüzünü gösterir. Kraterler görünür.", "tr");
  assert.ok(son.has("gösterir") && son.has("görünür"));
  assert.equal(sorgu.terimOlabilir("gösterir", "tr", son), false);
  assert.deepEqual(sorgu.kelimeler("Le soleil et la lune brillent dans l'univers", "fr"), ["soleil", "lune", "brillent", "univers"]);
  assert.deepEqual(sorgu.kelimeler("Der Mond und die Sterne sind sehr hell", "de"), ["mond", "sterne", "hell"]);
  assert.deepEqual(sorgu.kelimeler("La luna y las estrellas son muy bonitas", "es"), ["luna", "estrellas", "bonitas"]);
  // Ingilizce kapanis cagrilari da terim degil
  assert.deepEqual(sorgu.kelimeler("Subscribe to the channel for more videos about the moon", "en"), ["moon"]);
});

test("ozelIsimler (Turkce): cumle basindaki tek buyuk harfli kelime kanit yoksa ozel ad sayilmaz; kanitli ad korunur", () => {
  const sen = "Arka yüzünü ilk kez Luna fotoğrafladı. Einstein 1905'te yazdı. Einstein'ın kuramı ünlü.";
  const kanit = sorgu.ozelKanitlari(sen);
  const ozel = p => sorgu.ozelIsimler(p, { dil: "tr", kucuk: sorgu.kucukSozluk(sen, "tr"), ozelKanit: kanit });
  assert.ok(!ozel("Arka yüzünü ilk kez Luna fotoğrafladı.").includes("Arka"), "Arka ozel ad degil");
  assert.ok(ozel("Arka yüzünü ilk kez Luna fotoğrafladı.").includes("Luna"));
  assert.ok(ozel("Einstein 1905'te yazdı.").includes("Einstein"), "kesmeli kullanim kanittir");
  // vurgu icin buyuk yazilmis dolgu kisaltma sayilmaz; gercek kisaltma kalir
  const vurgu = sorgu.ozelIsimler("Ay HEP AYNI yüzünü gösterir, NASA bunu ölçtü.", { dil: "tr", kucuk: new Set() });
  assert.ok(!vurgu.includes("HEP") && !vurgu.includes("AYNI") && vurgu.includes("NASA"), vurgu.join());
  assert.ok(!sorgu.ozelIsimler("It is VERY big and NASA knows.", { dil: "en" }).includes("VERY"));
  // kanit verilmezse eski davranis (geri uyumluluk)
  assert.deepEqual(sorgu.ozelIsimler("Dün İstanbul Boğazı çok güzeldi.", { dil: "tr", kucuk: new Set() }).slice(0, 1), ["İstanbul Boğazı"]);
});

test("Ingilizce senaryo: cikarim degismez, Ingilizce kumesine hicbir sey eklenmez", () => {
  const txt = "A black hole bends light. Scientists study each black hole carefully. Another black hole appears near the star.";
  const par = txt.split(". ").map(x => x + ".");
  const ing = new Set();
  const capa = sorgu.genelCapa(txt, par, { dil: "en", ingilizce: ing });
  const kucuk = sorgu.kucukSozluk(txt, "en");
  const gs = {}; for (const w of sorgu.kelimeler(txt, "en")) gs[w] = (gs[w] || 0) + 1;
  const l = sorgu.ifadeCikar(par[0], { dil: "en", genelSayim: gs, toplamKelime: 20, capa, paragrafta: { black: 3, hole: 3 }, kucuk, ikiliGenel: sorgu.ikiliSayimlari(txt, "en"), ingilizce: ing });
  assert.ok(l.includes("black hole"));
  assert.equal(ing.size, 0);
  assert.equal(sorgu.capaMetni(["black", "hole"], ing), "black hole");
  assert.equal(sorgu.capaMetni(["Moon", "lekeleri"], new Set(["Moon"])), "Moon", "karisik dil birlestirilmez");
});

// ------------------------------------------------------------------ ARAMALAR.txt
test("aramaSatirlariCoz: '|' yedekleri, numara/madde/tirnak/BOM/yorum/bos satir; '-' yer tutucu; 'uret:' atilir", () => {
  const metin = String.fromCharCode(0xFEFF) + "# ajan notu: her paragraf icin bir satir\n" +
    "1. full moon night sky | moon surface closeup\n\n" +
    "2) \"Earth and Moon from space\" | earth moon orbit | Earth and Moon from space\n" +
    "- tidal locking diagram\n" +
    "Paragraf 4: uret: glowing crater\n" +
    "-\n" +
    "3.5 billion years old rock |  | \n";
  assert.deepEqual(man.aramaSatirlariCoz(metin), [
    ["full moon night sky", "moon surface closeup"],
    ["Earth and Moon from space", "earth moon orbit"],
    ["tidal locking diagram"],
    ["glowing crater"],
    [],
    ["3.5 billion years old rock"],
  ]);
  assert.deepEqual(man.aramaSatirlariCoz(""), []);
  assert.equal(man.aramaSatirlariCoz("a | b | c | d | e | f | g | h | i | j")[0].length, 8, "en cok 8 arama");
  assert.equal(typeof require("../gorsel-bul.js").aramaSatirlariCoz, "function");
});

function isKur(ad, o) {
  const d = path.join(process.env.OTOMASYON_URETIM, ad);
  fs.mkdirSync(path.join(d, "Voice"), { recursive: true });
  if (o.senaryo !== undefined) fs.writeFileSync(path.join(d, "Voice", "SESLENDIRME-TAM-METIN.txt"), o.senaryo, "utf8");
  if (o.konu !== undefined) fs.writeFileSync(path.join(d, "konu.json"), JSON.stringify(o.konu, null, 2), "utf8");
  if (o.aramalar !== undefined) fs.writeFileSync(path.join(d, "Voice", "ARAMALAR.txt"), o.aramalar, "utf8");
  return d;
}
const isYol = (is, ...p) => path.join(process.env.OTOMASYON_URETIM, is, ...p);

test("aramalarTxtOku: dosya yoksa null (uyarisiz); eksik/fazla satirda anlasilir Turkce uyari + eslesen kadari; Turkce satir ve eski dosya uyarisi", () => {
  isKur("txt-oku", { senaryo: "bir\n\niki\n\nüç\n\ndört" });
  const uy = [];
  assert.equal(man.aramalarTxtOku("txt-oku", 4, m => uy.push(m)), null);
  assert.equal(uy.length, 0);

  fs.writeFileSync(isYol("txt-oku", "Voice", "ARAMALAR.txt"), "full moon | moon surface\nearth from space\n");
  let h = man.aramalarTxtOku("txt-oku", 4, m => uy.push(m));
  assert.deepEqual([...h.keys()], [0, 1]);
  assert.deepEqual(h.get(0).aramalar, ["full moon", "moon surface"]);
  assert.match(uy.pop(), /ARAMALAR\.txt'de 2 satır var ama senaryoda 4 paragraf var: ilk 2 paragrafta bu aramalar kullanılıyor, kalan 2 paragrafta otomatik arama/);

  fs.writeFileSync(isYol("txt-oku", "Voice", "ARAMALAR.txt"), "a1 x\nb2 x\nc3 x\nd4 x\ne5 x\nf6 x\n");
  h = man.aramalarTxtOku("txt-oku", 4, m => uy.push(m));
  assert.deepEqual([...h.keys()], [0, 1, 2, 3]);
  assert.match(uy.pop(), /6 satır var ama senaryoda 4 paragraf var: ilk 4 satır kullanıldı, fazla 2 satır yok sayıldı/);

  fs.writeFileSync(isYol("txt-oku", "Voice", "ARAMALAR.txt"), "dolunay gece gökyüzü\nmoon\nearth\nAy'ın uzak yüzü\n");
  h = man.aramalarTxtOku("txt-oku", 4, m => uy.push(m));
  assert.equal(h.size, 4);
  assert.match(uy.pop(), /satır 1, 4 Türkçe görünüyor/);
  for (const x of ["kale salad", "Möbius strip", "Zürich lake at night", "full moon night sky", "pasta on a plate"])
    assert.equal(sorgu.turkceGorunuyorMu(x), false, x);

  fs.writeFileSync(isYol("txt-oku", "Voice", "ARAMALAR.txt"), "# yalniz yorum\n\n");
  assert.equal(man.aramalarTxtOku("txt-oku", 4, m => uy.push(m)), null);
  assert.match(uy.pop(), /ARAMALAR\.txt boş/);

  // senaryo ARAMALAR.txt'den sonra degistiyse hatirlat
  fs.writeFileSync(isYol("txt-oku", "Voice", "ARAMALAR.txt"), "moon\nearth\nsun\nstars\n");
  const eski = new Date(Date.now() - 60000);
  fs.utimesSync(isYol("txt-oku", "Voice", "ARAMALAR.txt"), eski, eski);
  man.aramalarTxtOku("txt-oku", 4, m => uy.push(m));
  assert.match(uy.pop(), /ARAMALAR\.txt senaryodan eski/);
});

test("aramalariBelirle: elle > ARAMALAR.txt > gorsel-aramalari.json > otomatik; paragraf bazli birlesim", () => {
  const otomatik = () => ["otomatik-ifade"];
  const info = { s: { no: 2, paragraflar: [3, 4] } };
  const txt = new Map([[3, { aramalar: ["full moon night sky", "moon surface closeup"] }]]);
  const json = new Map([[3, { aramalar: ["json bir"], uret: "" }], [4, { aramalar: ["json iki"], uret: "a glowing orb" }]]);
  const elle = aramalariBelirle(info, { konu: { sahneKelimeleri: ["x", ["Elle Bir"]] }, aramalarHarita: json, txtHarita: txt, otomatik });
  assert.deepEqual([elle.kaynak, elle.liste], ["elle", ["Elle Bir"]]);
  const t = aramalariBelirle(info, { konu: {}, aramalarHarita: json, txtHarita: txt, otomatik });
  assert.equal(t.kaynak, "aramalar-txt");
  assert.deepEqual(t.liste, ["full moon night sky", "json iki", "moon surface closeup"], "paragraf 3 txt, paragraf 4 json");
  assert.equal(t.aiIstem, "a glowing orb");
  const yalnizTxt = aramalariBelirle(info, { konu: {}, aramalarHarita: null, txtHarita: txt, otomatik });
  assert.deepEqual([yalnizTxt.kaynak, yalnizTxt.liste], ["aramalar-txt", ["full moon night sky", "moon surface closeup"]]);
  // '-' yer tutucu (bos liste) o paragrafi otomatige birakir
  const bos = aramalariBelirle(info, { konu: {}, aramalarHarita: null, txtHarita: new Map([[3, { aramalar: [] }], [4, { aramalar: [] }]]), otomatik });
  assert.deepEqual([bos.kaynak, bos.liste], ["otomatik", ["otomatik-ifade"]]);
});

// ------------------------------------------------------------------ alaka suzgeci (puan)
const ctx = (q, ek) => Object.assign({ sorgu: q, sorguTok: puan.sorguTokenleri(q, "en"), yon: "yatay", siraLimiti: 40, aramaDili: "en" }, ek || {});
const aday = (o) => Object.assign({ kaynak: "wikimedia", baslik: "", etiket: "", sira: 0, en: 1920, boy: 1080, lisansSira: 0 }, o || {});

test("puanla alakaSuzgeci: baslik/aciklama aramayla hic eslesmeyen aday 'alakasiz' + ALAKA_CEZA; Pexels muaf; metinsiz aday muaf; suzgec kapaliyken puan ayni", () => {
  const bilet = aday({ baslik: "World Cup ticket 2018", etiket: "football match entry" });
  const ac = puan.puanla(bilet, ctx("planet Earth", { alakaSuzgeci: true }));
  const kapali = puan.puanla(bilet, ctx("planet Earth"));
  assert.equal(ac.alakasiz, true);
  assert.equal(ac.elendi, null, "elenmez: rezerv olarak kalir");
  assert.equal(kapali.alakasiz, undefined, "gorsel-cek/portre/vs davranisi degismez");
  assert.equal(Math.round(kapali.puan - ac.puan), puan.ALAKA_CEZA);
  // aciklamada/kategoride gecmesi yeter
  assert.equal(puan.puanla(aday({ baslik: "DSC 0042", etiket: "The Earth seen from Apollo 17" }), ctx("planet Earth", { alakaSuzgeci: true })).alakasiz, undefined);
  // bicim kelimeleri ("full", "closeup") tek basina alaka saymaz
  assert.equal(puan.puanla(aday({ baslik: "Full house poster closeup" }), ctx("full moon closeup", { alakaSuzgeci: true })).alakasiz, true);
  // bitisik dosya adi: "FullMoon2010"
  assert.equal(puan.puanla(aday({ baslik: "FullMoon2010" }), ctx("full moon", { alakaSuzgeci: true })).alakasiz, undefined);
  // Pexels/Pixabay anlamsal arama: muaf; metadata yoksa muaf
  assert.equal(puan.puanla(aday({ kaynak: "pexels", baslik: "a person holding a phone" }), ctx("moon", { alakaSuzgeci: true })).alakasiz, undefined);
  assert.equal(puan.puanla(aday({ baslik: "", etiket: "" }), ctx("moon", { alakaSuzgeci: true })).alakasiz, undefined);
});

// ------------------------------------------------------------------ sahte internet + akis
let _n = 7000;
const jpg = () => Y.jpegUret(1920, 1080, { bayt: 3000 + (++_n) });
function sahteAg(kaynaklar) {
  const resimler = new Map();
  const sorgular = [], istekler = [];
  const json = async (url) => {
    istekler.push(url);
    const u = new URL(url), p = u.searchParams;
    const al = (ad, q) => { sorgular.push([ad, q]); const v = kaynaklar[ad] ? kaynaklar[ad](q) : []; if (v instanceof Error) throw v; return v; };
    if (u.hostname === "commons.wikimedia.org") return { query: { pages: al("wikimedia", p.get("gsrsearch").replace(/ filetype:bitmap$/, "")) } };
    if (u.hostname === "api.openverse.org") return { results: al("openverse", p.get("q")) };
    if (u.hostname === "api.pexels.com") return { photos: al("pexels", p.get("query")) };
    if (u.hostname === "pixabay.com") return { hits: al("pixabay", p.get("q")) };
    if (u.hostname === "images-api.nasa.gov") return { collection: { items: al("nasa", p.get("q")) } };
    throw new ag.AgHatasi("beklenmeyen adres: " + u.hostname, "adres");
  };
  const gorsel = async (url) => { const r = resimler.get(url); if (!r) throw new ag.AgHatasi("HTTP 404", 404); return { govde: r, durum: 200, basliklar: {} }; };
  const getir = async (url) => ({ govde: Buffer.from(JSON.stringify(await json(url))) });
  getir.json = json; getir.gorsel = gorsel;
  return { getir, resimler, sorgular, istekler };
}
function wiki(a, ad, o) {
  o = o || {};
  const thumb = "https://upload.test/thumb/" + encodeURIComponent(ad) + ".jpg";
  if (!a.resimler.has(thumb)) a.resimler.set(thumb, jpg());
  return { pageid: ++_n, title: "File:" + ad + ".jpg",
    imageinfo: [{ thumburl: thumb, url: thumb, descriptionurl: "https://commons.wikimedia.org/wiki/File:" + encodeURIComponent(ad),
      width: 3000, height: 2000, thumbwidth: 1920, thumbheight: 1280, mime: "image/jpeg",
      extmetadata: { LicenseShortName: { value: "CC0" }, Artist: { value: "Test" }, ImageDescription: { value: o.aciklama || "" } } }] };
}
const sirala = l => l.map((p, i) => Object.assign(p, { index: i + 1 }));
const alakaliKatalog = a => q => sirala([1, 2, 3, 4].map(i => wiki(a, q + " foto " + i, { aciklama: q })));
const biletler = (a, n) => Array.from({ length: n || 4 }, (_, i) => wiki(a, "World Cup ticket " + (i + 1), { aciklama: "football match entry ticket" }));
function bag(a, ek) {
  const log = [], uyarilar = [];
  const bos = async () => {};
  return Object.assign({ getir: a.getir, bekle: bos, bekleKaynak: bos, aralik: {}, indirmeAra: 0, anahtarlar: { pexels: "", pixabay: "" },
    log: m => log.push(m), uyari: m => uyarilar.push(m), _log: log, _uyari: uyarilar }, ek || {});
}
const manifest = is => JSON.parse(fs.readFileSync(isYol(is, "Visuals", "manifest.json"), "utf8"));
const sessiz = fn => Y.yakala(fn);
const wikiSorgulari = a => a.sorgular.filter(s => s[0] === "wikimedia").map(s => s[1]);
const AY_KONU = { format: "short", dil: "tr", ses: "tr-TR-AhmetNeural", intro: 0, outro: 0, markaKose: 0 };
const AY_TXT = "full moon night sky | moon surface closeup\nEarth and Moon from space | tidal locking\nMoon orbit around Earth\nfar side of the Moon | Luna 3 probe\n";

test("akis + ARAMALAR.txt: her sahne kendi Ingilizce satiriyla aranir, manifest aramalar/aramaKaynagi dosyayi yansitir, capa Ingilizce", async () => {
  const is = "txt-akis";
  isKur(is, { senaryo: AY_METIN, konu: AY_KONU, aramalar: AY_TXT });
  const a = sahteAg({ wikimedia: q => alakaliKatalog(a)(q) });
  const b = bag(a);
  await sessiz(() => calistir({ is }, b));
  const m = manifest(is);
  const beklenen = man.aramaSatirlariCoz(AY_TXT);
  assert.equal(m.sahneler.length, 4);
  m.sahneler.forEach((s, i) => {
    assert.deepEqual(s.aramalar, beklenen[i], "sahne " + (i + 1));
    assert.equal(s.aramaKaynagi, "aramalar-txt");
    assert.ok(s.gorseller.length >= 2);
    assert.ok(s.gorseller.every(g => !g.alakaZayif));
  });
  const q = wikiSorgulari(a);
  assert.equal(q[0], "full moon night sky");
  assert.ok(!q.some(dolguVar), "Turkce dolgu aranmamali: " + q);
  assert.ok(b._log.some(l => /aramalar  : Voice\/ARAMALAR\.txt \(4\/4 paragraf/.test(l)), b._log.join("\n"));
  const capaSatiri = b._log.find(l => /^konu çapa/.test(l));
  assert.match(capaSatiri, /moon/i);
  assert.ok(!dolguVar(capaSatiri.replace(/^konu çapa :/, "")), capaSatiri);
  assert.match(m.sahneler[0].klasor, /^001-full-moon/);
});

test("akis + ARAMALAR.txt eksik satir: uyari, eslesen 2 sahne dosyadan, kalanlar otomatik (Moon/Earth; dolgu yok)", async () => {
  const is = "txt-eksik";
  isKur(is, { senaryo: AY_METIN, konu: AY_KONU, aramalar: "full moon night sky\nEarth and Moon from space\n" });
  const a = sahteAg({ wikimedia: q => alakaliKatalog(a)(q) });
  const b = bag(a);
  await sessiz(() => calistir({ is }, b));
  assert.ok(b._uyari.some(u => /2 satır var ama senaryoda 4 paragraf var/.test(u)), b._uyari.join("|"));
  const m = manifest(is);
  assert.deepEqual(m.sahneler.map(s => s.aramaKaynagi), ["aramalar-txt", "aramalar-txt", "otomatik", "otomatik"]);
  assert.equal(m.sahneler[2].aramalar[0], "Moon");
  assert.equal(m.sahneler[3].aramalar[0], "Moon");
  for (const s of m.sahneler) for (const x of s.aramalar) assert.ok(!dolguVar(x), "dolgu: " + x);
});

test("--sahne N --ara ARAMALAR.txt'den once gelir; elle duzeltilen sahne sonraki calismada ezilmez; ARAMALAR.txt degisince yalniz o sahne yenilenir", async () => {
  const is = "txt-ara";
  isKur(is, { senaryo: AY_METIN, konu: AY_KONU, aramalar: AY_TXT });
  const a = sahteAg({ wikimedia: q => alakaliKatalog(a)(q) });
  await sessiz(() => calistir({ is }, bag(a)));
  const ilk = manifest(is);

  a.sorgular.length = 0;
  await sessiz(() => calistir({ is, sahne: 2, ara: "earth moon orbit diagram" }, bag(a)));
  assert.deepEqual(wikiSorgulari(a), ["earth moon orbit diagram"], "yalniz --ara ifadesi aranir");
  let m = manifest(is);
  assert.deepEqual(m.sahneler[1].aramalar, ["earth moon orbit diagram"]);
  assert.equal(m.sahneler[1].aramaKaynagi, "elle");
  assert.ok(m.sahneler[1].gorseller.every(g => /^earth moon orbit diagram foto/.test(g.baslik)));
  const elleSha = m.sahneler[1].gorseller.map(g => g.sha1);

  // ayni dosyayla tekrar: hicbir sahneye dokunulmaz (elle sahne ARAMALAR.txt'den farkli olsa da)
  a.sorgular.length = 0;
  const b2 = bag(a);
  const r2 = await sessiz(() => calistir({ is }, b2));
  assert.equal(r2.sonuc.atlandi, true);
  assert.equal(a.sorgular.length, 0);

  // ARAMALAR.txt'de 3. satir degisti: yalniz sahne 3 yeniden aranir, eskiler arsive; elle sahne 2 ve sahne 1/4 aynen
  fs.writeFileSync(isYol(is, "Voice", "ARAMALAR.txt"), AY_TXT.replace("Moon orbit around Earth", "Moon rotation animation | moon phases"), "utf8");
  a.sorgular.length = 0;
  const b3 = bag(a);
  await sessiz(() => calistir({ is }, b3));
  m = manifest(is);
  assert.deepEqual(m.sahneler[2].aramalar, ["Moon rotation animation", "moon phases"]);
  assert.ok(m.sahneler[2].gorseller.every(g => /^Moon rotation animation foto/.test(g.baslik)), m.sahneler[2].gorseller.map(g => g.baslik).join());
  assert.deepEqual(m.sahneler[1].gorseller.map(g => g.sha1), elleSha, "elle sahne ezilmemeli");
  for (const i of [0, 3]) assert.deepEqual(m.sahneler[i].gorseller.map(g => g.sha1), ilk.sahneler[i].gorseller.map(g => g.sha1));
  assert.ok(b3._log.some(l => /sahne 3: ARAMALAR\.txt değişti/.test(l)), b3._log.join("\n"));
  assert.ok(fs.readdirSync(isYol(is, "Visuals")).some(x => /^_eski-/.test(x)), "eski gorseller arsivde (silinmez)");
  assert.deepEqual([...new Set(wikiSorgulari(a))], ["Moon rotation animation"]);
});

test("eski manifest (aramaKaynagi yok) + yeni ARAMALAR.txt: kendiliginden ezilmez, uyari ile --yeniden onerilir", async () => {
  const is = "txt-eski";
  isKur(is, { senaryo: AY_METIN, konu: Object.assign({}, AY_KONU, { sahneKelimeleri: [["moon a"], ["moon b"], ["moon c"], ["moon d"]] }) });
  const a = sahteAg({ wikimedia: q => alakaliKatalog(a)(q) });
  await sessiz(() => calistir({ is }, bag(a)));
  const m0 = manifest(is);
  for (const s of m0.sahneler) delete s.aramaKaynagi;            // onceki surumun manifesti
  fs.writeFileSync(isYol(is, "Visuals", "manifest.json"), JSON.stringify(m0, null, 2));
  isKur(is, { konu: AY_KONU, aramalar: AY_TXT });
  a.sorgular.length = 0;
  const b = bag(a);
  await sessiz(() => calistir({ is }, b));
  assert.equal(a.sorgular.length, 0, "eski sahneler yeniden aranmamali");
  assert.ok(b._uyari.some(u => /4 sahnenin mevcut görsellerinden farklı.*--yeniden/.test(u)), b._uyari.join("|"));
});

test("alaka suzgeci (akis): alakasiz ust siradakiler atlanir; '|' yedek arama denenir; hic alakali yoksa sahne bos kalmaz (alakaZayif + uyari)", async () => {
  const senaryo = Array.from({ length: 3 }, (_, i) => Array.from({ length: 30 }, (_, j) => "terim" + i + "x" + j).join(" ") + ".").join("\n\n");
  // sahne 1: ilk siralarda bilet, asagida 2 alakali; sahne 2: ilk arama yalniz bilet, yedek arama alakali; sahne 3: yalniz bilet
  const is = "alaka-akis";
  isKur(is, { senaryo, konu: { format: "long" }, aramalar: "full moon | moon\nplanet earth | earth from space\nlunar eclipse | blood moon\n" });
  const a = sahteAg({ wikimedia: q => {
    if (q === "full moon") return sirala(biletler(a, 4).concat([wiki(a, "Full moon over the sea", { aciklama: "moon" }), wiki(a, "Moon rising", { aciklama: "full moon" })]));
    if (q === "planet earth") return sirala(biletler(a, 6));
    if (q === "earth from space") return sirala([1, 2, 3].map(i => wiki(a, "Earth from space " + i, { aciklama: "earth" })));
    return sirala(biletler(a, 5));
  } });
  const b = bag(a);
  await sessiz(() => calistir({ is }, b));
  const m = manifest(is);
  assert.deepEqual(m.sahneler[0].gorseller.map(g => g.baslik).sort(), ["Full moon over the sea", "Moon rising"]);
  assert.ok(wikiSorgulari(a).includes("earth from space"), "ilk arama yalniz alakasiz verdi: yedek arama denenmeli");
  assert.ok(m.sahneler[1].gorseller.every(g => /^Earth from space/.test(g.baslik) && !g.alakaZayif));
  // sahne 3: hic alakali yok -> eskisi gibi en iyiler (gerekli kadar), isaretli
  const s3 = m.sahneler[2];
  assert.equal(s3.gorseller.length, 2, "sahne bos kalmamali");
  assert.ok(s3.gorseller.every(g => g.alakaZayif === true && /World Cup ticket/.test(g.baslik)));
  assert.ok(m.sahneler[0].gorseller.concat(m.sahneler[1].gorseller).every(g => !g.alakaZayif));
  assert.ok(b._uyari.some(u => /1 sahnede aramayla eşleşen görsel yetmedi.*sahne 3.*alakaZayif.*--sahne 3 --ara/.test(u)), b._uyari.join("|"));
  assert.ok(b._log.some(l => /alakası zayıf/.test(l)));

  // --ara ile elle arama yalniz alakasiz sonuc verirse eski gorseller GERI KONUR (rezerv yerine) ve exit 4
  const once = m.sahneler[0].gorseller.map(g => g.sha1).sort();
  await assert.rejects(() => sessiz(() => calistir({ is, sahne: 1, ara: "harvest moon" }, bag(a))),
    e => e.kod === "gorsel_yok" && e.cikis === 4 && /mevcut görseller korundu \(3 aday vardı ama başlığı\/açıklaması aramayla eşleşmedi\)/.test(e.message));
  assert.deepEqual(manifest(is).sahneler[0].gorseller.map(g => g.sha1).sort(), once);
});

test("akis (ARAMALAR.txt yok, Turkce): Ay videosu 'aynı'/'Dünya' aramaz; cevrilmis terimler Pexels'e locale'siz, Turkce kalanlar tr-TR ile gider", async () => {
  const is = "tr-oto";
  isKur(is, { senaryo: AY_METIN, konu: AY_KONU });
  const a = sahteAg({ wikimedia: () => [], pexels: () => [] });
  const b = bag(a, { anahtarlar: { pexels: "TEST", pixabay: "" } });
  await assert.rejects(() => sessiz(() => calistir({ is }, b)), e => e.kod === "gorsel_yok");
  const q = wikiSorgulari(a);
  assert.equal(q[0], "Moon", "sahne 1 ilk arama: " + q.slice(0, 6));
  assert.ok(!q.some(dolguVar), "dolgu kelime arandi: " + q.join(" / "));
  assert.ok(b._log.some(l => /^konu çapa : Moon/.test(l)), b._log.find(l => /konu çapa/.test(l)));
  const pex = a.istekler.filter(u => /api\.pexels\.com/.test(u)).map(u => new URL(u).searchParams);
  const moon = pex.find(p => p.get("query") === "Moon");
  assert.ok(moon && !moon.get("locale"), "cevrilmis 'Moon' Ingilizce aranir (locale yok)");
  const tr = pex.find(p => p.get("query") === "lekeleri");
  assert.ok(tr && tr.get("locale") === "tr-TR", "cevrilemeyen Turkce kelime tr-TR ile: " + pex.map(p => p.get("query") + ":" + p.get("locale")).join(", "));
  assert.ok(a.sorgular.some(s => s[0] === "nasa" && s[1] === "Moon"), "Ay konusu NASA'yi devreye sokar");
});

// ------------------------------------------------------------------ denetim turu (25 Eki 2026)
test("dolgu listesi genisletildi: cumle basi/yer gosterme dolgulari terim de ozel ad da olmaz; es/de/fr/en dolgulari; fiile benzeyen somut isimler korunur", () => {
  for (const w of ["bakın", "orada", "burada", "kısacası", "neyse", "bazıları", "merak", "gizemi", "yüzyıllardır", "arasındaki",
    "dolu", "fazlası", "bence", "galiba", "aslı", "efsane", "hikayesi"])
    assert.equal(sorgu.terimOlabilir(w, "tr"), false, w);
  // ozelKanit verilmese de (eski cagiranlar) cumle basindaki dolgu ozel ad sayilmaz
  for (const w of ["Bakın", "Orada", "Kısacası", "Neyse", "Bazıları", "Merak", "Kaç"])
    assert.deepEqual(sorgu.ozelIsimler(w + " bir şey yaptı.", { dil: "tr", kucuk: new Set() }), [], w);
  // TR_FIIL kaliplarina benzeyen somut isimler sozlukte: terim olabilir ve Ingilizce aranir
  const c = w => (sozluk.cevir(w) || {}).en || null;
  assert.equal(c("yemek"), "food");
  assert.equal(c("yemekleri"), "food");
  assert.equal(c("düğünde"), "wedding");
  assert.equal(c("yiyecekler"), "food");
  for (const w of ["yemek", "düğün", "yiyecek", "içecek"]) assert.equal(sorgu.terimOlabilir(w, "tr"), true, w);
  // "zaman"/"saat" tek basina dolgu, kavram icinde somut arama
  const t = p => sozluk.terimler(p, { senaryo: p }).liste.map(x => x.en);
  assert.deepEqual(t("Zaman yolculuğu mümkün mü? Bir zaman makinesi düşünün."), ["time travel", "time machine"]);
  assert.deepEqual(t("Saat kulesinin altında kum saati duruyordu."), ["clock tower", "hourglass"]);
  assert.equal(sorgu.terimOlabilir("zaman", "tr"), false);
  // diger diller: "aynı"nin karsiliklari ve kanca dolgulari
  assert.deepEqual(sorgu.kelimeler("Warum zeigt der Mond immer die gleiche Seite", "de"), ["mond", "seite"]);
  assert.deepEqual(sorgu.kelimeler("La luna muestra siempre la misma cara, un misterio increíble", "es"), ["luna", "muestra", "cara"]);
  assert.deepEqual(sorgu.kelimeler("Les mêmes cratères, un mystère incroyable", "fr"), ["cratères"]);
  assert.deepEqual(sorgu.kelimeler("Imagine an amazing secret: millions of stars", "en"), ["stars"]);
});

// Yalniz Ingilizce basliklar donduren katalog (her aramaya 20 tekil aday): Ingilizce OLMAYAN aramada metadata eslesmez
const ingilizceKatalog = a => () => sirala(Array.from({ length: 20 }, (_, i) => wiki(a, "Starry sky over dunes " + (i + 1), { aciklama: "photo" })));

test("alaka suzgeci, Ingilizce olmayan otomatik arama: metadata eslesmemesi kanit degil -> sahne eskisi gibi hedef adede kadar dolar (alakaZayif), ek arama yapilmaz", async () => {
  const is = "es-oto";
  const metin = Array.from({ length: 50 }, () => "estrellas desierto montaña").join(" ") + ".";
  isKur(is, { senaryo: metin, konu: { format: "long", dil: "es", intro: 0, outro: 0, markaKose: 0 } });
  const a = sahteAg({ wikimedia: q => ingilizceKatalog(a)(q) });
  const b = bag(a);
  await sessiz(() => calistir({ is }, b));
  const m = manifest(is);
  const adet = sorgu.sahneAdetleri([{ kelime: sorgu.kelimeSay(metin) }], { kelimeHizi: require("../lib/ortak.js").kelimeHizi("es"), kisa: false })[0];
  assert.ok(adet > 2, "test kurgusu: hedef adet 2'den buyuk olmali (" + adet + ")");
  const s = m.sahneler[0];
  assert.equal(s.aramaKaynagi, "otomatik");
  assert.equal(s.gorseller.length, adet, "hedef adede kadar dolmali (yalniz 2 degil)");
  assert.ok(s.gorseller.every(g => g.alakaZayif === true));
  assert.ok(wikiSorgulari(a).length <= 2, "belirsiz adaylar erken durmada sayilir: " + wikiSorgulari(a).join(" / "));
  assert.ok(b._uyari.some(u => /aramayla eşleşen görsel yetmedi/.test(u)));
});

test("alaka suzgeci, Ingilizce arama (ARAMALAR.txt): alakasiz aday yalniz sahne bos kalmasin diye (en cok 2) alinir", async () => {
  const is = "en-alakasiz";
  const metin = Array.from({ length: 50 }, () => "estrellas desierto montaña").join(" ") + ".";
  isKur(is, { senaryo: metin, konu: { format: "long", dil: "es", intro: 0, outro: 0, markaKose: 0 }, aramalar: "desert night sky\n" });
  const a = sahteAg({ wikimedia: () => sirala(biletler(a, 20)) });
  // tek sahneli videoda 2 gorsel alt sinirin (6) altinda: exit 4 ve cozum ARAMALAR.txt'yi gosterir; manifest yine yazilir
  await assert.rejects(() => sessiz(() => calistir({ is }, bag(a))), e => e.kod === "gorsel_az" && e.cikis === 4 && /ARAMALAR.txt/.test(e.cozum));
  const s = manifest(is).sahneler[0];
  assert.equal(s.aramaKaynagi, "aramalar-txt");
  assert.equal(s.gorseller.length, 2);
  assert.ok(s.gorseller.every(g => g.alakaZayif === true));
});

test("--ara ile elle aranan sahne eksik kalip yeniden doldurulurken de kendi aramasini korur (ARAMALAR.txt'ye donmez)", async () => {
  const is = "txt-ara-yapiskan";
  isKur(is, { senaryo: AY_METIN, konu: AY_KONU, aramalar: AY_TXT });
  const a = sahteAg({ wikimedia: q => alakaliKatalog(a)(q) });
  await sessiz(() => calistir({ is }, bag(a)));
  await sessiz(() => calistir({ is, sahne: 2, ara: "earth moon orbit diagram" }, bag(a)));
  // panelde sahne 2'nin gorselleri silindi (1 tane kaldi): sahne eksik
  const m = manifest(is);
  const s2 = m.sahneler[1];
  for (const g of s2.gorseller.slice(1)) fs.rmSync(isYol(is, "Visuals", g.dosya), { force: true });
  s2.gorseller = s2.gorseller.slice(0, 1);
  fs.writeFileSync(isYol(is, "Visuals", "manifest.json"), JSON.stringify(m, null, 2));
  a.sorgular.length = 0;
  await sessiz(() => calistir({ is }, bag(a)));
  const q = [...new Set(wikiSorgulari(a))];
  assert.deepEqual(q, ["earth moon orbit diagram"], "elle arama korunmali: " + q.join(" / "));
  const s = manifest(is).sahneler[1];
  assert.equal(s.aramaKaynagi, "elle");
  assert.deepEqual(s.aramalar, ["earth moon orbit diagram"]);
  assert.ok(s.gorseller.length >= 2);
  // --sahne N (--ara olmadan) dosyadaki aramaya doner
  a.sorgular.length = 0;
  await sessiz(() => calistir({ is, sahne: 2 }, bag(a)));
  assert.equal(manifest(is).sahneler[1].aramaKaynagi, "aramalar-txt");
  assert.equal(wikiSorgulari(a)[0], "Earth and Moon from space");
});

test("ARAMALAR.txt Windows PowerShell'in UTF-16 (BOM'lu ve BOM'suz) ciktisi da dogru okunur; cumle basindaki cok kelimeli ozel ad cevrilmez", () => {
  isKur("txt-utf16", { senaryo: "bir\n\niki" });
  const yaz = buf => fs.writeFileSync(isYol("txt-utf16", "Voice", "ARAMALAR.txt"), buf);
  const metin = "full moon night sky | moon surface\r\nEarth from space\r\n";
  const beklenen = [["full moon night sky", "moon surface"], ["Earth from space"]];
  const oku = () => { const h = man.aramalarTxtOku("txt-utf16", 2, () => {}); return h && [...h.values()].map(x => x.aramalar); };
  yaz(Buffer.concat([Buffer.from([0xFF, 0xFE]), Buffer.from(metin, "utf16le")]));
  assert.deepEqual(oku(), beklenen, "UTF-16 LE BOM (PowerShell 5.1 Out-File / >)");
  yaz(Buffer.concat([Buffer.from([0xFE, 0xFF]), Buffer.from(metin, "utf16le").swap16()]));
  assert.deepEqual(oku(), beklenen, "UTF-16 BE BOM");
  yaz(Buffer.from(metin, "utf16le"));
  assert.deepEqual(oku(), beklenen, "BOM'suz UTF-16 LE");
  yaz(Buffer.concat([Buffer.from([0xEF, 0xBB, 0xBF]), Buffer.from("çiğ köfte | Galata Tower\n", "utf8")]));
  const h = man.aramalarTxtOku("txt-utf16", 2, () => {});
  assert.deepEqual(h.get(0).aramalar, ["çiğ köfte", "Galata Tower"], "UTF-8 BOM ve Turkce harfler bozulmaz");

  const t = p => sozluk.terimler(p, { senaryo: p }).liste.map(x => x.en);
  assert.deepEqual(t("Yunus Emre 13. yüzyılda yaşadı."), [], "Yunus Emre -> dolphin degil");
  assert.deepEqual(t("Kartal Kalesi tepede durur."), ["hill"], "Kartal Kalesi -> eagle/castle degil (tepede -> hill)");
  assert.deepEqual(t("Kartal gökyüzünde süzülür."), ["eagle", "sky"], "cumle basindaki tek kelime somut isim olarak cevrilir");
});

test("Turkce senaryoda Turkce yazilmis elle/ARAMALAR.txt aramasi belirsiz sayilir: sahne eskisi gibi dolar; --ara ile de yeni gorsel alinir (eskiler arsivde)", async () => {
  const is = "tr-elle-turkce";
  const metin = Array.from({ length: 40 }, () => "Kapadokya balonları peri bacaları").join(" ") + ".";
  isKur(is, { senaryo: metin, konu: { format: "long", dil: "tr", intro: 0, outro: 0, markaKose: 0 }, aramalar: "Kapadokya balonları gökyüzünde\n" });
  let tur = 0;
  const a = sahteAg({ wikimedia: () => { tur++; return sirala(Array.from({ length: 20 }, (_, i) => wiki(a, "Hot air balloons over Cappadocia " + tur + "-" + (i + 1)))); } });
  const b = bag(a);
  await sessiz(() => calistir({ is }, b));
  const adet = sorgu.sahneAdetleri([{ kelime: sorgu.kelimeSay(metin) }], { kelimeHizi: require("../lib/ortak.js").kelimeHizi("tr"), kisa: false })[0];
  assert.ok(adet > 2, "test kurgusu: " + adet);
  let s = manifest(is).sahneler[0];
  assert.equal(s.aramaKaynagi, "aramalar-txt");
  assert.equal(s.gorseller.length, adet, "Turkce arama: metadata Ingilizce, eslesmemesi kanit degil -> hedef adet");
  assert.ok(b._uyari.some(u => /satır 1 Türkçe görünüyor/.test(u)));
  const eski = s.gorseller.map(g => g.sha1);
  await sessiz(() => calistir({ is, sahne: 1, ara: "Kapadokya peri bacaları" }, bag(a)));
  s = manifest(is).sahneler[0];
  assert.deepEqual(s.aramalar, ["Kapadokya peri bacaları"]);
  assert.ok(s.gorseller.length >= 2 && s.gorseller.every(g => !eski.includes(g.sha1)), "--ara yeni gorselleri almali (eski davranis)");
});

test("Turkce kapanis cagrisi ve izleyiciye seslenme terim olmaz; somut isimler (ürün, yangın, saray, mercimek) korunur; cumle basinda iki kez gecen ad ozel addir", () => {
  const terimler = t => sorgu.kelimeler(t, "tr").filter(w => sorgu.terimOlabilir(w, "tr", sorgu.cumleSonlari(t, "tr")));
  assert.deepEqual(terimler("Abone olmayı ve bildirimleri açmayı unutmayın, yorumlara düşüncelerinizi yazın."), []);
  assert.deepEqual(terimler("Bu videoyu beğenmeyi ve arkadaşlarınla paylaşmayı unutma. Bir sonraki videoda görüşmek üzere!"), []);
  assert.deepEqual(terimler("Gelin birlikte keşfedelim. Hadi başlayalım, size bir sır anlatayım. Düşünsenize, bir sabah uyandınız."), []);
  for (const w of ["ürün", "yangını", "zemini", "sarayın", "mercimek", "köfte", "baklava", "minare", "kervansaray", "hamam"])
    assert.equal(sorgu.terimOlabilir(w, "tr"), true, w);
  const sen = "Napolyon 1812'de Rusya'ya girdi. Ordusu büyüktü. Napolyon bu yenilgiden sonra toparlanamadı.";
  const kanit = sorgu.ozelKanitlari(sen);
  assert.ok(kanit.has("napolyon"), "iki cumlenin basinda, hic kucuk yazilmamis");
  assert.ok(sorgu.ozelIsimler("Napolyon 1812'de Rusya'ya girdi.", { dil: "tr", kucuk: sorgu.kucukSozluk(sen, "tr"), ozelKanit: kanit }).includes("Napolyon"));
  assert.ok(!sorgu.ozelKanitlari("Ordusu büyüktü. Ordusu dağıldı. Ordusu yoktu, ordusu kalmadı.").has("ordusu"), "kucuk geciyorsa kanit degil");
});
