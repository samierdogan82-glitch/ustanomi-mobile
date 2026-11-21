# Ustanomi — Google Play & Apple App Store Mağaza Yayın Paketi

Bu dosya Google Play Console ve Apple App Store Connect formlarını dakikalar içinde eksiksiz doldurabilmeniz için hazırlanmıştır.

---

## 1. İmzalı Google Play AAB Üretimi İçin GitHub Secrets Ayarı (Tamamlandı ✓)

4 imzalama anahtarı (`ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`) GitHub repo Secrets bölümüne eklendi ve GitHub Actions **Run `44918438097`** ile üretilen **Google Play imzalı `.aab`** paketi `jarsigner -verify` (`CN=Ustanomi`) ile doğrulandı.

- Secret Adresi: `https://github.com/samierdogan82-glitch/ustanomi-mobile/settings/secrets/actions`
- Yerel Şifreli Yedek: Repo dışındaki `ustanomi_signing_private\ustanomi-upload.keystore` ve `dist-signed\app-release.aab`
- Yeni sürüm derlemek için GitHub Actions sekmesinden **"Build Ustanomi Android & iOS"** iş akışını **Run workflow** ile tetikleyebilirsiniz.

> **Önemli:** `ustanomi-upload.keystore` dosyasını mutlaka güvenli bir yerde (örneğin şifreli Google Drive / parola yöneticisi) yedekleyin. Google Play güncellemeleri için gelecekte de aynı upload anahtarı gerekir.

---

## 2. Zorunlu Canlı Mağaza Bağlantıları (Yayında • HTTP 200)

| Mağaza Alanı | Canlı URL |
| :--- | :--- |
| **Gizlilik Politikası (Privacy Policy URL)** | `https://ustanomi-web-production.up.railway.app/gizlilik.html` |
| **Hesap Silme URL'si (Google Play Data Safety & Apple 5.1.1)** | `https://ustanomi-web-production.up.railway.app/hesap-sil.html` |
| **Destek / İletişim E-Postası** | `destek@ustanomi.com` |
| **Package Name / Bundle ID** | `com.ustanomi.app` |

---

## 3. Google Play & App Store Hazır Türkçe Metinler

- **Uygulama Adı (App Name — 30 krk):**
  `Ustanomi`

- **Google Play Kısa Açıklama (Short Description — 78/80 krk):**
  `Belgeli ustalarla buluşun, ücretsiz ihale açın ve aşamalı onay ile çalışın.`

- **Apple App Store Alt Başlık (Subtitle — 30/30 krk):**
  `Belgeli Ustalar & İş Takibi`

- **Apple App Store Anahtar Kelimeler (Keywords — 100 krk sınırı):**
  `usta,tadilat,iç mimar,tesisat,elektrik,boya,marangoz,ev yenileme,teklif,ihale,yapı malzemesi`

- **Tam Açıklama (Full Description — Google Play & App Store):**
```text
Ustanomi; ev sahipleri, iç mimarlar, işletmeler ve belgeli ustaları tek bir düzenli iş ve keşif platformunda buluşturur.

ÖNE ÇIKAN ÖZELLİKLER:
• Gerçek Uygulama Videoları & Hikâyeler: Tadilat, elektrik, tesisat, ahşap marangozluk, seramik ve dekoratif sıva ustalarının gerçek iş örneklerini ve öncesi/sonrası karelerini inceleyin.
• Ücretsiz İhale & Teklif Karşılaştırma: Telefon numaranızı paylaşmadan iş talebi açın, bölgenizdeki ustalardan şeffaf teklifler alın ve teklifleri kıyaslayın.
• Aşamalı İş Takibi (%30 / %40 / %30): Büyük tadilat ve yenileme işlerini fotoğraf kanıtlı etaplara bölerek adım adım takip edin ve dijital imzalı PDF sözleşme oluşturun.
• Acil Usta Radarı & Görüntülü Ön Keşif: Konum izni verdiğinizde çevrenizdeki aktif ustalara mesafeye göre ulaşın veya randevu takviminden keşif saati seçin.
• B2B Yapı Malzemesi & Proforma Ağı: Tedarikçilerden toptan proforma teklifi alın, sevkiyatlarınızı takip edin.
• Güvenli İletişim: Uygulama içi mesajlaşmada telefon numarası ve IBAN sızıntı filtresiyle düzenli iletişim kurun.

Not: Ödeme kuruluşu (PayTR/iyzico) entegrasyon modülü şu an test/sandbox modundadır; gerçek kart tahsilatı yalnızca canlı ödeme anahtarları etkinleştirildiğinde kullanılır.
```

---

## 4. Görsel & Veri Güvenliği (Data Safety / App Privacy) Özet Tablosu

- **Hazır Pazarlama Görselleri (`store-assets/`, tamamı alfa kanalsız RGB PNG):**
  - Google Play Uygulama İkonu (`512×512`): `store-assets/google-play-icon-512.png`
  - Google Play Özellik Grafiği (`1024×500`): `store-assets/google-play-feature-graphic-1024x500.png`
  - Apple App Store İkonu (`1024×1024`): `store-assets/apple-app-store-icon-1024.png`
  - Google Play Telefon Ekran Görüntüleri (`5 adet • 1080×1920`): `store-assets/screenshots/android/` (`01_kesfet.png` – `05_profil.png`)
  - Apple App Store 6.9" Ekran Görüntüleri (`5 adet • 1320×2868`): `store-assets/screenshots/ios-6.9/` (`01_kesfet.png` – `05_profil.png`)
  - Apple App Store 6.7" Ekran Görüntüleri (`5 adet • 1290×2796`): `store-assets/screenshots/ios-6.7/` (`01_kesfet.png` – `05_profil.png`)
- **Google Play Veri Güvenliği / Apple App Privacy Beyanı:**
  - *Toplanan Veriler:* Ad soyad, e-posta, telefon numarası, kullanıcı fotoğrafları/belgeleri (isteğe bağlı yükleme), yaklaşık/hassas konum (yalnızca Acil Radar kullanıldığında).
  - *Veri Şifreleme:* Aktarım sırasında HTTPS/TLS ile şifrelenir.
  - *Hesap Silme:* Uygulama içi ve web (`https://ustanomi-web-production.up.railway.app/hesap-sil.html`) üzerinden sağlanır.
  - *Üçüncü Taraflarla Paylaşım / Reklam:* Veri satılmaz; reklam takibi (IDFA / AdID) yapılmaz.
