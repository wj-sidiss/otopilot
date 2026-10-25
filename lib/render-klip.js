// lib/render-klip.js — gorsel -> klip, klipler -> gruplar (gecisli), gruplar -> ust gruplar.
//
// ARA DOSYA YONETIMI:
//  * Her ara dosya IMZALI adla saklanir: clip012-<sha8>.mp4. sha8; gorselin yolu+boyutu+degisme zamani,
//    klip suresi, efekt, renk, cozunurluk, kare hizi, kodlayici adi ve yonu (zoom yonu) kapsar. Gorsel
//    silinirse/degisirse, efekt-renk-gecis degisirse ad degisir; eski dosya YENIDEN KULLANILMAZ.
//  * Dosya once <ad>.part.mp4'e yazilir, ffmpeg 0 ile biterse yeniden adlandirilir: Durdur/elektrik
//    kesintisi/disk dolu yarim dosyayi "hazir" gostermez.
//  * Kullanmadan once ffprobe ile dogrulanir (beklenen sureyle uyusmuyorsa silinip yeniden uretilir).
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const ortak = require("./ortak");
const F = require("./render-ffmpeg");
const { RENDER_SURUM } = require("./render-ayar");

const imza8 = parcalar => ortak.sha1(parcalar.join("|")).slice(0, 8);
// ffprobe bellek yetmedigi icin olcemediyse klip "gecersiz" SAYILMAZ: 'bellek_yetersiz' yukari gider (saglam ara dosya silinmez,
// saglam gorsel "bozuk" denip komsu gorselle degistirilmez)
const BELLEK_FIRLAT = Object.freeze({ bellekFirlat: true });
// Tek tek denemede de bellek yetmediyse hata yukari gider (komsu gorsel KONMAZ). Cozum hangi gorselde oldugunu da soyler: hep ayni
// klipte oluyorsa sebep cok buyuk bir gorsel olabilir (yalniz "programlari kapat" denirse kullanici hic cikamaz)
function bellekKlipHatasi(e, k) {
  if (e && e.kod === "bellek_yetersiz" && typeof e.cozum === "string" && !e.cozum.includes(k.ad))
    e.cozum += " Hep bu klipte oluyorsa (görsel " + k.ad + ") görsel çok büyük olabilir: panelde daha küçük bir görselle değiştir.";
  return e;
}

// ---------------------------------------------------------------- adlandirma
function klipImzasi(ayar, k, kodekAd) {
  let st = { size: k.bayt || 0, mtimeMs: 0 };
  try { st = fs.statSync(k.yol); } catch (e) { /* gorsel yok: imza yine uretilir, klip asamasinda hata verir */ }
  return imza8([RENDER_SURUM, "klip", k.ad, st.size, Math.round(st.mtimeMs), k.kare, ayar.efekt, ayar.renk,
    ayar.W, ayar.H, ayar.FPS, kodekAd, k.zin ? 1 : 0]);
}
function klipAdi(i, imza) { return "clip" + String(i).padStart(3, "0") + "-" + imza + ".mp4"; }

// Grup/ust grup adi: uyelerin adlari + gecis tipi/suresi + cozunurluk + kodlayici
function grupAdi(onek, no, uyeler, ayar, kodekAd) {
  const im = imza8([RENDER_SURUM, onek, ayar.gecis, ayar.cfKare, ayar.FPS, ayar.W, ayar.H, kodekAd, ...uyeler.map(u => u.ad)]);
  return onek + String(no).padStart(2, "0") + "-" + im + ".mp4";
}

// ---------------------------------------------------------------- klip
// Stok video klibi (mp4): kaynak dongulenir, kare hizina/cozunurluge getirilir, kadraja kirpilir (zoom efekti YOK: hareket zaten var)
function videoKlipArgv(ayar, k, K, ipler) {
  return ["-stream_loop", "-1", "-i", k.yol, "-vf",
    `fps=${ayar.FPS},scale=${ayar.W}:${ayar.H}:force_original_aspect_ratio=increase:out_color_matrix=bt709:out_range=tv,crop=${ayar.W}:${ayar.H},` +
    `format=yuv420p,${ayar.renkFiltresi},setsar=1,${F.RENK_YUV_SON}`,
    "-frames:v", String(k.kare), "-threads", String(Math.max(2, Math.floor(os.cpus().length / ipler))), ...K.ara, "-an"];
}

