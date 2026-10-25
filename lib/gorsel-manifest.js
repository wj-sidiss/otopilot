// GORSEL MANIFESTI, ATIF DOSYASI, SILINENLER, SAHNE KLASORLERI (GO grubu) — sozlesme bolum 3.
//
// Visuals/manifest.json'u YALNIZCA GO araclari yazar (gorsel-bul, gorsel-cek, portre-cek, gorsel-uret):
//   {surum:1, olusturma, kaynakSenaryoSha1, dil, hedefYon, sahneler:[{no, klasor, paragraflar, aramalar,
//    aramaKaynagi?: "elle"|"aramalar-txt"|"claude"|"otomatik", kullanilanArama, durum, gorseller:[{dosya, kaynak, lisans,
//    lisansKodu, atifGerekli, atifOnerilen, atif, baslik, kaynakUrl, indirmeUrl, en, boy, bayt, sha1, istem?,
//    alakaZayif?: true (baslik/aciklamasi aramayla eslesmedi; sahne bos kalmasin diye alindi)}]}], toplamGorsel, kaynakHatalari}
// Panel (PA) yalniz gorsel silerken kaydi cikarir ve silinenler.json'a yazar; render (R) okur.
//
// Sahne klasoru NNN-kelime (3 hane; eski 2 haneliler sayisal onekle siralanir: sahne 100, sahne 11'den ONCE gelmez).
"use strict";
const fs = require("fs");
const path = require("path");
const ortak = require("./ortak.js");
const { sahnePlan, sahneKlasorAdi, turkceGorunuyorMu } = require("./gorsel-sorgu.js");
const { dogrula } = require("./gorsel-dogrula.js");
const { atifListesineGirer, atifMetni, lisansCoz } = require("./gorsel-lisans.js");
const { kanonikUrl } = require("./gorsel-puan.js");

const SURUM = 1;
const RESIM_RE = /\.(jpe?g|png)$/i;
const ATIF_BASLIK = "Görsel kaynakları / Image credits:";

// ---------------------------------------------------------------- yollar
function yollar(is) {
  const BASE = ortak.isDizin(is);
  const VIS = path.join(BASE, "Visuals");
  return {
    BASE, VIS,
    MANIFEST: path.join(VIS, "manifest.json"),
    ATIF: path.join(BASE, "ATIF.txt"),
    SILINEN: path.join(BASE, "silinenler.json"),
    SENARYO: path.join(BASE, "Voice", "SESLENDIRME-TAM-METIN.txt"),
    ARAMALAR: path.join(BASE, "Voice", "gorsel-aramalari.json"),
    ARAMALAR_TXT: path.join(BASE, "Voice", "ARAMALAR.txt"),
  };
}

// ---------------------------------------------------------------- senaryo / aramalar
function senaryoOku(is) {
  const P = yollar(is);
  let metin = "";
  try { metin = fs.readFileSync(P.SENARYO, "utf8"); } catch (e) { if (e.code !== "ENOENT") throw e; }
  const paragraflar = ortak.paragraflaraBol(metin);
  return { metin: metin.trim(), paragraflar, ozet: ortak.paragrafOzeti(paragraflar) };
}

// Voice/gorsel-aramalari.json (SN). Senaryo ozeti eslesmiyorsa ESKI sayilir -> null.
// -> Map(paragrafNo -> {aramalar:[...], uret:"..."}) | null
function aramalariOku(is, ozet, uyari) {
  const P = yollar(is);
  let d;
  try { d = ortak.jsonOku(P.ARAMALAR, null); }
  catch (e) { if (uyari) uyari("gorsel-aramalari.json okunamadı (" + e.message + "); otomatik arama kelimeleri kullanılacak."); return null; }
  if (!d || !Array.isArray(d.paragraflar)) return null;
  if (d.surum !== undefined && d.surum > SURUM && uyari) uyari("gorsel-aramalari.json üst sürümde (" + d.surum + "); bilinen alanlar kullanılıyor.");
  if (d.kaynakSenaryoSha1 && d.kaynakSenaryoSha1 !== ozet) {
    if (uyari) uyari("gorsel-aramalari.json güncel senaryoya ait değil (senaryo sonradan değişmiş); otomatik arama kelimeleri kullanılacak.");
    return null;
  }
  const harita = new Map();
  for (const p of d.paragraflar) {
    if (!p || !Number.isInteger(p.no)) continue;
    const aramalar = (Array.isArray(p.aramalar) ? p.aramalar : []).map(x => String(x).trim()).filter(Boolean);
    harita.set(p.no, { aramalar, uret: typeof p.uret === "string" && p.uret.trim() ? p.uret.trim() : "" });
  }
  return harita;
}

