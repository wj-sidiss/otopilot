# Yazım ve çekim rehberi (ajanlar ve kullanıcılar için)

Senaryo, anlatım ve çekim planı yazarken kısa kurallar. Fikirler [cinecode](https://github.com/sarpstar/cinecode) (Sarp Yıldız, MIT) referanslarından alınıp bu depoya göre kısaltıldı; ayrıntı için `docs/ATIF-cinecode.md`.

## Yazı: akıllı, kısa, hedefe dönük
1. **Önce çok fikir, sonra tek fikir:** 5-6 açı düşün, biri kalsın. İlk akla gelen çoğu zaman herkesin yazdığıdır.
2. **Tek dönüş:** her videoda bir şey değişir (bir bilgi, bir yüzleşme, bir sürpriz). Dönüşü yoksa video bir liste olur.
3. **Sondan başla:** son cümle ya da son görüntü belliyse ortası ona doğru yazılır. Slogan ile bitirme.
4. **Anlatma, göster:** "çok hızlı" yerine hızı gösteren rakam ya da görüntü.
5. **Yüzde 30 kes:** metni yaz, her on kelimeden üçünü at; anlam bozulmuyorsa kısa hâli kalsın. Yüksek sesle, seçtiğin sesin hızında oku (sakin 2,0-2,5 kelime/sn, enerjik 2,6-3,2).
6. **Soğuk izleyici kontrolü:** konuyu bilmeyen biri okusa "ben", "bu", "o" kime ve neye işaret ediyor? Her etkinin bir nedeni var mı? Sessiz izleyen tek cümleyle ne olduğunu söyleyebilir mi?
7. **Somutluk testi:** cümleyi başka bir videoya koyabiliyorsan boştur. Araç adı, rakam, tarih, ne değişti.
8. **Yasak kalıplar:** `node ai-kalip-kontrol.js <iş>` (10 dil). Ayrıca: uzun çizgi (—) yok, ikiden fazla ünlem yok, "X değil, Y" yok, üç soyut isimlik liste ("umut, cesaret, sevgi") yok.
9. **Gerçek kişi ve olay:** her iddianın kaynağı olsun; emin olmadığın rakamı yazma.

## Çekim: bir hareket, bir neden
- Bir çekimde **tek ana kamera hareketi**, en çok bir de yan hareket (elde titreme, küçük tilt). Her hareketin nedeni olsun: takip et, göster, gerginlik (yaklaş), rahatlama (uzaklaş).
- **Hız kelimeleri:** yavaş = özne boyutu saniyede ≤ %10 değişir; orta = %10-25; hızlı = %25 üstü. Hızlı yana kayış = whip pan.
- **Yumuşatma:** doğrusal (makine, yürüyüş hızında takip) · ease-in (güç toplama, bitişler) · ease-out (kanca, ilk kare hızlı) · ease-in-out (ölçülü, kendi içinde tamam).
- **Kanca:** ilk 3 saniyede izleyici ne alacağını bilmeli (sayı, sonuç, çözüm). Selam, kanal tanıtımı, ısınma cümlesi yok. İlk cümle ekrandaki büyük yazıyla aynı ya da onun 2-5 kelimelik kısası.
- **Ritim:** her 3-4 saniyede yeni bir şey (bilgi, görüntü, dönüş).
- **Işık ve lens kelimeleri** (Stüdyo yönetmen modu): Rembrandt (klasik portre), kelebek (güzellik), yarım yüz (çatışma), high-key (temiz, umutlu), low-key (gerilim, noir), altın saat (nostalji), mavi saat (hüzün), teal-turuncu (sinema). Lens: 24mm geniş, 50mm doğal, 85mm portre (bokeh), balık gözü (komedi), tilt-shift (minyatür), anamorfik (geniş sinema).
- **Ses:** anlatım her zaman altyapıdan 15 dB üstte; müzik anlatım konuşurken kısılır (Stüdyo `kur` bunu kendisi yapar); hedef -14 LUFS.

## Uzunluğa göre yapı
- Kısa (15-60 sn): kanca → tek fikir → tek dönüş → tek eylem.
- Uzun (2 dk+): her 60-90 saniyede yeni bir soru ya da dönüş; her bölüm, sonrakinin cevapladığı açık bir soruyla biter.


## Ses: -14 LUFS ve "az efekt"

- **Seviye:** tüm videolar **-14 LUFS** entegre, gerçek tepe **≤ -1,5 dBTP** (Shorts, Reels, TikTok, YouTube standardı). Konuşma hep efektlerin ve müziğin önündedir: müzik konuşmanın ~6 dB altında, efekt ~12 dB altında durur ve konuşurken ayrıca kısılır.
- **Efekt ne zaman:** çoğu videoda **hiç koyma**. Koyacaksan yalnız ince bir `tik` (kısa, kuru) ya da `din` (yumuşak, tek nota), en az 1,5 sn arayla, dakikada en çok 6, yalnız anlamlı anlarda: başlık, rakam, bölüm geçişi.
- **Neden:** her geçişe konan whoosh/riser/boom yığını videoyu "yapay zekâ ürünü" gibi gösterir (izleyici geri bildirimi: "slop kokusunu efektler veriyor"). Görüntü iyi kesilmişse geçiş zaten kendi ritmini taşır.
- **Araçlar:** `node araclar/ses-denge.js analiz video.mp4` konuşmanın üstüne çıkan patlamaları zaman damgalı gösterir; `duzelt` patlamaları tutar ve -14 LUFS'a hizalar. `konu.json` → `sesEfektleri` (bkz. `KONU-JSON.md`) yalnız `tik`/`din` kabul eder.
