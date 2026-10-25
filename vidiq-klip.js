// vidIQ ile AI video klipi (Seedance / Veo / MiniMax / Kling). KREDI HARCAR; varsayilan KURU CALISMA (hicbir sey baslatmaz).
//   node vidiq-klip.js <is> --butce 300                       # istemleri Voice/KLIPLER.txt'den okur, maliyeti yazar, BASLATMAZ
//   node vidiq-klip.js <is> --butce 300 --onay                # gercekten uretir (vidIQ kredisi harcar)
//   node vidiq-klip.js <is> --istem "slow motion waves" --sure 6 --butce 200 --onay
// Bayraklar: --model minimax-h3|seedance-2-fast|seedance-2|veo-3.1-fast|veo-3.1|veo-3.1-lite|kling-3|kling-3-pro|gemini-omni-flash
//            --cozunurluk 768p|720p|1080p|2k   --sure <sn>   --oran 9:16|16:9
// KLIPLER.txt: her satir bir klip; "istem metni | 6" ile sure verilir; # satirlari yok sayilir (Ingilizce istem en iyi sonucu verir).
// Ciktilar: uretim/<is>/Clips/NNN-<model>.mp4 + klipler.json (ayni istem ASLA ikinci kez uretilmez). Anahtar: .env VIDIQ_KEY.
"use strict";
const fs = require("fs");
const path = require("path");
const ortak = require("./lib/ortak.js");
const { VidiqIstemci } = require("./lib/vidiq.js");
const K = require("./lib/vidiq-klip.js");
const ag = require("./lib/gorsel-ag.js");

const DEGERLI = new Set(["model", "cozunurluk", "sure", "oran", "butce", "istem"]);

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

async function calistir(args) {
  const { b, konum } = ayristir(args);
  const is = konum[0];
  if (!is) throw Object.assign(new Error("Kullanım: node vidiq-klip.js <iş-adı> --butce <kredi> [--onay] [--istem \"...\"] [--model ...]"), { kod: "kullanim", cikis: 2 });
  const dizin = path.join(ortak.isDizin(is), "Clips");
  const model = b.model || K.VARSAYILAN.model;
  const cozunurluk = b.cozunurluk || (model === K.VARSAYILAN.model ? K.VARSAYILAN.cozunurluk : "720p");
  const sure = Number(b.sure || K.VARSAYILAN.sure);
  const oran = b.oran || K.VARSAYILAN.oran;
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
  const anahtar = ortak.envOku("VIDIQ_KEY");
  if (!anahtar && onay) throw Object.assign(new Error("VIDIQ_KEY tanımlı değil."), { kod: "vidiq_anahtar", cikis: 2, cozum: ".env'e VIDIQ_KEY yaz (app.vidiq.com/account/settings/mcp)." });
  const getir = ag.istemciYap({ limitBekleSn: 5 });
  const r = await K.uret({
    liste, model, cozunurluk, oran, dizin, butce, onay, log: m => console.log(m),
    vidiq: anahtar ? new VidiqIstemci(anahtar, {}) : null,
    indir: async u => (await getir.gorsel(u, { maksBayt: 200 * 1024 * 1024 })).govde,
  });
  console.log("\n" + r.klip + " klip · " + r.atlanan + " zaten hazır · " + r.uretilecek + " üretilecek · tahmini en çok " + r.tahminiKredi + " kredi (" + r.krediSn + " kredi/sn üst sınır) · bütçe " + r.butce);
  if (r.durum === "kuru_calisma") console.log("KURU ÇALIŞMA: hiçbir şey başlatılmadı, kredi harcanmadı. Üretmek için --onay ekle.");
  else if (r.durum === "bitti") console.log("Bitti. Harcanan ≈ " + r.harcanan + " kredi. Klipler: " + dizin);
  else if (r.durum === "hepsi_hazir") console.log("Tüm klipler zaten üretilmiş: " + dizin);
}

if (require.main === module) {
  calistir(process.argv.slice(2)).catch(e => {
    console.error("✗ " + e.message + (e.cozum ? "\n  ↳ " + e.cozum : ""));
    process.exit(e.cikis || 1);
  });
}
module.exports = { calistir, ayristir };
