// PANEL GUVENLIGI — Host/Origin/Icerik-turu/jeton denetimi, guvenlik basliklari, HTML'e jeton enjeksiyonu.
// (SOZLESME bolum 6.4.) Tek amac: panel yalnizca bu bilgisayardaki panel sayfasi tarafindan yonetilebilsin;
// baska bir web sitesi (CSRF) ya da DNS rebinding ile erisilemesin.
"use strict";
const crypto = require("crypto");

// Sayfaya enjekte edilen tek satir ici betik: same-origin /api/ fetch'lerine X-Panel-Token ekleyen sarmalayici.
// (panel-cekirdek.js jetonu kendisi de okur; bu, eski/yeni HTML ile uyum icindir.) Degismez bir metin oldugu icin CSP onu
// SHA-256 ozetiyle tanir: script-src 'unsafe-inline' YOK, yani bir yerde HTML enjeksiyonu olsa bile satir ici betik/olay
// isleyicisi calismaz (savunma derinligi; arayuz zaten innerHTML kullanmaz).
const SARMALAYICI = "(function(){var m=document.querySelector('meta[name=\"panel-token\"]');var t=m&&m.content;if(!t||!window.fetch)return;" +
  "var f=window.fetch;window.fetch=function(u,o){try{var a=(typeof u==='string')?u:(u&&u.url)||String(u);" +
  "var x=new URL(a,location.href);if(x.origin===location.origin&&x.pathname.indexOf('/api/')===0){" +
  "o=o||{};var h=new Headers(o.headers||((typeof u!=='string'&&u&&u.headers)||{}));h.set('X-Panel-Token',t);o.headers=h;}}catch(e){}" +
  "return f.call(this,u,o);};})();";
const SARMALAYICI_OZET = "'sha256-" + crypto.createHash("sha256").update(SARMALAYICI, "utf8").digest("base64") + "'";

const CSP = "default-src 'self'; img-src 'self' data: blob:; media-src 'self'; style-src 'self' 'unsafe-inline'; " +
  "script-src 'self' " + SARMALAYICI_OZET + "; connect-src 'self'; object-src 'none'; form-action 'none'; frame-ancestors 'none'; base-uri 'none'";

// Rastgele 32 bayt, onaltilik.
const jetonUret = () => crypto.randomBytes(32).toString("hex");

// Zaman-sabit karsilastirma (uzunluk sizdirmaz: ikisi de sha256'ya cevrilir).
function jetonEsit(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || !a || !b) return false;
  const ha = crypto.createHash("sha256").update(a).digest();
  const hb = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

// Izinli Host basliklari: yalniz localhost:PORT, 127.0.0.1:PORT, [::1]:PORT. Panel ag'a ACILAMAZ (ek host listesi yok, bilerek):
// sayfa jetonu HTML'e gomulu verir; Host'u izinli bir ag istemcisi jetonu alip tum /api'yi kullanabilirdi.
function hostIzinli(host, port) {
  if (typeof host !== "string") return false;
  const h = host.toLowerCase();
  return h === "localhost:" + port || h === "127.0.0.1:" + port || h === "[::1]:" + port;
}
// Origin varsa kendi adresimiz olmali. (Origin yoksa tarayici disi istemci ya da ayni-kaynak GET: jeton yine ister.)
function originIzinli(origin, port) {
  if (origin === undefined) return true;
  if (typeof origin !== "string") return false;
  const o = origin.toLowerCase();
  return o === "http://localhost:" + port || o === "http://127.0.0.1:" + port || o === "http://[::1]:" + port;
}
// Tarayici Sec-Fetch-Site gonderiyorsa: ayni kaynak ya da kullanici eylemi (none) disindakini reddet.
function fetchSiteIzinli(deger) {
  if (deger === undefined) return true;
  return deger === "same-origin" || deger === "none";
}
const JSON_TURU = /^application\/json\s*(;|$)/i;
// <video>/<img>/<audio> baslik gonderemez: bu yollar jetonu cerezle kabul eder (panel.js medya() ayni listeyi kullanir)
const MEDYA_YOLU = /^\/(onizle|video|indir|marka|sestesti|shorts|studyo)\//;
const DEGISTIRICI = new Set(["POST", "PUT", "DELETE", "PATCH"]);

