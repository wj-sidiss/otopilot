# konu.json — iş ayarları referansı

Her işin ayarları `uretim/<is-adi>/konu.json` dosyasındadır. Panelde **Ham ayarlar (JSON)** kutusundan ya da elle düzenlenebilir.
Dosya **tek yazarlıdır**: yalnızca panel, `yeni-is.js` ve `toplu-uret*.cjs` (yalnız dosya *yoksa* yazar; var olan dosyaya eksik alan ekler, değerleri ezmez) yazar; senaryo/görsel/ses/video betikleri bu dosyayı **hiç değiştirmez**.

**Öncelik:** `konu.json` > `panel-ayar.json` (Kanal ayarları) > yerleşik varsayılan. Alan yoksa bir sonraki kaynağa bakılır.

**Hatalı dosya:** JSON bozuksa ya da bir değer aralık dışındaysa betikler **varsayılana düşmez**; `✗ konu.json bozuk (satır X, sütun Y): …`
yazıp çıkış kodu 2 ile durur. Panel hatalı kaydı **kabul etmez** (400 + satır/sütun) ve bozuk dosyanın üstüne yazmaz (409).
Panel her yazmadan önce `konu.json.bak` yedeği alır. Bilinmeyen alanlar korunur; `_` ile başlayanlar serbesttir (not alanı olarak kullanılabilir).

## Temel alanlar

| Alan | Tür / aralık | Varsayılan | Açıklama |
|---|---|---|---|
| `surum` | 1 | 1 | Biçim sürümü. Daha yüksek bir sürüm görülürse uyarı verilir. |
| `baslik_en` | metin, 1–300 | iş adı | Video başlığı (adı `_en` olsa da **dilden bağımsız**). |
| `_not` | metin, ≤5000 | — | Konu notu / ek yönerge (senaryo motoruna iletilir). |
| `kanal` | metin, ≤60 | `panel-ayar` kanalı, yoksa `KANALIM` | Intro/kapanışta görünen kanal adı. `KANALIM` kalırsa panel uyarır (engellemez). |
| `slogan` | metin, ≤120 | `panel-ayar` sloganı | Intro altındaki slogan. |
| `format` | `long` · `short` · `reels` · `tiktok` | `aspect`'ten türetilir (9:16 → short, aksi long) | Video biçimi. |
| `aspect` | `16:9` · `9:16` | long → 16:9, diğerleri 9:16 | En-boy oranı. |
| `hedefSaniye` | 15–3600 | long 900 · short 40 · reels 180 · tiktok 60 | Hedef süre (sn). Eski `hedefDakika` (dakika) hâlâ okunur. |

## Açılış / kapanış / geçiş / görünüm

| Alan | Tür / aralık | Varsayılan | Açıklama |
|---|---|---|---|
| `geriSayim` | `0` veya `5` | long 5 · short/reels/tiktok 0 | Film lideri geri sayımı (sn). |
| `intro` | 0–30 sn | long 8 · short/reels/tiktok 1.5 | Marka animasyonu süresi. |
| `konuKarti` | 0–30 sn | long 2.5 · diğerleri 0 | Başlık kartı süresi. |
| `outro` | 0–30 sn | long 12 · short 3 · reels/tiktok 0 | Kapanış ("abone ol") süresi. 0 = kapanış kartı çizilmez. |
| `markaKose` | 0–10 sn | 0 | Kanal adının alt köşede kaç sn görüneceği (hızlı açılışta 2). |
| `acilisStili` | `hizli` · `sinematik` | — | Yalnızca bilgi amaçlı; bağlayıcı olan yukarıdaki **sayısal** alanlardır. Yeni uzun video `hizli` ile açılır (0/0/0/12 + `markaKose` 2); `sinematik` 5/10/3/12. İlk kelime ne kadar geç gelirse izleyici o kadar çok kaybedilir. |
| `gecis` | 29 geçiş adı (aşağıda) | rotasyon / `dissolve` | xfade geçiş türü. |
| `gecisSure` | 0.2–4 sn | long 0.8 · dikey 0.4 | Geçiş süresi. |
| `efekt` | `zoom` `yavas` `hizli` `kaydir` `yok` | rotasyon | Hareket efekti. |
| `renk` | `sinematik` `sicak` `soguk` `canli` `siyahbeyaz` `yok` | rotasyon | Renk tonu. |
| `vurguRenk` | 6 haneli hex, `#` yok | `6FD8FF` | Intro/kapanış vurgu rengi. |
| `outroMetni` | `{baslik, alt, altSlogan}` her biri ≤80 | dile göre | Kapanış kartı metni. Varsayılan en: `SUBSCRIBE` / `TURN ON NOTIFICATIONS` / `New videos every week`; tr: `ABONE OL` / `BİLDİRİMLERİ AÇ` / `Her hafta yeni videolar`; diğer diller en. |
| `altyazi` | true/false | true | `false` → videoya gömülmez (SRT yine yazılır). |
| `altyaziStil` | `cumle` · `kelime` | yatay `cumle`, dikey `kelime` | Cümle cümle ya da 2–4 kelimelik parçalar. |
| `cesitlilik` | true/false | true | `gecis`/`efekt`/`renk`/`muzikRuhu` **verilmemişse** iş adından türetilen bir rotasyonla çeşitlendirir (tekrarlayan şablon izlenimini azaltır). Seçimler `render-sonuc.json`'a yazılır. |

