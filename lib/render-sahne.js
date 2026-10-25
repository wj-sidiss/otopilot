// lib/render-sahne.js — gorselleri sahnelere, sahneleri anlatim zamanina baglar.
//
// ESKI HAL: tum gorsellere ayni sure veriliyordu; anlatici Einstein'i anlatirken baska konunun
// fotografi akiyordu. YENI: Visuals/manifest.json her sahnenin hangi paragraflara ait oldugunu soyler;
// sahnenin suresi o paragraflarin GERCEK ses araligidir, sahnenin gorselleri bu sure icinde esit bolunur.
// Manifest yoksa ya da paragraflari 0..N-1'i ortmuyorsa uyari verilip eski yola (klasor sirasi,
// esit sure) donulur.
"use strict";
const fs = require("fs");
const path = require("path");
const ortak = require("./ortak");
const F = require("./render-ffmpeg");

// 2 haneli eski ("11-x") ve 3 haneli ("011-x") klasorler sayisal oneke gore dogru siralanir
const onek = ad => { const m = /^(\d+)/.exec(String(ad)); return m ? parseInt(m[1], 10) : Infinity; };
const dogalSirala = (a, b) => (onek(a) - onek(b)) || (a < b ? -1 : a > b ? 1 : 0);

const GORSEL_UZANTI = /\.(jpe?g|png|webp|mp4)$/i;      // mp4: stok video klibi (gorsel-bul.js --video); klip uretiminde dongulenir      // webp: tarayicidan kaydedilen gorsel; panel de listeler, ffmpeg cozer

function manifestOku(visDir, uyarilar) {
  const yol = path.join(visDir, "manifest.json");
  if (!fs.existsSync(yol)) return null;
  try {
    const m = ortak.jsonOku(yol, null);
    if (!ortak.duzNesne(m) || !Array.isArray(m.sahneler)) { uyarilar.push("Visuals/manifest.json geçersiz; klasör sırası kullanılacak."); return null; }
    if (typeof m.surum === "number" && m.surum > 1) uyarilar.push("manifest.json daha yeni bir sürümden (surum " + m.surum + ").");
    return m;
  } catch (e) { uyarilar.push("Visuals/manifest.json okunamadı (" + e.message + "); klasör sırası kullanılacak."); return null; }
}

// Manifestin sahneleri paragraf 0..N-1'i kesintisiz, sirayla ortuyor mu?
function manifestKapsarMi(sahneler, N) {
  let beklenen = 0;
  for (const s of sahneler) {
    if (!Array.isArray(s.paragraflar) || !s.paragraflar.length) return false;
    for (const p of s.paragraflar) { if (p !== beklenen) return false; beklenen++; }
  }
  return beklenen === N;
}

// Eski yol: Visuals altindaki tum klasorler/gorseller, sayisal sirayla
function klasordenTopla(visDir) {
  const out = [];
  let klasorler = [];
  try { klasorler = fs.readdirSync(visDir).filter(x => { try { return fs.statSync(path.join(visDir, x)).isDirectory(); } catch (e) { return false; } }); } catch (e) { /* yok */ }
  klasorler.filter(k => !k.startsWith("_")).sort(dogalSirala).forEach(k => {
    for (const f of fs.readdirSync(path.join(visDir, k)).filter(x => GORSEL_UZANTI.test(x)).sort(dogalSirala))
      out.push({ ad: k + "/" + f, yol: path.join(visDir, k, f) });
  });
  return out;
}