// Voice/ARAMALAR.txt (senaryoyu yazan ajan): her satir bir paragrafin (sahne adayinin) INGILIZCE gorsel arama ifadesi,
// sira paragraflarla ayni; "|" ile yedek aramalar: "full moon night sky | moon surface closeup".
// Bos satir ve '#' ile baslayan satir yok sayilir; satir basindaki "1." / "2)" / "-" / "Paragraf 3:" numaralamasi ve
// tirnaklar atilir; tek basina "-" o paragraf icin otomatik arama demektir. "uret:" oneki atilir (bu dosya AI uretimi
// baslatmaz; o yalniz konu.json sahneKelimeleri ile). -> [[arama...], ...] (satir basina bir liste)
const TXT_MAKS_ARAMA = 8, TXT_MAKS_UZUNLUK = 200;
function aramaSatirlariCoz(metin) {
  const satirlar = [];
  for (const ham of String(metin == null ? "" : metin).split(/\r?\n/)) {
    let s = ham.trim();                                         // trim() dosya basindaki BOM'u (U+FEFF) da atar
    if (!s || s.startsWith("#")) continue;
    if (s === "-") { satirlar.push([]); continue; }
    s = s.replace(/^(?:(?:paragraf|paragraph|sahne|scene|p)\s*\d{1,3}\s*[:.)-]\s*|\d{1,3}\s*[.)]\s+|[-*•]\s+)/i, "");
    const aramalar = [];
    for (let x of s.split("|")) {
      x = x.replace(/^\s*uret:\s*/i, "").replace(/\s+/g, " ").trim().replace(/^["'“”‘’]+|["'“”‘’]+$/g, "").trim();
      if (x.length > TXT_MAKS_UZUNLUK) x = x.slice(0, TXT_MAKS_UZUNLUK).trim();
      if (x && !aramalar.some(y => y.toLowerCase() === x.toLowerCase())) aramalar.push(x);
    }
    satirlar.push(aramalar.slice(0, TXT_MAKS_ARAMA));
  }
  return satirlar;
}

// Metin dosyasi tamponu -> dizge. Windows PowerShell 5.1'in `>` / Out-File varsayilani UTF-16 LE (BOM'lu) yazar; UTF-8
// diye okunursa her harfin arasina NUL girer ve aramalar sessizce bozulur. BOM'a gore UTF-16 LE/BE cozulur, yoksa UTF-8.
function metinCoz(buf) {
  if (buf.length >= 2 && buf[0] === 0xFF && buf[1] === 0xFE) return buf.subarray(2).toString("utf16le");
  if (buf.length >= 2 && buf[0] === 0xFE && buf[1] === 0xFF)
    return Buffer.from(buf.subarray(2, 2 + ((buf.length - 2) & ~1))).swap16().toString("utf16le");
  // BOM'suz UTF-16 LE: Latin harflerin her birinin ardinda NUL bayti olur
  let nul = 0;
  for (let i = 1; i < buf.length; i += 2) if (buf[i] === 0) nul++;
  if (buf.length >= 4 && nul * 2 >= buf.length / 2) return buf.subarray(0, buf.length & ~1).toString("utf16le");
  return buf.toString("utf8");
}

// ARAMALAR.txt'yi okur ve paragraflarla eslestirir. Satir sayisi paragraf sayisini tutmazsa anlasilir uyari verir ve
// ESLESEN KADARINI kullanir (fazla satir yok sayilir; satiri olmayan paragraf otomatik aranir).
// -> Map(paragrafNo -> {aramalar:[...]}) | null (dosya yok/bos/okunamadi)
function aramalarTxtOku(is, paragrafSayisi, uyari) {
  const P = yollar(is);
  const u = uyari || (() => {});
  let metin;
  try { metin = metinCoz(fs.readFileSync(P.ARAMALAR_TXT)); }
  catch (e) {
    if (e.code !== "ENOENT") u("Voice/ARAMALAR.txt okunamadı (" + e.message + "); otomatik arama kelimeleri kullanılacak.");
    return null;
  }
  const satirlar = aramaSatirlariCoz(metin);
  if (!satirlar.some(l => l.length)) { u("Voice/ARAMALAR.txt boş; otomatik arama kelimeleri kullanılacak."); return null; }
  const n = satirlar.length, m = paragrafSayisi;
  if (n < m)
    u("Voice/ARAMALAR.txt'de " + n + " satır var ama senaryoda " + m + " paragraf var: ilk " + n + " paragrafta bu aramalar kullanılıyor, " +
      "kalan " + (m - n) + " paragrafta otomatik arama yapılacak. Her paragraf için bir satır yaz (sıra paragraflarla aynı).");
  else if (n > m)
    u("Voice/ARAMALAR.txt'de " + n + " satır var ama senaryoda " + m + " paragraf var: ilk " + m + " satır kullanıldı, fazla " + (n - m) +
      " satır yok sayıldı. Senaryo değiştiyse ARAMALAR.txt'yi de güncelle (her paragraf için bir satır, sıra paragraflarla aynı).");
  const turkce = [];
  for (let i = 0; i < Math.min(n, m); i++) if (satirlar[i].some(turkceGorunuyorMu)) turkce.push(i + 1);
  if (turkce.length)
    u("Voice/ARAMALAR.txt satır " + turkce.slice(0, 5).join(", ") + (turkce.length > 5 ? "…" : "") + " Türkçe görünüyor; görsel kaynakları " +
      "İngilizce aramada çok daha isabetli sonuç verir (ör. \"full moon night sky\").");
  try {
    if (fs.statSync(P.SENARYO).mtimeMs - fs.statSync(P.ARAMALAR_TXT).mtimeMs > 2000)
      u("Voice/ARAMALAR.txt senaryodan eski: senaryo sonradan değiştiyse aramaları da aynı sırayla güncelle.");
  } catch (e) { /* senaryo yok: senaryoOku zaten durdurur */ }
  const harita = new Map();
  for (let i = 0; i < Math.min(n, m); i++) harita.set(i, { aramalar: satirlar[i] });
  return harita;
}

