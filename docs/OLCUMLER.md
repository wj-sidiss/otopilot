# Ölçümler

Bu sayfadaki her satır **gerçek bir makinede** `node araclar/olcum.js --ses --belgeye` ile ölçüldü. Her kodlama ölçümü 3 kez tekrarlanır ve **ortanca** yazılır (dizüstünde ısınma tek ölçümü 2 kata kadar oynatır; tüm koşular JSON'da). Ham sonuçlar `olcumler/` klasöründe
JSON olarak duruyor (işlemci, ekran kartı, sürücü, ffmpeg ve Otopilot sürümü dahil). Tahmin ya da üretici rakamı yok.

## Ne ölçülüyor

| Ölçüm | Tanım |
|---|---|
| İşlemci (normal) | 20 sn, 1080x1920, 30 fps, gürültülü test görüntüsü (`testsrc2` + zamansal gürültü: gerçek fotoğraf/klip kadar zor kodlanır), Otopilot'un final ayarı `libx264 medium crf 20`. Parantez içi gerçek zaman oranı: 2.0x = 20 sn video 10 sn'de. |
| İşlemci (hafif mod) | Aynı girdi, `libx264 veryfast crf 21`: donanım kodlayıcısı olmayan zayıf makinede (≤ 4 mantıksal çekirdek ya da < 12 GB) kendiliğinden seçilir. |
| Donanım kodlayıcıları | Makinede **çalışan her** kodlayıcı ayrı ayrı: NVIDIA NVENC, AMD AMF, Intel Quick Sync (dahili Intel grafikte bile), Apple VideoToolbox, Windows MediaFoundation. Otopilot bu sırayla ilk çalışanı seçer. |
| Yerel ses | `seslendir.js --test` ile sabit bir Türkçe cümle: VoxCPM2 (`voxcpm:tok_anlatici`, ekran kartı) ve Piper (işlemci, internetsiz), **program/model yükleme dahil**. Kurulu değilse yazılmaz. |

Bir videonun toplam süresi bunlara ek olarak görsel indirme (internete bağlı) ve Edge sesinden (internete bağlı) oluşur;
o adımlar makineden çok bağlantıya bağlı olduğu için burada ölçülmez.

## Sonuçlar

<!-- OLCUM-BASLA -->
| Tarih | İşlemci | Bellek | Ekran kartı | Profil | İşlemci (normal) | İşlemci (hafif mod) | Donanım kodlayıcıları | Yerel ses (süre → ses uzunluğu) | Sürüm |
|---|---|---|---|---|---|---|---|---|---|
| 2026-11-21 | 13th Gen Intel(R) Core(TM) i7-13620H | 15.7 GB | NVIDIA GeForce RTX 5060 Laptop GPU 8 GB | orta | 52 sn (0.38x) | 12.8 sn (1.56x) | NVENC 1.2 sn · Quick Sync 4.1 sn · MediaFoundation 4.4 sn | Piper 0.9 sn → 8.5 sn | 1.28.0 |
<!-- OLCUM-BIT -->

## Kendi ölçümünü ekle

```bash
node araclar/olcum.js --ses        # yalnız ölçer ve satırı yazdırır (dosyaya bir şey yazmaz)
```

Çıkan satırı GitHub'da **Ölçüm paylaş** şablonuyla gönder (ya da `--belgeye` ile bu tabloya ekleyip PR aç).
Özellikle eski/düşük kartlar (GTX 1050/1650, 4 GB), ekran kartsız dizüstüler ve AMD/Intel kartlar değerli.
Satırda kişisel bilgi yoktur: yalnız işlemci/kart modeli, bellek, sürücü ve sürümler.
