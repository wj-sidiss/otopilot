// lib/ses-metin.js — seslendirme metninin hazirlanmasi (okunus), kelime sayma, uzun metin bolme.
//
// NEDEN VAR: ses motoru metni oldugu gibi okuyordu. "%15", "3,5", "2.500", "m²", "km/s",
// "Dr.", "vs." gibi bicimler motorun yorumuna kaliyordu; "&" ve "<" SSML'i bozabiliyordu.
// Okunusu duzeltmek icin senaryoyu degistirirsek ALTYAZI da degisirdi (ses ve altyazi ayni
// metinden besleniyor). Bu yuzden hazirlik YALNIZ TTS metnine uygulanir; altyazi ozgun metinle
// kalir (seslendir.js her paragrafin okunanMetin'ini kelimeler.json'a yazar).
//
// Kapsam:
//   tr, en : tam (sayi, yuzde, para, birim, kisaltma; Turkce'de rakamlar da sozcuge cevrilir)
//   es, de, fr : yuzde, "&", derece, para, birim (m², km/h ...) ve kisaltma (Dr., etc., z. B., av. J.-C. ...);
//                rakamlar OLDUGU GIBI kalir (bu dillerde Edge/Azure rakami dogru okur)
//   diger diller: yalniz okunus sozlugu + XML kacisi
// Sinir: Turkce'de nokta ayracli saat YALNIZ "saat" kelimesinden sonra saat sayilir ("Saat 14.30'da");
// baglamsiz "14.30" ondalik okunur (3.14 gibi). Baska kalip icin konu.json "okunus" sozlugunu kullan.
//
// Turkce telaffuz paketi (lib/telaffuz.js): dil=tr'de kullanici "okunus" sozlugunden sonra yerlesik okunus sozlugu
// (data/telaffuz-tr.json: YouTube, ChatGPT, vidIQ...) ve "Merhaba!" diksiyon kurali uygulanir. Kapatma:
// metniHazirla(..., {telaffuzPaketi:false}) / konu.json "telaffuzPaketi": false / seslendir.js --telaffuz-kapali.
//
// KURAL DEGISIRSE HAZIRLIK_SURUMU artirilir: eski sesler "guncel degil" sayilir (seslendir.js).
// (Telaffuz paketi kendi surumunu tasir: telaffuz.PAKET_SURUMU; yalniz Turkce seslerin ozetine girer.)
"use strict";
const crypto = require("crypto");
const telaffuz = require("./telaffuz.js");

const HAZIRLIK_SURUMU = 3;     // 2: "120m²" / "90km/sa" gibi rakama bitisik birimler de cevrilir
                               // 3: es/de/fr birim+kisaltma+para; "saat 14.30"; "007" rakam rakam; ZWNJ/ZWJ korunur

// ---------------------------------------------------------------------------
// Kucuk yardimcilar
// ---------------------------------------------------------------------------
const xmlKacis = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const reKacis = s => String(s).replace(/[.*+?^${}()|[\]\\\/]/g, "\\$&");

// XML 1.0'da gecersiz kontrol karakterleri + sesli okumada anlami olmayan gorunmez isaretler
// (U+200B sifir genislikli bosluk, 2060 kelime birlestirici, FEFF BOM). U+200C (ZWNJ) ve U+200D (ZWJ)
// GECERLI XML karakteridir ve Farsca/Arapca/Hintce'de birlesim isaretidir: SILINMEZ, yoksa telaffuz bozulur.
// Kaynakta gorunmez karakter kalmasin diye aralik kodla kurulur.
const hex4 = n => n.toString(16).padStart(4, "0");
const GIZLI = new RegExp("[" + [[0x00, 0x08], [0x0B, 0x0C], [0x0E, 0x1F], [0x200B, 0x200B], [0x2060, 0x2060], [0xFEFF, 0xFEFF]]
  .map(([a, b]) => "\\u" + hex4(a) + "-\\u" + hex4(b)).join("") + "]", "g");
// Dosya basindaki UTF-8 BOM'u (U+FEFF) at: ilk paragrafin basina yapisip sesi/SSML'i bozmasin.
const bomAt = s => { const t = String(s == null ? "" : s); return t.charCodeAt(0) === 0xFEFF ? t.slice(1) : t; };

// Kelime = icinde harf ya da rakam olan parca. ("--", "&", "…" kelime sayilmaz.)
function kelimeler(metin) {
  return String(metin == null ? "" : metin).split(/\s+/).filter(w => /[\p{L}\p{N}]/u.test(w));
}
const kelimeSay = metin => kelimeler(metin).length;

