// PANEL ARAYUZU — is sayfasi / "Gorunum" ve "Ses ve dil" sekmeleri. Uc: POST /api/gorunum {is, ...alanlar}.
// Sunucu semantigi: alan null => konu.json'dan SILINIR (varsayilana doner); "" => yok sayilir; sayi/mantik tipleri dogrulanir (400 + alanlar).
// Bu dosya yalniz DEGISEN alanlari gonderir: dokunulmayan alan konu.json'daki hâliyle kalir, varsayilanlar elle yazilmaz.
(function () {
  "use strict";
  var P = window.P;

  // konuEtkin varsayilanlari (lib/ortak.js konuBirlestir): [geriSayim, intro, konuKarti, outro]
  var KS = { short: [0, 1.5, 0, 3], reels: [0, 1.5, 0, 0], tiktok: [0, 1.5, 0, 0], long: [5, 8, 2.5, 12] };
  function varsayilanSure(format, i) { return (KS[format] || KS.long)[i]; }

  // ---------------------------------------------------------------- alan tanimlari: {ad, doldur(raw, ctx), degisim(raw, ctx) -> null | {v} | {hata}}
  var yok = function (r) { return r === undefined || r === null; };
  function sSec(ad, k) {
    return { ad: ad, kontrol: k,
      doldur: function (r) { var v = yok(r) ? "" : String(r); k.value = v; if (k.value !== v) { k.appendChild(P.h("option", { value: v }, v + " (özel)")); k.value = v; } },
      degisim: function (r) { var yeni = k.value, eski = yok(r) ? "" : String(r); return yeni === eski ? null : { v: yeni === "" ? null : yeni }; } };
  }
  function sSayi(ad, k) {
    return { ad: ad, kontrol: k,
      doldur: function (r) { k.value = yok(r) ? "" : String(r); },
      degisim: function (r) {
        var s = k.value.trim(), eski = yok(r) ? "" : String(r);
        if (s === eski) return null;
        if (s === "") return { v: null };
        var n = Number(s.replace(",", "."));
        if (!isFinite(n)) return { hata: "sayı olmalı" };
        return n === Number(eski) && eski !== "" ? null : { v: n };
      } };
  }
  function sMetin(ad, k, bicim) {
    return { ad: ad, kontrol: k,
      doldur: function (r) { k.value = yok(r) ? "" : String(r); },
      degisim: function (r) { var s = bicim ? bicim(k.value.trim()) : k.value.trim(), eski = yok(r) ? "" : String(r); return s === eski ? null : { v: s === "" ? null : s }; } };
  }
  function sKutu(ad, onay) {                     // varsayilan true
    return { ad: ad, kontrol: onay.girdi,
      doldur: function (r) { onay.girdi.checked = r !== false; },
      degisim: function (r) { var yeni = onay.girdi.checked; return yeni === (r !== false) ? null : { v: yeni }; } };
  }
  // acik/kapali + sure (0 = kapali). varsFn(format) varsayilan sure, onDeger: kutu acilinca onerilen sure
  function sAcKapa(ad, onay, sayi, idx, onDeger) {
    var fmt = function (ctx) { var oz = ctx.ozet() || {}; return oz.format || "long"; };
    return { ad: ad, kontrol: onay.girdi, ek: sayi,
      doldur: function (r, ctx) {
        var vars = varsayilanSure(fmt(ctx), idx), eff = yok(r) ? vars : r;
        onay.girdi.checked = eff > 0; sayi.value = r > 0 ? String(r) : ""; sayi.disabled = !onay.girdi.checked; sayi.placeholder = vars > 0 ? String(vars) : String(onDeger);
      },
      degisim: function (r, ctx) {
        var vars = varsayilanSure(fmt(ctx), idx), eff = yok(r) ? vars : r, s = sayi.value.trim();
        if (!onay.girdi.checked) return eff === 0 ? null : { v: 0 };
        if (s === "") { if (yok(r)) return null; return r > 0 ? { v: null } : { v: vars > 0 ? null : onDeger }; }
        var n = Number(s.replace(",", "."));
        if (!isFinite(n)) return { hata: "sayı olmalı" };
        return n === eff ? null : { v: n };
      } };
  }
  function sGeriSayim(ad, onay) {
    return { ad: ad, kontrol: onay.girdi,
      doldur: function (r, ctx) { var oz = ctx.ozet() || {}; onay.girdi.checked = (yok(r) ? varsayilanSure(oz.format || "long", 0) : r) > 0; },
      degisim: function (r, ctx) { var oz = ctx.ozet() || {}; var eff = yok(r) ? varsayilanSure(oz.format || "long", 0) : r, yeni = onay.girdi.checked ? 5 : 0; return yeni === eff ? null : { v: yeni }; } };
  }
  function sOutroMetni(girdiler) {
    var KEY = ["baslik", "alt", "altSlogan"];
    return { ad: "outroMetni", kontrol: girdiler.baslik,
      doldur: function (r) { var o = r && typeof r === "object" ? r : {}; KEY.forEach(function (k) { girdiler[k].value = o[k] || ""; }); },
      degisim: function (r) {
        var o = r && typeof r === "object" ? r : {}, degisti = false, v = {};
        KEY.forEach(function (k) { var yeni = girdiler[k].value.trim(); v[k] = yeni; if (yeni !== (o[k] || "")) degisti = true; });
        return degisti ? { v: v } : null;
      } };
  }

  // ---------------------------------------------------------------- ortak form mekanigi
  // kur({anahtar, ctx, specler, kok, yer, sonra}) -> {guncelle(), kaydet(), sifirla()}
  function formMekanigi(o) {
    var ctx = o.ctx, anahtar = o.anahtar + ":" + ctx.is, kirli = false, imza = "";
    var cubuk = P.h("div", { class: "kaydet-cubugu", role: "region", "aria-label": "Kaydet", hidden: true });
    var uygula = P.dugme("Uygula", { tur: "birincil", ikon: "tamam", onclick: function () { kaydet(); } });
    var sifirlaBtn = P.dugme("Değişiklikleri at", { tur: "hafif", onclick: function () { doldur(true); } });
    P.degistir(cubuk, P.h("span", { class: "soluk" }, "Kaydedilmemiş değişiklik var."), P.h("div", { class: "satir" }, uygula, sifirlaBtn));
    function isaretle(k) { kirli = k; cubuk.hidden = !k; if (k) P.kirli.add(anahtar); else P.kirli.delete(anahtar); }
    function doldur(zorla) {
      var konu = ctx.konu(); if (!konu) return;
      var yeniImza = JSON.stringify(konu);
      if (!zorla && (kirli || yeniImza === imza)) return;
      imza = yeniImza;
      o.specler.forEach(function (s) { s.doldur(konu[s.ad], ctx); });
      if (o.sonra) o.sonra();
      isaretle(false);
    }
    async function kaydet() {
      if (!ctx.konu()) { P.durumYaz(o.yer, "hata", "Bu işin ayarları yüklenemedi (konu.json eksik ya da bozuk). Ham ayarlar sekmesinden düzelt."); return; }
      var konu = ctx.konu(), govde = {}, hatalar = [];
      o.specler.forEach(function (s) {
        var d = s.degisim(konu[s.ad], ctx);
        if (!d) return;
        if (d.hata) { hatalar.push({ alan: s.ad, mesaj: d.hata }); return; }
        govde[s.ad] = d.v;
      });
      P.alanHatalari(o.kok, []);
      if (hatalar.length) { P.alanHatalari(o.kok, hatalar); P.durumYaz(o.yer, "hata", "Bazı alanlar geçersiz."); return; }
      if (!Object.keys(govde).length) { isaretle(false); P.durumYaz(o.yer, "bilgi", "Değişiklik yok."); return; }
      uygula.disabled = true;
      try {
        var r = await P.api("/api/gorunum", Object.assign({ is: ctx.is }, govde));
        if (ctx.detay) ctx.detay.konu = r.konu;
        imza = ""; isaretle(false); doldur(true);
        P.olay.yay("konu-degisti", { is: ctx.is, kaynak: o.anahtar });
        var ek = [P.h("strong", null, "Kaydedildi."), " " + (o.sonuMetni || "Değişiklikler bir sonraki video kurulumunda yansır.") + " "];
        if (r.uyarilar && r.uyarilar.length) ek.push(P.h("ul", null, r.uyarilar.map(function (u) { return P.h("li", null, u.mesaj || u.alan); })));
        if (o.sonrasi) ek.push(o.sonrasi(govde));
        P.degistir(o.yer, P.mesajKutusu("ok", ek));
        P.islerYenile().catch(function () { }); ctx.yenile().catch(function () { });
      } catch (e) {
        P.durumYaz(o.yer, "hata", e);
        if (e.alanlar) P.alanHatalari(o.kok, e.alanlar);
      }
      uygula.disabled = false;
    }
    o.kok.addEventListener("input", function () { isaretle(true); });
    o.kok.addEventListener("change", function () { isaretle(true); });
    P.olay.dinle("konu-degisti", function (x) { if (x && x.is === ctx.is && x.kaynak !== o.anahtar && document.body.contains(o.kok)) { imza = ""; doldur(false); } });
    return { cubuk: cubuk, guncelle: function () { doldur(false); }, kaydet: kaydet, doldur: doldur, kirli: function () { return kirli; } };
  }

  // ---------------------------------------------------------------- Gorunum sekmesi
  function gorunumKur(ctx) {
    var yer = P.h("div", { class: "durum-yeri", "aria-live": "polite" });
    var k = {};
    k.gecis = P.secim([["", "Otomatik — her videoda farklı"]].concat(P.GECISLER), "", { id: P.yeniId("g"), "data-alan": "gecis" });
    k.gecisSure = P.girdi({ type: "number", step: "0.1", min: "0.2", max: "4", placeholder: "0,8 (yatay) / 0,4 (dikey)", "data-alan": "gecisSure", inputmode: "decimal" });
    k.efekt = P.secim([["", "Otomatik — her videoda farklı"]].concat(P.EFEKTLER), "", { id: P.yeniId("g"), "data-alan": "efekt" });
    k.renk = P.secim([["", "Otomatik — her videoda farklı"]].concat(P.RENKLER), "", { id: P.yeniId("g"), "data-alan": "renk" });
    k.muzikSeviyesi = P.girdi({ type: "number", step: "0.05", min: "0", max: "1", placeholder: "0,40", "data-alan": "muzikSeviyesi", inputmode: "decimal" });
    k.muzikRuhu = P.secim([["", "Otomatik"]].concat(P.MUZIK_RUHLARI.filter(function (x) { return x[0] !== "otomatik"; })), "", { id: P.yeniId("g"), "data-alan": "muzikRuhu" });
    k.muzikDosyasi = P.girdi({ placeholder: "boş: sentetik müzik · örn. muzik/sakin.mp3", "data-alan": "muzikDosyasi", maxlength: "400" });
    k.muzikDucking = P.onayKutusu("Konuşurken müziği kıs (önerilen)", true, { "data-alan": "muzikDucking" });
    k.introOn = P.onayKutusu("Marka intro'su", true); k.introSn = P.girdi({ type: "number", step: "0.5", min: "0", max: "30", "aria-label": "Intro süresi (sn)", "data-alan": "intro", inputmode: "decimal" });
    k.kartOn = P.onayKutusu("Konu kartı (başlık ekranı)", true); k.kartSn = P.girdi({ type: "number", step: "0.5", min: "0", max: "30", "aria-label": "Konu kartı süresi (sn)", "data-alan": "konuKarti", inputmode: "decimal" });
    k.outroOn = P.onayKutusu("Kapanış kartı (abone ol)", true); k.outroSn = P.girdi({ type: "number", step: "0.5", min: "0", max: "30", "aria-label": "Kapanış süresi (sn)", "data-alan": "outro", inputmode: "decimal" });
    k.geriOn = P.onayKutusu("Film geri sayımı (5 sn)", false, { "data-alan": "geriSayim" });
    k.markaKose = P.girdi({ type: "number", step: "0.5", min: "0", max: "10", placeholder: "0", "data-alan": "markaKose", inputmode: "decimal" });
    k.altyazi = P.onayKutusu("Altyazıyı videoya göm (SRT dosyası yine de yazılır)", true, { "data-alan": "altyazi" });
    k.altyaziStil = P.secim([["", "Varsayılan (yatay: cümle, dikey: kelime)"], ["cumle", "Cümle cümle"], ["kelime", "2–4 kelimelik parçalar"]], "", { id: P.yeniId("g"), "data-alan": "altyaziStil" });
    k.kanal = P.girdi({ placeholder: (P.ayar && P.ayar.kanal) || "KANALIM", "data-alan": "kanal", maxlength: "60" });
    k.slogan = P.girdi({ placeholder: (P.ayar && P.ayar.slogan) || "(boş)", "data-alan": "slogan", maxlength: "120" });
    k.vurgu = P.girdi({ placeholder: "6FD8FF", "data-alan": "vurguRenk", maxlength: "7", class: "mono-alan", "aria-label": "Vurgu rengi (6 haneli, # yok)" });
    k.vurguSec = P.h("input", { type: "color", class: "renk-sec", "aria-label": "Vurgu rengi seç" });
    k.oBaslik = P.girdi({ placeholder: "SUBSCRIBE / ABONE OL", "data-alan": "outroMetni.baslik", maxlength: "80" });
    k.oAlt = P.girdi({ placeholder: "TURN ON NOTIFICATIONS", "data-alan": "outroMetni.alt", maxlength: "80" });
    k.oAltSlogan = P.girdi({ placeholder: "New videos every week", "data-alan": "outroMetni.altSlogan", maxlength: "80" });
    var acilisNotu = P.h("div", { class: "durum-yeri" });

    // acik/kapali kutulari sureyi acip kapatir
    [[k.introOn, k.introSn, 1.5], [k.kartOn, k.kartSn, 2.5], [k.outroOn, k.outroSn, 3]].forEach(function (x) {
      x[0].girdi.addEventListener("change", function () {
        x[1].disabled = !x[0].girdi.checked;
        if (x[0].girdi.checked && !x[1].value.trim() && !(Number(x[1].placeholder) > 0)) x[1].value = String(x[2]);
      });
    });
    var hexRe = /^[0-9A-Fa-f]{6}$/;
    k.vurguSec.addEventListener("input", function () { k.vurgu.value = k.vurguSec.value.replace("#", "").toUpperCase(); k.vurgu.dispatchEvent(new Event("input", { bubbles: true })); });
    k.vurgu.addEventListener("input", function () { var v = k.vurgu.value.replace("#", ""); if (hexRe.test(v)) k.vurguSec.value = "#" + v; });

    var specler = [sSec("gecis", k.gecis), sSayi("gecisSure", k.gecisSure), sSec("efekt", k.efekt), sSec("renk", k.renk), sSayi("muzikSeviyesi", k.muzikSeviyesi),
      sSec("muzikRuhu", k.muzikRuhu), sMetin("muzikDosyasi", k.muzikDosyasi), sKutu("muzikDucking", k.muzikDucking),
      sAcKapa("intro", k.introOn, k.introSn, 1, 1.5), sAcKapa("konuKarti", k.kartOn, k.kartSn, 2, 2.5), sAcKapa("outro", k.outroOn, k.outroSn, 3, 3),
      sGeriSayim("geriSayim", k.geriOn), sSayi("markaKose", k.markaKose), sKutu("altyazi", k.altyazi), sSec("altyaziStil", k.altyaziStil),
      sMetin("kanal", k.kanal), sMetin("slogan", k.slogan),
      sMetin("vurguRenk", k.vurgu, function (v) { v = v.replace("#", "").toUpperCase(); return v; }),
      sOutroMetni({ baslik: k.oBaslik, alt: k.oAlt, altSlogan: k.oAltSlogan })];

    // acilis suresi hesabi: anlatim ilk soze kadar ne kadar bekler
    function acilisHesabi() {
      var oz = ctx.ozet() || {}, fmt = oz.format || "long";
      var v = function (on, sn, i) { if (!on.girdi.checked) return 0; var s = Number(String(sn.value).replace(",", ".")); return isFinite(s) && sn.value.trim() !== "" ? s : varsayilanSure(fmt, i); };
      var topla = (k.geriOn.girdi.checked ? 5 : 0) + v(k.introOn, k.introSn, 1) + v(k.kartOn, k.kartSn, 2);
      P.degistir(acilisNotu, topla > 8 ? P.mesajKutusu("uyari", "Anlatımın ilk sözü yaklaşık " + Math.round(topla) + " saniye sonra başlar; izleyici en çok bu sürede ayrılır. Hızlı açılış için geri sayımı ve konu kartını kapat, intro'yu kısalt.")
        : P.mesajKutusu("ok", "İlk söz yaklaşık " + Math.round(topla) + " saniyede başlar."));
    }
    function acilisHazir(tur) {
      var h = tur === "hizli";
      k.geriOn.girdi.checked = !h; k.introOn.girdi.checked = !h; k.kartOn.girdi.checked = !h; k.outroOn.girdi.checked = true;
      k.introSn.value = h ? "" : "10"; k.kartSn.value = h ? "" : "3"; k.markaKose.value = h ? "2" : "0";
      k.introSn.disabled = !k.introOn.girdi.checked; k.kartSn.disabled = !k.kartOn.girdi.checked; k.outroSn.disabled = false;
      acilisHesabi();
      kok.dispatchEvent(new Event("change", { bubbles: true }));
    }

    var kok = P.h("div", { class: "sekme-icerik" });
    var form;
    var sonuSatiri = function (govde) {
      var b = P.dugme("Videoyu yeniden kur", { kucuk: true, tur: "hafif", ikon: "film", onclick: function () { P.kontrolluBaslat(ctx, yer, "video", {}, {}); } });
      ctx.kilitTemizle("gorunum-sonra");          // her kayıtta yeni düğüm çizilir: öncekinin kilidi listede birikmesin
      ctx.kilitle(b, "mesgul", "gorunum-sonra");
      return b;
    };
    form = formMekanigi({ anahtar: "gorunum", ctx: ctx, specler: specler, kok: kok, yer: yer, sonrasi: sonuSatiri, sonra: acilisHesabi,
      sonuMetni: "Videoya yansıması için videoyu yeniden kurman gerekir (ses ve görseller yeniden üretilmez)." });

    var hizliBtn = P.dugme("Hızlı açılış", { tur: "hafif", onclick: function () { acilisHazir("hizli"); }, title: "Geri sayım, konu kartı ve intro kapalı; kanal adı köşede 2 sn" });
    var sinBtn = P.dugme("Sinematik açılış", { tur: "hafif", onclick: function () { acilisHazir("sinematik"); }, title: "5 sn geri sayım + 10 sn intro + 3 sn konu kartı" });
    ["input", "change"].forEach(function (e) { kok.addEventListener(e, acilisHesabi); });

    P.degistir(kok,
      P.bolum("Açılış ve kapanış", "İzleyici ilk saniyelerde ayrılır; hızlı açılış anlatımı hemen başlatır. Kutuyu kapatmak o parçayı videodan çıkarır.",
        P.h("div", { class: "satir" }, hizliBtn, sinBtn), acilisNotu,
        P.h("div", { class: "alan-izgara" },
          P.h("div", { class: "alan" }, k.geriOn),
          P.h("div", { class: "alan ac-kapa" }, k.introOn, k.introSn, P.h("span", { class: "soluk" }, "sn")),
          P.h("div", { class: "alan ac-kapa" }, k.kartOn, k.kartSn, P.h("span", { class: "soluk" }, "sn")),
          P.h("div", { class: "alan ac-kapa" }, k.outroOn, k.outroSn, P.h("span", { class: "soluk" }, "sn")),
          P.alan("Kanal adı köşede (sn)", k.markaKose, { ipucu: "Hızlı açılışta kanal adı alt köşede bu kadar saniye görünür." }))),
      P.bolum("Geçiş, hareket ve renk", "«Otomatik» bırakırsan iş adından türetilen bir rotasyon seçilir; seçimler render-sonuc.json'a yazılır (tekrarlayan şablon izlenimini azaltır).",
        P.h("div", { class: "alan-izgara" }, P.alan("Geçiş", k.gecis), P.alan("Geçiş süresi (sn)", k.gecisSure), P.alan("Hareket efekti", k.efekt), P.alan("Renk tonu", k.renk))),
      P.bolum("Müzik", "Fon müziği anlatımın altında kalır. Kendi telifsiz parçanı vermezsen sentetik müzik üretilir.",
        P.h("div", { class: "alan-izgara" }, P.alan("Müzik seviyesi (0–1)", k.muzikSeviyesi, { ipucu: "0,40: müzik anlatımın yaklaşık 6,5 dB altında kalır." }), P.alan("Müzik ruhu", k.muzikRuhu),
          P.alan("Kendi müzik dosyan", k.muzikDosyasi, { ipucu: "Proje klasörüne göre ya da tam yol; döngülenir. Dosya yoksa video kurulumu durur." })),
        k.muzikDucking),
      P.bolum("Altyazı", null, P.h("div", { class: "alan-izgara" }, P.h("div", { class: "alan" }, k.altyazi), P.alan("Altyazı stili", k.altyaziStil))),
      P.bolum("Marka", "Kanal adı ve slogan intro ile kapanışta görünür; boş bırakırsan Kanal ekranındaki ayar kullanılır.",
        P.h("div", { class: "alan-izgara" }, P.alan("Kanal adı", k.kanal), P.alan("Slogan", k.slogan),
          P.h("div", { class: "alan" }, P.h("label", { for: k.vurgu.id || (k.vurgu.id = P.yeniId("g")) }, "Vurgu rengi"), P.h("div", { class: "satir" }, k.vurgu, k.vurguSec))),
        P.h("h4", null, "Kapanış metni"),
        P.h("div", { class: "alan-izgara" }, P.alan("Başlık", k.oBaslik), P.alan("Alt satır", k.oAlt), P.alan("Slogan", k.oAltSlogan))),
      yer, form.cubuk);
    return { kok: kok, ac: function () { form.guncelle(); acilisHesabi(); }, guncelle: function () { form.guncelle(); } };
  }
  P.sekmeler.push({ sira: 4, ad: "gorunum", etiket: "Görünüm", ikon: "palet", yalnizVideo: true, kur: gorunumKur });

  // ---------------------------------------------------------------- Ses ve dil sekmesi
  function sesKur(ctx) {
    var yer = P.h("div", { class: "durum-yeri", "aria-live": "polite" });
    var testYer = P.h("div", { class: "durum-yeri", "aria-live": "polite" });
    var k = {};
    k.dil = P.secim(P.DILLER, "en", { id: P.yeniId("s"), "data-alan": "dil" });
    k.ses = P.h("select", { id: P.yeniId("s"), "data-alan": "ses" });
    k.sesDiger = P.girdi({ placeholder: "örn. en-US-AriaNeural", hidden: true, "aria-label": "Ses adı", "data-alan": "ses" });
    k.hiz = P.secim(P.SES_HIZLARI.map(function (x) { return [x, x === "+0%" ? "Normal (+0%)" : x]; }), "+7%", { id: P.yeniId("s"), "data-alan": "sesHizi" });
    k.motor = P.secim([["", "Kanal ayarındaki (" + (P.ayar && P.ayar.sesMotoru || "otomatik") + ")"]].concat(P.SES_MOTORLARI), "", { id: P.yeniId("s"), "data-alan": "sesMotoru" });
    k.telaffuz = P.onayKutusu("Türkçe telaffuz paketi (YouTube, ChatGPT, vidIQ gibi adları doğru okur; yalnız seste, altyazı değişmez)", true, { "data-alan": "telaffuzPaketi" });
    k.altyaziDili = P.secim(P.DILLER, "en", { id: P.yeniId("s"), "data-alan": "altyaziDili" });
    k.tur = P.secim([["", "Kanal ayarındaki"]].concat(P.TURLER), "", { id: P.yeniId("s"), "data-alan": "tur" });
    k.ton = P.girdi({ placeholder: "örn. ciddi ve sakin", "data-alan": "ton", maxlength: "200" });
    k.katki = P.metinAlani({ rows: "3", "data-alan": "kisiselKatki", maxlength: "1500", placeholder: "Senin bakışın, yorumun — senaryoya kendi sesin olarak işlenir." });

    function sesDoldur(dil, secili) {
      P.bos(k.ses);
      var liste = P.SESLER[dil] || [];
      liste.forEach(function (s) { k.ses.appendChild(P.h("option", { value: s }, s.replace(/Neural$/, ""))); });
      k.ses.appendChild(P.h("option", { value: "__diger" }, "Başka ses adı yaz…"));
      if (secili && liste.indexOf(secili) >= 0) { k.ses.value = secili; k.sesDiger.hidden = true; }
      else if (secili) { k.ses.value = "__diger"; k.sesDiger.value = secili; k.sesDiger.hidden = false; }
      else { k.ses.value = liste[0] || "__diger"; k.sesDiger.hidden = k.ses.value !== "__diger"; }
    }
    var sesDeger = function () { return k.ses.value === "__diger" ? k.sesDiger.value.trim() : k.ses.value; };
    var etkinDil = function (konu, oz) { return (konu && konu.dil) || (konu && typeof konu.ses === "string" && /^[a-z]{2}[-_]/i.test(konu.ses) ? konu.ses.slice(0, 2).toLowerCase() : null) || (oz && oz.dil) || (P.ayar && P.ayar.dil) || "en"; };
    var etkinSes = function (konu, dil) { if (konu && konu.ses) return konu.ses; var a = (P.ayar && P.ayar.ses) || ""; return a.toLowerCase().indexOf(dil + "-") === 0 ? a : P.varsayilanSes(dil); };

    var sDil = { ad: "dil", kontrol: k.dil,
      doldur: function (r, c) { k.dil.value = etkinDil(c.konu(), c.ozet()); },
      degisim: function (r, c) { var eff = etkinDil(c.konu(), c.ozet()); return k.dil.value === eff ? null : { v: k.dil.value }; } };
    var sSes = { ad: "ses", kontrol: k.ses,
      doldur: function (r, c) { var d = etkinDil(c.konu(), c.ozet()); sesDoldur(k.dil.value || d, etkinSes(c.konu(), k.dil.value || d)); },
      degisim: function (r, c) { var d = etkinDil(c.konu(), c.ozet()), eff = etkinSes(c.konu(), d), yeni = sesDeger(); return yeni === eff ? null : { v: yeni }; } };
    var sHiz = { ad: "sesHizi", kontrol: k.hiz,
      doldur: function (r) { var v = r || (P.ayar && P.ayar.sesHizi) || "+7%"; k.hiz.value = v; if (k.hiz.value !== v) { k.hiz.appendChild(P.h("option", { value: v }, v)); k.hiz.value = v; } },
      degisim: function (r) { var eff = r || (P.ayar && P.ayar.sesHizi) || "+7%"; return k.hiz.value === eff ? null : { v: k.hiz.value }; } };
    var sAltyazi = { ad: "altyaziDili", kontrol: k.altyaziDili,
      doldur: function (r, c) { k.altyaziDili.value = r || etkinDil(c.konu(), c.ozet()); },
      degisim: function (r, c) { var eff = r || etkinDil(c.konu(), c.ozet()); return k.altyaziDili.value === eff ? null : { v: k.altyaziDili.value }; } };
    var specler = [sDil, sSes, sHiz, sSec("sesMotoru", k.motor), sKutu("telaffuzPaketi", k.telaffuz), sAltyazi, sSec("tur", k.tur), sMetin("ton", k.ton), sMetin("kisiselKatki", k.katki)];

    var kok = P.h("div", { class: "sekme-icerik" });
    var form = formMekanigi({ anahtar: "ses", ctx: ctx, specler: specler, kok: kok, yer: yer,
      sonuMetni: "Dil, ses ya da hız değiştiyse seslendirmeyi yeniden yap; dil değiştiyse senaryoyu da o dilde yeniden yaz.",
      sonrasi: function (govde) {
        var ic = [];
        ctx.kilitTemizle("ses-sonra");            // her kayıtta yeni düğümler çizilir: öncekilerin kilitleri listede birikmesin
        if (govde.dil !== undefined || govde.ses !== undefined || govde.sesHizi !== undefined || govde.sesMotoru !== undefined || govde.telaffuzPaketi !== undefined) {
          var b = P.dugme("Seslendirmeyi yeniden yap", { kucuk: true, tur: "hafif", ikon: "ses", onclick: function () { ctx.calistir("ses", { yeniden: true }, yer); } });
          ctx.kilitle(b, "mesgul", "ses-sonra"); ic.push(b);
        }
        if (govde.dil !== undefined) {
          var s = P.dugme("Senaryoyu bu dilde yaz…", { kucuk: true, tur: "hafif", ikon: "kalem", onclick: function () { P.senaryoYaz(ctx, yer); } });
          ctx.kilitle(s, "mesgul", "ses-sonra"); ic.push(s);
        }
        return P.h("span", { class: "satir" }, ic);
      } });

    k.dil.addEventListener("change", function () {
      sesDoldur(k.dil.value, P.varsayilanSes(k.dil.value));
      k.altyaziDili.value = k.dil.value;
    });
    k.ses.addEventListener("change", function () { k.sesDiger.hidden = k.ses.value !== "__diger"; if (!k.sesDiger.hidden) k.sesDiger.focus(); });

    // ses testi: POST /api/ses-testi {motor, ses, dil} -> {url} (cerezle servis edilen gecici mp3)
    var testBtn = P.dugme("Sesi dene (5 sn)", { tur: "hafif", ikon: "ses", onclick: async function () {
      var ses = sesDeger();
      if (!/^[A-Za-z0-9._-]{1,80}$/.test(ses)) { P.durumYaz(testYer, "hata", "Ses adı geçersiz."); return; }
      testBtn.disabled = true; P.durumYaz(testYer, "bilgi", "Örnek hazırlanıyor…");
      try {
        var r = await P.api("/api/ses-testi", { motor: k.motor.value || (P.ayar && P.ayar.sesMotoru) || "otomatik", ses: ses, dil: k.dil.value }, { zamanAsimi: 80000 });
        var a = P.h("audio", { controls: true, src: r.url, "aria-label": "Ses örneği" });
        P.degistir(testYer, P.mesajKutusu("ok", "Örnek hazır" + (r.motor ? " (" + r.motor + ")" : "") + (r.sureSn ? " · " + r.sureSn + " sn" : "") + ". ", a));
        a.play().catch(function () { });
      } catch (e) { P.durumYaz(testYer, "hata", e); }
      testBtn.disabled = false;
    } });

    P.degistir(kok,
      P.bolum("Dil ve ses", "Anlatım dili senaryonun yazıldığı dildir. Sesi dil değişince otomatik o dilin varsayılanına çeker; istersen listeden başka bir ses seç ya da adını yaz.",
        P.h("div", { class: "alan-izgara" }, P.alan("Anlatım dili", k.dil), P.alan("Ses", k.ses), P.alan("Konuşma hızı", k.hiz),
          P.alan("Altyazı dili", k.altyaziDili, { ipucu: "Anlatım dilinden farklıysa «Altyazıyı çevir» adımı kullanılır (Claude anahtarı gerekir)." })),
        P.h("div", { class: "alan" }, k.sesDiger), P.h("div", { class: "satir" }, testBtn), testYer),
      P.bolum("Ses motoru", "Edge sesli okuma Microsoft'un resmî olmayan ücretsiz uç noktasıdır; kesintiye ya da değişikliğe açıktır. Ticari kanal için Azure Speech (resmî) önerilir; anahtarını Kaynaklar'dan gir.",
        P.alan("Motor (yalnız bu iş)", k.motor), k.telaffuz),
      P.bolum("Üslup", "Tür ve ton, senaryonun yapısını ve söyleyiş biçimini belirler. Değişiklik yalnız senaryo yeniden yazılırsa etki eder.",
        P.h("div", { class: "alan-izgara" }, P.alan("Tür", k.tur), P.alan("Ton", k.ton)), P.alan("Kendi katkın", k.katki)),
      yer, form.cubuk);
    return { kok: kok, ac: function () { form.guncelle(); }, guncelle: function () { form.guncelle(); } };
  }
  P.sekmeler.push({ sira: 5, ad: "ses", etiket: "Ses ve dil", ikon: "ses", yalnizVideo: true, kur: sesKur });
})();
