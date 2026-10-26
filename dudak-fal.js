// Dudak senkronu BULUT saglayicisi: fal.ai "fal-ai/latentsync" (ByteDance LatentSync). Kullanicinin KENDI anahtariyla (FAL_KEY); yerel GPU gerekmez.
//   .env:  FAL_KEY=...                       (fal.ai/dashboard/keys; ucretli, kullandikca: fiyat icin fal.ai/pricing)
//          DUDAK_KOMUT=node dudak-fal.js --video {video} --ses {ses} --cikti {cikti}
//   node dudak-fal.js --kontrol              anahtar var mi (HICBIR sey gonderilmez, para harcanmaz)
// film.js kur --dudak sahne basina bir istek yollar (GERCEK PARA); cikti zaten varsa yeniden istenmez (film.js onbellegi).
// Akis: kuyruga gonder (video/ses data: URI olarak) -> durumu yokla -> sonuc video adresini indir. Indirme yalniz https + fal alan adlarindan.
"use strict";
const fs = require("fs");
const path = require("path");
const ortak = require("./lib/ortak.js");

const KUYRUK = "https://queue.fal.run/fal-ai/latentsync";
const IZINLI_HOST = /(^|\.)(fal\.media|fal\.run|fal\.ai)$/i;
const MAKS_GIRDI = 60 * 1024 * 1024;           // data: URI sismesi dahil makul ust sinir (video 45 MB)
const MAKS_CIKTI = 300 * 1024 * 1024;
const hata = (m, c) => Object.assign(new Error(m), { cikis: 2, cozum: c });
const bekle = ms => new Promise(r => setTimeout(r, ms));

const MIME = { ".mp4": "video/mp4", ".mov": "video/quicktime", ".webm": "video/webm", ".wav": "audio/wav", ".mp3": "audio/mpeg", ".m4a": "audio/mp4", ".aac": "audio/aac" };
function dataUri(yol) {
  const mime = MIME[path.extname(yol).toLowerCase()];
  if (!mime) throw hata("Desteklenmeyen dosya türü: " + path.extname(yol));
  const boy = fs.statSync(yol).size;
  if (boy > MAKS_GIRDI * 0.75) throw hata("Dosya çok büyük (" + Math.round(boy / 1048576) + " MB): " + path.basename(yol), "Sahne klibini kısalt ya da daha düşük çözünürlük kullan.");
  return "data:" + mime + ";base64," + fs.readFileSync(yol).toString("base64");
}