// ---------------------------------------------------------------- manifest oku / yaz
// -> {m, durum:"yok"|"tamam"|"bozuk"|"ust-surum", yedek?}
//   bozuk    : JSON okunamadi ya da yapi gecersiz -> dosya Visuals/manifest.bozuk-<damga>.json diye YEDEKLENIR (silinmez);
//              gorseller diskte durur, planYukle onlari sahnelere diskten yeniden baglar (arsivleyip bastan indirmez)
//   ust-surum: daha yeni bir surumun manifesti -> yedeklenir, guvenli geri dususle yeniden kurulur
function manifestOkuDetay(is, uyari) {
  const P = yollar(is);
  let m;
  const yedekle = onek => {
    const yedek = path.join(P.VIS, onek + ortak.damga() + ".json");
    try { fs.renameSync(P.MANIFEST, yedek); } catch (e2) { return null; }
    return yedek;
  };
  try { m = ortak.jsonOku(P.MANIFEST, null); }
  catch (e) {
    const yedek = yedekle("manifest.bozuk-");
    if (uyari) uyari("Visuals/manifest.json bozuktu (" + e.message + "); yedeklendi, yeniden kuruluyor.");
    return { m: null, durum: "bozuk", yedek };
  }
  if (!m) return { m: null, durum: "yok" };
  if (!ortak.duzNesne(m) || !Array.isArray(m.sahneler)) {
    const yedek = yedekle("manifest.bozuk-");
    if (uyari) uyari("Visuals/manifest.json geçersiz yapıda (sahneler listesi yok); yedeklendi, yeniden kuruluyor.");
    return { m: null, durum: "bozuk", yedek };
  }
  if (typeof m.surum === "number" && m.surum > SURUM) {
    if (uyari) uyari("manifest.json üst sürümde (" + m.surum + "); güvenli geri dönüşle yeniden kuruluyor.");
    return { m: null, durum: "ust-surum", yedek: yedekle("manifest.ust-surum-") };
  }
  for (const s of m.sahneler) {
    if (!Array.isArray(s.gorseller)) s.gorseller = [];
    if (!Array.isArray(s.paragraflar)) s.paragraflar = [];
    if (!Array.isArray(s.aramalar)) s.aramalar = [];
    // klasor adi yola eklenir: yalniz guvenli karakterler (.. / \ yok)
    if (s.klasor && !/^[A-Za-z0-9 _-]{1,80}$/.test(String(s.klasor))) { s.klasor = ""; s.gorseller = []; }
  }
  return { m, durum: "tamam" };
}
function manifestOku(is, uyari) { return manifestOkuDetay(is, uyari).m; }

function toplamGorsel(m) { return m.sahneler.reduce((a, s) => a + s.gorseller.length, 0); }

function manifestYaz(is, m) {
  const P = yollar(is);
  m.toplamGorsel = toplamGorsel(m);
  m.uyarilar = uyariListesi(m);                                 // CC BY-SA vb. (tekil)
  fs.mkdirSync(P.VIS, { recursive: true });
  ortak.atomikJsonYaz(P.MANIFEST, m);
}

// manifestteki sahneler kanonik 0..N-1'i ardisik ve ortusmeden kapsiyor mu? (bos paragraflar:[] ek sahneler yok sayilir)
function kapsiyorMu(m, N) {
  const g = [];
  for (const s of m.sahneler) for (const p of s.paragraflar || []) g.push(p);
  if (g.length !== N) return false;
  g.sort((a, b) => a - b);
  return g.every((p, i) => p === i);
}

