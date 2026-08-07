# SevnLife OS — Neumorphism Edition

Asisten produktivitas & pelacak kesehatan personal. PWA offline-first, single-page app, tanpa backend/server — sama seperti SevnTracker.

## Menjalankan / Deploy

- **Lokal (server):** jalankan `python3 -m http.server` di folder ini lalu akses `http://localhost:8000`. Jangan buka `index.html` langsung dari file manager (`content://`/`file://`) — path relatif ke `app.js`/`vendor/` tidak akan kebaca.
- **Netlify:** drag-and-drop **isi folder ini** (bukan folder pembungkusnya) ke Netlify — `netlify.toml` sudah disertakan. Pastikan `index.html` ada persis di root yang di-upload.
- **Install sebagai app:** buka di Chrome/Edge/Safari lalu pilih "Add to Home Screen" / "Install App".

## Struktur File

```
index.html            HTML + CSS (design tokens Neumorphism, termasuk dark mode)
app.js                 Seluruh logic aplikasi
manifest.json          PWA manifest
service-worker.js      Cache-first offline strategy
icons/                 Ikon 192px & 512px
vendor/chartjs/        Chart.js (di-vendor lokal)
vendor/phosphor/       Font ikon Phosphor (regular/fill/bold, woff2 saja)
netlify.toml           Konfigurasi deploy Netlify
```

## Fitur

### Timeline & Health Tracker (Beranda)
Smart Timeline harian, kalkulasi kalori otomatis (Olahraga/Makan), Quick Tomorrow Planner, AI Schedule Parser (format `=== YYYY-MM-DD ===`).

### Dual Prompt Builder
- **Quick Daily Entry** — ketik tugas cepat di kotak input atas Beranda → prompt AI otomatis disalin & Gemini terbuka → tempel balasan → tugas masuk daftar harian dengan tag otomatis.
- **Goal Super-Planner** — tombol "+ Proyek Baru" di tab Proyek. Ketik tujuan besar → AI merombaknya jadi Fase + Tugas Terjadwal (dengan rentang hari eksekusi, lihat bawah) + Kebiasaan Pendukung.

### Penanganan Tugas Terlambat (Overdue) — BARU
Kalau tugas terjadwal tidak dikerjakan sampai lewat `scheduleEnd`-nya, tugas itu TIDAK hilang — ia otomatis "bocor" ke tampilan Hari Ini di Beranda (bukan cuma di tanggal jadwal aslinya) dengan badge merah "Terlambat N hari", dan bisa langsung digeser ke hari ini dengan satu ketukan pada badge tersebut ("Geser ke Hari Ini"). Kartu proyek juga menampilkan badge ringkasan "X terlambat" di header supaya risiko molornya proyek langsung kelihatan tanpa buka accordion. App sengaja TIDAK auto-menggeser tanggal tugas lain di fase yang sama atau target selesai proyek — supaya tidak ada perubahan jadwal diam-diam; keputusan reschedule tetap di tangan user.

### Penjadwalan Tugas Proyek (Day Range) — BARU
Goal Super-Planner sekarang juga meminta AI menentukan `duration_days` (estimasi total lama proyek) dan `day_range` per tugas (rentang hari kerja RELATIF, mis. `"3-5"` = hari ke-3 s/d ke-5 sejak proyek dibuat). App yang mengonversi ke tanggal kalender asli secara lokal — bukan AI — supaya tidak salah hitung tanggal/bulan. Tugas yang jadwalnya jatuh pada tanggal yang sedang dilihat otomatis muncul di **Beranda** dalam section "Terjadwal dari Proyek", jadi kamu langsung tahu apa yang harus dieksekusi hari itu tanpa buka tab Proyek. Kartu proyek juga menampilkan badge target tanggal selesai, dan tiap tugas menampilkan badge rentang tanggalnya.

### System Tagging Architecture
5 tag dasar: Productivity, Kesehatan, Belanja/Konsumtif, Refreshing/Gaming, Housework & Errands. Proyek otomatis dapat tag dinamis (`#NamaProyek`).

### Accordion UI & Auto-Progress
Kartu proyek collapsible, badge fase & estimasi durasi terpisah dari judul, progress bar ter-update otomatis tiap tugas dicentang.

### Layout Responsif Penuh (Phone / Tablet / Desktop) — DIPERBARUI
Tiga tingkatan breakpoint, bukan cuma satu kolom yang di-scale:
- **< 560px (HP):** tetap edge-to-edge seperti semula, bottom nav, satu kolom. Tidak ada perubahan visual di HP.
- **560–1023px (tablet):** kontainer jadi kartu terpusat dengan latar belakang beda warna (efek "bingkai perangkat"), tetap bottom nav.
- **≥ 1024px (desktop):** bottom nav berubah jadi **sidebar kiri tetap** (markup sama, cuma di-restyle lewat CSS — tidak ada duplikasi kode), kontainer konten melebar sampai `max-width:1200px` memakai ruang layar monitor, dan isi tiap halaman mengalir otomatis ke **2 kolom** (3 kolom di ≥1480px) pakai CSS multi-column — header/section-label tetap melebar penuh (`column-span:all`), sementara kartu (tugas, proyek, kebiasaan, dsb) dijamin tidak terpotong di tengah lewat `break-inside:avoid`.

### Perbaikan Overlap/Clipping di Bawah Halaman — DIPERBAIKI
Jarak aman di bawah konten (supaya tidak ketutupan bottom nav yang floating) diperbesar dari 84px → 108px + buffer tambahan 24px per halaman. Di layar desktop (sidebar, bukan bottom nav), buffer ini otomatis dilepas karena tidak dibutuhkan lagi.

