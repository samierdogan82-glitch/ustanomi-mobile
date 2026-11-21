# Ustanomi Mobil Uygulama — Google Play & Apple App Store Yayın Kılavuzu

## 1. Uygulama Kimliği
- **Uygulama Adı:** Ustanomi
- **Package / Bundle ID:** `com.ustanomi.app`
- **Canlı Web/API Kaynağı:** `https://ustanomi-web-production.up.railway.app/app/` *(Domain tescil edildiğinde `capacitor.config.json` içindeki `server.url` değeri `https://ustanomi.com/app/` olarak güncellenir.)*
- **Native Eklentiler (MIT):** Camera, Geolocation, Haptics, Network, Share, SplashScreen, StatusBar, App.

## 2. Google Play Console (Android) Adımları
1. Google Play Console'da yeni uygulama oluşturun (`com.ustanomi.app`, Dil: Türkçe).
2. **İmzalı Yayın Anahtarı (Upload Keystore):**
   ```bash
   keytool -genkey -v -keystore ustanomi-upload.keystore -alias ustanomi -keyalg RSA -keysize 2048 -validity 10000
   ```
3. **Derleme:**
   - **Yerel (Android Studio yüklüyse):** `npx cap open android` → `Build > Generate Signed Bundle / APK` → `.aab` dosyasını Play Console'a yükleyin.
   - **Bulut (Ücretsiz GitHub Actions):** Bu klasörü GitHub'a push ettiğinizde `.github/workflows/build-mobile.yml` otomatik olarak **`ustanomi-android-debug-apk`** (telefona direkt kurulum) ve **`ustanomi-android-release-aab`** (Google Play paketi) çıktılarını üretir.
4. **Zorunlu Mağaza Formları:**
   - **Hesap Silme URL'si (KVKK / Play Policy):** Uygulama içi `POST /api/v1/auth/delete-request` aktif.
   - **İzin Beyanları:** Kamera (şantiye/belge fotoğrafı & görüntülü keşif), Konum (Acil Usta Radarı).

## 3. Apple App Store Connect (iOS) Adımları
1. Apple Developer Portal'da **App ID** oluşturun: `com.ustanomi.app`.
2. App Store Connect'te yeni iOS uygulaması açın.
3. **Derleme & TestFlight:**
   - Mac / Xcode (veya GitHub Actions `macos-14` runner + App Store Connect API Key) ile `ios/App/App.xcworkspace` projesini arşivleyip TestFlight'a gönderin.
4. **Apple İnceleme Notları (App Review Guidelines):**
   - `Info.plist` içine tüm Türkçe izin açıklamaları (`NSCameraUsageDescription`, `NSMicrophoneUsageDescription`, `NSPhotoLibraryUsageDescription`, `NSLocationWhenInUseUsageDescription`) ve `ITSAppUsesNonExemptEncryption = false` önceden eklendi.
   - Uygulama içi hesap silme (Guideline 5.1.1(v)) backend'de `POST /api/v1/auth/delete-request` ile hazır.
