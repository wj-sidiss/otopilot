# VoxCPM2 sesleri / VoxCPM2 voices

Türkçesi önce, English below.

Bu klasörde **14 hazır yapay ses** var: 7 Türkçe ses ve 7 yerli anlatıcı (İngilizce, Almanca, İspanyolca, Fransızca,
Japonca, Rusça, Çince). Hepsi [voxcpm2-turkce-ses-tasarimi](https://github.com/alexturkey/voxcpm2-turkce-ses-tasarimi)
deposundan (Apache-2.0, Copyright 2026 Ali Haydar Ozturk) **değiştirilmeden** kopyalandı. Sesler VoxCPM2 modeliyle
yalnızca bir metin tarifinden tasarlandı; hiçbiri gerçek bir kişinin kaydından klonlanmadı.

Otopilot bu sesleri **senin bilgisayarında kurulu VoxCPM2 motoruyla** okutur (`seslendir.js --motor voxcpm`).
Motor bu depoda yoktur, aşağıdaki kurulumla bir kez kurulur. Ücretsizdir, anahtar ve internet istemez (kurulum hariç),
ama bir ekran kartı ister.

## Sesler

`*` = o dilin varsayılan sesi (`--motor voxcpm` ile ses adı verilmezse kullanılır).

| Ses (`--ses`) | Dil | Kısa tarif | Örnek |
|---|---|---|---|
| `voxcpm:tok_anlatici` * | tr | Çok derin, tok, olgun erkek anlatıcı; ağır, kontrollü, buyurgan, hafif gizemli. Belgesel, tarih, tanıtım. | [dinle](tok_anlatici/ornek_okuma.mp3) |
| `voxcpm:belgesel_hanim` | tr | Ellili yaşlarda, sıcak alto sesli kadın belgesel anlatıcısı; sakin, bilge, yavaş. Bilim, tarih, doğa. | [dinle](belgesel_hanim/ornek_okuma.mp3) |
| `voxcpm:cekici_spiker` | tr | Otuzlu yaşlarda karizmatik kadın haber sunucusu; dolgun, kadifemsi, vurgulu ve tutkulu. Haber, tanıtım. | [dinle](cekici_spiker/ornek_okuma.mp3) |
| `voxcpm:gizemli_bilge` | tr | Olgun, tok, güçlü erkek anlatıcı; gizemli ve buyurgan. Belgesel, gizem anlatımı. | [dinle](gizemli_bilge/ornek_okuma.mp3) |
| `voxcpm:haber_spikeri` | tr | Yetmiş yaşlarında, hafif buğulu deneyimli haber spikeri; sakin, otoriter, güven veren. | [dinle](haber_spikeri/ornek_okuma.mp3) |
| `voxcpm:masal_cadisi` | tr | Masal cadısı: pes, hafif genizli, sinsi tatlı. Korku ve masal anlatımı. | [dinle](masal_cadisi/ornek_okuma.mp3) |
| `voxcpm:yasli_bilge` | tr | Yaşlı bilge erkek; derin, kalın, gür, ağır ve buyurgan. Masal, karanlık hikâye, belgesel. | [dinle](yasli_bilge/ornek_okuma.mp3) |
| `voxcpm:anlatici_en` * | en | Ellili yaşlarda yerli İngilizce (Amerikan) erkek belgesel anlatıcısı; derin, sakin, sıcak. | [dinle](anlatici_en/ornek_okuma.mp3) |
| `voxcpm:anlatici_de` * | de | Ellili yaşlarda yerli Almanca (Hochdeutsch) erkek belgesel anlatıcısı; derin, sakin, sıcak. | [dinle](anlatici_de/ornek_okuma.mp3) |
| `voxcpm:anlatici_es` * | es | Ellili yaşlarda yerli İspanyolca (Kastilya) erkek belgesel anlatıcısı; derin, sakin, sıcak. | [dinle](anlatici_es/ornek_okuma.mp3) |
| `voxcpm:anlatici_fr` * | fr | Ellili yaşlarda yerli Fransızca (Paris) erkek belgesel anlatıcısı; derin, sakin, sıcak. | [dinle](anlatici_fr/ornek_okuma.mp3) |
| `voxcpm:anlatici_ja` * | ja | Ellili yaşlarda yerli Japonca (Tokyo) erkek belgesel anlatıcısı; derin, sakin, sıcak. | [dinle](anlatici_ja/ornek_okuma.mp3) |
| `voxcpm:anlatici_ru` * | ru | Ellili yaşlarda yerli Rusça (Moskova) erkek belgesel anlatıcısı; derin, sakin, sıcak. | [dinle](anlatici_ru/ornek_okuma.mp3) |
| `voxcpm:anlatici_zh` * | zh | Ellili yaşlarda yerli Çince (Mandarin, Pekin) erkek belgesel anlatıcısı; derin, sakin, sıcak. | [dinle](anlatici_zh/ornek_okuma.mp3) |

Her klasörde: `ses.json` (ses kartı: İngilizce tarif, tasarım metni, tohum, `"yapay": true`), `referans.flac`
(motorun sesi taşıdığı kayıpsız referans kaydı), `ornek_okuma.mp3` (örnek dinleme) ve `ornek_okuma_metni.txt`
(örneğin metni). `okunus_sozlugu.tsv`: Türkçe metinde yabancı kelimelerin okunuşu (`GPU` → `ci pi yu`); Otopilot bunu
Türkçe metne uygular, VoxCPM de kendi kopyasını uygular. Yeni kelime eklerken biçim `yazılış<TAB>okunuş`.

Listeyi ve kurulum durumunu görmek için: `node seslendir.js --liste-sesler`

## Motoru kurma (bir kez)

Gerekenler: Windows 10/11 ve en az 4 GB'lık NVIDIA ekran kartı (sürücü 570 ve üstü), 64-bit Python 3.10–3.13
(`winget install Python.Python.3.12`), Git, ~8 GB boş disk. Mac (Apple Silicon): `bash scripts/kur.sh`.
AMD/Intel kartlar için deneysel Vulkan yolu: kur komutunun sonuna `-Vulkan`. Ayrıntılar kaynak deponun README ve AGENTS
dosyalarında.

```powershell
git clone https://github.com/alexturkey/voxcpm2-turkce-ses-tasarimi.git C:\voxcpm2
cd C:\voxcpm2
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\kur.ps1 -Kok C:\vox
```

~10 dakika, ~3,7 GB indirme (model + motor + CUDA dosyaları, hepsi sha256 ile doğrulanır). Son satır `KURULUM_OK`
olmalı. Sonra bu projenin `.env` dosyasına klonlanan deponun klasörünü yaz (kur.ps1'in `-Kok` klasörü **değil**):

```
VOXCPM_KOK=C:\voxcpm2
```

Kullanım:

```bash
node seslendir.js --liste-sesler                        # "Kurulum: hazır" görünmeli
node seslendir.js <is> --ses voxcpm:tok_anlatici        # belirli ses
node seslendir.js <is> --motor voxcpm                   # dilin varsayılan VoxCPM sesi
node seslendir.js --test ornek.mp3 --ses voxcpm:anlatici_en   # kısa örnek
```

`konu.json` içinde: `"ses": "voxcpm:belgesel_hanim"` (motor `otomatik` kalabilir: VoxCPM kuruluysa o kullanılır,
kurulu değilse Edge'in o dildeki sesine düşülür). Kendi tasarladığın ses (VoxCPM klasöründe `ses_tasarim.tasarla`):
`voxcpm:<ad>/<çeşit>`.

Bilinmesi gerekenler:
- Hız: GTX 1050 Ti'de 1 sn konuşma için ~2 sn işlem; her sesin ilk kullanımında ~50 sn referans kodlaması (sonra
  önbellekten). Uzun videoda seslendirme dakikalar sürer; ilerleme `@@ILERLEME` satırlarıyla görünür.
- Aynı anda tek ekran kartı işi: iki seslendirme aynı anda başlarsa ikincisi sıra bekler (bekleme zaman aşımına sayılmaz).
- Bir paragraf okunamazsa (ör. bir cümle bitmedi): iş çıkış kodu 4 ile durur, biten paragraflar korunur; o cümleyi bölüp
  aynı komutu yeniden çalıştır. Motor `otomatik` olsa da bu durumda Edge'e geçilmez (hiç paragraf bitmediyse geçilir).
- Metin: VoxCPM rakam ve tırnak okumaz. Türkçe ve İngilizce sayılar otomatik yazıya çevrilir; diğer dillerde rakam
  kalırsa iş başlamadan durur (sayıyı yazıyla yaz). Cümleler satır satır okunur, çok uzun cümle virgülden bölünür.
- `sesHizi` (`+7%` gibi) ses üretildikten sonra uygulanır. Kelime zamanları cümle zamanlarından yaklaşık hesaplanır.

## Etik

Bu sesler **yapaydır**: metin tarifinden tasarlandı, gerçek bir kişinin sesi ya da taklidi değildir. Gerçek bir kişiyi
taklit etmek, dolandırıcılık, yanıltma ve dezenformasyon yasaktır (VoxCPM2 model kartı da yasaklar). Ürettiğin içeriği
yayımlarken yapay zekâ ile üretildiğini belirt (YouTube'da "değiştirilmiş/sentetik içerik" kutusu; AB'de Yapay Zekâ
Yasası md. 50). Motor sese filigran gömmez. Ses klonlama bu projede yoktur; kaynak depodaki klonlama bölümü yalnız
kendi sesin ya da sahibinin açık izniyle kullanılabilir.

## Lisans

Sesler ve sözlük: Apache-2.0, Copyright 2026 Ali Haydar Ozturk ([LICENSE](LICENSE), [NOTICE](NOTICE)). Kaynak:
https://github.com/alexturkey/voxcpm2-turkce-ses-tasarimi. Sesler VoxCPM2 (OpenBMB, Apache-2.0) ve audio.cpp
(ShugoAI LLC, Apache-2.0) ile üretildi. Otopilot bu projelerle bağlantılı değildir.

---

## English

This folder holds **14 bundled synthetic voices**: 7 Turkish voices and 7 native narrators (English, German, Spanish,
French, Japanese, Russian, Chinese), copied **unchanged** from
[voxcpm2-turkce-ses-tasarimi](https://github.com/alexturkey/voxcpm2-turkce-ses-tasarimi) (Apache-2.0, Copyright 2026
Ali Haydar Ozturk). They were designed with VoxCPM2 from a text description only; none was cloned from a recording.
Otopilot reads them through **the VoxCPM2 engine installed on your own computer** (`seslendir.js --motor voxcpm`);
the engine is not part of this repository. Free, no API key, no internet after install, needs a GPU.

### Voices

`*` = default voice for that language (used with `--motor voxcpm` when no voice is given).

| Voice (`--ses`) | Lang | Short description | Sample |
|---|---|---|---|
| `voxcpm:tok_anlatici` * | tr | Exceptionally deep, dense mature male narrator; heavy, controlled, commanding, slightly mysterious. | [listen](tok_anlatici/ornek_okuma.mp3) |
| `voxcpm:belgesel_hanim` | tr | Woman in her fifties with a warm alto; calm, wise, slow documentary narrator. | [listen](belgesel_hanim/ornek_okuma.mp3) |
| `voxcpm:cekici_spiker` | tr | Charismatic evening news anchor in her thirties; full, velvety, expressive. | [listen](cekici_spiker/ornek_okuma.mp3) |
| `voxcpm:gizemli_bilge` | tr | Mature, deep, powerful male narrator; mysterious and commanding. | [listen](gizemli_bilge/ornek_okuma.mp3) |
| `voxcpm:haber_spikeri` | tr | Seasoned news anchor around seventy, slightly husky; calm, authoritative. | [listen](haber_spikeri/ornek_okuma.mp3) |
| `voxcpm:masal_cadisi` | tr | Fairy-tale witch: low, slightly nasal, slyly sweet. Horror and fairy tales. | [listen](masal_cadisi/ornek_okuma.mp3) |
| `voxcpm:yasli_bilge` | tr | Old wise man; deep, thick, booming, heavy and commanding. | [listen](yasli_bilge/ornek_okuma.mp3) |
| `voxcpm:anlatici_en` * | en | Native English (General American) male documentary narrator in his fifties; deep, calm, warm. | [listen](anlatici_en/ornek_okuma.mp3) |
| `voxcpm:anlatici_de` * | de | Native German (Hochdeutsch) male documentary narrator in his fifties; deep, calm, warm. | [listen](anlatici_de/ornek_okuma.mp3) |
| `voxcpm:anlatici_es` * | es | Native Spanish (Castilian) male documentary narrator in his fifties; deep, calm, warm. | [listen](anlatici_es/ornek_okuma.mp3) |
| `voxcpm:anlatici_fr` * | fr | Native French (Parisian) male documentary narrator in his fifties; deep, calm, warm. | [listen](anlatici_fr/ornek_okuma.mp3) |
| `voxcpm:anlatici_ja` * | ja | Native Japanese (Tokyo standard) male documentary narrator in his fifties; deep, calm, warm. | [listen](anlatici_ja/ornek_okuma.mp3) |
| `voxcpm:anlatici_ru` * | ru | Native Russian (Moscow) male documentary narrator in his fifties; deep, calm, warm. | [listen](anlatici_ru/ornek_okuma.mp3) |
| `voxcpm:anlatici_zh` * | zh | Native Mandarin Chinese (Beijing) male documentary narrator in his fifties; deep, calm, warm. | [listen](anlatici_zh/ornek_okuma.mp3) |

Each folder: `ses.json` (voice card: English prompt, design text, seeds, `"yapay": true`), `referans.flac` (lossless
reference recording that carries the voice), `ornek_okuma.mp3` (sample) and `ornek_okuma_metni.txt` (its text).
`okunus_sozlugu.tsv` is the Turkish pronunciation dictionary (`written<TAB>spoken`).

### Installing the engine (once)

Windows 10/11 with an NVIDIA GPU of 4 GB or more (driver 570+), 64-bit Python 3.10–3.13, Git, ~8 GB free disk.
macOS (Apple Silicon): `bash scripts/kur.sh`. AMD/Intel: experimental Vulkan build, add `-Vulkan`.

```powershell
git clone https://github.com/alexturkey/voxcpm2-turkce-ses-tasarimi.git C:\voxcpm2
cd C:\voxcpm2
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\kur.ps1 -Kok C:\vox
```

About 10 minutes and 3.7 GB of sha256-verified downloads; the last line must be `KURULUM_OK`. Then put the cloned
repository folder (not the `-Kok` folder) into this project's `.env`: `VOXCPM_KOK=C:\voxcpm2`. Check with
`node seslendir.js --liste-sesler`, then use `node seslendir.js <job> --ses voxcpm:anlatici_en` or
`node seslendir.js <job> --motor voxcpm` (default voice of the job language), or `"ses": "voxcpm:<name>"` in
`konu.json`. With engine `otomatik` a VoxCPM voice falls back to Edge when VoxCPM is not installed.

Notes: about 2 s of compute per 1 s of speech on a GTX 1050 Ti, plus ~50 s the first time a voice is used; one GPU job
at a time (a second job waits, the wait does not count toward the timeout); digits and quotes are not read by VoxCPM
(Turkish and English numbers are spelled out automatically, other languages need numbers written as words); text is
read sentence by sentence; `sesHizi` is applied afterwards. If a paragraph fails (e.g. a sentence did not finish), the
job stops with exit code 4 and keeps the finished paragraphs; split that sentence and run the same command again. With
engine `otomatik` it does not switch to Edge in that case (it does when no paragraph finished at all).

### Ethics

These voices are **synthetic**, designed from text descriptions; they are not and do not imitate any real person.
Impersonation, fraud, deception and disinformation are prohibited (the VoxCPM2 model card forbids them too). Label
everything you publish as AI-generated (YouTube "altered or synthetic content"; EU AI Act Art. 50). The engine does
not embed a watermark. This project contains no voice cloning.

### License

Voices and dictionary: Apache-2.0, Copyright 2026 Ali Haydar Ozturk ([LICENSE](LICENSE), [NOTICE](NOTICE)). Source:
https://github.com/alexturkey/voxcpm2-turkce-ses-tasarimi. Built with VoxCPM2 (OpenBMB, Apache-2.0) and audio.cpp
(ShugoAI LLC, Apache-2.0). Otopilot is independent of these projects.
