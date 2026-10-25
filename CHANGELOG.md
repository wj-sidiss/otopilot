# Değişiklik geçmişi

Biçim: [Keep a Changelog](https://keepachangelog.com/tr/1.1.0/). Sürümler [SemVer](https://semver.org/lang/tr/).

## [1.4.0] — 2026-10-25 — Müze ve fotoğraf kaynakları

### Eklenenler
- **Müze kaynakları (sanat/tarih sahneleri):** The Met, Art Institute of Chicago, Cleveland Müzesi (anahtarsız) ve Smithsonian (`SMITHSONIAN_KEY`, ücretsiz). Yalnızca CC0 / kamu malı eserler alınır; lisans istemcide ikinci kez denetlenir. Sanat, tarih ve antik dönem sahnelerinde otomatik devreye girer (`sanatSahneMi`), diğer sahnelerde sorgulanmaz.
- **Unsplash** (`UNSPLASH_KEY`, ücretsiz): fotoğrafçı atfı açıklamaya eklenir.
- Panelde Kaynaklar ve Kanal ayarlarından açılıp kapatılır.

## [1.3.0] — 2026-10-25 — Doğal sesler, isabetli görsel, zayıf bilgisayar

### Eklenenler
- **14 hazır yapay ses (VoxCPM2, yerel).** `sesler/voxcpm2/`: 7 Türkçe ses (`tok_anlatici`, `belgesel_hanim`, `cekici_spiker`, `gizemli_bilge`, `haber_spikeri`, `masal_cadisi`, `yasli_bilge`) ve 7 yerli anlatıcı (`anlatici_en/de/es/fr/ja/ru/zh`). Kaynak: [alexturkey/voxcpm2-turkce-ses-tasarimi](https://github.com/alexturkey/voxcpm2-turkce-ses-tasarimi) (Apache-2.0; dosyalar değiştirilmeden kopyalandı, `LICENSE` ve `NOTICE` yanında). Sesler metin tarifinden tasarlanmış yapay seslerdir, gerçek kişi değildir.
- **Yeni ses motoru `voxcpm`** (`lib/ses-motor-voxcpm.js`): kullanıcının bilgisayarında kurulu VoxCPM2'yi çağırır (`VOXCPM_KOK`). `--ses voxcpm:<ad>`, `--motor voxcpm` (dile göre varsayılan ses) ya da `konu.json › "ses": "voxcpm:<ad>"`. Rakamlar yazıya çevrilir (Türkçe ve İngilizce), cümle zamanlarından altyazı oturur, aynı anda tek GPU işi çalışır. Kurulu değilken açık istekte çıkış 2 ve kurulum adımları; `otomatik` motorda Edge'e düşülür. `node seslendir.js --liste-sesler` sesleri ve kurulum durumunu gösterir. Panelin ses testi `voxcpm:` seslerini kabul eder.
- **`Voice/ARAMALAR.txt`:** ajan her paragraf için İngilizce, somut görsel araması yazar; `gorsel-bul.js` bunları kullanır (`|` ile yedek arama). Manifestte `aramaKaynagi` alanı.
- **`npm run guncelle`** (`lib/guncelle.js`): tek komutla güvenli güncelleme (`git pull --ff-only`; yerel değişiklik varsa durur, hiçbir şey silmez; paket listesi değiştiyse `npm ci`). ZIP ile indirilmiş kopyada yönerge verir.
- **GitHub şablonları:** iki dilli hata bildirimi ve özellik isteği formu, PR kontrol listesi; boş issue kapalı. "Bu bir video sipariş servisi değil" açıklaması README'nin başında.
- `RENDER_DUSUK_BELLEK` (`.env`): render'ı baştan düşük bellek moduyla kurar.

### Düzeltilenler
- **Görsel arama isabeti.** Türkçe dolgu kelimeler ("aynı", "hep", "neden"…) artık sahne terimi ya da konu çapası seçilmiyor; Türkçe terimler küçük bir sözlükle İngilizceye çevriliyor; başlığı/açıklaması aramayla hiç eşleşmeyen görseller eleniyor (sahne boş kalmasın diye alınanlar `alakaZayif` ile işaretlenip uyarılıyor). Örnek: "Ay neden hep aynı yüzünü gösterir?" Shorts'unda Ay yerine adam portresi, nehir ve Dünya Kupası bileti geliyordu.
- **Düşük bellekte render çökmesi.** ffmpeg/x264 bellek hatasında ("Cannot allocate memory", "malloc failed") adım düşük bellek profiliyle (az iş parçacığı, kısa ön-bakış, tek tek klip) kendiliğinden bir kez yeniden deneniyor; boş bellek 3 GB'ın altındaysa baştan bu profille başlanıyor. Çözünürlük, kare hızı ve kalite değişmez. İkinci denemede de düşerse çıkış 5 (`bellek_yetersiz`) ve çözüm.

## [1.2.0] — 2026-10-15 — Ai Infapp birleştirildi

Ayrı bir proje olan **Ai Infapp** (AI influencer, fotoroman, Etsy baskı tasarımı ve reklam stüdyosu; sıfır bağımlılıklı Node sunucusu) `ai-infapp/` klasörü olarak bu depoya alındı: tek depo, tek ürün. `video-indirici/` ile aynı kalıptır: kendi sunucusu olan bir alt klasör, panelden düğmeyle başlar. Masaüstü uygulaması yoktur; her şey yerelde, `127.0.0.1` üzerinde çalışan web paneli olarak kalır. Yeni npm bağımlılığı eklenmedi.

### Eklenenler
- **Panelden Ai Infapp.** **Araçlar** görünümünde Ai Infapp bölümü ve düğmesi (üst menü yalnız sekmeleri taşır, sade kalır); sunucuyu başlatıp ayrı pencerede açar (`ai-infapp/server.js` bulunamazsa düğme gizlenir). Yeni uçlar: `POST /api/aiinfapp/baslat` ve `GET /api/ozellikler > aiinfapp {var, calisiyor, port}`. Port `AIINFAPP_PORT` (varsayılan `4200`). Başlatma testlerde `PANEL_AIINFAPP_KAPALI=1` ile kapatılır.
- **Portta kim dinliyor?** Ai Infapp sunucusu her yanıtta `X-Ai-Infapp: ai-infapp/<sürüm>` başlığı koyar; panel bunu okur. Başlık varsa "yeni" kabul edilir. Başlık yok ama sayfada «Ai Infapp» yazıyorsa bu proje dışındaki eski, güvenlik denetimi olmayan kopyadır (bu depo dışında duran eski bir Ai Infapp klasörü): panel onu **açmaz**, 409 ve nedeniyle birlikte çözüm söyler. Portu başka bir program tutuyorsa yine 409. Sunucu açılmadan kapanırsa (port dolu, aynı `data/` klasöründe başka örnek açık) 8 saniye beklenmez; çıkış kodu ve ne yapılacağı hemen gösterilir.
- `lib/panel-aiinfapp.js` (teşhis ve başlatma); `portAcikMi` ortak kullanım için `lib/panel-http.js`'e taşındı.
- `ai-infapp/` için `AI_INFAPP_PORT` (başlatıcılar `AIINFAPP_PORT`'u da okur) ve `AI_INFAPP_VERI` (veri klasörünü değiştirir; testler gerçek `data/` klasörüne dokunmasın diye). `BASLAT.bat` / `baslat.sh` sunucunun kullandığı portu açar: genel bir `PORT` ortam değişkeni artık tarayıcıyı yanlış adrese götürmez.
- `npm run test:aiinfapp`; `npm test` artık `ai-infapp/test/` testlerini de koşar (CI aynı komutu kullanır). Panel bağlantısı için `test/ai-infapp-entegrasyon.test.js`: teşhis (yeni / eski / başka program / yanıt vermeyen), 404 / 409 / 500 yolları, yetkisiz çağrının reddi, gerçek başlatma (sahte sunucu dosyasıyla ve gerçek `ai-infapp/server.js` ile, geçici veri klasöründe).

### Güvenlik
- `POST /api/aiinfapp/baslat` panelin diğer yazma uçlarıyla aynı kapıdan geçer (oturum jetonu, `Host`, `Origin`, `Sec-Fetch-Site`, `Content-Type`); yeni bir muafiyet açılmadı. Reddedilen çağrı hiçbir süreç başlatmaz, `GET` ile başlatılamaz.
- Panel Ai Infapp'i başlatırken adında `KEY`, `TOKEN`, `SECRET`, `PASS`, `PWD`, `CREDENTIAL`, `COOKIE`, `AUTH`, `PRIVATE` geçen ya da `DATABASE_URL` / `*_DSN` / `GH_*` / `GITHUB_*` / `*_PAT` biçimindeki ortam değişkenlerini alt sürece **geçirmez** (Ai Infapp bunları kullanmaz, kendi anahtarları `data/` içindedir; sistem ortamındaki `OPENAI_API_KEY` gibi değerler kullanıcı adreslerine istek atan bu ayrı süreçte durmasın). Test: `test/ai-infapp-entegrasyon.test.js › altOrtam`.
- Pollinations isteğindeki `user-agent` artık eski proje adını değil `ai-infapp`'i bildirir.
- Ai Infapp yalnızca `127.0.0.1`'e bağlanır (panelden ağa açma seçeneği eklenmedi). Sunucusu `Host`, yazma isteklerinde `Origin` / `Sec-Fetch-Site` ve API yazmalarında `Content-Type: application/json` denetler. **Panelin oturum jetonu Ai Infapp'te yoktur:** aynı bilgisayardaki başka bir program ona doğrudan istek atabilir; koruma tarayıcı tabanlı saldırılara karşıdır. README'de bu sınır açıkça yazıldı.
- Kök `.gitignore` `ai-infapp/data/` (karakter, API anahtarları, görseller), `.instance` kilit dosyası ve günlükleri açıkça dışarıda tutar.

### Herkese açık yayına hazırlık
- **Depoda reklam/yönlendirme linki yok.** Ai Infapp'in karşılama ekranındaki üçüncü taraf (vidIQ) önerisi, referans linki ve README'deki tanıtım bölümü kaldırıldı; ekran artık yalnızca aracın ne yaptığını söyleyen, tek düğmeyle geçilen bir bilgi ekranı. (`app.vidiq.com/account/settings/mcp` gibi «anahtarı nereden alırım» yardım metinleri kalır: bunlar yönlendirme değil, kurulum bilgisidir.)
- `video-indirici/kesfet-veri.json` (vidIQ'dan alınmış 99 videoluk anlık görüntü) depodan çıkarıldı ve `.gitignore`'a alındı: üçüncü taraf verisi paylaşılmaz. Dosya yokken Keşfet listesi boş gelir; «vidIQ'dan tazele» (VIDIQ_KEY gerekir) onu yerelde oluşturur.
- Mesajlardan ve belgelerden yazara özel yerel klasör adları temizlendi; «bu depo dışındaki eski kopya» denir. Testlerdeki örnek yol adları nötrleştirildi.
- Kökte `LICENSE` (MIT) eklendi; README zaten MIT diyordu. `test/acik-depo.test.js` bu hijyeni korur: yönlendirme/referans linki, kişisel hesap ve e-posta, yerel klasör adı ve sır sızıntısı yeniden girerse test kırılır.

### Düzeltilenler (CI kırmızıydı)
- GitHub CI (`windows-latest`, Node 22 ve 24) bu turdan önceki commit'te **kırmızıydı** (722 testten Node 24'te 2, Node 22'de 3 kırmızı). Hepsi kapandı: `cumleBol` (kısaltmalarda — «Dr.», «U.S.», «e.g.» — cümleyi yanlış bölüyordu; baş harf denetimi küçültülmüş metinde yapıldığı için hiç eşleşmiyordu); `komutlar.zincirAdimlari` testi (vidIQ yedeği yalnız anlatım dili boş/İngilizce işte vardır, test bunu doğru beklemiyordu); `test/duman.test.js` **Node 22'de** `require('node:test')` gibi yalnız-önekli yerleşik modülleri tanımıyordu (`Module.builtinModules` Node 22'de bunları içermez; `Module.isBuiltin` kullanılır).

- Yüklü CI çalıştırıcısında ara sıra düşen iki test sağlamlaştırıldı (ürün kodu değişmedi): indirici «1 MB üstü gövde» testi, sunucu 413 verip bağlantıyı kapatırken istemcinin yanıtı okumadan `ECONNRESET` alabildiği yarışı yeniden dener; Ai Infapp `C-04 raster` testi yük altında takılan başsız Chrome'u bir kez daha dener. Güvenlik beklentileri (413, sahte sunucuya 0 istek) aynen durur.
- Ai Infapp başsız Chrome'u (PNG/PDF/glif ölçümü) artık sayfadaki içeriğin ağa çıkmasına hiç izin vermez: Chrome'a verilen HTML bir içerik politikası (CSP: `connect-src 'none'`, çizilen SVG'de betik yok, yalnız `data:`/`file:` görsel) taşır. Eskiden bunu yalnızca ölü bir vekil (`127.0.0.1:9`) sağlıyordu; çalıştırıcıda o vekil bazen cevapsız kalıp sayfa yükünü 120 sn bekletiyor, Node 22/24 işlerinden biri rastgele düşüyordu. Artık ağ istediği başlamadığı için bekleme olmaz. Vekil bayrakları ek katman olarak durur. Politika Chrome çalıştırılmadan test edilir.

### Eğitim PDF'leri (16 Eki)
- `egitim/` içinde dört eğitim PDF'i (YouTube içerik üretimi seri 1, Instagram büyüme yol haritası, TikTok algoritması rehberi ve büyüme haritası, TikTok AI influencer rehberi). `lib/egitim.js` bunları masaüstündeki **Otopilot Eğitim** klasörüne kopyalar: panel terminalde açılınca bir kez kendiliğinden, ya da `npm run egitim` ile elle. Var olan dosyanın üstüne yazmaz, masaüstü yoksa sessizce atlar; test, CI ve arka plan çalışmalarında masaüstüne dokunmaz.

### Ajan kullanımı ve son kontroller (16 Eki)
- **`AGENTS.md` + `CLAUDE.md`.** Depoyu Claude Code ya da Codex ile açan ajan, kurulumu, komutları ve akışı (YouTube videosu, AI influencer) oturum başında kendiliğinden okur; kullanıcıya "nasıl yapalım" diye sormaz. İçindeki komutlar gerçek bir iş üzerinde denendi (konu → senaryo → görsel → ses → 1080×1920 MP4, kapak, yayın paketi; karakter → sahne → prompt → görsel → paylaşım metni).
- **Seslendirme 403 veriyordu.** Microsoft'un ücretsiz Edge sesi eski `msedge-tts` sürümünü reddediyordu; 2.1.0'a yükseltildi, seslendirme yeniden çalışıyor (`npm audit` 0).
- **Ai Infapp görsel üretimi `402` veriyordu.** Pollinations anonim kullanımda aralıklı "ödeme gerekli" döner; artık otomatik tekrar denenir ve hata mesajına resmin ikili verisi basılmaz.
- **Proje adı Otopilot.** Repo `otopilot` oldu (eski `youtube-otomasyon` adresi yeni adrese yönlenir), panel başlığı ve belgeler Otopilot'a döndü, paket adı `otopilot`; masaüstü eğitim klasörü **Otopilot Eğitim**. Proje YouTube ile sınırlı değil: YouTube, Shorts, Reels, TikTok, AI influencer, video indirme ve edit.
- **Ad.** Stüdyonun adı Ai Infapp oldu: klasör `ai-infapp/`, ortam değişkenleri `AI_INFAPP_*` (sunucu) ve `AIINFAPP_PORT` (panel), kimlik başlığı `X-Ai-Infapp`.

### Düzeltilenler (son denetim turu)
- **Ai Infapp ayar maskelemesi kilitlemiyor.** Adres içindeki kimliği gizleyen düzenli ifade «a.a.a.…» gibi tek satırlık 250 KB'lik girdide ikinci dereceden sürüyordu (~12 sn olay döngüsü kilidi, diskte kalan değerde her ayar yüklemesinde tekrar). Şema uzunluğu sınırlandı; ayrıca sağlayıcı alanlarına yazma sınırı geldi (metin 4 KB, kutu 16 KB; aşarsa 400).
- **Çift tık / eşzamanlı başlatma.** Çalışan Ai Infapp varken ikinci `POST /api/aiinfapp/baslat` yanlış «açılmadan kapandı» (500) veriyordu; aynı porta tek uçuştaki başlatma paylaşılır, kilit yüzünden çıkış 1 ile kapanan sürecin yerine başka kopya açılıyorsa başarı döner (`zatenAcik`). Arayüzde düğme istek sürerken ikinci pencere/istek açmaz.
- **`cumleBol`:** cümleyi bitiren tek büyük harf («Vitamin C.», «Plan B.») artık bölünür; yalnızca ardışık baş harfler («J. K. Rowling») ve unvandan sonraki baş harf («Dr. J. Smith») birleşik kalır. Bilinen takas: tek başına «Yazar J. Smith» cümle sonu sayılır.
- Hazır sahne sayısı belgelerde 677/678 yazıyordu, gönderilen veri 1.264 kayıt (`THIRD_PARTY_LICENSES.md` dahil); belgeler düzeltildi ve `ai-infapp/test/kutuphane.test.js` sayıyı veriyle karşılaştırır. «Her karede aynı kişi» ifadesi, yüz tutarlılığının bağlanan sağlayıcıya bağlı olduğunu söyleyecek biçimde yumuşatıldı. README'de `PANEL_PORT` / `AIINFAPP_PORT` `.env` tablosundan çıkarıldı (panel `.env`'i bu iki değişken için okumaz).
- `test/duman.test.js`: BOM denetimi artık ham baytlara bakar (eski denetim `TextDecoder` BOM'u soyduğu için kördü; `ai-infapp/public/index.html`'deki BOM silindi); gizli anahtar taraması `sk-proj-` / `sk-svcacct-` / `sk-admin-` ve Replicate `r8_` biçimlerini de görür; `.gitignore`'lu `ai-infapp/data` ve `ai-infapp/cikti` taranmaz; `.sh`, `LICENSE*` dosyaları taranır.
- `ai-infapp/test/saglayici-guvenlik.test.js`: yük altında «fetch failed» veren bayat keep-alive soketi giderildi (test sunucusu her yanıtta bağlantıyı kapatır).

### Değişenler
- Sürüm `1.2.0` (`ai-infapp` paketi `2.1.0`, `private`). Ai Infapp için de Node en az 22 (kök kural).
- README: ayrı «Ai Infapp» bölümü, Araçlar tablosu, güvenlik modeli paragrafı, `AIINFAPP_PORT`, testler ve üçüncü taraf lisans atfı. `ai-infapp/README.md` bu depodaki konuma uyarlandı (klon adresi, `ai-infapp` klasörü, port değişkeni). `ai-infapp/THIRD_PARTY_LICENSES.md` klasörün bu depodaki yerini söyler.

## [Yayınlanmamış] — 2026-10-08 — Denetim kalıntıları (panel arka ucu, güvenlik, kurulum)

### Düzeltilenler
- **Çeviri altyazısı kutusu 500 veriyordu (B039/B052).** Altyazı dili anlatım diliyle aynı olan her işte (yeni işlerin varsayılanı) `GET/POST /api/dosya?tur=altyazi` `path.join(…, null)` TypeError'ıyla 500 dönüyordu. Artık okuma `{icerik:"", kullanilmiyor:true, mesaj}` döner, yazma açık bir 400 (`altyazi_kullanilmiyor`) verir; bozuk `konu.json`'da 409. Senaryo sekmesinde kutu kapanır ve nedenini söyler.
- **PID yeniden kullanımı (B004).** Elektrik kesintisi/çökme sonrası `.kilit`'teki PID başka bir programa geçmişse panel sahte "yetim iş" gösteriyor, işi başlatmayı 409 ile engelliyor, betikler "zaten çalışıyor" (çıkış 6) diyordu ve **Durdur alakasız programın süreç ağacını öldürüyordu**. Kilit sahibi artık doğrulanır (`ortak.kilitSahibiCanliMi`): kilit bilgisayar açılışından önce yazıldıysa, PID'deki program `node` değilse ya da süreç kilitten sonra başlamışsa kilit bayattır; Durdur öldürmeden önce aynı doğrulamayı yapar, bayatsa yalnız kilidi temizler.
- **Port doluyken ikinci panel ilkini bozuyordu (B003).** `PANEL.bat`'a ikinci kez tıklanınca ikinci örnek 98 ile çıkmadan önce ilk panelin `durum.json`/`_kuyruk.json` dosyalarını bozuyordu ("panel kapandı" işareti, kuyruk duraklatma). Açılış işleri artık yalnız port alındıktan sonra yapılır.
- **`PANEL.bat` sonsuz yeniden başlatma döngüsü (B003).** Panel açılışta her seferinde ölüyorsa (EACCES, bozuk dosya, eksik modül) pencere sonsuza dek yeniden deniyordu; ilk 60 saniyede art arda 5 çökmeden sonra durur ve günlüğe bakmanı söyler.
- **Panel ağa açılabiliyordu (B061).** `PANEL_HOST`/`PANEL_IZINLI_HOST` seçeneği sözleşmedeki "her zaman 127.0.0.1" kuralına aykırıydı ve sayfa jetonu HTML'e gömülü verdiği için ağdaki herkes jetonla `.env` yazıp ücretli iş başlatabilirdi. **Seçenek kaldırıldı**; `hostIzinli/originIzinli/kapi` ek host listesi almaz. README'deki yanlış güvence düzeltildi.
- **Altyazı çevirisi ön kontrolü (B085).** Zincirde altyazı dili ≠ anlatım dili ise `ceviri` adımı Claude anahtarı ister; önceden yalnız tek `ceviri` işlemi kontrol ediliyordu, yani vidIQ'yla ücretli senaryo yazılıp onaylandıktan sonra `altyazi-cevir.js` anahtar yok diye düşüyordu. `/api/yeni` (`uret:true`), `/api/kuyruk/ekle` ve var olan işlerin zinciri artık baştan 400 `anahtar_yok` verir (klasör açılmaz); çeviri tutarı tahmine ve günlük/aylık/iş başı sınırlara girer. Betiğin kendi atlama kararı aynen uygulanır: çeviri dosyası güncelse anahtar aranmaz.
- **Hata çevirisi yanlış sınıflıyordu.** `hataCevir` `401/402/429/529` sayılarını bağlamsız arıyordu: `frame=  401 fps= 30` (ffmpeg ilerleme satırı) "API anahtarı geçersiz", `frame=  429 …` "servis sınırı" olarak gösteriliyordu. Sayılar artık yalnız HTTP bağlamında (`HTTP 429`, `status 402`, `(429)`, `Error: 401`, satır başı `429 {…}`, `nesne.status`) tanınır.
- **Toplu üretimde takılan alt süreç seriyi sonsuza dek bekletiyordu (B009).** `toplu-uret*.cjs` alt süreçleri artık panelin kendi çalıştırıcısı gibi boşta izlenir: çıktı gelmeyen süre 45 dk (video 90 dk; `gorsel-bul` için sessiz 429 beklemesi + 10 dk) aşarsa süreç ağacı öldürülür, o iş `HATA-<aşama>` olur, seri sonrakiyle sürer. Ctrl+C/çıkışta çalışan alt süreçler öldürülür. `TOPLU_BOSTA_OLDUR_SN`, `TOPLU_VIDEO_BOSTA_OLDUR_SN`.

### Panel arayüzü (denetim kalıntıları)
- **İlk kullanımda liste "Yükleniyor…"da asılı kalıyordu (B054).** Liste çizim imzası yükleme durumunu içermiyordu; hiç iş yokken «Henüz video yok» mesajı ve sayaç hiç çizilmiyordu. İmza artık satırda görünen her alanı (biçim, dil, süre, tür) ve yükleme/hata durumunu içerir; liste alınamazsa nedeni yazılır. Videolar görünümünün yoklayıcıları görünüm kapalıyken ağa çıkmaz, dönünce hemen tazelenir.
- **Ücretli adım haber verilmeden çalışabiliyordu (B085).** `/api/onkontrol` `ucretliAdimlar` döndürür; «Üret», «Baştan yap», «Kaldığı yerden devam et» ve «Devam et» başlatmadan önce ücretli adımları (senaryo, çeviri, vidIQ başlık analizleri) tek satır onayda sayar — senaryo zaten varken vidIQ anahtarı tanımlıysa başlık adımları da. Önceden bu iki «devam» düğmesi önkontrol ve onay olmadan doğrudan çalıştırıyordu.
- **Kaynaklar'da yazılmış metin siliniyordu (B053).** «Açık» alanlara (model adı, Azure bölgesi, Piper yolları) yazılıp başka satırın Kaydet/Sil'i kullanılınca kayıtlı değer yazılanı eziyordu; yazılmış ama kaydedilmemiş alana artık dokunulmaz.
- **CRLF'li metin açılır açılmaz «kaydedilmedi» sayılıyordu (B084).** Notepad'de düzenlenmiş senaryo/altyazı/ham ayar dosyaları editöre LF'ye çevrilmeden «orijinal» diye alınıyordu; çıkış uyarısı da boşuna kuruluyordu.
- **Klavye ve erişilebilirlik (B060).** Günlük çubuğundaki iş çipleri her yoklamada yeniden yaratılıyor, odaktaki çip birkaç saniyede kayboluyordu; çipler artık yerinde güncellenir. Yazı tipi sistem yığını yerine panelin kendi sunucusundan yüklenen Hanken Grotesk (gövde) + Archivo (başlıklar) (`panel-public/fonts/`, SIL OFL; CSP `default-src 'self'` aynı kaynaktaki yazı tipine izin verir — stil dosyasındaki «izin vermiyor» notu yanlıştı), zemin mavi tonlu lacivert yerine nötr grafit. Vurgu rengi bilerek turkuaz kaldı: videonun varsayılan `vurguRenk` değeriyle aynı. Süre uyarısındaki `⚠` sistem simgesi panelin SVG ikonuyla değişti.
- **İş sayfası.** Açık onay paneli panel yeniden başladıktan sonra da görünür (`isOzeti` `durum.json`'daki `onay_bekliyor`'u «yeni»ye düşürüyordu; Durdur düğmesi canlı kayıt yoksa gizlenir). `/api/yeni` uyarıları (ör. «Kanal adı hâlâ KANALIM») yalnız ilk `is-detay` yanıtına kadar gösterilir, düzeltilince kalkar. Yeni başlayan işte durum şeridi «Çalışıyor — null» yazmaz. Önceki oturumdan kalan süreç bittiğinde günlük çubuğu «çalışıyor»da takılı kalmaz. Yayın/Ses/Görünüm sekmelerinin yeniden çizilen düğmeleri kilit listesinde birikmez. «Altyazıyı çevir», Portreler, Formül ve Prompt düğmeleri iş sayfası ilk açıldığında (`konu.json` henüz gelmemişken) hiç çıkmıyordu; artık konu gelince gösterilir. Ham ayar hata kutusu satır/sütunu iki kez yazmaz.

### Bilinçli olarak yapılmayanlar
- **B072 (otomatik YouTube/Instagram/TikTok yükleme):** sözleşme K5 gereği yapılmadı — Google OAuth kimliği ve API denetimi gerekir, ağsız test edilemez, yayına almak ürün sahibinin kararıdır. Yerine yayın paketi, kapak, atıflar, bölümler, `yayin-durum.json` ve performans döngüsü var.

## [Yayınlanmamış] — 2026-10-06 — Güvenlik saldırı testi

Panel ve video indirici **gerçek süreç olarak** başlatılıp Node `http`/`net` ile saldırıldı (sahte `.env`, sahte betik ve sahte yt-dlp; gerçek anahtar/ücretli servis yok): Host/DNS rebinding, Origin/CSRF, jetonsuz/yanlış jeton, yol geçişi (silme/okuma/önizleme/video/statik), dev gövde, bozuk JSON, tip karıştırma (≈36 bin HTTP isteği + ≈19 bin doğrudan işlev çağrısı), XSS (tarayıcıda DOM kontrolü), HTTP boru hattı/smuggling/yavaş bağlantı, SSRF, symlink/junction. Ayrıca statik tarama, `npm audit` ve **git geçmişi** sır taraması. Bulgular:

### Düzeltilenler
- **İndirici SSRF atlatması:** `[::ffff:127.0.0.1]`, `[::7f00:1]`, NAT64, 6to4, `localhost.` (sondaki nokta), tek etiketli adlar (`http://router/`), CGNAT (100.64/10) ve ayrılmış aralıklar yerel ağ denetiminden geçiyordu (yt-dlp yerel servislere GET atabilirdi). Karar baştan yazıldı; alan adı yerel adrese çözülüyorsa (`localtest.me`) o da reddedilir. Görsel indirme (`lib/gorsel-ag.js`) aynı tabloyu `lib/ag-guvenlik.js` üzerinden kullanır.
- **CSP:** panel `script-src` artık `'unsafe-inline'` içermez (enjekte edilen tek sarmalayıcı betik SHA-256 özetiyle tanınır); `object-src 'none'`, `form-action 'none'` eklendi.
- **Sec-Fetch-Site:** başka siteden gelen `GET /api/*` ve medya istekleri de reddedilir (yalnız POST'ta vardı; indirici zaten yapıyordu).
- **PIPER_YOL → uzaktan komut çalıştırma yolu:** anlatım metni programın stdin'ine verildiği için `cmd.exe`/`powershell.exe` gibi bir programa yönlendirilirse metin komut olarak çalışırdı. Dosya adı `piper` içermeli.
- **`.env` bozulması:** değerdeki U+2028/2029, NUL, sekme, DEL gibi kontrol karakterleri satırı ayrıştırılamaz/silinemez hale getiriyordu; reddedilir.
- **Nesne gövdeli alanlar** (`{"toString":"x"}`) `String()`/`Number()`/`RegExp.test()`'i patlatıp 500 veriyordu: `/api/calistir`, `/api/ses-testi`, `/api/yeni sureDk`, `/api/yayin-isaretle`, `/api/ac`, `/api/vs-yeni` (`ad`, `ust.renk`), `/api/ayarlar` (`fiyat.*`), `/api/anahtarlar` (`sil`), indirici gövdeleri (nesne/liste → 400 `govde_tipi`).
- `/api/kuyruk/ekle`: ortada ad çakışması 500 veriyor ve yarım klasör bırakıyordu → 409 ve bu çağrıda açılan her şey geri alınır.
- `-` ile başlayan konu/kanal/slogan/arama ifadesi betiğe bayrak olarak gidemez (argüman enjeksiyonu).
- `yayin-isaretle`: tırnak/boşluk/kimlik bilgili adres reddedilir, adres normalleştirilerek saklanır. `konu.json muzikDosyasi` yalnız ses uzantılı (ffmpeg `-i`'ye `.m3u8`/`.ffconcat` gibi yorumlanan dosya verilemez).
- **Tedarik zinciri:** `msedge-tts`'in `preinstall: npx only-allow pnpm` betiği kurulumda uzaktan paket indirip çalıştırıyordu → `PANEL.bat`, README ve CI `npm ci --ignore-scripts` kullanır; CI `permissions: contents: read` ve üçüncü taraf eylem commit özetine sabitlendi.

### Doğrulananlar (açık bulunmadı)
Host/Origin/jeton/Content-Type kapıları (215 kontrol), 1.800+ yol geçişi denemesi (silme/okuma/akış/statik), gövde sınırları (413), bozuk/derin JSON, prototip kirletme, anahtar maskeleme (hiçbir yanıtta/günlükte tam değer yok), güvenlik başlıkları, yığın izi sızıntısı yok, yalnız `127.0.0.1`'e bağlanma (LAN adresinden bağlantı reddedilir), `shell:true`/`exec`/`eval`/`innerHTML` yok (tek `shell` PIPER `.cmd` yolu, tırnak/özel karakter denetimli), `npm audit` 0 açık, **git geçmişinde sızmış anahtar yok** (23 commit tarandı).

### Bilinen sınırlar
- Aynı bilgisayardaki başka bir *program* `GET /` ile jetonu okuyabilir (koruma tarayıcı tabanlı saldırılara karşıdır).
- Alan adı sonradan başka adrese çözülürse (DNS rebinding) indirici/görsel indirme SSRF denetimi yakalayamaz; yt-dlp kendi çözümlemesini yapar.

## [1.1.1] — 2026-10-06 — Arayüz uyumu turu

Paralel çalışan grupların birbirine bıraktığı boşluklar kapatıldı; ayrıca gruplar arası sözleşme, **gerçek** betiklerle uçtan uca test edildi (`test/entegrasyon-*.test.js`: gerçek `gorsel-bul` + gerçek `seslendir` + gerçek `video-yap`, panelin `shortsKes` komut dizisi).

### Düzeltilenler
- **Elle eklenen görsel ve kartlar videoya giriyor.** Manifest yalnızca `gorsel-bul.js`'in bulduğunu kaydeder; formül/prompt kartları görsel adımından *sonra* üretildiği için manifest modunda videoya hiç girmiyordu. Artık sahne klasörüne atılan manifest dışı görseller sahnenin başına eklenir; `14-formuller` / `90-promptlar` gibi manifest dışı klasörler önek sayısına göre en yakın sahneye eklenir ve her ek uyarıyla bildirilir (`lib/render-sahne.js`).
- **Önizleme ve Shorts panelde oynuyor:** `/video/<iş>/onizleme`, `/shorts/<iş>/<dosya>` (Range, `?indir=1`), `GET /api/shorts`; iş sayfasında oynatıcı ve indirme bağlantıları. `is-detay` yeni dosya bayrakları: `onizleme`, `shorts`, `senaryoYarim`, `yayinDurum`.
- **Yayın durumu** artık sekme açılınca okunur (yalnızca işaretleyince görünmüyor).
- **Yarım senaryo** (`SESLENDIRME-TAM-METIN-yarim.txt`, çıkış kodu 4) Senaryo sekmesinde bildirilir; «Editöre al» ile düzenlenip kaydedilir; hata bandında kısa yol.
- **Görsel silince `ATIF.txt` güncellenir** (silinen görselin atfı açıklamaya girmiyordu).
- **Ortak önbellek** (`uretim/_onbellek`, geri sayım kartı) `/api/disk`'te raporlanır ve Kaynaklar'dan temizlenir (`POST /api/temizle {tur:"onbellek"}`; video kurulurken 409).
- **Trend referansı:** «Bu konuda video yap» artık `konu._trendRapor`'u yazar; senaryo istemine raporun hook ve süre kalıpları girer. `yeni-is.js`: `--trendRapor`, `--sesMotoru`.
- **Anahtar alanı doğrulaması:** `PIPER_YOL` (komut çalıştırılan alan) yalnız var olan, mutlak yollu, beklenen türde bir dosya; kabuk karakterleri reddedilir. `PIPER_MODEL` `.onnx`, `AZURE_SPEECH_REGION` ve `ANTHROPIC_MODEL` biçim denetimi.
- Gece çalışan kuyruk ve `toplu-uret*.cjs`, Pexels/Pixabay 429'unda kaynağı kapatmak yerine siniri bekler (`GORSEL_LIMIT_BEKLE_SN`; kuyrukta panelin boşta-öldürme eşiğinin altında).
- VS tanımında `yasak` listesi `vs-tanim.json`'a geçer.
- `VIDEO_KODEK`, `RENDER_ONCELIK`, `FFMPEG_YOLU`, `FFPROBE_YOLU`, `GORSEL_LIMIT_BEKLE_SN` `.env` dosyasından da okunur (eskiden yalnız süreç ortamından).
- Kart betiklerinin uyarısı gerçeği söyler (kart nereye eklenir).
- `npm test` artık video-indirici testlerini de koşar; CI aynı komutu kullanır. Test dosyaları en çok 2 paralel çalışır (`--test-concurrency=2`): çok sayıda ffmpeg'i aynı anda başlatmak az bellekli bir makinede rastgele `Cannot allocate memory` / DLL başlatma hataları veriyordu. `.gitignore`: `video-indirici/log/`.
- Manifest not alanları panelde: `/api/sahneler` artık `uyarilar` (CC BY-SA vb.) ve `kaynakHatalari` döndürür; Sahneler sekmesi gösterir.
- **Panel işlevsel doğrulama turu** (gerçek HTTP + gerçek tarayıcıyla; sahte betikler, ağsız): konu.json bozuksa hata mesajı artık **Türkçe** («değerden sonra virgül ya da '}' bekleniyordu», eskiden V8'in İngilizce metni sızıyordu); `Başlık en çok 300 karakter…` gibi doğrulama mesajları alan adını Türkçe yazar; satır sonu olmadan `\r` ile ilerleme yazan betik «takıldı» sayılıp öldürülmez; semafor slotu, iptal tam alma anına denk gelirse sızmaz; bitmiş işte dizin boyutu önbelleği sıfırlanır, boşta işlerin boyutu uzun önbelleklenir (150 işte liste her dakika ~4 sn olay döngüsünü tıkıyordu); bozuk `panel-ayar.json` ezilmeden önce `.bozuk-<damga>` kopyası kalır; hata kutusu aynı sorunu iki kez yazmaz.

### Belgeler
- README: gelişmiş ayarlar tablosu (`VIDEO_KODEK`, `RENDER_ONCELIK`, `fonts/`, −16 LUFS), ses motoru ayrıntıları (hızın sabit olduğu, Edge/Azure/Piper, `--test/--motor/--yeniden`), «Görseller sahneyle nasıl eşlenir», VS bayrakları, `senaryo-claude.js` bayrakları, indirici kanonik kopya notu. KONU-JSON.md: kart/portre/sahne şekilleri, `_trendRapor`.

## [1.1.0] — 2026-10-05 — Sağlamlık ve güvenlik turu

86 doğrulanmış bulgunun düzeltildiği tur. Aşağıdaki özet alana göre gruplanmıştır; ayrıntılı sözleşme: `KONU-JSON.md` ve `README.md`.

### Güvenlik
- Panel yalnızca `127.0.0.1`'e bağlanır; `Host` izin listesi (DNS rebinding), `Origin`/`Sec-Fetch-Site` ve `Content-Type: application/json` denetimi, açılışta üretilen rastgele oturum jetonu (`X-Panel-Token`, zaman-sabit karşılaştırma; medya GET'leri `HttpOnly; SameSite=Strict` çerezle), CSP ve diğer güvenlik başlıkları, 5 MB gövde sınırı.
- İş adı için katı beyaz liste (`^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$`) ve `path.relative` tabanlı kök denetimi: `..` ile `.env`/`panel.js` sildirme açığı kapandı.
- API anahtarları yalnızca izinli adlarla, tek satır, atomik yazılır ve maskeli gösterilir; yığın izi hiçbir yanıtta sızmaz.
- `package-lock.json` depoya girer; `PANEL.bat` `npm ci` kullanır, tüm bağımlılıkları denetler, Node.js/ffmpeg kurmadan önce **sorar**.

### Sağlamlık
- Yakalanmamış hata/reddedilen söz panelin kapanmasına yol açmaz (`uretim/_log/panel-<tarih>.log`); her `spawn` hata dinleyicilidir; port doluysa Türkçe mesaj ve çıkış kodu 98; `PANEL.bat` beklenmedik kapanmada yeniden başlatır (sahte "Hazır" yazısı kalktı).
- Tek iş / tek koşu: aynı iş için ikinci koşu 409; en çok 2 eşzamanlı zincir; video/ses ağır adımları için global tek slot (fazlası "sırada").
- Kalıcı durum: `durum.json` (adımlar, yüzde, hata), diske yazılan günlük, koşu boyunca artan mutlak satır numarası, `/api/calisanlar` ile sayfa yenilense de çalışan işe yeniden bağlanma, yetim süreç tespiti, bayat kilit/`.part` temizliği.
- Boşta izleyici (15 dk uyarı, 45/90 dk sonlandırma), Durdur sonrası `.part` temizliği, Windows/Linux/macOS'a göre süreç öldürme ve klasör açma.
- Atomik yazma (`konu.json`, `.env`, `panel-ayar.json`, kuyruk, durum); `konu.json` bozuksa panel üzerine yazmaz (409), kaydetmeden önce satır/sütunlu doğrulama ve `.bak` yedeği.
- Disk: başlamadan önce boş yer kontrolü, `ENOSPC` yakalama, iş başına boyut, "ara dosyaları temizle", arşivleme (silme yok).
- Hatalar Türkçe özetlenir (disk dolu, ffmpeg yok, internet yok, anahtar geçersiz, kredi bitti, sınır, kodlayıcı, bozuk görsel, eksik paket) ve ham ayrıntı `detay` altında verilir.

### Panel ve akış
- İki aşamalı akış: senaryo (varsayılan) ve isteğe bağlı görsel **onay durakları**; `POST /api/onayla`.
- Senaryo yedek motoru (Claude ↔ vidIQ), Anthropic anahtarı için ücretsiz canlı test, kaydedince otomatik test, anahtar silme, model adı `ANTHROPIC_MODEL`.
- Yeni uçlar: ön kontrol, maliyet, kuyruk (duraklatılmış başlar), arşiv, disk, raporlar, performans, yayın işaretleme, VS tanımı, ses testi, Shorts kesme/kapak/yayın paketi/marka işlemleri; `mix`/`tonMuzik` ve `Unsplash` kaldırıldı.
- Kanal profili (`panel-ayar.json`): kanal, slogan, dil, ses, hız, tür, ton, kanal sesi, vurgu rengi, kapanış metni, maliyet sınırları, disk eşiği, kaynak aç/kapa.
- Yeni uzun video varsayılanı **hızlı açılış** (0/0/0/12 + kanal adı köşede 2 sn); sinematik seçenek korundu.
- `/api/yeni` ve `yeni-is.js` aynı çekirdeği kullanır; dil/ses/hız/altyazı dili/tür/ton/kaynak metni/kişisel katkı alanları; ön kontrol başarısızsa klasör açılmaz.
- Toplu üretim (`toplu-uret*.cjs`): kaldığı yerden devam, var olan `konu.json`/senaryoyu ezmez, sayaç yalnızca doğrulanmış videoyu sayar, hata çıkış kodu, tam günlük, kanal adı manifest/ayardan.

### Belgeler ve geliştirme
- `README.md` gerçeğe uyduruldu (29 geçiş, Claude/vidIQ ya da kendi senaryon, Mac/Linux "deneysel", Araçlar tablosu, Edge sesinin resmî olmadığı notu, Shorts sınırı), `KONU-JSON.md` eklendi.
- Ortak kütüphane `lib/ortak.js` (env, atomik yazma, yol güvenliği, konu/ayar doğrulama, hata çevirisi, kilit, çıkış kodları, konsol protokolü); betikler artık içe alınabilir.
- `npm test` (Node yerleşik test koşucusu), GitHub Actions (windows-latest), sürüm 1.1.0, `engines.node >= 22`.

## [1.0.0]
İlk sürüm: panel, senaryo/görsel/ses/video zinciri, VS Shorts, trend/viral analizi, video indirici.
