// PANEL ARAYUZU — "Kanal" gorunumu: kanal kimligi, varsayilan dil/ses/uslup, kapanis metni, onay ve gorsel kaynaklari, kanal gorselleri (marka).
// Uclar: GET|POST /api/ayarlar (panel-ayar.json, bilinmeyen anahtar reddedilir), POST /api/calistir {tur:"markaYap",kanal,slogan}, GET /api/marka, GET /marka/<dosya>.
// Bu ayarlar TUM yeni islerin varsayilanidir; her is kendi konu.json'unda bunlari ezebilir.
(function () {
  "use strict";
  var P = window.P;
  var ui = {}, kirli = false, imza = "";
  var KAYNAKLAR = [["nasa", "NASA (uzay, kamu malı)"], ["wikimedia", "Wikimedia Commons"], ["openverse", "Openverse"], ["pexels", "Pexels (anahtar ister)"], ["pixabay", "Pixabay (anahtar ister)"], ["met", "The Met (sanat, CC0)"], ["aic", "Art Institute of Chicago (sanat, CC0)"], ["cleveland", "Cleveland Müzesi (sanat, CC0)"], ["smithsonian", "Smithsonian (CC0, anahtar ister)"], ["unsplash", "Unsplash (anahtar ister)"]];

  function isaretle(k) { kirli = k; ui.cubuk.hidden = !k; if (k) P.kirli.add("kanal"); else P.kirli.delete("kanal"); }
  var sesDeger = function () { return ui.ses.value === "__diger" ? ui.sesDiger.value.trim() : ui.ses.value; };
  function sesDoldur(dil, secili) {
    P.bos(ui.ses);
    var liste = P.SESLER[dil] || [];
    liste.forEach(function (s) { ui.ses.appendChild(P.h("option", { value: s }, s.replace(/Neural$/, ""))); });
    ui.ses.appendChild(P.h("option", { value: "__diger" }, "Başka ses adı yaz…"));
    if (secili && liste.indexOf(secili) >= 0) { ui.ses.value = secili; ui.sesDiger.hidden = true; }
    else if (secili) { ui.ses.value = "__diger"; ui.sesDiger.value = secili; ui.sesDiger.hidden = false; }
    else { ui.ses.value = liste[0] || "__diger"; ui.sesDiger.hidden = ui.ses.value !== "__diger"; }
  }
  function doldur() {
    var a = P.ayar; if (!a) return;
    var yeni = JSON.stringify(a);
    if (kirli || yeni === imza) return;
    imza = yeni;
    ui.kanal.value = a.kanal || ""; ui.slogan.value = a.slogan || ""; ui.rozet.value = a.rozet || ""; ui.banner.value = a.bannerAltMetin || "";
    ui.vurgu.value = a.vurguRenk || ""; if (/^[0-9A-Fa-f]{6}$/.test(ui.vurgu.value)) ui.vurguSec.value = "#" + ui.vurgu.value;
    ui.dil.value = a.dil || "en";
    sesDoldur(ui.dil.value, a.ses && a.ses.toLowerCase().indexOf(ui.dil.value + "-") === 0 ? a.ses : P.varsayilanSes(ui.dil.value));
    ui.hiz.value = a.sesHizi || "+7%"; if (ui.hiz.value !== (a.sesHizi || "+7%")) { ui.hiz.appendChild(P.h("option", { value: a.sesHizi }, a.sesHizi)); ui.hiz.value = a.sesHizi; }
    ui.motor.value = a.sesMotoru || "otomatik"; ui.tur.value = a.tur || "belgesel"; ui.ton.value = a.ton || "";
    ui.tarif.value = (a.kanalSesi && a.kanalSesi.tarif) || ""; ui.ornek.value = (a.kanalSesi && a.kanalSesi.ornekParagraf) || "";
    var o = a.outroMetni || {}; ui.oBaslik.value = o.baslik || ""; ui.oAlt.value = o.alt || ""; ui.oAltSlogan.value = o.altSlogan || "";
    ui.onaySenaryo.girdi.checked = !(a.onay && a.onay.senaryo === false); ui.onayGorsel.girdi.checked = !!(a.onay && a.onay.gorsel);
    KAYNAKLAR.forEach(function (k) { ui.kaynak[k[0]].girdi.checked = !(a.kaynaklar && a.kaynaklar[k[0]] === false); });
    isaretle(false);
  }
  async function kaydet() {
    var g = {
      kanal: ui.kanal.value.trim(), slogan: ui.slogan.value.trim(), rozet: ui.rozet.value.trim(), bannerAltMetin: ui.banner.value.trim(),
      dil: ui.dil.value, ses: sesDeger(), sesHizi: ui.hiz.value, sesMotoru: ui.motor.value, tur: ui.tur.value, ton: ui.ton.value.trim(),
      kanalSesi: { tarif: ui.tarif.value.trim(), ornekParagraf: ui.ornek.value.trim() },
      outroMetni: { baslik: ui.oBaslik.value.trim(), alt: ui.oAlt.value.trim(), altSlogan: ui.oAltSlogan.value.trim() },
      onay: { senaryo: ui.onaySenaryo.girdi.checked, gorsel: ui.onayGorsel.girdi.checked }, kaynaklar: {}
    };
    var vr = ui.vurgu.value.trim().replace("#", "").toUpperCase();
    if (vr) g.vurguRenk = vr;
    KAYNAKLAR.forEach(function (k) { g.kaynaklar[k[0]] = ui.kaynak[k[0]].girdi.checked; });
    if (!g.kanal) { P.alanHatalari(ui.kok, [{ alan: "kanal", mesaj: "Kanal adı boş olamaz." }]); return; }
    P.alanHatalari(ui.kok, []);
    ui.kaydetBtn.disabled = true;
    try {
      var r = await P.api("/api/ayarlar", g);
      P.ayar = r.ayar; imza = ""; isaretle(false); doldur();
      P.durumYaz(ui.durum, "ok", "Kanal ayarları kaydedildi. Yeni açılan işler bunları varsayılan olarak kullanır; mevcut işler kendi ayarını korur.");
      P.olay.yay("ayar", P.ayar);
    } catch (e) {
      P.durumYaz(ui.durum, "hata", e);
      if (e.alanlar) P.alanHatalari(ui.kok, e.alanlar);
    }
    ui.kaydetBtn.disabled = false;
  }

  async function markaYukle() {
    try {
      var r = await P.api("/api/marka");
      var d = r.dosyalar || [], t = Date.now();
      P.degistir(ui.markaListe, d.length ? d.map(function (x) {
        return P.h("figure", { class: "marka-kart" },
          P.h("img", { src: "/marka/" + encodeURIComponent(x.ad) + "?t=" + t, alt: x.ad, loading: "lazy" }),
          P.h("figcaption", null, P.h("span", { class: "mono" }, x.ad), " · " + x.mb + " MB ",
            P.h("a", { href: "/marka/" + encodeURIComponent(x.ad), download: x.ad, class: "btn kucuk hafif" }, P.ikon("indir"), P.h("span", null, "İndir"))));
      }) : P.h("p", { class: "soluk" }, "Henüz kanal görseli üretilmedi."));
    } catch (e) { P.durumYaz(ui.markaListe, "hata", e); }
  }
  P.olay.dinle("is-bitti", function (o) { if (o && o.tur === "markaYap" && o.durum === "bitti") markaYukle(); });

  P.gorunumKaydet("kanal", {
    baslik: "Kanal", ikon: "kanal",
    kur: function (kok) {
      ui.kok = kok;
      var in_ = function (id, oz) { return P.girdi(Object.assign({ id: "k-" + id }, oz || {})); };
      ui.kanal = in_("kanal", { maxlength: "60", "data-alan": "kanal", placeholder: "örn. Singularity Horizon" });
      ui.slogan = in_("slogan", { maxlength: "120", "data-alan": "slogan" });
      ui.rozet = in_("rozet", { maxlength: "6", "data-alan": "rozet", placeholder: "Boşsa baş harfler" });
      ui.banner = in_("banner", { maxlength: "80", "data-alan": "bannerAltMetin", placeholder: "örn. NEW MATCHUP EVERY WEEK" });
      ui.vurgu = in_("vurgu", { maxlength: "7", "data-alan": "vurguRenk", placeholder: "6FD8FF", class: "mono-alan" });
      ui.vurguSec = P.h("input", { type: "color", class: "renk-sec", "aria-label": "Vurgu rengi seç", value: "#6fd8ff" });
      ui.vurguSec.addEventListener("input", function () { ui.vurgu.value = ui.vurguSec.value.replace("#", "").toUpperCase(); ui.vurgu.dispatchEvent(new Event("input", { bubbles: true })); });
      ui.vurgu.addEventListener("input", function () { var v = ui.vurgu.value.replace("#", ""); if (/^[0-9A-Fa-f]{6}$/.test(v)) ui.vurguSec.value = "#" + v; });
      ui.dil = P.secim(P.DILLER, "en", { id: "k-dil", "data-alan": "dil" });
      ui.ses = P.h("select", { id: "k-ses", "data-alan": "ses" });
      ui.sesDiger = in_("ses-diger", { hidden: true, placeholder: "örn. en-US-AriaNeural", "aria-label": "Ses adı", "data-alan": "ses" });
      ui.hiz = P.secim(P.SES_HIZLARI.map(function (x) { return [x, x === "+0%" ? "Normal (+0%)" : x]; }), "+7%", { id: "k-hiz", "data-alan": "sesHizi" });
      ui.motor = P.secim(P.SES_MOTORLARI, "otomatik", { id: "k-motor", "data-alan": "sesMotoru" });
      ui.tur = P.secim(P.TURLER, "belgesel", { id: "k-tur", "data-alan": "tur" });
      ui.ton = in_("ton", { maxlength: "200", "data-alan": "ton", placeholder: "örn. ciddi ve sakin" });
      ui.tarif = P.metinAlani({ id: "k-tarif", rows: "3", maxlength: "500", "data-alan": "kanalSesi.tarif", placeholder: "Kanalın anlatım sesi: kısa tarif. örn. «Sakin, meraklı, kısa cümleler; izleyiciyle konuşur gibi.»" });
      ui.ornek = P.metinAlani({ id: "k-ornek", rows: "4", maxlength: "1000", "data-alan": "kanalSesi.ornekParagraf", placeholder: "Beğendiğin bir örnek paragraf (isteğe bağlı) — model üslubu buradan yakalar." });
      ui.oBaslik = in_("o-baslik", { maxlength: "80", "data-alan": "outroMetni.baslik", placeholder: "SUBSCRIBE · ABONE OL (dile göre)" });
      ui.oAlt = in_("o-alt", { maxlength: "80", "data-alan": "outroMetni.alt", placeholder: "TURN ON NOTIFICATIONS · BİLDİRİMLERİ AÇ" });
      ui.oAltSlogan = in_("o-altslogan", { maxlength: "80", "data-alan": "outroMetni.altSlogan", placeholder: "New videos every week · Her hafta yeni videolar" });
      ui.onaySenaryo = P.onayKutusu("Senaryo hazır olunca durup onayımı bekle", true);
      ui.onayGorsel = P.onayKutusu("Görseller bulununca durup onayımı bekle", false);
      ui.kaynak = {}; KAYNAKLAR.forEach(function (k) { ui.kaynak[k[0]] = P.onayKutusu(k[1], true); });
      ui.durum = P.h("div", { class: "durum-yeri", "aria-live": "polite" });
      ui.testYer = P.h("div", { class: "durum-yeri", "aria-live": "polite" });
      ui.markaYer = P.h("div", { class: "durum-yeri", "aria-live": "polite" });
      ui.markaListe = P.h("div", { class: "marka-listesi" });
      ui.kaydetBtn = P.dugme("Kaydet", { tur: "birincil", ikon: "tamam", onclick: kaydet });
      ui.cubuk = P.h("div", { class: "kaydet-cubugu", role: "region", "aria-label": "Kaydet", hidden: true },
        P.h("span", { class: "soluk" }, "Kaydedilmemiş değişiklik var."), P.h("div", { class: "satir" }, ui.kaydetBtn, P.dugme("Değişiklikleri at", { tur: "hafif", onclick: function () { imza = ""; isaretle(false); doldur(); } })));
      ui.dil.addEventListener("change", function () { sesDoldur(ui.dil.value, P.varsayilanSes(ui.dil.value)); });
      ui.ses.addEventListener("change", function () { ui.sesDiger.hidden = ui.ses.value !== "__diger"; if (!ui.sesDiger.hidden) ui.sesDiger.focus(); });
      kok.addEventListener("input", function () { isaretle(true); }); kok.addEventListener("change", function () { isaretle(true); });

      var testBtn = P.dugme("Sesi dene (5 sn)", { tur: "hafif", ikon: "ses", onclick: async function () {
        var ses = sesDeger();
        if (!/^[A-Za-z0-9._-]{1,80}$/.test(ses)) { P.durumYaz(ui.testYer, "hata", "Ses adı geçersiz."); return; }
        testBtn.disabled = true; P.durumYaz(ui.testYer, "bilgi", "Örnek hazırlanıyor…");
        try {
          var r = await P.api("/api/ses-testi", { motor: ui.motor.value, ses: ses, dil: ui.dil.value }, { zamanAsimi: 80000 });
          var a = P.h("audio", { controls: true, src: r.url, "aria-label": "Ses örneği" });
          P.degistir(ui.testYer, P.mesajKutusu("ok", "Örnek hazır" + (r.motor ? " (" + r.motor + ")" : "") + (r.sureSn ? " · " + r.sureSn + " sn" : "") + ". ", a));
          a.play().catch(function () { });
        } catch (e) { P.durumYaz(ui.testYer, "hata", e); }
        testBtn.disabled = false;
      } });
      var markaBtn = P.dugme("Kanal görsellerini üret", { tur: "hafif", ikon: "gorsel", onclick: async function () {
        var kanal = ui.kanal.value.trim();
        if (!kanal) { P.durumYaz(ui.markaYer, "hata", "Önce kanal adını yaz."); return; }
        var r = await P.calistir("markaYap", { kanal: kanal, slogan: ui.slogan.value.trim() }, ui.markaYer);
        if (r) P.durumYaz(ui.markaYer, "bilgi", "Üretiliyor; bitince aşağıda görünür.");
      } });

      P.degistir(kok,
        P.sayfaBasligi("h-kanal", "Kanal", "Tüm yeni videoların varsayılanları. Her video bunları kendi Görünüm / Ses sekmesinde değiştirebilir."),
        P.bolum("Kimlik", "Kanal adı ve slogan intro ile kapanışta görünür; «KANALIM» kalırsa videoda bu yazı çıkar.",
          P.h("div", { class: "alan-izgara" }, P.alan("Kanal adı", ui.kanal), P.alan("Slogan", ui.slogan),
            P.h("div", { class: "alan" }, P.h("label", { for: "k-vurgu" }, "Vurgu rengi"), P.h("div", { class: "satir" }, ui.vurgu, ui.vurguSec)))),
        P.bolum("Dil ve ses", "Yeni videolar için varsayılan anlatım dili, ses ve hız.",
          P.h("div", { class: "alan-izgara" }, P.alan("Anlatım dili", ui.dil), P.alan("Ses", ui.ses), P.alan("Konuşma hızı", ui.hiz), P.alan("Ses motoru", ui.motor, { ipucu: "Edge resmî değildir; ticari kanal için Azure Speech önerilir." })),
          P.h("div", { class: "alan" }, ui.sesDiger), P.h("div", { class: "satir" }, testBtn), ui.testYer),
        P.bolum("Üslup", "Senaryo motoru tür, ton ve kanal sesini okur; her video aynı tondan çıksın diye burada tanımla.",
          P.h("div", { class: "alan-izgara" }, P.alan("Tür", ui.tur), P.alan("Ton", ui.ton)),
          P.alan("Kanal sesi (kısa tarif)", ui.tarif), P.alan("Örnek paragraf", ui.ornek)),
        P.bolum("Kapanış metni", "Boş bırakırsan dile göre varsayılan kullanılır (İngilizce: SUBSCRIBE / TURN ON NOTIFICATIONS, Türkçe: ABONE OL / BİLDİRİMLERİ AÇ).",
          P.h("div", { class: "alan-izgara" }, P.alan("Başlık", ui.oBaslik), P.alan("Alt satır", ui.oAlt), P.alan("Slogan", ui.oAltSlogan))),
        P.bolum("Onay", "Yeni işlerin varsayılanı. Onay açıkken zincir seçtiğin noktada durur; ücretli adımın sonucunu görmeden ses ve video üretilmez.",
          P.h("div", { class: "yigin" }, ui.onaySenaryo, ui.onayGorsel)),
        P.bolum("Görsel kaynakları", "Kapalı kaynak aramalara hiç katılmaz. Pexels ve Pixabay için Kaynaklar'dan ücretsiz anahtar girmen gerekir.",
          P.h("div", { class: "yigin" }, KAYNAKLAR.map(function (k) { return ui.kaynak[k[0]]; }))),
        ui.durum, ui.cubuk,
        P.bolum("Kanal görselleri", "Profil resmi ve banner üretir (YouTube güvenli alanına göre). Rozet ve banner alt metni kaydedilmiş ayardan okunur: önce kaydet.",
          P.h("div", { class: "alan-izgara" }, P.alan("Rozet (profil resmi harfleri)", ui.rozet, { ipucu: "En çok 6 karakter. Boş bırakırsan kanal adının baş harfleri kullanılır." }), P.alan("Banner alt metni", ui.banner)),
          P.h("div", { class: "satir" }, markaBtn), ui.markaYer, ui.markaListe));
    },
    ac: async function () {
      if (!P.ayar) { try { await P.ayarYukle(); } catch (e) { P.durumYaz(ui.durum, "hata", e); return; } }
      doldur(); markaYukle();
    }
  });
  P.olay.dinle("ayar", function () { if (ui.kok && !kirli) { imza = ""; doldur(); } });
})();