// ---------------------------------------------------------------- klasor / dosya yardimcilari
const sayisalOnek = ad => { const m = /^(\d+)/.exec(ad); return m ? parseInt(m[1], 10) : Infinity; };
const sayisalSirala = (a, b) => (sayisalOnek(a) - sayisalOnek(b)) || a.localeCompare(b);

// Sahne klasorleri: SAYISAL onekle sirali (001-..., 11-..., 100-...). '_' ile baslayanlar (arsiv) dahil degil.
function sahneKlasorleri(VIS) {
  let l;
  try { l = fs.readdirSync(VIS, { withFileTypes: true }); } catch (e) { return []; }
  return l.filter(d => d.isDirectory() && /^\d+/.test(d.name)).map(d => d.name).sort(sayisalSirala);
}
function resimDosyalari(dizin) {
  let l;
  try { l = fs.readdirSync(dizin, { withFileTypes: true }); } catch (e) { return []; }
  return l.filter(d => d.isFile() && RESIM_RE.test(d.name)).map(d => d.name).sort(sayisalSirala);
}
function sonrakiNo(dizin) {
  let en = 0;
  for (const ad of resimDosyalari(dizin)) { const n = sayisalOnek(ad); if (Number.isFinite(n) && n > en) en = n; }
  return en + 1;
}

// ---------------------------------------------------------------- kayit
function tekSatir(s, maks) { return String(s == null ? "" : s).replace(/\s+/g, " ").trim().slice(0, maks || 300); }

// Aday + dogrulanmis dosya -> manifest "gorseller[]" kaydi
function kayitOlustur(dosyaGoreli, aday, v) {
  const k = {
    dosya: dosyaGoreli.replace(/\\/g, "/"),
    kaynak: aday.kaynak,
    lisans: aday.lisans,
    lisansKodu: aday.lisansKodu,
    atifGerekli: !!aday.atifGerekli,
    atifOnerilen: !!aday.atifOnerilen,
    atif: tekSatir(aday.atif, 160),
    baslik: tekSatir(aday.baslik, 200),
    kaynakUrl: aday.kaynakUrl || "",
    indirmeUrl: aday.indirmeUrl || aday.url || "",
    en: v.en, boy: v.boy, bayt: v.bayt, sha1: v.sha1,
  };
  if (aday.istem) k.istem = aday.istem;
  if (aday.uyari) k.uyari = aday.uyari;
  if (aday.alakasiz) k.alakaZayif = true;                       // alaka suzgecinden gecemedi; sahne bos kalmasin diye alindi
  return k;
}

// Gorseli sahne klasorune YAZAR (atomik) ve sahnenin kayitlarina ekler. -> kayit
function gorselYaz(P, sahne, buf, v, aday) {
  const dizin = path.join(P.VIS, sahne.klasor);
  fs.mkdirSync(dizin, { recursive: true });
  const ad = String(sonrakiNo(dizin)).padStart(2, "0") + v.uzanti;
  ortak.atomikYaz(path.join(dizin, ad), buf);
  const k = kayitOlustur(sahne.klasor + "/" + ad, aday, v);
  sahne.gorseller.push(k);
  return k;
}

// Diskle manifesti uzlastirir: dosyasi olmayan kayit dusulur; kaydi olmayan dosya "elle" kaydi alir.
// -> {dusen, eklenen}
function diskleUzlastir(P, m) {
  let dusen = 0, eklenen = 0;
  const vardir = g => {
    const yol = path.resolve(P.VIS, String(g && g.dosya || ""));
    try { return !!g && !!g.dosya && ortak.yolIcinde(P.VIS, yol) && RESIM_RE.test(yol) && fs.statSync(yol).isFile(); } catch (e) { return false; }
  };
  for (const s of m.sahneler) {
    const onceki = s.gorseller.length;
    s.gorseller = s.gorseller.filter(vardir);                   // kayit baska klasordeki (eklenmis) dosyaya da isaret edebilir
    dusen += onceki - s.gorseller.length;
    if (!s.klasor) continue;
    const dizin = path.join(P.VIS, s.klasor);
    const kayitli = new Set(s.gorseller.map(g => String(g.dosya).replace(/\\/g, "/")));
    for (const ad of resimDosyalari(dizin)) {
      if (kayitli.has(s.klasor + "/" + ad)) continue;
      let buf; try { buf = fs.readFileSync(path.join(dizin, ad)); } catch (e) { continue; }
      const v = dogrula(buf, { minUzunKenar: 0 });
      if (!v.tamam && !v.sha1) continue;                        // gorsel degil: dokunma, kaydetme
      const l = lisansCoz("elle");
      s.gorseller.push(kayitOlustur(s.klasor + "/" + ad, Object.assign({ kaynak: "elle", baslik: ad }, l), v));
      eklenen++;
    }
    s.gorseller.sort((a, b) => sayisalSirala(String(a.dosya), String(b.dosya)));
  }
  return { dusen, eklenen };
}

