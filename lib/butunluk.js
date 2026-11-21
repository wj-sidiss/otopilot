// lib/butunluk.js — SHA256 ile dosya butunlugu: depodaki ikili dosyalar (SHA256SUMS) ve kullanicinin kurdugu modeller
// (data/model-sha256.json). Dosya akisla okunur (3 GB'lik model bellege alinmaz).
"use strict";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

function sha256Dosya(yol) {
  return new Promise((ok, ret) => {
    const h = crypto.createHash("sha256");
    fs.createReadStream(yol).on("error", ret).on("data", p => h.update(p)).on("end", () => ok(h.digest("hex")));
  });
}

// SHA256SUMS bicimi (sha256sum ile uyumlu): "<64 hex>  <goreli/yol>" — yol her zaman / ile
function sumsCoz(metin) {
  const liste = [];
  for (const satir of String(metin || "").split(/\r?\n/)) {
    const m = /^([0-9a-f]{64}) [ *](.+)$/.exec(satir.trim());
    if (m) liste.push({ sha: m[1], yol: m[2].replace(/\\/g, "/") });
  }
  return liste;
}
const sumsYaz = liste => liste.slice().sort((a, b) => (a.yol < b.yol ? -1 : a.yol > b.yol ? 1 : 0)).map(x => `${x.sha}  ${x.yol}`).join("\n") + "\n";

// kok altindaki dosyalari SHA256SUMS'a karsi dogrular -> { tamam:[yol], hatali:[{yol,beklenen,gelen}], eksik:[yol] }
async function sumsDogrula(kok, liste) {
  const s = { tamam: [], hatali: [], eksik: [] };
  for (const x of liste) {
    const tam = path.join(kok, x.yol);
    if (!fs.existsSync(tam)) { s.eksik.push(x.yol); continue; }
    const gelen = await sha256Dosya(tam);
    if (gelen === x.sha) s.tamam.push(x.yol); else s.hatali.push({ yol: x.yol, beklenen: x.sha, gelen });
  }
  return s;
}

// Buyuk dosya icin onbellek: ayni boyut + degistirilme zamani ise sha256 yeniden hesaplanmaz
async function sha256Onbellekli(yol, onbellekDosyasi) {
  const st = fs.statSync(yol);
  const anahtar = path.resolve(yol);
  let ob = {};
  try { ob = JSON.parse(fs.readFileSync(onbellekDosyasi, "utf8")); } catch (e) { /* yok */ }
  const k = ob[anahtar];
  if (k && k.boyut === st.size && k.mtime === st.mtimeMs) return { sha: k.sha, onbellek: true };
  const sha = await sha256Dosya(yol);
  ob[anahtar] = { boyut: st.size, mtime: st.mtimeMs, sha };
  try { fs.mkdirSync(path.dirname(onbellekDosyasi), { recursive: true }); fs.writeFileSync(onbellekDosyasi, JSON.stringify(ob, null, 1)); } catch (e) { /* yazilamazsa da sonuc dogru */ }
  return { sha, onbellek: false };
}

// SHA256 dogrulamali indirme: once <hedef>.part'a iner (yonlendirmeler izlenir), boyut ve sha256 tutarsa yeniden adlandirilir;
// tutmazsa .part silinir ve hata firlatilir (bozuk/degistirilmis dosya asla hedefe yazilmaz). Hedef zaten varsa ve dogruysa indirmez.
// -> { yol, indirildi:bool }
async function guvenliIndir(url, hedef, beklenen, o) {
  const a = o || {};
  if (fs.existsSync(hedef) && (await sha256Dosya(hedef)) === beklenen.sha256) return { yol: hedef, indirildi: false };
  fs.mkdirSync(path.dirname(hedef), { recursive: true });
  const part = hedef + ".part";
  const getir = a.fetch || globalThis.fetch;
  const r = await getir(url, { redirect: "follow", headers: { "user-agent": "otopilot-kurulum" } });
  if (!r.ok || !r.body) throw new Error(`indirilemedi (HTTP ${r.status}): ${url}`);
  const h = crypto.createHash("sha256");
  let n = 0;
  const yaz = fs.createWriteStream(part);
  try {
    for await (const parca of r.body) {
      const b = Buffer.from(parca);
      h.update(b); n += b.length;
      if (!yaz.write(b)) await new Promise(ok => yaz.once("drain", ok));
      if (a.ilerleme) a.ilerleme(n, beklenen.boyut);
    }
    await new Promise((ok, ret) => yaz.end(e => (e ? ret(e) : ok())));
  } catch (e) { yaz.destroy(); try { fs.unlinkSync(part); } catch (x) { /* yok */ } throw e; }
  const gelen = h.digest("hex");
  if ((beklenen.boyut && n !== beklenen.boyut) || gelen !== beklenen.sha256) {
    try { fs.unlinkSync(part); } catch (x) { /* yok */ }
    const e = new Error(`SHA256 tutmadı, dosya silindi: ${path.basename(hedef)}\n  beklenen ${beklenen.sha256} (${beklenen.boyut || "?"} bayt)\n  gelen    ${gelen} (${n} bayt)`);
    e.kod = "sha256_tutmadi";
    throw e;
  }
  fs.renameSync(part, hedef);
  return { yol: hedef, indirildi: true };
}

module.exports = { sha256Dosya, sumsCoz, sumsYaz, sumsDogrula, sha256Onbellekli, guvenliIndir };
