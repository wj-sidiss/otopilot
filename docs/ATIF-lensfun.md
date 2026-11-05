# Lensfun / Credits

Lens profilleri [Lensfun](https://github.com/lensfun/lensfun) projesinin veritabanından gelir (kamera ve lens ölçümleri, topluluk katkısı).
Lens profile data comes from the Lensfun database (community-measured cameras and lenses).

- **Lisans:** veritabanı CC BY-SA 3.0, kütüphane LGPL-3.0. Bu depoya **kopyalanmaz**; `node studyo.js lens-kur` kullanıcının makinesinde `uretim/_lensfun/db` içine indirir (depoya girmez). Veritabanını değiştirip dağıtırsan aynı lisansla (CC BY-SA 3.0) ve atıfla yayımlaman gerekir.
- **Kullanım:** ffmpeg'in `lensfun` filtresi. `reverse=1` ile profili AI klibe "lens karakteri" olarak ekler (distorsiyon, vinyet, renk sapması); `--duzelt` ile kendi gerçek videondaki lens bozulmasını düzeltir.
- Marka ve model adları yalnızca ürünü tanımlamak içindir; ilgili şirketlerle bağlantı ya da onay anlamına gelmez.
