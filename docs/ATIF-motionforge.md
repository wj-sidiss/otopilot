# motionforge'dan alınanlar / Credits

Otopilot'un bazı parçaları [motionforge](https://github.com/aykutucesai/motionforge) (Aykut Üçeş, MIT) projesinden gelir ya da onun fikrinden esinlenir.
Parts of Otopilot come from, or are inspired by, motionforge (Aykut Üçeş, MIT).

| Parça | Nereden | Nasıl |
|---|---|---|
| `data/ai-kaliplari.json`: 10 dilde "yapay zekâ gibi" duran yasak kalıplar ve kanca (ilk cümle) kalıpları | `skills/script-and-hooks/i18n/*.md` | Listeler olduğu gibi alınıp JSON'a çevrildi |
| 3B sahneler (`sahne3d/`, `lib/sahne3d.js`), ses → ağız hareketi (`lib/ses-agzi.js`) | `templates/*-3d`, `engines/hyperframes/three`, `tools/mouth_curve.py` | Yalnızca fikir ve yapı (kare = f(t), three.js katmanı); şablonlar ve kod bu depoda yeniden yazıldı |
| Ses seviyesi eşitleme (-14 LUFS, iki geçiş), kontrol sayfası (12 kare) | `tools/loudness.sh`, `tools/contact_sheet.py` | Yalnızca fikir; kod bu depoda yeniden yazıldı (ffmpeg) |

```
MIT License

Copyright (c) 2026 motionforge contributors
```

Tam lisans metni: https://github.com/aykutucesai/motionforge/blob/main/LICENSE
