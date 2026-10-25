// ARAYUZ DILI (15 dil) — kaynak metin TURKCEDIR; secili dil Turkce degilse sayfadaki metinler birebir eslesmeyle cevrilir.
// Kaynak kodda sarmalayici gerekmez: metin dugumleri ve placeholder/title/aria-label/alt nitelikleri taranir, sonradan eklenenler
// MutationObserver ile cevrilir; alert/confirm/prompt metinleri de cevrilir. Ceviri yoksa Turkce kaynak gorunur (bos/bozuk metin olmaz).
// Sozluk: /diller/<kod>.js dosyasi (window.__OTOPILOT_DIL[kod] = {"Turkce": "ceviri"}), `npm run dil:cikar` ve `npm run dil:birlestir` uretir.
// Dil secimi: sag alttaki kutu; localStorage "otopilot-dil"; ilk acilista tarayici dili desteklenen 15 dilden biriyse o, degilse Ingilizce.
// NOT: panel-public/dil.js, video-indirici/public/dil.js ve ai-infapp/public/dil.js BIREBIR AYNI dosyadir (test/dil.test.js denetler).
(function () {
  "use strict";
  var DILLER = [
    ["tr", "Türkçe"], ["en", "English"], ["es", "Español"], ["de", "Deutsch"], ["fr", "Français"], ["it", "Italiano"], ["pt", "Português"],
    ["ru", "Русский"], ["nl", "Nederlands"], ["pl", "Polski"], ["ja", "日本語"], ["ko", "한국어"], ["ar", "العربية"], ["hi", "हिन्दी"], ["zh", "中文"],
  ];
  var KODLAR = DILLER.map(function (d) { return d[0]; });
  var NITELIKLER = ["placeholder", "title", "aria-label", "alt"];
  var ATLA = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, TEXTAREA: 1, CODE: 1, PRE: 1 };
  var depo = window.__OTOPILOT_DIL = window.__OTOPILOT_DIL || {};
  var aktif = "tr";
  var sozluk = null;
  var orijinal = new WeakMap();      // dugum -> {m: Turkce metin} | {nitelik: Turkce}
  var gozlemci = null;

  function oku() { try { return window.localStorage.getItem("otopilot-dil"); } catch (e) { return null; } }
  function yaz(k) { try { window.localStorage.setItem("otopilot-dil", k); } catch (e) { /* tarayici izin vermiyor */ } }
  function normal(d) { var k = String(d || "").trim().toLowerCase().slice(0, 2); return KODLAR.indexOf(k) >= 0 ? k : null; }
  function baslangic() { return normal(oku()) || normal(navigator.language) || "en"; }

  function tam(k) { return Object.prototype.hasOwnProperty.call(sozluk, k) ? sozluk[k] : null; }
  // "11 görsel", "~0.7 dk", "Sahne 3", "12:30 önce" gibi sayili metinler: bastaki/sondaki sayi korunur, kalan metin cevrilir
  var SAYI_ON = /^([~≈<>+-]?\d[\d.,:/]*\s*%?\s*)(\D.*)$/;
  var AD_ON = /^([A-Za-z][A-Za-z0-9.+/_-]*)\s+([a-zçğıöşü].*)$/;
  var SAYI_SON = /^(.*\D)(\s*[~≈]?\d[\d.,:/]*\s*%?)$/;
  function sozlukte(metin) {
    if (!sozluk) return null;
    var k = String(metin).replace(/\s+/g, " ").trim();
    if (!k) return null;
    var c = tam(k);
    if (c != null) return c;
    var m = SAYI_ON.exec(k);
    if (m) { c = tam(m[2].trim()); if (c != null) return m[1] + c; }
    m = SAYI_SON.exec(k);
    if (m) { c = tam(m[1].trim()); if (c != null) return c + m[2]; }
    // sayi iceren sablonlar: "Ölçü 1 adı" -> anahtar "Ölçü {} adı"; sayilar sirayla geri konur
    var sayilar = k.match(/\d+(?:[.,]\d+)?/g);
    if (sayilar) {
      c = tam(k.replace(/\d+(?:[.,]\d+)?/g, "{}"));
      if (c != null) { var i = 0; return c.replace(/\{\}/g, function () { return i < sayilar.length ? sayilar[i++] : "{}"; }); }
    }
    // "Claude yok", "Pexels var": bastaki Latin ad (marka/anahtar) korunur, kalan cevrilir
    m = AD_ON.exec(k);
    if (m) { c = tam(m[2].trim()); if (c != null) return m[1] + " " + c; }
    return null;
  }
  // window.otopilotCevir("Turkce metin") — uygulama kodu da kullanabilir (ceviri yoksa metni aynen dondurur)
  function cevir(metin) {
    var c = sozlukte(metin);
    if (c == null) return metin;
    var s = String(metin), on = /^\s*/.exec(s)[0], son = /\s*$/.exec(s)[0];
    return on + c + son;
  }
  window.otopilotCevir = cevir;

  function atlanir(e) {
    for (var x = e; x && x.nodeType === 1; x = x.parentNode) {
      if (x.id === "otopilot-dil-kutusu" || ATLA[x.nodeName] || x.isContentEditable || (x.hasAttribute && x.hasAttribute("data-dil-yok"))) return true;
    }
    return false;
  }
  function metinDugumu(d) {
    var ust = d.parentNode;
    if (!ust || atlanir(ust)) return;
    var rec = orijinal.get(d);
    var simdi = d.nodeValue;
    // uygulama metni yeniden yazdiysa (bizim cevirimiz degilse) yeni Turkce kaynak odur
    if (rec && rec.cevrilen === simdi) simdi = rec.m;
    else if (rec) rec.m = simdi;
    if (aktif === "tr") { if (rec && rec.cevrilen === d.nodeValue) { d.nodeValue = rec.m; } orijinal.delete(d); return; }
    var c = sozlukte(simdi);
    if (c == null) { if (rec && rec.cevrilen === d.nodeValue) d.nodeValue = rec.m; return; }
    var s = String(simdi), on = /^\s*/.exec(s)[0], son = /\s*$/.exec(s)[0];
    var yeni = on + c + son;
    if (yeni !== d.nodeValue) { orijinal.set(d, { m: simdi, cevrilen: yeni }); d.nodeValue = yeni; }
  }
  function nitelikler(e) {
    for (var i = 0; i < NITELIKLER.length; i++) {
      var ad = NITELIKLER[i];
      if (!e.hasAttribute || !e.hasAttribute(ad)) continue;
      var rec = orijinal.get(e) || {};
      var simdi = e.getAttribute(ad);
      var kayit = rec[ad];
      if (kayit && kayit.cevrilen === simdi) simdi = kayit.m;
      if (aktif === "tr") { if (kayit && kayit.cevrilen === e.getAttribute(ad)) e.setAttribute(ad, kayit.m); delete rec[ad]; continue; }
      var c = sozlukte(simdi);
      if (c == null) continue;
      rec[ad] = { m: simdi, cevrilen: c };
      orijinal.set(e, rec);
      if (c !== e.getAttribute(ad)) e.setAttribute(ad, c);
    }
  }
  function tara(kok) {
    if (!kok) return;
    if (kok.nodeType === 3) return metinDugumu(kok);
    if (kok.nodeType !== 1 && kok.nodeType !== 9 && kok.nodeType !== 11) return;
    if (kok.nodeType === 1) { if (kok.id === "otopilot-dil-kutusu" || ATLA[kok.nodeName] || (kok.hasAttribute && kok.hasAttribute("data-dil-yok"))) return; nitelikler(kok); }
    var ic = kok.firstChild;
    while (ic) { var sonraki = ic.nextSibling; tara(ic); ic = sonraki; }
  }

  function gozle() {
    if (gozlemci || !window.MutationObserver) return;
    gozlemci = new MutationObserver(function (liste) {
      for (var i = 0; i < liste.length; i++) {
        var m = liste[i];
        if (m.type === "characterData") metinDugumu(m.target);
        else if (m.type === "attributes") nitelikler(m.target);
        else for (var j = 0; j < m.addedNodes.length; j++) tara(m.addedNodes[j]);
      }
    });
    gozlemci.observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: NITELIKLER });
  }

  function sozlukYukle(kod, bitti) {
    if (kod === "tr") return bitti({});
    if (depo[kod]) return bitti(depo[kod]);
    var s = document.createElement("script");
    s.src = "/diller/" + kod + ".js";
    s.onload = function () { bitti(depo[kod] || {}); };
    s.onerror = function () { bitti({}); };
    document.head.appendChild(s);
  }

  function uygula(kod) {
    aktif = kod;
    sozlukYukle(kod, function (s) {
      sozluk = s;
      var d = DILLER.filter(function (x) { return x[0] === kod; })[0];
      document.documentElement.setAttribute("lang", kod);
      // Arapca dahil yerlesim SOLDAN SAGA kalir (arayuz CSS'i ltr icin tasarli; dir=rtl yerlesimi bozuyordu); Arapca metin tarayicinin
      // Unicode cift yonlu algoritmasiyla dogru yonde cizilir
      document.documentElement.setAttribute("dir", "ltr");
      tara(document.documentElement);
      if (document.title) {
        var bk = document.documentElement.__baslikTr || (document.documentElement.__baslikTr = document.title);
        document.title = kod === "tr" ? bk : bk.split(" — ").map(function (p) { var c = sozlukte(p); return c == null ? p : c; }).join(" — ");
      }
      var kutu = document.getElementById("otopilot-dil-kutusu");
      if (kutu && kutu.value !== kod) kutu.value = kod;
    });
  }

  function kutuKur() {
    if (document.getElementById("otopilot-dil-kutusu") || !document.body) return;
    var k = document.createElement("select");
    k.id = "otopilot-dil-kutusu";
    k.setAttribute("aria-label", "Language");
    k.style.cssText = "position:fixed;right:10px;bottom:10px;z-index:99999;padding:4px 6px;font:12px system-ui,sans-serif;border:1px solid rgba(128,128,128,.5);border-radius:6px;background:rgba(255,255,255,.92);color:#222;opacity:.85;cursor:pointer";
    DILLER.forEach(function (d) { var o = document.createElement("option"); o.value = d[0]; o.textContent = d[1]; k.appendChild(o); });
    k.value = aktif;
    k.addEventListener("change", function () { yaz(k.value); uygula(k.value); });
    document.body.appendChild(k);
  }

  // alert / confirm / prompt metinleri
  ["alert", "confirm", "prompt"].forEach(function (ad) {
    var asil = window[ad];
    if (typeof asil !== "function") return;
    window[ad] = function (metin) { var a = Array.prototype.slice.call(arguments); a[0] = cevir(metin); return asil.apply(window, a); };
  });

  function basla() {
    aktif = baslangic();
    gozle();
    kutuKur();
    if (aktif !== "tr") uygula(aktif);
    else document.documentElement.setAttribute("lang", "tr");
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", basla); else basla();
  window.otopilotDil = { diller: DILLER, secili: function () { return aktif; }, sec: function (k) { k = normal(k); if (k) { yaz(k); uygula(k); } } };
})();
