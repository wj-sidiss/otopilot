# Codex (ve diğer ajanlar) ile Otopilot: kurulum ve sık sorunlar

**Kısa cevap:** Otopilot, **bilgisayarda komut çalıştırabilen bir yapay zekâ ajanı** ister (Claude Code, Codex uygulaması, Codex komut satırı...). Sıradan bir **sohbet penceresi** (ChatGPT'ye depo bağlantısı yapıştırmak gibi) komut çalıştıramaz; bu yüzden şu cevabı verir ve haklıdır:

> "Otopilot bu repoda bilgisayarda çalışan yerel bir araç; sohbetin içinde onu çalıştıran bir bağlantı yok. Bu yüzden Otopilot'u kullandığımı söyleyemem."

Bu bir hata değil, sohbetin sınırı. Çözüm: aşağıdaki üç yoldan birini seç.

| Yol | Nerede çalışır | Otopilot için uygun mu? |
|---|---|---|
| **A. Codex uygulaması / komut satırı (yerel)** | Kendi bilgisayarında, açtığın klasörde | **En iyisi.** ffmpeg, ekran kartı, Chrome, dosyaların hepsi kullanılabilir |
| **B. Claude Code (masaüstü uygulaması ya da komut satırı)** | Kendi bilgisayarında | **En iyisi.** `CLAUDE.md` → `AGENTS.md` kendiliğinden okunur |
| **C. Codex bulutu (ChatGPT kenar çubuğu)** | OpenAI'nin sunucusunda izole kutu | Sınırlı: yalnız ücretsiz ana hat (görsel + Edge sesi + ffmpeg). Ekran kartı, Chrome (3B/cinecode) ve bilgisayarındaki dosyalar yok; internet varsayılan **kapalı** |
| ✗ Sıradan sohbet penceresi | Komut yok | Çalışmaz; yalnız senaryo/taslak yazabilir |

## A/B: yerel kurulum (önerilen)

1. Node 22+ ve ffmpeg kur (`node -v`; Windows: `winget install Gyan.FFmpeg`, Mac: `brew install ffmpeg`, Linux: `sudo apt install ffmpeg`).
2. Depoyu indir ve ajanı o klasörde aç:
   ```bash
   git clone https://github.com/wj-sidiss/otopilot.git
   cd otopilot
   npm ci --ignore-scripts
   node araclar/doktor.js        # her şeyi kontrol eder, eksik olanın tam kurulum komutunu yazar
   ```
3. Ajanı bu klasörde başlat ve yaz: *"AGENTS.md'yi oku. 40 saniyelik İngilizce Shorts yap: Ay neden hep aynı yüzünü gösterir."*

## C: Codex bulutu

Arayüz adları zamanla değişebilir; mantık şu:

1. Ortam (environment) oluştur, bu depoyu seç.
2. **Setup script** (internet açık olan kurulum aşaması) alanına:
   ```bash
   apt-get update && apt-get install -y ffmpeg espeak-ng && npm ci --ignore-scripts
   ```
3. **Agent internet access**'i aç ve alan adı izin listesine ekle (liste için `node araclar/doktor.js --codex`): ses için `speech.platform.bing.com`, görsel için `commons.wikimedia.org`, `upload.wikimedia.org`, `api.openverse.org`, `images-api.nasa.gov`, müze API'leri.
4. Node sürümünü 22 ya da üstü seç.
5. İlk istem: *"AGENTS.md'yi oku, `node araclar/doktor.js` çalıştır, sonra isteğimi yap."*

Bulutta çalışmayanlar: VoxCPM2/MuseTalk/ACE-Step (ekran kartı), cinecode ve 3B sahneler (Chrome), `PANEL.bat` (Windows). Ses için Edge sesi internet ister; internet yoksa Linux'ta `espeak-ng` yedeği devreye girer (kalite düşüktür).

## Sık sorunlar

| Belirti | Neden | Çözüm |
|---|---|---|
| "Otopilot'u kullandığımı söyleyemem" | Sohbet penceresi, ajan değil | Yukarıdaki A/B/C'den birine geç |
| `doktor` "internet kapalı" diyor | Codex bulutunda varsayılan | Agent internet access'i aç + izin listesi |
| `ffmpeg bulunamadı` | Kurulu değil / PATH'te değil | `node araclar/doktor.js` çıktısındaki komutu çalıştır; Windows'ta terminali kapatıp aç |
| `node: command not found` ya da eski Node | Node 22 yok | `nvm install 22` (Windows: `winget install OpenJS.NodeJS.LTS`) |
| Ses çıkmıyor (`Unexpected server response`) | Edge sesi Microsoft tarafında kapandı | `node seslendir.js <is> --motor sistem` (Linux'ta önce `espeak-ng` kur) |
| Görsel bulunamadı | İlgili kaynak engelli | `node kaynak-dene.js` hangisinin çalıştığını söyler |

Kısacası kurulumdan emin olmak için tek komut: **`node araclar/doktor.js`**. Çıkış 0 hazır, 2 zorunlu bir şey eksik, 3 yalnız internet sorunu.
