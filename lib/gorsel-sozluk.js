// TURKCE -> INGILIZCE GORSEL SOZLUGU (GO grubu) — saf fonksiyonlar, ag/dosya YOK.
//
// Otomatik arama YEDEGI icindir: Turkce senaryodaki SOMUT, gorsellenebilir isimleri (gok cisimleri, doga, hayvan, yapi,
// nesne) Ingilizce karsiligina cevirir. Wikimedia/Openverse/NASA Turkce aramada zayif sonuc verir ("Dünya" -> Dunya Kupasi
// bileti); "Earth"/"Moon"/"crater" isabetlidir. Asil yol, senaryoyu yazan ajanin Voice/ARAMALAR.txt dosyasidir; bu sozluk
// yalnizca o dosya yoksa (ya da bir paragrafin satiri yoksa) devreye girer.
//   - ekli bicimler cozulur: "kraterleri" -> krater, "deliğin" -> delik (unsuz yumusamasi), "şehrin" -> şehr (unlu dusmesi,
//     ayri anahtar). Ek dizisi TR_EK ile dogrulanir: "yıldız" "yıl"+"dız" diye bolunmez.
//   - BILEREK kucuk: belirsiz kisa kokler yok (ay = ay/Ay, kar = kar/kâr, yol, top, kan, fil, ada, baş, taş, mum...).
//   - ozel adlar yalnizca BUYUK harfle: "Ay'ın" ya da cumle ortasinda "Ay" -> Moon, "Dünya'nın" -> Earth, "Mısır" -> Egypt
//     (kucuk "mısır" misirdir). "Ay"/"Dünya" cumle basinda yaziliysa ve senaryoda kucuk "ay/dünya" da geciyorsa
//     (ay = 30 gun, dünya = alem) cevrilmez.
//   - iki kelimelik kavramlar once: "kara delik" -> black hole ("kara" tek basina "kar"+"a" diye karlanmaz),
//     "kutup ayısı" -> polar bear, "Dünya Kupası" -> FIFA World Cup (Earth DEGIL).
"use strict";

const kucukTr = s => String(s).toLocaleLowerCase("tr");
const UNLU_BAS = /^[aeıioöuü]/;

// Ek dizisi: [cokluk][iyelik][hal][ek-fiil]. Yalnizca bir kokten SONRA gelen kisim icin.
const TR_EK = new RegExp("^(?:l[ae]r)?" +
  "(?:[ıiuü]?m(?:[ıiuü]z)?|[ıiuü]?n(?:[ıiuü]z)?|s?[ıiuü]|l[ae]r[ıi])?" +
  "(?:y?[ıiuü]|n[ıiuü]|y?[ae]|n[ae]|n?[dt][ae](?:n|ki)?|n?[ıiuü]n(?:ki)?|y?l[ae]|n?[cç][ae]|ki)?" +
  "(?:[dt][ıiuü]r|y?[dt][ıiuü]|y?m[ıiuü]ş|y?s[ae])?$", "u");
const YUMUSAMA = { b: "p", c: "ç", d: "t", "ğ": "k", g: "k" };
const MIN_KOK = 3;

// Kelimenin olasi kokleri: once kendisi, sonra uzun kokten kisaya (ek dizisi gecerliyse). -> [kok...]
const _kokOnbellek = new Map();
function kokler(kelime) {
  const w = kucukTr(kelime);
  const var_ = _kokOnbellek.get(w);
  if (var_) return var_;
  const l = [w];
  for (let k = w.length - 1; k >= MIN_KOK; k--) {
    const ek = w.slice(k);
    if (!TR_EK.test(ek)) continue;
    const kok = w.slice(0, k);
    if (!l.includes(kok)) l.push(kok);
    const son = kok[kok.length - 1];
    if (UNLU_BAS.test(ek) && YUMUSAMA[son]) {
      const y = kok.slice(0, -1) + YUMUSAMA[son];
      if (!l.includes(y)) l.push(y);
    }
  }
  if (_kokOnbellek.size > 5000) _kokOnbellek.clear();
  _kokOnbellek.set(w, l);
  return l;
}

