# Otomatisasi Adzan & Jadwal Sholat Kota Medan (EMKA RADIO)

Implementasi fitur penyiaran adzan otomatis berbasis waktu sholat Kota Medan (API Kemenag/MyQuran ID 0228) yang terintegrasi langsung dengan Supabase Database & Storage, sistem pause/resume radio cerdas, banner jadwal sholat adaptif, serta panel admin untuk manajemen audio adzan.

## User Review & Critical Decisions

> [!IMPORTANT]
> Keputusan penting berdasarkan klarifikasi interaktif Turn 1:
> - **Perilaku Radio Saat Adzan**: Musik/radio streaming akan otomatis di-pause saat waktu adzan tiba, dan otomatis dilanjutkan kembali (resume) setelah adzan selesai berkumandang.
> - **Audio Fallback**: Jika admin belum mengunggah file audio adzan kustom ke Supabase Storage, sistem menggunakan file audio adzan default berkualitas tinggi yang jernih dan syahdu.
> - **Posisi Banner**: Banner jadwal sholat dan status adzan diletakkan di bagian paling atas area konten utama persis di bawah topbar tetap.

---

### 1. Overview & Core Concept

- **Tujuan**: Memastikan pendengar EMKA RADIO di Kota Medan dan sekitarnya senantiasa mendapatkan pengingat waktu sholat 5 waktu yang akurat secara otomatis, dengan etika penyiaran radio profesional (menghentikan siaran lagu sejenak dan melanjutkannya kembali pasca-adzan).
- **Target Pengguna**: 
  - **Siswa / Pendengar**: Mengetahui jadwal sholat harian Medan, waktu hitung mundur menuju adzan berikutnya, serta mendengarkan kumandang adzan tanpa bentrok dengan lagu radio.
  - **Admin / Penyiar**: Mengatur status aktif/nonaktif adzan, mengunggah audio adzan khusus (Subuh & Reguler), menguji coba pemutaran (test preview), serta memantau status scheduler.
- **Kunci Keunggulan**: Sinkronisasi state pemutar YouTube / Web Audio radio, toleransi kebijakan browser autoplay audio, dan fallback data otomatis jika API jadwal eksternal mengalami kendala jaringan.

---

### 2. User Experience & Visual Design

#### A. Banner Jadwal Sholat & Status Adzan (`AdzanBanner.tsx`)
- **Posisi**: Terletak di bagian atas area scroll konten utama, tepat di bawah topbar tetap, menjaga layout viewport tetap kokoh.
- **Tampilan Standar**:
  - Penanda lokasi: *Kota Medan & Sekitarnya (WIB)*
  - 5 Waktu Sholat: Subuh, Dzuhur, Ashar, Maghrib, Isya dengan tipografi monospace tabular (`tabular-nums`) yang rapi.
  - Highlight waktu sholat berikutnya dengan indikator waktu mundur (misal: *Menuju Maghrib: 18:21 (14m lagi)*).
  - Unlocked audio toggle kecil bagi pengguna baru untuk memastikan izin suara browser aktif.
- **Tampilan Saat Adzan Berkumandang**:
  - Banner bertransformasi dengan warna aksen amber/emerald bernuansa tenang (bukan badge berkedip kasar).
  - Animasi visual equalizer audio lembut yang menandakan adzan sedang mengudara.
  - Informasi judul adzan: *Sedang Mengudara: Kumandang Adzan Maghrib (Medan)*.
  - Untuk Admin: Tombol heningkan/lewati (*Stop Adzan*) jika dibutuhkan dalam keadaan darurat siaran.

#### B. Panel Pengaturan Adzan Admin (`AdzanSettingsModal.tsx` / Tab Setting)
- Tersedia pada menu Admin (di Setting Penyiar atau tombol cepat header admin).
- Form upload 5 slot audio: Subuh (dengan doa as-shalatu khairum minan naum), Dzuhur, Ashar, Maghrib, Isya.
- Drag-and-drop / file picker untuk file `.mp3`, `.wav`, `.m4a` langsung ke Supabase Storage bucket `adzan-audio`.
- Tombol *Test Audio* per slot untuk mengecek volume dan kualitas suara sebelum disimpan.
- Toggle saklar utama *Aktifkan Penyiaran Adzan Otomatis*.
- Tampilan status koneksi API Kemenag / MyQuran Kota Medan (ID: 0228).

---

### 3. Key Product Decisions & Trade-Offs

1. **Jeda Otomatis Pemutar Radio (Radio Interruption & Resume)**
   - *Pendekatan*: Saat adzan terpicu, scheduler mencatat state radio (`wasPlaying: true`), memanggil `handlePause` pada `RadioEngineContext`, dan memutar audio adzan lewat HTML5 Audio API independen. Begitu audio adzan memicu event `onended` (atau dihentikan manual oleh admin), radio otomatis memanggil `handleResume`.
   - *Alasan*: Menjaga rasa hormat dan kekhusyukan saat adzan berkumandang tanpa merusak alur antrean lagu yang sedang berjalan.
