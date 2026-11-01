// PANEL ARAYUZU — "AI Studyo" gorunumu: yazidan / fotografindan / kendi videondan AI video (cizgi film, anime, 3D, kil, gercekci ya da serbest).
// Uclar: GET /api/studyo/liste|detay?ad=, POST /api/studyo/yeni|yukle|kaydet|sahne|uret|kur|durdur, GET /studyo/<ad>/girdi|klip/<dosya>, GET /video/<ad>.
// KURAL: kredi YALNIZ "onayliyorum" kutusu isaretliyken ve maliyet gosterildikten sonra harcanir; "Maliyeti hesapla" kredi harcamaz.
// Fotograflar tarayicida <=1536 px JPEG'e kucultulup yuklenir (vidIQ siniri 10 MB; telefon fotograflari da rahat gecer).
(function () {
  "use strict";
  var P = window.P;
  var ui = {}, d = null, sahneler = [], ad = "", zaman = null, kirli = false;
  var MODELLER = { "minimax-h3": ["768p", "2k"], "seedance-2-fast": ["720p"], "seedance-2": ["720p", "1080p"], "gemini-omni-flash": ["720p"], "wan-3": ["720p", "1080p"] };
  var MODEL_ETIKET = [["minimax-h3", "MiniMax H3 (en ucuz, ~20 kredi/sn)"], ["seedance-2-fast", "Seedance 2 Fast (~40 kredi/sn)"], ["seedance-2", "Seedance 2 (~60-88 kredi/sn)"], ["gemini-omni-flash", "Gemini Omni Flash (ses dahil)"], ["wan-3", "Wan 3 (2-30 sn)"]];
  var MODLAR = [["metin", "Yazıdan video"], ["ilk-kare", "Fotoğraf olduğu gibi canlansın"], ["referans", "Fotoğraf karakter/stil referansı"], ["video", "Kendi videom (link)"]];
  var DILLER = [["en", "English"], ["tr", "Türkçe"], ["es", "Español"], ["de", "Deutsch"], ["fr", "Français"], ["it", "Italiano"], ["pt", "Português"], ["ru", "Русский"], ["ar", "العربية"], ["ja", "日本語"]];
  var ORANLAR = [["9:16", "Dikey 9:16 (Shorts, Reels, TikTok)"], ["16:9", "Yatay 16:9 (YouTube)"]];

  function enc(s) { return encodeURIComponent(s); }
  function krediUst(k) { return Math.ceil(k * 1.1); }

  // ---------------------------------------------------------------- liste + yeni is
  async function listeYukle() {
    try {
      var r = await P.api("/api/studyo/liste");
      var stiller = Object.keys(r.stiller).map(function (k) { return [k, r.stiller[k]]; });
      ui.stil = P.secim(stiller, "serbest");
      ui.oran = P.secim(ORANLAR, "9:16");
      P.degistir(ui.yeniKutu,
        P.h("div", { class: "studyo-ayar" },
          P.alan("İş adı", ui.yeniAd, { ipucu: "Küçük harf, rakam, tire." }),
          P.alan("Stil", ui.stil), P.alan("Ekran", ui.oran),
          P.dugme("Oluştur", { tur: "birincil", ikon: "arti", onclick: yeniOlustur })));
      P.degistir(ui.liste, r.isler.length
        ? P.h("div", { class: "satir" }, r.isler.map(function (x) {
          return P.dugme(x.ad + " · " + x.sahne + " sahne" + (x.video ? " · film hazır" : ""), { tur: "hafif", ikon: "film", onclick: function () { P.git("studyo/" + x.ad); } });
        }))
        : P.h("p", { class: "soluk" }, "Henüz stüdyo işi yok. Aşağıdan ilkini oluştur."));
    } catch (e) { P.durumYaz(ui.durum, "hata", e); }
  }
  async function yeniOlustur() {
    try {
      var r = await P.api("/api/studyo/yeni", { ad: ui.yeniAd.value.trim(), stil: ui.stil.value, oran: ui.oran.value });
      P.git("studyo/" + r.ad);
    } catch (e) { P.durumYaz(ui.durum, "hata", e); }
  }

  // ---------------------------------------------------------------- is sayfasi
  async function detayYukle(sadeceDurum) {
    var yeni = await P.api("/api/studyo/detay?ad=" + enc(ad));
    if (sadeceDurum && d) {
      yeni.sahneler.forEach(function (s, i) { if (sahneler[i]) { sahneler[i].klip = s.klip; sahneler[i].kredi = s.kredi; } });
      d.kredi = yeni.kredi; d.uretilecek = yeni.uretilecek; d.video = yeni.video; d.is = yeni.is;
    } else {
      d = yeni; sahneler = yeni.sahneler.map(function (s) { return Object.assign({}, s); }); kirli = false;
    }
    return yeni;
  }
  function isiAc() {
    P.degistir(ui.govde, P.h("p", { class: "soluk" }, "Yükleniyor…"));
    detayYukle().then(function () { ciz(); izle(); }).catch(function (e) {
      P.degistir(ui.govde); P.durumYaz(ui.durum, "hata", e);
    });
  }

  function ayarBolumu() {
    var a = d.ayar;
    var modelSec = P.secim(MODEL_ETIKET, a.model);
    var cozSec = P.secim((MODELLER[a.model] || ["720p"]).map(function (x) { return [x, x]; }), a.cozunurluk);
    modelSec.addEventListener("change", function () {
      P.degistir(cozSec); (MODELLER[modelSec.value] || ["720p"]).forEach(function (x) { cozSec.appendChild(P.h("option", { value: x }, x)); });
    });
    var stiller = Object.keys(d.stiller).map(function (k) { return [k, d.stiller[k]]; });
    var stilSec = P.secim(stiller, a.stil), oranSec = P.secim(ORANLAR, a.oran);
    var sureG = P.girdi({ type: "number", min: "2", max: "15", deger: a.sure, style: "width:5rem" });
    var dilSec = P.secim(DILLER, a.dil || "en");
    ui.ayar = { stil: stilSec, oran: oranSec, model: modelSec, coz: cozSec, sure: sureG, dil: dilSec };
    Object.keys(ui.ayar).forEach(function (k) { ui.ayar[k].addEventListener("change", function () { kirli = true; }); });
    return P.bolum("Ayarlar", "Stil, ekran, model. Aynı fotoğraf ve istem ikinci kez ücretli üretilmez.",
      P.h("div", { class: "studyo-ayar" }, P.alan("Stil", stilSec), P.alan("Ekran", oranSec), P.alan("Model", modelSec), P.alan("Çözünürlük", cozSec), P.alan("Sahne süresi (sn)", sureG), P.alan("Anlatım dili", dilSec)));
  }

  function sahneKarti(s, i) {
    var gorsel = s.kaynak
      ? P.h("img", { class: "studyo-thumb", alt: "Sahne " + (i + 1), loading: "lazy", src: "/studyo/" + enc(ad) + "/girdi/" + enc(s.kaynak) })
      : P.h("div", { class: "studyo-thumb" }, P.ikon(s.mod === "video" ? "film" : "metin"));
    var mod = P.secim(MODLAR.filter(function (m) { return s.kaynak ? m[0] === "ilk-kare" || m[0] === "referans" : m[0] === "metin" || m[0] === "video"; }), s.mod);
    mod.addEventListener("change", function () { s.mod = mod.value; kirli = true; });
    var istem = P.metinAlani({ maxlength: "3500", placeholder: s.mod === "metin" ? "Ne görmek istiyorsun? (İngilizce yazarsan daha iyi sonuç verir)" : "Sahnede ne olsun? (İngilizce)", "aria-label": "Sahne " + (i + 1) + " istemi" });
    istem.value = s.hareket || "";
    istem.addEventListener("input", function () { s.hareket = istem.value; kirli = true; });
    var sure = P.girdi({ type: "number", min: "2", max: "15", deger: s.sure, style: "width:4.5rem", "aria-label": "Süre (sn)" });
    sure.addEventListener("input", function () { s.sure = Number(sure.value) || d.ayar.sure; kirli = true; });
    var anlatim = P.metinAlani({ maxlength: "600", placeholder: "Anlatım (isteğe bağlı): bu sahnede okunacak metin. Ücretsiz sesle seslendirilir, altyazı olarak yakılır.", "aria-label": "Sahne " + (i + 1) + " anlatımı" });
    anlatim.rows = 2; anlatim.value = s.anlatim || "";
    anlatim.addEventListener("input", function () { s.anlatim = anlatim.value; kirli = true; });
    var ek = [];
    if (s.mod === "video") {
      var url = P.girdi({ type: "url", placeholder: "https:// MP4 ya da YouTube linki (yalnız kendi videon)", deger: s.url || "", style: "width:100%" });
      url.addEventListener("input", function () { s.url = url.value.trim(); kirli = true; });
      ek.push(P.alan("Video linki", url));
    }
    var durum = s.klip
      ? [P.rozet("klip hazır", "ok", "tamam"), P.h("video", { class: "studyo-klip", controls: true, preload: "none", src: "/studyo/" + enc(ad) + "/klip/" + enc(s.klip) })]
      : [P.rozet("≈ " + s.kredi + " kredi", "soluk")];
    var araclar = P.h("div", { class: "satir" },
      P.dugme("", { tur: "hafif", kucuk: true, ikon: "yukari", aria: "Yukarı taşı", disabled: i === 0, onclick: function () { tasi(i, -1); } }),
      P.dugme("", { tur: "hafif", kucuk: true, ikon: "ok-sag", sinif: "asagi", aria: "Aşağı taşı", disabled: i === sahneler.length - 1, onclick: function () { tasi(i, 1); } }),
      P.dugme("", { tur: "tehlike", kucuk: true, ikon: "sil", aria: "Sahneyi sil", onclick: function () { sahneler.splice(i, 1); kirli = true; sahneleriCiz(); } }));
    return P.h("div", { class: "studyo-kart" }, gorsel,
      P.h("div", null, P.h("div", { class: "sahne-ust" }, P.h("h4", null, "Sahne " + (i + 1)), mod, P.alan("sn", sure), araclar), ek, istem, anlatim, P.h("div", { class: "satir" }, durum)));
  }
  function tasi(i, yon) {
    var j = i + yon; if (j < 0 || j >= sahneler.length) return;
    var t = sahneler[i]; sahneler[i] = sahneler[j]; sahneler[j] = t; kirli = true; sahneleriCiz();
  }
  function sahneleriCiz() {
    P.degistir(ui.sahneYer, sahneler.length ? P.h("div", { class: "studyo-sahneler" }, sahneler.map(sahneKarti))
      : P.h("p", { class: "soluk" }, "Henüz sahne yok. Fotoğraf yükle, yazıdan sahne ekle ya da video linki ekle."));
    uretimCiz();
  }

  // fotografi tarayicida kucult -> JPEG base64
  async function kucult(dosya) {
    var bmp;
    try { bmp = await createImageBitmap(dosya); } catch (e) { throw new Error(dosya.name + " okunamadı. JPG, PNG ya da WebP olmalı (HEIC ise önce JPG kaydet)."); }
    var oran = Math.min(1, 1536 / Math.max(bmp.width, bmp.height));
    var cv = document.createElement("canvas"); cv.width = Math.round(bmp.width * oran); cv.height = Math.round(bmp.height * oran);
    cv.getContext("2d").drawImage(bmp, 0, 0, cv.width, cv.height);
    var blob = await new Promise(function (coz) { cv.toBlob(coz, "image/jpeg", 0.9); });
    var veri = await new Promise(function (coz, red) { var r = new FileReader(); r.onload = function () { coz(String(r.result).split(",")[1]); }; r.onerror = red; r.readAsDataURL(blob); });
    return { dosya: dosya.name.replace(/\.[^.]+$/, "") + ".jpg", veri: veri };
  }
  async function fotoYukle(liste) {
    if (!liste.length) return;
    try {
      await kaydet(true);
      P.durumYaz(ui.durum, "bilgi", "Fotoğraflar yükleniyor…");
      for (var i = 0; i < liste.length; i++) {
        var k = await kucult(liste[i]);
        await P.api("/api/studyo/yukle", { ad: ad, dosya: k.dosya, veri: k.veri }, { zamanAsimi: 60000 });
      }
      P.durumYaz(ui.durum, null);
      await detayYukle(); ciz();
    } catch (e) { P.durumYaz(ui.durum, "hata", e instanceof P.ApiHata ? e : e.message); }
  }

  async function kaydet(sessiz) {
    if (!d) return;
    var o = ui.ayar;
    var govde = { ad: ad, stil: o.stil.value, oran: o.oran.value, model: o.model.value, cozunurluk: o.coz.value, sure: Number(o.sure.value) || 6,
      dil: o.dil.value,
      sahneler: sahneler.map(function (s) { return { mod: s.mod, kaynak: s.kaynak, url: s.url, hareket: s.hareket, sure: s.sure, an: s.an, anlatim: s.anlatim }; }) };
    try {
      await P.api("/api/studyo/kaydet", govde);
      await detayYukle();
      if (!sessiz) { P.bildir("Kaydedildi.", "ok"); ciz(); }
    } catch (e) { P.durumYaz(ui.durum, "hata", e); throw e; }
  }

  // ---------------------------------------------------------------- uretim
  var onayKutu = null, gosterilenUst = 0;
  function uretimCiz() {
    if (!d) return;
    var is = d.is, calisiyor = !!(is && is.calisiyor);
    var ust = krediUst(d.kredi);
    gosterilenUst = ust;
    onayKutu = P.onayKutusu("Bu işlem için en çok " + ust + " vidIQ kredisi harcanmasını onaylıyorum.", false);
    var uret = P.dugme("Üret (kredi harcar)", { tur: "birincil", ikon: "oynat", disabled: true, onclick: function () { uretCalistir(true); } });
    onayKutu.girdi.addEventListener("change", function () { uret.disabled = !onayKutu.girdi.checked || calisiyor || !d.uretilecek; });
    var kuru = P.dugme("Maliyeti hesapla (ücretsiz)", { tur: "hafif", ikon: "saat", disabled: calisiyor || !sahneler.length, onclick: function () { uretCalistir(false); } });
    var kur = P.dugme("Filmi kur (ücretsiz)", { tur: "hafif", ikon: "film", disabled: calisiyor || !sahneler.some(function (s) { return s.klip; }), onclick: kurCalistir });
    var dur = calisiyor ? P.dugme("Durdur", { tur: "tehlike", ikon: "durdur", onclick: function () { P.api("/api/studyo/durdur", { ad: ad }); } }) : null;
    var log = is && is.satirlar.length ? P.h("pre", { class: "studyo-log", "aria-live": "polite" }, is.satirlar.join("\n")) : null;
    var ozet = d.uretilecek
      ? P.h("p", null, P.h("strong", null, d.uretilecek + " sahne üretilecek"), " · tahmini ≈ " + d.kredi + " kredi (üst sınır " + ust + "). ", P.h("span", { class: "soluk" }, "vidIQ kredisi harcanır; hazır klipler yeniden ücretlendirilmez."))
      : P.h("p", { class: "soluk" }, sahneler.length ? "Tüm sahnelerin klibi hazır. Filmi kurabilirsin." : "Önce sahne ekle.");
    var video = d.video ? P.h("video", { class: "studyo-video", controls: true, src: "/video/" + enc(ad) + "?t=" + (d.videoT || 0) }) : null;
    var indir = d.video ? P.baglanti("MP4 indir", "/indir/" + enc(ad) + "/video", { ikon: "indir", indir: true }) : null;
    P.degistir(ui.uretimYer,
      ozet, onayKutu,
      P.h("div", { class: "satir" }, uret, kuru, kur, dur),
      calisiyor ? P.h("p", { class: "soluk" }, is.tur === "kur" ? "Film kuruluyor…" : is.tur === "kuru" ? "Maliyet hesaplanıyor (kredi harcanmıyor)…" : "Klipler üretiliyor, birkaç dakika sürebilir…") : (is && is.kod !== null && is.kod !== 0 ? P.mesajKutusu("hata", "Son işlem hata ile bitti (kod " + is.kod + "). Ayrıntı aşağıda.") : null),
      log, video, indir);
  }

  async function uretCalistir(onay) {
    try {
      await kaydet(true);
      if (onay) {
        var ust = krediUst(d.kredi);
        if (!onayKutu || !onayKutu.girdi.checked) return P.durumYaz(ui.durum, "uyari", "Önce harcamayı onayla.");
        if (ust > gosterilenUst) { uretimCiz(); return P.durumYaz(ui.durum, "uyari", "Maliyet değişti (şimdi en çok " + ust + " kredi). Yeni tutarı onaylayıp tekrar dene."); }
      }
      if (!d.uretilecek && onay) return P.durumYaz(ui.durum, "bilgi", "Üretilecek sahne yok.");
      P.durumYaz(ui.durum, null);
      await P.api("/api/studyo/uret", { ad: ad, butce: Math.max(krediUst(d.kredi), 1), onay: !!onay });
      await detayYukle(true); uretimCiz(); izle();
    } catch (e) { P.durumYaz(ui.durum, "hata", e); }
  }
  async function kurCalistir() {
    try { await kaydet(true); await P.api("/api/studyo/kur", { ad: ad }); await detayYukle(true); uretimCiz(); izle(); }
    catch (e) { P.durumYaz(ui.durum, "hata", e); }
  }

  // calisan isi 2 sn'de bir sorgular; bitince klip durumlarini yeniler
  function izle() {
    clearTimeout(zaman);
    if (!d || !d.is || !d.is.calisiyor) return;
    zaman = setTimeout(async function () {
      try {
        var oncekiTur = d.is && d.is.tur;
        var yeni = await detayYukle(true);
        if (!yeni.is || !yeni.is.calisiyor) { if (oncekiTur === "kur") d.videoT = Date.now(); sahneleriCiz(); }
        else uretimCiz();
        izle();
      } catch (e) { /* ag kopmasi: bir sonraki turda yeniden dener */ izle(); }
    }, 2000);
  }

  function ciz() {
    P.degistir(ui.govde,
      P.h("div", { class: "satir" }, P.dugme("Tüm işler", { tur: "hafif", ikon: "sol", onclick: function () { P.git("studyo"); } }), P.h("strong", null, ad)),
      ayarBolumu(),
      P.bolum("Sahneler", "Sırası film sırasıdır. Fotoğraf, yazı ya da kendi videonla sahne ekle.",
        ui.sahneYer = P.h("div"),
        P.h("div", { class: "satir" }, ekleDugmeleri()), ui.foto),
      P.bolum("Üretim", "Önce maliyeti gör, onaylarsan üretilir. Klipler hazır olunca film tek MP4 olarak birleşir.", ui.uretimYer = P.h("div")),
      P.dugme("Değişiklikleri kaydet", { ikon: "tamam", onclick: function () { kaydet(false); } }));
    sahneleriCiz();
  }
  function ekleDugmeleri() {
    ui.foto = P.h("input", { type: "file", accept: "image/jpeg,image/png,image/webp", multiple: true, hidden: true });
    ui.foto.addEventListener("change", function () { var l = Array.prototype.slice.call(ui.foto.files); ui.foto.value = ""; fotoYukle(l); });
    return [
      P.dugme("Fotoğraf ekle", { ikon: "gorsel", onclick: function () { ui.foto.click(); } }),
      P.dugme("Yazıdan sahne ekle", { ikon: "metin", onclick: function () { sahneler.push({ mod: "metin", hareket: "", sure: d.ayar.sure, kredi: 0 }); kirli = true; sahneleriCiz(); } }),
      P.dugme("Video linki ekle", { ikon: "film", onclick: function () { sahneler.push({ mod: "video", url: "", hareket: "recreate this exact scene with the same composition, characters and action", sure: d.ayar.sure, kredi: 0 }); kirli = true; sahneleriCiz(); } }),
      ui.foto];
  }

  P.gorunumKaydet("studyo", {
    baslik: "AI Stüdyo", ikon: "film",
    kur: function (kok) {
      ui.durum = P.h("div", { class: "durum-yeri", "aria-live": "polite" });
      ui.yeniAd = P.girdi({ placeholder: "ornek-film", maxlength: "61", "aria-label": "İş adı" });
      ui.yeniKutu = P.h("div"); ui.liste = P.h("div"); ui.govde = P.h("div"); ui.sahneYer = P.h("div"); ui.uretimYer = P.h("div");
      ui.giris = P.h("div", null,
        P.bolum("İşlerin", "Her iş ayrı bir film.", ui.liste),
        P.bolum("Yeni iş", "İstediğin her şeyi yapabilirsin: yazıdan video, fotoğraftan animasyon, çizgi film, kendi videonu dönüştürme.", ui.yeniKutu));
      P.degistir(kok,
        P.sayfaBasligi("h-studyo", "AI Stüdyo", "Ne istersen: yazıdan, fotoğrafından ya da kendi videondan AI video. vidIQ kredinle çalışır; harcamadan önce maliyeti gösterir. Yalnız kendi fotoğraf ve videolarını kullan."),
        ui.durum, ui.giris, ui.govde);
    },
    ac: function (parcalar) {
      clearTimeout(zaman); P.durumYaz(ui.durum, null);
      ad = parcalar[0] || "";
      ui.giris.hidden = !!ad; P.degistir(ui.govde);
      if (ad) isiAc(); else listeYukle();
    },
    birak: function () { clearTimeout(zaman); }
  });
})();
