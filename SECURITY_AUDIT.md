# Ustanomi (`ustanomi.com` & `com.ustanomi.app`) — OWASP Top 10 Güvenlik Denetim ve Sertleştirme Raporu

**Tarih:** 23.11.2026  
**Hedef Dizin:** `C:\Users\VİCTUS\Desktop\projeler\ustanomi`  
**Teknoloji Yığını:** PHP 8.x + MySQL/MariaDB (PDO) + Capacitor 6 (Android / iOS WebView)  
**Denetim Standartları:** OWASP Top 10 (2021/2025), OWASP MASVS (Mobile), PCI-DSS / Güvenli Havuz (Escrow) Standartları

---

## 1. Yönetici Özeti

Ustanomi platformunun LiteSpeed PHP 8.x + MySQL (PDO) sunucu katmanı, Güvenli Havuz (Escrow) ödeme/iş durum makinesi, MEB/MYK ustalık belgesi ve şantiye keşif fotoğrafı yükleme uç noktaları ile Capacitor 6 mobil yapılandırması OWASP Top 10 kriterlerine göre taranmıştır. Tespit edilen **7 güvenlik bulgusu** önem sırasına göre aşağıda raporlanmış ve tamamı **PDO Prepared Statements (`ATTR_EMULATE_PREPARES => false`)**, **Kriptografik CSRF Token (`hash_equals`)**, **İkili Magic-Byte + `finfo` MIME Dosya Doğrulaması** ve **Anti-IDOR Sahiplik Kontrolleri** ile kapatılmıştır.

---

## 2. Tespit Edilen OWASP Top 10 Bulguları ve Uygulanan Çözümler

### [KRİTİK-01] OWASP A03:2021 (Injection) — Veritabanı Sorgularında SQL Injection Koruması ve Gerçek PDO Prepared Statements
- **Risk Tanımı:** Usta arama, iş talebi oluşturma, Güvenli Havuz (Escrow) durum geçişleri ve belge kayıtlarında dinamik SQL birleştirme veya `ATTR_EMULATE_PREPARES => true` kullanımı SQL Injection saldırılarına zemin hazırlar.
- **Uygulanan Çözüm:**
  - `includes/pdo-security-bootstrap.php` içinde `db(): PDO` bağlantı yöneticisi `PDO::ATTR_EMULATE_PREPARES => false`, `PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION` ve `charset=utf8mb4` ile yapılandırıldı.
  - `api/escrow_jobs.php`, `api/upload_document.php` ve `api/payment_webhook.php` içindeki tüm `SELECT`, `INSERT` ve `UPDATE` sorguları `%100` parametreli PDO Prepared Statements (`->prepare()` + `->execute()`) ile güvenceye alındı.

### [KRİTİK-02] OWASP A04/A08 (Insecure Design & Data Integrity) — Dosya Yükleme Alanlarında Magic-Byte (Hex Signature) ve Finfo MIME Doğrulaması
- **Risk Tanımı:** Ustanomi üzerinde ustaların yüklediği **MEB/MYK Mesleki Yeterlilik Belgeleri (PDF/Görsel)** ve müşterilerin yüklediği **Şantiye Keşif / Hasar Tutanağı Fotoğrafları (JPG/PNG/WebP)** yalnızca dosya uzantısı veya HTTP `Content-Type` başlığı ile kontrol edildiğinde, saldırganlar görüntü başlığına gizlenmiş PHP web shell (`.php.jpg` / polyglot dosya) yükleyebilir.
- **Uygulanan Çözüm (`validate_uploaded_file_magic`):**
  1. `is_uploaded_file()` ile geçici dosyanın gerçek bir HTTP POST yüklemesi olduğu doğrulanır.
  2. `finfo(FILEINFO_MIME_TYPE)` ile işletim sistemi düzeyinde MIME tipi (`image/jpeg`, `image/png`, `image/webp`, `application/pdf`) tespit edilir.
  3. Dosyanın ilk 12 baytı okunarak **Ham Magic-Byte (Hex Signature)** kontrolü yapılır:
     - **JPEG:** `\xFF\xD8\xFF`
     - **PNG:** `\x89PNG\r\n\x1A\n`
     - **WebP:** `RIFF....WEBP`
     - **PDF:** `%PDF-` (`\x25\x50\x44\x46\x2D`)
  4. Görsel dosyalarında ek olarak `getimagesize()` ile gerçek piksel genişlik/yükseklik (`>= 10x10 px`) doğrulanır.
  5. Yüklenen dosyaya kullanıcı girdisinden tamamen bağımsız 128-bit kriptografik rastgele ad (`bin2hex(random_bytes(16)) . '.' . $ext`) verilir ve `uploads/documents/.htaccess` ile dizin içinde betik çalıştırma (`ExecCGI`, `.php`, `.phtml`, `.phar`) tamamen kapatılır.

