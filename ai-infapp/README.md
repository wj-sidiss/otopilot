# Ai Infapp

Sıfırdan **bir insan** yaratır: yüzünden ailesine, şehrinden gelirine, günlük rutininden korkusuna kadar.
Karakteri **kilitler**, yüzünün 8 açıdan vesikalığını çıkarır ve ondan sonra ne istersen —
"spor salonunda foto", "kahve reklamı yap" — hep **aynı kimliği** istemde sabit tutar
(yüz tutarlılığı bağlanan sağlayıcıya bağlıdır; aşağıdaki "Dürüst olalım" notuna bak).

Dört stüdyo, tek araç:

| Stüdyo | Ne yapar | API gerekir mi |
|---|---|---|
| 🧬 **AI Influencer** | Karakteri yaratır, kilitler, kimliği her istemde sabit tutar (yüz tutarlılığı bağlanan sağlayıcıya bağlıdır) + **1.264 hazır sahne** | Kareler için evet |
| 📖 **Fotoroman** | Beş perdelik hikâye, konuşma balonları, sayfa düzeni, çekim senaryosu | **Hayır** (kareler hariç) |
| 🎨 **Etsy POD** | Baskıya hazır tasarım, listeleme metni, pazar araştırması, mağazaya taslak | Hayır |
| 📣 **Reklam** | Sosyal medya reklam ve duyuru görselleri | Hayır |

**Sıfır npm bağımlılığı** — `npm install` yok, `node_modules` yok, `package.json` içindeki
`dependencies` boş.

Ama "hiçbir şey gerekmez" demek doğru olmaz. Gerçek gereksinimler:

| Ne | Gerekli mi | Ne için |
|---|---|---|
| **Node.js 22+** | **Zorunlu** | Panelin kendisi |
| **Chrome veya Edge** | **PNG/PDF için zorunlu** | Fotoroman, Etsy ve Reklam stüdyoları tasarımı vektörden PNG'ye burada çevirir. Yoksa yalnızca SVG indirebilirsin. |
| Görsel üretim API'si | Hayır | Varsayılan Pollinations ücretsiz ve anahtarsız çalışır |
| Etsy API anahtarı | Hayır | Pazar araştırması ve mağazaya taslak gönderme |

Chrome/Edge zaten çoğu bilgisayarda kurulu; ayrıca bir şey indirmen gerekmiyor, panel sistemdekini
başsız modda kullanıyor. Ama **kurulu değilse baskı dosyası üretilemez** — panelde bunu söylüyor.

---

## Kurulum sırası — bunu takip et

Aşağıdakilerin **yalnızca ilk ikisi zorunlu.** Gerisi ne yapmak istediğine göre.

### 1. Çalıştır (zorunlu, 1 dakika)

