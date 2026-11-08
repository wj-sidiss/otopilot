# Güvenlik politikası / Security policy

**TR** — Otopilot kendi bilgisayarında çalışır: panel yalnızca `127.0.0.1`'de açılır, hesap ve izleme yoktur, API anahtarları yalnız yerel `.env` dosyasında durur. Yine de bir açık bulursan:

- **Herkese açık issue açma.** GitHub'da **Security → Report a vulnerability** (özel bildirim) kullan.
- Ne olduğunu, nasıl yeniden üretileceğini ve etkilenen sürümü yaz. Gerçek anahtar, kişisel veri ya da başkasının hesabına erişim içeren kanıt ekleme.
- Bildirim kabul edilince düzeltme bir sonraki sürümde yayınlanır; sürüm notunda (`CHANGELOG.md`) teşekkürle anılırsın (istemezsen belirt).

**Desteklenen sürüm:** yalnızca en son sürüm (`npm run guncelle`). Eski sürümlere yama yapılmaz.

**Kapsam içi:** panelin yerel API'leri, dosya yolu/komut enjeksiyonu, anahtarların sızması, `.env`/`uretim/` içeriğinin yanlışlıkla yayınlanması, bağımlılık zincirinde bilinen açık, CI'ın sır sızdırması.
**Kapsam dışı:** kendi makinene fiziksel erişimi olan saldırgan, panelin bilerek `localhost` dışına açılması, üçüncü taraf servislerin (vidIQ, Edge sesi, görsel kaynakları) kendi açıkları.

**Neler zaten yapılıyor:** panel `127.0.0.1`'e bağlı ve `Origin`/`Host` denetimli, istek gövdeleri sınırlı, yollar kök klasörde tutulur, CI en az yetkiyle çalışır (`contents: read`) ve üçüncü taraf eylemler commit özetine sabitlidir, `npm ci --ignore-scripts` ile kurulum betikleri çalışmaz, depoda sır taraması testi vardır (`test/acik-depo.test.js`).

**EN** — Otopilot runs on your own machine: the panel binds to `127.0.0.1` only, there are no accounts or tracking, and API keys live only in your local `.env`. If you find a vulnerability, please **do not open a public issue**; use GitHub's **Security → Report a vulnerability** (private report) and describe the problem, steps to reproduce and affected version. Only the latest release is supported. Out of scope: an attacker with physical access to your machine, deliberately exposing the panel beyond localhost, and bugs in third-party services.
