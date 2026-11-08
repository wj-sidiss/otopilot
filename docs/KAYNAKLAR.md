# Açık kaynak kataloğu: Otopilot'a ne girdi, ne girebilir, ne girmemeli

Bu liste, 8 Kasım 2026'da GitHub'dan (`gh search repos`, yıldız/lisans/son güncelleme) ve web'den taranarak çıkarıldı. **Lisans sütunu deponun kod lisansıdır; model ağırlıklarının lisansı kodundan ayrı olabilir.** Ticari kullanmadan önce her modelin kendi `LICENSE` ve model kartını oku. Sayılar zamanla değişir.

Kural: Otopilot MIT'tir. **MIT, Apache-2.0, BSD ve benzeri serbest lisanslı** kod atıfla alınabilir. **GPL/AGPL kodu depoya kopyalanmaz** (depoyu da GPL yapar); bunlardan yalnızca fikir alınır ya da kullanıcı kendi makinesinde ayrı kurup çağırır.

## 1. Bu sürümde depoya girenler

| Ne | Nereden esinlendi / lisans | Nasıl çalışır |
|---|---|---|
| `node araclar/medya.js sessizlik` | [auto-editor](https://github.com/WyattBlue/auto-editor) (Unlicense, 5,8 bin ★): konuşma kaydındaki sessiz boşlukları kesme fikri | Yalnız ffmpeg `silencedetect` + `concat`; ek kurulum yok. Kelime başı/sonu kırpılmasın diye kesimlerin kenarında `--pay` kadar ses bırakılır |
| `node araclar/medya.js sahneler` | [PySceneDetect](https://github.com/Breakthrough/PySceneDetect) (BSD-3, 5,4 bin ★): plan değişimi bulma | ffmpeg `scene` skoru; zaman damgaları ya da `--kes` ile klip klip dosya |
| `node araclar/medya.js yukselt` | [Real-ESRGAN](https://github.com/xinntao/Real-ESRGAN) (BSD-3, 37 bin ★) ve [ncnn-vulkan sürümü](https://github.com/xinntao/Real-ESRGAN-ncnn-vulkan) | Varsayılan: lanczos + hafif keskinleştirme (ücretsiz, anında). `REALESRGAN_KOK` kendi kurduğun ncnn-vulkan klasörünü gösterirse resimde yapay zekâ kullanılır. **Yapay zekâ yolu bu depoda denenmedi**; Otopilot ikili dosya indirmez |

## 2. Güçlü adaylar (bu makinede: RTX 5060 Laptop, 8 GB VRAM)

| Aday | Lisans (kod) | Ne kazandırır | Not |
|---|---|---|---|
| [ACE-Step 1.5](https://github.com/ace-step/ACE-Step-1.5) | MIT, 14,5 bin ★, bugün güncel | Yerel, ücretsiz müzik üretimi (intro, arka plan müziği) | 8 GB'de topluluk raporları var; kurulum GB'larca model indirir. Vidiq müziğine ve elle sentezlenen müziğe alternatif |
| [Chatterbox Multilingual](https://github.com/resemble-ai/chatterbox) | MIT | **Türkçe dahil** çok dilli, sıfırdan ses klonlama (10 sn örnek) | Her çıktıya PerTh filigranı gömülür (kapatılamaz); yayında yapay zekâ sesi belirt. Model kartından lisansı doğrula |
| [Kokoro](https://github.com/nazdridoy/kokoro-tts) / Kokoro-82M | Apache-2.0 / MIT sarmalayıcı | Küçük, hızlı, CPU'da çalışan yerel TTS (İngilizce ağırlıklı); Edge sesine çevrimdışı alternatif | Türkçe desteği zayıf; İngilizce kanallar için |
| [LTX-Video](https://github.com/Lightricks/LTX-Video) / [LTX-2](https://github.com/Lightricks/LTX-2) | Apache-2.0, 11 bin ★ | Yerel resimden videoya; vidIQ kredisi harcamaz | 8 GB için GGUF/Q4 gerekir; 5 sn klip dakikalar sürer; ağırlık lisansını doğrula |
| [Wan 2.1 / 2.2](https://github.com/Wan-Video/Wan2.2) | Apache-2.0, 18 bin ★ | Yerel video üretimi (küçük model 8 GB'ye sığar, tam kalite 24 GB+) | LTX'e göre daha ağır |
| [LatentSync](https://github.com/bytedance/LatentSync) | Apache-2.0, 6,3 bin ★ | Yerel dudak senkronu (fal.ai'ye ücretsiz alternatif) | VRAM ihtiyacı sınırda; `dudak-fal.js` ile aynı arayüzde sarmalanabilir |
| [MuseTalk](https://github.com/TMElyralab/MuseTalk) | kod: "other" (doğrula) | Gerçek zamanlı dudak senkronu; `dudak-musetalk.js` bağlayıcısı zaten var | Bu makinede `C:\MuseTalk` indirilmiş ama ağırlıklar ve ortam kurulu değil |
| [WhisperX](https://github.com/m-bain/whisperX) | BSD-2, 25 bin ★ | Kelime düzeyinde zaman damgası + hizalama (karaoke altyazı) | `faster-whisper` ile aynı ailede; ek kurulum ister |
| [Motion Canvas](https://github.com/motion-canvas/motion-canvas) | MIT, 19,7 bin ★ | Kodla anlatım animasyonu (Remotion'a lisans açısından rahat alternatif) | Yeni bir araç zinciri |
| [YouDub-webui](https://github.com/liuzhao1225/YouDub-webui) | Apache-2.0, 5,8 bin ★ | YouTube videosunu çevirip seslendirme hattı fikri | Kendi hatlarımızla (`altyazi-cevir.js`, `video-seslendir.js`) birleştirilebilir |
| [Pixelle-Video](https://github.com/ATH-MaaS/Pixelle-Video) | Apache-2.0, 29,9 bin ★ | Tam otomatik kısa video motoru: mimari ve istem akışı incelenebilir | Çoğu Çince arayüz |
| [NarratoAI](https://github.com/linyqh/NarratoAI) | MIT, 11,7 bin ★ | Mevcut videoya yapay zekâ anlatımı + otomatik kurgu | Çince ağırlıklı |
| [claude-code-video-toolkit](https://github.com/digitalsamba/claude-code-video-toolkit) | MIT, 2,5 bin ★, bugün güncel | Claude Code için video becerileri (ffmpeg, Remotion, ACE-Step, LTX-2, Ideogram, ses klonlama) ve şablonlar | Bulut GPU (Modal/RunPod) ister; beceri/şablon fikirleri uyarlanabilir |
| [Demucs](https://github.com/facebookresearch/demucs) | MIT, 10 bin ★ | Müzikten vokal/enstrüman ayırma (anlatımın altına müzik hazırlarken) | Depo 2024'ten beri güncellenmedi |

## 3. Dikkat: ücretsiz görünür, ama serbest değil

| Araç | Neden dikkat |
|---|---|
| [Remotion](https://github.com/remotion-dev/remotion) (`araclar/sidis-video` kullanıyor) | Lisansı özel ("other"): küçük ekipler/bireyler için serbest, belirli büyüklüğün üstündeki şirketler için ücretli. Ticari kullanmadan önce [remotion.dev/license](https://www.remotion.dev/license) sayfasını oku |
| [OpenMontage](https://github.com/OpenMontageInc/OpenMontage) (AGPL-3.0, 78 bin ★) | Ağ üzerinden hizmet verirsen kaynak kodunu açman gerekir. **Kodu Otopilot'a kopyalama**; bu makinede ayrı klasörde duruyor, yalnızca fikir kaynağı |
| [F5-TTS](https://github.com/SWivid/F5-TTS) (kod MIT, 15 bin ★) | Ağırlıklar ticari kullanıma kapalı (CC-BY-NC) olarak biliniyor; **doğrula** |
| [XTTS / Coqui](https://github.com/coqui-ai/TTS) | Model lisansı ticari kullanıma kısıtlı (CPML); kod MIT olsa da ağırlıklar değil |
| [Fish-Speech](https://github.com/fishaudio/fish-speech) (33 bin ★) | Lisans "other"; ağırlıklar ticari kullanıma kapalı olabilir, **doğrula** |
| MusicGen / AudioCraft | Ağırlıklar CC-BY-NC olarak biliniyor, ticari videoda kullanma; yerine ACE-Step |
| [HunyuanVideo](https://github.com/Tencent-Hunyuan/HunyuanVideo) | Lisans "other": bölge ve kullanım kısıtları var, **doğrula** |
| [Wav2Lip](https://github.com/Rudrabha/Wav2Lip) | Kullanım koşulları açık değil (lisans dosyası yok / araştırma amaçlı); ticari işte kullanma |
| [Seed-VC](https://github.com/Plachtaa/seed-vc), [Voice-Pro](https://github.com/abus-aikorea/voice-pro), [ComfyUI](https://github.com/Comfy-Org/ComfyUI) | GPL-3.0: kopyalanamaz, ayrı araç olarak kullanılır |
| [Real-ESRGAN-ncnn-vulkan](https://github.com/xinntao/Real-ESRGAN-ncnn-vulkan) | Son ikili sürüm 2022 tarihli ve sağlama toplamı yayımlanmıyor; Otopilot bu yüzden indirmez |
| [ShortGPT](https://github.com/RayVentura/ShortGPT) (MIT, 8 bin ★) | Şubat 2025'ten beri güncellenmedi; fikir kaynağı, bağımlılık yapma |

## 4. Nasıl yeni kaynak eklenir

1. Kod lisansını ve model/ağırlık lisansını ayrı ayrı oku. NC, ND, GPL, AGPL, "araştırma amaçlı" = Otopilot'a kopyalama.
2. Küçük, ffmpeg gibi tek bağımlılıkla yapılabilen şeyleri **sıfırdan yaz** ve atıf ekle (bu sayfanın birinci bölümü gibi).
3. Büyük model/ikili indirmeyi Otopilot kendi başına yapmaz: kullanıcı kurar, `.env`'de yolunu verir (`FACEFUSION_KOK`, `MUSETALK_KOK`, `REALESRGAN_KOK` gibi), Otopilot bağlayıcıyı sağlar.
4. Test ekle, [`THIRD-PARTY-NOTICES.md`](../THIRD-PARTY-NOTICES.md) dosyasına satır ekle, `CHANGELOG.md`'ye yaz.