// Manifest yalnizca gorsel-bul.js'in buldugunu kaydeder. Videoya girmesi gereken ama kayitta olmayan gorseller:
//   1) sahne klasorune elle atilanlar ve formul/prompt kartlari (hedef = sahne klasoru): o sahnenin sonuna eklenir
//   2) manifest disi klasorler (kartlarin varsayilan yeri 14-formuller / 90-promptlar): onekteki sayi, sahne numarasi gibi
//      okunur; o sayiyi asmayan en son sahneye (yoksa ilkine, onek yoksa sonuncuya) eklenir -- eski "klasor sirasi"
//      akisindaki yerlerine en yakin konum. Hicbiri sessizce atlanmaz; her ek uyariyla bildirilir.
function manifestDisiEkle(visDir, ham, uyarilar) {
  const resimler = dizin => { try { return fs.readdirSync(dizin).filter(x => GORSEL_UZANTI.test(x) && !x.startsWith(".")).sort(dogalSirala); } catch (e) { return []; } };
  const kayitli = new Set(ham.flatMap(s => s.gorseller.map(g => path.resolve(g.yol))));
  // Eklenenler sahnenin BASINA konur: kisa bir sahnede klip planlayici gorsellerin hepsine yer bulamazsa elle/kart
  // gorseli degil, otomatik bulunan stok gorsel elenir (kullanici bunu bilerek koydu).
  const ekle = (s, klasor, dosyalar) => {
    const yeni = [];
    for (const f of dosyalar) {
      const yol = path.resolve(visDir, klasor, f);
      if (kayitli.has(yol) || !ortak.yolIcinde(visDir, yol)) continue;
      kayitli.add(yol);
      yeni.push({ ad: klasor + "/" + f, yol, gecerliYol: true });
    }
    s.gorseller = yeni.concat(s.gorseller);
    return yeni.length;
  };
  const sahneKlasorleri = new Set();
  for (const s of ham) {
    if (!s.klasor || s.klasor.startsWith("_") || !ortak.yolIcinde(visDir, path.join(visDir, s.klasor))) continue;
    sahneKlasorleri.add(s.klasor);
    const n = ekle(s, s.klasor, resimler(path.join(visDir, s.klasor)));
    if (n) uyarilar.push("Sahne " + s.no + " (" + s.klasor + "): manifestte kayıtlı olmayan " + n + " görsel (elle eklenen ya da kart) videoya eklendi.");
  }
  if (!ham.length) return;
  let klasorler = [];
  try { klasorler = fs.readdirSync(visDir, { withFileTypes: true }).filter(d => d.isDirectory() && !d.name.startsWith("_") && !sahneKlasorleri.has(d.name)).map(d => d.name).sort(dogalSirala); } catch (e) { /* yok */ }
  for (const k of klasorler) {
    const dosyalar = resimler(path.join(visDir, k));
    if (!dosyalar.length) continue;
    const o = onek(k);
    let hedef = ham[ham.length - 1];
    if (Number.isFinite(o)) hedef = ham.filter(s => (Number(s.no) || 0) <= o).pop() || ham[0];
    const n = ekle(hedef, k, dosyalar);
    if (n) uyarilar.push("Visuals/" + k + " manifestte sahne değil: " + n + " görsel Sahne " + hedef.no + "'e eklendi. Kart ise konu.json'da 'hedef' olarak bir sahne klasörü ver.");
  }
}

// Gorselleri dogrular (paralel). Donus: Map(yol -> {ok,...})
async function dogrula(liste) {
  const sonuc = new Map();
  const tekil = Array.from(new Set(liste));
  const r = await F.paralel(tekil, 6, y => F.gorselDogrulaAsync(y));
  tekil.forEach((y, i) => sonuc.set(y, r[i].ok ? r[i].deger : { ok: false, neden: "doğrulama hatası" }));
  return sonuc;
}

