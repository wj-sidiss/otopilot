// vidIQ ile AI video klipi (Seedance / Veo / MiniMax / Kling). KREDI HARCAR; varsayilan KURU CALISMA (hicbir sey baslatmaz).
//   node vidiq-klip.js <is> --butce 300                       # istemleri Voice/KLIPLER.txt'den okur, maliyeti yazar, BASLATMAZ
//   node vidiq-klip.js <is> --butce 300 --onay                # gercekten uretir (vidIQ kredisi harcar)
//   node vidiq-klip.js <is> --istem "slow motion waves" --sure 6 --butce 200 --onay
// Bayraklar: --model minimax-h3|seedance-2-fast|seedance-2|veo-3.1-fast|veo-3.1|veo-3.1-lite|kling-3|kling-3-pro|gemini-omni-flash
//            --cozunurluk 768p|720p|1080p|2k   --sure <sn>   --oran 9:16|16:9
//            --yeni-cekim   listedeki tekrar satirini ve dosyasi silinen klibi YENI UCRETLI surum olarak uretir (confirmNewAttempt);
//                           yoksa tekrar satiri atlanir, silinen klip ucretsiz yeniden indirilir
// KLIPLER.txt: her satir bir klip; "istem metni | 6" ile sure verilir; # satirlari yok sayilir (Ingilizce istem en iyi sonucu verir).
// Ciktilar: uretim/<is>/Clips/NNN-<model>.mp4 + klipler.json (ayni cekim ASLA ikinci kez ucretli uretilmez). Anahtar: .env VIDIQ_KEY.
// Cikis: 0 tamam/kuru calisma · 2 girdi/ayar (klipler.json bozuk dahil) · 3 vidIQ/ag ya da bazi klipler alinamadi · 7 butce doldu.
"use strict";
const fs = require("fs");
const path = require("path");
const ortak = require("./lib/ortak.js");
const { VidiqIstemci } = require("./lib/vidiq.js");
const K = require("./lib/vidiq-klip.js");
const ag = require("./lib/gorsel-ag.js");

const DEGERLI = new Set(["model", "cozunurluk", "sure", "oran", "butce", "istem"]);
// klip indirme: 200 MB ust sinir; TOPLAM sure siniri boyuta gore (200 MB / 20 dk = yaklasik 1,4 Mbit/sn alt hiz). Varsayilan 120 sn
// yavas baglantida 2k/1080p klibi hic indirtmiyordu. Bosta kalma siniri (zamanAsimiMs 30 sn) aynen kalir.
const INDIR = Object.freeze({ maksBayt: 200 * 1024 * 1024, toplamAsimiMs: 20 * 60 * 1000 });
const indirici = getir => async u => (await getir.gorsel(u, INDIR)).govde;

// bayraklar ve konumsal (is adi) argumanlar ayri ayrilir; --onay degersizdir
function ayristir(args) {
  const b = {}, konum = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith("--")) { const ad = a.slice(2); if (DEGERLI.has(ad)) b[ad] = args[++i]; else b[ad] = true; }
    else konum.push(a);
  }
  return { b, konum };
}

