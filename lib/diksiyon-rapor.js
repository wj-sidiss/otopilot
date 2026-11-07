// lib/diksiyon-rapor.js — senaryo metnindeki telaffuz/diksiyon risklerini satir numarasiyla listeler (diksiyon.js,
// ses-uret ozet satiri). Metni DEGISTIRMEZ; yalniz rapor eder. Emin olunmayan her durum burada UYARI olarak kalir,
// otomatik duzeltme yalniz lib/telaffuz.js'te (sozluk + "Merhaba!").
//
// Risk turleri:
//   yabanci     okunusu tanimsiz, yabanci gorunen kelime (q/w/x, "th", "sh", "ck", ic buyuk harf, yabanci harf...)
//   uzun-cumle  esikten (varsayilan 28) uzun cumle: tonlama duzlesir, nefes yeri kalmaz
//   sapka       sapka belirsizligi (hala/hâlâ, kar/kâr, alem/âlem...): motor yanlis anlami okuyabilir
//   once        (yalniz VoxCPM) cumle basinda "Önce": VoxCPM2 bu kelimeyi bozuyor; anlami koruyan guvenli
//               otomatik cevirisi olmadigi icin degistirilmez, yazara birakilir
//   rakam       okunus hazirligindan sonra hala rakam kalan parca (4K disi "GPT4o", "1.2.3"...)
//   sembol      okunmayacak/yanlis okunacak isaret (@ # / * _ | < > = + ~ ^ & ...) ya da web/e-posta adresi
//   ek-uyumu    kesmeli ek, okunusa cevrilen kelimenin YENI son unlusuyle kalin/ince uyusmuyor ("API'ye" -> "Ey Pi Ay'ye",
//               "iOS'ta" -> "Ay O Es'ta"): ek otomatik degistirilmez (unsuz benzesmesi/kaynastirma da degisir), uyarilir
"use strict";
const T = require("./telaffuz.js");
const { metniHazirla, kelimeSay, bomAt } = require("./ses-metin.js");

const UZUN_CUMLE_ESIGI = 28;

// sapkasiz yazilis -> aciklama (iki anlam). Yalniz tam kelime (kucuk harfe cevrilerek) aranir.
const SAPKA = {
  hala: "'hâlâ' (henüz) mı, 'hala' (babanın kız kardeşi) mi?",
  kar: "'kâr' (kazanç) mı, 'kar' (yağış) mı?",
  karı: "'kârı' (kazancı) mı, 'karı' (eş) mı?",
  alem: "'âlem' (dünya, evren) mi, 'alem' (bayrak, sancak) mı?",
  alemi: "'âlemi' mi, 'alemi' mi?",
  adet: "'âdet' (gelenek) mi, 'adet' (sayı) mi?",
  aşık: "'âşık' (seven) mı, 'aşık' (kemik) mı?",
  dahi: "'dâhi' (deha sahibi) mi, 'dahi' (bile) mi?",
  hakim: "'hâkim' (yargıç, egemen) mi, 'hakîm' (bilge) mi?",
  yar: "'yâr' (sevgili) mi, 'yar' (uçurum) mu?",
  şura: "'şûra' (danışma kurulu) mı, 'şura' (şurası) mı?",
};

// Yabanci gorunus (Turkcede olmayan harf/dizi). Kisaltma (tamami buyuk) ve rakamli parca burada degerlendirilmez.
const YABANCI = [
  [/[qwx]/i, "q/w/x harfi"],
  [/\p{Ll}\p{Lu}/u, "kelime içinde büyük harf"],
  [/[áàäåãéèêëíìïñóòõøúùßæœ]/i, "Türkçede olmayan harf"],
  [/th|sh|ph|ck|gh|ch|ou|tion|ght/i, "İngilizce harf dizisi"],
  [/[bcdfgklmnprstvz]y$/i, "ünsüz + y ile bitiş"],
];
// "t+h" / "s+h" hece sinirinda birlesen Turkce ad ve kelimeler (Mit-hat, Fet-hi, İs-hak, is-hal): "th"/"sh" sayilmaz.
const TR_TH_SH = /^(?:mithat|midhat|ethem|fethi|fethullah|methiye|ishak|ishal|eshab|teshin)/;
const yabanciNeden = kok => {
  const kucuk = kok.toLocaleLowerCase("tr");
  const temiz = TR_TH_SH.test(kucuk) ? kok.replace(/th|sh/gi, "") : kok;
  return YABANCI.find(([re]) => re.test(temiz));
};
const KALIN_UNLU = "aıou";
const sonUnlu = s => { const u = T.unluleri(s); return u.length ? u[u.length - 1] : null; };