// Sayi: son karakteri rakam olmali, yoksa cumle sonundaki nokta sayiya yapisir ("$5." -> "5. dollars").
// Uzunluk SINIRLI ({0,30}): sinirsiz [\d.,]* her baslangic noktasinda tum rakam/virgul dizisini tarayip geri donuyordu
// (O(n^2)): "1,1,1,..." gibi 32 bin karakterlik bir liste 8-15 sn, 64 bin karakter dakikalarca surerdu. Gercek sayilar 30 karakteri asmaz.
const SAYI = String.raw`\d(?:[\d.,]{0,30}\d)?`;

// Kisaltmadan sonra cumle bitiyorsa nokta geri konur (TTS dogal duraksasin).
//   "c": buyuk harfle yeni cumle baslarsa da bitmis sayilir (vs., etc., vb.)
//   "s": yalniz metnin SONUNDA bitmis sayilir ("U.S. Army" cumleyi bolmesin)
const CUMLE_SONU = {
  c: String.raw`(?=\s+\p{Lu}|\s*$)`,          // \p{Lu}: Á É Ñ Ü Ç İ ... (regex "u" bayragiyla kurulur)
  s: String.raw`(?=\s*$)`,
};

// ---------------------------------------------------------------------------
// TURKCE sayi okuma
// ---------------------------------------------------------------------------
const TR_BIRLER = ["", "bir", "iki", "üç", "dört", "beş", "altı", "yedi", "sekiz", "dokuz"];
const TR_ONLAR = ["", "on", "yirmi", "otuz", "kırk", "elli", "altmış", "yetmiş", "seksen", "doksan"];
const TR_BASAMAK = ["", "bin", "milyon", "milyar", "trilyon", "katrilyon"];
const TR_SIRA = {
  bir: "birinci", iki: "ikinci", "üç": "üçüncü", "dört": "dördüncü", "beş": "beşinci",
  "altı": "altıncı", yedi: "yedinci", sekiz: "sekizinci", dokuz: "dokuzuncu",
  on: "onuncu", yirmi: "yirminci", otuz: "otuzuncu", "kırk": "kırkıncı", elli: "ellinci",
  "altmış": "altmışıncı", "yetmiş": "yetmişinci", seksen: "sekseninci", doksan: "doksanıncı",
  "yüz": "yüzüncü", bin: "bininci", milyon: "milyonuncu", milyar: "milyarıncı",
  trilyon: "trilyonuncu", katrilyon: "katrilyonuncu", "sıfır": "sıfırıncı",
};

function trUcHane(n) {
  const y = Math.floor(n / 100), o = Math.floor((n % 100) / 10), b = n % 10, p = [];
  if (y) p.push((y > 1 ? TR_BIRLER[y] + " " : "") + "yüz");   // "yüz", "iki yüz" ("bir yüz" denmez)
  if (o) p.push(TR_ONLAR[o]);
  if (b) p.push(TR_BIRLER[b]);
  return p.join(" ");
}

// Rakam dizisi -> Turkce sozcukler. 18 haneden uzunsa null (rakam olarak birakilir).
function trSayi(rakamlar) {
  const s = String(rakamlar).replace(/^0+(?=\d)/, "");
  if (!/^\d+$/.test(s)) return null;
  if (s === "0") return "sıfır";
  if (s.length > 18) return null;
  const gruplar = [];
  for (let i = s.length; i > 0; i -= 3) gruplar.unshift(s.slice(Math.max(0, i - 3), i));
  const cikti = [];
  gruplar.forEach((g, idx) => {
    const n = Number(g);
    if (!n) return;
    const bas = gruplar.length - 1 - idx;                 // 0 birler, 1 bin, 2 milyon ...
    if (bas === 1 && n === 1) { cikti.push("bin"); return; }   // "bir bin" denmez
    cikti.push(trUcHane(n) + (bas ? " " + TR_BASAMAK[bas] : ""));
  });
  return cikti.join(" ");
}

function trSira(rakamlar) {
  const kelime = trSayi(rakamlar);
  if (!kelime) return null;
  const parca = kelime.split(" ");
  const son = parca.pop();
  parca.push(TR_SIRA[son] || son);
  return parca.join(" ");
}