// Baska bir klasordeki (eslesemeyen sahne adli) gorselleri bir sahnenin kayitlarina "elle" olarak ekler
function klasoruSahneyeEkle(P, s, klasorAd) {
  let n = 0;
  const kayitli = new Set(s.gorseller.map(g => String(g.dosya).replace(/\\/g, "/")));
  for (const ad of resimDosyalari(path.join(P.VIS, klasorAd))) {
    const goreli = klasorAd + "/" + ad;
    if (kayitli.has(goreli)) continue;
    let buf; try { buf = fs.readFileSync(path.join(P.VIS, klasorAd, ad)); } catch (e) { continue; }
    const v = dogrula(buf, { minUzunKenar: 0 });
    if (!v.tamam && !v.sha1) continue;
    s.gorseller.push(kayitOlustur(goreli, Object.assign({ kaynak: "elle", baslik: ad }, lisansCoz("elle")), v));
    n++;
  }
  s.gorseller.sort((a, b) => sayisalSirala(String(a.dosya), String(b.dosya)));
  return n;
}

// ---------------------------------------------------------------- arsiv (_eski-<damga>)
// fs.cpSync Windows'ta ASCII disi (Turkce) yollarda dizini SESSIZCE yanlis adla (bozuk karakterli) olusturuyor (Node 24'te
// denendi: "Masaüstü" yolu, UTF-8 baytlari Latin-1 gibi okunmus bozuk bir adla acildi); kopya sonrasi kaynak silindigi icin veri
// kaybi olurdu. Elle ozyinelemeli kopya.
function dizinKopyala(kaynak, hedef) {
  if (!fs.statSync(kaynak).isDirectory()) { fs.mkdirSync(path.dirname(hedef), { recursive: true }); fs.copyFileSync(kaynak, hedef); return; }
  fs.mkdirSync(hedef, { recursive: true });
  for (const g of fs.readdirSync(kaynak)) dizinKopyala(path.join(kaynak, g), path.join(hedef, g));
}

// Arsivler (Visuals/_eski-*) KENDILIGINDEN SILINMEZ: kullanicinin elle ayiklayip sakladigi set orada olabilir, panel de
// "eski klasorler _eski-... altina TASINIR" diyor. Yer acmak icin acik onay gerekir: arsivleriTemizle (gorsel-bul.js
// --arsiv-temizle) en yeni 2 arsiv disindakileri siler. Onay yoksa yalnizca uyari verilir (adet/boyut birikince).
const ARSIV_UYARI_ADET = 3, ARSIV_UYARI_MB = 1024;
const ARSIV_KALAN = 2;

function dizinBoyutuMB(dizin) {
  let toplam = 0;
  const yuru = d => {
    let l; try { l = fs.readdirSync(d, { withFileTypes: true }); } catch (e) { return; }
    for (const x of l) {
      const y = path.join(d, x.name);
      if (x.isDirectory()) yuru(y);
      else if (x.isFile()) { try { toplam += fs.statSync(y).size; } catch (e) {} }
    }
  };
  yuru(dizin);
  return Math.round(toplam / 1048576 * 10) / 10;
}

// Visuals altindaki arsivler, EN ESKIDEN yeniye (degisme zamanina gore; ad yeniden kullanilabilir) -> [{ad, t, mb}]
function arsivleriListele(VIS) {
  let l = [];
  try {
    l = fs.readdirSync(VIS, { withFileTypes: true })
      .filter(d => d.isDirectory() && /^_eski-/.test(d.name))
      .map(d => ({ ad: d.name, t: fs.statSync(path.join(VIS, d.name)).mtimeMs, mb: dizinBoyutuMB(path.join(VIS, d.name)) }));
  } catch (e) {}
  return l.sort((a, b) => (a.t - b.t) || a.ad.localeCompare(b.ad));
}

// ACIK ONAYLA (kullanici --arsiv-temizle verdi): en yeni ARSIV_KALAN arsiv kalir, daha eskileri silinir. Uyari SILMEDEN
// ONCE verilir. -> silinen arsiv adlari
function arsivleriTemizle(VIS, uyari) {
  const eskiler = arsivleriListele(VIS);
  const silinen = [];
  for (const a of eskiler.slice(0, Math.max(0, eskiler.length - ARSIV_KALAN))) {
    if (uyari) uyari("Eski arşiv siliniyor (--arsiv-temizle; son " + ARSIV_KALAN + " arşiv kalır): Visuals/" + a.ad + " (" + a.mb + " MB)");
    try { fs.rmSync(path.join(VIS, a.ad), { recursive: true, force: true }); silinen.push(a.ad); } catch (e) {}
  }
  return silinen;
}