// ---------------------------------------------------------------- sozluk
// Ekli bicimleri de cozulen kokler (kok -> Ingilizce arama terimi). Unlu dusmeli kokler ayri anahtar: şehr, nehr, beyn.
const SOZLUK = new Map(Object.entries({
  // gok / uzay
  gezegen: "planet", "yıldız": "star", galaksi: "galaxy", gökada: "galaxy", bulutsu: "nebula", nebula: "nebula",
  evren: "universe", uzay: "outer space", "göktaşı": "meteorite", meteor: "meteor", asteroit: "asteroid", asteroid: "asteroid",
  krater: "crater", "yörünge": "orbit", uydu: "satellite", roket: "rocket", astronot: "astronaut", teleskop: "telescope",
  "gözlemevi": "observatory", tutulma: "eclipse", dolunay: "full moon", hilal: "crescent moon", "gökyüzü": "sky",
  "günbatımı": "sunset", "gündoğumu": "sunrise", "şafak": "dawn", aurora: "aurora", "güneş": "sun",
  // yer / doga
  "dağ": "mountain", tepe: "hill", volkan: "volcano", "yanardağ": "volcano", lav: "lava", magma: "magma", deniz: "sea",
  "göl": "lake", nehir: "river", nehr: "river", "ırmak": "river", "şelale": "waterfall", orman: "forest", "ağaç": "tree",
  "çiçek": "flower", yaprak: "leaf", "çöl": "desert", kum: "sand", kumsal: "beach", buz: "ice", buzul: "glacier",
  "buzdağı": "iceberg", "yağmur": "rain", "fırtına": "storm", "şimşek": "lightning", "yıldırım": "lightning",
  "kasırga": "hurricane", hortum: "tornado", bulut: "cloud", "gökkuşağı": "rainbow", deprem: "earthquake",
  tsunami: "tsunami", "mağara": "cave", sahil: "beach", plaj: "beach", "kıyı": "coast", kaya: "rock", "uçurum": "cliff",
  toprak: "soil", "çamur": "mud", vadi: "valley", kanyon: "canyon", okyanus: "ocean", dalga: "ocean wave",
  mercan: "coral reef", resif: "reef", "rüzgar": "wind", "rüzgâr": "wind", atmosfer: "atmosphere", kristal: "crystal",
  elmas: "diamond", "altın": "gold", "gümüş": "silver", "ateş": "fire", alev: "flame", duman: "smoke", mantar: "mushroom",
  yosun: "moss",
  // canlilar
  aslan: "lion", kaplan: "tiger", "ayılar": "bear", kurt: "wolf", tilki: "fox", kartal: "eagle", "şahin": "hawk", "baykuş": "owl",
  kedi: "cat", "köpek": "dog", "zürafa": "giraffe", zebra: "zebra", maymun: "monkey", goril: "gorilla", balina: "whale",
  yunus: "dolphin", "köpekbalığı": "shark", ahtapot: "octopus", "balık": "fish", "kuş": "bird", "arı": "bee",
  kelebek: "butterfly", "karınca": "ant", "örümcek": "spider", "yılan": "snake", "kaplumbağa": "turtle", timsah: "crocodile",
  penguen: "penguin", dinozor: "dinosaur", inek: "cow", koyun: "sheep", "keçi": "goat", tavuk: "chicken", "böcek": "insect",
  deve: "camel", geyik: "deer", sincap: "squirrel", "tavşan": "rabbit", "kurbağa": "frog", "papağan": "parrot",
  denizanası: "jellyfish",
  // insan / beden
  beyin: "brain", beyn: "brain", kalp: "heart", "göz": "eye", iskelet: "skeleton", kemik: "bone", "hücre": "cell",
  bebek: "baby", "çocuk": "child", "kadın": "woman", asker: "soldier", ordu: "army", doktor: "doctor", "şövalye": "knight",
  kral: "king", "kraliçe": "queen", firavun: "pharaoh", imparator: "emperor", "savaşçı": "warrior", samuray: "samurai",
  viking: "viking", mumya: "mummy", parmak: "finger",
  // yapilar / yerler
  "şehir": "city", "şehr": "city", kent: "city", "köy": "village", bina: "building", "gökdelen": "skyscraper", kule: "tower",
  "köprü": "bridge", kale: "castle", saray: "palace", "tapınak": "temple", piramit: "pyramid", cami: "mosque",
  kilise: "church", katedral: "cathedral", harabe: "ruins", liman: "harbor", duvar: "wall", mezar: "tomb",
  // tasitlar / nesneler
  gemi: "ship", tekne: "boat", "denizaltı": "submarine", "uçak": "airplane", tren: "train", araba: "car",
  otomobil: "car", bisiklet: "bicycle", robot: "robot", bilgisayar: "computer", telefon: "smartphone", mikroskop: "microscope",
  laboratuvar: "laboratory", fabrika: "factory", "kütüphane": "library", kitap: "book", para: "money", "kılıç": "sword",
  kalkan: "shield", lamba: "lamp", stadyum: "stadium", kupa: "trophy", bayrak: "flag",
  // yiyecek
  ekmek: "bread", peynir: "cheese", elma: "apple", kahve: "coffee", "çikolata": "chocolate", pasta: "cake", meyve: "fruit",
  sebze: "vegetables", pizza: "pizza", "fındık": "hazelnut",
  // fiil cekimine benzeyen somut isimler (TR_FIIL "-mek"/"-ecek"/"-düğü" kaliplari bunlari terim olmaktan cikarmasin)
  yemek: "food", yiyecek: "food", "içecek": "drink", "düğün": "wedding", mercimek: "lentils",
}));