function klipArgv(ayar, k, K, ipler) {
  if (/\.mp4$/i.test(k.yol)) return videoKlipArgv(ayar, k, K, ipler);
  const Lf = k.kare, zin = k.zin;
  let z, xIf;
  switch (ayar.efekt) {
    case "yok":    z = "1"; break;
    case "yavas":  z = zin ? `min(1+0.00022*on,1.08)` : `if(lte(on,1),1.08,max(1.08-0.00022*on,1.0))`; break;
    case "hizli":  z = zin ? `min(1+0.0009*on,1.30)` : `if(lte(on,1),1.30,max(1.30-0.0009*on,1.0))`; break;
    case "kaydir": z = "1.14"; xIf = zin ? `(iw-iw/zoom)*on/${Lf}` : `(iw-iw/zoom)*(1-on/${Lf})`; break;
    default:       z = zin ? `min(1+0.00045*on,1.16)` : `if(lte(on,1),1.16,max(1.16-0.00045*on,1.0))`;
  }
  const x = xIf || `iw/2-(iw/zoom/2)`;
  // TEK kare besle (-loop YOK): zoompan d=Lf ile tam Lf kare uretir
  return ["-i", k.yol, "-vf",
    // kaynak (JPEG yuvj420p/tam aralik, PNG rgb, WebP...) once RGB'ye, oradan BT.709 SINIRLI aralik YUV'a: tek kare oldugu icin ucuz
    `format=rgb24,scale=${ayar.SW}:${ayar.SH}:force_original_aspect_ratio=increase:out_color_matrix=bt709:out_range=tv,format=yuv420p,` +
    `crop=${ayar.SW}:${ayar.SH},${ayar.renkFiltresi},` +
    `zoompan=z='${z}':d=${Lf}:x='${x}':y='ih/2-(ih/zoom/2)':s=${ayar.W}x${ayar.H}:fps=${ayar.FPS},setsar=1,${F.RENK_YUV_SON}`,
    "-frames:v", String(Lf),
    // Paralel calisirken her ffmpeg kendi basina cekirdek sayisi kadar is parcacigi acar; 4 ornek birden
    // sistemi tuketip "Error while opening encoder" veriyordu. Basina dusen payi veriyoruz.
    "-threads", String(Math.max(2, Math.floor(os.cpus().length / ipler))),
    ...K.ara, "-an"];
}

// ---------------------------------------------------------------- yedeklenen (bozuk gorselin yerine komsu gorsel) kayitlari
// Kodlanamayan gorselin klibi komsu gorselden uretilir ama BOZUK gorselin imzasiyla onbellege girer. Kayit tutulmazsa sonraki
// calismada klip "gecerli" sayilir, uyari bir daha cikmaz ve video sessizce komsu gorselle biter. Bu yuzden her yedekleme
// _tmp/klip-yedekleri.json'a yazilir; onbellekten gelen klip icin uyari HER calismada tekrarlanir, yedek gorsel degisirse/silinirse
// klip gecersiz sayilip yeniden denenir.
const YEDEK_KAYDI = "klip-yedekleri.json";
function yedekKaydiOku(tmp) {
  try {
    const j = JSON.parse(fs.readFileSync(path.join(tmp, YEDEK_KAYDI), "utf8"));
    if (j && j.surum === 1 && j.yedekler && typeof j.yedekler === "object" && !Array.isArray(j.yedekler)) return j.yedekler;
  } catch (e) { /* yok / bozuk: bos say (klip yeniden denenir) */ }
  return {};
}
const gorselKimligi = yol => { try { const s = fs.statSync(yol); return s.size + ":" + Math.round(s.mtimeMs); } catch (e) { return "yok"; } };

