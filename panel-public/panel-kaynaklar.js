// PANEL ARAYUZU — "Kaynaklar" gorunumu: senaryo motoru secimi, API anahtarlari (kaydet/sil/test), maliyet ve limitler, disk.
// Uclar: GET|POST /api/anahtarlar ({ayarla:{AD:"v"}, sil:["AD"]}), GET /api/anahtar-test?anahtar=, GET /api/maliyet, GET /api/disk, POST /api/temizle, POST /api/ayarlar.
// Anahtarlar bilgisayardaki .env dosyasinda saklanir; ilgili servise istek atarken o servise gonderilir. Ekranda maskeli gorunur.
(function () {
  "use strict";
  var P = window.P;
  var ui = {}, maskeler = {}, satirlar = {};

  var GRUPLAR = [
    { baslik: "Senaryo servisleri", aciklama: "Senaryoyu bunlardan biri yazar. Hiçbiri yoksa senaryoyu kendin yazıp Senaryo sekmesine yapıştırabilirsin.", anahtarlar: [
      { ad: "ANTHROPIC_API_KEY", etiket: "Anthropic (Claude) anahtarı", test: "claude", ucretli: true, not: "console.anthropic.com/settings/keys · kullandıkça ücretlenir. Test, anahtarı doğrular; kalan krediyi göstermez." },
      { ad: "ANTHROPIC_MODEL", etiket: "Claude model adı", acik: true, test: "claude", not: "Boşsa aşağıdaki «Model» ayarı kullanılır. Yanlış ad yazarsan senaryo adımı «model bulunamadı» ile durur; test bunu yakalar." },
      { ad: "VIDIQ_KEY", etiket: "vidIQ MCP anahtarı", test: "vidiq", ucretli: true, not: "app.vidiq.com/account/settings/mcp · vidIQ üyeliği gerekir. Başlık puanı, trend, viral analiz ve (Claude yoksa) senaryo bununla çalışır; krediyle ücretlenir." }] },
    { baslik: "Görsel kaynakları", aciklama: "NASA, Wikimedia Commons ve Openverse anahtarsız çalışır. Pexels ve Pixabay ücretsiz anahtarla gerçek dünya fotoğrafları ekler (mekân, yemek, insan).", anahtarlar: [
      { ad: "PEXELS_KEY", etiket: "Pexels", test: "pexels", not: "pexels.com/api · ücretsiz. Pexels görselleri için kaynak göstermek gerekir; atıf listesi otomatik hazırlanır." },
      { ad: "PIXABAY_KEY", etiket: "Pixabay", test: "pixabay", not: "pixabay.com/api/docs · ücretsiz." },
      { ad: "SMITHSONIAN_KEY", etiket: "Smithsonian (CC0)", not: "api.data.gov/signup · ücretsiz. Yalnız CC0 işaretli eserler alınır; sanat/tarih sahnelerinde kullanılır." },
      { ad: "UNSPLASH_KEY", etiket: "Unsplash", not: "unsplash.com/developers · ücretsiz (Access Key). Fotoğrafçı atfı açıklamaya eklenir." },
      { ad: "EUROPEANA_KEY", etiket: "Europeana", not: "pro.europeana.eu/page/get-api · ücretsiz. Yalnız açık lisanslı (CC0, kamu malı, CC BY, CC BY-SA) eserler alınır." }] },
    { baslik: "Yapay zekâ görsel üretimi", aciklama: "İsteğe bağlı. Anahtarsız kullanımda Pollinations denenir; aşağıdakilerden biri varsa yedek olarak kullanılır.", anahtarlar: [
      { ad: "CF_ACCOUNT_ID", etiket: "Cloudflare hesap kimliği", acik: false, not: "Cloudflare Workers AI (ücretsiz kademe) için; API jetonuyla birlikte." },
      { ad: "CF_API_TOKEN", etiket: "Cloudflare API jetonu" },
      { ad: "TOGETHER_KEY", etiket: "Together anahtarı", not: "together.ai · ücretsiz kademe." },
      { ad: "HF_TOKEN", etiket: "Hugging Face jetonu", not: "huggingface.co/settings/tokens · ücretsiz." }] },
    { baslik: "Ses motorları", aciklama: "İsteğe bağlı. Varsayılan Edge sesli okumadır (anahtarsız ama resmî değil). Azure Speech resmî ve ticari kullanıma uygundur; Piper tamamen yerel çalışır.", anahtarlar: [
      { ad: "AZURE_SPEECH_KEY", etiket: "Azure Speech anahtarı", not: "Azure portalında bir Speech kaynağı oluştur." },
      { ad: "AZURE_SPEECH_REGION", etiket: "Azure bölgesi", acik: true, not: "örn. westeurope" },
      { ad: "PIPER_YOL", etiket: "Piper program yolu", acik: true, not: "piper.exe'nin tam yolu." },
      { ad: "PIPER_MODEL", etiket: "Piper ses modeli", acik: true, not: ".onnx dosyasının tam yolu." }] }
  ];
  var TEST_ESLEME = { ANTHROPIC_API_KEY: "claude", ANTHROPIC_MODEL: "claude", VIDIQ_KEY: "vidiq", PEXELS_KEY: "pexels", PIXABAY_KEY: "pixabay" };
  var TEST_ADI = { claude: "Claude", vidiq: "vidIQ", pexels: "Pexels", pixabay: "Pixabay" };

  function testRozeti(t) { return t ? P.h("span", { class: "iz " + (t.ok ? "ok" : "uyari") }, P.ikon(t.ok ? "tamam" : "uyari"), t.mesaj) : null; }

  function anahtarSatiri(t) {
    var id = "a-" + t.ad.toLowerCase();
    var giris = P.girdi({ id: id, type: t.acik ? "text" : "password", autocomplete: t.acik ? "off" : "new-password", placeholder: t.acik ? "" : "yeni değeri yapıştır", maxlength: "600" });
    var durum = P.h("span", { class: "anahtar-durum" });
    var yer = P.h("div", { class: "durum-yeri", "aria-live": "polite" });
    var sonuc = P.h("div", { class: "test-sonuc" });
    var yazildi = false;                      // kullanıcı bu alana yazdı, henüz kaydetmedi: kayıtlı değer onu ezmesin
    giris.addEventListener("input", function () { yazildi = true; });
    function durumCiz() {
      var m = maskeler[t.ad] || "";
      P.degistir(durum, m ? P.rozet(t.acik ? "kayıtlı" : "kayıtlı · " + m, "ok", "tamam") : P.rozet("boş", "soluk"));
      // "açık" alanlar kayıtlı değerle doldurulur; ama başka satırın Kaydet/Sil'i ya da sayfaya dönüş tüm satırları yeniden çizer —
      // yazılmış (kaydedilmemiş) metne dokunulmaz
      if (t.acik && !yazildi && document.activeElement !== giris) giris.value = m;
    }
    async function kaydet() {
      var v = giris.value.trim();
      if (!v) { P.durumYaz(yer, "uyari", "Boş değer kaydedilmez. Kayıtlı anahtarı kaldırmak için «Sil»e bas."); giris.focus(); return; }
      if (/[\r\n]/.test(v)) { P.durumYaz(yer, "hata", "Anahtar tek satır olmalı."); return; }
      kaydetBtn.disabled = true; P.durumYaz(yer, "bilgi", "Kaydediliyor ve test ediliyor…");
      try {
        var r = await P.api("/api/anahtarlar", { ayarla: (function () { var o = {}; o[t.ad] = v; return o; })() }, { zamanAsimi: 40000 });
        yazildi = false;                      // kaydedildi: alan artık kayıtlı değeri gösterir
        await yukleMaskeler();
        if (!t.acik) giris.value = "";
        var tn = TEST_ESLEME[t.ad], tr = r.test && r.test[tn];
        P.degistir(yer, P.mesajKutusu(tr && !tr.ok ? "uyari" : "ok", P.h("strong", null, "Kaydedildi."), tr ? " " + TEST_ADI[tn] + ": " + tr.mesaj : tn ? " Otomatik test sonucu alınamadı; «Test et»e basarak dene." : " Bu değer için otomatik test yok."));
        P.ayarYukle().catch(function () { }); P.ozellikYukle().then(function () { P.olay.yay("anahtarlar"); });
      } catch (e) { P.durumYaz(yer, "hata", e); }
      kaydetBtn.disabled = false;
    }
    var kaydetBtn = P.dugme("Kaydet", { kucuk: true, tur: "birincil", onclick: kaydet });
    var silBtn = P.dugme("Sil", { kucuk: true, tur: "hafif", ikon: "sil", onclick: async function () {
      if (!maskeler[t.ad]) { P.durumYaz(yer, "bilgi", "Zaten kayıtlı değer yok."); return; }
      var ok = await P.onayIste(yer, { baslik: t.ad + " silinsin mi?", metin: "Anahtar .env dosyasından kaldırılır; bu servisi kullanan adımlar çalışmaz.", evet: "Sil", tehlikeli: true });
      if (!ok) return;
      try { await P.api("/api/anahtarlar", { sil: [t.ad] }); yazildi = false; await yukleMaskeler(); giris.value = ""; P.durumYaz(yer, "ok", "Silindi."); P.ozellikYukle().then(function () { P.olay.yay("anahtarlar"); }); }
      catch (e) { P.durumYaz(yer, "hata", e); }
    } });
    var testBtn = t.test ? P.dugme("Test et", { kucuk: true, tur: "hafif", ikon: "yildiz", onclick: async function () {
      testBtn.disabled = true; P.degistir(sonuc, P.h("span", { class: "soluk" }, "Test ediliyor…"));
      try { var r = await P.api("/api/anahtar-test?anahtar=" + t.test, undefined, { zamanAsimi: 30000 }); P.degistir(sonuc, testRozeti(r[t.test])); }
      catch (e) { P.durumYaz(sonuc, "hata", e); }
      testBtn.disabled = false;
    } }) : null;
    giris.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); kaydet(); } });
    var satir = P.h("div", { class: "anahtar-satir" },
      P.h("div", { class: "anahtar-ust" }, P.h("label", { for: id }, t.etiket), durum, t.ucretli ? P.rozet("ücretli", "uyari") : null),
      t.not ? P.h("div", { class: "ipucu" }, t.not) : null,
      P.h("div", { class: "satir anahtar-girdi" }, giris, kaydetBtn, silBtn, testBtn), sonuc, yer);
    satirlar[t.ad] = durumCiz;
    return satir;
  }
  async function yukleMaskeler() {
    try { maskeler = await P.api("/api/anahtarlar"); } catch (e) { P.durumYaz(ui.durum, "hata", e); return; }
    Object.keys(satirlar).forEach(function (k) { satirlar[k](); });
    motorCiz();
  }

  // ---------------------------------------------------------------- senaryo motoru
  var MOTORLAR = [["otomatik", "Otomatik", "Claude anahtarı varsa onu kullanır; Claude hata verirse vidIQ'ya geçer."], ["claude", "Yalnız Claude", "Yedek motor denenmez."], ["vidiq", "Yalnız vidIQ", "Claude anahtarı olsa bile vidIQ kullanılır."]];
  function motorCiz() {
    var a = P.ayar || {}, mevcut = a.senaryoMotoru || "otomatik";
    var claude = !!maskeler.ANTHROPIC_API_KEY, vidiq = !!maskeler.VIDIQ_KEY;
    P.degistir(ui.motor,
      P.h("div", { class: "yigin", role: "radiogroup", "aria-label": "Senaryo motoru" }, MOTORLAR.map(function (m) {
        var g = P.h("input", { type: "radio", name: "motor", value: m[0], checked: mevcut === m[0] });
        g.addEventListener("change", async function () {
          try { var r = await P.api("/api/ayarlar", { senaryoMotoru: m[0] }); P.ayar = r.ayar; P.durumYaz(ui.motorDurum, "ok", "Senaryo motoru: " + m[1] + "."); }
          catch (e) { P.durumYaz(ui.motorDurum, "hata", e); g.checked = false; }
        });
        return P.h("label", { class: "onay" }, g, P.h("span", null, P.h("strong", null, m[1]), " — ", m[2]));
      })),
      P.h("p", { class: "ipucu" }, "Şu an: Claude " + (claude ? "anahtarı var" : "anahtarı yok") + " · vidIQ " + (vidiq ? "anahtarı var" : "anahtarı yok") +
        (!claude && !vidiq ? " — senaryo yazılamaz; elle yapıştır." : "") + "."));
  }

  // ---------------------------------------------------------------- maliyet + limitler
  var USD = function (n) { return "$" + (Number(n) || 0).toFixed(2).replace(".", ","); };
  async function maliyetYukle() {
    try {
      var m = await P.api("/api/maliyet");
      var a = P.ayar || {}, lim = a.maliyet || {};
      var model = a.claudeModel || "claude-opus-5", fiyat = (a.fiyat && a.fiyat[model]) || { giris: 5, cikis: 25 };
      var sayi = function (id, v, ph) { return P.girdi({ id: id, type: "number", min: "0", step: "0.01", deger: v === null || v === undefined ? "" : String(v), placeholder: ph || "sınırsız", inputmode: "decimal" }); };
      var g = sayi("m-gun", lim.gunlukUSD), ay = sayi("m-ay", lim.aylikUSD), is = sayi("m-is", lim.isBasinaUSD), disk = sayi("m-disk", a.diskEsikGB, "5");
      var mdl = P.girdi({ id: "m-model", deger: model, maxlength: "80" });
      var fg = sayi("m-fg", fiyat.giris, "5"), fc = sayi("m-fc", fiyat.cikis, "25");
      var yer = P.h("div", { class: "durum-yeri", "aria-live": "polite" });
      var oku = function (k) { var s = k.value.trim().replace(",", "."); if (s === "") return null; var n = Number(s); return isFinite(n) && n >= 0 ? n : NaN; };
      var kaydet = P.dugme("Kaydet", { tur: "birincil", ikon: "tamam", onclick: async function () {
        var v = { gunlukUSD: oku(g), aylikUSD: oku(ay), isBasinaUSD: oku(is) }, e = oku(disk), gi = oku(fg), ci = oku(fc);
        if ([v.gunlukUSD, v.aylikUSD, v.isBasinaUSD, e, gi, ci].some(function (x) { return x !== null && isNaN(x); })) { P.durumYaz(yer, "hata", "Sayılar 0 ya da daha büyük olmalı."); return; }
        var govde = { maliyet: v, diskEsikGB: e === null ? 5 : e, claudeModel: mdl.value.trim() || "claude-opus-5" };
        govde.fiyat = {}; govde.fiyat[govde.claudeModel] = { giris: gi === null ? 5 : gi, cikis: ci === null ? 25 : ci };
        try { var r = await P.api("/api/ayarlar", govde); P.ayar = r.ayar; P.durumYaz(yer, "ok", "Limitler kaydedildi. Ücretli bir adım limiti aşacaksa başlamadan önce durdurulur."); }
        catch (x) { P.durumYaz(yer, "hata", x); }
      } });
      P.degistir(ui.maliyet,
        P.h("dl", { class: "meta-liste" },
          P.h("dt", null, "Claude — bugün"), P.h("dd", null, USD(m.claude.bugunUSD)),
          P.h("dt", null, "Claude — bu ay"), P.h("dd", null, USD(m.claude.ayUSD)),
          P.h("dt", null, "vidIQ kalan kredi"), P.h("dd", null, m.vidiq.bakiye !== null && m.vidiq.bakiye !== undefined ? P.sayi(m.vidiq.bakiye) : "bilinmiyor (anahtar yok ya da okunamadı)"),
          P.h("dt", null, "vidIQ — bugün / bu ay"), P.h("dd", null, (m.vidiq.bugunKredi || 0) + " / " + (m.vidiq.ayKredi || 0) + " kredi"),
          P.h("dt", null, "Tek senaryo tahmini"), P.h("dd", null, "~" + USD(m.tahmin.usd) + " (" + m.tahmin.model + ", 15 dk) — tahmin")),
        P.h("p", { class: "ipucu" }, "Rakamlar panelin iş klasörlerine yazdığı kullanım kayıtlarından gelir; fatura değildir. Gerçek harcama için servis panelini kontrol et."),
        P.h("h4", null, "Limitler (boş = sınırsız)"),
        P.h("div", { class: "alan-izgara" }, P.alan("Günlük (USD)", g), P.alan("Aylık (USD)", ay), P.alan("İş başına (USD)", is), P.alan("En az boş disk (GB)", disk)),
        P.h("h4", null, "Model ve fiyat"),
        P.h("div", { class: "alan-izgara" }, P.alan("Claude model adı", mdl, { ipucu: "ANTHROPIC_MODEL (.env) doluysa o önceliklidir." }), P.alan("Giriş fiyatı ($ / 1M token)", fg), P.alan("Çıkış fiyatı ($ / 1M token)", fc)),
        P.h("div", { class: "satir" }, kaydet), yer);
    } catch (e) { P.durumYaz(ui.maliyet, "hata", e); }
  }

  // ---------------------------------------------------------------- disk
  async function diskYukle() {
    try {
      var d = await P.api("/api/disk");
      var yer = P.h("div", { class: "durum-yeri", "aria-live": "polite" });
      var tabloSatiri = function (x) {
        var temizle = P.dugme("Ara dosyaları temizle", { kucuk: true, tur: "hafif", ikon: "sil", disabled: !(x.tmpMB > 0), onclick: async function () {
          var ok = await P.onayIste(yer, { baslik: x.ad + ": ara dosyalar silinsin mi?", metin: "Yalnız _tmp klasörü silinir (" + P.boyutYaz(x.tmpMB) + "); senaryo, görsel, ses ve final video kalır.", evet: "Temizle" });
          if (!ok) return;
          try { var r = await P.api("/api/temizle", { is: x.ad, tur: "ara" }); P.bildir(P.boyutYaz(r.serbestMB) + " yer açıldı.", "ok"); diskYukle(); }
          catch (e) { P.durumYaz(yer, "hata", e); }
        } });
        return P.h("li", { class: "disk-satir" }, P.h("a", { href: "#/videolar/" + encodeURIComponent(x.ad), class: "mono" }, x.ad), P.h("span", null, P.boyutYaz(x.mb)), P.h("span", { class: "soluk" }, "ara: " + P.boyutYaz(x.tmpMB)), temizle);
      };
      // uretim/_onbellek: iş listesinde görünmeyen ortak önbellek (film geri sayımı kartı); yalnız video kurulmuyorsa silinebilir
      var onb = Number(d.onbellekMB) || 0;
      var onbTemizle = P.dugme("Ortak önbelleği temizle" + (onb ? " (" + P.boyutYaz(onb) + ")" : ""), { kucuk: true, tur: "hafif", ikon: "sil", disabled: !onb, onclick: async function () {
        var ok = await P.onayIste(yer, { baslik: "Ortak önbellek silinsin mi?", metin: "Film geri sayımı gibi işten bağımsız hazır parçalar silinir; gerekirse bir sonraki video kurulumunda yeniden üretilir (geri sayım 1080p'de birkaç dakika sürer).", evet: "Temizle" });
        if (!ok) return;
        try { var r = await P.api("/api/temizle", { tur: "onbellek" }); P.bildir(P.boyutYaz(r.serbestMB) + " yer açıldı.", "ok"); diskYukle(); }
        catch (e) { P.durumYaz(yer, "hata", e); }
      } });
      P.degistir(ui.disk,
        P.h("p", null, P.h("strong", null, d.bosGB !== null && d.bosGB !== undefined ? d.bosGB + " GB" : "bilinmiyor"), " boş yer · üretim klasörü " + (d.uretimGB || 0) + " GB"),
        d.isler.length ? P.h("ul", { class: "disk-liste" }, d.isler.slice(0, 30).map(tabloSatiri)) : P.h("p", { class: "soluk" }, "Henüz iş yok."),
        P.h("p", { class: "soluk" }, "Ortak önbellek: " + P.boyutYaz(onb)), P.h("div", { class: "satir" }, onbTemizle), yer);
    } catch (e) { P.durumYaz(ui.disk, "hata", e); }
  }

  var testHepsi = async function () {
    P.degistir(ui.testSonuc, P.h("span", { class: "soluk" }, "Test ediliyor…"));
    try {
      var r = await P.api("/api/anahtar-test?anahtar=hepsi", undefined, { zamanAsimi: 40000 });
      P.degistir(ui.testSonuc, P.h("ul", { class: "test-liste" }, Object.keys(TEST_ADI).map(function (k) { return P.h("li", null, P.h("strong", null, TEST_ADI[k] + ": "), testRozeti(r[k])); })));
    } catch (e) { P.durumYaz(ui.testSonuc, "hata", e); }
  };

  P.gorunumKaydet("kaynaklar", {
    baslik: "Kaynaklar", ikon: "anahtar",
    kur: function (kok) {
      ui.durum = P.h("div", { class: "durum-yeri", "aria-live": "polite" });
      ui.motor = P.h("div", { class: "motor-yer" }); ui.motorDurum = P.h("div", { class: "durum-yeri", "aria-live": "polite" });
      ui.maliyet = P.h("div", { class: "maliyet-yer" }); ui.disk = P.h("div", { class: "disk-yer" });
      ui.testSonuc = P.h("div", { class: "test-sonuc" });
      ui.onkontrol = P.h("div", { class: "onkontrol-yer" });
      var testBtn = P.dugme("Tüm anahtarları test et", { tur: "hafif", ikon: "yildiz", onclick: testHepsi });
      var grupBolumleri = GRUPLAR.map(function (g) { return P.bolum(g.baslik, g.aciklama, g.anahtarlar.map(anahtarSatiri)); });
      P.degistir(kok,
        P.sayfaBasligi("h-kaynaklar", "Kaynaklar", "Anahtarlar, senaryo motoru, harcama ve disk. Anahtarlar bilgisayarındaki .env dosyasında saklanır; ekranda maskeli görünür."),
        P.bolum("Başlamadan önce", "Eksikler ve engeller.", ui.onkontrol),
        P.bolum("Senaryo motoru", "Hangi servisin senaryoyu yazacağı.", ui.motor, ui.motorDurum),
        grupBolumleri,
        P.bolum("Bağlantı testi", "Kayıtlı anahtarları canlı dener (token harcamaz).", P.h("div", { class: "satir" }, testBtn), ui.testSonuc),
        P.bolum("Harcama ve limitler", "Ücretli çağrıların kaydı, limitler ve model.", ui.maliyet),
        P.bolum("Disk", "Üretim klasörünün boyutu; ara dosyalar render sonrası silinebilir.", ui.disk),
        ui.durum);
    },
    ac: function () {
      P.degistir(ui.onkontrol, P.onkontrolKutusu({ tur: "hepsi" }));
      yukleMaskeler(); maliyetYukle(); diskYukle();
    }
  });
})();
