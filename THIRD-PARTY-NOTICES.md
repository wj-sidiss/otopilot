# Üçüncü taraf bildirimleri / Third-party notices

Otopilot (MIT, `LICENSE`) aşağıdaki açık kaynak çalışmalardan yararlanır. Ayrıntılı atıf sayfaları `docs/` altındadır.

## Depoya giren ya da çalışma zamanında kullanılan

| Parça | Lisans | Nasıl kullanılır | Ayrıntı |
|---|---|---|---|
| [cinecode](https://github.com/sarpstar/cinecode) (Sarp Yıldız) | MIT (stil kütüphanesinin bir kısmı LemoLab, MIT) | `.claude/skills/cinecode/` içinde değiştirilmeden; `npm run cinecode-guncelle` ile güncellenir | [`docs/ATIF-cinecode.md`](docs/ATIF-cinecode.md) |
| [motionforge](https://github.com/aykutucesai/motionforge) (Aykut Üçeş) | MIT | Yasak kalıp/kanca listeleri ve 3B sahne fikri; kod yeniden yazıldı | [`docs/ATIF-motionforge.md`](docs/ATIF-motionforge.md) |
| [Lensfun](https://github.com/lensfun/lensfun) | Veritabanı CC BY-SA 3.0, kütüphane LGPL-3.0 | Depoya girmez; `lens-kur` kullanıcının makinesine indirir, ffmpeg `lensfun` filtresiyle uygulanır | [`docs/ATIF-lensfun.md`](docs/ATIF-lensfun.md) |
| [three.js](https://github.com/mrdoob/three.js) | MIT | 3B sahneler (`sahne3d/`) ve cinecode filmleri çizilirken CDN'den ya da npm'den yüklenir | |
| [@anthropic-ai/sdk](https://github.com/anthropics/anthropic-sdk-typescript), [msedge-tts](https://github.com/Migushthe2nd/MsEdgeTTS), [ws](https://github.com/websockets/ws) | MIT | npm bağımlılıkları (`package.json`) | |
| Poly Haven, NASA 3D Resources, Smithsonian Open Access, Sketchfab (CC0 / CC BY) | CC0, kamu malı, CC BY | `model-bul.js` ile indirilen 3B modeller; her indirmede `KAYNAK.txt` ve atıf metni yazılır, depoya girmez | `model-bul.js` |
| Wikimedia Commons, Openverse, NASA, The Met, Art Institute of Chicago, Cleveland, Rijksmuseum | CC0, CC BY, kamu malı (NC/ND elenir) | `gorsel-bul.js`; atıflar işin `ATIF.txt` ve `YAYIN-PAKETI.md` dosyalarına yazılır | [`docs/demo-credits.txt`](docs/demo-credits.txt) |

## Fikir ve yaklaşım olarak esinlenilen (kod kopyalanmadı)

| Proje | Lisans | Otopilot'taki karşılığı |
|---|---|---|
| [auto-editor](https://github.com/WyattBlue/auto-editor) | Unlicense | `araclar/medya.js sessizlik` (ffmpeg ile yeniden yazıldı) |
| [PySceneDetect](https://github.com/Breakthrough/PySceneDetect) | BSD-3-Clause | `araclar/medya.js sahneler` (ffmpeg `scene` skoru) |
| [Real-ESRGAN](https://github.com/xinntao/Real-ESRGAN) / [ncnn-vulkan](https://github.com/xinntao/Real-ESRGAN-ncnn-vulkan) | BSD-3-Clause | `araclar/medya.js yukselt` (isteğe bağlı, kullanıcının kendi kurulumu) |

## Kullanıcı tarafında ayrıca kurulan (depoda yok)

FaceFusion, MuseTalk, VoxCPM2 (sesler `sesler/voxcpm2/`, Apache-2.0), yt-dlp, Chrome/Edge, ffmpeg: Otopilot bunları paketlemez ve indirmez; kullanıcı kendi lisans koşullarıyla kurar. Hangi açık kaynak aracın neden girdiği ya da girmediği, ve lisans uyarıları: [`docs/KAYNAKLAR.md`](docs/KAYNAKLAR.md).

Marka ve model adları yalnızca ürünü tanımlamak içindir; ilgili şirketlerle bağlantı ya da onay anlamına gelmez. / Trademarks identify products only and imply no affiliation or endorsement.