Ai Infapp, [otopilot](https://github.com/wj-sidiss/otopilot) deposunun `ai-infapp/`
klasörüdür; kendi başına çalışır (bu klasör için `npm install` gerekmez).

```bash
git clone https://github.com/wj-sidiss/otopilot.git
cd otopilot/ai-infapp
```

Windows'ta `BASLAT.bat` dosyasına çift tıkla. macOS / Linux'ta `bash baslat.sh`.
Panel: **http://localhost:4200** — `npm install` yok, kurulum yok.

otopilot panelini zaten kullanıyorsan başlatmak daha da kolay: panelde
**Araçlar → Ai Infapp** düğmesine bas; panel sunucuyu başlatır ve
ayrı bir pencerede açar. Port'u değiştirmek istersen `AIINFAPP_PORT` ortam değişkenini ver:
panel ve `BASLAT.bat` / `baslat.sh` aynı değişkeni okur.

### 2. Chrome/Edge kurulu mu? (baskı dosyası üretecekseniz zorunlu)

Panel **Etsy POD → Tasarım** ekranında bunu kendisi söylüyor: bulamazsa sarı bir uyarı çıkar ve
"SVG indirip kendi aracında PNG'ye çevirebilirsin" der. Uyarı yoksa her şey hazır.

### 3. Görsel üretim platformu (isteğe bağlı)

**Hiçbir şey yapmazsan da çalışır** — Pollinations.ai varsayılan olarak bağlı, ücretsiz, anahtar
istemez. Ama fotoğraf gerçekçiliği vermez (aşağıdaki uyarıya bak) ve referans görsel kabul etmez,
yani yüz açılar arasında kayar.

Yüzü gerçekten kilitlemek istiyorsan: **Ayarlar → Görsel üretim sağlayıcısı** → Replicate, fal.ai
veya yerel ComfyUI/Stable Diffusion. Anahtarı sen alırsın; bu otomasyonun kendi anahtarı yoktur.
Ayarlar'daki karşılaştırma tablosu hangisinin ne verdiğini gösteriyor.

### 4. Etsy pazar araştırması (isteğe bağlı, ücretsiz)

Niş kütüphanesi **anahtarsız** çalışır — 15 niş, 13 uzun kuyruklu etiket, söz kalıpları.
Canlı Etsy verisi istiyorsan [etsy.com/developers/register](https://www.etsy.com/developers/register)
adresinden ücretsiz bir Keystring al, **Etsy POD → Pazar araştırması** sekmesine yapıştır.

### 5. Etsy mağaza bağlantısı (isteğe bağlı)

Tasarımı doğrudan mağazana **taslak** olarak göndermek istiyorsan. Aynı geliştirici hesabından bir
uygulama + bir **https** yönlendirme adresi gerekiyor (`http://localhost` kabul edilmiyor).
Adım adım anlatım **Etsy POD → Mağaza** sekmesinde.

> Bu araç listeyi **yayına almaz** — yalnızca taslak oluşturur. Silme izni hiç istenmez.

**Anahtarların hiçbiri repoya girmez.** Hepsi yalnızca senin bilgisayarında `data/` klasöründe
durur, `data/` de `.gitignore`'dadır.

---

## ⚠️ ÖNCE BUNU OKU: Bu otomasyon görselin kendisini ÜRETMEZ

- Bu yazılımın **içinde görsel üretme motoru yoktur.**
- **Hiçbir stok görsel içermez.** Hazır fotoğraf havuzu yok.
- Görselin geldiği tek yer, **bağlı olan görsel üretim API'sidir.**

**İyi haber:** kutudan çıkar çıkmaz çalışır. Varsayılan olarak **Pollinations.ai** bağlı gelir —
ücretsiz, **API anahtarı bile istemez**. Kurup çalıştırdığın anda ilk karesini üretebilirsin.

> ⚠️ **Ama ücretsiz katmandan fotoğraf gerçekçiliği bekleme.**
> Pollinations şu an yalnızca `sana` modelini sunuyor ([kontrol et](https://image.pollinations.ai/models)).
> SANA hız için damıtılmış bir modeldir; cilt gözeneği, ince tüy ve gerçek deri dokusu üretmez —
> çıktılar pürüzsüz ve "AI çizimi" gibi durur. **Bu prompt'la düzelmez, modelin sınırıdır.**
> Ücretsiz katman kompozisyon, mekân, poz ve kadraj denemek için iyidir.
>
> Gerçekten ayırt edilemeyecek sonuç için **Replicate** (FLUX.1-dev), **fal.ai** veya yerel
> **Stable Diffusion** (RealVisXL / epiCRealism gibi gerçekçilik modelleri) bağla.
> Bu üçü aynı zamanda **referans görsel** kabul ettiği için yüzü açılar arasında gerçekten kilitler.

Kaliteyi yükseltmek istediğinde kendi platformunu bağlarsın: Leonardo, OpenAI, Stability, Replicate,
fal.ai, kendi bilgisayarındaki Stable Diffusion, ComfyUI — ya da listede olmayan herhangi bir şey için
**"Özel API"**.

---

## Ne yapar?

### 1. Bir insan yaratır (sihirbaz)

Çalıştırdığında sırayla sorar:

**Görünüş** — cinsiyet, bölge, ırk/etnik köken, ten rengi, göz rengi, saç rengi, saç tipi, yaş,
vücut tipi, vücut ölçüleri, ayırt edici özellikler, serbest ek görünüm notu

Hiçbir şeye otomasyon karar vermez, hepsini sen seçersin. Aralıklar bilerek geniş tutuldu:
**boy 110–250 cm**, kilo 25–250 kg, yaş 18–90. Vücut tipleri arasında cücelik (akondroplazi),
küçük yapılı, plus size gibi seçenekler de var. Listede olmayan bir şey istersen
**"Ek görünüm detayı"** alanına yazarsın, prompt'a aynen girer.

**Yaşadığı yer ve memleket** — kademeli seçim: **kıta → ülke → şehir**. 7 kıta, 60+ ülke, 200+ şehir.
Memleketi de aynı şekilde seçilir ("yaşadığı şehirle aynı" kısayolu var). Listede olmayan şehri
kendin yazabilirsin.

**Hayat** — sosyoekonomik kökeni, annesi/babası ne iş yapıyor, kardeşi var mı, ilişki durumu,
çocuğu, mesleği, geliri, nasıl bir evde yaşıyor, evcil hayvanı, nasıl ulaşıyor,
hangi dilleri konuşuyor

**Karakter** — burcu, eğitim düzeyi, ilgi alanları, günlük ritmi, hayatını değiştiren olay,
en büyük korkusu, hayali, yaşam felsefesi, müzik zevki

Cevaplamak istemediklerini boş bırakabilirsin: **"Kalanını sen doldur"** dediğinde otomasyon kalanları
verdiğin cevaplarla **tutarlı** şekilde doldurur — gelir düzeyi eve, ev ulaşıma, bölge şehre bağlanır.
Rastgele değildir; aynı cevaplar hep aynı karakteri üretir.

Sonuç: kilitli kimlik + **Türkçe karakter dosyası** (okunabilir bir hayat hikâyesi) + ses rehberi +
içerik sütunları.

### 2. Vesikalık setini çıkarır (ilk iş)

Herhangi bir içerik görseli üretmeden önce yüzün **8 açıdan** vesikalığı alınır:
önden, sol/sağ çeyrek (45°), sol/sağ profil (90°), alttan açı, üstten açı, arkadan çeyrek.

Neden: tek bir "altın kare" yüzü sadece o açıdan tanımlar. Model karakteri yandan göstermek
istediğinde tahmin etmeye başlar ve yüz kayar. 8 açılık set bunu engeller — ayrıca bir LoRA eğitmek
veya platformda "karakter" oluşturmak için gereken minimum veri setidir.

**8 karede değişen tek şey açıdır.** Kıyafet (düz beyaz tişört), arka plan (düz açık gri),
ışık ve ifade birebir aynı tutulur.

### 3. İstediğini yapar (brief)

Serbest yaz, sahneye çevirsin:

| Yazdığın | Ne olur |
|---|---|
| `kahve reklamı yap` | Kahve reklamı sahnesi: ürün kadrajda net, üstte başlık için boşluk |
| `spor salonunda foto` | Karakterin şehrindeki modern spor salonu, antrenman anı |
| `sokakta kombin çekimi` | Şehrin dokulu bir sokağı, tam boy, kıyafet baştan aşağı görünür |
| `otel işbirliği` | Seyahat sahnesi |
| `kar altında kitap okurken` | Eşleşme yoksa isteğin aynen prompt'a girer |

Mekân karakterin gerçekten yaşadığı şehirden, kıyafet gelir düzeyinden, aksesuar evcil hayvanından gelir.

### 4. Haftalık plan üretir

Karakterin günlük ritmine ve mesleğine göre 7 günlük içerik takvimi. Her günün sahnesi hazır;
"Üret" dediğin an bağlı API'ye gider.

### 5. Her şey sonradan değiştirilebilir

**Karakter dosyası** sayfası salt okunur bir özet değil, formun kendisi: 7 bölüm, her alan tek tek
seçilebilir. Bir alanı değiştirip Kaydet dediğinde karakter hikâyesi, ses rehberi ve prompt'lar
yeniden üretilir.

- Sadece **hayat** alanları değişirse (gelir, evcil hayvan, meslek…) seed **aynı kalır** — yüz bozulmaz
- **Görünüş** değişirse seed yeniden hesaplanır ve panel sorar: *"Daha önce ürettiğin vesikalıklar
  artık bu kişiyi göstermiyor. Kalsın mı, silinip baştan mı üretilsin?"*

### 6. Sıfırlanır

**TÜM VERİYİ SİL** — karakter, vesikalık seti ve tüm görseller gider, sihirbaz sıfırdan başlar.
Karakter bir kez kilitlendiği için yeni bir insan yaratmanın tek yolu budur.

---

## Çalıştırma notları

Panel: **http://localhost:4200** (kurulum sırası için yukarı bak)

> ⚠️ **Aynı klasörden ikinci bir panel açma.** İki sunucu süreci aynı `data/` klasörüne yazarsa
> galeri kareleri kaybolur ve karakter dosyası bozulabilir. Otomasyon bunu artık engelliyor:
> ikinci örnek başlamaz ve nedenini söyler. Port değiştirmek (`AI_INFAPP_PORT=5000 node server.js`)
> bu sorunun çözümü **değildir** — önce açık olanı kapat.

> **Güvenlik modeli.** Ai Infapp yalnızca `127.0.0.1`'e bağlanır (ağdan erişilemez). Her istekte
> `Host` adı denetlenir (DNS rebinding'e karşı); yazma isteklerinde `Origin` / `Sec-Fetch-Site` aynı
> kaynaktan olmalı, API yazmaları `application/json` olmalıdır. Yani başka bir web sitesi, tarayıcında
> açıkken karakterini silemez ya da görsel üretim adresini kendi sunucusuna çeviremez.
> otopilot panelindeki oturum jetonu burada **yoktur**: aynı bilgisayarda çalışan başka bir
> *program* sunucuya doğrudan istek atabilir. Koruma tarayıcı tabanlı saldırılara karşıdır; bilgisayara
> zararlı bir program girdiyse Ai Infapp koruyamaz.

---

## Tutarlılık nasıl sağlanıyor?

Aynı yüzü her seferinde yakalamak dört katmandır:

1. **Fiziksel çekirdek** — yaş, etnik köken, ten, göz, saç, ayırt edici özellik tek bir satır olarak
   her prompt'a **kelimesi kelimesine** girer.
2. **Sabit seed** — kimlikten SHA-256 ile türetilir, seed destekleyen her modelde aynı sayı gider.
3. **Vesikalık seti** — 8 açı, referans destekleyen platformlara gönderilir.
4. **Platform desteği** — asıl belirleyici olan bu.

> **Dürüst olalım:** ücretsiz Pollinations referans görsel *kabul etmez* ve `sana` modeliyle
> fotoğraf gerçekçiliği *üretemez*. Yapıyı (stüdyo, kadraj, arka plan, poz) doğru kurar ama
> açılar arasında yüz ve saç kayar, cilt pürüzsüz kalır. Yüzü **gerçekten** kilitlemek için
> referans görsel alan bir platform gerekir: Replicate/fal.ai (IP-Adapter, redux modelleri),
> yerel ComfyUI (IPAdapter FaceID) veya karakter referansı destekleyen bir servis.
> Panel, bağlı platform bu ikisini desteklemiyorsa seni açıkça uyarır.

**Açılar ve "Yeniden üret":** vesikalıkta önden dışındaki her açı kendi açısıyla başlar
("side-profile… seen exactly from the side"); "pasaport vesikalığı" önyargısı yalnız `front` açısındadır.
Aynı kareyi tekrar üretmek (**Yeniden üret**) her seferinde tohumu kaydırır: aynı prompt + aynı tohum
birebir aynı fotoğrafı verir, bu yüzden galeride aynı prompt'tan kare varsa tohum otomatik değişir
(kimlik prompt'ta durduğu için yüz tarifi aynı kalır, poz/kompozisyon değişir).
Sağ çeyrek ve sağ profil, sol karelerin **aynadaki görüntüsüdür** (model sol/sağ ayrımını dinlemiyor); alttan/üstten açılar kamera yüksekliğini açıkça söyler ama küçük modelde eğim hafif kalır.
Referanssız sağlayıcıda (Pollinations) açılar artık **farklı** çıkar, ama aynı kişinin açılar arası
yüz/saç tutarlılığı garanti değildir; tutarlı bir yüz için yukarıdaki referans destekleyen platformlardan birini bağla.

## Çözünürlük ve büyütme — "4K" meselesi

**Hiçbir ücretsiz API doğrudan 4K üretmiyor**, ve bu cimrilik değil mimari: difüzyon modelleri ~1 MP'de
eğitiliyor, zorla daha büyüğünü isteyince anatomi bozuluyor (ikinci kafa, üçüncü kol). Herkesin yaptığı
şey aynı: **önce ~1 MP üret, sonra büyüt.**

Ölçtük — Pollinations istenen ölçüyü tamamen yok sayıyor:

| İstenen | Gelen |
|---|---|
| 1024×1280 | 686×858 |
| 2048×2560 | 686×858 |
| 3072×3840 | 686×858 |

Yani ücretsiz katman **0,6 MP** veriyor. Bu Instagram'ın istediği 1080 pikselin bile altında — IG
yüklerken yukarı ölçekliyor ve görüntü yumuşuyor. Büyütme "4K hevesi" değil, temel kalite ihtiyacı.

**Ayarlar → Büyütme** bölümünden bir büyütme aracı bağlarsın (sağlayıcı deseninin ikizi — bu yazılım
kendi başına büyütme de yapmaz):

| Araç | Maliyet | Not |
|---|---|---|
| **Yerel Stable Diffusion (A1111/Forge)** | **Ücretsiz, sınırsız** | Real-ESRGAN hazır gelir. Görsel üretimini başka yerden alsan bile büyütmeyi buraya yaptırabilirsin. |
| Replicate (Real-ESRGAN vb.) | Çok ucuz | GPU'n yoksa en pratik yol |
| Özel büyütme API'si | Değişir | Upscayl sunucusu, kendi kurulumun, herhangi bir servis |
| Kapalı | — | Varsayılan |

Büyütme başarısız olursa **üretilen kare çöpe atılmaz** — orijinali kaydedilir, sadece uyarı düşülür.
Kullanıcı parasını ödediği kareyi kaybetmesin.

> Dürüst not: **Instagram akışta zaten 1080 piksele düşürüyor.** 4K yalnızca baskı veya agresif kırpma
> için anlamlı. Asıl kazanç 686 → 1080+ arasında.

## Gerçekçilik ayarı

Üretim ekranında üç seviye var:

| Seviye | Ne yapar |
|---|---|
| **Ultra gerçekçi** (varsayılan) | "Profesyonel çekim" değil, birinin telefonuyla yakaladığı an. Kusurlu ışık, hafif hareket bulanıklığı, doğal mat renkler. En gerçekçi sonucu bu verir. |
| **Gerçekçi profesyonel** | Fotoğrafçı çekimi: 85mm, sığ alan derinliği, gözlerde net odak. |
| **Editoryal / moda** | Orta format, kontrollü stüdyo ışığı. |

Üçünde de "AI kokusu" veren ne varsa negatif listede engelleniyor
(`smooth skin`, `flawless skin`, `retouched`, `beauty filter`, `HDR`, `perfectly symmetrical face`,
`unreal engine`, `artstation`…), pozitif tarafta cilt gözeneği, ince tüy, hafif yüz asimetrisi,
kaçak saç telleri ve film greni isteniyor.

**Not:** boy ve vücut ölçüleri prompt'a **sayı olarak girmez**. İki sebep: `24-year-old … 163cm tall`
gibi yaş+ölçü bitişikliği birçok servisin güvenlik filtresini tetikleyip isteği reddettiriyor
(ölçülü testle doğrulandı), ve modeller santimetreyi zaten anlamıyor — siluet tarifi
(`petite`, `tall`, `notably short stature`) çok daha iyi çalışıyor. Sayılar karakter dosyasında durur.

---

## Hata payı uyarıları

### Dövme ve çil tamamen kaldırıldı

Gerçek üretim testlerinde ikisi de tutarlılığı görünür şekilde bozdu:

- **Dövme** — AI aynı deseni iki kez üretemez. Her karede farklı bir dövme çıkar ve izleyen bunu hemen fark eder.
- **Çil** — yoğunluk ve dağılım her karede kayar, uzak çekimlerde lekeye dönüşür.

Üstelik model bunları **istenmeden de ekliyordu** (ilk testte omuza rastgele bir dövme çizdi).
Bu yüzden ikisi de artık seçilebilir özellik değil ve **negatif prompt'ta aktif olarak engelleniyorlar.**
Negatif prompt desteklemeyen modellerde (FLUX, DALL·E) olumlu ifadeyle engelleniyor:
prompt'a `clear even-toned skin with no markings` giriyor — çünkü bu modellerde "dövme yok" demek
bazen ters teper.

### Kalan özelliklerin risk seviyeleri

| Özellik | Risk | Neden |
|---|---|---|
| **Heterokromi** | 🔴 Yüksek | Modeller ya yok sayar ya yanlış göze uygular. |
| Ben, piercing, beyaz saç tutamı, sabit kolye | 🟠 Orta | Yeri/biçimi karelerde kayabilir. |
| Gözlük, gamze, belirgin kaşlar | 🟢 Düşük | Kararlı çalışır. |

Sihirbaz bunları seçerken risk rozeti gösterir, karakter kartında uyarı kalıcı olarak durur.

---

## Zaten bir platforma para ödüyorsan: tek adımda bağla

Bu araç senin bilgisayarında çalışır, kendi sunucusu yoktur, anahtarların hiçbir yere gitmez.
OpenAI, Leonardo, Stability, Replicate veya fal.ai aboneliğin varsa yapman gereken tek şey:

1. **Ayarlar** → platformu seç
2. API anahtarını yapıştır
3. **Kaydet** → **Bağlantıyı test et**

Bitti. Model adı, çözünürlük, negatif prompt, seed — hepsi hazır geliyor, uğraşmana gerek yok.
Listede olmayan bir platform kullanıyorsan (Higgsfield, Ideogram, Runware, kendi sunucun,
bir Midjourney proxy'si) **Özel API** ile onu da bağlarsın; o zaman sadece platformun
dokümanındaki adresi ve gövde şablonunu bir kez girmen gerekir.

## Etsy: niş kütüphanesi ve pazar araştırması

İki katman var. **Birincisi anahtar istemez.**

### Katman 1 — gömülü niş kütüphanesi (kurulum yok)

15 niş, gerçek arama terimleriyle birlikte araca gömülü (2026 POD pazar araştırmasından:
meslek grupları, evcil hayvan, retro spor, oyun, teknoloji mizahı…). Bir niş seç ya da
kendi nişini yaz; sistem şunları üretir:

- **13 uzun kuyruklu etiket** — tek kelimelik etiket üretmez. Etsy'de "shirt" gibi tek
  kelimede rekabet o kadar yüksek ki görünme şansın yok; değer alıcının gerçekten yazdığı
  çok kelimeli terimde ("funny cat mom shirt").
- **Öne yüklenmiş başlık** — Etsy başlığın ilk kelimelerine ağırlık veriyor, o yüzden
  aranan terim (`cat shirt`) başta, tasarımın sözü sonra.
- **Söz kalıpları** — jenerik tür gelenekleri (`... MOM`, `POWERED BY ...`, `... CLUB EST.`),
  nişinle doldurulur. Tek tıkla tasarım metnine geçer.

Türkçe yazabilirsin: `kedi` → `cat`. Kütüphanede olmayan nişte jenerik kalıplara düşer
ve bunu sana söyler.

### Tasarım tarafı

- **Varyant şeridi** — aynı sözü 5 farklı görünümde yan yana gösterir, beğendiğine tıklarsın.
  Bedava ve anında: önizleme yolu tarayıcı çalıştırmaz, sadece vektör kurar.
- **4 üründe birden üret** — tişört + kare (çanta/yastık) + kupa + poster, **tek klasöre**,
  her biri **kendi Etsy listeleme metniyle**. Ürün kelimesi değişince etiketler de değişiyor:
  `cat mom shirt` → `cat mom mug` → `cat mom poster`.
- **Büyük harfe çevir** kapatılabilir. Kapalıyken yazdığın gibi kalır — serif ve el yazısı
  yazı tipleri küçük harfle çok daha iyi duruyor, bu seçenek olmadan o ikisi fiilen
  kullanılamıyordu.
- **Yazı genişliği ölçülüyor, tahmin edilmiyor.** Başsız Chrome her yazı tipinin her harfini
  bir kez ölçüyor (`glifler.js`), sonrası saf toplama — önizlemede tarayıcı hiç çalışmaz.
  Eskiden tek bir sabit vardı (`0.58`) ve harfler baskı dosyasının dışında kalıyordu.

Çıktı her üründe: **300 DPI + sRGB + şeffaf PNG**, güvenli baskı marjının içinde.

### Listeleme görseli (mockup)

Etsy'de satan şey **listeleme fotoğrafıdır**. Araç uzun süre yalnızca baskıya hazır
şeffaf PNG üretti — o dosya baskıcıya gider, alıcının gördüğü şey değildir.

Artık tasarımı ürünün üzerinde gösteren **2000×2000** listeleme görseli üretiyor:
tişört, çanta (tote), kupa, çerçeveli poster · 6 ürün rengi · istediğin kadarını
tek seferde.

> **Bu bir fotoğraf değildir ve öyleymiş gibi sunulmaz.** Stok görsel kuralı gereği
> ürün **vektörle çiziliyor** — tıpkı tasarımların kendisi gibi. Kumaş kıvrımı ve
> gerçek doku yok; sade, temiz bir ürün katalog görünümü var. Gerçek fotoğraf isteyen
> satıcı ürünü basıp çekmeli, ya da POD sağlayıcısının kendi mockup üretecini
> kullanmalı (Printful/Printify bunu ücretsiz veriyor).

### Mağazayı bağla — taslak listeleme

Tasarımı, listeleme metnini ve listeleme görselini Etsy mağazana **taslak** olarak gönderir.

> **Bu araç listeyi YAYINA ALMAZ.** Yalnızca taslak oluşturur; yayına alma, fiyat değiştirme
> ve silme Etsy'nin kendi ekranında senin elinde kalır. Silme izni (`listings_d`) **hiç
> istenmiyor**. Burası senin gerçek mağazan — bir yazılım hatası yüzünden çöp listeleme
> düşmesini göze alamayız.
>
> Taslak listelemenin ücret doğurup doğurmadığı Etsy'nin geliştirici dokümanlarında yazmıyor;
> doğrulayamadım. Yayına almadan önce mağaza panelinden kontrol et.

**Neden elle kod yapıştırıyorsun:** Etsy OAuth yönlendirmesi `https://` olmak zorunda ve
uygulamaya kayıtlı adresle birebir eşleşmeli — **`http://localhost` kabul edilmiyor.** Panel
yerelde çalıştığı için Etsy bize geri dönemiyor. Bu yüzden Etsy seni kendi kaydettiğin https
adresine gönderiyor, sen adres çubuğundaki `code=` değerini kopyalayıp panele yapıştırıyorsun.
Bir kez yapılır — tazeleme anahtarı 90 gün geçerli, sonrası otomatik.

İstenen izinler: `shops_r` (mağaza okuma), `listings_r` (listeleme okuma), `listings_w`
(listeleme yazma). Jetonlar yalnızca senin bilgisayarında `data/etsy-magaza.json` içinde durur.

### Katman 2 — canlı Etsy verisi (kendi API anahtarın, ücretsiz)

**Bu otomasyonun kendi Etsy anahtarı YOKTUR ve olmayacak.** Public bir depoda paylaşılan
anahtar herkesin eline geçer ve Etsy tarafından kapatılır. Görsel üretim sağlayıcılarında
da düzen aynı: herkes kendi anahtarını bağlar.

**Anahtarı nasıl alırsın** (5 dakika, ücretsiz):

1. Etsy hesabınla giriş yap — satıcı hesabı şart değil, normal hesap yeter.
2. [etsy.com/developers/register](https://www.etsy.com/developers/register) → **Create a New App**
3. Uygulamaya bir ad ver ve ne yapacağını kısaca yaz.
4. API kullanım şartlarını kabul et.
5. Onaydan sonra sana bir **Keystring** verilir — API anahtarın odur.
6. Panelde **Etsy POD → Pazar araştırması** sekmesine yapıştır, Kaydet.

Anahtar yalnızca senin bilgisayarında `data/etsy-api.json` içinde durur, hiçbir yere gönderilmez.

> Yeni uygulamalar önce kişisel/test kipinde başlar. Bazı uç noktalar Etsy onayı isteyebilir;
> anahtar reddedilirse panel bunu açıkça söyler.

**Ne yapar:** bir nişte neyin çalıştığını **desen olarak** çıkarır — hangi etiketler kaç
listede geçiyor, fiyatlar nerede kümelenmiş, başlıklar kaç karakter, rakiplerin kaçta kaçı
zayıf tek-kelime etiket kullanıyor (bu senin fırsatın).

**Ne yapmaz:** sayfa kazımaz, arka planda sürekli tarama yapmaz, kimsenin tasarımını,
görselini veya özgün sözünü kopyalamaz/saklamaz. İstek yalnızca sen "Araştır" dediğinde gider.

> **Neden kazıyıcı değil:** Etsy'nin bot koruması var; ev IP'sinden düzenli tarama engellenir
> ve aynı IP'den giren mağaza da riske girer. Etsy'de satış yapmak isterken Etsy'yi taramak
> kendi ayağına sıkmaktır. Resmi API zaten arama + filtre + sıralama veriyor.

---

## Fotoroman: karakterinden hikâye çıkarmak

Bu araçtaki tek gerçekten ayırt edici yetenek **aynı insanı onlarca karede aynı tutmak**.
Fotoroman bunu kullanan ilk çıktı: beş perdelik bir hikâye, konuşma balonları, sayfa düzeni.

**İki aşama var ve birincisi tamamen bedava.**

| Aşama | Gerekli | Ne çıkıyor |
|---|---|---|
| 1. Hikâye | hiçbir şey | Kare dökümü, diyaloglar, sayfa düzeni, **çekim senaryosu** (bütün promptlar dahil) |
| 2. Kareler | bağlı görsel API'si | Karelerin gerçek fotoğrafları |

Anahtarın yoksa 1. aşama tek başına işe yarar: `senaryo.txt` içindeki promptları
istediğin araca yapıştırıp kareleri elle üretebilirsin.

### ⚠️ Yüz kayması: fotoromanın en kritik meselesi

Fotoroman **yüz kaymasına en az tahammül eden** formattır. Tek karede fark edilmeyen
ufak bir değişim, 12 karelik bir hikâyede ürünü bozar — okuyucu hikâyeyi değil hatayı görür.

Görsel platformlarının **yarısı referans görsel kabul etmiyor** — anahtarsız çalışan tek
seçenek olan Pollinations dahil. O platformlarda yüz yalnızca metinle ve seed ile tutulur,
yani kareler arasında **değişebilir**.

Panel bunu gizlemiyor: **Fotoroman** sekmesini açar açmaz üretimden önce uyarı çıkıyor.
Yüzü gerçekten kilitlemek istiyorsan referans destekleyen bir platform bağla
(Replicate, fal, ComfyUI, AUTOMATIC1111 — bkz. *Görsel üretim platformunu bağlama*).

### Süreklilik kuralları

Bir akış için doğru olan, hikâye için felakettir. Akışta 12 gönderinin birbirine
benzememesi istenir; hikâyede tam tersi. Fotoroman stüdyosu bu yüzden kendi kurallarıyla
çalışıyor:

- **Kıyafet tüm hikâye boyunca tek.** Bir öğleden sonra geçen hikâyede karakter her karede
  üstünü değiştiremez.
- **Mekân perde sınırında değişir**, rastgele değil — ve iki mekân **birbirine komşu**
  seçilir (kafenin içi → aynı kafenin önü). Karakter aralarında yürüyebilmeli.
- **Işık tek zaman dilimi.** Kare 3 gece, kare 4 gündüz olamaz.
- **Plan dili çizgi roman grameriyle:** geniş planla kur, ortaya yaklaş, doruk noktada yüze
  gir, sonunda geri çekil.

### Beş perde

| Perde | Ne olur | Pay |
|---|---|---|
| Kuruluş | Kim, nerede, her şey yolundayken | %20 |
| Kıvılcım | Düzeni bozan şey oluyor | %15 |
| Gerilim | Büyüyor, çıkış görünmüyor | %25 |
| Dönüş | Doruk nokta — karar anı | %20 |
| Kapanış | Sonrası, geri çekiliyoruz | %20 |

5–24 kare arası seçebilirsin; kare sayısı arttıkça perdeler paylarına göre genişler.
En az 5, çünkü beş perdenin her biri en az bir kare almalı.

### Diyalog

Altı tür (gündelik, romantik, gerilim, gizem, komedi, dram) × beş perde için ayrı replik
havuzları var. **Motor senin hikâyeni yazmaz** — hiçbir şablon senin aklındakini bilemez;
yaptığı iş her kareye doğru türde ve doğru ağırlıkta bir başlangıç repliği koymak.
Paneldeki her balon düzenlenebilir.

Üç kural kodla garanti altında:

- **Sessizlik kuraldır**, eksiklik değil. Her kareye balon koyan fotoroman yorucu okunur ve
  görseli boğar. Karelerin ~%19'u sessiz.
- **Dönüş perdesi her zaman konuşur.** Hikâyenin bedelini ödediği yer orası.
- **Üst üste üç aynı balon türü çıkmaz** — sayfa tek sesli olmasın diye.

### Balonlar ve sayfa

Balonun yeri tesadüf değil, plandan türüyor: **yakın planda yüz kadrajın ortasını doldurduğu
için balon altta**, geniş planda üstte. Yanlış tarafa konan balon karakterin yüzünü kapatır
ve fotoromanda kapanan yüz, kayan yüzden daha az affedilir.

Sayfa biçimleri: Instagram karusel (4:5), kare, Story/TikTok (9:16), ve A4 albüm sayfası
(4 veya 6 kare). Dört tema (klasik, gece, pastel, sinema), dört balon yazı tipi.
Çıktı PNG veya tek dosya **PDF albüm**.

### Ne çıkıyor

Masaüstündeki tek klasöre:

```
2026-08-22 00-47 - fotoroman - Gündelik - 8 kare/
  01 - sayfa-1.png  ...  08 - sayfa-8.png
  senaryo.txt
```

`senaryo.txt` bir çekim senaryosu: süreklilik notları, kare kare plan/poz/ortam/ışık,
balon metni ve **her karenin tam promptu + seed'i**.

---

## Sahne kütüphanesi

Üretim ekranında **1.264 hazır sahne** var: mekân, ışık, poz, kıyafet, aksesuar
tarifleri. Çipe bas ya da Türkçe ara ("kar", "kafe", "ayna", "deniz"), karta
tıkla — sahne formu dolar, istediğin gibi değiştirirsin.

**Karakterin değişmez.** Kütüphane yalnızca *sahneyi* verir; kimlik her zaman
senin kilitli karakterinden gelir. Bu bir söz değil, yapısal bir kısıt: pakette
kimlik alanı **yok**.

### Neden "hazır prompt listesi" değil

Kaynak kütüphanedeki promptlar kendi insanlarını tarif ediyor —
*"young East Asian woman with long wavy dark brown hair"*. Ham gönderilseydi
senin karakterin her karede başka birine dönerdi.

Bir kısmında `{argument name="subject"}` yuvası var ve oraya kimlik enjekte
edilebiliyor. Ama ölçüldü: **yuvası olan 1.212 promptun %61'inde yuvanın
dışında da kimlik tarifi kalıyor.** Enjeksiyondan sonraki gerçek çıktı:

```
...24-year-old Japanese woman, SHOULDER-LENGTH STRAIGHT hair...
...Her VERY LONG, WAVY hair is worn loose...
```

İki rakip tarif; model geç geçeni tercih ediyor. Temiz enjeksiyon yalnızca
%3'ünde mümkündü.

Bu yüzden kaynaktan **kişi değil sahne** çıkarıldı: yedi alan
(`kadraj / poz / kıyafet / ortam / aksesuar / ışık / ruh hâli`), ham metin
hiç taşınmadan.

### Eleme

14.753 benzersiz kayıttan **1.264**'ü kaldı. Elenenler: gerçek kişi göndermesi,
yaş sinyali, cinsellik, telifli karakter, çok kişili kadraj, grid/kolaj,
metin-logo talebi, yapısal alan vermeyen düz yazı, ve prompt motorunun negatif
listesiyle çelişen kayıtlar.

Ayrıca `src/scenes.js` ışık havuzu aynı kaynaktan **8'den 40'a** çıkarıldı —
12 sahne önerisi artık 12 farklı ışık veriyor (önce en fazla 8 olabiliyordu).

### Sözü teste bağladık

```bash
node test/kutuphane.test.js
```

(otopilot kökünden: `npm run test:aiinfapp`; `npm test` bunu panel ve video-indirici
testleriyle birlikte koşar.)

Altı kapı: kimlik izi, negatif çarpışması, görsel bağlantısı, gerçek karakterle
uçtan uca kilit sınaması, Türkçe arama isabeti, sahne sözleşmesi. Kaynak günde
iki kez güncelleniyor; bu test olmadan bir sonraki senkronda temizlik sessizce
geri sızar.

### Lisans

Sahne tarifleri [ai-image-prompts-skill](https://github.com/YouMind-OpenLab/ai-image-prompts-skill)
projesinden **türetilmiştir** (MIT, Copyright © 2026 YouMind-OpenLab).
Tam metin: [THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md).

Hiçbir prompt metni olduğu gibi taşınmamıştır. Kaynak görsel bağlantıları
(`sourceMedia`) **tamamen atılmıştır** — onlar üçüncü kişilerin ürettiği
kareler ve MIT devri derlemeyi kapsıyor, o görselleri değil. Bu depo hiçbir
görsel dosyası ya da bağlantısı dağıtmaz.

---

## Çıktılar nereye gidiyor?

Her iş için masaüstünde **ayrı bir klasör** açılır. Görsel, prompt ve gönderi metni
o klasörde yan yana durur — aradığını bulmak için paneli açman gerekmez.

```
Masaüstü\Ai Infapp\
  2026-08-20 21-45 - AI Influencer - kahve reklamı\
    01 - Sokak kombini.png
    prompt.txt
    metin-instagram.txt
    bilgi.txt
  2026-08-20 21-52 - Etsy POD - anne günü\
    01 - Tişört hoodie.png
    etsy-listeleme.txt
    bilgi.txt
  2026-08-20 22-03 - Reklam - açılış duyurusu\
    01 - Instagram gönderi (4 5).png
    bilgi.txt
```

**İç içe klasör açılmaz.** Her iş kökte, yan yana durur; stüdyo adı klasör adında zaten yazıyor.

- `bilgi.txt` — tarih, stüdyo, karakter, sağlayıcı, ölçü ve **yüz referansının gönderilip
  gönderilmediği** (gönderilmediyse nedeni ve ne yapman gerektiği)
- `prompt.txt` — kullanılan prompt, negatif prompt, seed, model dili
- `metin-<platform>.txt` — o iş için üretilen gönderi metni varyantları
- `etsy-listeleme.txt` — başlık, 13 etiket, açıklama

**Ayarlar → Masaüstü çıktı klasörü**'nden kapatabilir ya da başka bir yere alabilirsin.
Sistem klasörleri (Windows, Program Files) ve sürücü kökü kabul edilmez.

`data/` klasörü eskisi gibi çalışmaya devam eder — bu ona **ek**, yerine geçmez.
Galeri, vesikalık zinciri ve referans seçimi hep `data/`yi kullanır.

---

## Görsel üretim platformunu bağlama

**Ayarlar → Görsel üretim sağlayıcısı**

Panelde bu tablonun canlı hâli var (**Ayarlar → "Hangisini seçmeliyim?"**);
oradaki "Referans görsel" sütunu **senin ayarına göre** hesaplanır.

| Platform | Ücret | Fotoğraf gerçekçiliği | Referans görsel | Çözünürlük | Ne gerekiyor |
|---|---|---|---|---|---|
| **Pollinations.ai** (varsayılan) | Bedava | Düşük | ✗ | 686×858 | Hiçbir şey |
| API yok — sadece prompt | — | Üretmez | ✗ | — | Hiçbir şey |
| Leonardo.ai | Kredili | Orta | ✗ | Modele göre | API Key |
| OpenAI (gpt-image / DALL·E 3) | Kredili | Orta | ✗ | 1024×1792 | API Key |
| Stability AI | Kredili | Orta | ✗ | 1536×1536 | API Key |
| **Replicate** | Kredili | Yüksek | ⚙ | Modele göre | API Token + model + referans alanı |
| **fal.ai** | Kredili | Yüksek | ⚙ | Modele göre | API Key + model yolu + referans alanı |
| **Yerel Stable Diffusion** (A1111/Forge) | Yerel | Yüksek | ✓ | Donanımın kadar | `--api` ile açık WebUI |
| **Yerel ComfyUI** | Yerel | Yüksek | ⚙ | Donanımın kadar | Workflow JSON + `{{reference}}` |
| **Özel API** | Değişir | Değişir | ⚙ | Değişir | URL + başlıklar + gövde şablonu |

**✓** doğuştan hazır · **⚙** destekliyor ama **ek ayar** gerekiyor · **✗** kabul etmiyor

⚙ olanlarda ayarı yapmazsan referans kare **gönderilmez** ve istek yine de başarılı döner —
yani yüz kilidini açtığını sanırsın. Panel artık bu durumu kırmızı uyarıyla söylüyor:

- **Replicate / fal.ai** → "Referans görsel alanı" kutusuna modelin girdi adını yaz
  (`redux_image`, `ip_adapter_image`, `image_url`…). Replicate'te **"Modelin alanlarını bul"**
  butonu modelin kendi şemasını okuyup adayları listeler.
  ⚠️ Varsayılan `flux-dev` / `fal-ai/flux/dev` **saf metin-den-görsel**; referans girdisi yoktur,
  redux veya IP-Adapter destekleyen bir modele geçmen gerekir.
- **Yerel ComfyUI** → workflow'una bir `LoadImage` düğümü ekleyip `image` değerini `{{reference}}` yap.
  Otomasyon vesikalık karesini ComfyUI'ye yükler (`/upload/image`) ve adını oraya yazar.
- **Özel API** → gövde şablonunda `{{reference}}` kullan.

### "Özel API" nasıl kullanılır?

Higgsfield, Ideogram, Runware, bir Midjourney proxy'si veya kendi sunucun — hepsi buradan bağlanır.

- **URL** — üretim uç noktası
- **Başlıklar (JSON)** — `{"Authorization": "Bearer ANAHTARIN"}` (panelde maskelenir)
- **Gövde şablonu (JSON)** — değişkenler: `{{prompt}}` `{{negative}}` `{{seed}}` `{{width}}` `{{height}}` `{{aspect}}` `{{reference}}`
- **Yanıt tipi** — `url` / `base64` / `binary` / `async`
- **Yanıt içindeki yol** — örn. `images[0].url`

```json
{
  "prompt": "{{prompt}}",
  "negative_prompt": "{{negative}}",
  "seed": {{seed}},
  "width": {{width}},
  "height": {{height}}
}
```

Değişkenleri tırnak içinde de tırnaksız da yazabilirsin — otomasyon tipi kendisi ayarlar.

---

## Prompt motoru

Aynı sahneyi her aracın sevdiği biçimde yazar:

- **Midjourney** — `--ar --style raw --v 7 --seed`, referans varsa `--cref`
- **Leonardo** — ayrı negatif prompt alanı
- **SDXL** — ağırlıklı etiketler + önerilen sampler/CFG/çözünürlük
- **FLUX** — düz cümle, negatif prompt yok
- **DALL·E** — tam cümle, parametre yok, dilbilgisi düzeltilmiş
- **Higgsfield / karakter referanslı araçlar**
- **Genel**

Vesikalık promptu ayrı kurulur: **önce format, sonra kişi.** Kişiyi anlatarak başlarsan
"düz gri stüdyo arka planı" talimatı sonda kalır ve model karakteri plaja, sokağa, nereye isterse koyar.

---

## Sıfırlama

```bash
node reset.js --confirm
```

- Varsayılan: `data/_arsiv/<tarih>/` altına **taşınır** (geri alınabilir)
- `--hard` → kalıcı siler
- `--all` → API anahtarların da silinir (varsayılan olarak korunur)

Panelden: **Ayarlar → TÜM VERİYİ SİL** (kutuya `SIFIRLA` yazman istenir)

---

## Klasör yapısı

```
server.js              yerel panel sunucusu (sıfır bağımlılık)
BASLAT.bat / baslat.sh başlatıcılar (AI_INFAPP_PORT / AIINFAPP_PORT, varsayılan 4200)
reset.js               TÜM VERİYİ SİL - komut satırı
src/
  wizard.js            sorular + doğrulama + seed türetme
  life.js              şehir havuzu, hayat soruları, tutarlı otomatik doldurma, karakter dosyası
  traits.js            ayırt edici özellikler + RİSK seviyeleri ve uyarıları
  persona.js           burç/eğitim/ilgi alanı → kişilik, ses rehberi, içerik sütunları
  reference.js         karakter sayfası + 8 açılı vesikalık seti
  brief.js             serbest istek → sahne, haftalık plan
  promptcraft.js       kilitli kimlik → her platformun diline göre prompt
  scenes.js            poz/kıyafet/ortam/ışık üretimi
  store.js             JSON kalıcılık + sıfırlama
  tipografi.js         metin ölçme ve satır sarma (vektör tasarımın temeli)
  glifler.js           harf genişliği tablosu + sistemdeki fontları ölçme
  providers/           görsel üretim platformları (her biri tek dosya)
  upscalers/           büyütme araçları (aynı desen: sen bağlarsın)
  kutuphane/           1.264 hazır sahne (YouMind'dan türetildi, MIT) + arama
  studios/
    karakter/          AI Influencer
    fotoroman/         hikaye.js (perde/süreklilik) · diyalog.js (balon) · sayfa.js (çizim)
    etsy/              POD tasarım + listeleme + pazar araştırması + mağaza
    reklam/            sosyal medya reklam görselleri
public/                panel arayüzü
data/                  karakterin, anahtarların, görsellerin (git'e girmez)
```

Yeni platform eklemek: `src/providers/` içine bir dosya koy, `src/providers/index.js`'teki listeye ekle.

Yeni stüdyo eklemek: `src/studios/<ad>/index.js` yaz, `src/studios/index.js`'teki listeye ekle.
Kendi ekranını isteyen stüdyo `public/app.js` içindeki `EKRANLAR` tablosuna bir satır ekler;
tasarım tabanlı bir stüdyoysa (Etsy/Reklam gibi) `STUDIO_FORMS`'a girmesi yeterli.

---

## Sorumluluk ve sınırlar

- **18+ zorunlu.** Sihirbaz 18 yaşından küçük karakter oluşturmayı kabul etmez.
- **Gerçek kişi taklidi yok.** Var olan bir insanın adını, yüzünü veya kimliğini taklit eden karakter üretme.
- **AI olduğunu belirt.** Instagram ve diğer platformlar yapay zekâ üretimi içerik için etiketleme istiyor;
  biyografiye de "AI" ibaresi koy. Gönderi metni motoru bu satırı **varsayılan olarak** metne ekler;
  kapatabilirsin ama o zaman biyografide veya platformun kendi "AI üretimi" anahtarında belirtmen gerekir.
- **Anahtarların sende kalır.** `data/providers.json` sadece kendi bilgisayarındadır ve `.gitignore`'dadır.
  Bu yazılımın kendi sunucusu yoktur.
- Platform API'leri değişebilir; bir entegrasyon bozulursa ilgili tek dosyayı düzelt.

---

## English (short)

**Ai Infapp** builds a complete fictional person from scratch — appearance, city, family, income,
routine, fears — locks the identity, then shoots an **8-angle passport reference set** so every later
prompt carries the same identity (face consistency depends on the provider you connect). Ask it for anything in plain language ("coffee ad", "gym photo") and it turns
that into a scene consistent with the character's life.

**It does not generate images itself and ships with no stock imagery.** It crafts the best prompt in the
dialect of whichever image API you connect and saves what that API returns. **Pollinations.ai is wired in
by default — free, no API key** — so it works out of the box.

⚠️ **The free tier cannot do photorealism.** Pollinations currently serves only the `sana` model, a
speed-distilled model that does not render skin pores or real skin texture — output looks smooth and
obviously AI. That is a model limit, not a prompt problem. Use the free tier to test composition,
location, pose and framing. For genuinely indistinguishable results connect **Replicate** (FLUX.1-dev),
**fal.ai** or local **Stable Diffusion** (RealVisXL / epiCRealism) — these also accept reference images,
which is what actually locks the face across angles.

`node server.js` → `http://localhost:4200` (or the **Ai Infapp** button in the otopilot panel; this
folder is `ai-infapp/` of that repository). Needs Node.js 22+. Reset with `node reset.js --confirm`. MIT.
