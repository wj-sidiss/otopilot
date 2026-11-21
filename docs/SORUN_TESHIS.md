# Sorun teşhisi

Otopilot bir hata verdiğinde mesaj Türkçedir ve çözümü söyler. Bu sayfa aynı bilgiyi tek yerde toplar: **mesajda gördüğün
ifade → ne oldu → ne yapmalı**. Önce şu iki komutu çalıştır, çıktılarını hata bildirimine ekle (kişisel bilgi içermez):

```bash
node araclar/doktor.js        # kurulum: ffmpeg, Node, paketler, internet, donanım profili
node araclar/donanim.js       # işlemci, bellek, ekran kartı, seçilen profil ve açık/kapalı özellikler
```

## Çıkış kodları

| Kod | Anlamı | Ne yap |
|---|---|---|
| 0 | Tamam | — |
| 2 | Girdi ya da ayar hatası | Mesajdaki dosyayı/ayarı düzelt |
| 3 | Ağ ya da dış servis | 30 sn bekleyip aynı komutu en çok 2 kez tekrar çalıştır; ilerleme korunur |
| 4 | Yetersiz sonuç (görsel az, paragraf düştü) | Mesajdaki çözümü uygula (`--sahne N --ara`, `seslendir.js`'i yeniden çalıştır) |
| 5 | Disk ya da bellek | Aşağıdaki "Bellek" bölümü |
| 6 | Aynı iş zaten çalışıyor | Diğer pencereyi bekle ya da kapat |
| 7 | Maliyet sınırı | Bütçeyi kontrol et |

## Genel hatalar (`lib/ortak.js` → `HATA_TABLOSU`)

<!-- TABLO-BASLA -->
| Kod | Ne oldu | Ne yapmalı |
|---|---|---|
| `konu_bozuk` | konu.json okunamadı. | Panelde Ham ayarlar kutusunu aç ve JSON'u düzelt. |
| `disk_dolu` | Diskte boş yer kalmadı. | Disk alanı aç (panelde Disk bölümünden ara dosyaları temizle) ve tekrar dene. |
| `ffmpeg_yok` | ffmpeg bulunamadı. | ffmpeg'i kur: Windows'ta `winget install Gyan.FFmpeg`, ardından PANEL.bat'ı kapatıp yeniden aç. |
| `kodlayici` | Ekran kartı video kodlayıcısı hata verdi. | Aynı anda başka bir program ekran kartını kullanıyor olabilir. Tekrar dene; sürerse sürücüyü güncelle (işlemciyle otomatik denenir). |
| `bozuk_gorsel` | Bozuk bir görsel dosyası var. | Görseller listesinden bozuk görseli sil ve videoyu yeniden kur. |
| `kredi_bitti` | Servis kredisi/bakiyesi bitmiş. | İlgili hesaba kredi yükle ya da Kaynaklar sekmesinden diğer senaryo motorunu seç. |
| `anahtar_gecersiz` | API anahtarı geçersiz ya da girilmemiş. | Kaynaklar sekmesinden anahtarı kontrol et, yeniden gir ve Test et düğmesine bas. |
| `limit` | Servis istek sınırına takıldı ya da aşırı yüklü. | Birkaç dakika bekleyip tekrar dene. |
| `internet_yok` | İnternet bağlantısı kurulamadı ya da servis yanıt vermedi. | Bağlantını kontrol edip tekrar dene (iş kaldığı yerden devam eder). |
| `bagimlilik_eksik` | Gerekli bir paket kurulu değil. | Proje klasöründe `npm install` çalıştır (ya da PANEL.bat'ı yeniden aç). |
<!-- TABLO-BIT -->

## Bellek (düşük donanım)

| Mesajda | Ne oldu | Ne yapmalı |
|---|---|---|
| `bellek_yetersiz`, "Cannot allocate memory" | Render adımı belleğe sığmadı. Otopilot aynı adımı **bir kez** düşük bellek ayarıyla zaten tekrar denedi. | Açık programları kapat; `.env`'e `RENDER_DUSUK_BELLEK=1` (yine olmazsa `2`) yaz ve aynı `video-yap.js` komutunu çalıştır; biten ara dosyalar korunur. |
| "GPU belleği yetmedi, CPU'ya geçildi" | Ekran kartı kodlayıcısı belleğe sığmadı. | Bir şey yapma: iş işlemciyle sürer (daha yavaş). |
| `MFX`, `h264_qsv`, `h264_mf`, `MFT`, `videotoolbox` hatası | Intel Quick Sync / Windows MediaFoundation / Apple VideoToolbox kodlayıcısı açılamadı (sürücü eski ya da başka program kullanıyor). | Bir şey yapma: iş işlemciyle sürer. Sürekli olursa grafik sürücüsünü güncelle ya da `.env`: `VIDEO_KODEK=cpu`. |
| "KODLAYICI: libx264 (hafif) (işlemci)" | Donanım kodlayıcısı yok, zayıf makine: hızlı ayar seçildi. | Normal. Tam ayar için `RENDER_HAFIF=0` (çok daha yavaş). |
| "ÇÖZÜNÜRLÜK: 720p" | Çok düşük profil: video 720x1280 kuruldu (YouTube Shorts kabul eder). | Tam çözünürlük için `.env`: `RENDER_COZUNURLUK=1080` (bellek yetmeyebilir). |
| "VoxCPM motoru bellek ayıramadı … boş sistem belleği X GB", `GGML_ASSERT(ctx->mem_buffer != NULL)`, `weight buffer` | VoxCPM2 motoru (ggml) bellek ayıramadı. Bellek gerçekten azsa olur; ama **kart boş ve bellek yeterliyken de** görüldü (RTX 5060, sürücü 610.88: 0 MB kart kullanımı, 6,3 GB boş RAM). | Boş bellek 4 GB altındaysa programları kapat. Değilse kartı kullanan programı kapatıp bilgisayarı yeniden başlat; sürerse VoxCPM klasöründe `kur.ps1`'i yeniden çalıştır. Bu sırada `--motor otomatik` Edge/Piper sesine düşer. |
| "VoxCPM2 kurulu ama bu donanımda çalışmaz" | Donanım kapısı: NVIDIA kart yok ya da 4 GB'tan az. Bekleyip bellek hatası almak yerine baştan Edge'e düşüldü. | AMD/Intel kartta Vulkan motorunu kur (`kur.ps1 -Vulkan`, deneysel) ya da `VOXCPM_ZORLA=1` ile dene. |

## Doğrulama (SHA256)

| Mesajda | Ne oldu | Ne yapmalı |
|---|---|---|
| `node araclar/sha256.js` → "✗ dosya" | Depodaki bir ses örneği, font ya da PDF değişmiş ya da bozuk inmiş. | `git checkout -- <dosya>` ya da depoyu yeniden indir. Kendin değiştirdiysen `node araclar/sha256.js --yaz`. |
| `--modeller` → `boyut-yanlis` / `yanlis` | Kurulu VoxCPM2 modeli eksik inmiş ya da değiştirilmiş. | Model dosyasını sil, `kur.ps1`'i yeniden çalıştır (indirirken SHA256'yı doğrular). |
| `piper-kur.js` / `ffmpeg-kur.js` → "SHA256 tutmadı, dosya silindi" | İnen dosya sabitlenen sürümle aynı değil (bağlantı kesildi, proxy değiştirdi ya da kaynak değişti). Bozuk dosya diske yazılmadı. | Aynı komutu tekrar çalıştır. Sürerse kurulumu durdur ve hata bildir; dosyayı başka yerden elle indirme. |
| `--modeller` → `bilinmeyen-surum` (motor) | Motor sabitlenen hazır sürüm değil. | Kaynaktan derlediysen (`kur.ps1 -Derle`) normaldir; değilse `kur.ps1`'i yeniden çalıştır. |

## Hâlâ çözülmediyse

GitHub'da **Hata bildirimi** aç; `node araclar/doktor.js --json` ve `node araclar/donanim.js --json` çıktılarını ekle.