// klipler: klipPlani ciktisi (her birinde dosya, kare...). Hepsini uretir/dogrular.
// Donus: { uretilen, onbellekten, yedeklenen:[{ad, yerine}] }
async function klipleriUret(ayar, klipler, tmp, ilerlet, uyar) {
  const { n: ipler } = F.paralellik();
  const bekleyen = [];
  let hazir = 0;
  const yedeklenen = [];
  const eskiKayit = yedekKaydiOku(tmp), kayit = {};
  for (const k of klipler) {
    const ad = path.basename(k.dosya);
    if (F.gecerliMi(k.dosya, k.kare / ayar.FPS, 0.12, BELLEK_FIRLAT)) {
      const y = eskiKayit[ad];
      if (y) {
        // onbellekteki klip bir yedek gorselden uretilmis: yedek hala ayni dosyaysa uyariyi tekrarla, degilse klibi yeniden dene
        const yedek = klipler.find(x => x !== k && x.ad === y.yerine);
        if (!yedek || gorselKimligi(yedek.yol) !== y.yerineKimlik) { try { fs.unlinkSync(k.dosya); } catch (e) { /* yok */ } bekleyen.push(k); continue; }
        kayit[ad] = y;
        yedeklenen.push({ ad: k.ad, yerine: y.yerine });
        uyar("Görsel " + k.ad + " bozuk, panelden sil (yerine " + y.yerine + " kullanıldı)");
      }
      hazir++; continue;
    }
    try { fs.unlinkSync(k.dosya); } catch (e) { /* yok */ }
    bekleyen.push(k);
  }
  const toplam = klipler.length;
  let biten = hazir;
  ilerlet(biten, toplam);

  // bellekTekrar=false (paralel asama): bellek hatasinda ffmpeg ayni anda birkac ornekle yeniden denemesin; dusuk bellek moduna
  // gecilir, havuz tek isciye iner ve dusen klipler asagida TEK TEK tekrarlanir
  const uret = async (k, yol, bellekTekrar) => {
    const sn = k.kare / ayar.FPS;
    await F.uret(k.dosya, K => klipArgv(ayar, { ...k, yol }, K, ipler),
      { etiket: "klip " + (k.i + 1) + "/" + toplam, zamanAsimiMs: F.zamanAsimi(sn, 25, 120), bellekTekrar });
    // ffmpeg 0 ile bitse de dosya eksik/yarim olabilir (surucu/bellek sorunu): onbellege gecersiz klip girmesin
    if (!F.gecerliMi(k.dosya, sn, 0.2, BELLEK_FIRLAT)) {
      try { fs.unlinkSync(k.dosya); } catch (e) { /* yok */ }
      throw new Error("Üretilen klip geçersiz (süre uyuşmuyor): " + path.basename(k.dosya));
    }
  };

  try {
    const sonuc = await F.paralel(bekleyen, () => (F.dusukBellekMi() ? 1 : ipler), async k => {
      try { await uret(k, k.yol, ipler > 1 ? false : undefined); }
      catch (e) {
        if (F.bellekHatasiMi(e) && F.dusukBellekAc("klip üretiminde bellek hatası"))
          uyar("Bellek az: düşük bellek moduna geçildi, kalan klipler tek tek üretiliyor (daha yavaş, görüntü kalitesi aynı).");
        throw e;
      }
      biten++; ilerlet(biten, toplam);
    });
    const basarisiz = bekleyen.filter((k, i) => !sonuc[i].ok);
    if (basarisiz.length) {
      uyar(basarisiz.length + " klip paralelde olmadı (genelde bellek/kodlayıcı) — tek tek tekrar deneniyor.");
      for (const k of basarisiz) {
        const ilk = sonuc[bekleyen.indexOf(k)].hata;
        if (ilk) console.log("  paralel hata (klip " + (k.i + 1) + "): " + String(ilk.message).slice(0, 300));
        try { await uret(k, k.yol); }
        catch (e) {
          // bellek yetmedi: gorsel bozuk DEGIL, komsu gorselle degistirilmez (anlasilir bellek hatasi yukari gider)
          if (F.bellekHatasiMi(e)) throw bellekKlipHatasi(e, k);
          // Gorsel kodlanamiyor (bozuk/yarim). Atla + uyar: yerine komsu klibin gorselini koy.
          // yerine EN YAKIN saglam komsunun gorseli konur (sahne icerigi ve sure korunur)
          const yedek = klipler.filter(x => x !== k && !basarisiz.includes(x)).sort((a, b) => Math.abs(a.i - k.i) - Math.abs(b.i - k.i))[0];
          if (!yedek) throw new ortak.OrtakHata("gorsel_bozuk", "Görsel " + path.basename(k.ad) + " bozuk, panelden sil", {
            cikis: ortak.CIKIS.YETERSIZ, cozum: "Panelde Görseller listesinden bu görseli sil ve videoyu yeniden kur.", detay: String(e.message).slice(0, 400) });
          uyar("Görsel " + k.ad + " bozuk, panelden sil (yerine " + yedek.ad + " kullanıldı)");
          try { await uret(k, yedek.yol); }
          catch (e2) {
            if (F.bellekHatasiMi(e2)) throw bellekKlipHatasi(e2, k);
            throw new ortak.OrtakHata("gorsel_bozuk", "Görsel " + path.basename(k.ad) + " bozuk, panelden sil", {
              cikis: ortak.CIKIS.YETERSIZ, cozum: "Panelde Görseller listesinden bu görseli sil ve videoyu yeniden kur.", detay: String(e2.message).slice(0, 400) });
          }
          yedeklenen.push({ ad: k.ad, yerine: yedek.ad });
          kayit[path.basename(k.dosya)] = { ad: k.ad, yerine: yedek.ad, yerineKimlik: gorselKimligi(yedek.yol) };
        }
        biten++; ilerlet(biten, toplam);
      }
    }
  } finally {
    // kayit, sonradan hata olsa bile yazilir: o ana kadar yedekten uretilmis klipler sessiz kalmasin
    const kayitYolu = path.join(tmp, YEDEK_KAYDI);
    try {
      if (Object.keys(kayit).length) ortak.atomikJsonYaz(kayitYolu, { surum: 1, yedekler: kayit });
      else fs.unlinkSync(kayitYolu);
    } catch (e) { /* kayit yok / yazilamadi: kritik degil */ }
  }
  return { uretilen: bekleyen.length, onbellekten: hazir, yedeklenen };
}

