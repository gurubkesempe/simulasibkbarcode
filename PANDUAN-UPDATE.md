# Panduan Update BK Digital

Ringkasan perubahan dan cara memasangnya. Kode frontend (GitHub) dan data (Google Sheet)
tetap terpisah seperti sebelumnya — **update kode ini tidak pernah menyentuh data yang
sudah tersimpan di Sheet kamu.**

## 1. Kenapa harus ganti Code.gs?

File `Code.gs` di folder ini adalah backend baru untuk Google Apps Script kamu. Backend
lama tidak ikut ter-upload ke GitHub (memang wajar, itu hidup terpisah di Apps Script
Editor kamu), jadi backend ini dibuat generik: dia otomatis membaca sheet yang sudah ada
sesuai nama tab & header kolom yang dipakai aplikasi (Siswa, Absensi, Pelanggaran,
Konseling, Kolaborasi) — **tidak menimpa data yang sudah ada**, hanya menambah kolom/sheet
baru (misalnya "Kebiasaan") kalau belum ada.

### Cara pasang
1. Buka Google Sheet database BK Digital kamu → **Extensions → Apps Script**.
2. Backup dulu: copy semua isi `Code.gs` lama kamu ke tempat aman (jaga-jaga).
3. Hapus isi `Code.gs` di editor, ganti dengan seluruh isi file `Code.gs` di paket ini.
4. Klik ikon gerigi **Project Settings** → scroll ke **Script Properties** → **Add script property**:
   - Property: `ACCESS_TOKEN`
   - Value: buat kata sandi acak sendiri, contoh `bkdigital-smpn1-2026-x7q`
   - Simpan.
5. **Deploy → New deployment → Web app**:
   - Execute as: **Me**
   - Who has access: **Anyone** (atau **Anyone within [nama sekolah]** kalau sekolah pakai
     Google Workspace — ini pilihan paling aman, karena hanya akun sekolah yang bisa akses).
6. Salin URL Web App yang baru (kalau redeploy dari deployment lama, URL biasanya tetap sama).

## 2. Kenapa ini bikin data lebih aman?

- Sebelumnya, siapapun yang tahu URL Web App bisa langsung baca/ubah data lewat API —
  tanpa perlu password apapun.
- Sekarang setiap request wajib menyertakan `ACCESS_TOKEN`. Tanpa token yang benar,
  backend menolak semua request (baca maupun tulis).
- Token ini **tidak disimpan di kode GitHub** — hanya kamu yang set lewat Script Properties,
  dan pengguna aplikasi memasukkannya sekali di layar login (tersimpan di localStorage
  browser mereka, sama seperti URL Web App).
- Kalau sekolah kamu pakai Google Workspace, pilihan "Anyone within [organisasi]" di
  langkah deploy adalah lapis keamanan tambahan yang jauh lebih kuat — hanya akun
  @sekolahmu.sch.id yang bisa memanggil API sama sekali, terlepas dari token.

## 3. Masuk ke aplikasi (frontend)

Saat pertama buka aplikasi (atau lewat Pengaturan di sidebar), isi:
- **URL Web App** — sama seperti sebelumnya.
- **Token / Kata Sandi Akses** — isi persis sama dengan `ACCESS_TOKEN` yang kamu set di
  Script Properties tadi.

Kalau kamu belum sempat set `ACCESS_TOKEN` di Script Properties, backend tetap jalan
tanpa token (supaya tidak mengunci diri sendiri saat setup) — tapi sangat disarankan
segera diisi begitu deployment berhasil.

## 4. Fitur baru

### a) Pencarian
- Kotak pencarian di atas sekarang aktif di semua halaman (Siswa, Absensi, Pelanggaran,
  Konseling, Kolaborasi, 7 Kebiasaan) — ketik untuk memfilter tabel/kartu yang sedang dibuka.
- Ketik nama/NIS siswa dari halaman manapun → muncul dropdown hasil pencarian siswa.
  Klik salah satu hasil untuk langsung membuka **Laporan Individu** siswa itu (siap cetak).

### b) Import data siswa dari Excel
- Di halaman **Data Siswa**, klik **Template Excel** untuk mengunduh file `.xlsx` kosong
  dengan kolom yang benar (NIS, Nama, Kelas, dst).
- Isi template itu di Excel/Spreadsheet, lalu klik **Import Excel** dan pilih file yang
  sudah diisi.
- **Aturan pentingnya:** import ini HANYA menambahkan siswa yang NIS-nya belum ada di
  database. Siswa yang NIS-nya sudah tercatat akan otomatis dilewati — data yang sudah
  ada, baik hasil input manual maupun import sebelumnya, **tidak akan pernah tertimpa**.
  Input manual lewat tombol "Tambah Siswa" tetap berfungsi seperti biasa dan bisa
  dipakai bergantian dengan import kapan saja.

