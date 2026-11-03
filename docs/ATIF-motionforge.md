# motionforge'dan alınanlar / Credits

Otopilot'un bazı parçaları [motionforge](https://github.com/aykutucesai/motionforge) (Aykut Üçeş, MIT) projesinden gelir ya da onun fikrinden esinlenir.
Parts of Otopilot come from, or are inspired by, motionforge (Aykut Üçeş, MIT).

| Parça | Nereden | Nasıl |
|---|---|---|
| `data/ai-kaliplari.json`: 10 dilde "yapay zekâ gibi" duran yasak kalıplar ve kanca (ilk cümle) kalıpları | `skills/script-and-hooks/i18n/*.md` | Listeler olduğu gibi alınıp JSON'a çevrildi |
| Ses seviyesi eşitleme (-14 LUFS, iki geçiş), kontrol sayfası (12 kare) | `tools/loudness.sh`, `tools/contact_sheet.py` | Yalnızca fikir; kod bu depoda yeniden yazıldı (ffmpeg) |

```
MIT License

Copyright (c) 2026 motionforge contributors
```

Tam lisans metni: https://github.com/aykutucesai/motionforge/blob/main/LICENSE
