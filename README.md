# Skupy HPP Gamis

Aplikasi web SaaS profesional untuk menghitung Harga Pokok Produksi (HPP) gamis, dress, tunik, dan fashion muslimah. Halaman awal langsung membuka form perhitungan HPP, lalu menyediakan dashboard, riwayat, converter yard-meter, export laporan, share WhatsApp, auth Supabase, dan PWA.

## Fitur

- Kalkulator HPP realtime untuk bahan, printing, jahit, aksesoris, label, pengiriman, dan biaya lain.
- Kalkulator harga jual dengan margin 20%, 30%, 40%, 50%, dan custom.
- Upload logo brand dan foto produk ke Supabase Storage.
- Dashboard sederhana untuk total model, total HPP, HPP terakhir, dan quick action.
- Riwayat perhitungan dengan search, filter tanggal, edit, hapus, dan duplikasi.
- Converter Yard ke Meter dan Meter ke Yard.
- Export laporan profesional PNG, PDF, dan Excel.
- Share WhatsApp dengan PNG otomatis dan pesan terisi.
- Supabase Auth dengan role Owner dan Staff.
- Pengaturan brand, warna tema, dark mode, light mode.
- PWA installable untuk Android, iPhone, dan desktop.

## Teknologi

- Next.js 15 App Router
- TypeScript
- Tailwind CSS
- Shadcn-style UI components
- Supabase Database, Auth, dan Storage
- React Hook Form
- Zustand
- html-to-image
- jsPDF
- XLSX
- qrcode.react

## Menjalankan Lokal

```bash
npm install
npm run dev
```

Buka `http://localhost:3000`.

Tanpa environment Supabase, aplikasi berjalan dalam mode demo lokal dengan penyimpanan `localStorage`. Untuk produksi, isi environment Supabase.

## Environment Variable

Buat `.env.local` dari `.env.example`.

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Di Vercel, masukkan variable yang sama pada Project Settings > Environment Variables.

## Setup Supabase

1. Buat project baru di Supabase.
2. Buka SQL Editor.
3. Jalankan seluruh isi `supabase/schema.sql`.
4. Pastikan Auth Email aktif.
5. Storage bucket `brand-assets` dan `product-photos` akan dibuat otomatis oleh SQL.
6. Copy Project URL dan anon public key ke `.env.local` atau Vercel.

SQL membuat:

- `profiles`
- `brand_settings`
- `products`
- trigger profile saat user baru dibuat
- Row Level Security
- policies Owner/Staff
- bucket Storage untuk logo dan foto produk

## Role

- Owner: input, lihat data, edit, hapus, export, pengaturan brand.
- Staff: input dan lihat data, tanpa akses hapus atau pengaturan.

## Export

PNG dan PDF memakai layout laporan yang sama:

- Instagram Portrait 1080x1350
- Landscape 1920x1080
- A4 1240x1754

Excel berisi kolom:

- Tanggal
- Kode Produk
- Nama Produk
- HPP
- Margin
- Harga Jual
- Profit

## Upload ke GitHub

```bash
git init
git add .
git commit -m "Initial Skupy HPP Gamis app"
git branch -M main
git remote add origin https://github.com/username/skupy-hpp-gamis.git
git push -u origin main
```

## Deploy ke Vercel

1. Login ke Vercel.
2. Import repository GitHub.
3. Pilih framework Next.js.
4. Tambahkan environment variable Supabase.
5. Deploy.

Build command:

```bash
npm run build
```

Output directory mengikuti default Next.js.

## Struktur Project

```text
app/
components/
hooks/
lib/
public/
styles/
supabase/
types/
```

Project siap dikembangkan, dipush ke GitHub, dan dideploy ke Vercel.
