# Değişiklik geçmişi

Biçim: [Keep a Changelog](https://keepachangelog.com/tr/1.1.0/). Sürümler [SemVer](https://semver.org/lang/tr/).

## [1.25.1] — 2026-11-08 — Sessizlik kesme düzeltmesi

### Düzeltmeler
- **`araclar/medya.js sessizlik` yeni ffmpeg'de çalışmıyordu:** 1.25.0'ın GitHub CI'ı kırmızıydı çünkü CI'daki ffmpeg `-filter_complex_script` seçeneğini tanımıyor ("Option not found"). Artık kısa filtre doğrudan `-filter_complex` ile verilir (her sürümde çalışır); 20 bin karakterden uzun filtre dosyadan verilir ve önce eski, olmazsa yeni (`-/filter_complex`) yazım denenir. Çok kesimli uzun filtre için de test eklendi.
- **Sürüm aracı:** `git status` çıktısının ilk satırında dosya adının ilk harfi kesiliyordu (`CHANGELOG.md` → `HANGELOG.md`); yalnızca "commit'e girmeyecek dosyalar" notunu bozuyordu.
- Dependabot, `@anthropic-ai/sdk` major sürümlerini artık önermez (1.x ile `claudeIste` testi kırılıyor; geçiş elle ve testle yapılır).

## [1.25.0] — 2026-11-08 — Medya araçları ve profesyonel depo

### Eklenenler
- **Ücretsiz medya araçları (`araclar/medya.js`, `npm run medya`):** yalnız ffmpeg, ek kurulum ve kredi yok. `sessizlik`: konuşma kaydındaki sessiz boşlukları keser (kelime başı/sonu kırpılmasın diye kenarlarda `--pay` kadar ses kalır, `--rapor` yalnız ne keseceğini yazar). `sahneler`: plan değişimlerini bulur, `--kes` ile her sahneyi ayrı klip yapar. `yukselt`: resim/videoyu 2-4× büyütür (lanczos + hafif keskinleştirme; `REALESRGAN_KOK` tanımlıysa resimde Real-ESRGAN, bu yol denenmedi). Sentetik ses/video ile gerçek ffmpeg'de 9 testle denendi.
- **Açık kaynak kataloğu (`docs/KAYNAKLAR.md`):** 8 Kasım 2026'da GitHub ve web taramasıyla çıkarılan adaylar (ACE-Step 1.5, Chatterbox Çok Dilli, Kokoro, LTX-Video, Wan 2.x, LatentSync, WhisperX ve dahası) lisanslarıyla; GPL/AGPL/NC uyarıları (OpenMontage AGPL, Remotion özel lisans, F5-TTS/XTTS/MusicGen ağırlıkları vb.) ve yeni kaynak ekleme kuralları.
- **Depo hijyeni:** `SECURITY.md` (özel güvenlik bildirimi), `CODE_OF_CONDUCT.md`, `THIRD-PARTY-NOTICES.md` (tüm atıflar tek yerde), `docs/MIMARI.md` (klasör ve betik haritası), Dependabot (haftalık bağımlılık ve CI eylemi PR'ları, otomatik birleşmez), `.github/release.yml`, `package.json` üst verisi (lisans, depo, anahtar kelimeler).

### Düzeltmeler
- Depoya yanlışlıkla girmiş 6 KB'lık bozuk `-v` dosyası (ffmpeg çıktısı) kaldırıldı.

## [1.24.0] — 2026-11-07 — 3B model bulucu

### Eklenenler
- **`node model-bul.js`: açık lisanslı 3B model arama ve indirme.** Kaynaklar: Poly Haven (~520 model, CC0), NASA 3D Resources (~260 `.glb`, kamu malı), Smithsonian 3D (müze taramaları, uçaklar, eserler; Open Access) ve Sketchfab (arama anahtarsız, yalnız CC0 ve CC BY; indirme için ücretsiz `SKETCHFAB_TOKEN`). Sonuçlar numaralanır, `indir <no>` tek bir `.glb` verir (Poly Haven'ın glTF + doku dosyaları tek GLB'ye paketlenir), `KAYNAK.txt`'e lisans ve açıklamaya yapıştırılacak atıf yazılır; `--is <iş>` modeli Stüdyo işinin `girdi/` klasörüne kopyalayıp `ATIF.txt`'e ekler. Geçici ağ kopmasında 2 kez yeniden dener. Gerçek indirmeyle denendi (gemi, 1903 Wright Flyer, Hubble) ve 3B çizicide çizildi.
- **Draco sıkıştırmalı modeller** (Smithsonian) ürün sahnesinde açılır; model platformun üstüne oturur. Smithsonian'da parça parça kalite dosyaları yerine modelin tamamı seçilir.

## [1.23.0] — 2026-11-07 — Kodla film (cinecode), Türkçe telaffuz paketi, W.J. Sidis video şablonu

### Eklenenler
- **Kodla film: cinecode yeteneği depoda** (`.claude/skills/cinecode/`, Sarp Yıldız, MIT): Otopilot'u Claude Code'da açıp "kodla film yap", "kısa film", "belgesel", "reklam filmi", "müzik videosu" demek yeterli. Her kare başsız Chrome'da koddan çizilir (3B, 2B, kil, kâğıt, piksel, hareketli grafik), ses kodda ya da açık lisanslı kayıtlardan, -14 LUFS, kalite raporu; AI video kredisi harcamaz. Hızlı mod ve Film modu (uzun belgeseller dahil). Windows'ta denendi: Hızlı mod filmi kuruldu, taslak 12 sn'de çizildi, sesi ayarlandı, kalite raporu üretildi. Python 3.9+ ister.
- `npm run cinecode-guncelle`: cinecode'un en yeni sürümünü GitHub'dan çekip yeteneği yeniler (yalnız o klasöre dokunur; lisans MIT değilse durur). `Filmler/`, `Films/` ve `__pycache__/` repoya girmez.
- **Türkçe telaffuz paketi (yerleşik, ücretsiz):** `dil: tr` seslendirmede YouTube, Shorts, TikTok, Instagram, vidIQ, ChatGPT, OpenAI, Claude, Gemini, Google, iPhone, Netflix, podcast, thumbnail, prompt, AI/YZ gibi 130'u aşkın yabancı marka, platform, yapay zekâ aracı ve teknoloji terimi Türkçe söylenişiyle okunur (`data/telaffuz-tr.json`). Yalnız sese gider; altyazı ve senaryo özgün yazımla kalır. Kesmeli ekler korunur (`YouTube'da` → `Yutup'da`, `YouTube'u` → `Yutub'u`), bitişik Türkçe ekler tanınır (`promptlar`, `Instagramda`; ünlü uyumu bozuk devam, ör. `Discordia`, ek sayılmaz), kısaltmalar büyük/küçük harf duyarlıdır, Türkçe kelimeyle çakışan ad yalnız büyük harfle eşleşir (`Gemini` dönüşür, `gemini` = gemi+n+i dönüşmez). `konu.json` `okunus` girişi yerleşik girişi ezer; anahtar yerleşik girişle aynıysa (`"youtube"`) adın tüm yazılışlarına uygulanır. Senaryoya elle "Yutup" yazmaya gerek kalmaz.
- **Diksiyon kuralı:** paragraf başındaki selam "Merhaba"/"Merhabalar" ("Merhaba," / "Merhaba." / yalnız "Merhaba") seste "Merhaba!" okunur ve ardından gelen cümle büyük harfle başlar ("Merhaba, ben Efe." → "Merhaba! Ben Efe."; motorlar "meraba" diye yutuyordu). Ardından "önce" geliyorsa uygulanmaz (VoxCPM'in bozduğu cümle başı "Önce"yi üretmesin). Başka dönüşüm otomatik yapılmaz.
- **Diksiyon raporu:** `node diksiyon.js <iş|dosya.txt>` (`npm run diksiyon -- <iş>`) senaryodaki riskleri satır numarasıyla listeler: okunuşu tanımsız yabancı kelime, uzun cümle (>28 kelime, `--esik`), şapka belirsizliği (hala/hâlâ, kar/kâr, alem/âlem…), VoxCPM'de cümle başı "Önce" (`--motor voxcpm`; anlamı koruyan güvenli dönüşüm olmadığı için yalnız uyarı), okunuş hazırlığından sonra kalan rakam/sembol, web adresi, okunuşla ünlü uyumu bozulan kesmeli ek (`API'ye` → seste "Ey Pi Ay'ye", `ek-uyumu`); paketin otomatik yapacağı değişiklikleri de gösterir. `--json`, `--telaffuz-kapali`. Çıkış: 0 temiz, 1 risk var, 2 girdi. Seslendirme de Türkçe işlerde günlüğe tek satır özet yazar (işi durdurmaz).
- **Kapatma:** `konu.json` `"telaffuzPaketi": false`, `seslendir.js --telaffuz-kapali` ya da panelde Ses ve dil sekmesindeki kutu. Paket durumu ve sözlük okunuş özetine girer: paket açılıp kapanınca ya da sözlük değişince Türkçe sesler yeniden üretilir; diğer dillerdeki sesler etkilenmez.
- **W.J. Sidis video şablonu (`araclar/sidis-video/`):** "Claude ile kendi video fabrikamı kurdum" videosunun Remotion kodu: 1910'lar gazete/daktilo kimliği, W.J. ve Daktilo karakterleri, tramvay bileti sayaçları, damgalar, bölüm takip çubuğu ve gazete katlama geçişi; 30 dakikalık örnek uzun video (`SidisUzun`) ve pilot Shorts (`SidisShort01`). Görüntüler cümleye bağlıdır (`zaman.json`), ses değişince kendiliğinden uyar. Yanında Python betikleri: cümle zamanları + anlatım sesi, Whisper ile cümle denetimi, bozuk cümle seçimi, parça parça render ve render etmeden ses değiştirme. Kurulum ve eksik bırakılan dosyalar (yazı tipleri, ekran görüntüleri) README'de.
- **Sürüm aracı:** `npm run surum` en üstte `## [Yayınlanmamış]` bölümü bulursa TASLAK eklemez, o bölümü yeni sürümün başlığına dönüştürür (notlar sürümün altında kalmaz).

## [1.22.0] — 2026-11-06 — Geçiş önizlemesi, anlatım taslakları, ilgili testler kapısı

### Eklenenler
- **Panelde geçiş önizlemesi:** sahne kartında Geçiş seçiminin yanında "Önizle"; iki desen klip arasında seçilen geçişi gösteren 3 sn'lik video (ilk istekte ffmpeg ile üretilir, `uretim/_gecis/` içinde saklanır; ücretsiz).
- **Film paketlerine anlatım taslakları:** Yeşilçam, bilim kurgu, fantastik ve aksiyon paketlerinde her çekim için Türkçe ve İngilizce birer satır. Panelde "Anlatım taslağı da ekle" kutusu ya da `node studyo.js sablon <ad> yesilcam --anlatimli`; işin anlatım diline göre eklenir, sonra düzenlenebilir, ücretsiz seslendirilir. Satırların hiçbiri yapay zekâ kalıp denetimine takılmaz (testle korunur).
- **Yayın kapısı `--ilgili`:** `npm run kapi -- --ilgili` son etiketten beri değişen dosyalara bağlı test dosyalarını bulup koşar; `npm run surum -- --yayinla` artık bunu kendiliğinden yapar. `--liste` seçilen dosyaları yazar.

### Düzeltmeler
- Stüdyo kurgusu bellek dolu makinede ffmpeg "Cannot allocate memory" ile düşüyordu (yeni yayın kapısı yakaladı). Artık bellek hatasında aynı adım bir kez tek iş parçacığıyla yeniden denenir; yine olmazsa çıkış kodu 5 ve "açık programları kapat" çözümüyle durur, biten sahneler korunur.

## [1.21.0] — 2026-11-06 — Kendi 3B modelin (GLB)

### Eklenenler
- **Ürün sahnesinde kendi GLB modelin:** `node studyo.js 3b <ad> urun --glb urun.glb` (dosya `uretim/<ad>/girdi/` içinde) ya da panelde 3B sahne kartında "Kendi 3B modelin (.glb)" yükleme. Model, kurulurken kendi Chrome'unda three.js ile çizilir (ücretsiz); model dosyası değişince sahne yeniden çizilir, dosya yoksa açık hata verir. Gerçek Chrome çizimi test edildi.
- Panel yüklemesi: yalnız gerçek GLB (`glTF` imzası), ≤14 MB; yüklenen model sahne olmaz, `girdi/` içine güvenli adla yazılır.

## [1.20.0] — 2026-11-06 — Panelde kadro seçimi

### Eklenenler
- **Panel, çekim şablonu yanında "Kadro" seçimi:** yüklediğin fotoğraflardan erkek, kadın ve (isteğe bağlı) çift fotoğrafını seçersin; film türü ve teknik paketleri çekimleri buna göre dağıtır (erkek çekimleri erkek fotoğrafı, kadın çekimleri kadın, "ikisi birlikte" çekimleri çift fotoğrafı ya da sırayla ikisi). Tek kişi seçilirse eksik rol onu kullanır. Eskiden şablon, sahnelerdeki fotoğrafları yüklenme sırasıyla alıyordu.
- Sunucu: `POST /api/studyo/sablon` artık `kadro: { erkek, kadin, cift }` kabul eder (`fotolar` listesi de çalışmaya devam eder).

## [1.19.0] — 2026-11-06 — Panelde lens profili seçimi

### Eklenenler
- **Panel, AI Stüdyo → "Lens profili" bölümü:** veritabanı yoksa tek tıkla indirilir (≈5 MB, Lensfun, CC BY-SA); sonra kamera/telefon ve lens arama kutuları (canlı arama, 1059 kamera + 1580 lens), odak ve diyafram, "bozulmayı düzelt" ve "kaldır". Seçim işle birlikte kaydedilir, `kur` filme uygular. Yeni uçlar: `GET /api/studyo/lens-ara`, `POST /api/studyo/lens-kur`; `detay` lens durumunu verir.

## [1.18.0] — 2026-11-05 — Gerçek lens profilleri (Lensfun)

### Eklenenler
- **Lensfun entegrasyonu (açık kaynak, ücretsiz):** `node studyo.js lens-kur` ~1060 kamera ve ~1580 lens profilini indirir (CC BY-SA 3.0; depoya girmez), `lens-ara` arar, `lens <ad> --kamera .. --lens ..` işe bağlar. `kur`, seçili profili filme gerçek bir lensin karakteri olarak ekler (distorsiyon, vinyet, renk sapması; ffmpeg `lensfun reverse`); `--duzelt` kendi videondaki bozulmayı düzeltir. Atıf: `docs/ATIF-lensfun.md`.
- Sınır: veritabanında her telefon yok (iPhone XS, Huawei, Nokia, LG, Samsung Galaxy S21 lensi, GoPro, DJI var; yenilerin çoğu, Pixel, Xiaomi yok). Bulunamayan model için uyarı verilir, film yine kurulur.

## [1.17.0] — 2026-11-05 — Stüdyo: geçişler, film türü ve teknik paketleri, yeni kamera görünümleri

### Eklenenler
- **Geçişler (ücretsiz, ffmpeg xfade):** sahnede `"gecis"` (bu sahneden sonrakine): kesme, çözülme, siyaha kararma, beyaz parlama, kaydırma, whip pan, silme, iris açılış/kapanış, zoom, piksel, radyal, bulanık. Geçiş sahne sonuna son kareyi uzatarak girer; anlatım ve altyazı zamanları kaymaz. Panelde sahne kartında "Geçiş" seçimi.
- **Film türü paketleri (8 çekim):** `yesilcam` (70'ler melodram), `bilimkurgu`, `fantastik`, `aksiyon-filmi`; her biri kendi görünümünü (kamera), POV çekimlerini ve geçişlerini getirir. Kadro: `node studyo.js sablon <ad> yesilcam --foto erkek.jpg,kadin.jpg[,cift.jpg]`; sahnelere erkek/kadın/ikisi birlikte dağıtılır.
- **Teknik paketleri:** `simetri` (simetrik tek nokta perspektif), `kesintisiz` (uzun çekim hissi), `gerilim-teknigi` (dolly zoom + POV).
- **Yeni kamera görünümleri:** VHS, Super 8, yumuşak lens (ışık taşması), 90'lar kamkorder.
- Not: ffmpeg'in Lensfun filtresi bu makinede derlenmiş olsa da lens profil veritabanı kurulu değil; gerçek lens profilleri (marka/model) henüz eklenmedi.
- Hiçbir paket film/dizi karesi ya da sahnesi içermez; tarifler kendi cümlelerimizle yazılmıştır.

## [1.16.0] — 2026-11-04 — cinecode'dan alınanlar

### Eklenenler
- **Yazım ve çekim rehberi** (`docs/YAZIM-VE-CEKIM-REHBERI.md`): senaryo/anlatım için kısa kurallar (tek dönüş, sondan başla, %30 kes, soğuk izleyici kontrolü, somutluk testi) ve çekim kuralları (bir ana hareket, hız/yumuşatma kelimeleri, kanca). Ajan kılavuzundan bağlandı.
- **Yapay zekâ kalıp denetimi genişledi:** İngilizce ve Türkçe listeye cinecode'un klişe tablosu ve "üretilmiş gibi okunan" kelimeler eklendi; yeni kurallar: uzun çizgi (—), ikiden fazla ünlem, "X değil, Y". Çok genel tek kelimeler (ör. "journey", "let's") yanlış alarm verdiği için alınmadı.
- **Yönetmen sözlüğü:** yeni kamera hareketleri (dolly zoom, rack focus, detaydan geri açılış, FPV, ağır çekim, time-lapse, vinç alçalışı), ışıklar (Rembrandt, kelebek, yarım yüz, high-key, low-key, teal-turuncu, siyah-beyaz, ışık sızıntısı), lensler (balık gözü, tilt-shift, lens flare); yeni çekim şablonu **tanıtım / reklam** (5 çekim).
- **Ses:** anlatım sesi artık alçak kesim, 3 kHz sunum ve hafif sıkıştırma zincirinden geçer; müzik, anlatım konuşurken kendiliğinden kısılıp aralarda yükselir (sidechain). Eskiden sabit kısık seviyeydi.
- Atıf: [cinecode](https://github.com/sarpstar/cinecode) (Sarp Yıldız, MIT), ayrıntı `docs/ATIF-cinecode.md`. Python betikleri, Claude Code kancaları ve stil kütüphanesi alınmadı.

## [1.15.0] — 2026-11-03 — 3B sahneler (three.js, ücretsiz)

### Eklenenler
- **3B sahne modu (ücretsiz, bu bilgisayarda):** Stüdyo'ya vidIQ kredisi harcamayan sahne türü. Üç şablon: **ürün platformu** (döner, cilalı ürün ya da kendi GLB modelin), **dünya ve uçuş yayları** (şehirler arası yaylar), **konuşan 3B karakter** (5 ön ayar: yaratıcı, öğretmen, şef, koç, analist; göz kırpma, nefes, jest). Karakterin ağzı, sahnenin Anlatım metninin sesinden otomatik hareket eder (`lib/ses-agzi.js`: ses → kare başına açıklık). CLI: `studyo.js 3b <ad> urun|dunya|karakter --baslik ".." --on-ayar ogretmen --anlatim ".."`; panelde "3B sahne ekle".
- **Çizici (`lib/sahne3d.js`):** kendi Chrome/Edge'ini başsız açar, her kareyi zamana kurup (kare = f(t), her çizim aynı sonucu verir) DevTools Protocol (`ws`) ile alır ve ffmpeg'e akıtır; yeni bağımlılık yok. three.js ilk 3B sahnede `uretim/_3d/three` altına npm ile iner (MIT, ~30 MB, `--ignore-scripts`), depoya girmez. Hızlı çizim için kısa kenar 720 px'e indirilir, filme 1080p'ye ölçeklenir; aynı girdi yeniden çizilmez.
- Şablon yapısı ve ses→ağız fikri: [motionforge](https://github.com/aykutucesai/motionforge) (MIT); şablonlar ve kod bu depoda yeniden yazıldı.
- Gerçek çizim testi `OTOPILOT_3D_TEST=1` ile çalışır (varsayılan testler Chrome'a/ağa dokunmaz).

## [1.14.0] — 2026-11-03 — "Yapay zekâ gibi" kalıp denetimi, ses seviyesi, kontrol sayfası

### Eklenenler
- **Yapay zekâ kalıbı denetimi (ücretsiz, 10 dil):** "oyun değişti", "Here's the thing", "Let's dive in" gibi yapay zekâ metni kokan kalıpları yakalar. `node ai-kalip-kontrol.js <iş | dosya.txt> [--dil tr]` (çıkış 1 = kalıp var, metin değişmez), `--kancalar tr` ile 11 kanca (ilk cümle) kalıbı. Stüdyo `kur` anlatımda kalıp bulursa uyarır, engellemez. Turkce I/İ büyük-küçük harfi sistem diline bağlı değil (tr-TR makinelerde yanlış eşleşmeyi önler).
- **Ses seviyesi eşitleme:** Stüdyo filmi sesliyse (anlatım ya da müzik) iki geçişli EBU R128 ile -14 LUFS / -1,5 dBTP'ye getirilir (Shorts/Reels/TikTok/YouTube); `--sesnormalsiz` ile kapatılır.
- **Kontrol sayfası:** `kur` filmden 12 kareyi tek JPG yapar (`Videos/<ad>-kontrol.jpg`): yayından önce bak (taşan yazı, boş sahne, kopuk kare).
- Kaynak ve atıf: [motionforge](https://github.com/aykutucesai/motionforge) (MIT, Aykut Üçeş); ayrıntı `docs/ATIF-motionforge.md`.

## [1.13.0] — 2026-11-02 — Yüz değiştirme (çift fotoğrafı)

### Eklenenler
- **Yüz değiştirme (yerel FaceFusion, ücretsiz):** poz fotoğrafındaki yüzler çiftin kendi fotoğraflarıyla değişir, sonuç `ilk-kare` sahnesi olur ve vidIQ ile canlandırılır (gerçek fotoğraf tabanlı olduğu için AI klibin yapay hissini azaltır). Çift için her kişi ayrı geçişte, soldan sağa değişir (FaceFusion birden çok kaynağı ortaladığı için). Ekran kartı (cuda) başarısız olursa işlemciye düşer. CLI: `studyo.js yuz <ad> --sablon yuz/poz.jpg --kisi yuz/sol.jpg,yuz/sag.jpg --riza`; panelde "Yüz değiştirme" bölümü.
- **Rıza onayı zorunlu:** `--riza` (panelde onay kutusu) olmadan çalışmaz; onay `studyo.json`'a tarihiyle yazılır. Yalnız kendi ya da yazılı izin verilen yüzler. FaceFusion'ın lisansı OpenRAIL-AS'tir (kullanım kısıtları içerir); depo FaceFusion'ı içermez ve indirmez, kullanıcı kendi makinesine kurup `.env`'e `FACEFUSION_KOK=<klasör>` yazar (kendi `.venv`'iyle).
- Poz fotoğrafları internetten toplanmaz: telifsiz ya da kendi çekimin olmalı (panel yükleme alanı bunu hatırlatır).

## [1.12.0] — 2026-11-02 — Yönetmen modu ve kamera görünümü

### Eklenenler
- **Yönetmen modu:** her sahneye plan (geniş, yakın, omuz üstü, siluet…), kamera hareketi (yaklaşma, takip, dolly, vinç, elde…), lens (24–85mm, anamorfik) ve ışık (altın saat, mavi saat, neon, mum ışığı…) seçilir; sinema dilinde İngilizce olarak isteme eklenir. Hazır **çekim şablonları**: romantik (6 çekim), aksiyon, gerilim; fotoğraf verilirse sahneler sırayla onları referans alır. CLI: `studyo.js sablonlar`, `studyo.js sablon <ad> romantik --foto a.jpg,b.jpg`; panelde sahne kartında "Yönetmen modu" ve "Şablonu ekle".
- **Kamera görünümü** (ücretsiz, yalnız ffmpeg): `sinema` (tane, vinyet, hafif renk kayması ve sıcaklık) ve `film` (daha grenli, solgun) AI klibin "plastik" hissini kırar. Yeni işlerde varsayılan `sinema`; `kur --kamerasiz` ile kapatılır. Altyazı kamera efektinden sonra yakılır, yazı bozulmaz.

## [1.11.0] — 2026-11-01 — Stüdyo'da anlatım, altyazı ve müzik

### Eklenenler
- **Anlatım (ücretsiz):** Stüdyo sahnesine `anlatim` metni (≤600 karakter) yazılırsa film kurulurken Edge sesiyle (olmazsa işletim sistemi sesiyle) seslendirilir. Sahne anlatımdan kısaysa klip döngülenir, anlatım bitmeden kesilmez. Aynı metin+dil+ses ikinci kez seslendirilmez. Anlatım dili ayarı (`dil`, 10 dil panelde).
- **Altyazı:** anlatım metni ekrana yakılır ve `Videos/<ad>.srt` olarak yazılır (`--altyazisiz` ile kapatılır).
- **Müzik anlatımın altında:** `--muzik` anlatım varken müziği kısık seviyeyle (%18) karıştırır; anlatım yoksa eskisi gibi tam sesle çalar.
- Panelde sahne başına "Anlatım" kutusu ve "Anlatım dili" seçimi. Yüklenen fotoğraf adlarındaki Türkçe karakterler okunur kalır (`Büyük Foto.png` → `Buyuk-Foto.jpg`).
- `studyo.js kur` artık asenkron; anlatım olmayan filmler eskisi gibi sessiz kurulur.

## [1.10.1] — 2026-11-01 — Panelde AI Stüdyo

### Eklenenler
- **Panel → "AI Stüdyo" sekmesi:** komut yazmadan iş aç, fotoğraf yükle (tarayıcıda 1536 px'e küçülür), yazıdan/fotoğraftan/kendi videondan sahne ekle, sırala, stil-ekran-model seç. Maliyet önce gösterilir; **"Üret" düğmesi, harcama onay kutusu işaretlenmeden kapalı kalır**, "Maliyeti hesapla" kredi harcamaz. Klipler sahne sahne önizlenir, film tek MP4 olarak panelde oynar ve indirilir. İşi alt süreç yürütür; kapatmadan izlenir, durdurulabilir.
- Kaydederken modelin desteklemediği girdi (örn. Seedance ile video dönüştürme) daha kaydedilirken reddedilir; geçersiz kayıt eski dosyayı bozmaz.

## [1.10.0] — 2026-11-01 — AI Stüdyo

### Eklenenler
- **`studyo.js` (AI Stüdyo):** kendi fotoğraflarından ve videolarından kısa animasyon/kısa film. 7 hazır stil (çizgi film, anime, 3D animasyon, kil animasyon, suluboya, çizgi roman, gerçekçi). Fotoğraf `referans` (sahne stilde yeniden çizilir, yüz korunur) ya da `ilk-kare` (fotoğraf olduğu gibi canlanır) olarak gider; kendi videon (https/YouTube) hareketi korunarak stile çevrilir; yerel videodan kare alınır. Fotoğraflar 1536 px JPEG'e küçültülür (HEIC/BMP dahil). `kur` klipleri seçilen oranda birleştirir, isteğe bağlı müzik ekler.
- `lib/vidiq-klip.js`: ilk kare / referans fotoğraf / video girdisi, `wan-3` modeli; model desteklemiyorsa istek gönderilmeden reddedilir. Aynı istem farklı fotoğrafla ayrı çekim sayılır.

- **Serbest stil ve metin modu:** `--stil serbest` ek stil eklemez; `node studyo.js sahne <ad> "istem"` fotoğrafsız, yalnız yazılan istemden video üretir. Yani yalnız çizgi film değil, istenen her AI video.

### Notlar
- Ücretlidir (vidIQ kredisi): varsayılan kuru çalışma, `--butce` ve `--onay` korumaları `vidiq-klip.js` ile aynı. Testler sahte vidIQ ile; gerçek krediyle henüz denenmedi.

## [1.9.4] — 2026-10-28 — AI klipleri sahneye yerleştirme

### Eklenenler
- **`klip-yerlestir.js`:** `vidiq-klip.js` ile inen AI klipleri `Voice/KLIPLER.txt` sırasıyla (satır i → sahne i) `Visuals/<sahne>/00-ai-*.mp4` olarak koyar; `video-yap.js` onları sahnenin başına yerleştirir. Ücretsiz, ağ kullanmaz, tekrar çalıştırılabilir (`--yeniden` ile eski AI klibin yerine yenisini koyar); sahne/satır sayısı uyuşmazsa uyarır.

## [1.9.3] — 2026-10-26 — README ve küçük iyileştirmeler

### Değişenler
- **README** 1.3.0'dan beri güncellenmemişti: başa İngilizce hızlı başlangıç, yeni görsel/ses kaynakları, anahtar tablosu (Unsplash, Smithsonian, Europeana, FAL_KEY), Edge çökünce sistem sesi yedeği, yeni araçlar (kaynak-dene, video-bul, vidiq-klip, film, dudak-*), 15 dilli arayüz notu.
- Panelde ses motoru seçimine **VoxCPM2** ve **işletim sistemi sesi** eklendi (sunucu zaten kabul ediyordu).
- `vidiq-klip.js` en-boy oranını verilmediğinde işin `konu.json` biçiminden alır (uzun video 16:9, diğerleri 9:16).

## [1.9.2] — 2026-10-26 — Bulut dudak senkronu

### Eklenenler
- **`dudak-fal.js`:** `film.js kur --dudak` için bulut sağlayıcı: fal.ai LatentSync (ByteDance), kullanıcının kendi `FAL_KEY` anahtarıyla. Yerel GPU, Python ya da MuseTalk kurulumu gerekmez (RTX 50 serisi dahil her makinede çalışır). Ücretli ve her sahne için ayrı istek olduğundan çıktı varsa yeniden istenmez. Sonuç yalnız fal alan adlarından, https ile ve gerçek mp4 doğrulamasıyla indirilir. `film.js`, `DUDAK_KOMUT` boşsa `FAL_KEY` → bulut, `MUSETALK_KOK` → yerel sırasıyla seçer. Henüz gerçek anahtarla denenmedi (testler sahte fal ile).

## [1.9.1] — 2026-10-26 — Dudak senkronu bağlantısı

### Eklenenler
- **`dudak-musetalk.js`:** `film.js kur --dudak` için MuseTalk (MIT, ticari kullanım serbest) sarmalayıcısı. `.env`: `MUSETALK_KOK`, isteğe bağlı `MUSETALK_PYTHON`, `DUDAK_KOMUT=node dudak-musetalk.js --video {video} --ses {ses} --cikti {cikti}`. MuseTalk komut satırında video/ses almadığı için geçici yaml yazar, `scripts.inference`'i çağırır, sonucu kopyalar. `node dudak-musetalk.js --kontrol` kurulumu ve **GPU/torch uyumunu** denetler: RTX 50 (sm_120) kartta MuseTalk'in sabit torch 2.0.1/cu118'i çalışmaz, bunu baştan açık hatayla söyler. MuseTalk'i depo indirmez/kurmaz.

## [1.9.0] — 2026-10-26 — Film/dizi hattı, Edge sesi onarımı, 44 hata düzeltmesi

### Eklenenler
- **`node film.js` (film / kısa dizi):** `yeni` (bibliya.json: karakterler, ses, görünüm + örnek bölüm), `klipler` (vidiq-klip için `KLIPLER.txt`; karakter görünümü her istemde tekrarlanır), `ses` (her diyalog satırı karakterinin sesiyle), `kur` (sahne klipleri + ses → dikey 1080×1920 bölüm MP4 + gömülü altyazı). Klip yoksa `--yer-tutucu` ile düz renkle denenebilir. Dudak senkronu dış araçla: `.env` `DUDAK_KOMUT` (MuseTalk/LatentSync'i kullanıcı kurar; depo indirmez).
- `ws` bağımlılığı açıkça bildirildi (Edge sesi onarımı doğrudan kullanıyor; zaten `msedge-tts` ile geliyordu).

### Düzeltilenler (denetimde doğrulanan hatalar)
- **Edge sesi** yeniden çalışıyor (el sıkışmada dört başlık gerekiyordu). Windows sistem sesi artık OneCore Türkçe sesi (Tolga) kullanır; dile uygun ses yoksa yanlış dille OKUMAZ, açık hata verir. macOS'ta dile uygun ses seçilir.
- **Görsel kaynakları:** AIC görselleri 403 veriyordu (indirme başlığı), Cleveland adayları "çözünürlük düşük" diye eleniyordu (print görseli), Unsplash 1080 px indiriyordu ve atfı listeye girmiyordu, Europeana API anahtarı kaynak adresiyle ATIF/YouTube açıklamasına sızıyordu, Smithsonian/Europeana görselleri aynı anahtara düşüp iş başına 1'e iniyordu, Met 404 kimliğinde kaynağı kapatıyordu, sanat sahnesi tespiti çok genişti. `kaynak-dene` artık görseli gerçekten indirip doğrular.
- **Stok video:** atıf kalıcı yazılır, alakasız klip seçimi sıkılaştı, panelde görünür ve silinebilir, ATIF.txt'ye girer, sahneler arası tekrar yok.
- **vidIQ klip:** bütçe her klip öncesi denetlenir, başarısız iş kilidi kalkar, ödenmiş yarım iş alınabilir, bozuk `klipler.json`'da durur, çözünürlük/oran değişimi yeni istek sayılır.
- Arayüz dili: `value`'suz `<option>` metni çevrilince Ai Infapp karakter kaydı bozuluyordu.

## [1.8.0] — 2026-10-25 — 15 dilde arayüz

### Eklenenler
- **Arayüz 15 dilde:** Türkçe, İngilizce, İspanyolca, Almanca, Fransızca, İtalyanca, Portekizce, Rusça, Felemenkçe, Lehçe, Japonca, Korece, Arapça (yerleşim soldan sağa kalır, metin sağdan sola çizilir), Hintçe ve Çince. Panel, Video indirici ve Ai Infapp sayfalarının sağ altındaki dil kutusundan seçilir; ilk açılışta tarayıcı dili desteklenen bir dilse o seçilir, değilse İngilizce. Seçim tarayıcıda hatırlanır.
- Çeviri **çalışma zamanında, metnin kendisiyle eşleşerek** yapılır (`panel-public/dil.js`): kaynak kodda sarmalayıcı yoktur. Metin düğümleri, `placeholder`/`title`/`aria-label`/`alt` nitelikleri, sayfa başlığı, `alert/confirm/prompt` ve sunucudan gelen hata/çözüm mesajları çevrilir. Başında ya da sonunda sayı olan metinler ("11 görsel") ve sayı içeren şablonlar ("Ölçü 3 adı") da çevrilir. Çeviri yoksa Türkçe kaynak görünür.
- Sözlükler: `diller/<kod>.json` (kaynak katalog) ve her uygulamanın `diller/<kod>.js` dosyası. `npm run dil:cikar` metinleri çıkarır, `npm run dil:yay` uygulamalara dağıtır.
- Kapsam: arayüz metinleri ve panelde görünen sunucu mesajları. Komut satırı betiklerinin mesajları, `uretim/` çıktıları ve belgeler (README, AGENTS) Türkçe kalır; senaryo ve video dili zaten `--dil` ile ayrıca seçilir.

## [1.7.0] — 2026-10-25 — Stok video klipleri

### Eklenenler
- **`node video-bul.js <iş>`:** sahnelere Pexels ve Pixabay'dan alakalı STOK VİDEO klibi ekler (ücretsiz `PEXELS_KEY` / `PIXABAY_KEY`). `gorsel-bul.js`'ten sonra, `video-yap.js`'ten önce çalışır. Klip `Visuals/<sahne>/00-stok-*.mp4` olarak yazılır, sahnenin başına konur, döngülenir ve kadraja kırpılır. Atıf `Visuals/video-atif.json`'a yazılır ve `YAYIN-PAKETI.md`'ye girer.
- Kurgu artık `Visuals/` içindeki mp4 dosyalarını da sahne görseli olarak kabul eder (zoom efekti uygulanmaz; kapak yine durgun görselden yapılır).

## [1.6.0] — 2026-10-25 — vidIQ ile AI klip aracı

### Eklenenler
- **`node vidiq-klip.js <iş>`:** vidIQ'nun Seedance, Veo, MiniMax, Kling modelleriyle AI video klibi üretir (`Voice/KLIPLER.txt` ya da `--istem`). KREDİ HARCAR, bu yüzden sıkı korumalı: varsayılan **kuru çalışma** (maliyeti yazar, hiçbir şey başlatmaz), harcama için `--onay`; `--butce` zorunlu ve tahmin bütçeyi aşarsa iş hiç başlamaz; çalışırken GERÇEK bakiye farkı izlenir, bütçe dolunca durur; aynı istem ikinci kez üretilmez (`Clips/klipler.json`), yarım kalan iş yeniden başlatılmaz. Varsayılan model en ucuz ailedir (MiniMax-H3 768p). Ücretler üst sınır tahminidir, kesin ücret gönderimde belli olur.
- Not: canlı üretim yolu henüz gerçek kredi ile denenmedi (testler sahte vidIQ kullanır); ilk kullanımda tek bir 4 sn'lik klipten başla.

## [1.5.0] — 2026-10-25 — Her makinede çalışan ses, canlı kaynak yoklaması

### Eklenenler
- **Sistem sesi motoru (`--motor sistem`).** Windows (System.Speech), macOS (`say`) ve Linux (`espeak-ng`) sesi: kurulum, anahtar ve internet gerektirmez. `otomatik` sırada EN SONDA durur: Edge sesi servisi kapanırsa (25 Ekim 2026'da Microsoft tarafında WebSocket el sıkışması reddediliyordu, `msedge-tts` son sürümüyle de) video artık sessiz kalmak yerine sistem sesiyle biter. Kalite orta; daha iyisi için VoxCPM2, Piper ya da Azure.
- **`npm run kaynak-dene`:** her görsel kaynağına gerçek bir arama yapıp çalışıp çalışmadığını gösterir. Servis API'sini değiştirdiğinde sorun iş ortasında değil burada yakalanır.

### Düzeltilenler
- The Met: eski `v1/search` ucu 1 Ekim 2026'da kapanmıştı (HTTP 410); `v1.1/search`'e geçildi.
- Art Institute of Chicago `AIC-User-Agent` başlığı olmadan 403 veriyordu.
- Müze aramaları "Rembrandt Night Watch painting" gibi uzun ifadelerde sonuç vermiyordu (tüm kelimeleri VE ile ister): dolgu kelimeler atılıp en çok 3 kelime aranır.
- Rijksmuseum ve Europeana kaynak kaydına eklenmemiş, akışta hiç çalışmıyordu; kayıt bütünlüğü testi eklendi.

## [1.4.1] — 2026-10-25 — Rijksmuseum ve Europeana

### Eklenenler
- **Rijksmuseum** (anahtarsız): yalnızca kamu malı / CC0 işaretli görseller, 1920 px IIIF.
- **Europeana** (`EUROPEANA_KEY`, ücretsiz): yalnızca açık lisanslı eserler (CC0, kamu malı, CC BY, CC BY-SA); NC/ND ve "telif saklı" kayıtlar elenir. Sanat/tarih sahnelerinde devreye girer; panelde Kaynaklar'dan açılıp kapatılır.

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
