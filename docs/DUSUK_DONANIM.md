# Düşük donanımda Otopilot

**Ekran kartı gerekmez, en kötü bilgisayarda da çalışır.** Bunu iddia olarak değil, testle söylüyoruz: her push'ta GitHub'da
**1 çekirdek, 2 GB bellek, ekran kartı yok** bir konteynerde gerçek `video-yap.js` tam boyutlu bir Shorts kurar
(`.github/workflows/en-kotu-pc.yml`, `node araclar/en-kotu-pc.js`). Geçmezse CI kırmızı olur (dal koruması açılırsa birleştirme de durur).

Otopilot açılışta makineyi ölçer ve bir **profil** seçer (`lib/donanim.js`). Görmek için:

```bash
node araclar/donanim.js
```

Konteyner ve sanal makinede bellek ve çekirdek sayısı **gerçek sınırdan** okunur (`process.constrainedMemory`, `os.availableParallelism`):
2 GB'lık bir Docker kendini sunucunun 64 GB'ı sanmaz.

## Profiller

<!-- PROFIL-BASLA -->
| Profil | Ne zaman | Render | Paralel iş | VoxCPM2 sesi |
|---|---|---|---|---|
| `cok-dusuk` | toplam bellek < 6 GB | en az bellek (klipler tek tek), **720p** | 1 | kapalı (Edge, yoksa Piper) |
| `dusuk` | bellek < 12 GB ya da 4 GB'lık NVIDIA kart yok | 8 GB altında düşük bellek, üstünde normal | 2 | kart uygunsa açık |
| `orta` | bellek ≥ 12 GB ve NVIDIA ≥ 4 GB | normal | 3 | açık |
| `yuksek` | bellek ≥ 24 GB ve NVIDIA ≥ 10 GB | normal | 4 | açık |
<!-- PROFIL-BIT -->

## Video kodlama: ekran kartı olmasa da donanımla

Render'ın en ağır adımı video kodlamadır. Otopilot şu sırayla **ilk çalışan** kodlayıcıyı seçer (1 sn'lik deneme; çalışmayan atlanır):

| Sıra | Kodlayıcı | Nerede var | Ölçülen (20 sn 1080x1920, i7-13620H, 3 koşunun ortancası) |
|---|---|---|---|
| 1 | NVIDIA NVENC | NVIDIA ekran kartı | 1,2 sn |
| 2 | AMD AMF | AMD ekran kartı | (ölçülmedi) |
| 3 | **Intel Quick Sync** | 2012 sonrası **hemen her Intel işlemci**, ekran kartı olmayan dizüstüler dahil | 4,1 sn |
| 4 | Apple VideoToolbox | her Mac | (ölçülmedi) |
| 5 | **Windows MediaFoundation** | her Windows 10/11 | 4,4 sn |
| 6 | işlemci (libx264), **hafif mod** | her yerde | 12,8 sn (zayıf makinede kendiliğinden) |
| 7 | işlemci (libx264), normal | her yerde | 52 sn |

Yani ekran kartı **olmayan** sıradan bir Intel dizüstüde bile kodlama işlemcinin normal ayarından ~12 kat hızlıdır. Bir donanım kodlayıcısı render
ortasında hata verirse iş kendiliğinden işlemciye geçer. Tüm ölçümler: [OLCUMLER.md](OLCUMLER.md).

**Hafif mod** (donanım kodlayıcısı yoksa): ≤ 4 mantıksal çekirdek (2 çekirdek + hyperthreading) ya da < 12 GB bellekte final
`libx264 veryfast crf 21` ile kodlanır (normal: `medium crf 20`). Görüntü biraz daha büyük dosyaya sığar, fark gözle zor seçilir.

## Diğer korumalar

- **Boş bellek 3 GB'ın altındaysa** render o anda düşük bellek ayarıyla başlar; bellek hatasında adım bir kez daha az bellekle tekrarlanır.
- **Zaman aşımları makineye göre uzar:** 2 çekirdek ya da < 6 GB bellekte 3 kat, ≤ 4 çekirdek ya da < 8 GB'ta 2 kat (yavaş makinede
  uzun adım yarıda kesilmesin).
- **VoxCPM2 donanım kapısı:** kurulu olsa bile CUDA motoru NVIDIA ≥ 4 GB ister; yoksa dakikalarca bekleyip bellek hatası almak
  yerine baştan yedek sese düşülür. AMD/Intel kartta Vulkan motoru (deneysel) kurulursa kapı ona göre karar verir.
- **İnternetsiz yedek ses (Piper):** `node araclar/piper-kur.js` (~85 MB, sürüme sabit, her dosya SHA256 doğrulamalı) işlemciyle
  çalışan Piper'ı kurar; ölçüldü: 8,1 sn Türkçe ses 0,9 sn'de. `otomatik` ses sırasında Edge çalışmazsa kendiliğinden kullanılır.
  **Lisans:** Türkçe ses modelinin veri seti ticari olmayan lisanslıdır (CC BY-NC-SA 4.0): para kazanan kanalda birincil ses yapma.
- **ffmpeg yoksa:** `winget install Gyan.FFmpeg`; winget/yönetici yetkisi olmayan eski Windows'ta `node araclar/ffmpeg-kur.js`
  (taşınabilir, sürüme sabit, SHA256 doğrulamalı, `.env`'e yolu yazar).

## Ezme

`.env` dosyasına ya da ortama:

| Değişken | Değerler | Etkisi |
|---|---|---|
| `DONANIM_PROFIL` | `cok-dusuk` `dusuk` `orta` `yuksek` | Ölçümü yok sayar, profili sabitler (hafif mod ve zaman aşımı da ona uyar) |
| `RENDER_DUSUK_BELLEK` | `0` `1` `2` | Render bellek seviyesi (0 = eşiğe bakma) |
| `RENDER_HAFIF` | `0` `1` | İşlemci kodlamasında hafif modu kapat/aç |
| `RENDER_COZUNURLUK` | `720` `1080` | Çözünürlüğü sabitle (çok düşük profilde varsayılan 720) |
| `ZAMAN_ASIMI_CARPANI` | `1`-`10` | Zaman aşımlarını elle uzat |
| `VIDEO_KODEK` | `cpu` | Donanım kodlayıcılarını hiç deneme |
| `VOXCPM_ZORLA` | `1` | VoxCPM2 donanım kapısını atla (kendi sorumluluğunda) |

## En kötü bilgisayar için reçete

1. `node araclar/doktor.js` → eksikleri kur (ffmpeg yoksa `node araclar/ffmpeg-kur.js`).
2. İnternet zayıfsa: `node araclar/piper-kur.js` (yedek ses).
3. Tarayıcıyı kapat, tek iş çalıştır; uzun videoyu gece çalıştır.
4. Ne kadar süreceğini görmek için: `node araclar/olcum.js`.

Kendi makinende ölç ve paylaş: `node araclar/olcum.js --ses` → [OLCUMLER.md](OLCUMLER.md). Eski kart ölçümleri en çok işe yarayanlardır.