### [KRİTİK-03] OWASP A01:2021 (Broken Access Control & IDOR) — Güvenli Havuz (Escrow) İş Taleplerinde Yatay/Dikey Yetki Kontrolü
- **Risk Tanımı:** Bir müşterinin başka bir müşteriye ait iş/keşif talebini görüntülemesi veya bir ustanın kendisine atanmamış bir Güvenli Havuz ödemesini serbest bırakmaya (`CUSTOMER_APPROVED_RELEASED`) çalışması kritik finansal ve KVKK ihlalidir.
- **Uygulanan Çözüm:**
  - `api/escrow_jobs.php` üzerinde her iş kaydı `customer_id` ve `master_id` ile ilişkilendirildi.
  - Güvenli Havuz durum geçişleri `can_transition_escrow($from, $to)` durum makinesine bağlandı:
    - `PENDING_PAYMENT` -> `FUNDS_HELD_IN_POOL` (Yalnızca HMAC imzalı ödeme webhook'u ile)
    - `FUNDS_HELD_IN_POOL` -> `WORK_IN_PROGRESS` (Yalnızca işi üstlenen doğrulanmış `MASTER` veya `ADMIN`)
    - `WORK_IN_PROGRESS` -> `CUSTOMER_APPROVED_RELEASED` veya `DISPUTED` (Yalnızca işin sahibi `CUSTOMER` veya `ADMIN`)

### [YÜKSEK-01] OWASP A01/A08 (CSRF) — Tüm Formlarda ve Durum Değiştiren İsteklerde Kriptografik CSRF Token Koruması
- **Risk Tanımı:** İş talebi oluşturma, Güvenli Havuz ödeme onayı ve belge yükleme formlarında CSRF token bulunmaması, oturumu açık kullanıcıların habersiz işlem tetiklemesine yol açar.
- **Uygulanan Çözüm:**
  - `csrf_token()`, `csrf_field()` ve `require_valid_csrf()` fonksiyonları sabit zamanlı `hash_equals()` karşılaştırmasıyla devreye alındı.
  - `www/index.html` içindeki keşif/iş talebi ve belge yükleme formlarına `<input type="hidden" name="_csrf">` ve `fetch` çağrılarına `X-CSRF-Token` başlığı eklendi.

### [YÜKSEK-02] OWASP A02/A08 (Cryptographic & Integrity Failures) — PayTR / iyzico Güvenli Havuz Webhook HMAC-SHA256 İmza Doğrulaması
- **Risk Tanımı:** Ödeme sağlayıcı geri bildirim (webhook) uç noktasında imza doğrulaması yapılmaması, sahte ödeme onayı gönderilerek havuzda para olmadan işin `FUNDS_HELD_IN_POOL` durumuna geçirilmesine yol açar.
- **Uygulanan Çözüm:** `api/payment_webhook.php` içinde `verify_webhook_hmac($rawPayload, $secretKey, $signature)` fonksiyonu (`hash_equals` + `hash_hmac('sha256', ..., true)`) ile imzasız veya geçersiz imzalı tüm webhook istekleri `401 INVALID_WEBHOOK_SIGNATURE` ile reddedilir ve `security_audit_logs` tablosuna kaydedilir.

### [ORTA-01] OWASP A03:2021 (XSS) — Çıktı Kaçışı (`htmlspecialchars`) ve CSP Başlıkları
- **Uygulanan Çözüm:** Tüm PHP ve JSON çıktılarında `e()` (`htmlspecialchars((string)$value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8')`), ön yüzde DOM `textContent` ve HTTP yanıtlarında `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` başlıkları zorunlu kılındı.

### [ORTA-02] OWASP A05:2021 (Security Misconfiguration — Mobile & WebView)
- **Risk Tanımı:**
  - `android/app/src/main/AndroidManifest.xml` içinde `android:allowBackup="true"` olması ADB üzerinden uygulama verilerinin yedeklenip okunmasına izin verir; ayrıca `android:usesCleartextTraffic="false"` açıkça tanımlanmamıştı.
  - `capacitor.config.json` içinde iOS `limitsNavigationsToAppBoundDomains: false` olarak bırakılmıştı.
- **Uygulanan Çözüm:**
  - `AndroidManifest.xml` içinde `android:allowBackup="false"` ve `android:usesCleartextTraffic="false"` olarak sertleştirildi.
  - `capacitor.config.json` içinde `limitsNavigationsToAppBoundDomains: true` yapıldı.

---

## 3. Doğrulama Matrisi

| Güvenlik Kontrolü | Durum | Doğrulanan Dosyalar |
| :--- | :---: | :--- |
| PDO `ATTR_EMULATE_PREPARES => false` & `%100` Prepared Statements | ✅ PASS | `includes/pdo-security-bootstrap.php`, `api/escrow_jobs.php`, `api/upload_document.php`, `api/payment_webhook.php` |
| CSRF Token (`hash_equals`) & Form `_csrf` / `X-CSRF-Token` | ✅ PASS | `includes/pdo-security-bootstrap.php`, `api/csrf.php`, `www/index.html` |
| Magic-Byte (Hex) + `finfo` MIME + `is_uploaded_file` + `.htaccess` | ✅ PASS | `includes/pdo-security-bootstrap.php`, `api/upload_document.php`, `uploads/documents/.htaccess` |
| Güvenli Havuz (Escrow) Anti-IDOR & HMAC-SHA256 Webhook | ✅ PASS | `api/escrow_jobs.php`, `api/payment_webhook.php` |
| Android & iOS Capacitor Güvenlik Sertleştirmesi | ✅ PASS | `android/app/src/main/AndroidManifest.xml`, `capacitor.config.json` |