### Perbaikan Responsif Desktop/Tablet & UI Bug — BARU
- **Bug utama:** `bottom-nav`, tombol `+` (FAB), dan notifikasi toast sebelumnya `position:fixed` relatif ke seluruh lebar browser, sementara konten (`.app`) dibatasi `max-width:520px` dan di-tengah. Di layar lebar (desktop/tablet), ini bikin nav bar melebar penuh sementara kartu-kartu di atasnya tetap sempit — patah secara visual. Sudah diperbaiki: ketiganya sekarang mengikuti lebar & posisi kolom `.app` yang sama persis di semua ukuran layar.
- **Tampilan desktop/tablet (≥560px):** app sekarang tampil sebagai kartu terpusat dengan latar belakang berbeda dari konten (mirip bingkai perangkat), bukan konten sempit yang mengambang di ruang kosong. Di bawah 560px (HP), tampilan tetap edge-to-edge seperti sebelumnya — tidak ada perubahan di mobile.
- **Bug overflow badge:** badge jadwal/terlambat yang teksnya panjang sekarang bisa membungkus baris baru (bukan meluber horizontal), dan teks badge "Terlambat" dipersingkat.

### Habit Engine (Kebiasaan) — BARU
Tab baru "Kebiasaan" di bottom nav. Setiap habit punya frekuensi **Setiap Hari**, **X kali/Minggu** (target mingguan), atau **Hari Spesifik** (pilih hari dalam seminggu). Sistem menghitung **streak 🔥** otomatis (hari berturut-turut, melompati hari yang memang tidak dijadwalkan untuk tipe "Hari Spesifik") atau **progres mingguan** (mis. `2/3 mgg ini`) untuk tipe "X kali/Minggu". Status selesai dibaca langsung dari `completions[tanggal]`, jadi checklist otomatis kosong lagi di hari baru tanpa job reset terpisah. Habit bisa berdiri sendiri atau dikaitkan ke sebuah Proyek — kebiasaan pendukung yang dihasilkan Goal Super-Planner otomatis masuk ke sini (bukan lagi jadi tugas biasa), lengkap dengan frekuensinya.

### Daily Time-Log Tracker (Jurnal)
Header sapaan dinamis, auto-sync tugas & kebiasaan selesai ke time-log (dengan deduplikasi by task/habit ID + tanggal), form catat aktivitas manual.

### Consistency Rate & Time Distribution (Jurnal) — BARU
Tiga angka konsistensi (7 / 14 / 30 hari terakhir) dihitung dari hari yang punya minimal satu time-log atau satu kebiasaan tercentang. Di bawahnya, grafik batang Chart.js menampilkan distribusi menit per tag dasar selama 7 hari terakhir.

### Contextual AI (Kebiasaan → identitas/lokasi/profesi) — BARU
Di tab Kebiasaan, tombol ✨ membuka **Analisa Konteks AI**. Ceritakan konteks personalmu (profesi, lokasi, kepercayaan, gaya hidup, dll) dalam bahasa bebas, generate prompt, tempel ke Gemini, lalu tempel hasil JSON-nya kembali. AI menyarankan 3-6 kebiasaan spesifik (bukan template generik) lengkap dengan tag dan frekuensi (Daily / Weekly:N / Days spesifik), langsung ditambahkan ke Habit Engine.

### Relational Tagging (Dynamic Project Tags) — BARU
Tag bukan cuma 5 kategori dasar lagi. Quick Daily Entry, form manual Time-Log, dan form Kebiasaan sekarang menawarkan tag proyek aktif juga (mis. `#GameBuilding`) — AI di Quick Entry akan otomatis memilih tag proyek kalau tugasnya berkaitan. Di Beranda, kalau ada lebih dari satu tag terpakai hari itu, muncul chip filter untuk mempersempit daftar Tugas Cepat.

### Local Native Reminders (Setelan)
Notifikasi lokal via Web Notification API + Service Worker — **catatan jujur:** ini hanya berbunyi selagi tab/app tetap terbuka di background (browser tidak mengizinkan PWA membangunkan diri sendiri saat benar-benar ditutup tanpa push server sungguhan).

### Story Maker (Jurnal)
Pilih POV (Aku/Gue/Saya) & gaya bahasa (Santai/Standar/Reflektif), generate prompt dari data time-log hari ini, tempel hasil AI, simpan sebagai entri jurnal.

## Format AI Schedule Parser (Timeline)

```
=== 2026-08-03 ===
08:00-10:00 Sesi Fokus Coding [Belajar/Kerja]
- Review PR
- Deploy staging

19:00-19:45 Lari Sore [Olahraga: Lari]
- Rute taman kota
```

## Data & Privasi

Seluruh data tersimpan di `localStorage` perangkat (`sevn_activities`, `sevn_tasks`, `sevn_projects`, `sevn_habits`, `sevn_timelog`, `sevn_journal`, `sevn_settings`) — tidak ada server, tidak ada akun. **Local Data Rescue** (Setelan → Ekspor/Impor) mencadangkan & memulihkan semua store sekaligus (backup lama format v1/v2 tetap bisa di-import, field yang tidak ada di file lama akan tetap kosong). Tombol "Hapus Semua Data" juga membersihkan seluruh store, termasuk kebiasaan.

## Catatan Migrasi

Jika kamu sudah punya proyek lama yang "kebiasaan pendukung"-nya sempat tersimpan sebagai tugas biasa (`isHabit: true`) sebelum update ini, entri itu masih tampil di dalam kartu proyek (di bawah label "Kebiasaan Pendukung") tapi sebagai checklist tugas biasa — tanpa streak. Kebiasaan yang dibuat *setelah* update ini (lewat tombol "Kebiasaan Baru" atau Goal Super-Planner) otomatis masuk ke Habit Engine yang baru dengan streak & frekuensi penuh.
