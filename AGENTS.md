# BU DOSYAYI ÖNCE OKU — yapay zekâ ajanı için kullanım kılavuzu

Bu depo iki iş yapar. Kullanıcı bir istek yazar, sen aşağıdaki akışı **doğrudan uygularsın**.
"Nasıl yapalım, nasıl kullanalım?" diye SORMA; kılavuz burada. Belirtilmeyen her ayrıntıyı aşağıdaki kurallarla
kendin seç. Yalnızca kılavuzun "kullanıcıya sor" dediği yerlerde ya da konu/tarif hiç yoksa tek kısa soru sor.

1. **YouTube / Shorts / Reels / TikTok videosu**: konudan bitmiş MP4 + altyazı + kapak + yayın paketi.
2. **AI influencer (Ai Infapp)**: sanal bir insan yaratıp kilitler, her istemde aynı kimliği korur;
   sahne, prompt, görsel ve paylaşım metni üretir. Ayrıca Etsy baskı tasarımı, fotoroman, reklam görseli.

Örnek istekler:
- "Ay neden hep aynı yüzünü gösterir, 40 saniyelik İngilizce Shorts yap"
- "Kara delikler hakkında 8 dakikalık Türkçe uzun video hazırla"
- "35 yaşında İstanbullu bir fitness influencer yarat, spor salonunda 3 foto ve Instagram metni üret"
- "Etsy için kedi temalı duvar posteri tasarla"

## 0. Kurulum (bir kez)

```bash
node -v                       # en az 22 olmalı; değilse kullanıcıya söyle
node ff-yol.js                # ffmpeg bulunamazsa 0 dışı çıkış kodu verir
npm ci --ignore-scripts       # paketler (node_modules yoksa)
npm run egitim                # eğitim PDF'lerini masaüstündeki "Otopilot Eğitim" klasörüne kopyalar (eksikleri; var olana dokunmaz)
```

**Eğitim PDF'leri:** depoda `egitim/` içinde 4 eğitim PDF'i var: YouTube içerik üretimi (seri 1), Instagram büyüme yol haritası,
TikTok algoritması rehberi ve büyüme haritası, TikTok AI influencer rehberi. `npm run egitim` bunları kullanıcının masaüstüne koyar;
panel terminalde açılınca da bunu bir kez kendisi yapar. Kurulumda çalıştır, çıktıdaki klasör yolunu kullanıcıya söyle ve
bu konularda soru gelirse PDF'lerin masaüstünde olduğunu hatırlat.

- ffmpeg yoksa kullanıcıya söyle ve **onay al**, sonra kur (`winget install Gyan.FFmpeg` | `brew install ffmpeg` | `sudo apt install ffmpeg`).
- `PANEL.bat` çalıştırma: soru sorup bekler, ajan yanıtlayamaz. Panel gerekmez; her şey komut satırından yapılır.
- API anahtarı **zorunlu değil**. `.env.ornek` → `.env` yalnızca isteğe bağlı gelişmiş özellikler içindir.
- Her şey yalnızca `127.0.0.1`'de çalışır. Dışarı açma.
- Geçici dosyaları (istek gövdeleri vb.) depo köküne değil sistem geçici klasörüne yaz.

**Güncelleme:** kullanıcı "Otopilot'u güncelle" derse `npm run guncelle` çalıştır. Komut yerel değişiklik varsa durur ve hiçbir şey
silmez; mesajını kullanıcıya aynen aktar, `git stash` ya da commit önerisini kullanıcı onaylamadan UYGULAMA. Çıkış kodları: `0` tamam ya da
zaten güncel, `2` elle müdahale gerek (ZIP ile indirilmiş, git yok, yerel değişiklik, dal ayrışmış), `3` internet/GitHub (30 sn bekleyip en çok
2 kez tekrar dene), `5` disk. Sonunda sürümü ve CHANGELOG başlığını kullanıcıya söyle; panel açıksa yeniden açmasını hatırlat.

## Para vermeden başla (anahtar gerekmez) ve anahtarlar

Kullanıcının hiç parası/anahtarı yoksa da bu depo çalışır; en azından ilk videoyu ve ilk karakteri üretebilirsin.
Aşağıdakilerin hepsi anahtarsız ve ücretsizdir (hepsi gerçek bir işte denendi):