// ctx: ayarCoz sonucu, ses: sesHazirla sonucu
// Donus: { mod, sahneler:[{no, klasor, bas, son, paragraflar, gorseller:[{ad,yol,en,boy,bayt}], odunc}], gecersiz:[{ad,neden}], uyarilar }
async function sahneleriTopla(ctx, ses) {
  const visDir = path.join(ctx.dizin, "Visuals");
  const uyarilar = [];
  const N = ses.N;
  const manifest = manifestOku(visDir, uyarilar);
  let mod = "eski";
  let ham = [];   // [{no, klasor, paragraflar, gorseller:[{ad,yol}]}]

  if (manifest) {
    const sirali = manifest.sahneler.slice().sort((a, b) => (Number(a.no) || 0) - (Number(b.no) || 0));
    if (manifestKapsarMi(sirali, N)) {
      mod = "manifest";
      if (manifest.kaynakSenaryoSha1 && manifest.kaynakSenaryoSha1 !== ses.ozet)
        uyarilar.push("Görseller eski senaryoya göre bulunmuş (senaryo değişmiş): 'Görselleri yeniden bul' önerilir.");
      ham = sirali.map(s => ({
        no: s.no, klasor: s.klasor || "", paragraflar: s.paragraflar,
        gorseller: (Array.isArray(s.gorseller) ? s.gorseller : []).map(g => {
          const yol = path.resolve(visDir, String(g && g.dosya || ""));
          return { ad: String(g && g.dosya || ""), yol, gecerliYol: !!(g && g.dosya) && ortak.yolIcinde(visDir, yol) };
        }).filter(g => g.gecerliYol && fs.existsSync(g.yol)),
      }));
      manifestDisiEkle(visDir, ham, uyarilar);
    } else {
      uyarilar.push("manifest.json paragraf bölümlemesi senaryoyla uyuşmuyor (0.." + (N - 1) + " kesintisiz örtülmüyor); görseller klasör sırasıyla ve eşit sürelerle kullanılacak.");
    }
  } else if (!fs.existsSync(path.join(visDir, "manifest.json"))) {
    uyarilar.push("Visuals/manifest.json yok (eski iş): görseller klasör sırasıyla ve eşit sürelerle kullanılacak.");
  }

  const tumGorseller = mod === "manifest" ? ham.flatMap(s => s.gorseller) : klasordenTopla(visDir);
  const dogru = await dogrula(tumGorseller.map(g => g.yol));
  const gecersiz = [];
  const temizle = liste => liste.filter(g => {
    const d = dogru.get(g.yol);
    if (d && d.ok) { g.en = d.en; g.boy = d.boy; g.bayt = d.bayt; return true; }
    gecersiz.push({ ad: g.ad, neden: (d && d.neden) || "bozuk" });
    return false;
  });

  let sahneler;
  if (mod === "manifest") {
    sahneler = ham.map(s => ({ ...s, gorseller: temizle(s.gorseller) }));
  } else {
    const hepsi = temizle(tumGorseller);
    sahneler = [{ no: 1, klasor: "", paragraflar: Array.from({ length: N }, (_, i) => i), gorseller: hepsi }];
  }

  // Sahne zaman araliklari: sahne sonu = son paragrafin bitisi; bosluk SONRAKI sahneye yazilir
  let onceki = 0;
  sahneler.forEach((s, i) => {
    const son = i === sahneler.length - 1 ? ses.toplam
      : ses.baslangic[s.paragraflar[s.paragraflar.length - 1]] + ses.sure[s.paragraflar[s.paragraflar.length - 1]];
    s.bas = onceki; s.son = Math.max(son, onceki + 1 / ctx.FPS); onceki = s.son;
  });

  // Hic gorseli kalmayan sahne: en yakin komsunun gorselini odunc alir
  if (mod === "manifest") {
    const doluVar = sahneler.some(s => s.gorseller.length);
    if (doluVar) {
      const orijinal = sahneler.map(s => s.gorseller.slice());
      sahneler.forEach((s, i) => {
        if (s.gorseller.length) return;
        for (let d = 1; d < sahneler.length; d++) {
          const onc = orijinal[i - d], son = orijinal[i + d];
          if (onc && onc.length) { s.gorseller = [onc[onc.length - 1]]; s.odunc = "önceki"; break; }
          if (son && son.length) { s.gorseller = [son[0]]; s.odunc = "sonraki"; break; }
        }
        uyarilar.push("Sahne " + s.no + (s.klasor ? " (" + s.klasor + ")" : "") + " için görsel yok; " + s.odunc + " sahnenin görseli kullanıldı.");
      });
    }
  }

  const gorselSayisi = sahneler.reduce((a, s) => a + s.gorseller.length, 0);
  if (!gorselSayisi) {
    const ilk = gecersiz[0];
    if (ilk) throw new ortak.OrtakHata("gorsel_bozuk", "Görsel " + path.basename(ilk.ad) + " bozuk, panelden sil", {
      cikis: ortak.CIKIS.YETERSIZ, cozum: "Panelde Görseller listesinden bozuk görselleri sil ve Görsel adımını yeniden çalıştır.", detay: gecersiz });
    throw new ortak.OrtakHata("gorsel_yok", "Görsel bulunamadı: Visuals klasöründe kullanılabilir görsel yok.", {
      cikis: ortak.CIKIS.YETERSIZ, cozum: "Önce görselleri bul (Görsel adımı) ya da Visuals/<sahne>/ içine görsel koy." });
  }
  return { mod, sahneler, gecersiz, uyarilar, gorselSayisi };
}