// -> {tasinan, hedef}
function eskiyeTasi(VIS, damga, uyari) {
  const klasorler = sahneKlasorleri(VIS);
  const manifestVar = fs.existsSync(path.join(VIS, "manifest.json"));
  if (!klasorler.length && !manifestVar) return { tasinan: 0, hedef: null };
  // ayni saniyede ikinci arsiv: -2, -3 ... (iki arsivin sahne klasorleri birbirine karismasin)
  let hedef = path.join(VIS, "_eski-" + damga);
  for (let k = 2; fs.existsSync(hedef) && k < 100; k++) hedef = path.join(VIS, "_eski-" + damga + "-" + k);
  fs.mkdirSync(hedef, { recursive: true });
  let tasinan = 0;
  const tasi = (kaynak, ad) => {
    const h = path.join(hedef, ad);
    try { fs.renameSync(kaynak, h); }
    catch (e) {
      // Windows'ta antivirus/onizleme dizini tutuyorsa kopyala + sil
      dizinKopyala(kaynak, h);
      fs.rmSync(kaynak, { recursive: true, force: true });
    }
  };
  for (const k of klasorler) { tasi(path.join(VIS, k), k); tasinan++; }
  if (manifestVar) tasi(path.join(VIS, "manifest.json"), "manifest.json");

  // arsivler biriktikce uyar (silmez): adet ya da toplam boyut esigi asilinca
  const arsivler = arsivleriListele(VIS);
  const mb = Math.round(arsivler.reduce((t, a) => t + a.mb, 0) * 10) / 10;
  if (uyari && (arsivler.length > ARSIV_UYARI_ADET || mb > ARSIV_UYARI_MB))
    uyari("Visuals altında " + arsivler.length + " eski arşiv birikti (" + mb + " MB). Hiçbiri otomatik silinmez; yer lazımsa gereksiz olanları (Visuals/_eski-…) elle sil" +
      " ya da komuta --arsiv-temizle ekle (son " + ARSIV_KALAN + " arşiv hariç hepsi silinir).");
  return { tasinan, hedef };
}