// Yalnizca TAM bicimiyle eslesenler (kisa ya da ekli bicimi belirsiz kokler)
const TAM = new Map(Object.entries({
  "ayı": "bear", su: "water", suyu: "water", suda: "water", suyun: "water", sular: "water", "suların": "water",
  ev: "house", evi: "house", evde: "house", evler: "houses", evleri: "houses", evin: "house",
}));

// Hic cozulmeyecek bicimler ("ayın" = ayın/ayının degil, "altına" = alt yonu)
const BLOK = new Set(["ayın", "ayına", "ayında", "ayını", "altına", "altında", "altından", "altındaki", "parça", "parçası"]);

// Iki kelimelik kavramlar: "kok1 kok2" -> terim (ikinci kelime ekli olabilir: "kara deliğin", "Güneş Sistemi'nde")
const IKILI = new Map(Object.entries({
  "kara delik": "black hole", "nötron yıldız": "neutron star", "güneş sistem": "solar system", "güneş tutulma": "solar eclipse",
  "ay tutulma": "lunar eclipse", "kuyruklu yıldız": "comet", "uzay istasyon": "space station", "uzay mekik": "space shuttle",
  "uzay sonda": "space probe", "uzay araç": "spacecraft", "ay yüzey": "lunar surface", "ay krater": "moon crater",
  "deniz fener": "lighthouse", "kutup ayı": "polar bear", "boz ayı": "brown bear", "bilim insan": "scientist",
  "yağmur orman": "rainforest", "kutup ışık": "aurora", "gün batım": "sunset", "gün doğum": "sunrise",
  "büyük patlama": "Big Bang", "mavi balina": "blue whale", "beyaz cüce": "white dwarf star", "kırmızı dev": "red giant star",
  "solucan delik": "wormhole", "deniz yıldız": "starfish", "deniz kaplumbağa": "sea turtle", "köpek balık": "shark",
  // "zaman"/"saat" tek basina dolgu sayilir (SECIM_DISI_TR); kavramin parcasiyken somut aramadir
  "zaman yolculuk": "time travel", "zaman makine": "time machine", "uzay zaman": "spacetime", "saat kule": "clock tower",
  "kum saat": "hourglass",
}));

// Ozel adlar (yalnizca BUYUK harfle yazildiginda). belirsiz: cumle basinda + senaryoda kucuk bicim varsa cevrilmez.
const OZEL = new Map(Object.entries({
  ay: { en: "Moon", belirsiz: true, kucuk: ["ay", "aylar", "ayda", "aydır", "aylık", "aylarca", "aylarda", "ayları", "aylardır"] },
  "dünya": { en: "Earth", belirsiz: true, kucuk: ["dünya", "dünyada", "dünyanın", "dünyaya", "dünyayı", "dünyadaki", "dünyamız", "dünyamızın", "dünyamızda"] },
  "güneş": { en: "Sun" }, "merkür": { en: "planet Mercury" }, "venüs": { en: "planet Venus" }, mars: { en: "planet Mars" },
  "jüpiter": { en: "planet Jupiter" }, "satürn": { en: "planet Saturn" }, "uranüs": { en: "planet Uranus" },
  "neptün": { en: "planet Neptune" }, "plüton": { en: "Pluto" }, samanyolu: { en: "Milky Way" },
  andromeda: { en: "Andromeda Galaxy" },
  "mısır": { en: "Egypt" }, yunanistan: { en: "Greece" }, italya: { en: "Italy" }, ispanya: { en: "Spain" },
  fransa: { en: "France" }, almanya: { en: "Germany" }, "ingiltere": { en: "England" }, rusya: { en: "Russia" },
  "çin": { en: "China" }, japonya: { en: "Japan" }, hindistan: { en: "India" }, amerika: { en: "America" },
  afrika: { en: "Africa" }, avrupa: { en: "Europe" }, asya: { en: "Asia" }, antarktika: { en: "Antarctica" },
  avustralya: { en: "Australia" }, brezilya: { en: "Brazil" }, meksika: { en: "Mexico" }, kanada: { en: "Canada" },
  "norveç": { en: "Norway" }, "isveç": { en: "Sweden" }, izlanda: { en: "Iceland" }, "grönland": { en: "Greenland" },
  hollanda: { en: "Netherlands" }, portekiz: { en: "Portugal" }, suriye: { en: "Syria" }, akdeniz: { en: "Mediterranean Sea" },
  karadeniz: { en: "Black Sea" }, ege: { en: "Aegean Sea" }, "kızıldeniz": { en: "Red Sea" }, sahra: { en: "Sahara desert" },
  nil: { en: "Nile river" }, alpler: { en: "Alps" }, himalayalar: { en: "Himalayas" }, roma: { en: "Rome" },
  "osmanlı": { en: "Ottoman Empire" }, bizans: { en: "Byzantine Empire" }, mezopotamya: { en: "Mesopotamia" },
  truva: { en: "Troy" },
}));
// Cok kelimeli ozel adlar (kucuk taban bicimleriyle; kesme sonrasi ek atilir: "Kuzey Kutbu'nda")
const OZEL_COK = new Map(Object.entries({
  "kuzey kutbu": "North Pole", "güney kutbu": "South Pole", "dünya kupası": "FIFA World Cup", "atlas okyanusu": "Atlantic Ocean",
  "hint okyanusu": "Indian Ocean", "büyük okyanus": "Pacific Ocean", "pasifik okyanusu": "Pacific Ocean",
  "roma imparatorluğu": "Roman Empire", "osmanlı imparatorluğu": "Ottoman Empire", "çin seddi": "Great Wall of China",
  "mısır piramitleri": "Pyramids of Giza", "beyaz saray": "White House", "kızıl gezegen": "planet Mars",
  "sovyetler birliği": "Soviet Union",
}));