// "2.500" (binlik) | "3,5" (ondalik) | "12.5" (ondalik) | "1250" -> Turkce sozcukler.
function trSayiMetni(s) {
  let tam = s, kesir = null;
  // basinda sifir olan tam sayi (007, 0212, 05) sayi degil kod/numaradir: rakam rakam okunur
  // (trSayi basa sifirlari atar: "007" -> "yedi" olurdu). "0" ve "0,5" etkilenmez.
  if (/^0\d+$/.test(s)) return s.split("").map(c => trSayi(c)).join(" ");
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) {            // 1.250.000  /  1.250,75
    const [t, k] = s.split(",");
    tam = t.replace(/\./g, ""); kesir = k === undefined ? null : k;
  } else if (/^\d+,\d+$/.test(s)) {                      // 3,5
    [tam, kesir] = s.split(",");
  } else if (/^\d+\.\d+$/.test(s)) {                     // 12.5 (nokta ondalik)
    [tam, kesir] = s.split(".");
  } else if (!/^\d+$/.test(s)) {
    return null;
  }
  const t = trSayi(tam);
  if (t === null) return null;
  if (kesir === null) return t;
  let k;
  if (kesir.length > 3) k = kesir.split("").map(c => trSayi(c)).join(" ");   // pi: rakam rakam
  else {
    const bas = kesir.match(/^0*/)[0].length;
    const kalan = kesir.slice(bas);
    k = Array(bas).fill("sıfır").concat(kalan ? [trSayi(kalan)] : []).join(" ");
  }
  return t + " virgül " + k;
}