// ---------------------------------------------------------------- gecisli birlestirme
// elemanlar: [{dosya, kare}]. Donus: filtre grafi satirlari + sonuc etiketi + toplam kare
function xfadeGrafi(ayar, elemanlar, girdiBas) {
  const g = [];
  const bas = girdiBas || 0;
  // her girdiye AYNI renk etiketi: etiketsiz bir girdi (geri sayim) varsa libavfilter ortak renk uzayi muzakeresinde digerlerinin rengini kaydiriyordu
  elemanlar.forEach((_, i) => g.push(`[${bas + i}:v]settb=AVTB,fps=${ayar.FPS},format=yuv420p,${F.RENK_SETPARAMS}[c${i}]`));
  let son = "c0", acc = elemanlar[0].kare;
  for (let i = 1; i < elemanlar.length; i++) {
    const off = (acc - ayar.cfKare) / ayar.FPS;
    const cikti = i === elemanlar.length - 1 ? "vm" : `m${i}`;
    g.push(`[${son}][c${i}]xfade=transition=${ayar.gecis}:duration=${ayar.CF.toFixed(4)}:offset=${off.toFixed(4)}[${cikti}]`);
    son = cikti; acc = acc - ayar.cfKare + elemanlar[i].kare;
  }
  if (elemanlar.length === 1) g.push(`[c0]null[vm]`);
  return { satirlar: g, kare: acc };
}
const birlesikKare = (elemanlar, cf) => elemanlar.reduce((a, e) => a + e.kare, 0) - (elemanlar.length - 1) * cf;

// elemanlar -> tek ara dosya (grup / ust grup). Gecerli onbellek varsa dokunmaz.
async function grupUret(ayar, tmp, elemanlar, hedef, ilerleme) {
  const kare = birlesikKare(elemanlar, ayar.cfKare);
  if (F.gecerliMi(hedef, kare / ayar.FPS, 0.15, BELLEK_FIRLAT)) return { dosya: hedef, kare, onbellek: true };
  try { fs.unlinkSync(hedef); } catch (e) { /* yok */ }
  const { satirlar } = xfadeGrafi(ayar, elemanlar);
  // xfade ciktisi yuv444p'ye gidiyordu (2 kat buyuk ara dosya): 4:2:0 + BT.709 sinirli aralik etiketiyle kapat
  satirlar.push(`[vm]${F.RENK_YUV_SON}[vo]`);
  const fcDosya = path.join(tmp, "fc_" + path.basename(hedef, ".mp4") + ".txt");
  fs.writeFileSync(fcDosya, satirlar.join(";\n"), "utf8");
  const girdi = [];
  elemanlar.forEach(e => girdi.push("-i", e.dosya));
  await F.uret(hedef, K => [...girdi, require("../ff-yol").filtreBayragi, fcDosya, "-map", "[vo]", ...K.ara, "-an"],
    { cwd: tmp, etiket: path.basename(hedef), zamanAsimiMs: F.zamanAsimi(kare / ayar.FPS, 12, 120), girdiler: elemanlar.map(e => e.dosya),
      ilerleme: ilerleme ? (sn => ilerleme(Math.min(1, sn / (kare / ayar.FPS)))) : undefined });
  try { fs.unlinkSync(fcDosya); } catch (e) { /* yok */ }
  if (!F.gecerliMi(hedef, kare / ayar.FPS, 0.3, BELLEK_FIRLAT)) {
    try { fs.unlinkSync(hedef); } catch (e) { /* yok */ }
    throw new ortak.OrtakHata("ara_dosya_bozuk", "Üretilen ara dosya geçersiz (süre uyuşmuyor): " + path.basename(hedef), {
      cikis: ortak.CIKIS.GENEL, cozum: "İşi aynı şekilde tekrar çalıştır: ara dosya yeniden üretilir." });
  }
  return { dosya: hedef, kare, onbellek: false };
}

module.exports = { klipImzasi, klipAdi, grupAdi, klipArgv, klipleriUret, xfadeGrafi, birlesikKare, grupUret, imza8 };
