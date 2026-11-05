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
  var MODLAR = [["metin", "Yazıdan video"], ["ilk-kare", "Fotoğraf olduğu gibi canlansın"], ["referans", "Fotoğraf karakter/stil referansı"], ["video", "Kendi videom (link)"], ["3b", "3B sahne (ücretsiz, bu bilgisayarda)"]];
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
    var kameraSec = P.secim(Object.keys(d.kameralar).map(function (k) { return [k, d.kameralar[k]]; }), a.kamera || "temiz");
    ui.ayar = { stil: stilSec, oran: oranSec, model: modelSec, coz: cozSec, sure: sureG, dil: dilSec, kamera: kameraSec };
    Object.keys(ui.ayar).forEach(function (k) { ui.ayar[k].addEventListener("change", function () { kirli = true; }); });
    return P.bolum("Ayarlar", "Stil, ekran, model. Aynı fotoğraf ve istem ikinci kez ücretli üretilmez.",
      P.h("div", { class: "studyo-ayar" }, P.alan("Stil", stilSec), P.alan("Ekran", oranSec), P.alan("Model", modelSec), P.alan("Çözünürlük", cozSec), P.alan("Sahne süresi (sn)", sureG), P.alan("Anlatım dili", dilSec), P.alan("Kamera görünümü", kameraSec, { ipucu: "Tane, vinyet, renk: AI klibin plastik hissini kırar." })));
  }

  // ---------------------------------------------------------------- lens profili (Lensfun)
  var lp = null, lensKutu = null;
  function lensProfil() { return lp && lp.kamera && lp.lens ? lp : null; }
  function aramaAlani(tur, etiket) {
    var giris = P.girdi({ type: "search", placeholder: etiket + " ara (ör. " + (tur === "kamera" ? "iphone, canon 5d" : "50mm, galaxy") + ")", "aria-label": etiket + " ara" });
    var sec = P.secim([["", "— ara, sonra seç —"]], "", { "aria-label": etiket + " seç" });
    var bekle = null;
    function doldur(liste) {
      P.degistir(sec, P.h("option", { value: "" }, liste.length ? "— " + liste.length + " sonuç —" : "— sonuç yok —"));
      liste.forEach(function (x) { sec.appendChild(P.h("option", { value: x.model }, x.maker + " | " + x.model)); });
    }
    giris.addEventListener("input", function () {
      clearTimeout(bekle);
      var q = giris.value.trim();
      if (q.length < 2) { doldur([]); return; }
      bekle = setTimeout(async function () {
        try { var r = await P.api("/api/studyo/lens-ara?tur=" + tur + "&q=" + encodeURIComponent(q)); doldur(r.sonuclar || []); }
        catch (e) { P.bildir(e.message || "Arama başarısız.", "hata"); }
      }, 250);
    });
    sec.addEventListener("change", function () {
      if (!sec.value) return;
      lp = lp || {}; lp[tur] = sec.value; kirli = true; lensYaz();
    });
    return { giris: giris, sec: sec };
  }
  function lensYaz() {
    if (!lensKutu) return;
    var yer = lensKutu.querySelector("[data-lens-ozet]");
    if (yer) yer.textContent = lensProfil() ? "Seçili: " + lp.kamera + " + " + lp.lens + (lp.yon === "duzelt" ? " (bozulmayı düzelt)" : " (lens karakteri ekle)") : "Seçili lens yok. Film, lens profili olmadan kurulur.";
  }
  function lensBolumu() {
    lp = d.ayar.lensProfili ? JSON.parse(JSON.stringify(d.ayar.lensProfili)) : null;
    var kutu = P.h("div");
    lensKutu = kutu;
    if (!d.lens || !d.lens.hazir) {
      var indir = P.dugme("Lens profillerini indir (≈5 MB, ücretsiz)", { tur: "hafif", onclick: async function () {
        indir.disabled = true;
        try { await P.api("/api/studyo/lens-kur", {}, { zamanAsimi: 180000 }); P.bildir("Lens profilleri indi.", "ok"); await detayYukle(); ciz(); }
        catch (e) { indir.disabled = false; P.bildir(e.message || "İndirilemedi.", "hata"); }
      } });
      kutu.appendChild(P.h("p", { class: "ipucu" }, "Açık kaynak Lensfun veritabanı (CC BY-SA 3.0): yaklaşık 1000 kamera ve 1500 lens profili. Bir kez indirilir, depoya girmez."));
      kutu.appendChild(P.h("div", { class: "satir" }, indir));
      return P.bolum("Lens profili", "Filme gerçek bir lensin karakterini (bozulma, köşe kararması) ekler.", kutu);
    }
    var kam = aramaAlani("kamera", "Kamera / telefon"), len = aramaAlani("lens", "Lens");
    var odak = P.girdi({ type: "number", min: "1", max: "2000", step: "any", deger: lp && lp.odak || "", placeholder: "mm", style: "width:5rem", "aria-label": "Odak uzaklığı (mm)" });
    var diy = P.girdi({ type: "number", min: "0.5", max: "64", step: "any", deger: lp && lp.diyafram || "", placeholder: "f/", style: "width:5rem", "aria-label": "Diyafram" });
    var duz = P.h("input", { type: "checkbox", "aria-label": "Bozulmayı düzelt" }); duz.checked = !!(lp && lp.yon === "duzelt");
    function sayi(girdi, anahtar) { girdi.addEventListener("input", function () { if (!lp) lp = {}; if (girdi.value === "") delete lp[anahtar]; else lp[anahtar] = Number(girdi.value); kirli = true; }); }
    sayi(odak, "odak"); sayi(diy, "diyafram");
    duz.addEventListener("change", function () { if (!lp) lp = {}; if (duz.checked) lp.yon = "duzelt"; else delete lp.yon; kirli = true; lensYaz(); });
    var kaldir = P.dugme("Lens profilini kaldır", { tur: "hafif", onclick: function () { lp = null; kirli = true; kam.giris.value = ""; len.giris.value = ""; odak.value = ""; diy.value = ""; duz.checked = false; lensYaz(); } });
    kutu.appendChild(P.h("p", { class: "ipucu" }, d.lens.kameralar + " kamera, " + d.lens.lensler + " lens profili. Her telefon yok (ör. iPhone XS, Huawei, Nokia, LG, GoPro, DJI var); bulamazsan o model veritabanında yoktur."));
    kutu.appendChild(P.h("div", { class: "studyo-ayar" }, P.alan("Kamera / telefon", kam.giris), P.alan("Kamera seç", kam.sec), P.alan("Lens", len.giris), P.alan("Lens seç", len.sec),
      P.alan("Odak (mm)", odak), P.alan("Diyafram (f)", diy), P.alan("Bozulmayı düzelt", duz, { ipucu: "Kendi gerçek videondaki lens bozulmasını giderir. Kapalıyken profil, AI klibe lens karakteri ekler." })));
    kutu.appendChild(P.h("p", { "data-lens-ozet": "" }));
    kutu.appendChild(P.h("div", { class: "satir" }, kaldir));
    lensYaz();
    return P.bolum("Lens profili", "Filme gerçek bir lensin karakterini (bozulma, köşe kararması, renk sapması) ekler; ücretsiz, kurarken uygulanır.", kutu);
  }

  function sahneKarti(s, i) {
    var gorsel = s.kaynak
      ? P.h("img", { class: "studyo-thumb", alt: "Sahne " + (i + 1), loading: "lazy", src: "/studyo/" + enc(ad) + "/girdi/" + enc(s.kaynak) })
      : P.h("div", { class: "studyo-thumb" }, P.ikon(s.mod === "video" ? "film" : "metin"));
    var mod = P.secim(MODLAR.filter(function (m) { return s.kaynak ? m[0] === "ilk-kare" || m[0] === "referans" : m[0] === "metin" || m[0] === "video" || m[0] === "3b"; }), s.mod);
    mod.addEventListener("change", function () {
      s.mod = mod.value; kirli = true;
      if (s.mod === "3b") { s.sablon3d = s.sablon3d || "urun"; s.parametre = s.parametre || {}; sahneleriCiz(); }
    });
    var istem = P.metinAlani({ maxlength: "3500", placeholder: s.mod === "metin" ? "Ne görmek istiyorsun? (İngilizce yazarsan daha iyi sonuç verir)" : "Sahnede ne olsun? (İngilizce)", "aria-label": "Sahne " + (i + 1) + " istemi" });
    istem.value = s.hareket || "";
    istem.addEventListener("input", function () { s.hareket = istem.value; kirli = true; });
    var sure = P.girdi({ type: "number", min: "2", max: "15", deger: s.sure, style: "width:4.5rem", "aria-label": "Süre (sn)" });
    sure.addEventListener("input", function () { s.sure = Number(sure.value) || d.ayar.sure; kirli = true; });
    var anlatim = P.metinAlani({ maxlength: "600", placeholder: "Anlatım (isteğe bağlı): bu sahnede okunacak metin. Ücretsiz sesle seslendirilir, altyazı olarak yakılır.", "aria-label": "Sahne " + (i + 1) + " anlatımı" });
    anlatim.rows = 2; anlatim.value = s.anlatim || "";
    anlatim.addEventListener("input", function () { s.anlatim = anlatim.value; kirli = true; });
    var yon = d.yonetmen, yonKutu = P.h("div", { class: "studyo-ayar" });
    [["plan", "plan", "Plan"], ["kameraHareketi", "hareket", "Kamera"], ["lens", "lens", "Lens"], ["isik", "isik", "Işık"]].forEach(function (g) {
      var liste = [["", "—"]].concat(Object.keys(yon[g[1]]).map(function (k) { return [k, yon[g[1]][k]]; }));
      var sec = P.secim(liste, s[g[0]] || "", { "aria-label": g[2] + " (sahne " + (i + 1) + ")" });
      sec.addEventListener("change", function () { if (sec.value) s[g[0]] = sec.value; else delete s[g[0]]; kirli = true; });
      yonKutu.appendChild(P.alan(g[2], sec));
    });
    var gecSec = P.secim(Object.keys(d.gecisler || {}).map(function (k) { return [k, d.gecisler[k]]; }), s.gecis || "kes", { "aria-label": "Geçiş: bu sahneden sonrakine (sahne " + (i + 1) + ")" });
    gecSec.addEventListener("change", function () { if (gecSec.value && gecSec.value !== "kes") s.gecis = gecSec.value; else delete s.gecis; kirli = true; });
    yonKutu.appendChild(P.alan("Geçiş", gecSec));
    var ek = [];
    if (s.mod === "3b") {
      var pr = s.parametre = s.parametre || {}, d3 = d.sahne3d;
      var sab = P.secim(Object.keys(d3.sablonlar).map(function (k) { return [k, d3.sablonlar[k]]; }), s.sablon3d || "urun", { "aria-label": "3B şablon (sahne " + (i + 1) + ")" });
      sab.addEventListener("change", function () { s.sablon3d = sab.value; kirli = true; sahneleriCiz(); });
      var alanYaz = function (anahtar, etiket, yer) { var g = P.girdi({ deger: pr[anahtar] || "", maxlength: "120", placeholder: yer, "aria-label": etiket + " (sahne " + (i + 1) + ")" }); g.addEventListener("input", function () { if (g.value) pr[anahtar] = g.value; else delete pr[anahtar]; kirli = true; }); return P.alan(etiket, g); };
      var renkG = P.girdi({ type: "color", deger: pr.renk || "#c8f53a", "aria-label": "Vurgu rengi (sahne " + (i + 1) + ")" });
      renkG.addEventListener("input", function () { pr.renk = renkG.value; kirli = true; });
      var kutu3 = P.h("div", { class: "studyo-ayar" }, P.alan("Şablon", sab), alanYaz("baslik", "Başlık", "Ekranda görünen büyük yazı"), alanYaz("altBaslik", "Alt başlık", ""), P.alan("Renk", renkG));
      if ((s.sablon3d || "urun") === "karakter") {
        var on = P.secim(d3.onAyarlar.map(function (k) { return [k, k]; }), pr.onAyar || "yaratici", { "aria-label": "Karakter ön ayarı (sahne " + (i + 1) + ")" });
        on.addEventListener("change", function () { pr.onAyar = on.value; kirli = true; });
        kutu3.appendChild(P.alan("Karakter", on));
      }
      if ((s.sablon3d || "urun") === "urun") {
        var glbDosya = P.h("input", { type: "file", accept: ".glb,model/gltf-binary", hidden: true });
        glbDosya.addEventListener("change", async function () {
          var f = glbDosya.files[0]; glbDosya.value = ""; if (!f) return;
          if (f.size > 14 * 1024 * 1024) return P.bildir("GLB en çok 14 MB olabilir.", "hata");
          try {
            P.bildir("Model yükleniyor…", "bilgi");
            var buf = new Uint8Array(await f.arrayBuffer()), ikili = "";
            for (var q = 0; q < buf.length; q += 0x8000) ikili += String.fromCharCode.apply(null, buf.subarray(q, q + 0x8000));
            var r = await P.api("/api/studyo/yukle", { ad: ad, rol: "model", dosya: f.name, veri: btoa(ikili) }, { zamanAsimi: 60000 });
            pr.glb = r.dosya; kirli = true; sahneleriCiz(); P.bildir("Model eklendi: " + r.dosya, "ok");
          } catch (e) { P.bildir(e.message || "Model yüklenemedi.", "hata"); }
        });
        kutu3.appendChild(P.alan("Kendi 3B modelin (.glb)", P.h("div", { class: "satir" },
          P.dugme(pr.glb ? "Modeli değiştir" : "Model yükle", { tur: "hafif", kucuk: true, onclick: function () { glbDosya.click(); } }),
          pr.glb ? P.dugme("Kaldır", { tur: "hafif", kucuk: true, onclick: function () { delete pr.glb; kirli = true; sahneleriCiz(); } }) : null,
          pr.glb ? P.h("span", { class: "soluk" }, pr.glb) : P.h("span", { class: "soluk" }, "Boşsa varsayılan şekil çizilir."), glbDosya)));
      }
      ek.push(kutu3);
      ek.push(P.h("p", { class: "soluk" }, (s.sablon3d === "karakter" ? "Karakterin ağzı, aşağıdaki Anlatım metninin sesiyle oynar. " : "") + "Ücretsiz: film kurulurken bu bilgisayarda çizilir" + (d3.chrome && d3.three ? "." : (!d3.chrome ? ". Chrome ya da Edge bulunamadı!" : "; ilk kullanımda three.js (~30 MB) iner."))));
    }
    if (s.mod === "video") {
      var url = P.girdi({ type: "url", placeholder: "https:// MP4 ya da YouTube linki (yalnız kendi videon)", deger: s.url || "", style: "width:100%" });
      url.addEventListener("input", function () { s.url = url.value.trim(); kirli = true; });
      ek.push(P.alan("Video linki", url));
    }
    var durum = s.klip
      ? [P.rozet("klip hazır", "ok", "tamam"), P.h("video", { class: "studyo-klip", controls: true, preload: "none", src: "/studyo/" + enc(ad) + "/klip/" + enc(s.klip) })]
      : [s.mod === "3b" ? P.rozet("ücretsiz · 3B", "ok") : P.rozet("≈ " + s.kredi + " kredi", "soluk")];
    var araclar = P.h("div", { class: "satir" },
      P.dugme("", { tur: "hafif", kucuk: true, ikon: "yukari", aria: "Yukarı taşı", disabled: i === 0, onclick: function () { tasi(i, -1); } }),
      P.dugme("", { tur: "hafif", kucuk: true, ikon: "ok-sag", sinif: "asagi", aria: "Aşağı taşı", disabled: i === sahneler.length - 1, onclick: function () { tasi(i, 1); } }),
      P.dugme("", { tur: "tehlike", kucuk: true, ikon: "sil", aria: "Sahneyi sil", onclick: function () { sahneler.splice(i, 1); kirli = true; sahneleriCiz(); } }));
    return P.h("div", { class: "studyo-kart" }, gorsel,
      P.h("div", null, P.h("div", { class: "sahne-ust" }, P.h("h4", null, "Sahne " + (i + 1)), mod, P.alan("sn", sure), araclar), ek, s.mod === "3b" ? null : istem, s.mod === "3b" ? null : P.h("details", null, P.h("summary", null, "Yönetmen modu: plan, kamera, lens, ışık"), yonKutu), anlatim, P.h("div", { class: "satir" }, durum)));
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
    var govde = { ad: ad, lensProfili: lensProfil(), stil: o.stil.value, oran: o.oran.value, model: o.model.value, cozunurluk: o.coz.value, sure: Number(o.sure.value) || 6,
      dil: o.dil.value, kamera: o.kamera.value,
      sahneler: sahneler.map(function (s) { return { mod: s.mod, kaynak: s.kaynak, url: s.url, hareket: s.hareket, sure: s.sure, an: s.an, anlatim: s.anlatim, plan: s.plan, kameraHareketi: s.kameraHareketi, lens: s.lens, isik: s.isik, gecis: s.gecis }; }) };
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
      calisiyor ? P.h("p", { class: "soluk" }, is.tur === "yuz" ? "Yüzler değiştiriliyor… (ekran kartıyla birkaç saniye, işlemciyle birkaç dakika)" : is.tur === "kur" ? "Film kuruluyor…" : is.tur === "kuru" ? "Maliyet hesaplanıyor (kredi harcanmıyor)…" : "Klipler üretiliyor, birkaç dakika sürebilir…") : (is && is.kod !== null && is.kod !== 0 ? P.mesajKutusu("hata", "Son işlem hata ile bitti (kod " + is.kod + "). Ayrıntı aşağıda.") : null),
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
        if (!yeni.is || !yeni.is.calisiyor) {
          if (oncekiTur === "kur") d.videoT = Date.now();
          if (oncekiTur === "yuz" && yeni.is && yeni.is.kod === 0) { yuz = { sablon: "", kisiler: [] }; await detayYukle(); ciz(); } else sahneleriCiz();
        }
        else uretimCiz();
        izle();
      } catch (e) { /* ag kopmasi: bir sonraki turda yeniden dener */ izle(); }
    }, 2000);
  }

  // ---------------------------------------------------------------- yuz degistirme (yerel FaceFusion, ucretsiz)
  var yuz = { sablon: "", kisiler: [] }, yuzYer = null;
  async function yuzYukle(liste, rol) {
    try {
      for (var i = 0; i < liste.length; i++) {
        var k = await kucult(liste[i]);
        var r = await P.api("/api/studyo/yukle", { ad: ad, dosya: k.dosya, veri: k.veri, rol: rol }, { zamanAsimi: 60000 });
        var dosya = r.dosya.replace(/^.*\//, "");
        if (rol === "sablon") yuz.sablon = dosya; else if (yuz.kisiler.indexOf(dosya) < 0) yuz.kisiler.push(dosya);
      }
      yuzCiz();
    } catch (e) { P.durumYaz(ui.durum, "hata", e instanceof P.ApiHata ? e : e.message); }
  }
  function yuzCiz() {
    var sabInp = P.h("input", { type: "file", accept: "image/jpeg,image/png,image/webp", hidden: true });
    var kisiInp = P.h("input", { type: "file", accept: "image/jpeg,image/png,image/webp", multiple: true, hidden: true });
    sabInp.addEventListener("change", function () { var l = Array.prototype.slice.call(sabInp.files); sabInp.value = ""; yuzYukle(l.slice(0, 1), "sablon"); });
    kisiInp.addEventListener("change", function () { var l = Array.prototype.slice.call(kisiInp.files); kisiInp.value = ""; yuzYukle(l, "kisi"); });
    var riza = P.onayKutusu("Bu fotoğraflardaki kişiler benim ya da yazılı izin veren kişiler. Yüzlerin yapay zekâyla değiştirildiğini yayında belirteceğim.", false);
    var hazir = d.yuz && d.yuz.hazir;
    var calis = P.dugme("Yüzleri değiştir (ücretsiz, yerel)", { tur: "birincil", ikon: "yenile", disabled: true, onclick: async function () {
      try {
        await P.api("/api/studyo/yuz", { ad: ad, sablon: yuz.sablon, kisiler: yuz.kisiler, riza: riza.girdi.checked });
        await detayYukle(true); uretimCiz(); izle();
      } catch (e) { P.durumYaz(ui.durum, "hata", e); }
    } });
    function durumGuncelle() { calis.disabled = !(hazir && riza.girdi.checked && yuz.sablon && yuz.kisiler.length); }
    riza.girdi.addEventListener("change", durumGuncelle); durumGuncelle();
    P.degistir(yuzYer,
      hazir ? null : P.mesajKutusu("uyari", P.h("span", null, (d.yuz && d.yuz.neden) || "FaceFusion kurulu değil.", d.yuz && d.yuz.cozum ? " " + d.yuz.cozum : "")),
      P.h("div", { class: "satir" },
        P.dugme("Poz fotoğrafı seç", { ikon: "gorsel", tur: "hafif", onclick: function () { sabInp.click(); } }), P.h("span", { class: "soluk" }, yuz.sablon || "henüz seçilmedi"),
        P.dugme("Kişi fotoğrafları (soldan sağa)", { ikon: "kisi", tur: "hafif", onclick: function () { kisiInp.click(); } }), P.h("span", { class: "soluk" }, yuz.kisiler.length ? yuz.kisiler.join(", ") : "henüz seçilmedi"),
        P.dugme("Temizle", { tur: "hafif", kucuk: true, onclick: function () { yuz.sablon = ""; yuz.kisiler = []; yuzCiz(); } })),
      riza, P.h("div", { class: "satir" }, calis), sabInp, kisiInp);
  }

  function ciz() {
    P.degistir(ui.govde,
      P.h("div", { class: "satir" }, P.dugme("Tüm işler", { tur: "hafif", ikon: "sol", onclick: function () { P.git("studyo"); } }), P.h("strong", null, ad)),
      ayarBolumu(),
      lensBolumu(),
      P.bolum("Sahneler", "Sırası film sırasıdır. Fotoğraf, yazı ya da kendi videonla sahne ekle.",
        ui.sahneYer = P.h("div"),
        P.h("div", { class: "satir" }, ekleDugmeleri()), ui.foto),
      P.bolum("Yüz değiştirme (çift fotoğrafı)", "Poz fotoğrafındaki yüzler senin/çiftin fotoğraflarıyla değişir, sonuç bir sahne olur. Yalnız kendi ya da izinli yüzler. Poz fotoğrafı telifsiz ya da kendi çekimin olmalı.", yuzYer = P.h("div")),
      P.bolum("Üretim", "Önce maliyeti gör, onaylarsan üretilir. Klipler hazır olunca film tek MP4 olarak birleşir.", ui.uretimYer = P.h("div")),
      P.dugme("Değişiklikleri kaydet", { ikon: "tamam", onclick: function () { kaydet(false); } }));
    sahneleriCiz(); yuzCiz();
  }
  var sablonSec = null, kadro = {};
  // yuklenen benzersiz fotograflar (sahnelerin kaynaklari)
  function benzersizFotolar() {
    var gor = {}, l = [];
    sahneler.forEach(function (s) { if (s.kaynak && !gor[s.kaynak]) { gor[s.kaynak] = 1; l.push(s.kaynak); } });
    return l;
  }
  // kadro secimi: Erkek / Kadin / Cift fotografi; liste her acilista guncellenir
  function kadroSecimi(anahtar, etiket, varsayilanSira) {
    var sec = P.secim([["", "—"]], "", { "aria-label": etiket + " fotoğrafı" });
    function doldur() {
      var l = benzersizFotolar(), onceki = sec.value || (kadro[anahtar] !== undefined ? kadro[anahtar] : (l[varsayilanSira] || ""));
      P.degistir(sec, P.h("option", { value: "" }, "—"));
      l.forEach(function (f) { sec.appendChild(P.h("option", { value: f }, f)); });
      sec.value = l.indexOf(onceki) >= 0 ? onceki : "";
      kadro[anahtar] = sec.value;
    }
    sec.addEventListener("focus", doldur); sec.addEventListener("mousedown", doldur);
    sec.addEventListener("change", function () { kadro[anahtar] = sec.value; });
    doldur();
    return P.alan(etiket, sec);
  }
  async function sablonEkle() {
    if (!sablonSec.value) return P.durumYaz(ui.durum, "uyari", "Önce bir çekim şablonu seç.");
    try {
      await kaydet(true);
      await P.api("/api/studyo/sablon", { ad: ad, sablon: sablonSec.value, kadro: { erkek: kadro.erkek || "", kadin: kadro.kadin || "", cift: kadro.cift || "" } });
      await detayYukle(); ciz();
    } catch (e) { P.durumYaz(ui.durum, "hata", e); }
  }
  function ekleDugmeleri() {
    ui.foto = P.h("input", { type: "file", accept: "image/jpeg,image/png,image/webp", multiple: true, hidden: true });
    ui.foto.addEventListener("change", function () { var l = Array.prototype.slice.call(ui.foto.files); ui.foto.value = ""; fotoYukle(l); });
    return [
      P.dugme("Fotoğraf ekle", { ikon: "gorsel", onclick: function () { ui.foto.click(); } }),
      P.dugme("Yazıdan sahne ekle", { ikon: "metin", onclick: function () { sahneler.push({ mod: "metin", hareket: "", sure: d.ayar.sure, kredi: 0 }); kirli = true; sahneleriCiz(); } }),
      sablonSec = P.secim([["", "Çekim şablonu…"]].concat(Object.keys(d.sablonlar).map(function (k) { return [k, d.sablonlar[k]]; })), "", { "aria-label": "Çekim şablonu" }),
      P.h("div", { class: "studyo-ayar", style: "width:100%" }, kadroSecimi("erkek", "Kadro: erkek", 0), kadroSecimi("kadin", "Kadro: kadın", 1), kadroSecimi("cift", "Kadro: çift fotoğrafı (isteğe bağlı)", 2)),
      P.dugme("Şablonu ekle", { ikon: "arti", onclick: sablonEkle }),
      P.dugme("3B sahne ekle", { ikon: "arti", onclick: function () { sahneler.push({ mod: "3b", sablon3d: "urun", parametre: {}, sure: d.ayar.sure, kredi: 0 }); kirli = true; sahneleriCiz(); } }),
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