// ---------------------------------------------------------------- plan yukle / kur
// g: {is, kanonik, ozet, dil, yon, kisa, yeniden, adopt, log, uyari}
// -> {manifest, taze, arsiv:{tasinan,hedef}|null, neden}
function planYukle(g) {
  const P = yollar(g.is);
  const log = g.log || (() => {});
  const uyari = g.uyari || (() => {});
  fs.mkdirSync(P.VIS, { recursive: true });
  const okuma = manifestOkuDetay(g.is, g.uyari);
  let m = okuma.m;
  // BOZUK manifest: sahne klasorleri bu programin kendi numaralamasiyla olusmus ve kullanici elle ayiklamis olabilir ->
  // arsive atip bastan indirmek yerine diskten sahnelere yeniden baglanir (adopt). "Numaralama farkli" arsiv yolu yalniz
  // manifest HIC olmadiginda (eski surum / elle kurulmus klasorler) gecerlidir.
  const bozuk = okuma.durum === "bozuk";
  let neden = "";
  if (m) {
    if (m.kaynakSenaryoSha1 !== g.ozet) neden = "senaryo değişti";
    else if (!kapsiyorMu(m, g.kanonik.length)) neden = "sahne–paragraf eşlemesi senaryoyla uyuşmuyor";
    else if (g.yeniden) neden = "temizden başlatıldı (--yeniden)";
  } else if (g.yeniden && sahneKlasorleri(P.VIS).length) neden = "temizden başlatıldı (--yeniden)";
  else if (!g.adopt && !bozuk && sahneKlasorleri(P.VIS).length) neden = "manifestsiz eski görseller (numaralama farklı)";
  const adopt = !!g.adopt || bozuk;
  if (bozuk && !neden) {
    const n = sahneKlasorleri(P.VIS).length;
    if (n) {
      // kaynak/lisans/atif bilgisi yalniz bozuk manifestte vardi: ATIF.txt'yi de yedekle (atifYaz bos kalirsa silerdi)
      let atifYedek = "";
      if (okuma.yedek && fs.existsSync(P.ATIF)) {
        atifYedek = "ATIF." + path.basename(okuma.yedek).replace(/^manifest\./, "").replace(/\.json$/, ".txt");
        try { fs.copyFileSync(P.ATIF, path.join(P.VIS, atifYedek)); } catch (e) { atifYedek = ""; }
      }
      uyari("Manifest bozuktu: Visuals içindeki " + n + " sahne klasörü diskten yeniden bağlandı (bu görsellerin kaynak/lisans/atıf bilgisi kurtarılamadı, 'elle' sayılır). " +
        (okuma.yedek ? "Eski kayıtlar: Visuals/" + path.basename(okuma.yedek) + (atifYedek ? ", atıflar: Visuals/" + atifYedek : "") + ". " : "") +
        "Görseller yenilenecekse --yeniden ile temizden başla.");
    }
  }

  let arsiv = null;
  if (neden) {
    arsiv = eskiyeTasi(P.VIS, ortak.damga(), g.uyari);
    if (arsiv.tasinan || m) log("arşiv     : " + neden + " — eski görseller " + (arsiv.hedef ? path.relative(P.BASE, arsiv.hedef).replace(/\\/g, "/") : "-") + " klasörüne taşındı");
    m = null;
  }
  if (m) {
    const u = diskleUzlastir(P, m);
    if (u.dusen || u.eklenen) log("manifest  : diskle uzlaştırıldı (" + u.dusen + " kayıt düştü, " + u.eklenen + " dosya eklendi)");
    return { manifest: m, taze: false, arsiv, neden };
  }

  const plan = sahnePlan(g.kanonik, { kisa: g.kisa });
  m = {
    surum: SURUM, olusturma: new Date().toISOString(), kaynakSenaryoSha1: g.ozet, dil: g.dil || "en",
    hedefYon: g.yon || "yatay",
    sahneler: plan.map(s => ({ no: s.no, klasor: "", paragraflar: s.paragraflar, aramalar: [], kullanilanArama: null, durum: "eksik", gorseller: [] })),
    toplamGorsel: 0, kaynakHatalari: {},
  };
  if (adopt) {
    // mevcut NN-ad klasorlerini sayisal onekle sahnelere bagla (gorsel-cek / portre-cek / gorsel-uret icin; bozuk manifestte de).
    // Render yalniz PARAGRAFA BAGLI sahneleri kullanir: plan varsa paragrafsiz ek sahne YARATILMAZ,
    // eslesmeyen klasorun gorselleri en yakin sahnenin kayitlarina eklenir.
    for (const ad of sahneKlasorleri(P.VIS)) {
      const no = sayisalOnek(ad);
      const planli = m.sahneler.filter(x => x.paragraflar.length);
      if (!planli.length) {
        if (!m.sahneler.some(x => x.klasor === ad)) m.sahneler.push({ no, klasor: ad, paragraflar: [], aramalar: [], kullanilanArama: null, durum: "eksik", gorseller: [] });
        continue;
      }
      const s = planli.find(x => x.no === no) || (no > planli[planli.length - 1].no ? planli[planli.length - 1] : planli[0]);
      if (!s.klasor) s.klasor = ad;
      else if (s.klasor !== ad) klasoruSahneyeEkle(P, s, ad);
    }
    m.sahneler.sort((a, b) => a.no - b.no);
    diskleUzlastir(P, m);
  }
  return { manifest: m, taze: true, arsiv, neden };
}

// Baska bir klasorden (ornegin _eski-<damga>/<sahne>/) bir gorseli sahne klasorune SONRAKI numarayla geri tasir ve kaydini
// sahneye ekler (ayni numarali yeni dosya varsa carpismasin). Tasinamazsa firlatir. -> yeni kayit
function gorselGeriKoy(P, sahne, kaynakYol, kayit) {
  const dizin = path.join(P.VIS, sahne.klasor);
  fs.mkdirSync(dizin, { recursive: true });
  const ad = String(sonrakiNo(dizin)).padStart(2, "0") + path.extname(kaynakYol).toLowerCase();
  fs.renameSync(kaynakYol, path.join(dizin, ad));
  const k = Object.assign({}, kayit, { dosya: sahne.klasor + "/" + ad });
  sahne.gorseller.push(k);
  return k;
}

// Sahne klasorunu (yoksa) atar ve olusturur
function klasorAta(P, sahne, ifade) {
  if (!sahne.klasor) sahne.klasor = sahneKlasorAdi(sahne.no, ifade || "sahne");
  fs.mkdirSync(path.join(P.VIS, sahne.klasor), { recursive: true });
  return sahne.klasor;
}