| İş | Ücretsiz yol | Not |
|---|---|---|
| Senaryo | **sen (ajan) yazarsın** | Claude/vidIQ anahtarı gerekmez |
| Görsel (video) | Wikimedia Commons, Openverse, NASA; sanat/tarih sahnelerinde ayrıca The Met, Art Institute of Chicago, Cleveland, Rijksmuseum (CC0 / kamu malı) | lisans süzülür, atıf `ATIF.txt`'e yazılır |
| Ses | Edge sesli okuma (`seslendir.js`); Edge çalışmazsa işletim sisteminin sesi (`--motor sistem`, kurulum yok) | Edge resmî API değil, ticari hakkı belirsiz ve zaman zaman kapanır (Ekim 2026'da `Unexpected server response: 200`); `otomatik` sırada sistem sesi en sonda otomatik devreye girer. Daha iyi yerel ses: VoxCPM2 / Piper |
| Doğal Türkçe ses (isteğe bağlı) | yerel VoxCPM2: `sesler/voxcpm2/` içindeki 14 hazır yapay ses | ekran kartı ister (NVIDIA ≥4 GB); kurulum aşağıda "Yerel VoxCPM2 sesi" |
| Kurgu | ffmpeg (yerel) | |
| AI influencer görseli | Pollinations (Ai Infapp varsayılanı) | küçük, filigranlı, ara sıra yavaş/`402`; tam ücretsiz ve sınırsız seçenek: kendi bilgisayarında AUTOMATIC1111/Forge ya da ComfyUI (GPU ister) |
| Karakter, sahne, prompt, paylaşım metni | yerel, API yok | |
| Etsy tasarımı, reklam, fotoroman sayfası | yerel vektör, API yok | PNG/PDF için Chrome ya da Edge |

**Ücretsiz kayıtla kaliteyi artıran anahtarlar** (hepsi isteğe bağlı; ücretsiz kademelerin sınırları değişir, kayıt sayfasından doğrula):
Pexels, Pixabay, Unsplash, Smithsonian (daha isabetli stok görsel: `PEXELS_KEY`, `PIXABAY_KEY`, `UNSPLASH_KEY`, `SMITHSONIAN_KEY`, `EUROPEANA_KEY`), Cloudflare Workers AI / Together / Hugging Face (AI görsel:
`CF_ACCOUNT_ID`+`CF_API_TOKEN`, `TOGETHER_KEY`, `HF_TOKEN`), Leonardo (günlük ücretsiz kredi, Ai Infapp sağlayıcısı), vidIQ (ücretsiz planda kredi verir; aşağıdaki "vidIQ ile video üret").
Claude (Anthropic) anahtarı ücretlidir; gerekmez, çünkü senaryoyu sen yazarsın.

**Anahtar nereye girilir:** `.env.ornek` dosyasını `.env` olarak kopyalayıp içine yaz (`.env` repoya girmez) ya da panelde **Kaynaklar** sekmesi.
Ai Infapp'in görsel sağlayıcısı için tarayıcıdaki **Ayarlar** ekranı ya da `POST /api/saglayici`. Kullanıcı anahtarı sana verirse yalnızca bu yerlere yaz;
sohbette tekrarlama, commit'leme. Her kullanıcı kendi anahtarını bağlar.

## 1. YouTube videosu — adım adım

İş adı: küçük harf, rakam, tire (ör. `ay-neden-ayni-yuz`). Çıktı `uretim/<is>/` altına gider.

```bash
node yeni-is.js <is> --baslik "Başlık" --dil en --format short
#   --dil tr|en|es|de|fr   --format short|long|reels|tiktok   --sure <dakika>   --kanal "KANAL ADI"
```

**Belirtilmeyenler için karar ver, sorma:**
- `--dil`: kullanıcının istediği videonun dili; belirtmediyse isteği yazdığı dil.
- `--format`: "Shorts/kısa/dikey" → `short`; "Reels" → `reels`; "TikTok" → `tiktok`; hiçbiri yoksa `long`.
- Süre: `short` ≈ 40 sn (verilen süreye göre ayarla, 15-60 sn arası uygun); `long` için `--sure 8` ver (varsayılan 15 dk çok uzundur).
- Kanal adı: kullanıcı verdiyse `--kanal`. Vermediyse `uretim/<is>/konu.json` içinde `"intro": 0, "outro": 0, "markaKose": 0`
  yap (aksi hâlde videoya "KANALIM" yazısı basılır).
- `yeni-is.js` çıktısı "sıradaki adım: senaryo-claude.js" der; anahtar yoksa o adımı atla, senaryoyu kendin yaz.

**Senaryoyu SEN yaz** (anahtar gerekmez) ve şu dosyaya kaydet: `uretim/<is>/Voice/SESLENDIRME-TAM-METIN.txt`
- Yalnızca okunacak düz anlatım metni. Başlık, sahne yönergesi, köşeli parantez, emoji YOK.
- Paragraflar boş satırla ayrılır; her paragraf bir sahne adayı olur (40 sn için 4-6 paragraf). Dil `--dil` ile aynı olmalı.
- Süre: İngilizce dakikada ~150 kelime (40 sn ≈ 100 kelime), Türkçe ~115 kelime (8 dk ≈ 900 kelime).
  İlk cümle kanca olsun, son cümle takip çağrısı. Doğru bilgi yaz; emin olmadığın rakam/iddiayı yazma.
- (Claude/vidIQ anahtarı varsa alternatif: `node senaryo-claude.js <is>`; ücretlidir, önce maliyeti söyle.)

**Görsel aramalarını da SEN yaz:** senaryodan hemen sonra, `gorsel-bul.js`'ten önce `uretim/<is>/Voice/ARAMALAR.txt` dosyasını oluştur.
- Senaryodaki her paragraf için bir satır yaz, sıra paragraflarla aynı olsun. Boş satırlar ve `#` ile başlayan satırlar sayılmaz. Dosyayı UTF-8 yaz.
- Her satır **İngilizce, somut, görselleştirilebilir** bir arama olsun. Video Türkçe olsa da İngilizce yaz: kaynakların başlıkları İngilizcedir
  (Türkçe "Dünya" araması Dünya Kupası bileti getirir).
- Soyut ya da dolgu kelime yazma ("why", "same", "secret" olmaz). Nesne, yer, kişi ya da olay yaz: `full moon night sky`, `Galata Tower Istanbul`.
- `|` ile 1-2 yedek arama ekleyebilirsin. Örnek: `full moon night sky | moon surface closeup` / `Earth and Moon from space` / `far side of the Moon | Luna 3 probe`.
- Öncelik: `--sahne N --ara` > konu.json `sahneKelimeleri` > `ARAMALAR.txt` > otomatik. Satır sayısı tutmazsa ya da satır Türkçe görünürse uyarı verilir.

```bash
node kaynak-dene.js          # görsel kaynaklarının hangisi çalışıyor? (canlı yoklama; sorun olursa önce bunu çalıştır)
node gorsel-bul.js <is>       # ücretsiz kaynaklardan (Wikimedia, Openverse, NASA…) görsel bulur, lisans süzer
node seslendir.js <is>        # ücretsiz Edge sesi, paragraf paragraf (+ zamanlama)
node video-yap.js <is>        # kurgu + altyazı + kapak + yayın paketi
```

**Yerel VoxCPM2 sesi (isteğe bağlı, ücretsiz, ekran kartı ister).** `sesler/voxcpm2/` içinde 14 hazır yapay ses var. 7'si Türkçe:
`tok_anlatici`, `belgesel_hanim`, `cekici_spiker`, `gizemli_bilge`, `haber_spikeri`, `masal_cadisi`, `yasli_bilge`. 7'si yerli anlatıcı:
`anlatici_en`, `anlatici_de`, `anlatici_es`, `anlatici_fr`, `anlatici_ja`, `anlatici_ru`, `anlatici_zh`. Lisans Apache-2.0
(kaynak: https://github.com/alexturkey/voxcpm2-turkce-ses-tasarimi). Motor bu depoda yok; bir kez ve **kullanıcı onayıyla** kurulur
(NVIDIA ekran kartı ≥4 GB, 64-bit Python 3.10–3.13, ~10 dk, ~3,7 GB indirme):
`git clone https://github.com/alexturkey/voxcpm2-turkce-ses-tasarimi.git C:\voxcpm2`, o klasörde
`powershell -NoProfile -ExecutionPolicy Bypass -File scripts\kur.ps1 -Kok C:\vox` (son satır `KURULUM_OK` olmalı), sonra `.env` dosyasına
`VOXCPM_KOK=C:\voxcpm2` (klonlanan klasör; `-Kok` klasörü değil). Kontrol: `node seslendir.js --liste-sesler`.
Kullanım: `node seslendir.js <is> --ses voxcpm:tok_anlatici`, `--motor voxcpm` (dile göre varsayılan ses) ya da `konu.json` içinde
`"ses": "voxcpm:anlatici_en"`. Kurulu değilken `--motor voxcpm` çıkış `2` ve kurulum adımlarını verir; `otomatik` motor Edge'e düşer.
Yavaştır (eski kartta 1 sn ses ≈ 2 sn) ve aynı anda tek iş çalıştırır. Türkçe ve İngilizce sayılar yazıya çevrilir; diğer dillerde sayıları
yazıyla yaz. Sesler yapaydır, gerçek kişi taklidi değildir; yayında yapay zekâ sesi olduğunu belirtmesini öner.

**Görselleri KONTROL ET** (atlama): `uretim/<is>/Visuals/manifest.json` her sahne için aranan ifadeyi (`aramalar`), aramanın
nereden geldiğini (`aramaKaynagi`) ve paragrafı (`paragraflar`) gösterir. `"alakaZayif": true` işaretli görseller, başlığı aramayla eşleşmediği
hâlde sahne boş kalmasın diye alınmıştır. Otomatik arama bazen alakasız çıkar (ör. "Billions" kelimesinden dizi karesi).
Zayıf sahneyi düzelt, sonra `video-yap.js` çalıştır:

```bash
node gorsel-bul.js <is> --sahne 3 --ara "far side of the moon"
```

İstersen sahnelere stok video klibi ekle (`PEXELS_KEY` ya da `PIXABAY_KEY` varsa): `node video-bul.js <is>`, sonra `node video-yap.js <is>`; anahtar yoksa açık bir mesajla durur. Görüntü okuyabiliyorsan `Visuals/NNN-*/01.jpg` dosyalarına bak. Tüm videoyu yeniden kurmak için `video-yap.js <is> --yeniden`.

**Hata olursa** (mesaj Türkçe ve çözümü söyler): çıkış `3` (ağ/servis) → 30 sn bekleyip aynı komutu en çok 2 kez yeniden çalış, ilerleme korunur;
`4` (yetersiz sonuç) → mesajdaki çözümü uygula (görsel azsa `--sahne N --ara`; paragraf düştüyse `seslendir.js`'i yeniden çalıştır);
`2` (girdi/ayar) → dosyayı düzelt; `5` disk ya da bellek; `6` aynı iş zaten çalışıyor; `7` maliyet sınırı. Tam liste: `README.md` "Panelsiz kullanım".
Bellek hatasında (`bellek_yetersiz`, "Cannot allocate memory") render o adımı düşük bellek moduyla zaten bir kez kendiliğinden denemiştir:
kullanıcıya açık programları kapatmasını söyle, `.env`'e `RENDER_DUSUK_BELLEK=1` (yine olmazsa `2`) yaz ve aynı `video-yap.js` komutunu
tekrar çalıştır; biten ara dosyalar korunur.
Ayar alanlarının tam listesi: `KONU-JSON.md` (geçiş, müzik, altyazı biçimi, ses vb. `uretim/<is>/konu.json`).

Seslendirmede `403` alırsan: `npm install msedge-tts@latest --ignore-scripts --no-save` çalıştır (Microsoft'un ücretsiz sesi
zaman zaman kural değiştirir), `seslendir.js`'i yeniden başlat; tamamlanan paragraflar tekrar üretilmez.
Edge `Unexpected server response: 200` ile düşerse bu paket güncellemesiyle düzelmez (Microsoft el sıkışmayı reddediyordur): `node seslendir.js <is> --motor sistem` ile işletim sistemi sesini kullan, tamamlanan paragraflar korunur; `otomatik` motor bunu zaten kendiliğinden yapar.

**Bitince kullanıcıya şunları ver** (dosya yollarıyla):
- `uretim/<is>/Videos/<is>.mp4`, `<is>.srt`, `<is>-kapak.jpg`
- `uretim/<is>/YAYIN-PAKETI.md` (başlık, açıklama, bölümler, etiketler, görsel atıfları). Açıklamaya atıflar yapıştırılmalı.
- Uyarılar: YouTube'a yükleme otomatik değildir, kullanıcı yükler ve "değiştirilmiş/sentetik içerik" kutusunu işaretler.
  Ücretsiz Edge sesi resmî bir API değildir, ticari kullanım hakkı belirsizdir; gelir getiren kanal için `seslendir.js --motor azure` (kendi Azure anahtarıyla) önerilir.

Süre: 40 sn'lik kısa videoda toplam birkaç dakika (görsel ~1-2 dk, ses ~1 dk, kurgu ~30 sn).

## 1b. Film / kısa dizi (karakterli, diyaloglu, AI klipli)

Anlatımlı video yerine karakterlerin konuştuğu dikey kısa dizi için `film.js` (ayrıntı dosyanın başındaki yorumda):

```bash
node film.js yeni <dizi> --ad "Dizi Adı"     # bibliya.json (karakter, ses, görünüm) + bolum-001.json örneği; ikisini kullanıcının fikrine göre YAZ
node film.js ses <dizi> 1                     # diyalog satırları karakter seslerinden (ücretsiz motorlar)
node film.js klipler <dizi> 1                 # Voice/KLIPLER.txt; sonra: node vidiq-klip.js <dizi>-b001 --butce <kredi>  (kuru çalışma; KREDİ HARCAR, onay al)
node film.js kur <dizi> 1                     # klipler + ses + altyazı -> uretim/<dizi>/bolum-001.mp4
```

Karakter yüzü her klipte hafifçe kayar (AI video sınırı): `gorunum` alanını her istemde tekrar eder, aynı karakterin referans görselini Ai Infapp'ten alıp sağlayıcıya ilk kare olarak verebilirsin. Dudak senkronu için MuseTalk bağlayıcısı hazır (`dudak-musetalk.js`, `.env.ornek` bölümü "FILM"): kullanıcı MuseTalk'ı kurup `MUSETALK_KOK` ve `DUDAK_KOMUT` yazarsa `node film.js kur <dizi> 1 --dudak` çalışır; önce `node dudak-musetalk.js --kontrol` (RTX 50 kartlarda torch >= 2.7 cu128 ayrı ortam gerekir). Klip yokken `--yer-tutucu` yalnız deneme içindir. 100 bölüme baştan girme: önce 3 bölümlük pilotla maliyet ve kaliteyi ölç.

## 2. AI influencer (Ai Infapp) — HTTP API ile

**Sunucu:** önce `GET http://127.0.0.1:4200/api/durum` dene; yanıt veriyorsa zaten çalışıyordur, yenisini başlatma.
Yoksa `node ai-infapp/server.js`'i arka planda başlat (port: `AI_INFAPP_PORT`), `/api/durum` yanıt verene dek en çok 10 sn bekle.
İşin bitince kendi başlattığın sunucuyu kapat.

Tüm uçlar JSON konuşur. Gövdeyi geçici klasörde bir dosyaya yazıp gönder:
`curl.exe -s -X POST http://127.0.0.1:4200/api/... -H "content-type: application/json" --data-binary @govde.json`
(Windows PowerShell'de `curl` değil `curl.exe`.) Veriler `ai-infapp/data/` içindedir (anahtarlar dahil): **asla commit etme, sohbette gösterme.**

| Adım | Uç | Not |
|---|---|---|
| Durum | `GET /api/durum` | karakter var mı, hangi görsel sağlayıcı aktif |
| Sorular | `GET /api/sorular` | her sorunun `key`, `options`, `required` alanı; **seçenek metinlerini aynen kopyala** (çoğu Türkçe karaktersiz, bazıları `İzmir`, `Kaslı` gibi Türkçe karakterli) |
| Karakter | `POST /api/karakter` `{"answers":{…}}` | zorunlu alanlar aşağıda |
| Sahneler | `POST /api/sahneler` `{"count":3}` | hazır sahne önerileri |
| İstekten sahne | `POST /api/brief` `{"text":"plajda bir foto"}` | serbest isteği `scene` nesnesine çevirir |
| Prompt | `POST /api/prompt` `{"scene":{…}}` | kimliği sabit tutan prompt |
| Görsel | `POST /api/uret` `{"scene":{…},"count":1}` | `scene`'i `brief`/`sahneler` yanıtından aynen ver. Dosya `ai-infapp/data/images/`; yanıttaki `images[].filename` ve `export` alanı yolu verir |
| Paylaşım metni | `POST /api/metin` `{"platform":"instagram","scene":{…}}` | açıklama + etiketler; `platform` değerleri `GET /api/metin/platformlar` |
| Haftalık plan | `GET /api/plan` | |

**Karakter oluştururken sorma, seç:** kullanıcının tarifine uyan her alanı o tariften al; tarifte olmayanları tarifle çelişmeyecek
şekilde SEN seç. Zorunlu alanlar: `gender, region, ethnicity, skinTone, eyeColor, hairColor, hairStyle, age, bodyType,
measurements{height_cm,weight_kg}, zodiac, education, interests (en az 2)`. Yaşadığı yer belirtildiyse `continent, country, cityName`
(ve `hometownMode`) alanlarını da ver; boş bıraktığın hayat soruları rastgele doldurulur. Doğrulanmış örnek:
`{"gender":"Kadin","region":"Akdeniz","ethnicity":"Akdeniz","skinTone":"Cok acik (porselen)","eyeColor":"Kahverengi","hairColor":"Siyah","hairStyle":"Trasli / cok kisa","age":27,"bodyType":"Ince / zayif","measurements":{"height_cm":168,"weight_kg":56},"zodiac":"Koc","education":"Universite (lisans)","interests":["Fitness","Moda"]}`

**409 (zaten kilitli karakter var):** kullanıcıya sor — mevcut karakterle devam mı (yeni sahne/içerik), yoksa sıfırlama mı.
Sıfırlama yalnız kullanıcı onaylarsa: `POST /api/sifirla {"confirm":"SIFIRLA"}` (veriyi arşive taşır; `"hard":true` kalıcı siler).

Vesikalık seti (8 açı, `POST /api/referans/uret`) zorunlu değil; kullanıcı istemedikçe ve sağlayıcı referans görseli desteklemedikçe atla.

Dürüstlük notları (kullanıcıya da söyle):
- Ai Infapp görseli **kendisi üretmez**; bağlı sağlayıcıdan çeker. Varsayılan Pollinations ücretsiz ve anahtarsızdır ama kalitesi
  orta, filigranlı, ara sıra yavaş ya da `402` verir (otomatik tekrar dener). Kaliteli ve yüz tutarlı sonuç için kullanıcı kendi
  sağlayıcı anahtarını bağlar (`GET /api/saglayicilar` seçenekleri gösterir, `POST /api/saglayici` bağlar). Anahtarı kullanıcıdan
  iste, ama sohbette tekrar yazma ve dosyaya kaydetme; kullanıcı isterse tarayıcıdaki **Ayarlar** ekranından kendisi girer.
- Yüz tutarlılığı sağlayıcıya bağlıdır; ayrıntı `ai-infapp/README.md` ("Dürüst olalım").
- Gerçek kişi, ünlü ya da marka taklidi yapma; karakter tamamen kurgusaldır. Paylaşımda yapay zekâ ürünü olduğunu belirtmesini öner.

Diğer stüdyolar (Etsy baskı tasarımı, fotoroman, reklam görseli): aynı sunucuda çalışır. Etsy ve fotoroman `ai-infapp/README.md`
içindeki "Etsy" ve "Fotoroman" bölümlerinde anlatılır; reklam/grafik tasarım için `ai-infapp/src/studios/reklam/index.js`'e bak.
Uçlar `ai-infapp/server.js` ve `ai-infapp/src/studios/*/index.js` içindedir. PNG/PDF çıktısı için Chrome ya da Edge kurulu olmalı.

## vidIQ ile video üret (kullanıcının vidIQ kredisiyle; Seedance, Veo, Kling…)

Bu yol **yalnızca kullanıcı isterse** kullanılır (ör. "vidIQ ile üret", "Seedance ile şu promptla klip yap", prompt verip AI video isterse).
İstemedikçe ücretli yola girme; varsayılan, ücretsiz hattır (bölüm 1). Kullanıcının vidIQ hesabı ve vidIQ MCP bağlantısı ajanında kuruluysa
(`vidiq_*` araçları görünür) videoyu depodaki hat yerine doğrudan vidIQ'nun araçlarıyla üretebilirsin. **Bu yol bu depoda henüz gerçek kredi ile uçtan uca denenmedi:** ilk kullanımda 4 saniyelik tek bir klipten başla.

**Hazır araç (önerilen):** `node vidiq-klip.js <is> --butce 300` klipleri `Voice/KLIPLER.txt` dosyasından (her satır bir istem, `istem | 6` ile süre) okur, tahmini maliyeti yazar ve BAŞLATMAZ (kuru çalışma). Kullanıcı maliyeti onaylayınca `--onay` ekleyerek çalıştır; `--model`, `--cozunurluk`, `--sure`, `--oran` ayarlanabilir. Bütçe aşılmaz, aynı istem tekrar üretilmez, çıktı `uretim/<is>/Clips/` içine yazılır.

1. `vidiq_balance` (ücretsiz): kalan krediyi kullanıcıya söyle.
2. Senaryo: kendin yaz (ücretsiz) ya da `vidiq_generate_script` (dakika başına 1 kredi).
3. Ses: `vidiq_voiceover_list_voices` → `vidiq_voiceover_generate` (1000 karakter başına 14 kredi, çağrı başına en çok 5000 karakter). Kurgu için vidIQ sesi gerekir
   (kurgu aracı yalnız https adreslerini okur; yerel ses dosyası verilemez).
4. Klipler: `vidiq_generate_video` (`seedance-2-fast` 720p en ucuzu; `seedance-2` 720p/1080p; 1-15 sn; `aspectRatio` 9:16 ya da 16:9).
   Asenkrondur: dönen `mcpJobId` ile `vidiq_job_poll` (ücretsiz) tamamlanana dek sorgula. Maliyet = süre × modelin saniye ücreti × 20 kredi, gönderimde netleşir.
   **Birden çok klip başlatmadan önce toplam maliyeti kullanıcıya söyle ve onay al.** Aynı klibi tekrar başlatma (her başlatma ücretlidir); başarısız iş krediyi iade eder.
   Komut reddedilirse (`content_policy_rejected`, `invalid_duration`…) isteği değiştir, aynısını yeniden gönderme.
5. Birleştirme: `vidiq_compose` (sahneler, vidIQ sesi, müzik, altyazı stili; 4 sn başına 1 kredi, en fazla 240 sn) → `vidiq_job_poll` → `videoUrl`; dosyayı indirip `uretim/<is>/Videos/` altına kaydet.
6. Ücretsiz stok klip: `vidiq_generate_broll` (çağrı başına 1 kredi; fotoğrafçı atfı zorunlu).

vidIQ'yu depodaki betikler de kullanır (`VIDIQ_KEY`, senaryo/başlık/trend/performans); aynı vidIQ MCP anahtarı yeter.

## 3. Diğer

- **Video indirici** (`video-indirici/`, `node video-indirici/server.js`, 4190): yalnızca kullanıcının kendi ya da izinli içeriği için.
- **Panel** (`node panel.js`, 4173): tarayıcıdan kullanmak isteyen kullanıcı içindir; sen komut satırını kullan.

## 4. Kurallar

- Ücretli adım (Claude/vidIQ ile senaryo, ücretli görsel sağlayıcı) başlatmadan önce tahmini maliyeti söyle; varsayılan akış ücretsizdir.
- `.env`, `ai-infapp/data/`, `uretim/` repoda değildir (`.gitignore`). Anahtarları sohbete, koda ya da commit'e yazma.
- Telifli görsel/müzik uydurma; görsel atıflarını (`ATIF.txt`) açıklamadan çıkarma.
- Başkasının videosunu (ör. bir futbolcunun Shorts'larını) indirip kırparak/yeniden düzenleyerek yüklemeyi YAPMA; telif ihlalidir, kanal ceza alır.
  İstenirse şunu öner ve yap: konuyu araştır (`trend-ara.js`, `viral-analiz.js`, vidIQ: hangi Shorts neden tutmuş), sonra **özgün** video üret
  (kendi senaryon + kendi sesin + lisanslı/CC görsel, bu hat). Maç/yayın görüntüsü ücretsiz ve yasal kaynaklarda yoktur; kullanıcı izinli görüntüyü kendisi sağlarsa `video-seslendir.js` ile üzerine anlatım eklenir.
- Kodu değiştirirsen ilgili testi çalıştır: `npm run test:panel` · `npm run test:indirici` · `npm run test:aiinfapp`
  (tümü: `npm test`, 860+ test, birkaç dakika). Testler ağ çağrılarını sahteler, gerçek anahtara ya da ücretli servise dokunmaz.
- Harita: `*.js` kök betikleri = YouTube hattı · `lib/` ortak kod · `panel.js` + `panel-public/` panel · `video-indirici/` · `ai-infapp/` · `test/` · `uretim/` (çıktılar).
