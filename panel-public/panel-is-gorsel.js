// PANEL ARAYUZU — is sayfasi / "Sahneler" sekmesi: sahne tablosu, gorsel onizleme, silme, sahne bazli yeniden arama, atif kutusu.
// Uclar: GET /api/sahneler?is=, GET /onizle/<is>/<sahne>/<ad> (cerezle), POST /api/gorsel-sil {is,sahne,ad}, POST /api/calistir {tur:"gorselSahne",sahne,ara},
//        GET /api/dosya?tur=atif.
// 100+ sahne icin 20'ser parca halinde cizilir; gorseller loading="lazy".
// Stok video klibi (video-bul.js, 00-stok-*.mp4; sunucu g.video=true verir) <video> ile onizlenir ve gorsel gibi silinir.
(function () {
  "use strict";
  var P = window.P;
  var PARCA = 20;
  var DURUM = { tamam: ["görsel var", "ok"], eksik: ["görsel yok", "hata"], uretilen: ["yapay zekâ", "vurgu"], doldurma: ["doldurma", "uyari"] };
  function videoMu(g) { return !!(g && (g.video || /\.mp4$/i.test(g.ad || ""))); }

  // tek buyuk onizleme diyalogu (tum is sayfalari paylasir)
  var diyalog = null;
  function diyalogAl() {
    if (diyalog) return diyalog;
    var resim = P.h("img", { alt: "" });
    // panel-stil.css yalniz img'yi boyutlar: klip ayni olculerle
    var video = P.h("video", { controls: true, loop: true, playsinline: true, preload: "metadata", hidden: true,
      style: { "max-width": "100%", "max-height": "58vh", "object-fit": "contain", "align-self": "center", background: "#000" } });
    video.muted = true;
    var bilgi = P.h("dl", { class: "meta-liste" });
    var altIs = P.h("div", { class: "satir" });
    var kapat = P.dugme("Kapat", { tur: "hafif", onclick: function () { d.close(); } });
    var d = P.h("dialog", { class: "diyalog", "aria-label": "Görsel önizleme" }, P.h("div", { class: "diyalog-ic" }, resim, video, bilgi, P.h("div", { class: "satir" }, altIs, kapat)));
    d.addEventListener("click", function (e) { if (e.target === d) d.close(); });
    // kapaninca klip durur ve indirmeyi birakir
    d.addEventListener("close", function () { try { video.pause(); } catch (e) { } video.removeAttribute("src"); try { video.load(); } catch (e) { } });
    document.body.appendChild(d);
    diyalog = { el: d, resim: resim, video: video, bilgi: bilgi, altIs: altIs };
    return diyalog;
  }

  function kur(ctx) {
    var yazilan = {};                       // sahne no -> yazilmis arama metni (yenilemede kaybolmasin)
    var veri = null, goster = PARCA, yalnizEksik = false, damga = Date.now();
    var ozetYer = P.h("div", { class: "durum-yeri" });
    var liste = P.h("div", { class: "sahne-listesi" });
    var daha = P.h("div", { class: "satir" });
    var yerGenel = P.h("div", { class: "durum-yeri", "aria-live": "polite" });
    var atifYer = P.h("div", { class: "durum-yeri" });
    var atifTa = P.metinAlani({ rows: "8", readonly: true, "aria-label": "Görsel atıfları", class: "mono-alan" });
    var atifKopya = P.kopyaDugmesi("Açıklamaya yapıştırmak için kopyala", function () { return atifTa.value; });

    var filtreKutu = P.onayKutusu("Yalnız görseli eksik sahneler", false);
    filtreKutu.girdi.addEventListener("change", function () { yalnizEksik = filtreKutu.girdi.checked; goster = PARCA; ciz(); });
    var bulBtn = P.dugme("Görselleri bul", { tur: "hafif", ikon: "gorsel", onclick: function () { ctx.calistir("gorsel", {}, yerGenel); } });
    ctx.kilitle(bulBtn, "mesgul");
    var yenileBtn = P.dugme("Listeyi yenile", { tur: "hafif", ikon: "yenile", onclick: function () { yukle(); } });

    function gorselAdresi(s, g) { return "/onizle/" + encodeURIComponent(ctx.is) + "/" + encodeURIComponent(s.klasor) + "/" + encodeURIComponent(g.ad) + "?t=" + damga; }

    async function sil(s, g, yer) {
      var vid = videoMu(g);
      var ok = await P.onayIste(yer, vid
        ? { baslik: "Bu stok video klibi silinsin mi?", metin: s.klasor + "/" + g.ad + " dosyası silinir. Bu klip sonraki stok video aramalarında bir daha gelmez.", evet: "Sil", tehlikeli: true }
        : { baslik: "Bu görsel silinsin mi?", metin: s.klasor + "/" + g.ad + " dosyası silinir. Bu görsel sonraki aramalarda bir daha gelmez.", evet: "Sil", tehlikeli: true });
      if (!ok) return;
      try {
        await P.api("/api/gorsel-sil", { is: ctx.is, sahne: s.klasor, ad: g.ad });
        P.bildir(vid ? "Stok video klibi silindi." : "Görsel silindi.", "ok");
        if (diyalog && diyalog.el.open) diyalog.el.close();
        await yukle(); P.islerYenile().catch(function () { }); ctx.yenile().catch(function () { });
      } catch (e) { P.durumYaz(yer, "hata", e); }
    }
    function buyut(s, g, yer, tetik) {
      var d = diyalogAl();
      var vid = videoMu(g);
      d.resim.hidden = vid; d.video.hidden = !vid;
      if (vid) { d.resim.removeAttribute("src"); d.video.src = gorselAdresi(s, g); d.video.setAttribute("aria-label", "Sahne " + s.no + " — " + g.ad); }
      else { d.resim.src = gorselAdresi(s, g); d.resim.alt = "Sahne " + s.no + " — " + g.ad; }
      P.degistir(d.bilgi,
        P.h("dt", null, "Sahne"), P.h("dd", null, s.no + " · " + s.klasor + "/" + g.ad),
        vid ? P.h("dt", null, "Tür") : null, vid ? P.h("dd", null, "Stok video klibi (video-bul.js); videoda sahnenin başında oynar") : null,
        P.h("dt", null, "Kaynak"), P.h("dd", null, g.kaynak || "bilinmiyor"),
        P.h("dt", null, "Lisans"), P.h("dd", null, g.lisans || "bilinmiyor"),
        P.h("dt", null, "Atıf"), P.h("dd", null, g.atif || "gerekmiyor / kayıt yok"));
      var silBtn = P.dugme("Sil", { tur: "tehlike", ikon: "sil", onclick: function () { d.el.close(); sil(s, g, yer); } });
      ctx.kilitler = ctx.kilitler.filter(function (k) { return k.grup !== "diyalog"; });
      ctx.kilitle(silBtn, "mesgul", "diyalog");
      P.degistir(d.altIs, silBtn);
      d.el.addEventListener("close", function () { if (tetik && tetik.focus) tetik.focus(); }, { once: true });
      d.el.showModal();
    }

    function sahneKarti(s) {
      var yer = P.h("div", { class: "durum-yeri" });
      var d = DURUM[s.durum] || [s.durum, "soluk"];
      var aralik = s.paragraflar && s.paragraflar.length ? "Paragraf " + (s.paragraflar[0] + 1) + (s.paragraflar.length > 1 ? "–" + (s.paragraflar[s.paragraflar.length - 1] + 1) : "") : "paragraf bilgisi yok";
      var giris = P.girdi({ type: "text", placeholder: "arama ifadesi (örn. Albert Einstein portrait)", "aria-label": "Sahne " + s.no + " için arama ifadesi", maxlength: "200", deger: yazilan[s.no] || "" });
      giris.addEventListener("input", function () { yazilan[s.no] = giris.value; });
      var ara = P.dugme("Yeniden ara", { tur: "hafif", ikon: "ara", kucuk: true, onclick: async function () {
        var q = giris.value.trim();
        if (!q) { P.durumYaz(yer, "uyari", "Önce bir arama ifadesi yaz."); giris.focus(); return; }
        P.bos(yer);
        var r = await ctx.calistir("gorselSahne", { sahne: s.no, ara: q }, yer);
        if (r) { yazilan[s.no] = ""; giris.value = ""; }
      } });
      ctx.kilitle(ara, "mesgul", "sahne");
      giris.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); ara.click(); } });
      var izgara = P.h("div", { class: "gorsel-izgara" }, (s.gorseller || []).map(function (g, i) {
        var vid = videoMu(g);
        // klip: ilk karesi gosterilir (oynatma diyalogda); #t=0.1 tarayicinin bos kare yerine goruntu cizmesi icin
        var onizleme = vid
          ? P.h("video", { src: gorselAdresi(s, g) + "#t=0.1", preload: "metadata", playsinline: true, "aria-hidden": "true",
              style: { width: "100%", height: "100%", "object-fit": "cover", display: "block", "pointer-events": "none" } })
          : P.h("img", { src: gorselAdresi(s, g), alt: "Sahne " + s.no + " görsel " + (i + 1), loading: "lazy", decoding: "async" });
        if (vid) onizleme.muted = true;
        var kutu = P.h("button", { type: "button", class: "gorsel-kutu", "aria-label": "Sahne " + s.no + (vid ? " stok video klibi" : " görsel " + (i + 1)) + " — büyüt (" + (g.kaynak || "kaynak bilinmiyor") + ")" },
          onizleme);
        kutu.addEventListener("click", function () { buyut(s, g, yer, kutu); });
        var silBtn = P.h("button", { type: "button", class: "ikon-btn gorsel-sil", "aria-label": "Sahne " + s.no + " " + g.ad + (vid ? " klibini sil" : " görselini sil"), title: "Sil" }, P.ikon("sil"));
        silBtn.addEventListener("click", function () { sil(s, g, yer); });
        ctx.kilitle(silBtn, "mesgul", "sahne");
        return P.h("div", { class: "gorsel-hucre" }, kutu, silBtn, P.h("div", { class: "gorsel-alt soluk" },
          vid ? P.h("span", { class: "chip" }, "stok video") : null, vid ? " " : null,
          g.kaynak ? g.kaynak + (g.lisans ? " · " + g.lisans : "") : "kaynak yok"));
      }));
      return P.h("article", { class: "sahne s-" + s.durum },
        P.h("header", { class: "sahne-ust" }, P.h("h4", null, "Sahne " + s.no), P.rozet(d[0], d[1]),
          P.h("span", { class: "soluk" }, aralik + (s.sureSn ? " · " + P.sureYaz(s.sureSn) : ""))),
        s.metin ? P.h("p", { class: "sahne-metin" }, s.metin) : null,
        s.aramalar && s.aramalar.length ? P.h("div", { class: "etiket-satiri" }, s.aramalar.map(function (a) { return P.h("span", { class: "chip pasif" }, a); })) : null,
        s.gorseller && s.gorseller.length ? izgara : P.h("p", { class: "soluk" }, "Bu sahnede görsel yok. Aşağıdan arama ifadesi yazıp yeniden ara."),
        P.h("div", { class: "satir arama-satiri" }, giris, ara), yer);
    }

    function ciz() {
      if (!veri) return;
      var s = veri.sahneler;
      var toplamG = s.reduce(function (t, x) { return t + (x.gorseller || []).length; }, 0);
      var eksik = s.filter(function (x) { return !(x.gorseller || []).length; }).length;
      // manifest notlari: lisans uyarilari (ör. CC BY-SA) ve kaynak sorunlari (ör. Wikimedia 2 hata, Openverse kapali)
      var hatalar = veri.kaynakHatalari || {};
      var kaynakSorunu = Object.keys(hatalar).map(function (k) { return k + (typeof hatalar[k] === "number" ? ": " + hatalar[k] + " hata" : ": " + hatalar[k]); });
      P.degistir(ozetYer, s.length ? P.h("p", null, s.length + " sahne · " + toplamG + " görsel" + (eksik ? " · " : ""), eksik ? P.rozet(eksik + " sahnede görsel yok", "hata", "uyari") : null)
        : P.h("p", { class: "soluk" }, "Henüz görsel bulunmadı. «Görselleri bul» ile başlat."),
        (veri.uyarilar || []).map(function (u) { return P.mesajKutusu("uyari", u); }),
        kaynakSorunu.length ? P.h("p", { class: "soluk" }, "Kaynak sorunları (son arama): " + kaynakSorunu.join(" · ")) : null);
      var gor = s.filter(function (x) { return !yalnizEksik || !(x.gorseller || []).length; });
      P.bos(liste);
      ctx.kilitler = ctx.kilitler.filter(function (k) { return k.grup !== "sahne"; });
      gor.slice(0, goster).forEach(function (x) { liste.appendChild(sahneKarti(x)); });
      P.bos(daha);
      if (gor.length > goster) daha.appendChild(P.dugme("Daha " + Math.min(PARCA, gor.length - goster) + " sahne göster (kalan " + (gor.length - goster) + ")", { tur: "hafif", onclick: function () { goster += PARCA; ciz(); } }));
      ctx.kilitleriUygula();
    }
    async function yukle() {
      try { veri = await P.api("/api/sahneler?is=" + encodeURIComponent(ctx.is)); damga = Date.now(); ciz(); }
      catch (e) { P.durumYaz(ozetYer, "hata", e); }
      try { var a = await P.api("/api/dosya?is=" + encodeURIComponent(ctx.is) + "&tur=atif"); atifTa.value = a.icerik || ""; P.degistir(atifYer, a.icerik ? null : P.h("p", { class: "soluk" }, "Atıf gerektiren görsel yok ya da henüz görsel bulunmadı.")); }
      catch (e) { P.durumYaz(atifYer, "hata", e); }
    }
    P.olay.dinle("is-bitti", function (o) { if (o && o.is === ctx.is && document.body.contains(liste)) yukle(); });

    var kok = P.h("div", { class: "sekme-icerik" },
      P.bolum("Sahneler ve görseller", "Her sahne senaryonun bir paragraf grubuna denk gelir. Yanlış görseli sil; sahne için yeni arama ifadesi yazıp yeniden ara. Silinen görsel bir daha gelmez.",
        P.h("div", { class: "satir" }, bulBtn, yenileBtn, filtreKutu), ozetYer, yerGenel, liste, daha),
      P.bolum("Görsel atıfları", "CC BY, CC BY-SA ve Pexels görselleri için kaynak göstermek gerekir. Bu metni YouTube açıklamasına ekle (Yayın paketi de içerir).",
        atifTa, P.h("div", { class: "satir" }, atifKopya), atifYer));
    return { kok: kok, ac: yukle, guncelle: function () { } };
  }
  P.sekmeler.push({ sira: 3, ad: "sahneler", etiket: "Sahneler", ikon: "gorsel", yalnizVideo: true, kur: kur });
})();