const SEMBOL = /[@#*_\/\\|<>{}\[\]~^=+&]/;
const ADRES = /(?:https?:\/\/|www\.)\S+|[\w.+-]+@[\w-]+\.[\w.]+/i;

// paragraflar + satir eslemesi: [{metin, parcalar:[{bas (metindeki konum), satir}]}]
function paragrafSatirlari(metin) {
  const satirlar = bomAt(metin).replace(/\r\n?/g, "\n").split("\n");
  const sonuc = [];
  let cur = null;
  satirlar.forEach((l, i) => {
    if (!l.trim()) { cur = null; return; }
    if (!cur) { cur = { metin: "", parcalar: [] }; sonuc.push(cur); }
    else cur.metin += " ";
    cur.parcalar.push({ bas: cur.metin.length, satir: i + 1 });
    cur.metin += l.trim();
  });
  return { paragraflar: sonuc, satirlar };
}
function satirBul(p, konum) {
  let s = p.parcalar[0].satir;
  for (const x of p.parcalar) if (x.bas <= konum) s = x.satir;
  return s;
}

const kisa = (s, n) => { const k = s.split(/\s+/); return k.length > n ? k.slice(0, n).join(" ") + " …" : s; };

// ANA: metin -> {dil, motor, paket, esik, riskler, uygulanan, ozet}
//   secenek: {dil, okunus, telaffuzPaketi (varsayilan acik), motor ("voxcpm" ise "Önce" denetlenir), esik}
function rapor(metin, secenek) {
  const s = secenek || {};
  const dil = String(s.dil || "tr").toLowerCase().slice(0, 2);
  const tr = dil === "tr";
  const okunus = s.okunus && typeof s.okunus === "object" ? s.okunus : {};
  const paket = tr && s.telaffuzPaketi !== false;
  const motor = s.motor || null;
  const esik = Number.isFinite(s.esik) && s.esik > 0 ? s.esik : UZUN_CUMLE_ESIGI;
  const riskler = [];
  const ekle = r => riskler.push(r);
  const yabanciHarita = new Map();          // kok -> risk (tekrarlar tek satirda)
  const uygulananHarita = new Map();

  const { paragraflar, satirlar } = paragrafSatirlari(String(metin == null ? "" : metin));

  for (const p of paragraflar) {
    // ---- otomatik uygulanacaklar (bilgi) ----
    if (paket) {
      T.uygula(p.metin, okunus, { kayit: d => {
        const a = d.yazilis + "\u0000" + d.okunus;
        const v = uygulananHarita.get(a);
        if (v) v.adet++; else uygulananHarita.set(a, { yazilis: d.yazilis, okunus: d.okunus, adet: 1, satir: p.parcalar[0].satir });
      } });
    }

    // ---- kelime denetimleri ----
    if (tr) {
      const maske = T.kapsananlariMaskele(p.metin, okunus, paket);
      for (const e of maske.matchAll(/[\p{L}\p{N}]+(?:[-'’][\p{L}\p{N}]+)*/gu)) {
        const kelime = e[0];
        const satir = satirBul(p, e.index);
        const kok = kelime.split(/['’]/)[0];
        const kucuk = kelime.toLocaleLowerCase("tr");
        if (SAPKA[kucuk]) ekle({ tur: "sapka", satir, parca: kelime, mesaj: "Şapka belirsiz: " + SAPKA[kucuk],
          oneri: "Kastedilen 'â/î/û'lu yazımsa senaryoda öyle yaz; altyazı da doğru olur." });
        if (/\p{N}/u.test(kok) || !/\p{Ll}/u.test(kok)) continue;     // rakamli ya da kisaltma (tamami buyuk)
        const neden = yabanciNeden(kok);
        if (!neden) continue;
        const var_ = yabanciHarita.get(kok);
        if (var_) { if (!var_.satirlar.includes(satir)) var_.satirlar.push(satir); continue; }
        const r = { tur: "yabanci", satir, satirlar: [satir], parca: kok,
          mesaj: "'" + kok + "' yabancı görünüyor (" + neden[1] + ") ve okunuşu tanımlı değil.",
          oneri: "konu.json \"okunus\" sözlüğüne Türkçe söylenişini ekle: {\"" + kok + "\": \"…\"}" };
        yabanciHarita.set(kok, r); ekle(r);
      }
      // kesmeli ek: okunusa cevrilen kelimenin son unlusu degisip ekle uyusmuyor mu?
      for (const e of p.metin.matchAll(/(?<![\p{L}\p{N}_])([\p{L}\p{N}]+)['’](\p{L}+)/gu)) {
        const [, govde, ek] = e;
        if (Object.prototype.hasOwnProperty.call(okunus, e[0])) continue;      // ekli hali kullanici sozlugunde
        const okunan = metniHazirla(govde, dil, okunus, { xml: false, telaffuzPaketi: s.telaffuzPaketi });
        if (okunan === govde) continue;
        const b = sonUnlu(okunan), c = T.unluleri(ek)[0];
        if (!b || !c || KALIN_UNLU.includes(b) === KALIN_UNLU.includes(c)) continue;
        ekle({ tur: "ek-uyumu", satir: satirBul(p, e.index), parca: e[0],
          mesaj: "Seste \"" + okunan + "'" + ek + "\" okunur: ek, okunuşun son ünlüsüyle uyuşmuyor.",
          oneri: "Eki söylenişe göre yaz ya da konu.json \"okunus\" sözlüğüne bu kelimenin ekli hâlini ekle: {\"" + e[0] + "\": \"…\"}" });
      }
    }

    // ---- cumle denetimleri ----
    for (const c of p.metin.matchAll(/[^.!?…]+(?:[.!?…]+["'”’)\]]*|$)/gu)) {
      const cumle = c[0].trim();
      if (!cumle) continue;
      const bas = c.index + (c[0].length - c[0].trimStart().length);
      const satir = satirBul(p, bas);
      const n = kelimeSay(cumle);
      if (n > esik) ekle({ tur: "uzun-cumle", satir, parca: kisa(cumle, 8),
        mesaj: n + " kelimelik cümle (eşik " + esik + "): ses tonlaması düzleşir, nefes yeri kalmaz.",
        oneri: "Virgül/bağlaç yerinden iki cümleye böl." });
      if (tr && motor === "voxcpm" && /^Önce(?![\p{L}\p{N}_])/u.test(cumle))
        ekle({ tur: "once", satir, parca: kisa(cumle, 6),
          mesaj: "Cümle başında 'Önce': VoxCPM2 bu kelimeyi bozuyor. Anlamı koruyan güvenli otomatik çeviri olmadığı için değiştirilmedi.",
          oneri: "Cümleyi yeniden kur (ör. 'İlk olarak', 'Bundan önce', 'Her şeyden önce' — hangisi anlamı koruyorsa) ya da sesi dinleyip karar ver." });
    }
  }

  // ---- satir satir: rakam, sembol, adres (okunus hazirligindan SONRA ne kaliyor?) ----
  satirlar.forEach((l, i) => {
    if (!l.trim()) return;
    const satir = i + 1;
    const adres = ADRES.exec(l);
    if (adres) ekle({ tur: "sembol", satir, parca: adres[0], mesaj: "Web/e-posta adresi harf harf ya da bozuk okunur.",
      oneri: "Seste adresi söylenişiyle yaz (ör. 'otopilot nokta com') ya da yalnız açıklamaya koy." });
    const hazir = metniHazirla(adres ? l.replace(ADRES, " ") : l, dil, okunus, { xml: false, telaffuzPaketi: s.telaffuzPaketi });
    if (tr) {
      const rakamli = hazir.split(/\s+/).filter(w => /\p{N}/u.test(w));
      if (rakamli.length) ekle({ tur: "rakam", satir, parca: rakamli.slice(0, 4).join(" "),
        mesaj: "Okunuş hazırlığından sonra rakam kaldı: motor bunu yanlış ya da harf harf okuyabilir.",
        oneri: "Sayıyı yazıyla yaz ya da konu.json \"okunus\" sözlüğüne ekle." });
    }
    const sembol = SEMBOL.exec(hazir);
    if (sembol) ekle({ tur: "sembol", satir, parca: hazir.slice(Math.max(0, sembol.index - 12), sembol.index + 13).trim(),
      mesaj: "'" + sembol[0] + "' işareti seste okunmaz ya da yanlış okunur.",
      oneri: "İşareti kelimeyle yaz (ör. '+' → 'artı', '/' → 'bölü' ya da 'veya') ya da kaldır." });
  });

  riskler.sort((a, b) => a.satir - b.satir);
  const ozet = {};
  for (const r of riskler) ozet[r.tur] = (ozet[r.tur] || 0) + 1;
  return {
    dil, motor, paket, esik, riskler, ozet,
    uygulanan: Array.from(uygulananHarita.values()),
  };
}

// Tek satirlik ozet (ses-uret gunlugu): "3 diksiyon riski (uzun-cumle 2, sapka 1)" | ""
function ozetSatiri(r) {
  const n = r.riskler.length;
  if (!n) return "";
  return n + " diksiyon riski (" + Object.entries(r.ozet).map(([k, v]) => k + " " + v).join(", ") + ")";
}

module.exports = { UZUN_CUMLE_ESIGI, SAPKA, rapor, ozetSatiri };