// ---------------------------------------------------------------------------
// Dil kurallari
// ---------------------------------------------------------------------------
const AY_TR = ["", "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];

// Birim tablosu: [regex kaynagi, tekil, cogul?]. Sayidan sonra gelir (rakamlar sonra okunur).
// cogul yoksa (tr, de) birim sayiya gore degismez.
const BIRIM = {
  tr: [
    ["km", "kilometre"], ["kg", "kilogram"], ["cm", "santimetre"], ["mm", "milimetre"],
    ["mg", "miligram"], ["ml", "mililitre"], ["m", "metre"], ["g", "gram"],
  ],
  en: [
    ["km", "kilometer", "kilometers"], ["kg", "kilogram", "kilograms"], ["cm", "centimeter", "centimeters"],
    ["mm", "millimeter", "millimeters"], ["mg", "milligram", "milligrams"], ["ml", "milliliter", "milliliters"],
    ["m", "meter", "meters"], ["g", "gram", "grams"],
  ],
  es: [
    ["km", "kilómetro", "kilómetros"], ["kg", "kilogramo", "kilogramos"], ["cm", "centímetro", "centímetros"],
    ["mm", "milímetro", "milímetros"], ["mg", "miligramo", "miligramos"], ["ml", "mililitro", "mililitros"],
    ["m", "metro", "metros"], ["g", "gramo", "gramos"],
  ],
  de: [
    ["km", "Kilometer"], ["kg", "Kilogramm"], ["cm", "Zentimeter"], ["mm", "Millimeter"],
    ["mg", "Milligramm"], ["ml", "Milliliter"], ["m", "Meter"], ["g", "Gramm"],
  ],
  fr: [
    ["km", "kilomètre", "kilomètres"], ["kg", "kilogramme", "kilogrammes"], ["cm", "centimètre", "centimètres"],
    ["mm", "millimètre", "millimètres"], ["mg", "milligramme", "milligrammes"], ["ml", "millilitre", "millilitres"],
    ["m", "mètre", "mètres"], ["g", "gramme", "grammes"],
  ],
};

// Alan, hacim ve hiz birimleri.
//   kare: [m², km², cm², mm²]   kup: [m³, km³, cm³]   hiz: [regex kaynagi, okunus] (km/s, m/s'den ONCE gelir)
const OLCU = {
  tr: {
    kare: ["metrekare", "kilometrekare", "santimetrekare", "milimetrekare"],
    kup: ["metreküp", "kilometreküp", "santimetreküp"],
    hiz: [["km\\/(?:sa|h)", "kilometre bölü saat"], ["km\\/s", "kilometre bölü saniye"], ["m\\/s", "metre bölü saniye"]],
  },
  en: {
    kare: ["square meters", "square kilometers", "square centimeters", "square millimeters"],
    kup: ["cubic meters", "cubic kilometers", "cubic centimeters"],
    hiz: [["km\\/h", "kilometers per hour"], ["km\\/s", "kilometers per second"], ["m\\/s", "meters per second"], ["mph", "miles per hour"]],
  },
  es: {
    kare: ["metros cuadrados", "kilómetros cuadrados", "centímetros cuadrados", "milímetros cuadrados"],
    kup: ["metros cúbicos", "kilómetros cúbicos", "centímetros cúbicos"],
    hiz: [["km\\/h", "kilómetros por hora"], ["km\\/s", "kilómetros por segundo"], ["m\\/s", "metros por segundo"], ["mph", "millas por hora"]],
  },
  de: {
    kare: ["Quadratmeter", "Quadratkilometer", "Quadratzentimeter", "Quadratmillimeter"],
    kup: ["Kubikmeter", "Kubikkilometer", "Kubikzentimeter"],
    hiz: [["km\\/h", "Kilometer pro Stunde"], ["km\\/s", "Kilometer pro Sekunde"], ["m\\/s", "Meter pro Sekunde"], ["mph", "Meilen pro Stunde"]],
  },
  fr: {
    kare: ["mètres carrés", "kilomètres carrés", "centimètres carrés", "millimètres carrés"],
    kup: ["mètres cubes", "kilomètres cubes", "centimètres cubes"],
    hiz: [["km\\/h", "kilomètres par heure"], ["km\\/s", "kilomètres par seconde"], ["m\\/s", "mètres par seconde"], ["mph", "miles par heure"]],
  },
};

const YUZDE = { tr: "yüzde", en: "percent", es: "por ciento", de: "Prozent", fr: "pour cent" };
const VE = { tr: "ve", en: "and", es: "y", de: "und", fr: "et" };
const DERECE = { tr: "derece", en: "degrees", es: "grados", de: "Grad", fr: "degrés" };
// [Celsius, Fahrenheit] — basinda bosluk var (sayiya yapismasin)
const DERECE_CF = {
  tr: [" santigrat derece", " fahrenhayt derece"],
  en: [" degrees Celsius", " degrees Fahrenheit"],
  es: [" grados Celsius", " grados Fahrenheit"],
  de: [" Grad Celsius", " Grad Fahrenheit"],
  fr: [" degrés Celsius", " degrés Fahrenheit"],
};
// "5 milyon", "5 million" ... para simgesinden sonra gelen olcek sozcukleri (regex kaynagi, uzun olan once).
// tr/en birlesik: eski davranis korunur.
const OLCEK = {
  tr: "million|billion|trillion|thousand|bin|milyon|milyar|trilyon",
  en: "million|billion|trillion|thousand|bin|milyon|milyar|trilyon",
  es: "mil millones|millones|millón|billones|billón|mil",
  de: "Millionen|Million|Milliarden|Milliarde|Billionen|Billion|Tausend",
  fr: "millions|million|milliards|milliard|billions|billion|mille",
};

// Kisaltma tablosu. [kaynak regex, yerine, cumleSonuModu?]  — nokta dahil kaynak yazilir.
const KISALTMA = {
  tr: [
    [String.raw`Dr\.`, "doktor"], [String.raw`Prof\.`, "profesör"], [String.raw`Doç\.`, "doçent"],
    [String.raw`Yrd\.`, "yardımcı"], [String.raw`Sn\.`, "sayın"],
    [String.raw`vb\.`, "ve benzeri", "c"], [String.raw`vs\.`, "vesaire", "c"],
    [String.raw`bkz\.`, "bakınız"], [String.raw`örn\.`, "örneğin"],
    [String.raw`yy\.`, "yüzyıl", "c"], [String.raw`M\.Ö\.`, "milattan önce"], [String.raw`M\.S\.`, "milattan sonra"],
  ],
  en: [
    [String.raw`Dr\.`, "Doctor"], [String.raw`Mr\.`, "Mister"], [String.raw`Mrs\.`, "Missus"],
    [String.raw`Prof\.`, "Professor"], [String.raw`Jr\.`, "Junior"], [String.raw`Sr\.`, "Senior"],
    [String.raw`vs\.`, "versus"], [String.raw`etc\.`, "et cetera", "c"],
    [String.raw`e\.g\.`, "for example"], [String.raw`i\.e\.`, "that is"],
    [String.raw`U\.S\.A\.`, "U S A", "s"], [String.raw`U\.S\.`, "United States", "s"],
    [String.raw`U\.K\.`, "United Kingdom", "s"], [String.raw`U\.N\.`, "United Nations", "s"],
    [String.raw`Inc\.`, "Incorporated", "s"], [String.raw`Ltd\.`, "Limited", "s"],
    [String.raw`approx\.`, "approximately"],
  ],
  // es/de/fr: belirsiz kisaltmalar (Fr., Pr., MM. = Roma rakami) BILEREK yok; "M." yalniz buyuk harfli adin onunde.
  es: [
    [String.raw`Dra\.`, "doctora"], [String.raw`Dr\.`, "doctor"], [String.raw`Sra\.`, "señora"],
    [String.raw`Srta\.`, "señorita"], [String.raw`Sr\.`, "señor"], [String.raw`Profa\.`, "profesora"], [String.raw`Prof\.`, "profesor"],
    [String.raw`etc\.`, "etcétera", "c"], [String.raw`aprox\.`, "aproximadamente"],
    [String.raw`a\.\s?C\.`, "antes de Cristo", "c"], [String.raw`d\.\s?C\.`, "después de Cristo", "c"],
    [String.raw`núm\.(?=\s*\d)`, "número"],
  ],
  de: [
    [String.raw`Dr\.`, "Doktor"], [String.raw`Prof\.`, "Professor"], [String.raw`Hr\.`, "Herr"],
    [String.raw`usw\.`, "und so weiter", "c"], [String.raw`bzw\.`, "beziehungsweise"], [String.raw`ggf\.`, "gegebenenfalls"],
    [String.raw`[zZ]\.\s?B\.`, "zum Beispiel"], [String.raw`[dD]\.\s?h\.`, "das heißt"],
    [String.raw`v\.\s?Chr\.`, "vor Christus", "c"], [String.raw`n\.\s?Chr\.`, "nach Christus", "c"],
    [String.raw`ca\.(?=\s*\d)`, "circa"], [String.raw`Nr\.(?=\s*\d)`, "Nummer"],
    [String.raw`Mio\.`, "Millionen"], [String.raw`Mrd\.`, "Milliarden"],
  ],
  fr: [
    [String.raw`Dr\.`, "docteur"], [String.raw`Mme\.?(?![\p{L}])`, "madame"], [String.raw`Mlle\.?(?![\p{L}])`, "mademoiselle"],
    [String.raw`M\.(?=\s+\p{Lu})`, "monsieur"],
    [String.raw`etc\.`, "et cetera", "c"], [String.raw`env\.(?=\s*\d)`, "environ"],
    [String.raw`p\.\s?ex\.`, "par exemple"], [String.raw`c\.-à-d\.`, "c'est-à-dire"],
    [String.raw`av\.\s?J\.-C\.`, "avant Jésus-Christ", "c"], [String.raw`apr\.\s?J\.-C\.`, "après Jésus-Christ", "c"],
  ],
};

// Para birimi: simge -> [tekil, cogul]. tr/de'de birim sayiya gore degismez.
const PARA = {
  tr: { "$": ["dolar", "dolar"], "€": ["avro", "avro"], "£": ["sterlin", "sterlin"], "₺": ["lira", "lira"] },
  en: { "$": ["dollar", "dollars"], "€": ["euro", "euros"], "£": ["pound", "pounds"], "₺": ["lira", "lira"] },
  es: { "$": ["dólar", "dólares"], "€": ["euro", "euros"], "£": ["libra", "libras"], "₺": ["lira", "liras"] },
  de: { "$": ["Dollar", "Dollar"], "€": ["Euro", "Euro"], "£": ["Pfund", "Pfund"], "₺": ["Lira", "Lira"] },
  fr: { "$": ["dollar", "dollars"], "€": ["euro", "euros"], "£": ["livre", "livres"], "₺": ["livre turque", "livres turques"] },
};

// Birim/para cogul mu? en/es: yalniz "1" tekil. fr: 0 ve 1,x tekil ("1,5 kilometre"), 2 ve ustu cogul.
function cogulMu(say, dil) {
  const s = String(say);
  if (dil === "fr") return !/^[01](?:,\d+)?$/.test(s);
  return s !== "1";
}

// olcekli: "$5 million" -> "5 million dollars" (olcek sozcugu varken para HER ZAMAN cogul: "1 million dollars")
function paraAdi(sembol, dil, sayi, olcekli) {
  const p = (PARA[dil] || PARA.en)[sembol];
  if (!p) return "";
  return olcekli || cogulMu(sayi, dil) ? p[1] : p[0];
}

// ---------------------------------------------------------------------------
// Okunus sozlugu (konu.json "okunus"): {"GPU":"G P U"} — kelime siniri gozeterek, buyuk/kucuk duyarli.
// ---------------------------------------------------------------------------
function okunusUygula(metin, sozluk) {
  if (!sozluk || typeof sozluk !== "object") return metin;
  const anahtarlar = Object.keys(sozluk)
    .filter(k => k && typeof sozluk[k] === "string")
    .sort((a, b) => b.length - a.length);                 // uzun anahtar once ("GPU-2" > "GPU")
  let m = metin;
  for (const k of anahtarlar.slice(0, 200)) {
    const re = new RegExp("(?<![\\p{L}\\p{N}_])" + reKacis(k) + "(?![\\p{L}\\p{N}_])", "gu");
    m = m.replace(re, () => sozluk[k]);
  }
  return m;
}

// ---------------------------------------------------------------------------
// ANA FONKSIYON
//   metniHazirla(metin, dil, okunus)            -> XML kacisli TTS metni (sozlesme)
//   metniHazirla(metin, dil, okunus, {xml:false}) -> kacissiz DUZ okunan metin (okunanMetin)
//   secenek.telaffuzPaketi === false -> Turkce telaffuz paketi kapali (yalniz kullanici sozlugu)
// ---------------------------------------------------------------------------
const paketAcikMi = (dil, secenek) => String(dil || "en").toLowerCase().slice(0, 2) === "tr" && !(secenek && secenek.telaffuzPaketi === false);

function metniHazirla(metin, dil, okunus, secenek) {
  const xml = !(secenek && secenek.xml === false);
  const d = String(dil || "en").toLowerCase().slice(0, 2);
  let m = String(metin == null ? "" : metin).replace(/\r\n?/g, "\n");

  // XML 1.0'da gecersiz kontrol karakterleri ve sifir genislikli isaretler
  m = m.replace(GIZLI, "");
  m = m.replace(/\s*\n\s*/g, " ");

  m = paketAcikMi(d, secenek) ? telaffuz.uygula(m, okunus) : okunusUygula(m, okunus);

  // ---- yuzde, para, derece, birim (rakamlar henuz rakam: sayi gecisi SONRA) ----
  if (YUZDE[d]) {
    const yz = YUZDE[d];
    if (d === "tr") {                                    // Turkce: "yüzde on beş" (sayidan ONCE)
      m = m.replace(new RegExp("%\\s*(" + SAYI + ")", "g"), (_, s) => `${yz} ${s}`)
           .replace(new RegExp("(" + SAYI + ")\\s*%", "g"), (_, s) => `${yz} ${s}`);
    } else {
      m = m.replace(new RegExp("(" + SAYI + ")\\s*%", "g"), (_, s) => `${s} ${yz}`)
           .replace(new RegExp("%\\s*(" + SAYI + ")", "g"), (_, s) => `${s} ${yz}`);
    }
    m = m.replace(/%/g, ` ${yz} `);
  }
  if (VE[d]) m = m.replace(/(\s)&(\s)/g, `$1${VE[d]}$2`);
  m = m.replace(/\s*(?:→|->|=>)\s*/g, ", ");

  if (OLCU[d]) {                                         // tr, en, es, de, fr
    const tr = d === "tr";
    // numara isareti: fr "n° 5" / es "nº 5", "n.º 5" — derece isaretinden ONCE, yoksa "n degrés 5" olur
    if (d === "fr") m = m.replace(/(?<![\p{L}\p{N}])[nN]°\s*(?=\d)/gu, "numéro ");
    if (d === "es") m = m.replace(/(?<![\p{L}\p{N}])[nN]\.?[º°]\s*(?=\d)/gu, "número ");

    // para: $5 | 5$ | $5 million  (olcek sozcugu varken para cogul okunur)
    // es/fr: "5 millones DE dolares", "5 millions DE dollars" (mil/mille ve de/tr/en'de "de" gerekmez)
    const deIster = olcek => (d === "es" || d === "fr") && /mill?i?[oó]n|milliard|billi?[oó]n/i.test(olcek || "");
    m = m.replace(new RegExp("([$€£₺])\\s?(" + SAYI + ")(\\s*(?:" + OLCEK[d] + ")(?![\\p{L}\\p{N}_]))?", "giu"),
      (_, sb, say, olcek) => `${say}${olcek || ""}${deIster(olcek) ? " de" : ""} ${paraAdi(sb, d, say, !!olcek)}`);
    m = m.replace(new RegExp("(" + SAYI + ")\\s?([$€£₺])", "g"), (_, say, sb) => `${say} ${paraAdi(sb, d, say)}`);
    if (tr) m = m.replace(new RegExp("(" + SAYI + ")\\s*TL\\b", "g"), "$1 lira");

    // derece
    m = m.replace(/℃/g, "°C").replace(/℉/g, "°F");
    m = m.replace(/°\s*C\b/g, DERECE_CF[d][0])
         .replace(/°\s*F\b/g, DERECE_CF[d][1])
         .replace(/[°º]/g, " " + DERECE[d]);

    // alan, hacim, hiz
    const O = OLCU[d];
    // Birimin onunde HARF olmamali ama RAKAM olabilir: "120m²", "90km/sa" (bosluksuz yazim) da cevrilir.
    // (\b rakamla harf arasinda sinir saymaz; eskiden "120m²" ve "300km/s" oldugu gibi kaliyordu.)
    // Yerine bosluk konur: "120 metrekare" -> sayi asagida sozcuge cevrilir.
    const BIRIM_ON = String.raw`(?<![\p{L}_])`, BIRIM_ARKA = String.raw`(?![\p{L}\p{N}_])`;
    const birimDegistir = (kaynak, yerine) => { m = m.replace(new RegExp(BIRIM_ON + kaynak + BIRIM_ARKA, "gu"), " " + yerine); };
    birimDegistir("km²", O.kare[1]); birimDegistir("cm²", O.kare[2]); birimDegistir("mm²", O.kare[3]); birimDegistir("m²", O.kare[0]);
    birimDegistir("km³", O.kup[1]); birimDegistir("cm³", O.kup[2]); birimDegistir("m³", O.kup[0]);
    for (const [kaynak, yerine] of O.hiz) birimDegistir(kaynak, yerine);
    // sayidan sonra gelen duz birimler (5 km, 70 kg). "m" yalniz sonrasinda harf yoksa.
    for (const [kisa, tekil, cogul] of BIRIM[d]) {
      const re = new RegExp("(" + SAYI + String.raw`)\s?${kisa}(?![\p{L}\p{N}/²³])`, "gu");
      m = m.replace(re, (_, say) => `${say} ${cogul !== undefined && cogulMu(say, d) ? cogul : tekil}`);
    }

    // kisaltmalar
    for (const [kaynak, yerine, mod] of KISALTMA[d]) {
      const onek = String.raw`(?<![\p{L}\p{N}])`;
      if (mod) m = m.replace(new RegExp(onek + kaynak + CUMLE_SONU[mod], "gu"), yerine + ".");
      m = m.replace(new RegExp(onek + kaynak, "gu"), yerine);
    }
    if (tr) {
      m = m.replace(/(?<![\p{L}\p{N}])M\.?Ö\.?\s*(?=\d)/gu, "milattan önce ")
           .replace(/(?<![\p{L}\p{N}])MS\s+(?=\d{2,4}(?!\d))/gu, "milattan sonra ")
           .replace(/(?<![\p{L}\p{N}])No\.\s*(?=\d)/gu, "numara ");
    } else if (d === "en") {
      m = m.replace(/(?<![\p{L}\p{N}])No\.\s*(?=\d)/gu, "number ");
    }
  }

  // ---- sayilar: yalniz Turkce'de sozcuge cevrilir (Ingilizce motor rakami dogru okuyor) ----
  if (d === "tr") {
    // tarih  05.10.2026  ->  5 Ekim 2026
    m = m.replace(/(?<!\d[.,/]?)(\d{1,2})[./](\d{1,2})[./](\d{4})(?![.,/]?\d)/g, (t, g, a, y) => {
      const ay = Number(a);
      if (ay < 1 || ay > 12 || Number(g) < 1 || Number(g) > 31) return t;
      return `${Number(g)} ${AY_TR[ay]} ${y}`;
    });
    // saat: "Saat 14.30'da" / "saat 9:05'te" -> "Saat on dört otuzda" / "saat dokuz sıfır beşte".
    // YALNIZ "saat" baglaminda (baglamsiz "14.30" ondalik sayi olabilir: 3.14). ":00" dakikasi okunmaz ("saat on dört").
    // Ek kesme isareti dusurulur (sayi gecisindeki gibi); ek yazarin yazdigi biciminde kalir ("14.00'te" -> "on dörtte").
    m = m.replace(/(?<![\p{L}\p{N}_])(saat)\s+([01]?\d|2[0-3])[.:]([0-5]\d)(?![.,:]?\d)(?:['’]([\p{L}]+))?/giu, (t, saat, s, dk, ek) => {
      const dakika = dk === "00" ? "" : " " + (dk[0] === "0" ? "sıfır " + trSayi(dk[1]) : trSayi(dk));
      return saat + " " + trSayi(s) + dakika + (ek || "");
    });
    // sira sayisi: "3. dunya" (devaminda kucuk harf varsa) -> "ucuncu"
    m = m.replace(/(?<![\d.,])(\d{1,4})\.(?=\s+[a-zçğıöşü])/g, (t, s) => trSira(s) || t);
    // tum sayilar (ek varsa kesme isareti dusurulur: 1923'te -> ... uce degil, "uc'te" -> "ucte")
    m = m.replace(/(?<![\p{L}\p{N}_])(\d[\d.,]*\d|\d)(?:['’]([\p{L}]+))?(?![\p{L}\p{N}_])/gu, (t, s, ek) => {
      const t2 = trSayiMetni(s);
      if (t2 === null) return t;
      return t2 + (ek ? ek : "");
    });
  }

  // kalan "&" ('AT&T') ve fazla bosluklar
  m = m.replace(/[ \t]{2,}/g, " ").replace(/\s+([,.;:!?])/g, "$1").trim();

  return xml ? xmlKacis(m) : m;
}

// Okunus kurallari/sozlugu ozeti: degisirse eski sesler "guncel degil" sayilir.
//   secenek {dil, telaffuzPaketi}: Turkce + paket acikken paket surumu ve sozluk ozeti de girer (paket acilip
//   kapaninca ya da sozluk degisince Turkce sesler yeniden uretilir). Diger dillerde ozet eskisiyle AYNI kalir.
function hazirlikOzeti(okunus, secenek) {
  const o = okunus && typeof okunus === "object" ? okunus : {};
  const sirali = Object.keys(o).sort().map(k => [k, o[k]]);
  const govde = { s: HAZIRLIK_SURUMU, o: sirali };
  if (secenek && paketAcikMi(secenek.dil, secenek)) govde.p = telaffuz.paketOzeti();
  return crypto.createHash("sha1").update(JSON.stringify(govde)).digest("hex").slice(0, 8);
}

// ---------------------------------------------------------------------------
// Uzun metni cumle sinirinda ~maks karakterlik parcalara bol.
// ---------------------------------------------------------------------------
function cumlelereAyir(metin) {
  return String(metin).split(/(?<=[.!?…]["'”’)\]]*)\s+/u).filter(Boolean);
}

function sert(metin, maks) {                // cumle bile maks'i asiyorsa virgulde, sonra bosluktan
  if (metin.length <= maks) return [metin];
  const parcalar = [];
  let kalan = metin;
  while (kalan.length > maks) {
    // noktalama parcanin SONUNA kalir: konumu en cok maks-1 olmali (maks'ta olursa parca maks+1 karakter olurdu)
    let kes = Math.max(kalan.lastIndexOf(", ", maks - 1), kalan.lastIndexOf("; ", maks - 1), kalan.lastIndexOf(": ", maks - 1));
    if (kes < maks * 0.3) kes = kalan.lastIndexOf(" ", maks);
    if (kes < 1) kes = maks - 1;
    parcalar.push(kalan.slice(0, kes + 1).trim());
    kalan = kalan.slice(kes + 1).trim();
  }
  if (kalan) parcalar.push(kalan);
  return parcalar;
}

function uzunMetniBol(metin, maks) {
  const sinir = maks || 1500;
  const t = String(metin).trim();
  if (t.length <= sinir) return [t];
  const parcalar = [];
  let cur = "";
  for (const c of cumlelereAyir(t).flatMap(x => sert(x, sinir))) {
    if (cur && (cur + " " + c).length > sinir) { parcalar.push(cur); cur = c; }
    else cur = cur ? cur + " " + c : c;
  }
  if (cur) parcalar.push(cur);
  return parcalar;
}

module.exports = {
  HAZIRLIK_SURUMU, xmlKacis, kelimeler, kelimeSay, metniHazirla, okunusUygula, hazirlikOzeti,
  uzunMetniBol, trSayi, trSayiMetni, trSira, bomAt,
};
