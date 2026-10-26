// Sahnelere STOK VIDEO klibi ekler (Pexels + Pixabay, ucretsiz anahtar ister: PEXELS_KEY / PIXABAY_KEY). gorsel-bul.js'ten SONRA, video-yap.js'ten ONCE.
//   node video-bul.js <is>                  # her sahne icin (en cok 8) alakali bir klip
//   node video-bul.js <is> --sahne 3 --ara "waves crashing on rocks"
//   node video-bul.js <is> --azami 4 --yeniden
// Klip Visuals/<sahne>/00-stok-<kaynak>-<id>.mp4 olarak yazilir; video-yap.js onu sahnenin BASINA koyar (dongulenir, kadraja kirpilir, sessiz).
// Atiflar Visuals/video-atif.json'a HER indirmede (klipten ONCE) yazilir, ATIF.txt ve YAYIN-PAKETI'ne girer. Anahtar yoksa hicbir sey yapmaz, nedenini soyler.
// Ayni klip iki sahneye konmaz (dosya adi = kaynak + kaynak sayfasindaki no); panelden silinen klip (silinenler.json) bir daha gelmez.
"use strict";
const fs = require("fs");
const path = require("path");
const ortak = require("./lib/ortak.js");
const ag = require("./lib/gorsel-ag.js");
const man = require("./lib/gorsel-manifest.js");
const { govdele } = require("./lib/gorsel-puan.js");
const { pexelsVideoAra, pixabayVideoAra } = require("./lib/gorsel-kaynak.js");

const DURAK = new Set(["the", "and", "with", "from", "that", "this", "for", "of", "in", "on", "at", "a", "an", "to", "by", "closeup", "shot", "view", "video", "footage"]);
const tok = s => String(s || "").toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 2 && !DURAK.has(w));

// Indirme sinirlari: soket bosta kalma suresi (zamanAsimiMs) ile TOPLAM sure (toplamAsimiMs) ayridir. Toplam sure izin verilen
// en buyuk dosyayi ~1 Mbps'de (128 KB/sn) bitirecek kadar: 80 MB ~11 dk. Zaman asiminda ayni klip ikinci kez bastan indirilmez.
const VIDEO_MAKS_BAYT = 80 * 1024 * 1024;
const VIDEO_ASGARI_HIZ = 128 * 1024;
const VIDEO_TOPLAM_ASIM_MS = Math.ceil(VIDEO_MAKS_BAYT / VIDEO_ASGARI_HIZ) * 1000;
const YAVAS_SINIRI = 2;                          // bu kadar zaman asimindan sonra calisma durur (yavas baglantida saatlerce beklenmesin)
const ZAYIF_ESIK = 0.5;                          // aramanin en cok yarisi eslesen aday "alakasi zayif" (yedek aramalar once denenir)
const STOK_RE = /^00-stok-.*\.mp4$/i;

// Kelime kokleri: cogul eki (gorsel hattinin govdele'si) + -ing / -ed fiil eki. ONEK eslesmesi YOK: universe~university,
// art~artificial, time~timelapse, planet~plane, car~carthage eslesmez; wave~waves, crash~crashing, dance~dancing eslesir.
function kokler(w) {
  const g = govdele(w);
  const k = new Set([g]);
  const ek = taban => { k.add(taban); k.add(taban + "e"); if (/([b-df-hj-np-tv-z])\1$/.test(taban)) k.add(taban.slice(0, -1)); };
  if (g.length >= 6 && g.endsWith("ing")) ek(g.slice(0, -3));
  else if (g.length >= 5 && g.endsWith("ed")) ek(g.slice(0, -2));
  return k;
}

// Aday sahneyle alakali mi: aramadaki anlamli kelimelerin kacta kaci (kok esitligiyle) baslik/etikette geciyor (0..1)
function alakaPuani(aday, sorgu) {
  const q = [...new Set(tok(sorgu))];
  if (!q.length) return 0;
  const metin = new Set();
  for (const m of tok((aday.baslik || "") + " " + (aday.etiket || ""))) for (const k of kokler(m)) metin.add(k);
  let n = 0;
  for (const w of q) if ([...kokler(w)].some(k => metin.has(k))) n++;
  return n / q.length;
}

