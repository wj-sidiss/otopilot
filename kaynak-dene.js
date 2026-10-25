// Gorsel kaynaklarini CANLI yoklar: her kaynaga gercek bir arama yapar, kac aday dondugunu ve ilk adayin lisansini yazar.
// Bir servis API'sini degistirirse (ornek: The Met v1/search'u kapatti) sorun gorsel isi ortasinda degil, burada yakalanir.
//   node kaynak-dene.js [arama ifadesi]       npm run kaynak-dene
// Anahtarli kaynaklar (.env) anahtar yoksa "atlandi" yazilir. Cikis 0: en az bir kaynak calisiyor; 3: hicbiri calismiyor.
"use strict";
const ortak = require("./lib/ortak.js");
const ag = require("./lib/gorsel-ag.js");
const { ISTEMCILER, ADLAR } = require("./lib/gorsel-kaynak.js");

const ANAHTAR = { pexels: "PEXELS_KEY", pixabay: "PIXABAY_KEY", smithsonian: "SMITHSONIAN_KEY", unsplash: "UNSPLASH_KEY", europeana: "EUROPEANA_KEY" };

async function calistir() {
  const q = process.argv.slice(2).join(" ") || "windmill";
  const getir = ag.istemciYap({ limitBekleSn: 0 });
  let calisan = 0;
  console.log('Arama: "' + q + '"\n');
  for (const ad of Object.keys(ISTEMCILER)) {
    const anahtar = ANAHTAR[ad] ? ortak.envOku(ANAHTAR[ad]) : "";
    const etiket = (ADLAR[ad] || ad).padEnd(26);
    if (ANAHTAR[ad] && !anahtar) { console.log("-  " + etiket + "atlandi (" + ANAHTAR[ad] + " yok)"); continue; }
    const t0 = Date.now();
    try {
      const r = await ISTEMCILER[ad](q, { limit: 8 }, { getir, anahtar }, () => {});
      const s = ((Date.now() - t0) / 1000).toFixed(1) + " sn";
      if (r.length) { calisan++; console.log("OK " + etiket + r.length + " aday, " + s + " · " + r[0].lisans + " · " + (r[0].baslik || "").slice(0, 40)); }
      else console.log("?  " + etiket + "0 aday (" + s + ") — çalışıyor ama sonuç yok; farklı bir ifadeyle dene");
    } catch (e) {
      console.log("X  " + etiket + ag.hataOzeti(e));
    }
  }
  console.log("\n" + calisan + " kaynak sonuç döndürdü.");
  process.exit(calisan ? 0 : 3);
}

if (require.main === module) calistir();
module.exports = { calistir };
