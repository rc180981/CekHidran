# Cek Hidran 🚒

Aplikasi Web Progressive (PWA) untuk mencatat dan memantau pemeriksaan fisik **Hydrant Box** beserta equipment di dalamnya (Nozzle & Packing seal, Selang Hydrant, Selang & Packing seal Hydrant) untuk 3 gudang (**WH2, WH3, WH4**), menggantikan lembar kertas checksheet manual.

---

## 🛠️ Tech Stack
- **Framework**: Next.js 15 (App Router) + TypeScript
- **Styling**: Tailwind CSS (Warna teal `#0E7C86`, latar `#F6F7F9`, sidebar `#263238`, font *Plus Jakarta Sans*)
- **Database & Auth**: Supabase (PostgreSQL, Row Level Security / RLS, Auth, Storage privat)
- **PWA & Offline**: Service Worker, Web App Manifest, IndexedDB (idb) antrean sinkronisasi
- **Ekspor Dokumen**: jsPDF, jspdf-autotable, ExcelJS, QRCode, jsQR

---

## 🔐 Model Hak Akses (RBAC)
Terdapat 4 peran pengguna yang ditegakkan berlapis via **Supabase RLS** dan **validasi sisi server**:
1. **admin_sistem**: Hak akses penuh (kelola titik hydrant & equipment, pengguna & peran, pengaturan, lihat semua gudang, audit logs).
2. **supervisor_k3**: Lihat dashboard semua gudang, riwayat checksheet, verifikasi & tutup temuan rusak, ekspor laporan.
3. **petugas**: Antarmuka mobile-first 3 langkah untuk scan QR, foto berkamera ber-watermark, checklist & TTD digital. **Hanya dapat melihat dan memeriksa hydrant di gudang yang ditugaskan**.
4. **manajemen**: Read-only dashboard statistik, riwayat checksheet semua gudang, dan ekspor laporan PDF/Excel. **Tidak dapat mengisi checklist**.

---

## 🚀 Panduan Setup & Migrasi Supabase

### 1. Buat Proyek Supabase
1. Buat project baru di [Supabase Dashboard](https://supabase.com).
2. Buka menu **SQL Editor** pada Supabase.
3. Jalankan script migrasi berurutan:
   - Salin dan jalankan seluruh isi file: `supabase/migrations/20261007000001_init.sql`
   - Salin dan jalankan seluruh isi file: `supabase/seed.sql` (membuat 3 gudang WH2, WH3, WH4, 54 titik hydrant lengkap posisi indoor/outdoor, dan 4 item checklist standar).

### 2. Konfigurasi Variabel Lingkungan (.env.local)
Salin `.env.example` menjadi `.env.local`:
```bash
cp .env.example .env.local
```

Isi variabel berikut dari menu **Project Settings → API** di Supabase:
```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...anon_key
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...service_role_key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3. Seed Akun Contoh Pengguna
Jalankan skrip inisialisasi akun contoh untuk 4 peran:
```bash
npm run seed:users
```
Akun bawaan yang dibuat:
| Peran | Email | Kata Sandi | Penugasan |
|---|---|---|---|
| Admin Sistem | `admin@cekhidran.id` | `Admin#12345` | Semua Gudang |
| Supervisor K3 | `supervisor@cekhidran.id` | `Supervisor#12345` | Semua Gudang |
| Petugas | `petugas@cekhidran.id` | `Petugas#12345` | Khusus **WH2** |
| Manajemen | `manajemen@cekhidran.id` | `Manajemen#12345` | Semua Gudang (Read-only) |

---

## 🧪 Menjalankan Uji RBAC
Uji otomatis aturan keamanan matriks peran dan penolakan akses:
```bash
# Uji unit matriks izin RBAC (58 test assertions)
npm run test

# Uji integrasi RLS terhadap instance Supabase sungguhan
npm run test:rls
```

---

## 📱 Fitur Utama Aplikasi

### 1. Alur Petugas Lapangan (Mobile-First 3 Langkah)
- **Langkah 1 (Info Hydrant)**: Pindai QR code fisik di box hydrant. Nomor hydrant, jenis, lokasi, gudang, waktu, dan nama petugas terisi otomatis. Petugas diblokir jika memindai QR hydrant di luar gudang tugasnya.
- **Langkah 2 (Foto Kondisi)**: Wajib 1–3 foto langsung dari kamera (bukan galeri). Foto otomatis dibubuhi cap air identitas tanggal, jam WIB, nama petugas, dan nomor hydrant.
- **Langkah 3 (Checklist & TTD)**: Pilihan Baik/Tidak baik untuk 4 equipment standar. Pilihan "Tidak baik" otomatis dicatat sebagai Temuan K3. Dilengkapi kanvas tanda tangan digital.
- **Mode Luar Ruang (Offline)**: Jika area gudang luar tidak terjangkau sinyal, data tersimpan di IndexedDB dan tersinkronisasi otomatis saat kembali online.

### 2. Layar Admin & Supervisor (Desktop)
- **Dashboard Statistik**: Total titik diperiksa, titik belum dicek, temuan K3 terbuka, persentase kepatuhan 7 hari, dan progres per gudang.
- **Riwayat Checksheet**: Tampilan persis lembar kertas fisik dengan baris 31 hari, 4 kolom equipment, status paraf TTD, catatan, dan tautan foto kondisi.
- **Verifikasi Temuan**: Pantau temuan yang timbul otomatis, ubah status menjadi *Dalam Perbaikan* atau *Selesai*.
- **Kelola Hydrant & Generator QR**: Tambah/nonaktifkan titik dan item equipment, serta unduh PDF label QR Code ukuran A4 siap cetak dan tempel di box.
- **Ekspor Laporan**: Unduh PDF checksheet resmi dan Excel rekapitulasi.

---

## 🌐 Panduan Deploy ke Vercel

1. Push repositori ini ke GitHub / GitLab.
2. Buka [Vercel Dashboard](https://vercel.com) dan pilih **Add New Project**.
3. Import repositori `HidranLokal`.
4. Masukkan Environment Variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `NEXT_PUBLIC_APP_URL` (isi dengan domain Vercel Anda, misal: `https://cek-hidran.vercel.app`)
5. Klik **Deploy**.
6. Aplikasi PWA siap di-install langsung dari browser ponsel petugas melalui tombol *Tambahkan ke Layar Utama* / *Install App*.
