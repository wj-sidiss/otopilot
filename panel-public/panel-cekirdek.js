// PANEL ARAYUZU — cekirdek: DOM yardimcilari, API istemcisi, ortak bilesenler, yonlendirme.
// Kural: sunucudan gelen veri ASLA innerHTML ile basilmaz; her sey createElement + textContent ile kurulur.
// Siniflar sunucu sozlesmesinden bagimsizdir; uc adlari panel.js'teki gercek tabloya gore kullanilir.
(function () {
  "use strict";
  var P = window.P = { surum: 1 };
  var SVGNS = "http://www.w3.org/2000/svg";

  // ---------------------------------------------------------------- DOM
  function ekle(ata, c) {
    if (c === null || c === undefined || c === false || c === true) return;
    if (Array.isArray(c)) { for (var i = 0; i < c.length; i++) ekle(ata, c[i]); return; }
    if (c instanceof Node) { ata.appendChild(c); return; }
    ata.appendChild(document.createTextNode(String(c)));
  }
  var OZELLIK = { value: 1, checked: 1, disabled: 1, hidden: 1, selected: 1, required: 1, readOnly: 1, multiple: 1, indeterminate: 1 };
  function ozellikUygula(el, oz, sonra) {
    for (var k in oz) {
      if (!Object.prototype.hasOwnProperty.call(oz, k)) continue;
      var v = oz[k];
      if (k === "class") { if (v) el.className = v; continue; }
      if (k === "text") { el.textContent = v; continue; }
      if (k === "dataset") { for (var d in v) if (v[d] !== null && v[d] !== undefined) el.dataset[d] = v[d]; continue; }
      if (k === "style") { if (typeof v === "string") el.style.cssText = v; else for (var s in v) el.style.setProperty(s, v[s]); continue; }
      if (k.slice(0, 2) === "on" && typeof v === "function") { el.addEventListener(k.slice(2), v); continue; }
      if (OZELLIK[k]) { if (k === "value") sonra.push([k, v]); else el[k] = !!v; continue; }
      if (v === null || v === undefined || v === false) continue;
      el.setAttribute(k, v === true ? "" : String(v));
    }
  }
  // h("div", {class:"x"}, "metin", el, [..]) — ilk arguman dizi/Node/metin ise ozellik sayilmaz
  P.h = function (etiket, oz) {
    var el = document.createElement(etiket), i = 1, sonra = [];
    if (oz !== null && typeof oz === "object" && !Array.isArray(oz) && !(oz instanceof Node)) { ozellikUygula(el, oz, sonra); i = 2; }
    for (; i < arguments.length; i++) ekle(el, arguments[i]);
    for (var j = 0; j < sonra.length; j++) el[sonra[j][0]] = sonra[j][1];
    return el;
  };
  P.$ = function (s, kok) { return (kok || document).querySelector(s); };
  P.$$ = function (s, kok) { return Array.prototype.slice.call((kok || document).querySelectorAll(s)); };
  P.bos = function (el) { while (el.firstChild) el.removeChild(el.firstChild); return el; };
  P.degistir = function (el) {
    P.bos(el);
    for (var i = 1; i < arguments.length; i++) ekle(el, arguments[i]);
    return el;
  };
  P.ikon = function (ad, ek) {
    var s = document.createElementNS(SVGNS, "svg");
    s.setAttribute("class", "ik" + (ek ? " " + ek : ""));
    s.setAttribute("aria-hidden", "true"); s.setAttribute("focusable", "false");
    var u = document.createElementNS(SVGNS, "use");
    u.setAttribute("href", "#i-" + ad);
    s.appendChild(u);
    return s;
  };
  // dugme(etiket, {ikon, tur:"birincil|tehlike|hafif", kucuk, onclick, title, aria, disabled, sinif, ikonsuz})
  P.dugme = function (etiket, o) {
    o = o || {};
    var oz = { type: o.type || "button", class: "btn" + (o.tur ? " " + o.tur : "") + (o.kucuk ? " kucuk" : "") + (o.sinif ? " " + o.sinif : "") };
    if (o.onclick) oz.onclick = o.onclick;
    if (o.title) oz.title = o.title;
    if (o.aria) oz["aria-label"] = o.aria;
    if (o.disabled) oz.disabled = true;
    return P.h("button", oz, o.ikon ? P.ikon(o.ikon) : null, etiket ? P.h("span", null, etiket) : null);
  };
  // baglanti(etiket, href, {ikon, kucuk, indir:true, yeni:true})
  P.baglanti = function (etiket, href, o) {
    o = o || {};
    var oz = { class: "btn" + (o.tur ? " " + o.tur : "") + (o.kucuk ? " kucuk" : ""), href: href };
    if (o.indir) oz.download = "";
    if (o.yeni) { oz.target = "_blank"; oz.rel = "noopener noreferrer"; }
    if (o.title) oz.title = o.title;
    return P.h("a", oz, o.ikon ? P.ikon(o.ikon) : null, P.h("span", null, etiket));
  };
  // rozet(etiket, tur:"ok|hata|uyari|vurgu|soluk", ikonAd)
  P.rozet = function (etiket, tur, ikonAd) {
    return P.h("span", { class: "rozet" + (tur ? " r-" + tur : "") }, ikonAd ? P.ikon(ikonAd) : null, etiket);
  };
  // bolum(baslik, aciklama, ...icerik) — sol baslik / sag icerik sayfa duzeni
  P.bolum = function (baslik, aciklama) {
    var govde = P.h("div", { class: "bolum-govde" });
    for (var i = 2; i < arguments.length; i++) ekle(govde, arguments[i]);
    var b = P.h("section", { class: "bolum" },
      P.h("header", { class: "bolum-ust" }, P.h("h3", null, baslik), aciklama ? P.h("p", { class: "soluk" }, aciklama) : null),
      govde);
    b.govde = govde;
    return b;
  };

  // ---------------------------------------------------------------- form yardimcilari
  var _id = 0;
  P.yeniId = function (onek) { return (onek || "a") + "-" + (++_id); };
  // alan(etiket, kontrol, {ipucu, sinif}) — etiketi `for` ile baglar
  P.alan = function (etiket, kontrol, o) {
    o = o || {};
    var id = kontrol.id || (kontrol.id = P.yeniId("f"));
    var ip = o.ipucu ? P.h("div", { class: "ipucu", id: id + "-ip" }, o.ipucu) : null;
    if (ip) kontrol.setAttribute("aria-describedby", id + "-ip");
    return P.h("div", { class: "alan" + (o.sinif ? " " + o.sinif : "") }, P.h("label", { for: id }, etiket), kontrol, ip);
  };
  P.girdi = function (o) {
    o = o || {};
    var oz = { type: o.type || "text", autocomplete: "off", spellcheck: "false" };
    for (var k in o) if (k !== "type" && k !== "deger") oz[k] = o[k];
    if (o.deger !== undefined && o.deger !== null) oz.value = o.deger;
    return P.h("input", oz);
  };
  // secim([[deger,etiket] | {grup, s:[[d,e]]}], deger, ozellik)
  P.secim = function (liste, deger, oz) {
    var s = P.h("select", oz || null);
    liste.forEach(function (x) {
      if (Array.isArray(x)) s.appendChild(P.h("option", { value: x[0] }, x[1]));
      else s.appendChild(P.h("optgroup", { label: x.grup }, x.s.map(function (y) { return P.h("option", { value: y[0] }, y[1]); })));
    });
    if (deger !== undefined && deger !== null) s.value = deger;
    return s;
  };
  P.metinAlani = function (o) { o = o || {}; var oz = { spellcheck: "false" }; for (var k in o) if (k !== "deger") oz[k] = o[k]; var t = P.h("textarea", oz); if (o.deger) t.value = o.deger; return t; };
  // onayKutusu(etiket, isaretli) -> <label class=onay> ; .girdi = checkbox
  P.onayKutusu = function (etiket, isaretli, oz) {
    var g = P.h("input", Object.assign({ type: "checkbox" }, oz || {}));
    g.checked = !!isaretli;
    var l = P.h("label", { class: "onay" }, g, P.h("span", null, etiket));
    l.girdi = g;
    return l;
  };
  // sunucu {alanlar:[{alan,mesaj}]} yanitini alanlara isler; ilk hatali alana odaklanir
  P.alanHatalari = function (kok, alanlar) {
    P.$$("[aria-invalid]", kok).forEach(function (e) { e.removeAttribute("aria-invalid"); });
    P.$$(".alan-hata", kok).forEach(function (e) { e.remove(); });
    var ilk = null;
    (alanlar || []).forEach(function (a) {
      var ad = String(a.alan || "").replace(/["\\]/g, "\\$&");
      var el = ad ? P.$('[data-alan="' + ad + '"]', kok) : null;
      if (!el) return;
      el.setAttribute("aria-invalid", "true");
      var kap = el.closest(".alan") || el.parentNode;
      kap.appendChild(P.h("div", { class: "alan-hata" }, a.mesaj));
      if (!ilk) ilk = el;
    });
    if (ilk) ilk.focus();
    return !!ilk;
  };

  // ---------------------------------------------------------------- bicimlendirme
  P.sayi = function (n) { return Number(n || 0).toLocaleString("tr-TR"); };
  P.sureYaz = function (sn) {
    sn = Math.max(0, Math.round(Number(sn) || 0));
    var s = sn % 60, d = Math.floor(sn / 60) % 60, sa = Math.floor(sn / 3600);
    var iki = function (x) { return (x < 10 ? "0" : "") + x; };
    return sa ? sa + ":" + iki(d) + ":" + iki(s) : d + ":" + iki(s);
  };
  P.boyutYaz = function (mb) { mb = Number(mb) || 0; return mb >= 1024 ? (mb / 1024).toFixed(1).replace(".", ",") + " GB" : (mb >= 10 ? Math.round(mb) : mb.toFixed(1).replace(".", ",")) + " MB"; };
  P.tarihYaz = function (x) {
    var d = new Date(x); if (isNaN(d.getTime())) return "";
    return d.toLocaleString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  };
  P.goreli = function (x) {
    var ms = Date.now() - new Date(x).getTime();
    if (isNaN(ms)) return "";
    var dk = Math.round(ms / 60000);
    if (dk < 1) return "az önce";
    if (dk < 60) return dk + " dk önce";
    if (dk < 1440) return Math.round(dk / 60) + " sa önce";
    return Math.round(dk / 1440) + " gün önce";
  };
  P.kisalt = function (m, n) { m = String(m == null ? "" : m); return m.length > n ? m.slice(0, n - 1).trimEnd() + "…" : m; };
  P.kelimeSay = function (m) { var t = String(m || "").trim(); return t ? t.split(/\s+/).length : 0; };
  P.paragrafSay = function (m) { return P.paragraflar(m).length; };
  P.paragraflar = function (m) { return String(m || "").replace(/\r\n/g, "\n").split(/\n\s*\n/).map(function (x) { return x.trim(); }).filter(Boolean); };
  // kelime hizi: en 151, tr 113 (olculdu), digerleri 140 (tahmin) — lib/ortak.js ile ayni
  P.kelimeHizi = function (dil) { dil = String(dil || "en").slice(0, 2).toLowerCase(); return dil === "en" ? 151 : dil === "tr" ? 113 : 140; };
  P.kok = function (s) { return String(s == null ? "" : s); };

  // ---------------------------------------------------------------- sabitler (lib/ortak.js ile eslesir)
  P.GECISLER = [
    { grup: "Klasik", s: [["fade", "Yumuşak geçiş (fade)"], ["dissolve", "Erime (dissolve)"], ["fadeblack", "Siyaha kararma"], ["fadewhite", "Beyaza patlama"]] },
    { grup: "Kaydırma", s: [["slideleft", "Sola kaydır"], ["slideright", "Sağa kaydır"], ["slideup", "Yukarı kaydır"], ["slidedown", "Aşağı kaydır"], ["smoothleft", "Yumuşak sol"], ["smoothright", "Yumuşak sağ"]] },
    { grup: "Silme", s: [["wipeleft", "Sil — sol"], ["wiperight", "Sil — sağ"], ["wipeup", "Sil — yukarı"], ["wipedown", "Sil — aşağı"], ["wipetl", "Sil — köşeden"]] },
    { grup: "Şekil", s: [["circleopen", "Daire açılma"], ["circleclose", "Daire kapanma"], ["circlecrop", "Daire kırpma"], ["rectcrop", "Kare kırpma"], ["radial", "Radyal süpürme"], ["vertopen", "Dikey açılma"], ["horzopen", "Yatay açılma"]] },
    { grup: "Efektli", s: [["pixelize", "Pikselleşme"], ["hblur", "Bulanıklaşma"], ["distance", "Mesafe"], ["squeezeh", "Yatay sıkışma"], ["squeezev", "Dikey sıkışma"], ["diagtl", "Çapraz"], ["hlslice", "Dilimleme"]] }
  ];
  P.EFEKTLER = [["zoom", "Normal zoom (Ken Burns)"], ["yavas", "Yavaş zoom — sakin"], ["hizli", "Hızlı zoom — enerjik"], ["kaydir", "Yana kaydırma (pan)"], ["yok", "Hareket yok — sabit"]];
  P.RENKLER = [["sinematik", "Sinematik — koyu, soğuk"], ["sicak", "Sıcak — turuncu"], ["soguk", "Soğuk — mavi, gece"], ["canli", "Canlı — doygun, parlak"], ["siyahbeyaz", "Siyah-beyaz"], ["yok", "Dokunma — orijinal"]];
  P.MUZIK_RUHLARI = [["sakin", "Sakin"], ["gerilim", "Gerilim"], ["umut", "Umut"], ["enerjik", "Enerjik"], ["otomatik", "Otomatik"]];
  P.TURLER = [["belgesel", "Belgesel"], ["reklam", "Reklam"], ["haber-spor", "Haber / spor"], ["egitim", "Eğitim"], ["hikaye", "Hikâye"], ["tanitim", "Tanıtım"]];
  P.SES_MOTORLARI = [["otomatik", "Otomatik (önce Edge, olmazsa sıradaki)"], ["edge", "Edge sesli okuma (resmî değil)"], ["azure", "Azure Speech (resmî, anahtar ister)"], ["piper", "Piper (yerel, çevrimdışı)"], ["voxcpm", "VoxCPM2 (yerel ekran kartı, doğal ses)"], ["sistem", "İşletim sistemi sesi (kurulum yok, orta kalite)"]];
  P.FORMATLAR = {
    long:   { etiket: "YouTube uzun video", kisa: "UZUN", oran: "16:9", varsSn: 900, not: "Yatay 16:9. Öneri 15 dk." },
    short:  { etiket: "YouTube Shorts", kisa: "SHORTS", oran: "9:16", varsSn: 40, teknikMax: 180, not: "Dikey 9:16. Üst sınır 3 dakika (180 sn); güncel kuralı YouTube Yardım'dan teyit et." },
    reels:  { etiket: "Instagram Reels", kisa: "REELS", oran: "9:16", varsSn: 180, teknikMax: 1200, not: "Dikey 9:16. Panelde kayıtlı teknik sınır 20 dk; Instagram Yardım'dan teyit et." },
    tiktok: { etiket: "TikTok", kisa: "TIKTOK", oran: "9:16", varsSn: 60, teknikMax: 600, not: "Dikey 9:16. Panelde kayıtlı teknik sınır 10 dk; TikTok Yardım'dan teyit et." }
  };
  P.DILLER = [["en", "İngilizce"], ["tr", "Türkçe"], ["es", "İspanyolca"], ["de", "Almanca"], ["fr", "Fransızca"], ["it", "İtalyanca"], ["pt", "Portekizce"], ["ru", "Rusça"], ["nl", "Hollandaca"], ["pl", "Lehçe"], ["ja", "Japonca"], ["ko", "Korece"], ["ar", "Arapça"], ["hi", "Hintçe"]];
  P.SESLER = {
    en: ["en-US-ChristopherNeural", "en-US-GuyNeural", "en-US-EricNeural", "en-US-AriaNeural", "en-US-JennyNeural", "en-GB-RyanNeural", "en-GB-SoniaNeural"],
    tr: ["tr-TR-AhmetNeural", "tr-TR-EmelNeural"],
    es: ["es-ES-AlvaroNeural", "es-ES-ElviraNeural", "es-MX-JorgeNeural", "es-MX-DaliaNeural"],
    de: ["de-DE-ConradNeural", "de-DE-KatjaNeural"], fr: ["fr-FR-HenriNeural", "fr-FR-DeniseNeural"],
    it: ["it-IT-DiegoNeural", "it-IT-ElsaNeural"], pt: ["pt-BR-AntonioNeural", "pt-BR-FranciscaNeural"],
    ru: ["ru-RU-DmitryNeural", "ru-RU-SvetlanaNeural"], nl: ["nl-NL-MaartenNeural", "nl-NL-ColetteNeural"],
    pl: ["pl-PL-MarekNeural", "pl-PL-ZofiaNeural"], ja: ["ja-JP-KeitaNeural", "ja-JP-NanamiNeural"],
    ko: ["ko-KR-InJoonNeural", "ko-KR-SunHiNeural"], ar: ["ar-SA-HamedNeural", "ar-SA-ZariyahNeural"], hi: ["hi-IN-MadhurNeural", "hi-IN-SwaraNeural"]
  };
  P.SES_HIZLARI = ["-15%", "-10%", "-5%", "+0%", "+5%", "+7%", "+10%", "+15%", "+20%"];
  P.dilAdi = function (k) { for (var i = 0; i < P.DILLER.length; i++) if (P.DILLER[i][0] === k) return P.DILLER[i][1]; return String(k || "").toUpperCase(); };
  P.varsayilanSes = function (dil) { var l = P.SESLER[String(dil || "en").slice(0, 2)] || P.SESLER.en; return l[0]; };
  P.UCRETLI = { senaryo: 1, senaryoV: 1, baslikOn: 1, baslik: 1, ceviri: 1, trend: 1, viral: 1, performans: 1 };
  P.DURUMLAR = {
    yeni: ["Yeni", "soluk"], sirada: ["Sırada", "uyari"], calisiyor: ["Çalışıyor", "vurgu"], onay_bekliyor: ["Onay bekliyor", "uyari"],
    bitti: ["Hazır", "ok"], hata: ["Hata", "hata"], durduruldu: ["Durduruldu", "soluk"]
  };
  P.durumRozeti = function (d) {
    var x = P.DURUMLAR[d] || [d || "—", "soluk"];
    var ik = { calisiyor: "yukleniyor", sirada: "saat", onay_bekliyor: "duraklat", bitti: "tamam", hata: "hata", durduruldu: "durdur" }[d];
    return P.rozet(x[0], x[1], ik);
  };

  // ---------------------------------------------------------------- API istemcisi
  class ApiHata extends Error {
    constructor(o) {
      super(o.hata || "Hata");
      this.name = "ApiHata";
      this.durum = o.durum || 0; this.kod = o.kod || "hata"; this.hata = o.hata || "Beklenmeyen hata";
      this.cozum = o.cozum; this.detay = o.detay; this.satir = o.satir; this.sutun = o.sutun;
      this.alanlar = o.alanlar; this.sorunlar = o.sorunlar; this.id = o.id;
    }
  }
  P.ApiHata = ApiHata;
  var jetonMeta = (document.querySelector('meta[name="panel-token"]') || {}).content || "";
  // api(url) -> GET ; api(url, govde) -> POST JSON. Hata: ApiHata (ag kopmasi kod="ag")
  P.api = async function (url, govde, secenek) {
    secenek = secenek || {};
    var yontem = govde === undefined ? "GET" : "POST";
    var baslik = {};
    if (jetonMeta) baslik["X-Panel-Token"] = jetonMeta;
    if (yontem === "POST") baslik["Content-Type"] = "application/json";
    var ac = new AbortController();
    var zt = setTimeout(function () { ac.abort(); }, secenek.zamanAsimi || 25000);
    var r;
    try {
      r = await fetch(url, { method: yontem, headers: baslik, body: yontem === "POST" ? JSON.stringify(govde) : undefined, cache: "no-store", signal: ac.signal });
    } catch (e) {
      clearTimeout(zt);
      P.ag.sorun();
      throw new ApiHata({ durum: 0, kod: "ag", hata: e && e.name === "AbortError" ? "Sunucu zamanında yanıt vermedi." : "Panele ulaşılamıyor; panel kapanmış olabilir.", cozum: "Panel penceresini kontrol et; kapalıysa PANEL.bat ile yeniden başlat." });
    }
    clearTimeout(zt);
    P.ag.tamam();
    var veri = null;
    try { veri = await r.json(); } catch (e) { veri = null; }
    if (!r.ok) {
      var h = veri && typeof veri === "object" ? veri : {};
      if (r.status === 403 && h.kod === "token") P.ag.oturum();
      throw new ApiHata({ durum: r.status, kod: h.kod, hata: h.hata || ("Sunucu hatası (HTTP " + r.status + ")"), cozum: h.cozum, detay: h.detay, satir: h.satir, sutun: h.sutun, alanlar: h.alanlar, sorunlar: h.sorunlar, id: h.id });
    }
    return veri;
  };
  P.hataMetni = function (e) { return e && e.hata ? e.hata : (e && e.message) || "Beklenmeyen hata"; };

  // ---------------------------------------------------------------- mesajlar / bildirimler
  var MESAJ_IKON = { ok: "tamam", hata: "hata", uyari: "uyari", bilgi: "bilgi" };
  // mesajKutusu("hata", ...icerik)
  P.mesajKutusu = function (tur) {
    var govde = P.h("div", { class: "mesaj-govde" });
    for (var i = 1; i < arguments.length; i++) ekle(govde, arguments[i]);
    return P.h("div", { class: "mesaj m-" + tur, role: tur === "hata" ? "alert" : "status" }, P.ikon(MESAJ_IKON[tur] || "bilgi"), govde);
  };
  // ApiHata -> mesaj kutusu (cozum, alan hatalari, onkontrol sorunlari, ayrinti)
  P.hataKutusu = function (e, baslik) {
    // birden cok alan hatasi: sunucunun uzun birlesik mesaji yerine kisa baslik + madde listesi (tekrar yok)
    var coklu = !!(e && e.alanlar && e.alanlar.length > 1);
    var ic = [P.h("strong", null, baslik || (coklu ? "Bazı alanlar geçersiz — işaretli alanları düzelt." : P.hataMetni(e)))];
    if (baslik) ic.push(P.h("p", null, coklu ? "Bazı alanlar geçersiz." : P.hataMetni(e)));
    // sunucunun konu.json mesajı konumu zaten içerir ("... (satır 3, sütun 7)"): tekrar yazma
    if (e && e.satir && !/sat[ıi]r\s*\d+/i.test(P.hataMetni(e))) ic.push(P.h("p", { class: "soluk" }, "Satır " + e.satir + (e.sutun ? ", sütun " + e.sutun : "") + "."));
    if (coklu) ic.push(P.h("ul", null, e.alanlar.slice(0, 10).map(function (a) { return P.h("li", null, P.h("code", null, a.alan), " — " + a.mesaj); }),
      e.alanlar.length > 10 ? P.h("li", { class: "soluk" }, "…ve " + (e.alanlar.length - 10) + " alan daha") : null));
    // sunucu ayni sorunu hem basliga hem listeye koyuyor: basliktakini listeden at (tekrar yok); cozumu asagida bir kez gosterilir
    var digerSorunlar = e && e.sorunlar ? e.sorunlar.filter(function (s) { return (s.mesaj || "") !== (e.hata || ""); }) : [];
    if (digerSorunlar.length) ic.push(P.h("ul", null, digerSorunlar.slice(0, 8).map(function (s) { return P.h("li", null, s.mesaj || (s.sira ? s.sira + ". iş" : ""), s.cozum ? P.h("span", { class: "soluk" }, " — " + s.cozum) : null); })));
    if (e && e.cozum) ic.push(P.h("p", { class: "cozum" }, P.ikon("ok-sag"), e.cozum));
    if (e && e.detay) ic.push(P.h("details", null, P.h("summary", null, "Ayrıntı"), P.h("pre", null, typeof e.detay === "string" ? e.detay : JSON.stringify(e.detay, null, 2))));
    return P.mesajKutusu("hata", ic);
  };
  // yer'i temizleyip yeni mesaj yazar; icerik null ise sadece temizler
  P.durumYaz = function (yer, tur, icerik) {
    if (!yer) return;
    P.bos(yer);
    if (!tur) return;
    yer.appendChild(tur === "hata" && icerik instanceof ApiHata ? P.hataKutusu(icerik) : P.mesajKutusu(tur, icerik));
  };
  var bildirimSayac = 0;
  P.bildir = function (metin, tur) {
    var kap = document.getElementById("bildirimler"); if (!kap) return;
    var id = "b" + (++bildirimSayac);
    var kapat = function () { var e = document.getElementById(id); if (e) e.remove(); };
    var e = P.h("div", { class: "bildirim m-" + (tur || "bilgi"), id: id }, P.ikon(MESAJ_IKON[tur] || "bilgi"), P.h("span", null, metin),
      P.h("button", { type: "button", class: "ikon-btn", "aria-label": "Bildirimi kapat", onclick: kapat }, P.ikon("kapat")));
    kap.appendChild(e);
    while (kap.children.length > 4) kap.removeChild(kap.firstChild);
    setTimeout(kapat, tur === "hata" ? 9000 : 4500);
  };
  // satir ici onay. kap'in sonuna onay kutusu ekler; true/false doner.
  // o: {baslik, metin (metin|Node), evet, hayir, tehlikeli}
  P.onayIste = function (kap, o) {
    return new Promise(function (coz) {
      var eskiKutu = P.$(".onay-kutu", kap); if (eskiKutu) eskiKutu.remove();
      var tetik = document.activeElement;                // onay kapaninca odak bu dugmeye doner (klavye kullanicisi yolunu kaybetmesin)
      var bitti = false;
      var kutu;
      var bit = function (v) {
        if (bitti) return; bitti = true; kutu.remove();
        if (tetik && tetik !== document.body && tetik.isConnected && !tetik.disabled && tetik.focus) { try { tetik.focus({ preventScroll: true }); } catch (e) { /* yoksay */ } }
        coz(v);
      };
      var evet = P.dugme(o.evet || "Evet, devam et", { tur: o.tehlikeli ? "tehlike" : "birincil", onclick: function () { bit(true); } });
      var hayir = P.dugme(o.hayir || "Vazgeç", { tur: "hafif", onclick: function () { bit(false); } });
      kutu = P.h("div", { class: "onay-kutu" + (o.tehlikeli ? " tehlikeli" : ""), role: "group", "aria-label": o.baslik || "Onay",
        onkeydown: function (ev) { if (ev.key === "Escape") { ev.stopPropagation(); bit(false); } } },
        P.h("strong", null, o.baslik || "Emin misin?"),
        o.metin ? P.h("div", { class: "onay-metin" }, o.metin) : null,
        P.h("div", { class: "satir" }, evet, hayir));
      kap.appendChild(kutu);
      evet.focus();
    });
  };
  P.kopyala = function (metin, dugme) {
    var bitir = function (ok) {
      P.bildir(ok ? "Kopyalandı." : "Kopyalanamadı — metni elle seçip kopyala.", ok ? "ok" : "hata");
      if (ok && dugme) { dugme.classList.add("kopyalandi"); setTimeout(function () { dugme.classList.remove("kopyalandi"); }, 1500); }
    };
    var yedek = function () {
      var t = P.h("textarea", { style: { position: "fixed", left: "-9999px", top: "0" }, "aria-hidden": "true" });
      t.value = metin; document.body.appendChild(t); t.select();
      var ok = false; try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
      t.remove(); bitir(ok);
    };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(metin).then(function () { bitir(true); }, yedek);
    else yedek();
  };
  P.kopyaDugmesi = function (etiket, alMetin, o) {
    var b = P.dugme(etiket || "Kopyala", { ikon: "kopyala", kucuk: true, tur: "hafif", onclick: function () { P.kopyala(typeof alMetin === "function" ? alMetin() : alMetin, b); } });
    if (o && o.title) b.title = o.title;
    return b;
  };

  // ---------------------------------------------------------------- tarayici deposu (yalniz kisisel kolaylik; her erisim try/catch)
  P.depo = {
    oku: function (k, v) { try { var s = sessionStorage.getItem("panel." + k); return s === null ? v : JSON.parse(s); } catch (e) { return v; } },
    yaz: function (k, v) { try { sessionStorage.setItem("panel." + k, JSON.stringify(v)); } catch (e) { /* kapali olabilir */ } },
    sil: function (k) { try { sessionStorage.removeItem("panel." + k); } catch (e) { /* kapali olabilir */ } }
  };

  // ---------------------------------------------------------------- olay yolu
  var dinleyiciler = {};
  P.olay = {
    dinle: function (ad, fn) { (dinleyiciler[ad] = dinleyiciler[ad] || []).push(fn); },
    yay: function (ad, v) { (dinleyiciler[ad] || []).slice().forEach(function (f) { try { f(v); } catch (e) { console.error(e); } }); }
  };

  // ---------------------------------------------------------------- ag durumu
  var ardisikHata = 0, bannerTur = null;
  function bannerGoster(tur) {
    var b = document.getElementById("ag-uyari"); if (!b || bannerTur === tur) return;
    bannerTur = tur;
    P.degistir(b, P.ikon("uyari"),
      P.h("span", null, tur === "oturum" ? "Oturum süresi doldu — panel yeniden başlatılmış olabilir. Sayfayı yenile." : "Panele ulaşılamıyor. Panel penceresi kapanmış olabilir; açıksa bağlantı geri gelince burası kendiliğinden kapanır."),
      P.dugme("Sayfayı yenile", { kucuk: true, ikon: "yenile", onclick: function () { location.reload(); } }));
    b.hidden = false;
  }
  P.ag = {
    sorun: function () { ardisikHata++; if (ardisikHata >= 2 && bannerTur !== "oturum") bannerGoster("ag"); },
    tamam: function () {
      var onceki = ardisikHata; ardisikHata = 0;
      if (bannerTur === "ag") { bannerTur = null; var b = document.getElementById("ag-uyari"); if (b) b.hidden = true; P.olay.yay("ag-geri"); }
      return onceki;
    },
    oturum: function () { bannerGoster("oturum"); }
  };

  // ---------------------------------------------------------------- yoklayici (cakismayan, sekme gizliyken yavas)
  // yokla(fn, araMs: ()=>ms) -> {simdi(), durdur()}
  P.yokla = function (fn, ara) {
    var t = null, dur = false, kosuyor = false;
    function planla(ms) { if (dur) return; clearTimeout(t); t = setTimeout(kos, ms); }
    function sonraki() { var ms = ara(); return document.hidden ? Math.max(ms * 4, 8000) : ms; }
    async function kos() {
      if (kosuyor || dur) return;
      kosuyor = true;
      try { await fn(); } catch (e) { /* ag hatasi api() icinde isleniyor */ }
      kosuyor = false; planla(sonraki());
    }
    document.addEventListener("visibilitychange", function () { if (!document.hidden && !dur) { clearTimeout(t); kos(); } });
    planla(0);
    return { simdi: function () { clearTimeout(t); return kos(); }, durdur: function () { dur = true; clearTimeout(t); } };
  };

  // ---------------------------------------------------------------- ortak veri
  P.ayar = null;
  P.ayarYukle = async function () { P.ayar = await P.api("/api/ayarlar"); P.olay.yay("ayar", P.ayar); return P.ayar; };
  P.ozellikler = null;
  P.ozellikYukle = async function () { try { P.ozellikler = await P.api("/api/ozellikler"); } catch (e) { P.ozellikler = P.ozellikler || {}; } return P.ozellikler; };
  // kaydedilmemis degisiklik tutan formlar (sayfadan cikmadan once uyarir)
  P.kirli = new Set();
  window.addEventListener("beforeunload", function (e) { if (P.kirli.size) { e.preventDefault(); e.returnValue = ""; } });

  // ---------------------------------------------------------------- yonlendirme (#/gorunum/parca/parca)
  var kayit = {}, siraListe = [], aktif = null, kokler = {};
  P.gorunumKaydet = function (ad, o) { o.ad = ad; kayit[ad] = o; siraListe.push(ad); };
  function rotaCoz() {
    var h = location.hash.replace(/^#\/?/, "");
    var p = h ? h.split("/").map(function (x) { try { return decodeURIComponent(x); } catch (e) { return x; } }) : [];
    return { gorunum: p[0] || "videolar", parcalar: p.slice(1) };
  }
  P.rota = function () { return rotaCoz(); };
  P.git = function (yol) {
    var h = "#/" + yol.split("/").map(encodeURIComponent).join("/");
    if (location.hash === h) P.rotaUygula(false); else location.hash = h;
  };
  var sonRota = null;
  P.rotaUygula = function (odak) {
    var r = rotaCoz(), ad = kayit[r.gorunum] ? r.gorunum : "videolar";
    // odak yalniz gorunum ya da is degisince basliga tasinir; sekme degisiminde (ok tuslariyla gezen kullanici) yerinde kalir
    var degisti = !sonRota || sonRota.ad !== ad || sonRota.p0 !== r.parcalar[0];
    sonRota = { ad: ad, p0: r.parcalar[0] };
    if (aktif && aktif !== ad) { kokler[aktif].hidden = true; if (kayit[aktif].birak) kayit[aktif].birak(); }
    if (!kokler[ad]) {
      var kok = P.h("section", { class: "goruntu", id: "g-" + ad });
      document.getElementById("ana").appendChild(kok);
      kokler[ad] = kok;
      kayit[ad].kur(kok);
    }
    kokler[ad].hidden = false; aktif = ad;
    kayit[ad].ac(r.parcalar);
    P.$$("#menu button").forEach(function (b) { if (b.dataset.g === ad) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current"); });
    document.title = kayit[ad].baslik + " — Otopilot";
    if (odak && degisti) {
      var hedef = kayit[ad].odak ? kayit[ad].odak(r.parcalar) : P.$("h1", kokler[ad]);
      if (hedef) hedef.focus({ preventScroll: true });
    }
  };
  P.menuKur = function () {
    var m = document.getElementById("menu"); P.bos(m);
    siraListe.forEach(function (ad) {
      var g = kayit[ad];
      m.appendChild(P.h("button", { type: "button", "data-g": ad, onclick: function () { P.git(ad === "videolar" ? "videolar" : ad); } }, P.ikon(g.ikon), P.h("span", null, g.baslik)));
    });
  };
  // sayfa basligi (h1) — her gorunumde ayni bicim
  P.sayfaBasligi = function (id, baslik, aciklama, ...sag) {
    return P.h("header", { class: "sayfa-baslik" },
      P.h("div", null, P.h("h1", { tabindex: "-1", id: id }, baslik), aciklama ? P.h("p", { class: "soluk" }, aciklama) : null),
      sag.length ? P.h("div", { class: "satir" }, sag) : null);
  };
})();