// enj (testler icin): {vidiq, indir, log}; verilirse .env okunmaz, ag kurulmaz
async function calistir(args, enj) {
  const e = enj || {};
  const yaz = e.log || (m => console.log(m));
  const { b, konum } = ayristir(args);
  const is = konum[0];
  if (!is) throw Object.assign(new Error("Kullanım: node vidiq-klip.js <iş-adı> --butce <kredi> [--onay] [--yeni-cekim] [--istem \"...\"] [--model ...]"), { kod: "kullanim", cikis: 2 });
  const dizin = path.join(ortak.isDizin(is), "Clips");
  const model = b.model || K.VARSAYILAN.model;
  const cozunurluk = b.cozunurluk || (model === K.VARSAYILAN.model ? K.VARSAYILAN.cozunurluk : "720p");
  const sure = Number(b.sure || K.VARSAYILAN.sure);
  // oran verilmediyse isin konu.json'indaki biciminden: 16:9 uzun video, digerleri (short/reels/tiktok) 9:16
  const konu = ortak.jsonOku(path.join(ortak.isDizin(is), "konu.json"), {}) || {};
  const oran = b.oran || (konu.aspect === "16:9" ? "16:9" : K.VARSAYILAN.oran);
  const butce = Number(b.butce || 0);
  let liste;
  if (b.istem) liste = K.klipListesi(b.istem, sure);
  else {
    const dosya = path.join(ortak.isDizin(is), "Voice", "KLIPLER.txt");
    if (!fs.existsSync(dosya)) throw Object.assign(new Error("Voice/KLIPLER.txt yok."), { kod: "girdi", cikis: 2, cozum: "Her satıra bir klip istemi yaz ('istem | 6' ile süre) ya da --istem \"...\" ver." });
    liste = K.klipListesi(fs.readFileSync(dosya, "utf8"), sure);
  }
  if (!liste.length) throw Object.assign(new Error("Klip listesi boş."), { kod: "girdi", cikis: 2 });
  const onay = b.onay === true;
  const yeniCekim = b["yeni-cekim"] === true;
  const anahtar = e.vidiq ? "" : ortak.envOku("VIDIQ_KEY");
  if (!e.vidiq && !anahtar && onay) throw Object.assign(new Error("VIDIQ_KEY tanımlı değil."), { kod: "vidiq_anahtar", cikis: 2, cozum: ".env'e VIDIQ_KEY yaz (app.vidiq.com/account/settings/mcp)." });
  const r = await K.uret({
    liste, model, cozunurluk, oran, dizin, butce, onay, yeniCekim, log: yaz,
    vidiq: e.vidiq || (anahtar ? new VidiqIstemci(anahtar, {}) : null),
    indir: e.indir || indirici(ag.istemciYap({ limitBekleSn: 5 })),
  });
  yaz("\n" + r.klip + " klip · " + r.atlanan + " zaten hazır · "
    + (r.surdurulecek ? r.surdurulecek + " sürdürülecek (ücreti ödenmiş, ücretsiz sorgulanır) · " : "")
    + r.uretilecek + " üretilecek" + (r.ekCekim ? " (" + r.ekCekim + " ek çekim)" : "")
    + " · tahmini en çok " + r.tahminiKredi + " kredi (" + r.krediSn + " kredi/sn üst sınır) · bütçe " + r.butce + " · " + r.oran + " " + r.cozunurluk);
  if (r.tekrar) yaz("! " + r.tekrar + " tekrar satırı atlandı: aynı çekim zaten var ya da listede tekrar ediyor. Ek ücretli çekim için --yeni-cekim ekle.");
  if (r.farkliAyar) yaz("! " + r.farkliAyar + " klip aynı istemle başka ayarda (" + r.farkliAyarlar.join(", ") + ") zaten var; " + r.oran + " " + r.cozunurluk + " için YENİDEN ücretli üretilecek (tahmine dahil).");
  if (r.ekCekim) yaz("! " + r.ekCekim + " ek çekim: aynı istemin YENİ ücretli sürümü (tahmine dahil).");
  if (r.durum === "kuru_calisma") yaz("KURU ÇALIŞMA: hiçbir şey başlatılmadı, kredi harcanmadı. " + (r.uretilecek ? "Üretmek için --onay ekle." : "Ücreti ödenmiş klipleri almak için --onay ekle (yeni kredi harcanmaz)."));
  else if (r.durum === "hepsi_hazir") yaz("Tüm klipler zaten üretilmiş: " + dizin);
  else {
    for (const h of r.basarisiz || []) yaz("  ✗ " + h.istem + " — " + h.neden + (h.cozum ? "\n    ↳ " + h.cozum : ""));
    if (r.durum === "bitti") yaz("Bitti. Bu koşuda harcanan ≈ " + r.harcanan + " kredi. Klipler: " + dizin);
    else if (r.durum === "butce_doldu") yaz("Bütçe doldu: harcanan ≈ " + r.harcanan + " / " + r.butce + " kredi; " + r.baslatilmayan + " klip başlatılmadı. Devam için bütçeyi artırıp aynı komutu yeniden çalıştır (alınanlar tekrar üretilmez). Klipler: " + dizin);
    else yaz("Kısmen bitti: " + r.dosyalar.length + " klip alındı, " + (r.basarisiz || []).length + " klip alınamadı"
      + (r.durdu === "kredi" ? ", vidIQ kredisi yetmediği için " + r.baslatilmayan + " klip başlatılmadı" : "")
      + ". Harcanan ≈ " + r.harcanan + " kredi. Aynı komutu yeniden çalıştırınca alınanlar atlanır. Klipler: " + dizin);
  }
  return r;
}

// sonuc durumundan cikis kodu: butce doldu = maliyet siniri (7); bazi klipler alinamadi/kredi bitti = dis servis (3)
function cikisKodu(r) {
  if (!r) return 0;
  if (r.durum === "butce_doldu") return ortak.CIKIS.MALIYET;
  if (r.durum === "kismi") return ortak.CIKIS.SERVIS;
  return 0;
}

if (require.main === module) {
  calistir(process.argv.slice(2)).then(r => { const c = cikisKodu(r); if (c) process.exitCode = c; }).catch(e => {
    console.error("✗ " + e.message + (e.cozum ? "\n  ↳ " + e.cozum : ""));
    process.exit(e.cikis || 1);
  });
}
module.exports = { calistir, ayristir, cikisKodu, indirici, INDIR };