// -> [{a, ap, puan}] en iyiden; aramanin en az ~1/3'u eslesmeyen aday elenir
function adaylariSirala(adaylar, sorgu, yon) {
  const uygun = adaylar.map(a => ({ a, ap: alakaPuani(a, sorgu) })).filter(x => x.ap >= 0.34);
  uygun.forEach(x => {
    const oran = x.a.en && x.a.boy ? x.a.en / x.a.boy : 1;
    const yonUygun = yon === "dikey" ? oran < 0.8 : oran > 1.2;
    x.puan = x.ap * 10 + (yonUygun ? 3 : 0) + Math.min(2, (x.a.en || 0) / 1280) + (x.a.sure >= 5 ? 1 : 0) - (x.a.sira || 0) * 0.05;
  });
  uygun.sort((p, q) => q.puan - p.puan);
  return uygun;
}
const enIyiAday = (adaylar, sorgu, yon) => adaylariSirala(adaylar, sorgu, yon).map(x => x.a);

// Klibin dosya adi = kimligi: 00-stok-<kaynak>-<kaynak sayfasindaki no>.mp4 (no yoksa benzersiz damga)
const klipAdi = a => "00-stok-" + String(a.kaynak || "stok").replace(/[^a-z0-9]/gi, "") + "-" + (String(a.kaynakUrl || "").match(/(\d+)\/?$/) || [0, Date.now()])[1] + ".mp4";
const stokKlipleri = klasor => { try { return fs.readdirSync(klasor).filter(f => STOK_RE.test(f)); } catch (e) { return []; } };

// Once adayin kendi adresi; dosya sinirdan buyukse ayni klibin daha kucuk surumu (Pexels sd/hd, Pixabay medium) denenir.
// Zaman asimi yukari gider (baglanti yavas: ayni klibin baska surumunu da beklemek yerine cagiran karar verir).
async function klipIndir(getir, a) {
  const adresler = [a.url].concat((Array.isArray(a.yedekUrl) ? a.yedekUrl : []).slice(0, 1)).filter(Boolean);
  let son;
  for (const u of adresler) {
    try { return (await getir.gorsel(u, { maksBayt: VIDEO_MAKS_BAYT, zamanAsimiMs: 120000, toplamAsimiMs: VIDEO_TOPLAM_ASIM_MS, zamanAsimiTekrarYok: true })).govde; }
    catch (e) { son = e; if (!e || e.kod !== "cok_buyuk") throw e; }
  }
  throw son;
}