// ---------------------------------------------------------------- klip plani (kare-kesin)
// Donus: [{ i, ad, yol, sahne, basKare, sonKare, kare, zin }]
//   basKare/sonKare: anlatim zaman cizelgesinde (kare). kare = klibin KENDI uzunlugu (gecis binmesi dahil).
// kuyrukKare: son klibin sonuna eklenecek (outro varsa gecis binmesi, yoksa kisa sessiz kuyruk)
function klipPlani(ctx, sahneler, kuyrukKare) {
  const FPS = ctx.FPS, cf = ctx.cfKare;
  const minKare = Math.max(Math.round(1.5 * FPS), 2 * cf);
  const maxKare = Math.round(ctx.MAX_L * FPS);
  const klipler = [];
  let sonKare = 0;
  sahneler.forEach((s, si) => {
    const a = sonKare;
    const b = Math.max(a + 1, Math.round(s.son * FPS));
    const uzun = b - a;
    const k = s.gorseller.length;
    const nKullan = Math.max(1, Math.min(k, Math.floor(uzun / minKare)));
    let nSeg = Math.max(nKullan, Math.ceil(uzun / maxKare));
    nSeg = Math.min(nSeg, nKullan * 4);
    if (uzun < nSeg) nSeg = Math.max(1, uzun);
    for (let j = 0; j < nSeg; j++) {
      const ba = a + Math.round(uzun * j / nSeg), bs = a + Math.round(uzun * (j + 1) / nSeg);
      const g = s.gorseller[j % nKullan];
      klipler.push({ i: klipler.length, ad: g.ad, yol: g.yol, bayt: g.bayt, sahne: s.no, basKare: ba, sonKare: Math.max(bs, ba + 1) });
    }
    sonKare = b;
  });
  klipler.forEach((k, i) => {
    k.zin = i % 2 === 0;
    k.kare = (k.sonKare - k.basKare) + (i === klipler.length - 1 ? kuyrukKare : cf);
  });
  return klipler;
}

// Eski yol: esit sure, gerekirse listeyi tekrarla (izleyici sabit kareden sikilmasin)
function esitKlipPlani(ctx, ses, gorseller, kuyrukKare) {
  const FPS = ctx.FPS, cf = ctx.cfKare;
  let liste = gorseller.slice();
  const ozgun = liste.length;
  const A = ses.toplam;
  const L = n => (A + (n - 1) * ctx.CF) / n;     // eski formul: gecis binmesi sure sayilir
  while (L(liste.length) > ctx.MAX_L && liste.length < ozgun * 4) liste = liste.concat(gorseller.slice(0, ozgun));
  const n = liste.length;
  const toplamKare = Math.round(A * FPS);
  const klipler = liste.map((g, i) => {
    const ba = Math.round(toplamKare * i / n), bs = Math.round(toplamKare * (i + 1) / n);
    return { i, ad: g.ad, yol: g.yol, bayt: g.bayt, sahne: 1, basKare: ba, sonKare: Math.max(bs, ba + 1), zin: i % 2 === 0 };
  });
  klipler.forEach((k, i) => { k.kare = (k.sonKare - k.basKare) + (i === n - 1 ? kuyrukKare : cf); });
  return { klipler, ozgun };
}

module.exports = { sahneleriTopla, klipPlani, esitKlipPlani, manifestKapsarMi, manifestDisiEkle, klasordenTopla, dogalSirala, onek, GORSEL_UZANTI };