### c) Menu "7 Kebiasaan Anak Indonesia Hebat"
- Menu baru di sidebar, mengikuti kolom pada formulir kertas yang kamu lampirkan:
  Bangun Pagi, Beribadah (Subuh/Duhur/Ashar/Maghrib/Isya, Dhuha, Tadarus/Murajaah,
  Lainnya), Berolahraga, Gemar Belajar, Makan Sehat dan Bergizi, Bermasyarakat,
  Istirahat Cukup, plus Paraf Ortu, Paraf Guru, dan Catatan Guru.
- Isi lewat tombol **Isi Formulir Harian**, lalu tampil sebagai kartu per siswa per hari.
- Tombol cetak (ikon printer) di tiap kartu menampilkan formulir dalam layout mirip
  formulir kertas aslinya, siap di-print/save as PDF.
- Rekap kebiasaan juga otomatis muncul di **Laporan** (baik rekap per kelas maupun
  laporan individu siswa).

### d) Absensi barcode via kamera (fitur terbaru)
- **Backend (`Code.gs`) berubah lagi** — sheet `Siswa` otomatis mendapat 2 kolom baru:
  `Barcode` dan `FotoURL`, ditambahkan di ujung kanan tanpa mengganggu kolom/data yang
  sudah ada. Ikuti lagi langkah **"Cara pasang"** di bagian 1 untuk menempel ulang
  `Code.gs` versi terbaru ke Apps Script Editor, lalu **Deploy → Manage deployments →
  Edit → Deploy versi baru**.
- **Foto & kode barcode siswa**: buka **Data Siswa → Tambah/Edit Siswa**. Ada 2 field baru:
  - **Foto Siswa** — upload atau ambil foto lewat kamera. Foto otomatis dikompres dan
    disimpan langsung sebagai teks di dalam sel Google Sheet (tidak perlu Google Drive
    atau layanan tambahan apapun).
  - **Kode Barcode** — klik **Buat Otomatis** untuk membuat kode unik (berdasarkan NIS),
    atau isi manual. Klik **Cetak Kartu Barcode** untuk mencetak kartu kecil berisi nama,
    kelas, dan barcode siap ditempel/dilaminating jadi kartu absen siswa.
  - Kolom `Barcode` juga tersedia opsional di template Import Excel kalau mau
    menyiapkan kode untuk banyak siswa sekaligus tanpa upload foto satu-satu.
- **Mode kamera di halaman Absensi**: klik tombol **"Mode Kamera (Barcode)"**.
  - Kamera langsung nyala dan standby.
  - Siswa tinggal menunjukkan kartu barcode ke kamera → sistem otomatis mencocokkan kode,
    menampilkan foto + nama siswa selama beberapa detik, dan langsung menyimpan absensi
    (default status "Hadir", bisa diganti ke Sakit/Izin lewat dropdown di pojok kanan atas
    sebelum kartu dipindai).
  - Setelah beberapa detik, layar otomatis kembali ke mode standby menunggu kartu
    berikutnya — tidak perlu sentuh apa pun di antara siswa.
  - Kalau kode tidak dikenali, atau siswa sudah tercatat absen hari itu, sistem akan
    menampilkan pesan yang sesuai lalu kembali standby.
  - Klik ikon ✕ di pojok kanan atas untuk menutup mode kamera (kamera otomatis dimatikan).
  - Fitur ini memakai kamera perangkat (laptop/HP/tablet) langsung dari browser — pastikan
    mengizinkan akses kamera saat diminta, dan pakai koneksi HTTPS (URL Web App Apps
    Script sudah otomatis HTTPS).

## 5. Menjamin update kode tidak menghapus data

Karena kode di GitHub Pages (frontend) dan data siswa di Google Sheet (lewat Apps Script)
adalah dua sistem yang terpisah total:
- Push/update kode ke GitHub **tidak pernah** menyentuh isi Google Sheet.
- Fungsi `update` di backend baru hanya mengubah kolom yang benar-benar dikirim, baris
  lain dan kolom lain di sheet tidak disentuh sama sekali.
- Fungsi import (`importBulk`) murni menambah baris baru, tidak pernah menimpa baris
  yang cocok NIS-nya.

Jadi urutan aman untuk update ke depan: cukup update file frontend (`index.html`,
`script.js`, `style.css`) di GitHub, dan kalau ada perubahan backend, tempel ulang isi
`Code.gs` ke Apps Script Editor lalu **Deploy → Manage deployments → Edit → Deploy versi
baru** (pakai deployment yang sama supaya URL tidak berubah). Data di Sheet tidak akan
terpengaruh oleh kedua langkah ini.