function cerezler(req) {
  const o = {};
  for (const p of String(req.headers.cookie || "").split(";")) {
    const i = p.indexOf("=");
    if (i > 0) o[p.slice(0, i).trim()] = p.slice(i + 1).trim();
  }
  return o;
}
const CEREZ_AD = "panel_oturum";
const cerezDegeri = jeton => CEREZ_AD + "=" + jeton + "; HttpOnly; SameSite=Strict; Path=/";

// Ortak basliklar (her yanita).
function guvenlikBasliklari(res, onbellek) {
  res.setHeader("Content-Security-Policy", CSP);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
  res.setHeader("Cache-Control", onbellek || "no-store");
}

// Isteklerin kapisi. Reddederse { durum, kod, hata } doner; gecerse null.
// medya: jetonu header yerine cerezle kabul eden GET yollari (<video>/<img> header gonderemez).
function kapi(req, yol, port, jeton) {
  if (!hostIzinli(req.headers.host, port))
    return { durum: 403, kod: "host", hata: "Bu adresle erişim yok; paneli http://localhost:" + port + " ile aç." };
  const yontem = req.method || "GET";
  if (DEGISTIRICI.has(yontem)) {
    if (!originIzinli(req.headers.origin, port) || !fetchSiteIzinli(req.headers["sec-fetch-site"]))
      return { durum: 403, kod: "origin", hata: "İstek başka bir siteden geldi; reddedildi." };
    if (!JSON_TURU.test(String(req.headers["content-type"] || "")))
      return { durum: 415, kod: "icerik_turu", hata: "İstek gövdesi application/json olmalı." };
  } else if (req.headers.origin !== undefined && !originIzinli(req.headers.origin, port)) {
    return { durum: 403, kod: "origin", hata: "İstek başka bir siteden geldi; reddedildi." };
  }
  // GET /api ve medya yollari da yalniz kendi sayfamizdan (same-origin) ya da dogrudan kullanici eyleminden (none) gelebilir
  // (jeton zaten sart; bu, tarayicinin gonderdigi Sec-Fetch-Site ile ikinci bir engel). Sayfa/HTML'in kendisi (top-level gezinti) serbest.
  if ((yol.startsWith("/api/") || MEDYA_YOLU.test(yol)) && !fetchSiteIzinli(req.headers["sec-fetch-site"]))
    return { durum: 403, kod: "origin", hata: "İstek başka bir siteden geldi; reddedildi." };
  if (yol.startsWith("/api/")) {
    if (!jetonEsit(String(req.headers["x-panel-token"] || ""), jeton))
      return { durum: 403, kod: "token", hata: "Oturum süresi doldu, sayfayı yenile" };
  } else if (MEDYA_YOLU.test(yol)) {
    if (!jetonEsit(cerezler(req)[CEREZ_AD] || "", jeton))
      return { durum: 403, kod: "token", hata: "Oturum süresi doldu, sayfayı yenile" };
  }
  return null;
}

// Sayfaya jeton gomer: <meta name="panel-token"> + SARMALAYICI (yukarida tanimli; CSP onun ozetini tanir).
function htmlEnjekte(html, jeton) {
  const enjeksiyon = '<meta name="panel-token" content="' + jeton + '"><script>' + SARMALAYICI + "</script>";
  const s = String(html);
  const m = s.match(/<head[^>]*>/i);
  if (m) return s.slice(0, m.index + m[0].length) + enjeksiyon + s.slice(m.index + m[0].length);
  const d = s.match(/<!doctype[^>]*>/i);
  if (d) return s.slice(0, d.index + d[0].length) + "<head>" + enjeksiyon + "</head>" + s.slice(d.index + d[0].length);
  return enjeksiyon + s;
}

module.exports = { CSP, CEREZ_AD, jetonUret, jetonEsit, hostIzinli, originIzinli, fetchSiteIzinli, cerezler, cerezDegeri,
  guvenlikBasliklari, kapi, htmlEnjekte, JSON_TURU, MEDYA_YOLU };
