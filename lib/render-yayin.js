// lib/render-yayin.js — yayin paketi: aciklama, bolumler (chapters), atiflar, etiketler, uyum notlari.
//
// Uretilen dosyalar (uretim/<is>/): YAYIN-PAKETI.md (insan icin), yayin.json (makine icin), bolumler.txt.
// Bolum zamanlari ANLATIMIN GERCEK zamanindan gelir: render-sonuc.json'daki paragrafBaslangic (intro/geri
// sayim kaymasi dahil, kare-kesin); yoksa Voice/zamanlama.json + anlatimBaslangicSn.
// Atiflar manifestten, DISKTE DURAN gorsellerden kurulur (silinen gorselin atfi aciklamaya girmez).
"use strict";
const fs = require("fs");
const path = require("path");
const ortak = require("./ortak");
const A = require("./render-ayar");
const { atifListesineGirer, atifMetni: atifSatiri } = require("./gorsel-lisans");
const { videoAtiflari } = require("./gorsel-manifest");

const BEYAN = "YouTube Studio'da 'değiştirilmiş/sentetik içerik' kutusunu işaretle (gerçekçi yapay görsel/ses varsa)";
const MIN_BOLUM_SN = 10;

const zamanMetni = sn => {
  const t = Math.max(0, Math.floor(sn));
  const h = Math.floor(t / 3600), m = Math.floor(t % 3600 / 60), s = t % 60;
  const p = v => String(v).padStart(2, "0");
  return h > 0 ? h + ":" + p(m) + ":" + p(s) : p(m) + ":" + p(s);
};

const oku = (yol, varsayilan) => { try { return ortak.jsonOku(yol, varsayilan); } catch (e) { return varsayilan; } };

// Baslangic zamani (video saniyesi) paragraf no icin
function paragrafBaslangiclari(dizin, sonuc, N) {
  if (sonuc && Array.isArray(sonuc.paragrafBaslangic) && sonuc.paragrafBaslangic.length === N) return sonuc.paragrafBaslangic;
  const z = oku(path.join(dizin, "Voice", "zamanlama.json"), null);
  if (z && Array.isArray(z.paragraflar) && z.paragraflar.length === N) {
    const kayma = sonuc && typeof sonuc.anlatimBaslangicSn === "number" ? sonuc.anlatimBaslangicSn : 0;
    return z.paragraflar.map(p => kayma + Number(p.baslangicSn || 0));
  }
  return null;
}

const ilkKelimeler = (m, n) => String(m).replace(/\s+/g, " ").trim().split(" ").slice(0, n).join(" ").replace(/[\s.,;:!?…—-]+$/, "");

// Bolumleri kur: [{sn, baslik}] — 00:00'dan baslar, en az 3 madde, her biri en az 10 sn
function bolumleriKur(baslangic, kanon, bolumlerJson, videoSn) {
  const N = kanon.length;
  let ham = [];
  if (bolumlerJson && Array.isArray(bolumlerJson.bolumler)) {
    for (const b of bolumlerJson.bolumler) {
      if (!b || !Number.isInteger(b.paragrafBas) || b.paragrafBas < 0 || b.paragrafBas >= N) continue;
      ham.push({ sn: baslangic[b.paragrafBas], baslik: String(b.ad || "").replace(/\s+/g, " ").trim().slice(0, 100) || ilkKelimeler(kanon[b.paragrafBas], 6) });
    }
    ham.sort((a, b) => a.sn - b.sn);
  }
  if (!ham.length) {
    // ~60-90 sn'lik gruplar: ilk paragraf bir bolum, sonra >=60 sn dolunca yeni bolum
    let ba = 0;
    ham.push({ sn: baslangic[0], baslik: ilkKelimeler(kanon[0], 6) });
    for (let p = 1; p < N; p++) {
      if (baslangic[p] - baslangic[ba] >= 60) { ham.push({ sn: baslangic[p], baslik: ilkKelimeler(kanon[p], 6) }); ba = p; }
    }
  }
  if (!ham.length) return [];
  ham[0].sn = 0;                                           // YouTube: ilk bolum 00:00'da baslamali
  // her bolum >= 10 sn: kisa olani sonrakiyle birlestir (sonraki baslangic atilir)
  const sonuc = [ham[0]];
  for (let i = 1; i < ham.length; i++) {
    const onceki = sonuc[sonuc.length - 1];
    if (ham[i].sn - onceki.sn < MIN_BOLUM_SN) continue;
    sonuc.push(ham[i]);
  }
  while (sonuc.length > 1 && videoSn - sonuc[sonuc.length - 1].sn < MIN_BOLUM_SN) sonuc.pop();
  return sonuc.length >= 3 ? sonuc : [];
}