2. **Penanganan Autoplay Browser**
   - *Pendekatan*: Browser modern memblokir audio otomatis tanpa interaksi awal pengguna (*user gesture*). Banner menyediakan tombol "Aktifkan Audio Otomatis" yang begitu diklik sekali oleh pengguna (atau saat pengguna mengklik tombol play radio), audio context langsung di-unlock.
   - *Alasan*: Menghindari galat `DOMException: play() failed because the user didn't interact with the document first`.
3. **Penyimpanan Database & Storage**
   - *Pendekatan*: Tabel `adzan_settings` (single-row configuration, id=1) menyimpan tautan publik URL audio dan status aktif. File biner disimpan di bucket Supabase Storage `adzan-audio`.
   - *Alasan*: Efisien, ringan, cepat dimuat oleh klien tanpa membebani bandwidth database Postgres.
4. **Resiliensi API Jadwal Sholat**
   - *Pendekatan*: Query ke API MyQuran v2 Kota Medan di-cache per hari di `localStorage`. Jika offline atau API Kemenag down, sistem menggunakan fallback kalkulasi astronomis waktu sholat Medan.
   - *Alasan*: Siaran radio tidak boleh berhenti berfungsi hanya karena API eksternal pihak ketiga terganggu.

---

### 4. Technical Architecture & Data Strategy

#### Diagram Arsitektur Komponen & Alur Data

```
┌────────────────────────────────────────────────────────────────────────┐
│                          EMKA RADIO APP                                │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│   ┌────────────────────┐          ┌────────────────────────────────┐   │
│   │  useAdzanScheduler │◀─────────┤ API MyQuran / Kemenag (0228)   │   │
│   │  (1-sec interval)  │          │ (Jadwal Sholat Medan Hari Ini) │   │
│   └─────────┬──────────┘          └────────────────────────────────┘   │
│             │                                                          │
│             ├─────────────► ┌──────────────────────────────────────┐   │
│             │ Waktu cocok?  │ Supabase `adzan_settings` (ID: 1)    │   │
│             │               │ & Storage Bucket `adzan-audio`       │   │
│             │               └──────────────────────────────────────┘   │
│             ▼                                                          │
│   ┌────────────────────┐          ┌────────────────────────────────┐   │
│   │ Audio Adzan Player │─────────►│ RadioEngineContext             │   │
│   │ (HTML5 Audio)      │          │ - Auto-pause lagu radio        │   │
│   │ - Play audio adzan │          │ - Auto-resume saat adzan tamat │   │
│   └─────────┬──────────┘          └────────────────────────────────┘   │
│             │                                                          │
│             ▼                                                          │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │ AdzanBanner.tsx (Top of Content Viewport)                      │   │
│   │ - Status Countdown / Waktu Sholat Medan                        │   │
│   │ - Indikator On-Air Adzan & Waveform                            │   │
│   └────────────────────────────────────────────────────────────────┘   │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

#### Struktur Tabel Database & Bucket Supabase
- **Tabel `public.adzan_settings`**:
  - `id`: INT (Primary key, check id = 1)
  - `city_name`: VARCHAR (default: `'Kota Medan'`)
  - `city_id`: VARCHAR (default: `'0228'`)
  - `is_active`: BOOLEAN (default: `true`)
  - `audio_subuh`: TEXT (URL audio)
  - `audio_dzuhur`: TEXT
  - `audio_ashar`: TEXT
  - `audio_maghrib`: TEXT
  - `audio_isya`: TEXT
  - `updated_at`: TIMESTAMP WITH TIME ZONE
- **Storage Bucket**: `adzan-audio` (public)
- **RLS**: Public read untuk semua pengguna, update hanya untuk role authenticated / admin PIN.

#### Rencana File yang Dibuat & Diintegrasikan
1. `src/hooks/useAdzanScheduler.ts`: Hook scheduler per detik, fetch API Kemenag Medan, kontrol pause/resume radio, dan penanganan audio playback.
2. `src/components/AdzanBanner.tsx`: Komponen visual banner jadwal sholat & notifikasi kumandang adzan.
3. `src/components/AdzanSettingsModal.tsx`: Modal form pengelolaan audio adzan dan toggle aktif untuk admin.
4. `src/services/adzanService.ts`: Service interaksi Supabase (fetch/update `adzan_settings`, upload file ke Storage bucket `adzan-audio`).
5. Integrasi ke `src/App.tsx`, `src/components/Sidebar.tsx`, dan `src/components/DjStudio.tsx`.
