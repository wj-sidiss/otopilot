# Mimari harita / Architecture map

Otopilot kök klasörde düz betikler halinde durur; her betik tek iş yapar, ortak kod `lib/` içindedir. Bu sayfa neyin nerede olduğunu gösterir. Ajan için akış ve komutlar [`AGENTS.md`](../AGENTS.md), kullanıcı için [`README.md`](../README.md).

## Katmanlar

```
panel.js + panel-public/  ─┐   tarayıcı arayüzü (yalnız 127.0.0.1, 15 dil)
komut satırı betikleri     ─┤   kök *.js / *.cjs  → her biri bir adım
                            ├─► lib/                ortak kod (hata/çıkış kodları, kilit, ayar, render, ses, görsel, stüdyo…)
araclar/                   ─┘   yardımcı araçlar (medya, cinecode eşitleme, Sidis şablonu, klon-video)
ai-infapp/                      AI influencer + Etsy/fotoroman/reklam stüdyoları (ayrı sunucu, 4200)
video-indirici/                 link yapıştır → indir aracı (ayrı sunucu, 4190)
.claude/skills/cinecode/        kodla film yeteneği (üçüncü taraf, değiştirilmeden)
data/, diller/, sesler/         veri tabloları, arayüz çevirileri, hazır sesler
uretim/                         ÇIKTILAR (repoya girmez)
Filmler/                        kodla film çalışma klasörleri (repoya girmez)
test/                           node:test; ağa ve ücretli servise dokunmaz
```

## Komut satırı betikleri (kök)

| Aşama | Betikler |
|---|---|
| İş açma ve yönetim | `yeni-is.js`, `kaynak-dene.js`, `kapi.js` (yayın kapısı), `surum.js` (sürüm), `lib/guncelle.js` |
| Senaryo | `senaryo-yaz.js`, `senaryo-claude.js`, `ai-kalip-kontrol.js`, `diksiyon.js`, `trend-ara.js`, `baslik-analiz.js`, `viral-analiz.js` |
| Görsel / video kaynağı | `gorsel-bul.js`, `gorsel-cek.js`, `gorsel-uret.js`, `video-bul.js`, `model-bul.js` (3B), `portre-cek.js` |
| Ses | `seslendir.js`, `video-seslendir.js`, `altyazi-cevir.js`, `geri-sayim.js` |
| Kurgu ve çıktı | `video-yap.js`, `kapak-yap.js`, `formul-kart.js`, `prompt-kart.js`, `yayin-paketi.js`, `marka-yap.js`, `shorts-kes.cjs`, `kesit-bul.cjs`, `toplu-uret*.cjs` |
| AI klip hatları | `studyo.js` (AI Stüdyo), `film.js` (karakterli dizi), `vidiq-klip.js`, `klip-yerlestir.js`, `dudak-fal.js`, `dudak-musetalk.js` |
| Yardımcı araçlar | `araclar/medya.js` (sessizlik kesme, sahne bulma, yükseltme), `araclar/cinecode-esitle.js`, `araclar/klon-video/`, `araclar/sidis-video/` |

## Çıkış kodları (tüm betikler)

`0` tamam · `1` genel hata · `2` girdi/ayar · `3` ağ/servis (30 sn bekleyip yeniden dene) · `4` yetersiz sonuç · `5` disk/bellek · `6` aynı iş çalışıyor · `7` maliyet sınırı. Ayrıntı: `lib/ortak.js` (`CIKIS`) ve README "Panelsiz kullanım".

## Güvenlik sınırları

Panel yalnız `127.0.0.1`'e bağlanır, `Origin`/`Host` denetler, yolları kök klasörde tutar; anahtarlar yalnız `.env`'de durur. Ücretli adımlar (vidIQ kredisi, Claude) önce kuru çalışma yapar ve açık onay (`--onay`) ister. Ayrıntı: [`SECURITY.md`](../SECURITY.md).

## Yeni araç eklemek

1. Mantığı `lib/<ad>.js` içine, komut satırını ince bir betiğe koy (`araclar/` ya da kök).
2. Hata için `OrtakHata` ve `CIKIS` kullan; betik `.catch(ortak.bitir)` ya da `ortak.bitir(e)` ile bitsin.
3. `test/<ad>.test.js`: gerçek ağ/ücretli servis yok; ffmpeg gerekiyorsa ffmpeg yokken kendiliğinden atlansın.
4. `AGENTS.md`, `README.md`, `CHANGELOG.md` ve gerekiyorsa `THIRD-PARTY-NOTICES.md` güncelle; `npm run kapi -- --ilgili`.
