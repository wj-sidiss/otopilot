# cinecode'dan alınanlar / Credits

Otopilot'un bazı parçaları [cinecode](https://github.com/sarpstar/cinecode) (Sarp Yıldız, MIT) projesinden gelir ya da onun fikrinden esinlenir.
Parts of Otopilot come from, or are inspired by, cinecode (Sarp Yıldız, MIT).

| Parça | Nereden | Nasıl |
|---|---|---|
| `data/ai-kaliplari.json` içindeki İngilizce ve Türkçe ek kalıplar, "üretilmiş gibi okunan" kelimeler; `lib/ai-kalip.js` ek kuralları (uzun çizgi, ünlem sayısı, "X değil, Y") | `references/writing.md` (6. bölüm) | Listeler alındı; çok genel tek kelimeler (ör. "journey", "let's") yanlış alarm verdiği için çıkarıldı |
| Stüdyo yönetmen sözlüğüne eklenen hareketler (dolly zoom, rack focus, FPV, ağır çekim…), ışıklar (Rembrandt, kelebek, high-key, low-key, teal-turuncu…), lensler (balık gözü, tilt-shift, flare) | `references/camera-moves.md`, `references/looks.md` (11. bölüm) | Adlar ve tanımlar; video üretim istemi için İngilizce karşılıkları yeniden yazıldı |
| Anlatım ses zinciri (alçak kesim, 3 kHz sunum, hafif sıkıştırma) ve müziğin konuşmanın altında otomatik kısılması (sidechain) | `references/sound.md` (ffmpeg tarifleri) | ffmpeg parametreleri alındı, kod bu depoda yazıldı |
| `docs/YAZIM-VE-CEKIM-REHBERI.md` | `references/writing.md`, `references/craft.md`, `references/camera-moves.md` | Fikirler kısaltılıp yeniden yazıldı |

3B modeller (`model-bul.js`): Poly Haven (CC0), NASA 3D Resources (kamu malı), Smithsonian Open Access, Sketchfab (yalnız CC0 ve CC BY, yazar atfıyla); her indirmede `KAYNAK.txt` lisans ve atıf metnini yazar.

**1.23.0'dan itibaren cinecode'un tamamı** (SKILL.md, AGENTS.md, references/, styles/, templates/, starter/, scripts/ ve LICENSE) `.claude/skills/cinecode/` içinde, değiştirilmeden bulunur: Otopilot'u Claude Code'da açan biri "kodla film yap" dediğinde cinecode yeteneği çalışır. Tanıtım görselleri/videoları (`docs/media`) ve kitin kendi testleri alınmadı. `styles/` içindeki bir kısım LemoLab'ın MIT lisanslı çalışmasıdır; lisansı `styles/LICENSE-lemo-opuscar` içinde korunur. Sürüm ve kaynak: `.claude/skills/cinecode/KAYNAK.txt`; güncelleme: `npm run cinecode-guncelle`.

```
MIT License

Copyright (c) 2026 Sarp Yıldız (@sarpstar)
```

Tam lisans metni: https://github.com/sarpstar/cinecode/blob/main/LICENSE
