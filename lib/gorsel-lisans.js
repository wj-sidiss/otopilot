// LISANS SUZGECI (GO grubu). Kanal para kazanabilir: NC (ticari degil) ve ND (turetilemez)
// lisanslar ELENIR. Siralama: CC0 / kamu mali / NASA / Pexels / Pixabay  >  CC BY  >  CC BY-SA.
//
// lisansKodu: cc0 | pdm | by | by-sa | pexels | pixabay | nasa | ai | bilinmiyor   (manifest sozlesmesi, bolum 3)
// lisansSira: 0 en iyi ... 3 en kotu (puanlamada kullanilir; adayin kaynak siralamasindaki `sira` ile KARISTIRMA)
//
// Atif:
//   atifGerekli  — lisans yasal olarak ister (CC BY, CC BY-SA); aciklamaya KONMAZSA ihlal
//   atifOnerilen — yasal zorunluluk yok ama kaynak/sahibi belirtmek nezaket ya da API yonergesi (Pexels, NASA)
"use strict";

const ETIKET = { cc0: "CC0 1.0", pdm: "Kamu malı (Public Domain)", by: "CC BY", "by-sa": "CC BY-SA" };

// Sabit kaynaklar (lisans kaynagin kendisinden gelir)
const SABIT = {
  pexels: { kabul: true, lisans: "Pexels License", lisansKodu: "pexels", atifGerekli: false, atifOnerilen: true, lisansSira: 0 },
  pixabay: { kabul: true, lisans: "Pixabay License", lisansKodu: "pixabay", atifGerekli: false, atifOnerilen: false, lisansSira: 0 },
  nasa: { kabul: true, lisans: "NASA (kamu malı)", lisansKodu: "nasa", atifGerekli: false, atifOnerilen: true, lisansSira: 0 },
  // Muze acik erisim programlari: yalniz kamu mali / CC0 isaretli eserler sorgulanir (istemci tarafinda ikinci kontrol)
  met: { kabul: true, lisans: "CC0 (The Met Open Access)", lisansKodu: "cc0", atifGerekli: false, atifOnerilen: true, lisansSira: 0 },
  aic: { kabul: true, lisans: "CC0 (Art Institute of Chicago Public Domain)", lisansKodu: "cc0", atifGerekli: false, atifOnerilen: true, lisansSira: 0 },
  cleveland: { kabul: true, lisans: "CC0 (Cleveland Museum of Art Open Access)", lisansKodu: "cc0", atifGerekli: false, atifOnerilen: true, lisansSira: 0 },
  smithsonian: { kabul: true, lisans: "CC0 (Smithsonian Open Access)", lisansKodu: "cc0", atifGerekli: false, atifOnerilen: true, lisansSira: 0 },
  unsplash: { kabul: true, lisans: "Unsplash License", lisansKodu: "pixabay", atifGerekli: false, atifOnerilen: true, lisansSira: 0 },
  uretim: { kabul: true, lisans: "Yapay zekâ üretimi", lisansKodu: "ai", atifGerekli: false, atifOnerilen: false, lisansSira: 0 },
  elle: { kabul: true, lisans: "Elle eklendi (lisansı bilinmiyor)", lisansKodu: "bilinmiyor", atifGerekli: false, atifOnerilen: false, lisansSira: 3 },
};

function kodSonuc(kod, surum) {
  const lisansSira = { cc0: 0, pdm: 0, by: 1, "by-sa": 2 }[kod];
  let etiket = ETIKET[kod];
  if (surum && (kod === "by" || kod === "by-sa")) etiket += " " + surum;
  const o = { kabul: true, lisans: etiket, lisansKodu: kod, lisansSira,
              atifGerekli: kod === "by" || kod === "by-sa", atifOnerilen: kod === "by" || kod === "by-sa" };
  if (kod === "by-sa")
    o.uyari = "CC BY-SA: video türev eser sayılabilir; açıklamaya atıf ekle ve aynı lisansı koru (ya da bu görseli kaldır).";
  return o;
}