// Atiflar: manifestte diskte duran gorseller + stok video klipleri (Visuals/video-atif.json; ATIF.txt ile ayni liste)
// kayitsizKlipler: sahne klasorunde duran ama video-atif.json'da kaydi olmayan 00-stok-*.mp4 (atfi aciklamaya giremez)
function atiflariKur(dizin) {
  const visDir = path.join(dizin, "Visuals");
  const m = oku(path.join(visDir, "manifest.json"), null);
  const out = [], goruldu = new Set();
  let sentetikGorsel = false, bySa = false;
  const kayitsizKlipler = [];
  if (!m || !Array.isArray(m.sahneler)) return { atiflar: out, sentetikGorsel, bySa, kayitsizKlipler };
  for (const s of m.sahneler) for (const g of (s.gorseller || [])) {
    if (!g || !g.dosya) continue;
    const yol = path.resolve(visDir, String(g.dosya));
    if (!ortak.yolIcinde(visDir, yol) || !fs.existsSync(yol)) continue;
    if (g.kaynak === "uretim" || g.lisansKodu === "ai") sentetikGorsel = true;
    // ATIF.txt ile AYNI kural ve AYNI satir bicimi (lib/gorsel-lisans.js): yalniz yasal olarak atif isteyenler
    // (CC BY, CC BY-SA, Pexels). NASA gibi "onerilen" kaynaklar atif listesine girmez.
    if (!atifListesineGirer(g)) continue;
    if (g.lisansKodu === "by-sa") bySa = true;
    const anahtar = String(g.kaynakUrl || g.indirmeUrl || g.dosya);
    if (goruldu.has(anahtar)) continue;
    goruldu.add(anahtar);
    out.push({ dosya: g.dosya, baslik: g.baslik || "", yazar: g.atif || g.yazar || "", lisans: g.lisans || "", kaynakUrl: g.kaynakUrl || g.indirmeUrl || "",
      atifMetni: atifSatiri(g) });
  }
  // stok video klipleri (video-bul.js): manifeste girmez, kendi kaydi Visuals/video-atif.json (diskte duranlar)
  const vk = videoAtiflari(visDir);
  for (const g of vk) {
    if (!atifListesineGirer(g)) continue;
    const anahtar = String(g.kaynakUrl || g.indirmeUrl || g.dosya);
    if (goruldu.has(anahtar)) continue;
    goruldu.add(anahtar);
    out.push({ dosya: g.dosya, baslik: g.baslik || "", yazar: g.atif || "", lisans: g.lisans || "", kaynakUrl: g.kaynakUrl || g.indirmeUrl || "", atifMetni: atifSatiri(g) });
  }
  const kayitli = new Set(vk.map(g => String(g.dosya).replace(/\\/g, "/")));
  for (const s of m.sahneler) {
    if (!s || typeof s.klasor !== "string" || !s.klasor || !ortak.yolIcinde(visDir, path.join(visDir, s.klasor))) continue;
    let dosyalar = [];
    try { dosyalar = fs.readdirSync(path.join(visDir, s.klasor)).filter(f => /^00-stok-.*\.mp4$/i.test(f)); } catch (e) { /* klasor yok */ }
    for (const f of dosyalar) if (!kayitli.has(s.klasor + "/" + f)) kayitsizKlipler.push({ dosya: s.klasor + "/" + f, sahne: s.no });
  }
  return { atiflar: out, sentetikGorsel, bySa, kayitsizKlipler };
}

