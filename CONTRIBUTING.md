# Katkı / Contributing

Teşekkürler! / Thanks! Küçük, odaklı PR'lar en kolay birleşir. Small, focused PRs merge fastest.

## Başlamak / Getting started

```bash
node -v                    # Node 22+
npm ci --ignore-scripts
npm run kapi               # push öncesi hızlı kapı: sürüm=CHANGELOG, sır taraması, sözdizimi, belge (--tam testleri de koşar) / pre-push gate
npm run surum -- minor "Başlık"   # sürüm yükselt + CHANGELOG taslağı; doldurunca: npm run surum -- --yayinla (kapı + commit + vX.Y.Z etiketi + push) / release automation
npm test                   # tüm testler ağ/ücretli servis kullanmaz / tests never touch the network or paid services
```

- Tam `npm test` bellek az makinelerde bazı render testlerini düşürebilir; tek dosya çalıştır: `node --test test/<dosya>.test.js`. / On low-RAM machines run single files.
- Kodu değiştirdiysen **ilgili testi ekle**. / Add a test for every change.
- Yorumlar ve mesajlar Türkçe, kod/değişken adları da Türkçe ASCII; mevcut uslubu izle. / Comments and messages are Turkish; follow the existing style.
- Anahtar, `.env`, kişisel veri yok. Sır commit'leme. / Never commit keys or `.env`.
- Yeni görsel/ses kaynağı eklerken **lisans süzgecini** (NC/ND elenir) ve `node kaynak-dene.js`'i çalıştır. / New media sources must pass the license filter.

## Fikirler / Ideas (`good first issue` etiketli konular da var)

- Windows dışı platformlarda test/uyum (macOS PR'ı gibi) · README çevirileri · yeni ücretsiz, **CC0/açık lisanslı** kaynaklar · daha iyi yerel ses/dudak senkronu denemeleri.

## Güvenlik / Security

Güvenlik açığı bulursan herkese açık issue yerine GitHub'ın "Report a vulnerability" özelliğini kullan. / Please report vulnerabilities privately.
