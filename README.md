# Otopilot — konudan bitmiş videoya

> **Claude Code ya da Codex ile kullanacaksan:** depoyu klasör olarak aç, ajanı başlat, isteğini yaz ("şu konuda 40 saniyelik Shorts yap", "bir fitness influencer yarat ve 3 foto üret"). [`AGENTS.md`](AGENTS.md) (Claude Code için `CLAUDE.md` üzerinden) kendiliğinden okunur; ajan kurulumu, komutları ve akışı oradan bilir, sana tekrar sormaz.

> **Bu bir hizmet değil / This is not a service.** Otopilot, kendi bilgisayarında çalıştırdığın açık kaynaklı bir araçtır; burada video yapılmaz ve sipariş alınmaz (issue'lar yalnızca hata bildirimi ve özellik isteği içindir). Kendi videonu üretmek için depoyu Claude Code ya da Codex'e ver. / Otopilot is an open-source tool you run on your own computer. Videos are not made or ordered here (issues are for bug reports and feature requests only). To make your own video, give the repo to Claude Code or Codex.

Bir konu yaz, başlık yaz, **ÜRET**'e bas. Senaryoyu yazar, görselleri bulur, seslendirir, videoyu kurar. Bitmiş MP4, altyazı, kapak resmi ve YouTube yayın paketi çıkar.

Kurgu programı yok. Her şey kendi bilgisayarında çalışır (panel yalnızca `localhost`'ta açılır). Ücretli adımlar (senaryo yazımı) için **Claude (Anthropic) veya vidIQ anahtarı gerekir** — ya da senaryoyu kendin yazıp panele yapıştırırsın; geri kalan her şey anahtarsız çalışır.

```
konu + başlık (+ isteğe bağlı: kaynak metni, kişisel katkın)
   ↓
senaryo yazımı      → Claude (Anthropic) ya da vidIQ   ·  ya da kendin yaz
   ↓  ⏸ onay durağı: senaryoyu oku, düzenle, ONAYLA (varsayılan açık)
görsel bulma        → Pexels · Pixabay · Wikimedia · Openverse · NASA   (isteğe bağlı AI görsel)
seslendirme         → Edge sesli okuma (ücretsiz, resmî değil) · Azure Speech · Piper (yerel) · VoxCPM2 (yerel, 14 hazır doğal ses)
video kurulumu      → ffmpeg
   ↓
bitmiş MP4 + SRT + kapak (JPG) + YAYIN-PAKETI.md (başlık, açıklama, bölümler, atıflar)
```

---

## Ne yapabilir

- **Herhangi bir konu.** Senaryo şablonu türe göre seçilir: belgesel, reklam, haber/spor, eğitim, hikâye, tanıtım. Kaynak/araştırma metnini ve kendi bakışını (kişisel katkı) verirsen senaryo onlara dayanır.
- **Dört biçim:** YouTube uzun video (16:9) · YouTube Shorts (9:16) · Instagram Reels (9:16) · TikTok (9:16). Panelin teknik üst sınırları: Shorts 180 sn, Reels 1200 sn, TikTok 600 sn. Shorts sınırı Ekim 2024'te 45 sn'den 180 sn'ye çıktı; **platform kurallarını yayın öncesi kendi hesabından doğrula** (Reels/TikTok değerleri de bu şekilde teyit edilmeli). Reels ve TikTok'ta abone-ol kapanışı çıkarılır.
- **Çok dilli.** İngilizce, Türkçe, İspanyolca, Almanca, Fransızca… Dil, ses, konuşma hızı ve altyazı dili panelden seçilir; altyazı dili farklıysa çeviri adımı kendiliğinden eklenir. Kelime hızı: İngilizce 151, Türkçe 113 (ölçüldü), diğer diller 140 (tahmin; ses sonrası gerçek süre esas alınır).
- **Hızlı açılış.** Yeni uzun videoda geri sayım/intro/başlık kartı **kapalı** gelir (kanca 0. saniyede duyulur; kanal adı alt köşede 2 sn kalır). Eski sinematik açılış (5+10+3 sn) panelden seçilebilir — ilk kelime ~18. saniyede gelir ve izleyici kaybı riski uyarısı gösterilir.
- **Gömülü altyazı** (cümle ya da kelime kelime) + ayrı SRT. Kapatılabilir.
- **29 geçiş tipi, 5 hareket efekti, 6 renk tonu**, müzik ruh hali/kendi müzik dosyan/konuşmada kısma (ducking). Hiçbir şey belirtmezsen geçiş/efekt/renk iş adından türetilen bir rotasyonla çeşitlenir (hepsi aynı görünen videolar YouTube'un "tekrarlayan içerik" riskini artırır).
- **Görsel lisans süzgeci.** NC/ND lisanslı görseller elenir; CC BY / CC BY-SA / Pexels için atıf `ATIF.txt` ve yayın paketine otomatik girer.
- **Yayın paketi.** Başlık, açıklama, bölümler (00:00'dan), etiketler/hashtag'ler, atıflar, kapak ve "YouTube Studio'da değiştirilmiş/sentetik içerik kutusunu işaretle" hatırlatması. **Otomatik YouTube yükleme yoktur** (bilerek: Google OAuth kimliği ve API denetimi gerektirir; yayına almak senin kararındır). Yüklediğini panelde "yüklendi" diye işaretlersin; performans verisi vidIQ'dan çekilir.
- **Maliyet görünürlüğü.** Başlamadan önce tahmini maliyet, harcama günlüğü (`uretim/<is>/kullanim.json`), günlük/aylık/iş başına sınırlar.
- **Dayanıklı.** Her çıktı `.part` dosyasına yazılıp bitince yeniden adlandırılır; Durdur/çökme/elektrik kesintisi yarım dosya bırakıp sonraki denemeyi bozmaz. İşler kaldığı yerden devam eder. Başlamadan önce boş disk kontrolü yapılır.
- **GPU hızlandırma.** NVIDIA/AMD kodlayıcı varsa kullanılır; hata verirse CPU'ya otomatik geçilir (`VIDEO_KODEK=cpu` ile GPU hiç denenmez).
- **Ses seviyesi.** Final karışım **−16 LUFS**'a normalleştirilir (YouTube'un konuşma içeriği için uygun düzeyi); fon müziği konuşmanın altında kısılır, kapanışta yükselir.
- **Önizleme ve Shorts.** «Önizleme» adımı ilk saniyeleri düşük çözünürlükte kurar (tam render öncesi görünüm kontrolü); «Videodan Shorts çıkar» bitmiş uzun videodan dikey kesitler üretir. İkisi de iş sayfasının **Üretim → Çıktı** bölümünde oynatılır ve indirilir.
- **Ai Infapp (ayrı yerel panel).** Karakter yaratıp kilitler (kimliği her istemde sabit tutar; yüz tutarlılığı bağlanan sağlayıcıya bağlıdır), fotoroman, Etsy baskı tasarımı ve reklam görseli hazırlar. Videoların kendisinden bağımsızdır; panelden tek düğmeyle açılır (aşağıdaki [Ai Infapp](#ai-infapp) bölümü).

## Kurulum

**Windows:** depoyu indir, **PANEL.bat**'a çift tıkla. Node.js (en az 22), ffmpeg ve paketler eksikse kurulur — **sistem yazılımı kurmadan önce sana sorar** (E/H). Panel aynı pencerede çalışır; beklenmedik kapanırsa 3 sn sonra kendini yeniden başlatır. Tarayıcı, sunucu gerçekten cevap verince bir kez açılır.

```bash
git clone https://github.com/wj-sidiss/otopilot.git
```

**Mac / Linux (deneysel):** kod `process.platform`'a göre font ve klasör açma komutunu seçer, ama Windows dışında yeterince denenmedi.

```bash
cd otopilot
npm ci --ignore-scripts
node panel.js
```

ffmpeg gerekir: `brew install ffmpeg` veya `sudo apt install ffmpeg`.

Paketler `package-lock.json` ile sabitlenmiştir (`npm ci` herkese aynı sürümleri kurar).

**Güncelleme / Update:** `npm run guncelle` (git ile klonladıysan; yerel değişikliğin varsa durur, hiçbir şeyi silmez, paket listesi değiştiyse paketleri yeniden kurar). Ajan kullanıyorsan ona "Otopilot'u güncelle" demen yeter. ZIP ile indirdiysen yeni ZIP'i indirip `uretim/` klasörünü ve `.env` dosyasını taşı.

## Eğitim PDF'leri

`egitim/` klasöründe dört eğitim PDF'i var: YouTube içerik üretimi (seri 1), Instagram büyüme yol haritası, TikTok algoritması rehberi ve büyüme haritası, TikTok AI influencer rehberi. Panel terminalde ilk kez açılınca bunları masaüstünde **Otopilot Eğitim** klasörüne kendisi kopyalar (var olan dosyaya dokunmaz). Elle: `npm run egitim`.

## Anahtarlar

Panelin **Kaynaklar** sekmesinden girilir (kaydedince otomatik test edilir, silinebilir) ya da `.env` dosyasına elle yazılır (şablon: `.env.ornek`).

| Anahtar | Ne için | Zorunlu mu |
|---|---|---|
| **`ANTHROPIC_API_KEY`** (Claude) | senaryo yazımı (daha iyi kalite); `ANTHROPIC_MODEL` ile model seçilir | Senaryo için **ikisinden en az biri** — ya da senaryoyu kendin yaz |
| **`VIDIQ_KEY`** | senaryo yazımı (yedek motor), başlık puanlama, trend/viral analiz, performans | |
| `PEXELS_KEY`, `PIXABAY_KEY` | görsel kalitesini ve isabetini artırır (ücretsiz) | hayır |
| `CF_ACCOUNT_ID`+`CF_API_TOKEN`, `TOGETHER_KEY`, `HF_TOKEN` | AI görsel üretimi (hiçbiri yoksa Pollinations) | hayır |
| `AZURE_SPEECH_KEY`+`AZURE_SPEECH_REGION` | resmî Azure Speech sesi (Edge sesi başarısız olursa yedek) | hayır |
| `PIPER_YOL`+`PIPER_MODEL` | yerel, internetsiz ses (Piper) | hayır |
| `VOXCPM_KOK` (isteğe bağlı `VOXCPM_PYTHON`) | yerel VoxCPM2 sesi: `sesler/voxcpm2/` içindeki 14 hazır yapay ses (7 Türkçe + İngilizce, Almanca, İspanyolca, Fransızca, Japonca, Rusça, Çince anlatıcı). NVIDIA ekran kartı (≥4 GB) ister; kurulum ve lisans: [`sesler/voxcpm2/README.md`](sesler/voxcpm2/README.md) | hayır |

**Edge sesli okuma hakkında:** varsayılan ses motoru Microsoft Edge tarayıcısının sesli okuma servisidir. Anahtar istemez ve ücretsizdir ama **resmî, sözleşmeli bir API değildir**: servis değişirse çalışmayabilir ve ticari kullanım hakkı belirsizdir. Gelir getiren kanal için resmî Azure Speech'i tanımla; `otomatik` motor modunda Edge hata verirse iş yedek motorla **baştan** seslendirilir.

Senaryo motoru seçimi (`panel-ayar.json › senaryoMotoru`): `otomatik` (Claude anahtarı varsa o; Claude servis hatası verirse vidIQ'ya **yalnız anlatım dili İngilizce ya da boş olan işlerde** düşülür, çünkü vidIQ dil parametresi almaz: Türkçe işte yanlış dilde senaryo çıkmasın diye hata olduğu gibi gösterilir), `claude`, `vidiq`.

**Ses motoru ayrıntıları.** Konuşma hızı **otomatik ayarlanmaz**: `sesHizi` (varsayılan `+7%`) sabittir; 113/151 kelime/dk değerleri yalnızca *süre tahmini* içindir, gerçek süre seslendirme sonrası ölçülür. `PIPER_YOL` bir `.exe`, `.cmd/.bat` ya da `.js` olabilir; panel yalnız var olan, tam yollu ve adında `piper` geçen bir dosyayı kabul eder (anlatım metni programın girdisine verildiği için `cmd.exe` gibi bir programa yönlendirilemez). `node seslendir.js --test ornek.mp3 --ses tr-TR-AhmetNeural` 5 saniyelik örnek üretir; `--motor edge|azure|piper` motoru zorlar, `--yeniden` güncel sesi bile baştan üretir. `video-seslendir.js` yalnızca **kendi ya da izinli** videolara anlatım bindirmek içindir.

### Gelişmiş ayarlar (isteğe bağlı)

Aşağıdakiler `.env` dosyasına (ya da ortam değişkeni olarak) yazılabilir:

| Değişken | Etkisi |
|---|---|
| `VIDEO_KODEK=cpu` | GPU kodlayıcıyı hiç deneme, x264 kullan (sürücü sorunlarında) |
| `RENDER_ONCELIK=normal` | Render sürecini normal öncelikle çalıştır (varsayılan: bilgisayar kasmasın diye düşük öncelik) |
| `RENDER_DUSUK_BELLEK=1` | Render'ı baştan düşük bellek moduyla kur: klipler tek tek, az iş parçacığı, kısa x264 ön-bakışı; daha yavaş, ama çözünürlük, kare hızı ve kalite aynı. `2` = en az bellek, `0` = kendiliğinden açmayı kapat. Boş bırakılırsa boş bellek 3 GB'ın altındayken kendiliğinden açılır; bellek hatasında adım bu modla bir kez yeniden denenir |
| `FFMPEG_YOLU`, `FFPROBE_YOLU` | ffmpeg/ffprobe'un tam yolu (otomatik bulunamazsa) |
| `GORSEL_LIMIT_BEKLE_SN=3600` | Pexels/Pixabay istek sınırına (429) takılınca kaynağı kapatmak yerine en çok bu kadar saniye bekle. Panel kuyruğu ve `toplu-uret*.cjs` gece çalışırken bunu kendiliğinden kullanır |
| `GORSEL_YEREL_AG_IZIN=1` | Görsel/API adresi "yerel ağ adresine çözülen ad" diye reddediliyorsa (kurumsal DNS, bazı VPN'ler) ad çözümleme denetimini kapatır. Clash/Surge gibi proxy "fake-ip" modu zaten sorun çıkarmaz; doğrudan IP olarak yazılan yerel adresler (127.0.0.1, 192.168.x.x…) yine reddedilir |
| `MALIYET_UST_SINIR_USD` | Tek iş için tahmini ücretli çağrı üst sınırı (aşılacaksa betik başlamadan çıkış kodu 7 verir) |
| `TOPLU_BOSTA_OLDUR_SN=2700`, `TOPLU_VIDEO_BOSTA_OLDUR_SN=5400` | `toplu-uret*.cjs` gece çalışırken bir alt süreç (seslendirme/görsel; video) bu kadar saniye hiç çıktı vermezse takılmış sayılıp öldürülür, o iş `HATA-<aşama>` olur ve seri sonrakiyle sürer |

**Portlar yalnızca ortam değişkeni olarak okunur; `.env` okunmaz** (yazarsan sessizce yok sayılır). Panel açılmadan önce aynı pencerede ver, örneğin `set AIINFAPP_PORT=4210` ve ardından `PANEL.bat`:

| Ortam değişkeni | Etkisi |
|---|---|
| `PANEL_PORT` | panel portu (varsayılan `4173`; adres her zaman `127.0.0.1` — ağa açma seçeneği yoktur) |
| `AIINFAPP_PORT` | Ai Infapp portu (varsayılan `4200`). Panel ve `ai-infapp\BASLAT.bat` / `baslat.sh` aynı değeri okur; ikisini ayrı portlara verme |

(`RENDER_OLCEK`, `OTOMASYON_URETIM`, `OTOMASYON_ENV_DOSYASI`, `OTOMASYON_AYAR_DOSYASI` ve `PANEL_*_KAPALI` değişkenleri yalnızca testler içindir; elle kullanma.)

**Yazı tipleri.** Videodaki yazılar için Windows'ta `C:\Windows\Fonts`, Mac'te sistem yazı tipleri, Linux'ta DejaVu/Liberation kullanılır. Bunlar yoksa ya da başka bir font istiyorsan proje klasörüne `fonts/` açıp `kalin.ttf`, `normal.ttf`, `impact.ttf`, `mono.ttf`, `mono-kalin.ttf`, `sembol.ttf` (Türkçe karakterli) koy; önce onlara bakılır. En az `kalin` ve `normal` bulunmalıdır; diğerleri yoksa bunlara düşülür. Hiç font bulunamazsa video kurulumu `✗ Yazı tipi bulunamadı` ile çıkış kodu 2 verir.

## Çalıştırma

`PANEL.bat` ya da `node panel.js` → `http://localhost:4173` (port: `PANEL_PORT`). `PANEL.bat` panel beklenmedik kapanırsa 3 sn sonra kendiliğinden yeniden başlatır; ama panel açılır açılmaz (60 sn içinde) **art arda 5 kez** çökerse yeniden denemeyi bırakır ve `uretim\_log\panel-*.log` dosyasına bakmanı söyler. Panel zaten açıksa (`PANEL.bat`'a ikinci kez tıklandı) ikinci örnek hiçbir şeye dokunmadan kapanır.

**Güvenlik modeli.** Panel yalnızca `127.0.0.1`'e bağlanır (dışarıdan erişilemez). Her istek `Host`/`Origin`/`Content-Type` denetiminden geçer; her `/api` çağrısı panel açılırken üretilen rastgele oturum jetonunu ister (başka bir web sitesi paneli yönetemez). İş adları katı beyaz listedendir, dosya yolları `uretim/` dışına çıkamaz, API anahtarları ekranda maskelenir, hata yanıtlarında yığın izi çıkmaz. Paneli ağa açmak (başka bilgisayardan kullanmak) **desteklenmez**: sayfa jetonu HTML'e gömülü verir, yani ağdan erişen herkes jetonu alıp `.env` anahtarlarını yazabilir ve ücretli iş başlatabilirdi; bu yüzden `PANEL_HOST`/`PANEL_IZINLI_HOST` seçenekleri kaldırıldı. Başka bilgisayardan erişmen gerekirse paneli o bilgisayarda aç (uzak masaüstü ya da SSH tüneli). Sayfaya satır içi betik çalıştırılamaz (CSP `script-src` yalnız kendi dosyaları + tek bir özetlenmiş sarmalayıcı; `unsafe-inline` yok), `Sec-Fetch-Site` başka siteden gelen `/api` ve medya isteklerini reddeder. Paketler `--ignore-scripts` ile kurulur (bağımlılıkların kurulum betikleri çalışmaz). Sınır: aynı bilgisayardaki başka bir *program* `/` sayfasını isteyip jetonu okuyabilir — koruma tarayıcı tabanlı saldırılara (başka site, DNS rebinding) karşıdır; bilgisayara zararlı program girdiyse panel koruyamaz.

Panelle birlikte gelen **Ai Infapp** ve **video indirici** de kendi sunucularıdır ve yalnızca `127.0.0.1`'e bağlanır. İkisi de `Host` ve (yazma isteklerinde) `Origin` / `Sec-Fetch-Site` / `Content-Type: application/json` denetimi yapar; yani tarayıcıda açık başka bir web sitesi bunlara yazamaz. Fark: video indirici panel gibi oturum jetonu da ister; **Ai Infapp'te jeton yoktur**. Aynı bilgisayarda çalışan başka bir *program* Ai Infapp'e doğrudan istek atabilir (koruma yine tarayıcı tabanlı saldırılara karşıdır). Panel, Ai Infapp'in portunda başka bir program ya da proje dışındaki eski bir Ai Infapp kopyası çalışıyorsa onu açmaz ve nedenini söyler.

**Akış.**

1. **Yeni video:** konu/başlık, biçim, süre, dil, ses, tür/ton, kaynak metni, kişisel katkı, açılış stili. Anahtar/disk/maliyet **ön kontrolü başarısızsa iş hiç açılmaz** (altyazı dilini anlatım dilinden farklı seçtiysen altyazı çevirisi için de Claude anahtarı aranır; çeviri dosyası zaten güncelse aranmaz).
2. **ÜRET:** zincir senaryo → görsel → seslendirme → video (+ kapak ve yayın paketi) sırasıyla koşar. Senaryo bu koşuda yazıldıysa **onay bekler**: oku, düzenle, **Onayla**. İstersen görseller için de onay açabilirsin (sahne tablosu, sahne başına "yeniden ara").
3. Her adım ilerleme yüzdesi, günlük satırları ve kalıcı durumla izlenir (`uretim/<is>/durum.json`, `_log/`). Sayfayı yenilesen de çalışan işe geri bağlanırsın; Durdur çalışır, takılan iş (15 dk çıktı yok) uyarılır, 45 dk sonra sonlandırılır.
4. Aynı iş için tek koşu (ikincisi reddedilir); aynı anda en çok 2 zincir, ağır video işlemleri tek tek sıraya girer.
5. Kuyruk: konu listesi yapıştır, sıraya al. Panel yeniden açılınca kuyruk **duraklatılmış** gelir (beklenmedik kredi harcaması olmasın); **Devam**'a basarsın.

## Panelsiz kullanım

```bash
node yeni-is.js <is-adi> --baslik "Başlık" --dil tr --format short   # iş açar (panelle aynı çekirdek)
node senaryo-claude.js <is-adi>      # ya da: node senaryo-yaz.js <is-adi>   (vidIQ)
node gorsel-bul.js     <is-adi>      # (+ --yeniden | --sahne 3 --ara "ifade" | --limit-bekle 3600 | --uretme | --arsiv-temizle)
node seslendir.js      <is-adi>      # (+ --yeniden | --motor azure | --test ornek.mp3)
node video-yap.js      <is-adi>      # (+ --yeniden --temiz --tut --onizleme=25)
node kapak-yap.js      <is-adi>      # kapak resmi (video-yap sonunda kendisi de dener)
node yayin-paketi.js   <is-adi>      # açıklama, bölümler, atıflar (video-yap sonunda kendisi de dener)
```

`video-yap.js` iş adı **zorunludur** (eski sürümlerdeki varsayılan iş adı kalktı). Hedef süreye ulaşamayan bir senaryo `Voice/SESLENDIRME-TAM-METIN-yarim.txt` olarak saklanır ve çıkış kodu 4 verilir; panelde Senaryo sekmesinden editöre alınıp düzenlenebilir.

İşler `uretim/<is-adi>/` altındadır. Ayarlar `konu.json`'dadır; **alanların tam listesi: [KONU-JSON.md](KONU-JSON.md)**.

**Çıkış kodları (tüm betikler):** `0` başarı/atlandı · `1` genel hata · `2` girdi/yapılandırma (konu.json bozuk, anahtar yok…) · `3` dış servis (ağ, anahtar, kredi) · `4` yetersiz sonuç (görsel az, paragraf düştü…) · `5` disk/kaynak · `6` aynı iş zaten çalışıyor · `7` maliyet sınırı. Hata mesajı stderr'e `✗ …` olarak, çözüm önerisi `↳ …` satırıyla yazılır.

## Araçlar

| Betik | Ne yapar |
|---|---|
| `PANEL.bat` / `panel.js` | kontrol paneli (bu belgenin kurulum ve akış bölümleri) |
| `yeni-is.js` | panelsiz iş açar |
| `senaryo-claude.js`, `senaryo-yaz.js` | senaryo (Claude / vidIQ); bölüm bölüm, iddia raporu (`IDDIA-RAPORU.md`), görsel arama ifadeleri. `senaryo-claude.js` bayrakları: `--yedek` (Claude servis hatası verirse vidIQ ile dene), `--iddia-yok` (ikinci geçişi atla, ucuzlar), `--anahtar-test` (token harcamayan anahtar testi), `--model X` |
| `gorsel-bul.js` | senaryodan görsel bulur; manifest + lisans + atıf; artımlı (silinen görsel geri gelmez). `--yeniden`, `--sahne N --ara "ifade"` (yeni arama sonuç vermezse eski görseller geri konur), `--limit-bekle sn`, `--uretme` (AI yedeğini kapat), `--arsiv-temizle` (`Visuals/_eski-…` arşivleri hiçbir zaman kendiliğinden silinmez; bu bayrak yalnızca en yeni 2 arşivi bırakır) |
| `gorsel-cek.js`, `portre-cek.js` | NASA görselleri, kişi portreleri (kamu malı/CC kaynaklar) |
| `gorsel-uret.js` | AI görsel üretimi (soyut sahneler için) |
| `formul-kart.js`, `prompt-kart.js` | `konu.json`'da elle tanımlanan formül/prompt kartları (`hedef` = sahne klasörü; verilmezse en yakın sahneye eklenir) |
| `seslendir.js` | seslendirme + kelime zamanları (`zamanlama.json`); `--test` ile 5 sn örnek |
| `video-seslendir.js` | **kendi/izinli** bir videoya anlatım + altyazı bindirir |
| `video-yap.js` | kurgu ve render; `.part` + imzalı önbellek |
| `kapak-yap.js`, `yayin-paketi.js` | kapak resmi, açıklama/bölümler/atıflar/uyum notu |
| `baslik-analiz.js` | başlık puanı + alternatifler + etiketler (`--on`: senaryodan önce; `--yeniden`) |
| `altyazi-cevir.js` | altyazı dili farklıysa paragraf paragraf çeviri (`--yeniden`) |
| `trend-ara.js`, `viral-analiz.js` | YouTube/Instagram/TikTok trend ve viral raporları (`trend/`, `viral-analiz/`). `--platform yt\|ig\|tt`, `--siki` |
| `performans.js` | yayınlanan videoların izlenme verisi (`performans.json`); `--is <ad>` ya da `--hepsi` |
| `vs-kur.js`, `vs-gorsel-duzelt.js`, `vs-yap.js` | karşılaştırma (VS) Shorts'u (`vs-kur.js --yeniden`, `vs-gorsel-duzelt.js --taraf ust\|alt`) |
| `marka-yap.js` | kanal profil resmi + banner |
| `kesit-bul.cjs`, `shorts-kes.cjs` | uzun videodan Shorts kesitleri (`--otomatik`) |
| `geri-sayim.js` | film lideri geri sayımı |
| `toplu-uret.cjs`, `toplu-uret-uzun.cjs` | manifestten toplu Shorts / uzun video (aşağıda) |
| `ff-yol.js` | ffmpeg/ffprobe yolunu bulur (`node ff-yol.js`) |
| `video-indirici/` | **ayrı** mini panel (aşağıda); panel onu kendiliğinden başlatmaz. **Kanonik kopya bu klasördür**; bu depo dışında duran eski bir `video-indirici` klasörü varsa onu kullanma |
| `ai-infapp/` | **ayrı** mini panel (aşağıda): AI influencer karakteri, fotoroman, Etsy baskı tasarımı, reklam görseli. Panelden **Ai Infapp** düğmesiyle ya da `ai-infapp\BASLAT.bat` ile açılır; panel onu kendiliğinden başlatmaz. **Kanonik kopya bu klasördür**; bu depo dışında duran eski bir Ai Infapp klasörü eski bir nüshadır, kullanma |

## Toplu üretim

```bash
node toplu-uret.cjs        senaryolar.json     # Shorts
node toplu-uret-uzun.cjs   senaryolar.json     # uzun video
```

Manifest bir iş dizisidir ya da `{ "kanal": "AD", "varsayilan": { "dil": "tr" }, "isler": [ … ] }`. Öğe: `{ "slug": "021-ornek", "baslik_en": "…", "paragraflar": ["…", "…"] }` (+ isteğe bağlı `kanal`, `ses`, `sesHizi`, `dil`, `hedefSaniye`, `format`). Betik **var olan `konu.json`'ı ve dolu senaryoyu ezmez**, bitmiş videoyu atlar ("bitti" = mp4 var + `.part` yok + süresi okunabiliyor), hata olursa çıkış kodu 1 verir ve tam günlüğü `uretim/_toplu-<tarih>.log` dosyasına yazar. Panelden yapmak için **kuyruk** kullan.

## Görseller sahneyle nasıl eşlenir

`gorsel-bul.js` senaryoyu **sahnelere** böler (her paragraf tam bir sahnede), her sahne için `Visuals/NNN-kelime/` klasörü açar ve `Visuals/manifest.json` yazar (hangi görsel hangi paragrafa, kaynak, lisans, atıf). Video kurulurken her sahnenin süresi **o paragrafların gerçek ses aralığı**dır: anlatıcı Einstein'dan söz ederken Einstein'ın fotoğrafı akar. Aramalar şu sırayla seçilir: `--sahne N --ara` (elle düzeltme) > `konu.json › sahneKelimeleri` (elle; `"uret: …"` = AI görseli ister) > `Voice/ARAMALAR.txt` (her paragraf için bir satır İngilizce, somut arama; ajan senaryoyla birlikte yazar, `|` ile yedek arama) > senaryo motorunun yazdığı `Voice/gorsel-aramalari.json` > otomatik çıkarım (dolgu kelimeler — "aynı", "hep", "neden" gibi — arama terimi seçilmez). Başlığı/açıklaması aramayla hiç eşleşmeyen görseller elenir; sahne boş kalmasın diye yine alınırsa manifestte `"alakaZayif": true` olarak işaretlenir ve uyarıda listelenir.

- **Kendi görselini eklemek** için dosyayı sahnenin klasörüne at (`Visuals/003-einstein/`); manifestte olmasa da videoya girer (sahnenin başına konur).
- **Formül/prompt kartları** `hedef` verilirse o sahne klasörüne, verilmezse `Visuals/14-formuller` / `Visuals/90-promptlar` klasörüne yazılır; sonuncular sahne numarası gibi okunup en yakın sahneye eklenir (video kurulumu uyarır).
- `konu.json › portreler: [{"n":"03-einstein", "q":["Albert Einstein"], "adet":3}]` kişi portrelerini (`portre-cek.js`), `sahneler: [{"n":"01-hook", "q":["spiral galaxy"]}]` NASA sahnelerini (`gorsel-cek.js`; tanımsızsa uzay temalı 8 sahnelik varsayılan set kullanılır ve uyarılır) belirler. `uretAdet` (varsayılan 2) sahne başına AI görsel sayısıdır.
- Panelde **Sahneler** sekmesi: görseli büyüt, sil (bir daha gelmez), sahne için yeni arama ifadesiyle yeniden ara. Görsel silince `ATIF.txt` de güncellenir.
- Manifest yoksa (eski işler) ya da paragraf bölümlemesi senaryoyla uyuşmuyorsa video kurulumu uyarır ve klasör sırasıyla, eşit sürelerle devam eder.

## Karşılaştırma Shorts'u (VS)

Ekran ortadan ikiye bölünür, iki konu yarışır, altta animasyonlu ölçü barları çalışır. Panelde **VS** formundan tanımlanır (iki ad, ölçü satırları); kod düzenlemek gerekmez. Tanım `uretim/<id>/vs-tanim.json` olarak yazılır:

```bash
node vs-kur.js <id>                   # tanımı okur, görselleri indirir (eşleşme zorunlu, kelime sınırlı süzgeç); --yeniden: baştan
node vs-gorsel-duzelt.js <id>         # beğenmediğin görseli yenile; --taraf ust|alt yalnız o tarafı
node vs-yap.js <id>                   # 9:16 VS videosunu render eder
```

Görseller Pexels/Pixabay/Wikimedia/Openverse'ten gelir (tür filtresi + taraf başına **zorunlu kelime** + kadraj puanıyla seçilir; yanlış hayvan/nesne çıkmasın diye). Her taraf `{ad, renk, ara, zorunlu?, sorgular?, yasak?}` taşır: `zorunlu` fotoğrafın başlık/etiketinde geçmesi gereken kelimeler, `sorgular` yedek aramalar, `yasak` elenecek kelimeler. Her ölçüde `ustDeger`/`altDeger` sayısal (bar uzunluğu bundan), `ustMetin`/`altMetin` ekranda görünen metin, `kazanan` o turu kimin aldığıdır. Ekranda yazan her sayı bir iddiadır — kendin doğrula.

## Kanal markası

```bash
node marka-yap.js "KANAL ADI" "SLOGAN" [cikis-klasoru]     # + --rozet VS --alt-metin "…" --dil tr
```

Profil resmi (1024×1024) ve banner (2560×1440; yazılar güvenli alanın içinde, uzun ad otomatik küçülür; PNG 5.5 MB'ı aşarsa JPG) üretir. Varsayılan kanal adı/slogan/rozet **Kanal ayarları**ndan (`panel-ayar.json`) gelir; rozet boşsa profil resmine kanal adının baş harfleri yazılır. Çıktılar yarım kalmaz (`.part` + yeniden adlandırma) ve önceki koşudan kalan aynı adlı PNG/JPG karşılığı silinir.

## Trend, başlık ve performans

```bash
node trend-ara.js "animal comparison" --dil tr --platform yt     # yt | ig | tt (yoksa üçü)
node viral-analiz.js "" tr 1000000
node baslik-analiz.js <is-adi> --on                              # senaryodan ÖNCE başlık puanı
node performans.js --is <is-adi>
```

Raporlar `trend/` ve `viral-analiz/` altına `.md` + `.json` yazılır; panelde okunur ve **"Bu konuda video yap"** ile doğrudan yeni işe dönüşür. Raporlardaki hükümler veriye bağlıdır. Trend ve viral analiz araçları yalnızca **rapor** üretir, video indirmez (indirme ayrı araçtır: aşağıdaki Video İndirici, yalnız kendi veya izinli içerik için). Başkasının videosunu izinsiz yeniden yüklemek telif ihlalidir; raporlar kalıbı görmek ve o kalıpla kendi videonu yapmak içindir.

## Video İndirici

Ayrı bir mini panel: link yapıştır → indir (`video-indirici/`, `http://localhost:4190`). Panelde **Araçlar → Video indirici** düğmesiyle başlatılır; panel onu kendiliğinden açmaz. **Yalnızca kendi veya indirme izni olan içerik için kullan.** Ayrıntı: [video-indirici/README.md](video-indirici/README.md).

## Ai Infapp

Ayrı bir yerel web paneli (`ai-infapp/`, `http://localhost:4200`): sıfırdan **bir karakter** yaratır (yüz, şehir, aile, rutin), kilitler, yüzünün 8 açılı vesikalığını çıkarır ve ondan sonra istediğin her sahnede **aynı kişiyi** üretecek istemi hazırlar. Dört stüdyosu var: **AI Influencer**, **Fotoroman**, **Etsy POD** (baskıya hazır tasarım, listeleme metni, pazar araştırması) ve **Reklam / grafik**. Video üretim hattından bağımsızdır. **Masaüstü uygulaması değildir**: bilgisayarında çalışan, tarayıcıda açılan yerel bir paneldir.

- **Nasıl açılır.** Panelde **Araçlar → Ai Infapp** düğmesi sunucuyu başlatır ve ayrı pencerede açar; panel onu kendiliğinden açmaz. Elle: `ai-infapp\BASLAT.bat` (macOS / Linux: `bash ai-infapp/baslat.sh`). Port `4200`; değiştirmek için `AIINFAPP_PORT` ortam değişkeni (`.env` değil; panel ve başlatıcılar aynı değeri okur).
- **Gereksinim.** Node.js en az 22 (kök kural; ayrı paket kurulumu yok, sıfır bağımlılık). PNG / PDF çıktısı için Chrome ya da Edge gerekir; yoksa yalnızca SVG indirilir.
- **Veri.** Karakter, ayarlar, API anahtarları ve üretilen görseller `ai-infapp/data/` içinde durur ve depoya girmez (`.gitignore`). Bitmiş çıktılar ayrıca varsayılan olarak `Masaüstü\Ai Infapp\` klasörüne konur (Ai Infapp'in ayarlarından kapatılır ya da değiştirilir).
- **Görsel nereden gelir.** Ai Infapp kendisi fotoğraf üretmez ve stok görsel içermez: kareleri **senin bağladığın** görsel üretim API'sinden alır. Varsayılan ücretsiz ve anahtarsız Pollinations'tır (fotoğraf gerçekçiliği vermez); Replicate, fal.ai, OpenAI, yerel Stable Diffusion / ComfyUI gibi seçenekler Ayarlar'dan bağlanır, anahtarı sen alırsın. Tasarım tarafı (Etsy, Reklam, Fotoroman sayfa düzeni) vektörü yerelde çizer, ücretli servis gerektirmez.
- **Sorumluluk.** Sihirbaz 18 yaşından küçük karakter kabul etmez; gerçek kişi taklidi yok. Platformların yapay zekâ etiketi kurallarını yayın öncesi kendin doğrula.

Ayrıntı: [ai-infapp/README.md](ai-infapp/README.md). Hazır sahne kayıtları MIT lisanslı bir kütüphaneden türetilmiştir; atıf ve lisans metni [ai-infapp/THIRD_PARTY_LICENSES.md](ai-infapp/THIRD_PARTY_LICENSES.md) içindedir.

## Yayın öncesi uyum notları

- Gerçekçi yapay görsel/ses kullandıysan YouTube Studio'da **"değiştirilmiş/sentetik içerik" kutusunu işaretle** (yayın paketi bunu hatırlatır).
- CC BY / CC BY-SA / Pexels görsellerinin atıfını açıklamaya yapıştır (`ATIF.txt` / yayın paketi hazırlar).
- Tüm videoların aynı görünmesi ve tamamen otomatik üretim, YouTube'un tekrarlayan/özgün olmayan içerik kurallarına takılabilir: kendi kişisel katkını (`kisiselKatki`) ekle, kaynak metni ver, çeşitlilik ayarını açık tut. Güncel kuralları YouTube Yardım'dan kontrol et.

## Testler

```bash
npm test      # panel + betikler + video-indirici + ai-infapp (node --test); ağ çağrıları sahtelenir, gerçek .env ve ücretli servislere dokunulmaz
npm run test:panel        # yalnız panel/betik testleri (Ai Infapp'in panel bağlantısı dahil)
npm run test:indirici     # yalnız video-indirici testleri
npm run test:aiinfapp   # yalnız ai-infapp testleri
```

ffmpeg kurulu değilse ffmpeg gerektiren testler atlanır (yt-dlp yoksa gerçek-yt-dlp testi de atlanır). Değişiklik geçmişi: [CHANGELOG.md](CHANGELOG.md).

## Lisans

MIT, bkz. [LICENSE](LICENSE). İstediğin gibi kullan. Üçüncü taraf kaynak: `ai-infapp/` içindeki 1.264 hazır sahne kaydı, MIT lisanslı [ai-image-prompts-skill](https://github.com/YouMind-OpenLab/ai-image-prompts-skill) (YouMind-OpenLab) projesinden türetilmiştir; lisans metni ve değişiklik notu `ai-infapp/THIRD_PARTY_LICENSES.md` içindedir.
