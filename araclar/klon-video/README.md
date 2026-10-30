# araclar/klon-video — kendi yüzün ve sesinle video (yerel, ekran kartı)

Yapay zekâ klipleriyle ve kendi sesinle video yaparken gerçek işte denenmiş yardımcı betikler. **Yalnızca kendi yüzün/sesin
ya da yazılı izin verilen kişi için.** Yayında YouTube'daki "değiştirilmiş veya sentetik içerik" kutusunu işaretle.
Kimsenin yüzünü/sesini izinsiz kullanma; bu depo yüz, ses ya da fotoğraf içermez.

Hepsi tek başına çalışan Python betikleridir (panel bunları çağırmaz). Kurulum: Python 3.10+, ffmpeg, işe göre aşağıdaki paketler.

| Betik | Ne yapar | Gerekenler |
|---|---|---|
| `ses-klonla.py` | Kısa bir örnek kayıttan sesi klonlayıp metni okutur (VoxCPM2) | `pip install voxcpm soundfile`, NVIDIA kart (~5 GB bellek) |
| `yuz-degistir.py` | FaceFusion'ı ekran kartıyla çalıştırır (CUDA DLL yüklemesi) | FaceFusion kurulu, `onnxruntime-gpu` |
| `arka-plan-degistir.py` | Konuşan kişiyi ayırıp yeni arka plana koyar (rembg) | `pip install rembg pillow` |
| `arkaya-logo.py` | Kişinin ARKASINA (duvara) parlayan logo yerleştirir | rembg, pillow |
| `renk-esle.py` | Kliplerin renk/parlaklık farkını ölçüp ortak hedefe eşler | ffmpeg |
| `senaryo-kontrol.py` | Videonun sesini yazıya dökerek senaryoyla karşılaştırır (eksik/fazla/tekrar kelime) | `pip install faster-whisper numpy` |
| `dudak-olc.py` | Ağız hareketi ile ses arasındaki gecikmeyi ms olarak ölçer | numpy, soundfile |

## Gerçek işte öğrenilenler (tuzaklar)
- **Dudak senkronu:** Yapay zekâ konuşan klibin dudakları kendi sesine göre üretilir. Üstüne başka bir ses koyup klibi esnetmek
  dudağı kaydırır. Doğrusu: klibin kendi sesini kullan (esnetme yok) ya da sesi aynı zamanlamayla dönüştür.
- **Yapay zekâ klipte kelime ekler/tekrarlar** ("video, video"). Teslimden önce `senaryo-kontrol.py` çalıştır, sessiz noktadan kes.
- **Renk solması:** klipler arası parlaklık/doygunluk farkı olur; `renk-esle.py` farkı sayıyla gösterir ve giderir.
- **FaceFusion:** `onnxruntime` CUDA kütüphanelerini yüklemezse sessizce işlemciye düşer; `yuz-degistir.py` bunu önler.
  `face_enhancer` kapalı tut (kare başına 0,1 sn ↔ 2 sn, bellek dolar).
- **VoxCPM ses klonlama:** model dosyası (4,6 GB) Windows'ta topluca belleğe alınınca "sayfa dosyası çok küçük" hatası verir;
  `ses-klonla.py` ağırlıkları tek tek okuyarak bunu aşar.
- **Not (ölçüm):** `dudak-olc.py` gürültülüdür (±0,1 sn); kesin karar için izle.