// Openverse: license = "by" | "by-sa" | "by-nc" | "by-nd" | "by-nc-sa" | "by-nc-nd" | "cc0" | "pdm" | "sampling+" ...
function openverseLisans(kod, surum) {
  const k = String(kod || "").toLowerCase().trim();
  if (!k) return { kabul: false, neden: "lisans bilinmiyor" };
  const parca = k.split("-");
  if (parca.includes("nc")) return { kabul: false, neden: "ticari kullanıma kapalı (NC)" };
  if (parca.includes("nd")) return { kabul: false, neden: "türetmeye kapalı (ND)" };
  if (k.includes("sampling")) return { kabul: false, neden: "sampling lisansı" };
  if (k === "cc0" || k === "pdm" || k === "by" || k === "by-sa") return kodSonuc(k, k === "cc0" ? "" : surum);
  return { kabul: false, neden: "tanınmayan lisans: " + k };
}

// Wikimedia: extmetadata.LicenseShortName ("CC BY-SA 4.0", "CC0", "Public domain", "PD-old-70", "Attribution" ...)
function wikimediaLisans(kisaAd, ek) {
  const a = String(kisaAd || "").trim();
  const e = ek || {};
  if (String(e.nonFree || "").toLowerCase() === "true") return { kabul: false, neden: "serbest olmayan (non-free) dosya" };
  if (/(^|[^a-z])(nc|non-?commercial)([^a-z]|$)/i.test(a)) return { kabul: false, neden: "ticari kullanıma kapalı (NC)" };
  if (/(^|[^a-z])(nd|no-?derivs?)([^a-z]|$)/i.test(a)) return { kabul: false, neden: "türetmeye kapalı (ND)" };
  if (/^gfdl/i.test(a)) return { kabul: false, neden: "yalnızca GFDL (video için uygun değil)" };
  const surum = (a.match(/(\d\.\d)/) || [])[1] || "";
  if (/cc0|cc[- ]zero/i.test(a)) return kodSonuc("cc0");
  if (/public domain|^pd([- ]|$)|pd-|no known copyright|usgov|pdm/i.test(a)) return kodSonuc("pdm");
  if (/cc[- ]?by[- ]?sa|share ?alike/i.test(a)) return kodSonuc("by-sa", surum);
  if (/cc[- ]?by|attribution/i.test(a)) return kodSonuc("by", surum);
  // Commons yalnizca serbest lisansli dosya barindirir ama bu lisansi taniyamadik: kabul, ama atif iste, sona koy
  return { kabul: true, lisans: a || "Commons (serbest lisans, ad bilinmiyor)", lisansKodu: "bilinmiyor", lisansSira: 3,
           atifGerekli: true, atifOnerilen: true,
           uyari: "Lisans adı tanınamadı (" + (a || "boş") + "): kaynak sayfasındaki koşulları kontrol et." };
}

// kaynak: pexels | pixabay | nasa | uretim | elle | openverse | wikimedia ; ham: kaynaga ozel veri
function lisansCoz(kaynak, ham) {
  if (SABIT[kaynak]) return Object.assign({}, SABIT[kaynak]);
  if (kaynak === "openverse") return openverseLisans(ham && ham.license, ham && ham.version);
  if (kaynak === "wikimedia") return wikimediaLisans(ham && ham.kisaAd, ham);
  return { kabul: false, neden: "bilinmeyen kaynak: " + kaynak };
}

// Aciklamaya atif satiri gerektiren kayit mi? (sozlesme: CC BY, CC BY-SA ve Pexels)
const atifListesineGirer = g => g && (g.lisansKodu === "by" || g.lisansKodu === "by-sa" || g.lisansKodu === "pexels" ||
                                      (g.lisansKodu === "bilinmiyor" && g.atifGerekli === true));

// Tek atif satiri: "Baslik" — Yazar — Lisans — kaynakUrl. ATIF.txt (GO) ve YAYIN-PAKETI atiflari (R) AYNI bicimi kullanir.
const satirKisalt = (s, maks) => String(s == null ? "" : s).replace(/\s+/g, " ").trim().slice(0, maks);
function atifMetni(g) {
  const baslik = satirKisalt(g.baslik, 160).replace(/"/g, "'") || "Başlıksız";
  const yazar = satirKisalt(g.atif, 120) || "Bilinmeyen";
  return '"' + baslik + '" — ' + yazar + " — " + g.lisans + " — " + (g.kaynakUrl || g.indirmeUrl || "");
}

module.exports = { lisansCoz, openverseLisans, wikimediaLisans, atifListesineGirer, atifMetni, SABIT };
