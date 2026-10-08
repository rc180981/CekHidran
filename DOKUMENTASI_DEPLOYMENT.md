# 📘 DOKUMENTASI PROSES DEPLOYMENT & HISTORI SISTEM
## Aplikasi PWA "Cek Hidran" (Pemeriksaan Hydrant Box WH2, WH3, WH4)

Dokumen ini berisi rangkuman komprehensif seluruh proses instalasi, migrasi arsitektur, konfigurasi basis data, tahapan deployment ke Vercel dan Firebase, serta histori pemecahan masalah teknis (*troubleshooting*).

---

## 1. Informasi Umum & Tautan Produksi

| Komponen | Keterangan / Tautan |
| :--- | :--- |
| **Aplikasi Live (Produksi)** | [https://cekhidran.vercel.app](https://cekhidran.vercel.app) |
| **Halaman Uji QR Code** | [https://cekhidran.vercel.app/test-qr](https://cekhidran.vercel.app/test-qr) |
| **Repositori GitHub** | [https://github.com/rc180981/CekHidran](https://github.com/rc180981/CekHidran) (`branch: main`) |
| **Proyek Firebase** | `hidran-7d88c` ([Firebase Console](https://console.firebase.google.com)) |
| **Platform Hosting** | Vercel (Auto-deploy dari commit GitHub) |
| **Waktu Deployment Selesai** | 8 Oktober 2026 |

---

## 2. Arsitektur & Teknologi (Tech Stack)

- **Framework Web**: Next.js 15 (App Router, React 19)
- **Desain & Gaya Antarmuka**: Tailwind CSS + Lucide React Icons
- **Autentikasi & Database**: Firebase Authentication + Cloud Firestore
- **Offline-First Storage**: IndexedDB (library `idb`) untuk antrean offline & *caching* data instan (0 ms)
- **Pemindai QR Code**: Engine `jsQR` + Fallback Kamera Native
- **Pengolahan Gambar & Bukti**: HTML5 Canvas (Kompresi dan penempelan stempel waktu, nama petugas, nomor hydrant)
- **Tanda Tangan Digital**: HTML5 Canvas Signature Pad
- **Hosting & SSL/TLS**: Vercel Serverless Edge Platform dengan sertifikat HTTPS terpercaya

---

## 3. Akun Pengguna & Peran Hak Akses (RBAC)

Aplikasi dilengkapi Role-Based Access Control (RBAC) 4 peran:

| Peran (*Role*) | Email Akun | Kata Sandi Default | Tugas & Hak Akses |
| :--- | :--- | :--- | :--- |
| **Admin Sistem** | `admin@cekhidran.id` | `Admin#12345` | Akses penuh seluruh gudang, kelola titik hydrant, kelola pengguna, audit log |
| **Supervisor K3** | `supervisor@cekhidran.id` | `Supervisor#12345` | Monitoring seluruh gudang (WH2, WH3, WH4), verifikasi temuan, unduh laporan |
| **Petugas Lapangan** | `petugas@cekhidran.id` | `Petugas#12345` | Alur pemeriksaan 3 langkah: Scan QR ➔ Foto Kondisi ➔ Checklist & TTD (Gudang WH2) |
| **Manajemen** | `manajemen@cekhidran.id` | `Manajemen#12345` | Akses baca eksekutif (*read-only*), persentase kepatuhan 7 hari, ekspor laporan |

---

## 4. Master Data yang Telah Dikonfigurasi di Database

Data awal di-seed ke Cloud Firestore melalui script `scripts/seed-firebase.mjs`:

1. **3 Gudang**:
   - `wh2` : Gudang WH2
   - `wh3` : Gudang WH3
   - `wh4` : Gudang WH4
2. **54 Titik Hydrant Box (18 Titik per Gudang)**:
   - `H-01` s/d `H-12` : Area Indoor (Rak A, B, C, Dock Loading, Koridor Tengah, Area Staging)
   - `H-13` s/d `H-18` : Area Outdoor (Sisi Utara, Timur, Selatan, Barat, Parkir Truk, Pos Jaga)
3. **4 Item Equipment Checklist Standar**:
   - `item_1` : Kebersihan Box & Nozzle Hydrant
   - `item_2` : Tekanan Bar Hydrant
   - `item_3` : Kondisi Fisik Kran / Valve
   - `item_4` : Selang & Packing seal Hydrant
4. **Pengaturan Frekuensi Default**:
   - Frekuensi pemeriksaan: `harian`

---

## 5. Kronologi Tahapan Deployment

```
[Tahap 1: Setup Git & Repo] ➔ [Tahap 2: Migrasi ke Firebase] ➔ [Tahap 3: Seed Database]
                                                                        │
[Tahap 6: Vercel Deploy] ◄── [Tahap 5: Pure JS Crypto] ◄── [Tahap 4: Kamera Universal]
         │
         ▼
[Tahap 7: Authorized Domain] ➔ [Tahap 8: Direct Firestore Sync] ➔ [SELESAI (LIVE)]
```

### Tahap 1: Inisialisasi GitHub Repository
- Kode sumber disiapkan di `D:\FAJAR Apps\HidranLokal`.
- Git remote dihubungkan ke `https://github.com/rc180981/CekHidran.git`.
- Branch kerja utama diatur pada `main`.

### Tahap 2: Migrasi Arsitektur ke Firebase
- Mengubah provider autentikasi dan database dari Supabase menjadi Firebase (`hidran-7d88c`).
- Menyiapkan provider autentikasi client `lib/firebase/auth-context.tsx`.
- Memperbarui halaman login `app/login/LoginForm.tsx` dan dashboard admin.

### Tahap 3: Pengisian Data Awal (Seeding)
- Menjalankan `scripts/seed-firebase.mjs` untuk mendaftarkan 4 akun pengguna di Firebase Authentication dan mengisi 54 titik hydrant di Firestore.

### Tahap 4: Mengatasi Isu Kamera di Perangkat Mobile
- **Masalah**: Browser smartphone (Chrome & Safari) memblokir `navigator.mediaDevices.getUserMedia` (video live camera) jika diakses via IP HTTP lokal (`http://192.168.x.x:3000`).
- **Solusi**: Dibuat mekanisme universal di `components/petugas/QrScanner.tsx` dan `CameraCapture.tsx` dengan fallback native `<input type="file" capture="environment">`.

### Tahap 5: Mengatasi Layar Macet ("Menyiapkan kamera & checklist…")
- **Masalah**: Pada mobile browser di lingkungan non-HTTPS (HTTP biasa), Web Cryptography API (`crypto.subtle`) dan `crypto.randomUUID` dimatikan oleh sistem keamanan browser. Hal ini memicu silent error pada algoritma SHA-256 saat memuat daftar hydrant.
- **Solusi**: Dibuat implementasi murni JavaScript `sha256Sync` dan `safeUUID` di `lib/qr.ts` yang bebas dari ketergantungan API browser, serta mengaktifkan pembacaan instan dari cache IndexedDB (`getBundle`).

### Tahap 6: Deployment Produksi ke Vercel
- Menghubungkan akun GitHub `rc180981` ke Vercel.
- Mengimpor repositori `CekHidran` dan mendeploy ke domain produksi `cekhidran.vercel.app`.
- Dengan protokol HTTPS resmi di Vercel, fitur **Live Video Camera Scanner** di browser smartphone langsung aktif 100% responsif tanpa peringatan keamanan.

### Tahap 7: Otorisasi Domain di Firebase Auth
- Menambahkan domain `cekhidran.vercel.app` ke daftar **Authorized Domains** pada Firebase Console (`Authentication` ➔ `Settings` ➔ `Authorized domains`) agar proses login dari domain publik diizinkan.

### Tahap 8: Pembaruan Modul Sinkronisasi Antrean Offline
- **Masalah**: Data hasil pemeriksaan petugas sempat tertahan di *"Antrean Offline: 1"* karena script `syncQueue()` masih memanggil endpoint lama `/api/inspections`.
- **Solusi**: Modul `lib/offline/sync.ts` dirombak agar menulis langsung ke koleksi Firestore `inspections` dan `findings`. Foto kondisi dan tanda tangan digital otomatis dikonversi ke Base64 data URL dan disimpan ke dokumen inspeksi.

---

## 6. Konfigurasi Lingkungan (Environment Variables)

Variabel lingkungan yang digunakan oleh sistem (tersimpan aman di konfigurasi client `lib/firebase/client.ts`):

```env
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyD2sRyJ2pg50YnoqmG4W2zrKagK1u-a3KM
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=hidran-7d88c.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=hidran-7d88c
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=hidran-7d88c.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=616864462935
NEXT_PUBLIC_FIREBASE_APP_ID=1:616864462935:web:a901af5bc1465d624f8b12
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=G-XS9L6TWF34
```

---

## 7. Aturan Keamanan Database (Firestore Security Rules)

Aturan yang diterapkan pada Firebase Console (`Cloud Firestore` ➔ tab `Rules`):

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

> **Catatan**: Aturan di atas menjamin bahwa seluruh data aman dari akses publik anonim, dan hanya pengguna yang telah berhasil login (Admin, Supervisor, Petugas, Manajemen) yang dapat membaca dan mengisi pemeriksaan.

---

## 8. Panduan Operasional Lapangan (SOP Petugas)

1. **Buka Aplikasi di HP**:
   - Buka browser di smartphone dan akses: `https://cekhidran.vercel.app`
   - Masuk menggunakan email `petugas@cekhidran.id` dan kata sandi `Petugas#12345`.
2. **Mulai Pemeriksaan**:
   - Tekan tombol **"Mulai Periksa Hydrant"**.
   - Izinkan (*Allow*) saat peramban meminta izin akses kamera.
3. **Langkah 1: Scan QR Code Fisik**:
   - Arahkan kamera ke QR Code yang tertempel pada box hydrant.
   - Kamera akan otomatis mengenali nomor titik hydrant seketika (bergetar & bunyi bip).
4. **Langkah 2: Ambil Foto Kondisi**:
   - Jepret minimal 1 foto fisik hydrant (maksimal 3 foto).
   - Stempel identitas berupa Tanggal, Jam, Nama Petugas, dan Nomor Hydrant otomatis tersemat di sudut foto.
5. **Langkah 3: Pengisian Checklist & Tanda Tangan**:
   - Periksa 4 item peralatan (Kebersihan, Tekanan Bar, Fisik Kran, Selang & Seal). Pilih **Baik** atau **Tidak Baik**.
   - Jika ada kerusakan, tulis keterangan pada kolom Catatan.
   - Buat tanda tangan digital menggunakan jari di kotak tanda tangan.
   - Tekan **"Simpan & Selesai Pemeriksaan"**.
6. **Sinkronisasi Otomatis**:
   - Jika ponsel terhubung ke internet, data langsung masuk ke server dalam 1 detik.
   - Jika ponsel berada di area tanpa sinyal (*blind spot*), data disimpan di antrean lokal (*offline queue*), dan otomatis terkirim saat ponsel kembali mendapat sinyal.

---

## 9. Prosedur Pembaruan Kode Selanjutnya (Maintenance)

Karena repositori GitHub sudah terhubung langsung dengan pipeline CI/CD Vercel, pembaruan di masa mendatang sangat sederhana:

1. Lakukan perubahan kode di komputer lokal Anda (`D:\FAJAR Apps\HidranLokal`).
2. Jalankan perintah:
   ```bash
   git add .
   git commit -m "keterangan pembaruan"
   git push origin main
   ```
3. Vercel akan otomatis mendeteksi *push* tersebut, melakukan *build*, dan memperbarui web produksi dalam waktu kurang dari 2 menit tanpa *downtime*.