// gorsel-cek / portre-cek: `n` adli klasoru bir sahneye baglar.
//   1) klasor adi ayni olan sahne
//   2) senaryo plani VARSA paragrafa bagli sahnelerden: sayisal on ek = sahne no (aralik disiysa en yakin uc sahne;
//      sayisal on eki olmayan ad son sahneye). Render yalniz paragrafa bagli sahneleri kullanir, o yuzden plan varken
//      paragrafsiz ek sahne YARATILMAZ; gorseller sahnenin kendi klasorune yazilir.
//   3) plan yoksa (senaryo henuz yok): paragraf eslemesiz sahne (render klasor sirasina doner)
function sahneBulAdla(m, ad) {
  const ayniAd = m.sahneler.find(x => x.klasor === ad);
  if (ayniAd) return ayniAd;
  const no = sayisalOnek(ad);
  const planli = m.sahneler.filter(x => x.paragraflar.length);
  if (planli.length) {
    if (!Number.isFinite(no)) return planli[planli.length - 1];
    return planli.find(x => x.no === no) || (no > planli[planli.length - 1].no ? planli[planli.length - 1] : planli[0]);
  }
  const sonNo = m.sahneler.reduce((a, x) => Math.max(a, x.no), 0);
  const yeni = { no: Number.isFinite(no) ? no : sonNo + 1, klasor: ad, paragraflar: [], aramalar: [], kullanilanArama: null, durum: "eksik", gorseller: [] };
  m.sahneler.push(yeni);
  m.sahneler.sort((a, b) => a.no - b.no);
  return yeni;
}

// ---------------------------------------------------------------- sahne durumu
const sahneYeterliMi = (s, hedef) => s.gorseller.length >= Math.min(hedef, 2);
function durumHesapla(s, hedef) {
  const n = s.gorseller.length;
  if (!n) return "eksik";
  if (s.gorseller.every(g => g.kaynak === "uretim")) return "uretilen";
  if (n < Math.min(hedef, 2)) return "eksik";
  return s.durum === "doldurma" ? "doldurma" : "tamam";
}

// ---------------------------------------------------------------- silinenler (PA yazar, GO okur)
function silinenleriOku(is, uyari) {
  const P = yollar(is);
  const r = { url: new Set(), sha1: new Set() };
  let d;
  try { d = ortak.jsonOku(P.SILINEN, null); }
  catch (e) { if (uyari) uyari("silinenler.json okunamadı (" + e.message + "); silinen görseller dışlanamayabilir."); return r; }
  if (!d || !Array.isArray(d.silinenler)) return r;
  for (const x of d.silinenler) {
    if (!x) continue;
    if (x.kaynakUrl) r.url.add(kanonikUrl(x.kaynakUrl));
    if (x.sha1) r.sha1.add(String(x.sha1).toLowerCase());
  }
  return r;
}

// ---------------------------------------------------------------- ATIF.txt
function atifSatirlari(m) {
  const gorulen = new Set();
  const satirlar = [];
  for (const s of m.sahneler) for (const g of s.gorseller) {
    if (!atifListesineGirer(g)) continue;
    const kaynakUrl = g.kaynakUrl || g.indirmeUrl || "";
    const anahtar = kaynakUrl || g.dosya;
    if (gorulen.has(anahtar)) continue;
    gorulen.add(anahtar);
    satirlar.push(atifMetni(g));
  }
  return satirlar;
}
// Atif gerektiren gorsel yoksa ATIF.txt kaldirilir (dosya yok = atif gerekmiyor; aciklamaya bos baslik yapismasin)
function atifYaz(is, m) {
  const P = yollar(is);
  const s = atifSatirlari(m);
  if (!s.length) { try { fs.unlinkSync(P.ATIF); } catch (e) {} return 0; }
  ortak.atomikYaz(P.ATIF, ATIF_BASLIK + "\n" + s.join("\n") + "\n");
  return s.length;
}

// manifest uyarilari (CC BY-SA vb.), tekil
function uyariListesi(m) {
  const set = new Set();
  for (const s of m.sahneler) for (const g of s.gorseller) if (g.uyari) set.add(g.uyari);
  return [...set];
}

function kaynakSayaclari(m) {
  const r = {};
  for (const s of m.sahneler) for (const g of s.gorseller) r[g.kaynak] = (r[g.kaynak] || 0) + 1;
  return r;
}

module.exports = {
  SURUM, ATIF_BASLIK, yollar, senaryoOku, aramalariOku, aramaSatirlariCoz, aramalarTxtOku, manifestOku, manifestOkuDetay, manifestYaz, kapsiyorMu, toplamGorsel,
  sayisalOnek, sayisalSirala, sahneKlasorleri, resimDosyalari, sonrakiNo, kayitOlustur, gorselYaz, gorselGeriKoy, diskleUzlastir,
  eskiyeTasi, arsivleriListele, arsivleriTemizle, planYukle, klasorAta, sahneBulAdla, klasoruSahneyeEkle, sahneYeterliMi, durumHesapla, silinenleriOku, atifSatirlari, atifYaz,
  uyariListesi, kaynakSayaclari, tekSatir,
};