**Geçişler (29):** `fade` `dissolve` `fadeblack` `fadewhite` `slideleft` `slideright` `slideup` `slidedown` `smoothleft` `smoothright`
`wipeleft` `wiperight` `wipeup` `wipedown` `wipetl` `circleopen` `circleclose` `circlecrop` `rectcrop` `radial` `vertopen` `horzopen`
`pixelize` `hblur` `distance` `squeezeh` `squeezev` `diagtl` `hlslice`

## Müzik

| Alan | Tür / aralık | Varsayılan | Açıklama |
|---|---|---|---|
| `muzikSeviyesi` | 0–1 | 0.40 | Fon müziği seviyesi (0.40: müzik, anlatımın ~6.5 dB altında kalır — ölçülmüş değer). |
| `muzikDosyasi` | yol (proje köküne göre ya da mutlak) | — | Kendi telifsiz müziğin; döngülenir. Dosya yoksa render çıkış kodu 2 ile durur. |
| `muzikRuhu` | `sakin` `gerilim` `umut` `enerjik` `otomatik` | `otomatik` | Sentetik müzik ön ayarı (`muzikDosyasi` yoksa). |
| `muzikDucking` | true/false | true | Konuşma sırasında müziği kısar. |

## Dil ve ses

| Alan | Tür / aralık | Varsayılan | Açıklama |
|---|---|---|---|
| `dil` | iki küçük harf (`en`, `tr`, `es`, `de`, `fr`…) | `ses` önekinden (VoxCPM hazır sesinde ses kartının dilinden: `voxcpm:anlatici_en` → `en`), yoksa `panel-ayar`, yoksa `en` | Senaryo, ses ve görsel arama dili. |
| `altyaziDili` | iki küçük harf | `dil` | `dil`'den farklıysa zincire **altyazı çevirisi** adımı eklenir; çeviri `Voice/ALTYAZI-<XX>.txt` olur. |
| `ses` | metin | dile göre (`en-US-ChristopherNeural`, `tr-TR-AhmetNeural`, `es-ES-AlvaroNeural`, `de-DE-ConradNeural`, `fr-FR-HenriNeural`) | Ses adı (Edge/Azure ortak katalog) ya da **`voxcpm:<ad>`**: yerel VoxCPM2 motorunun hazır yapay sesi (`voxcpm:tok_anlatici`, `voxcpm:belgesel_hanim`, `voxcpm:anlatici_en` …; liste `sesler/voxcpm2/README.md`, `node seslendir.js --liste-sesler`). `voxcpm:<ad>/<çeşit>`: VoxCPM klasöründe kendi tasarladığın ses. Ad yalnız küçük harf, rakam, alt çizgi; geçersizse çıkış kodu 2. |
| `sesHizi` | `+7%` / `-10%` (−50..+50) | `+7%` | Konuşma hızı. |
| `sesMotoru` | `otomatik` `edge` `azure` `piper` `voxcpm` | `otomatik` | `otomatik`: Edge dener; bir paragraf başarısız olursa **tüm iş** sıradaki motorla baştan seslendirilir (ses tutarlılığı için karışık motor yok). `ses` bir `voxcpm:<ad>` ise VoxCPM (kuruluysa, `VOXCPM_KOK`) en başta denenir; kurulu değilse Edge'in o dildeki sesine düşülür. VoxCPM bazı paragrafları bitirip bazılarında düşerse Edge'e geçilmez: biten paragraflar korunur, çıkış kodu 4, aynı komut kaldığı yerden devam eder. `voxcpm`: yalnız VoxCPM; ses adı verilmezse dile göre varsayılan (`tr` → `tok_anlatici`, `en`/`de`/`es`/`fr`/`ja`/`ru`/`zh` → `anlatici_<dil>`); kurulu değilse çıkış kodu 2 ve kurulum adımları. VoxCPM rakam okumaz: Türkçe ve İngilizce sayılar otomatik yazıya çevrilir, diğer dillerde sayıları yazıyla yaz. |
| `okunus` | `{"GPU":"G P U", …}` ≤200 giriş | — | **Yalnız seslendirme metnine** uygulanan okunuş sözlüğü; altyazı özgün kalır. |

