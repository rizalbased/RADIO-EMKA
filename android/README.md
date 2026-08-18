# 📱 EMKA RADIO - Project Android (APK)

Aplikasi Android resmi untuk **EMKA RADIO (Radiomu Multi Karya)** berbasis Android Studio & Kotlin WebView wrapper.

---

## 🛠️ Informasi Project Android

- **Nama Aplikasi**: EMKA RADIO
- **Tagline**: Radiomu Multi Karya
- **Package Name**: `com.emkaradio.multikarya`
- **Target SDK**: Android 14 (API 34)
- **Minimum SDK**: Android 7.0 (API 24)
- **Production Web App URL**: `https://request-lagu-confession-gen-z.ai.studio`
- **Bahasa Native**: Kotlin 1.9.22
- **Build System**: Gradle 8.4 (Android Gradle Plugin 8.2.2)

---

## 🚀 Fitur Utama Wrapper Android

1. **Opening / Landing Selector**:
   - Splash Screen otomatis menampilkan **EMKA RADIO - Radiomu Multi Karya**.
   - 2 Pilihan Akses Utama:
     - 👨‍🎓 **MASUK SEBAGAI SISWA**: Buka User Mode (Request Lagu, Secret Confession, Live Radio Sync, YouTube Player, Story 9:16, Share & Download).
     - 🛡️ **MASUK SEBAGAI ADMIN**: Buka Form Login Admin (Username/Email + Password aman terverifikasi backend).

2. **Performa & Media Playback**:
   - `mediaPlaybackRequiresUserGesture = false`: Memungkinkan YouTube Player & Live Radio Admin berputar secara simultan tanpa blokir autoplay Android.
   - Support `DOMStorage`, `Database`, `JavaScriptEnabled`, `AllowFileAccess`, dan `MixedContent`.
   - Download Manager otomatis untuk mengunduh Story 9:16 / Artwork.

3. **In-App & External Navigation**:
   - Tautan eksternal (WhatsApp, Instagram, YouTube, Google Drive) otomatis dibuka melalui Android Intent di aplikasi native perangkat.
   - Navigasi tombol **Kembali (Back Button)** Android terintegrasi untuk riwayat browser WebView, dilengkapi dialog konfirmasi keluar aplikasi jika di halaman utama.

4. **Penanganan Koneksi / Offline**:
   - Deteksi koneksi internet otomatis.
   - Tampilan ramah offline: *"Internet tidak tersedia. Periksa koneksi Anda."* dengan tombol Coba Lagi (*Retry*).

---

## 📂 Struktur Project Android

```
/android
├── build.gradle                          # Root Build Gradle
├── settings.gradle                       # Project Settings & Submodules
├── gradlew & gradlew.bat                 # Gradle Executables
├── gradle/wrapper/gradle-wrapper.properties
└── app
    ├── build.gradle                      # App Module Gradle (package: com.emkaradio.multikarya)
    └── src/main
        ├── AndroidManifest.xml           # Manifest & Internet Permissions
        ├── java/com/emkaradio/multikarya
        │   └── MainActivity.kt           # Kotlin Controller & WebView Core
        └── res
            ├── layout/activity_main.xml  # Splash, WebView & Offline Layouts
            ├── values/
            │   ├── colors.xml
            │   ├── strings.xml
            │   └── styles.xml
            └── drawable/
                └── splash_background.xml
```

---

## 📦 Cara Kompilasi APK Menggunakan Android Studio

### Langkah 1: Download / Export Source Code
1. Pada web app, klik menu **Export / Download ZIP** atau Clone Repository dari GitHub.
2. Ekstrak folder project ke komputer Anda.

### Langkah 2: Buka di Android Studio
1. Buka **Android Studio** (versi Flamingo / Giraffe / Hedgehog / Iguana / Jellyfish atau lebih baru).
2. Pilih **Open an Existing Project**.
3. Arahkan ke sub-folder `/android` dari project ini dan klik **OK**.
4. Tunggu Android Studio selesai melakukan **Gradle Sync** dan mendownload dependency.

### Langkah 3: Build Debug APK
1. Di menu atas Android Studio, klik **Build** > **Build Bundle(s) / APK(s)** > **Build APK(s)**.
2. Setelah selesai, notification popup akan muncul dengan link **locate**.
3. File APK terletak di:
   `android/app/build/outputs/apk/debug/app-debug.apk`

### Langkah 4: Build Release APK (Siap Distribusi)
1. Di menu atas Android Studio, klik **Build** > **Generate Signed Bundle / APK...**.
2. Pilih **APK** lalu klik **Next**.
3. Buat atau masukkan **Keystore / Key Store Path**.
4. Pilih build variant **release** dan centang **V1 / V2 Signing**.
5. Klik **Create**. File APK Release akan dihasilkan di:
   `android/app/build/outputs/apk/release/app-release.apk`

---

## 🔐 Kredensial Autentikasi Admin

Admin dapat masuk melalui tombol **🛡️ MASUK SEBAGAI ADMIN**:
- **Username / Email Default**: `admin` ATAU `admin@emkaradio.sch.id`
- **Password Default**: `emkaradio1902` (Atau PIN `1902`)

*Catatan Keamanan*: Kredensial Admin diverifikasi secara aman melalui endpoint `/api/admin/login` pada backend server (tanpa menyimpan password hardcoded di client JavaScript/TypeScript).

---

## 🌐 Koneksi Backend Web App
Aplikasi Android ini secara otomatis terhubung ke backend & database production yang sama dengan Web App:
- Request dari Web Siswa langsung muncul di APK Admin.
- Request dari APK Siswa langsung muncul di Web Admin.
- Live Radio Synchronizer & YouTube Player terhubung secara real-time.