// Kucuk harfli kelime -> {en, kok} | null (ozel adlar HARIC; onlar buyuk harf ister)
function cevir(kelime) {
  const w = kucukTr(kelime);
  if (!w || BLOK.has(w)) return null;
  if (TAM.has(w)) return { en: TAM.get(w), kok: w };
  if (w.length < MIN_KOK) return null;
  for (const k of kokler(w)) if (SOZLUK.has(k)) return { en: SOZLUK.get(k), kok: k };
  return null;
}

// ---------------------------------------------------------------- belirtecler
// -> [{ham, taban, kucuk, kesme, buyuk, basta, bas, son}]  (taban: kesmeden onceki kisim; basta: cumle basinda)
const RE_BELIRTEC = /[\p{L}\p{N}]+(?:['’]\p{L}+)?/gu;
function belirtecler(metin) {
  const t = String(metin == null ? "" : metin);
  const l = [];
  let m, onceki = 0;
  RE_BELIRTEC.lastIndex = 0;
  while ((m = RE_BELIRTEC.exec(t)) !== null) {
    const ham = m[0];
    const taban = ham.split(/['’]/)[0];
    const ara = t.slice(onceki, m.index);
    l.push({ ham, taban, kucuk: kucukTr(taban), kesme: ham.length > taban.length, buyuk: /^\p{Lu}/u.test(taban),
      basta: !l.length || /[.!?…]|\n/.test(ara), bas: m.index, son: m.index + ham.length });
    onceki = m.index + ham.length;
  }
  return l;
}

// Belirsiz ozel ad ("Ay", "Dünya") bu belirtecte gercekten gok cismi mi?
const _kucukRe = new Map();
function ozelGecerli(e, b, senaryo) {
  if (!e.belirsiz || b.kesme || !b.basta) return true;
  const anahtar = e.kucuk.join("|");
  let re = _kucukRe.get(anahtar);
  if (!re) { re = new RegExp("(?<![\\p{L}\\p{N}])(?:" + anahtar + ")(?![\\p{L}\\p{N}'’])", "u"); _kucukRe.set(anahtar, re); }
  return !re.test(String(senaryo || ""));
}

// ---------------------------------------------------------------- paragraftaki Ingilizce terimler
// secenek: {senaryo (belirsiz ozel adlar icin tum metin), durakMi(kucukKelime) -> bool}
// -> {liste:[{en, tur:"ozel"|"ikili"|"tekil", sayi, ilk, tr}], tuketilen:Set(kucuk taban)}
//    Sira: ozel adlar > iki kelimelik kavramlar > tek kelimeler; her grupta cok gecen ve once gecen once.
function terimler(paragraf, secenek) {
  const o = secenek || {};
  const durak = o.durakMi || (() => false);
  const senaryo = o.senaryo !== undefined ? o.senaryo : paragraf;
  const b = belirtecler(paragraf);
  const kullanildi = new Array(b.length).fill(false);
  const bulunan = new Map();
  const tuketilen = new Set();
  const ekle = (en, tur, i, adet) => {
    const k = en.toLowerCase();
    const var_ = bulunan.get(k);
    if (var_) var_.sayi++;
    else bulunan.set(k, { en, tur, sayi: 1, ilk: i, tr: b.slice(i, i + adet).map(x => x.taban).join(" ") });
    for (let j = i; j < i + adet; j++) { kullanildi[j] = true; tuketilen.add(b[j].kucuk); }
  };
  // 1) cok kelimeli ozel adlar
  for (let i = 0; i + 1 < b.length; i++) {
    if (kullanildi[i] || kullanildi[i + 1] || b[i + 1].basta) continue;      // cumle sinirini asmaz
    const en = OZEL_COK.get(b[i].kucuk + " " + b[i + 1].kucuk);
    if (en) ekle(en, "ozel", i, 2);
  }
  // 2) iki kelimelik kavramlar (buyuk/kucuk harf farketmez). Ilk kelime kesmeliyse yalniz ozel ad olabilir ("Ay'ın yüzeyi").
  for (let i = 0; i + 1 < b.length; i++) {
    if (kullanildi[i] || kullanildi[i + 1] || b[i + 1].basta || (b[i].kesme && !OZEL.has(b[i].kucuk))) continue;
    let en = null;
    for (const k1 of kokler(b[i].kucuk)) {
      for (const k2 of kokler(b[i + 1].kucuk)) { en = IKILI.get(k1 + " " + k2); if (en) break; }
      if (en) break;
    }
    if (en) ekle(en, "ikili", i, 2);
  }
  // 3) tek kelimelik ozel adlar: yalniz BUYUK harfle
  for (let i = 0; i < b.length; i++) {
    if (kullanildi[i] || !b[i].buyuk) continue;
    const e = OZEL.get(b[i].kucuk);
    if (e && ozelGecerli(e, b[i], senaryo)) ekle(e.en, "ozel", i, 1);
  }
  // 4) somut isimler: kucuk harfli ya da cumle basinda buyuk harfli (cumle ortasindaki buyuk harf ozel adin parcasidir:
  //    "Galata Kulesi", "Yunus Emre" -> tower/dolphin DEGIL)
  for (let i = 0; i < b.length; i++) {
    if (kullanildi[i] || (b[i].buyuk && !b[i].basta) || durak(b[i].kucuk)) continue;
    // cumle basindaki buyuk harfli kelimeyi yine buyuk harfli bir kelime izliyorsa cok kelimeli ozel adin basidir
    // ("Yunus Emre 13. yüzyılda..." -> dolphin DEGIL, "Kartal Kalesi" -> eagle DEGIL)
    if (b[i].buyuk && b[i + 1] && b[i + 1].buyuk && !b[i + 1].basta) continue;
    const c = cevir(b[i].kucuk);
    if (c) ekle(c.en, "tekil", i, 1);
  }
  const SIRA = { ozel: 0, ikili: 1, tekil: 2 };
  const liste = [...bulunan.values()].sort((x, y) => (SIRA[x.tur] - SIRA[y.tur]) || (y.sayi - x.sayi) || (x.ilk - y.ilk));
  return { liste, tuketilen };
}

// Senaryoda ozel ad oldugu KANITLANAN kelimeler (kucuk taban): cumle ortasinda buyuk harfle ya da kesmeyle ("Einstein'ın")
// yazilanlar. Cumle basindaki tek buyuk harfli kelime ("Arka yüzünü...") bu kumede yoksa ozel ad sayilmaz.
// En az iki cumlenin basinda buyuk yazilip senaryoda hic kucuk gecmeyen kelime de kanittir ("Napolyon 1812'de... Napolyon
// bu yenilgiden sonra..."): Turkcede ozne cogunlukla cumle basindadir.
function ozelKanitlari(senaryo) {
  const k = new Set(), bas = new Map(), kucukGecen = new Set();
  for (const b of belirtecler(senaryo)) {
    if (!b.buyuk) { kucukGecen.add(b.kucuk); continue; }
    if (b.kesme || !b.basta) k.add(b.kucuk);
    else bas.set(b.kucuk, (bas.get(b.kucuk) || 0) + 1);
  }
  for (const [w, n] of bas) if (n >= 2 && !kucukGecen.has(w)) k.add(w);
  return k;
}

module.exports = { kucukTr, kokler, cevir, terimler, belirtecler, ozelKanitlari, ozelGecerli, TR_EK, SOZLUK, TAM, IKILI, OZEL, OZEL_COK, BLOK };
