// Sahnelere STOK VIDEO klibi ekler (Pexels + Pixabay, ucretsiz anahtar ister: PEXELS_KEY / PIXABAY_KEY). gorsel-bul.js'ten SONRA, video-yap.js'ten ONCE.
//   node video-bul.js <is>                  # her sahne icin (en cok 8) alakali bir klip
//   node video-bul.js <is> --sahne 3 --ara "waves crashing on rocks"
//   node video-bul.js <is> --azami 4 --yeniden
// Klip Visuals/<sahne>/00-stok-<kaynak>-<id>.mp4 olarak yazilir; video-yap.js onu sahnenin BASINA koyar (dongulenir, kadraja kirpilir, sessiz).
// Atiflar Visuals/video-atif.json'a yazilir ve YAYIN-PAKETI'ne girer. Anahtar yoksa hicbir sey yapmaz, nedenini soyler.
"use strict";
const fs = require("fs");
const path = require("path");
const ortak = require("./lib/ortak.js");
const ag = require("./lib/gorsel-ag.js");
const { pexelsVideoAra, pixabayVideoAra } = require("./lib/gorsel-kaynak.js");

const DURAK = new Set(["the", "and", "with", "from", "that", "this", "for", "of", "in", "on", "at", "a", "an", "to", "by", "closeup", "shot", "view", "video", "footage"]);
const tok = s => String(s || "").toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 2 && !DURAK.has(w));

// Aday sahneyle alakali mi: aramadaki anlamli kelimelerin en az biri (kok eslesmesi) baslik/etikette gecmeli
function alakaPuani(aday, sorgu) {
  const q = tok(sorgu), metin = tok((aday.baslik || "") + " " + (aday.etiket || ""));
  if (!q.length) return 0;
  let n = 0;
  for (const w of q) if (metin.some(m => m.startsWith(w.slice(0, 5)) || w.startsWith(m.slice(0, 5)))) n++;
  return n / q.length;
}

function enIyiAday(adaylar, sorgu, yon) {
  const uygun = adaylar.map(a => ({ a, ap: alakaPuani(a, sorgu) })).filter(x => x.ap >= 0.34);
  uygun.forEach(x => {
    const oran = x.a.en && x.a.boy ? x.a.en / x.a.boy : 1;
    const yonUygun = yon === "dikey" ? oran < 0.8 : oran > 1.2;
    x.puan = x.ap * 10 + (yonUygun ? 3 : 0) + Math.min(2, (x.a.en || 0) / 1280) + (x.a.sure >= 5 ? 1 : 0) - x.a.sira * 0.05;
  });
  uygun.sort((p, q) => q.puan - p.puan);
  return uygun.map(x => x.a);
}