function turetilmisEtiketler(baslik, dil) {
  const durak = new Set(["the", "and", "for", "with", "that", "this", "from", "ile", "için", "bir", "ve", "ama", "çok", "daha", "gibi"]);
  const seen = new Set(), out = [];
  for (const k of String(baslik).toLowerCase().split(/[^\p{L}\p{N}]+/u)) {
    if (k.length < 4 || durak.has(k) || seen.has(k)) continue;
    seen.add(k); out.push(k);
  }
  return out.slice(0, 8);
}
const hashtagYap = s => "#" + String(s).replace(/^#+/, "").split(/[^\p{L}\p{N}]+/u).filter(Boolean)
  .map(w => w.charAt(0).toLocaleUpperCase() + w.slice(1)).join("");

function yayinPaketiUret(is) {
  const ayar = A.ayarCoz(is, {});
  const dizin = ayar.dizin;
  const kanon = ortak.paragraflaraBol((() => { try { return fs.readFileSync(path.join(dizin, "Voice", "SESLENDIRME-TAM-METIN.txt"), "utf8"); } catch (e) { return ""; } })());
  const sonuc = oku(path.join(dizin, "render-sonuc.json"), null);
  const uyarilar = [];

  const video = sonuc && sonuc.video && fs.existsSync(path.join(dizin, sonuc.video)) ? sonuc : null;
  if (!video) uyarilar.push("Video henüz kurulmamış ya da render-sonuc.json yok: bölüm zamanları tahminidir; videoyu kurduktan sonra yeniden üret.");
  const videoSn = sonuc && sonuc.sureSn ? sonuc.sureSn : 0;

  // --- bolumler
  let bolumler = [];
  const baslangic = kanon.length ? paragrafBaslangiclari(dizin, sonuc, kanon.length) : null;
  if (baslangic) {
    const bitis = videoSn || (baslangic[baslangic.length - 1] + 30);
    bolumler = bolumleriKur(baslangic, kanon, oku(path.join(dizin, "Voice", "bolumler.json"), null), bitis);
    if (!bolumler.length) uyarilar.push("Video bölüm (chapter) için çok kısa ya da paragraf az: bölüm eklenmedi (YouTube en az 3 bölüm ve her biri en az 10 sn ister).");
  } else uyarilar.push("Ses zamanlaması (zamanlama.json) bulunamadı: bölüm zamanları üretilemedi.");

  // --- atiflar
  const { atiflar, sentetikGorsel, bySa, kayitsizKlipler } = atiflariKur(dizin);
  if (bySa) uyarilar.push("CC BY-SA lisanslı görsel var: lisans türev eserin aynı lisansla paylaşılmasını ister; gerekiyorsa görseli değiştir.");
  if (kayitsizKlipler.length)
    uyarilar.push("Stok video " + kayitsizKlipler.map(k => k.dosya).slice(0, 5).join(", ") + (kayitsizKlipler.length > 5 ? "…" : "") +
      " için atıf kaydı yok (Visuals/video-atif.json): Pexels klibiyse açıklamada kaynağı eksik. Yeniden indirip kaydetmek için: node video-bul.js " + is +
      " --sahne " + kayitsizKlipler[0].sahne + " --yeniden (ya da klibi sil).");

  // --- etiketler / baslik
  const baslikJson = oku(path.join(dizin, "baslik.json"), null);
  const baslik = ayar.baslik || is;
  let etiketler = baslikJson && Array.isArray(baslikJson.etiketler) ? baslikJson.etiketler.filter(x => typeof x === "string" && x.trim()).map(x => x.trim()) : [];
  if (!etiketler.length) etiketler = turetilmisEtiketler(baslik, ayar.dil);
  let hashtagler = (ayar.konu.yayin.hashtagler || []).filter(x => typeof x === "string" && x.trim()).map(hashtagYap).filter(h => h.length > 1).slice(0, 15);
  if (!hashtagler.length) hashtagler = etiketler.slice(0, 3).map(hashtagYap).filter(h => h.length > 1);

  // --- aciklama
  let ozet = "";
  try { ozet = fs.readFileSync(path.join(dizin, "Voice", "aciklama-ozet.txt"), "utf8").trim(); } catch (e) { /* yok */ }
  if (!ozet && kanon.length) ozet = kanon[0].split(/(?<=[.!?])\s+/).slice(0, 2).join(" ").slice(0, 300);
  const bolumMetni = bolumler.map(b => zamanMetni(b.sn) + " " + b.baslik).join("\n");
  const atifMetni = atiflar.length ? "Görsel kaynakları / Image credits:\n" + atiflar.map(a => a.atifMetni).join("\n") : "";
  const hashMetni = hashtagler.join(" ");
  const seriMetni = ayar.konu.yayin.seri ? (ayar.dil === "tr" ? "Seri: " : "Series: ") + ayar.konu.yayin.seri : "";
  let aciklama;
  const sablon = ayar.konu.yayin.aciklamaSablonu;
  if (sablon && sablon.trim()) {
    aciklama = sablon.replace(/\{ozet\}/g, ozet).replace(/\{bolumler\}/g, bolumMetni).replace(/\{atiflar\}/g, atifMetni)
      .replace(/\{hashtagler\}/g, hashMetni).replace(/\{seri\}/g, seriMetni).replace(/\{kanal\}/g, ayar.kanal).replace(/\{baslik\}/g, baslik);
    if (bolumMetni && !/\{bolumler\}/.test(sablon)) aciklama += "\n\n" + bolumMetni;
    if (atifMetni && !/\{atiflar\}/.test(sablon)) aciklama += "\n\n" + atifMetni;      // lisans geregi atif eksik kalmasin
  } else {
    aciklama = [ozet, bolumMetni, atifMetni, seriMetni, hashMetni].filter(Boolean).join("\n\n");
  }
  aciklama = aciklama.replace(/\n{3,}/g, "\n\n").trim();
  if (aciklama.length > 5000) { uyarilar.push("Açıklama 5000 karakteri aşıyor (YouTube sınırı); kısaltılmalı."); }

  // --- uyum
  const yapayZekaMetin = fs.existsSync(path.join(dizin, "IDDIA-RAPORU.json")) || (() => {
    const k = oku(path.join(dizin, "kullanim.json"), null); return !!(k && Array.isArray(k.kayitlar) && k.kayitlar.length);
  })();
  const uyum = { sentetikSes: true, sentetikGorsel, yapayZekaMetin, atifGerekli: atiflar.length > 0, beyanHatirlatma: BEYAN, uyarilar: [] };
  if (sentetikGorsel) uyum.uyarilar.push("Yapay zekâ ile üretilmiş görsel var: gerçekçi görünüyorsa YouTube'un değiştirilmiş/sentetik içerik beyanını işaretle.");
  if (yapayZekaMetin) uyum.uyarilar.push("Anlatım metni yapay zekâ ile yazıldı: yayından önce rakam/tarih/isimleri IDDIA-RAPORU.md'ye göre kontrol et.");
  if (!String(ayar.konu.kisiselKatki || "").trim())
    uyum.uyarilar.push("Anlatıma kişisel katkı/yorum eklenmemiş: şablon/tekrarlayan içerik riskini azaltmak için kendi bakış açını ekle (konu.json kisiselKatki).");
  if (!ayar.kanal || ayar.kanal.toUpperCase() === "KANALIM") uyum.uyarilar.push("Kanal adı ayarlanmamış (KANALIM): yayından önce kanal adını ayarla.");
  const sinir = ortak.formatSiniri(ayar.format);
  if (videoSn && videoSn > sinir.teknikMaxSn) uyum.uyarilar.push("Video " + Math.round(videoSn) + " sn: bu format için sınır " + sinir.teknikMaxSn + " sn.");

  const kapakYolu = path.join(dizin, "Videos", is + "-kapak.jpg");
  const yayin = {
    surum: 1, tarih: new Date().toISOString(), is, dil: ayar.dil, baslik, aciklama, etiketler, hashtagler,
    bolumler: bolumler.map(b => ({ zaman: zamanMetni(b.sn), sn: Math.round(b.sn * 1000) / 1000, baslik: b.baslik })),
    atiflar, kapak: fs.existsSync(kapakYolu) ? "Videos/" + is + "-kapak.jpg" : null, uyum, uyarilar,
  };

  // --- dosyalar
  ortak.atomikJsonYaz(path.join(dizin, "yayin.json"), yayin);
  ortak.atomikYaz(path.join(dizin, "bolumler.txt"), bolumMetni ? bolumMetni + "\n" : "");
  const md = [];
  md.push("# Yayın paketi — " + baslik, "", "Hazırlanma: " + yayin.tarih.slice(0, 16).replace("T", " ") + " · dil: " + ayar.dil +
    (videoSn ? " · süre: " + zamanMetni(videoSn) : ""), "");
  md.push("## Başlık", "", baslik);
  if (baslikJson && Array.isArray(baslikJson.alternatifler) && baslikJson.alternatifler.length) {
    md.push("", "Alternatifler (puanıyla):");
    for (const a of baslikJson.alternatifler.slice(0, 8)) if (a && a.baslik) md.push("- " + a.baslik + (a.puan !== undefined ? " (" + a.puan + ")" : ""));
  }
  md.push("", "## Açıklama (YouTube'a olduğu gibi yapıştır)", "", "```", aciklama, "```", "");
  md.push("## Etiketler", "", etiketler.length ? etiketler.join(", ") : "(yok)", "");
  md.push("## Bölümler (zaman damgaları)", "", bolumMetni ? "```\n" + bolumMetni + "\n```" : "(eklenmedi)", "");
  md.push("## Görsel kaynakları (atıf)", "", atifMetni ? "```\n" + atifMetni + "\n```" : "Atıf gerektiren görsel yok.", "");
  md.push("## Kapak", "", yayin.kapak ? yayin.kapak : "(kapak üretilmedi: node kapak-yap.js " + is + ")", "");
  md.push("## Yayın öncesi kontrol", "");
  md.push("- [ ] " + BEYAN, "- [ ] Açıklamadaki atıf bloğunu sildirmeden yapıştır (CC BY / Pexels şartı).", "- [ ] Kapak ve başlığı gözden geçir.");
  for (const u of uyum.uyarilar.concat(uyarilar)) md.push("- [ ] " + u);
  md.push("");
  ortak.atomikYaz(path.join(dizin, "YAYIN-PAKETI.md"), md.join("\n"));
  console.log("YAYIN PAKETİ: " + bolumler.length + " bölüm, " + atiflar.length + " atıf, " + etiketler.length + " etiket -> YAYIN-PAKETI.md, yayin.json, bolumler.txt");
  return yayin;
}

module.exports = { yayinPaketiUret, bolumleriKur, atiflariKur, zamanMetni, hashtagYap };