Kelime hızı: `en` 151, `tr` 113 (ölçüldü), diğer diller 140 (tahmin — ses sonrası gerçek süre esas alınır).

## Senaryo ve içerik

| Alan | Tür / aralık | Varsayılan | Açıklama |
|---|---|---|---|
| `tur` | `belgesel` `reklam` `haber-spor` `egitim` `hikaye` `tanitim` | `belgesel` | Senaryo şablonu. |
| `ton` | metin, ≤200 | — | Anlatım tonu ("samimi, esprili"). |
| `kanalSesi` | `{tarif ≤500, ornekParagraf ≤1000}` | `panel-ayar` | Kanalın yazı sesi: kısa tarif + 1 örnek paragraf. |
| `kisiselKatki` | metin, ≤1500 | — | **Senin** bakışın/deneyimin; iki senaryo motoru da metne işler (özgünlük için). |
| `arastirma` | metin, ≤20000 | — | Kaynak/araştırma metni. Verilirse senaryo yalnız bununla ve yaygın bilgiyle yazılır; emin olunmayan yerde yuvarlama/çekimser anlatım. |
| `aciklamaBrief` | metin, ≤20000 | — | vidIQ yoluna ek yönerge. |
| `onay` | `{senaryo: true, gorsel: false}` | senaryo **true**, görsel false | `senaryo: true` → zincir senaryo yazılınca **onay bekler** (düzenleyip Onayla dersin). |
| `sahneKelimeleri` | (metin \| metin listesi)[] | — | Sahne sırasıyla **elle** görsel arama ifadeleri; en yüksek öncelik. `"uret: ..."` ile başlayan ifade AI görseli ister. |
| `uretStil` | metin, ≤300 | — | AI görsel üretiminde ek stil. |
| `uretAdet` | 1–6 | 2 | Sahne başına AI görsel sayısı. |
| `formuller[]` `promptlar[]` `portreler[]` `sahneler[]` | nesne listeleri | — | Elle tanımlanan kart/portre/sahne. İçlerindeki `n` ve `hedef` yalnız `A–Z a–z 0–9 boşluk _ -` içerebilir (1–40 karakter): nokta ve eğik çizgi yasak. Şekiller: `formuller: [{n, ust, ana, alt, hedef}]`, `promptlar: [{n, baslik, satirlar:[…], alt, hedef}]`, `portreler: [{n, q:[ifade…], adet}]`, `sahneler: [{n, q:[ifade…]}]` (NASA sahneleri). `hedef` = kartın konacağı **sahne klasörü** (`Visuals/<hedef>`); verilmezse kartlar `14-formuller` / `90-promptlar` klasörüne yazılır ve video kurulurken sayıya en yakın sahneye eklenir. |
| `_trendRapor` | `trend/<ad>.json` ya da `viral-analiz/<ad>.json` | — | Panelde trend/viral raporundan **«Bu konuda video yap»** ile açılan işte otomatik yazılır. Raporun açılış (hook) kalıpları ve süre ortancası senaryo istemine *örnek yapı* olarak girer; başkasının metni kopyalanmaz. Yalnız bu iki klasördeki `.json` raporları okunur. |

## Yayın ve maliyet

| Alan | Tür / aralık | Varsayılan | Açıklama |
|---|---|---|---|
| `yayin` | `{hashtagler: ≤15 metin, aciklamaSablonu, seri}` | — | Yayın paketine giren hashtag/açıklama şablonu/seri adı. |
| `maliyetUstSinirUSD` | ≥0 | — | Bu iş için ücretli çağrılar bu tahmini toplamı aşacaksa betik **başlamadan** çıkış kodu 7 ile durur. |

## Örnek

```json
{
  "surum": 1,
  "baslik_en": "Roma Neden Çöktü?",
  "kanal": "Tarih Kanalı",
  "format": "long",
  "dil": "tr",
  "ses": "tr-TR-AhmetNeural",
  "tur": "belgesel",
  "hedefSaniye": 900,
  "geriSayim": 0, "intro": 0, "konuKarti": 0, "outro": 12, "markaKose": 2,
  "onay": { "senaryo": true, "gorsel": false },
  "arastirma": "Kaynak: ... (kendi notların)",
  "kisiselKatki": "Bence asıl neden ... çünkü ..."
}
```

Yeni bir iş açmak için: panelde **Yeni video**, ya da `node yeni-is.js <is-adi> --baslik "..." --dil tr`.