// o: {video, ses, cikti}; b: {anahtar, fetch, bekle, yoklamaMs, maksSn}
async function uret(o, bag) {
  const b = bag || {};
  const anahtar = b.anahtar !== undefined ? b.anahtar : ortak.envOku("FAL_KEY");
  if (!anahtar) throw hata("FAL_KEY tanımlı değil.", "fal.ai/dashboard/keys adresinden anahtar al ve .env'e FAL_KEY=... yaz (ücretli; kullandıkça harcar).");
  if (!fs.existsSync(o.video)) throw hata("Video yok: " + o.video);
  if (!fs.existsSync(o.ses)) throw hata("Ses yok: " + o.ses);
  const f = b.fetch || fetch, uyku = b.bekle || bekle, yoklama = b.yoklamaMs || 5000, maksSn = b.maksSn || 900;
  const baslik = { Authorization: "Key " + anahtar, "Content-Type": "application/json" };

  const gonder = await f(KUYRUK, { method: "POST", headers: baslik, body: JSON.stringify({ video_url: dataUri(o.video), audio_url: dataUri(o.ses), loop_mode: "pingpong" }) });
  const g = await gonder.json().catch(() => ({}));
  if (gonder.status === 401 || gonder.status === 403) throw hata("fal.ai anahtarı reddedildi (HTTP " + gonder.status + ").", "FAL_KEY'i kontrol et (fal.ai/dashboard/keys).");
  if (gonder.status === 402 || /balance|credit|insufficient/i.test(JSON.stringify(g))) throw hata("fal.ai bakiyesi yetersiz.", "fal.ai/dashboard/billing adresinden bakiye ekle.");
  if (!gonder.ok || !g.request_id) throw hata("fal.ai isteği kabul etmedi (HTTP " + gonder.status + "): " + JSON.stringify(g).slice(0, 200));
  const durumUrl = g.status_url || KUYRUK + "/requests/" + g.request_id + "/status";
  const sonucUrl = g.response_url || KUYRUK + "/requests/" + g.request_id;
  // fal adresleri disina yoklama yapma (yanit manipule edilmis olabilir)
  for (const u of [durumUrl, sonucUrl]) if (!/^https:\/\//.test(u) || !IZINLI_HOST.test(new URL(u).hostname)) throw hata("Beklenmeyen fal adresi: " + u);

  const basla = Date.now();
  for (;;) {
    const d = await (await f(durumUrl, { headers: baslik })).json().catch(() => ({}));
    if (d.status === "COMPLETED") break;
    if (d.status === "FAILED" || d.status === "ERROR" || d.error) throw hata("fal.ai işi başarısız oldu: " + JSON.stringify(d).slice(0, 200));
    if ((Date.now() - basla) / 1000 > maksSn) throw hata("fal.ai işi " + Math.round(maksSn / 60) + " dakikada bitmedi (istek: " + g.request_id + ").", "Biraz sonra tekrar dene; iş fal.ai tarafında sürüyorsa ücret yansımış olabilir.");
    await uyku(yoklama);
  }
  const s = await (await f(sonucUrl, { headers: baslik })).json().catch(() => ({}));
  const url = s && (s.video && s.video.url || s.data && s.data.video && s.data.video.url);
  if (!url) throw hata("fal.ai sonucunda video adresi yok: " + JSON.stringify(s).slice(0, 200));
  if (!/^https:\/\//.test(url) || !IZINLI_HOST.test(new URL(url).hostname)) throw hata("Video adresi fal.ai alan adı dışında, indirilmedi: " + url);
  const r = await f(url);
  if (!r.ok) throw hata("Sonuç videosu indirilemedi (HTTP " + r.status + ").");
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length > MAKS_CIKTI) throw hata("Sonuç videosu çok büyük.");
  if (buf.length < 1000 || buf.toString("latin1", 4, 8) !== "ftyp") throw hata("Sonuç geçerli bir mp4 değil.");
  fs.mkdirSync(path.dirname(o.cikti), { recursive: true });
  const gecici = o.cikti + ".part";
  fs.writeFileSync(gecici, buf); fs.renameSync(gecici, o.cikti);
  return o.cikti;
}

async function cli(args) {
  const d = a => { const i = args.indexOf("--" + a); return i >= 0 ? args[i + 1] : undefined; };
  if (args.includes("--kontrol")) {
    console.log(ortak.envOku("FAL_KEY") ? "FAL_KEY tanımlı (anahtar doğrulanmadı; ilk istekte denetlenir, kontrol para harcamaz)." : "FAL_KEY yok.");
    return ortak.envOku("FAL_KEY") ? 0 : 2;
  }
  if (!d("video") || !d("ses") || !d("cikti")) throw hata("Kullanım: node dudak-fal.js --video <mp4> --ses <ses> --cikti <mp4>");
  console.log("  fal.ai LatentSync'e gönderiliyor (ücretli istek)…");
  console.log("✓ " + await uret({ video: d("video"), ses: d("ses"), cikti: d("cikti") }));
  return 0;
}
if (require.main === module) cli(process.argv.slice(2)).then(c => process.exit(c), e => { console.error("✗ " + e.message + (e.cozum ? "\n  ↳ " + e.cozum : "")); process.exit(e.cikis || 1); });
module.exports = { uret, dataUri, IZINLI_HOST };