async function calistir(args, bag) {
  const b = bag || {};
  const bayrak = ad => { const i = args.indexOf("--" + ad); return i >= 0 ? args[i + 1] : undefined; };
  const is = args.find((a, i) => !a.startsWith("--") && !(args[i - 1] || "").startsWith("--"));
  if (!is) throw Object.assign(new Error("Kullanım: node video-bul.js <iş-adı> [--sahne N --ara \"ifade\"] [--azami N] [--yeniden]"), { cikis: 2 });
  const tekSahne = bayrak("sahne") !== undefined ? Number(bayrak("sahne")) : 0, elleAra = bayrak("ara");
  if (bayrak("sahne") !== undefined && !(Number.isInteger(tekSahne) && tekSahne > 0))
    throw Object.assign(new Error("--sahne bir sahne numarası olmalı (1, 2, 3...)."), { cikis: 2 });
  // --ara tek bir sahnenin ifadesidir: --sahne olmadan her sahneye ayni klip inerdi
  if (elleAra !== undefined && !tekSahne)
    throw Object.assign(new Error("--ara için --sahne <no> de verilmeli."), { cikis: 2, cozum: "Örnek: node video-bul.js " + is + ' --sahne 3 --ara "waves crashing on rocks"' });
  const pexels = b.pexelsKey !== undefined ? b.pexelsKey : ortak.envOku("PEXELS_KEY");
  const pixabay = b.pixabayKey !== undefined ? b.pixabayKey : ortak.envOku("PIXABAY_KEY");
  if (!pexels && !pixabay)
    throw Object.assign(new Error("Stok video için PEXELS_KEY ya da PIXABAY_KEY gerekli."), { kod: "anahtar_yok", cikis: 2,
      cozum: "Ücretsiz anahtar: pexels.com/api ya da pixabay.com/api/docs. .env'e yaz ya da panelde Kaynaklar sekmesine gir." });
  const dizin = ortak.isDizin(is), vis = path.join(dizin, "Visuals");
  const manifest = ortak.jsonOku(path.join(vis, "manifest.json"), null);
  if (!manifest || !Array.isArray(manifest.sahneler))
    throw Object.assign(new Error("Visuals/manifest.json yok: önce gorsel-bul.js çalıştır."), { cikis: 2 });
  if (tekSahne && !manifest.sahneler.some(s => s.no === tekSahne))
    throw Object.assign(new Error("Sahne " + tekSahne + " yok (manifestte " + manifest.sahneler.length + " sahne var)."), { cikis: 2 });
  const konu = ortak.jsonOku(path.join(dizin, "konu.json"), {}) || {};
  const yon = manifest.hedefYon || (konu.aspect === "9:16" ? "dikey" : "yatay");
  const getir = b.getir || ag.istemciYap({ limitBekleSn: 5 });
  const istemciler = b.istemciler || { pexels: pexelsVideoAra, pixabay: pixabayVideoAra };
  const anahtarlar = { pexels, pixabay };
  const azami = Number(bayrak("azami") || 8);
  const yeniden = args.includes("--yeniden");
  const atifDosyasi = path.join(vis, "video-atif.json");
  const okunan = ortak.jsonOku(atifDosyasi, []);
  const atiflar = Array.isArray(okunan) ? okunan.filter(x => x && typeof x.dosya === "string") : [];
  const log = b.log || (m => console.log(m));
  let eklenen = 0, yavas = 0;

  const dosyaVar = d => { const y = path.resolve(vis, String(d || "")); return ortak.yolIcinde(vis, y) && fs.existsSync(y); };
  // Kaydi diske yazar: ayni dosyanin SON kaydi kalir, dosyasi artik olmayan kayit (panelden silinen, --yeniden ile degisen klip)
  // duser. `korunan` henuz diske yazilmamis klibin kaydi: atif KLIPTEN ONCE yazilir, calisma klipten sonra kesilse de atif kaybolmaz.
  const atifKaydet = korunan => {
    const son = new Map();
    for (const x of atiflar) if (x === korunan || dosyaVar(x.dosya)) { son.delete(x.dosya); son.set(x.dosya, x); }
    atiflar.length = 0; atiflar.push(...son.values());
    ortak.atomikJsonYaz(atifDosyasi, atiflar);
  };

  // sahneler arasi tekrar onleme: diskteki klip adi -> sahne klasoru
  const kullanilan = new Map();
  for (const s of manifest.sahneler) if (s.klasor) for (const f of stokKlipleri(path.join(vis, s.klasor))) kullanilan.set(f.toLowerCase(), s.klasor);
  // panelden silinen klipler (silinenler.json'da ad ile kayitli) bir daha indirilmez
  const silinen = new Set();
  try {
    const sl = ortak.jsonOku(path.join(dizin, "silinenler.json"), null);
    for (const x of sl && Array.isArray(sl.silinenler) ? sl.silinenler : []) if (x && typeof x.ad === "string" && STOK_RE.test(x.ad)) silinen.add(x.ad.toLowerCase());
  } catch (e) { log("  ! silinenler.json okunamadı (" + e.message + "); silinen klipler dışlanamayabilir."); }

  for (const s of manifest.sahneler) {
    if (eklenen >= azami) break;
    if (tekSahne && s.no !== tekSahne) continue;
    const klasor = path.join(vis, s.klasor || "");
    if (!s.klasor || !fs.existsSync(klasor)) continue;
    const mevcut = stokKlipleri(klasor);
    if (mevcut.length && !yeniden) {
      log("  " + s.klasor + ": zaten stok video var, atlandı");
      const kayitsiz = mevcut.filter(f => !atiflar.some(x => x.dosya === s.klasor + "/" + f));
      if (kayitsiz.length)
        log("  ! " + s.klasor + "/" + kayitsiz[0] + ": atıf kaydı yok (Visuals/video-atif.json), açıklamaya kaynağı yazılamaz. Yeniden indirip kaydetmek için: node video-bul.js " + is + " --sahne " + s.no + " --yeniden");
      continue;
    }
    const sorgular = elleAra ? [elleAra] : (s.aramalar || [s.kullanilanArama]).filter(Boolean);
    let secilen = null, sorgu = "", zayif = null, denenen = 0, tekrarElenen = 0;
    for (const q of sorgular) {
      if (zayif && denenen >= 3) break;                         // zayif aday var: yedek aramalarin ilk birkaci yeter
      denenen++;
      const ham = [];
      for (const ad of Object.keys(istemciler)) {
        if (!anahtarlar[ad]) continue;
        try { ham.push(...await istemciler[ad](q, { yon, limit: 15 }, { getir, anahtar: anahtarlar[ad] })); }
        catch (e) { log("  ! " + ad + " video araması: " + ag.hataOzeti(e)); }
      }
      const sirali = adaylariSirala(ham, q, yon).filter(x => {
        x.ad = klipAdi(x.a);
        const yer = kullanilan.get(x.ad.toLowerCase());
        if ((yer && yer !== s.klasor) || silinen.has(x.ad.toLowerCase())) { tekrarElenen++; return false; }
        return true;
      });
      if (!sirali.length) continue;
      const guclu = sirali.filter(x => x.ap > ZAYIF_ESIK);
      if (guclu.length) { secilen = guclu; sorgu = q; zayif = null; break; }
      if (!zayif) zayif = { sirali, q };
    }
    if (!secilen && zayif) { secilen = zayif.sirali; sorgu = zayif.q; }
    if (!secilen) {
      log("  " + s.klasor + ": alakalı stok video bulunamadı" + (tekrarElenen ? " (" + tekrarElenen + " aday başka sahnede kullanıldığı ya da silindiği için alınmadı)" : ""));
      continue;
    }
    const alakaZayif = !!zayif && secilen === zayif.sirali;
    let yazildi = false;
    for (const x of secilen.slice(0, 3)) {
      const a = x.a, ad = x.ad;
      try {
        const buf = await klipIndir(getir, a);
        if (buf.length < 20000 || buf.toString("latin1", 4, 8) !== "ftyp") throw new Error("geçerli mp4 değil");
        const kayit = { dosya: s.klasor + "/" + ad, baslik: a.baslik, atif: a.atif, lisans: a.lisans, lisansKodu: a.lisansKodu, atifGerekli: a.atifGerekli,
          atifOnerilen: a.atifOnerilen, kaynak: a.kaynak, kaynakUrl: a.kaynakUrl, indirmeUrl: a.indirmeUrl, arama: sorgu };
        if (alakaZayif) kayit.alakaZayif = true;
        atiflar.push(kayit);
        atifKaydet(kayit);
        if (yeniden) for (const f of mevcut) {
          try { fs.unlinkSync(path.join(klasor, f)); } catch (e) { /* yok */ }
          if (kullanilan.get(f.toLowerCase()) === s.klasor) kullanilan.delete(f.toLowerCase());
        }
        ortak.atomikYaz(path.join(klasor, ad), buf);
        if (yeniden && mevcut.length) atifKaydet();               // silinen eski klibin kaydi duser
        kullanilan.set(ad.toLowerCase(), s.klasor);
        log("  " + s.klasor + ' "' + sorgu + '" → ' + a.kaynak + " " + a.sure + " sn, " + a.en + "x" + a.boy + " (" + Math.round(buf.length / 1048576 * 10) / 10 + " MB)" +
          (alakaZayif ? " [alakası zayıf: başlığı aramayla yalnız kısmen eşleşti; kontrol et]" : ""));
        eklenen++; yazildi = true; break;
      } catch (e) {
        log("  ! " + a.kaynak + " klibi indirilemedi: " + (e && e.kod ? ag.hataOzeti(e) : (e && e.message) || e));
        if (e && e.kod === "zaman_asimi") { yavas++; break; }       // baglanti yavas: ayni sahnenin diger adaylarini da bekleme
      }
    }
    if (!yazildi) log("  " + s.klasor + ": klip indirilemedi");
    if (yavas >= YAVAS_SINIRI) {
      log("  ! Bağlantı çok yavaş (" + yavas + " indirme " + Math.round(VIDEO_TOPLAM_ASIM_MS / 60000) + " dakikada bitmedi); kalan sahneler atlandı. Daha hızlı bir bağlantıda aynı komutu yeniden çalıştır: eklenen klipler korunur.");
      break;
    }
  }
  // ATIF.txt (YouTube aciklamasina yapistirilan) video atiflarini da icersin
  try { man.atifYaz(is, manifest); } catch (e) { log("  ! ATIF.txt yenilenemedi: " + e.message); }
  log("\n✓ " + eklenen + " stok video klibi eklendi. Sonraki adım: node video-yap.js " + is + (eklenen ? " --yeniden" : ""));
  return { eklenen };
}

if (require.main === module) {
  calistir(process.argv.slice(2)).catch(e => { console.error("✗ " + e.message + (e.cozum ? "\n  ↳ " + e.cozum : "")); process.exit(e.cikis || 1); });
}
module.exports = { calistir, alakaPuani, enIyiAday, adaylariSirala, kokler, klipAdi, VIDEO_MAKS_BAYT, VIDEO_TOPLAM_ASIM_MS };