async function calistir(args, bag) {
  const b = bag || {};
  const bayrak = ad => { const i = args.indexOf("--" + ad); return i >= 0 ? args[i + 1] : undefined; };
  const is = args.find((a, i) => !a.startsWith("--") && !(args[i - 1] || "").startsWith("--"));
  if (!is) throw Object.assign(new Error("Kullanım: node video-bul.js <iş-adı> [--sahne N --ara \"ifade\"] [--azami N] [--yeniden]"), { cikis: 2 });
  const pexels = b.pexelsKey !== undefined ? b.pexelsKey : ortak.envOku("PEXELS_KEY");
  const pixabay = b.pixabayKey !== undefined ? b.pixabayKey : ortak.envOku("PIXABAY_KEY");
  if (!pexels && !pixabay)
    throw Object.assign(new Error("Stok video için PEXELS_KEY ya da PIXABAY_KEY gerekli."), { kod: "anahtar_yok", cikis: 2,
      cozum: "Ücretsiz anahtar: pexels.com/api ya da pixabay.com/api/docs. .env'e yaz ya da panelde Kaynaklar sekmesine gir." });
  const dizin = ortak.isDizin(is), vis = path.join(dizin, "Visuals");
  const manifest = ortak.jsonOku(path.join(vis, "manifest.json"), null);
  if (!manifest || !Array.isArray(manifest.sahneler))
    throw Object.assign(new Error("Visuals/manifest.json yok: önce gorsel-bul.js çalıştır."), { cikis: 2 });
  const konu = ortak.jsonOku(path.join(dizin, "konu.json"), {}) || {};
  const yon = manifest.hedefYon || (konu.aspect === "9:16" ? "dikey" : "yatay");
  const getir = b.getir || ag.istemciYap({ limitBekleSn: 5 });
  const istemciler = b.istemciler || { pexels: pexelsVideoAra, pixabay: pixabayVideoAra };
  const anahtarlar = { pexels, pixabay };
  const tekSahne = bayrak("sahne") ? Number(bayrak("sahne")) : 0, elleAra = bayrak("ara");
  const azami = Number(bayrak("azami") || 8);
  const yeniden = args.includes("--yeniden");
  const atifDosyasi = path.join(vis, "video-atif.json");
  const atiflar = ortak.jsonOku(atifDosyasi, []) || [];
  const log = b.log || (m => console.log(m));
  let eklenen = 0;

  for (const s of manifest.sahneler) {
    if (eklenen >= azami) break;
    if (tekSahne && s.no !== tekSahne) continue;
    const klasor = path.join(vis, s.klasor || "");
    if (!s.klasor || !fs.existsSync(klasor)) continue;
    const mevcut = fs.readdirSync(klasor).filter(f => /^00-stok-.*\.mp4$/i.test(f));
    if (mevcut.length && !yeniden) { log("  " + s.klasor + ": zaten stok video var, atlandı"); continue; }
    const sorgular = elleAra ? [elleAra] : (s.aramalar || [s.kullanilanArama]).filter(Boolean);
    let secilen = null, sorgu = "";
    for (const q of sorgular) {
      const ham = [];
      for (const ad of Object.keys(istemciler)) {
        if (!anahtarlar[ad]) continue;
        try { ham.push(...await istemciler[ad](q, { yon, limit: 15 }, { getir, anahtar: anahtarlar[ad] })); }
        catch (e) { log("  ! " + ad + " video araması: " + ag.hataOzeti(e)); }
      }
      const sirali = enIyiAday(ham, q, yon);
      if (sirali.length) { secilen = sirali; sorgu = q; break; }
    }
    if (!secilen) { log("  " + s.klasor + ": alakalı stok video bulunamadı"); continue; }
    let yazildi = false;
    for (const a of secilen.slice(0, 3)) {
      try {
        const r = await getir.gorsel(a.url, { maksBayt: 80 * 1024 * 1024, zamanAsimiMs: 120000 });
        const buf = r.govde;
        if (buf.length < 20000 || buf.toString("latin1", 4, 8) !== "ftyp") throw new Error("geçerli mp4 değil");
        const ad = "00-stok-" + a.kaynak + "-" + (String(a.kaynakUrl).match(/(\d+)\/?$/) || [0, Date.now()])[1] + ".mp4";
        if (yeniden) for (const f of mevcut) { try { fs.unlinkSync(path.join(klasor, f)); } catch (e) { /* yok */ } }
        ortak.atomikYaz(path.join(klasor, ad), buf);
        atiflar.push({ dosya: s.klasor + "/" + ad, baslik: a.baslik, atif: a.atif, lisans: a.lisans, lisansKodu: a.lisansKodu, atifGerekli: a.atifGerekli,
          atifOnerilen: a.atifOnerilen, kaynak: a.kaynak, kaynakUrl: a.kaynakUrl, indirmeUrl: a.indirmeUrl });
        log("  " + s.klasor + ' "' + sorgu + '" → ' + a.kaynak + " " + a.sure + " sn, " + a.en + "x" + a.boy + " (" + Math.round(buf.length / 1048576 * 10) / 10 + " MB)");
        eklenen++; yazildi = true; break;
      } catch (e) { log("  ! " + a.kaynak + " klibi indirilemedi: " + (e.message || e)); }
    }
    if (!yazildi) log("  " + s.klasor + ": klip indirilemedi");
  }
  if (atiflar.length) ortak.atomikJsonYaz(atifDosyasi, atiflar.filter((x, i, l) => l.findIndex(y => y.dosya === x.dosya) === i));
  log("\n✓ " + eklenen + " stok video klibi eklendi. Sonraki adım: node video-yap.js " + is + (eklenen ? " --yeniden" : ""));
  return { eklenen };
}

if (require.main === module) {
  calistir(process.argv.slice(2)).catch(e => { console.error("✗ " + e.message + (e.cozum ? "\n  ↳ " + e.cozum : "")); process.exit(e.cikis || 1); });
}
module.exports = { calistir, alakaPuani, enIyiAday };
