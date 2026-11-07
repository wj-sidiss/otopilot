# W.J. Sidis video şablonu (Remotion)

"Claude ile kendi video fabrikamı kurdum" videosunun **görüntü kodu**. 1910'ların gazete kâğıdı, daktilo yazısı, kırmızı damgalar ve tramvay biletleri üzerine kurulu bir kimlik. Karakterler W.J. (kasketli, gözlüklü maskot) ve Daktilo (yapay zekâyı temsil eden gözlü daktilo).

İçinde iki örnek var:

| Kompozisyon | Ne | Boyut |
|---|---|---|
| `SidisUzun` | 6 bölümlük, yaklaşık 30 dakikalık uzun video. Üstte bölüm takip çubuğu, bölüm geçişlerinde gazete katlanması | 1920x1080 |
| `SidisShort01` | Tek sahnelik pilot Shorts ("Sesimi klonladım") | 1080x1920 |

Stil kuralları: `docs/SIDIS_STIL.md`.

## Nasıl çalışır

- **Kelimeye bağlı zamanlama:** Hiçbir görüntü saniyeye bağlı değil, cümleye bağlı. Uzun video `assets/sidis-uzun/zaman.json` dosyasını okur. Bu dosyada her bölümün (satırın) ve cümlenin başlangıç ve bitiş saniyesi var. Ses değişince bu dosyayı yeniden üretirsin, animasyon kendiliğinden yeni sese uyar.
- **Metin:** `assets/sidis-uzun/anlatim.txt`. Her satır bir bölüm, cümleler `|` ile ayrılır. `anlatim-tts.txt` aynı metnin okunuş yazımıdır (örn. W.J. → "Dabılyu Cey").
- **Shorts:** `assets/sidis-shorts/01/kelimeler.json` dosyasındaki kelime zamanlarını kullanır.

## Kurulum

```bash
cd araclar/sidis-video
npm install
```

**Yazı tipleri:** `public/fonts/` içine şu Fontsource woff2 dosyalarını koy. Hepsi OFL lisanslı, `npm i @fontsource/inter` gibi paketlerin `files/` klasöründen kopyalanır. Gerekli dosya adları `src/lib/fonts.ts` içinde:
- `inter-{latin,latin-ext}-{400,600,800,900}-normal.woff2`
- `instrument-serif-{latin,latin-ext}-400-{normal,italic}.woff2`
- `jetbrains-mono-{latin,latin-ext}-{400,700}-normal.woff2`
- `plus-jakarta-sans-{latin,latin-ext}-var.woff2`

**Görüntüler:** Bazı sahneler gerçek ekran görüntüsü gösterir. Bunlar depoda yok, kendi görüntülerini `public/` altına koyman gerekir. Koymazsan o sahneler boş çerçeve gösterir.
- `public/kare/NN/000.png …`: ekran kaydından kareler (820x679)
- `public/c/kontrol/`: kontrol sahnesindeki küçük kareler
- `public/d/pilot_*`: pilot Shorts'tan kareler
- `public/d/s/`: bu bölümün ek görselleri

İzle: `npm run studio`. Tip kontrolü: `npm run kontrol`.

## Ses ve zamanlama (Python betikleri)

Gereken: Python 3.10+, `pip install faster-whisper soundfile numpy num2words`, ffmpeg.

1. **Cümle cümle seslendir.** Her cümle `assets/sidis-uzun/ses-ham/NN-MM.wav` dosyasına yazılır (NN = satır, MM = cümle). Herhangi bir ses motoru olur. Otopilot'un yerel VoxCPM2 sesleri (`sesler/voxcpm2/`, örn. `tok_anlatici`) bu videoda kullanıldı.
2. **Denetle:** `python scripts/ses-denetle.py assets/sidis-uzun 0.8`. Whisper her cümleyi yazıya döker ve metinle karşılaştırır.
3. **Bozuk cümleleri seç:** `python scripts/sidis-kotu.py`. Rakamları yazıya çevirip yeniden puanlar ve bozuk cümle listesini `kotu.txt` dosyasına yazar. Bunları başka bir tohumla `ses-alt/` klasörüne yeniden üret, sonra `python scripts/ses-sec.py assets/sidis-uzun` iyi olanı seçer.
4. **Zaman ve tek ses dosyası:** `python scripts/zaman-yap.py assets/sidis-uzun --ses` → `zaman.json` + `anlatim.wav`.
5. **Render:** `bash scripts/yatay-render.sh sidis-uzun SidisUzun "<çıktı klasörü>" VIDEO.mp4`. 1000 karelik parçalar halinde render eder ve sesle birleştirir.

**Render etmeden ses değiştirme:** Video bir kez render edildiyse, render'daki `zaman.json`'u `zaman-video.json` olarak sakla. Yeni sesi `ses-ham/` içine üret, sonra `python scripts/sidis-ses-tak.py eski.mp4 yeni.mp4` çalıştır. Her cümle eski yerine oturur; sığmayan cümle en çok %25 hızlanır.

## Lisans ve uyarı

Kod depo lisansıyla (MIT) gelir. W.J. Sidis (1898–1944) gerçek bir tarihî kişidir; şablondaki karakterler özgün çizimdir, onun portresi değildir. Yapay zekâ sesi kullanıyorsan YouTube'a yüklerken "değiştirilmiş veya sentetik içerik" kutusunu işaretle.
