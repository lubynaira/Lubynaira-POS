# 🖨️ Luby Naira POS — Enterprise Printing POS

Aplikasi kasir (POS) modern premium untuk usaha printing — luxury dark UI, glassmorphism, **fully responsive (desktop + iPad + iPhone)**, backed by Supabase.

## ✨ Tech Stack
- **React 18** + **Vite 5**
- **Tailwind CSS 3** (+ Framer Motion)
- **Lucide React** (icons)
- **Recharts** (charts)
- **Supabase** (Postgres + Storage + Realtime)
- **xlsx** (professional Excel export)
- **html2canvas** (invoice → JPEG for WhatsApp)

## 🆕 What's new (v3)
- **Customers** module — CRUD + statistics + transaction history
- **Piutang/Hutang** module — payment recording, due-date tracking, reminders
- **WhatsApp direct-chat** — reusable button with templates: Chat / Reminder / Invoice
- **Hutang/Tempo** as 4th payment method (auto creates debt entry)
- **Professional Excel export** with logo, currency formatting, totals row
- **Bottom nav** for iPhone/Android feel
- **Toast** notifications
- **Realtime updates** via Supabase channels

---

## 🚀 Setup

### 1. Buat project Supabase
1. Daftar / login di [supabase.com](https://supabase.com)
2. Klik **New Project**, pilih region (Singapore disarankan)
3. Tunggu sampai project siap (sekitar 2 menit)

### 2. Jalankan SQL schema
1. Buka **SQL Editor** → **New query**
2. Copy isi file [`supabase/schema.sql`](./supabase/schema.sql) → paste → klik **Run**
3. Akan otomatis dibuat:
   - Tabel `settings`, `admins`, `products`, `transactions`
   - Storage bucket `logos` (public)
   - RLS policies + seed data (admin default, info toko, dummy products)

### 3. Konfigurasi environment
1. Buka **Project Settings → API**, salin:
   - `Project URL` (https://xxxxx.supabase.co)
   - `anon` `public` key
2. Di root project, copy `.env.example` → `.env`:
   ```bash
   cp .env.example .env
   ```
3. Isi:
   ```
   VITE_SUPABASE_URL=https://xxxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
   ```

### 4. Install & jalankan
```bash
npm install
npm run dev
```
→ Buka `http://localhost:5173`
→ Login dengan **username: `admin`** · **password: `admin`**

### 5. Deploy ke Vercel
1. Push ke GitHub
2. Buka [vercel.com](https://vercel.com) → New Project → Import repo
3. **Penting:** di tab Environment Variables, tambahkan:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Deploy → selesai 🎉

---

## 🎯 Fitur

### Dashboard
- Statistik total omzet, omzet hari ini, pending order, total pelanggan
- Grafik penjualan 7 hari (area + bar chart)
- Distribusi kategori (pie chart)
- Produk terlaris + transaksi terbaru
- Banner welcome dengan logo Naira

### Kasir (POS)
- 3-column: sidebar – produk – cart
- Search realtime + filter kategori (search/filter di sisi client)
- Cart dengan qty +/-, hapus item
- Subtotal, diskon (nominal/persen), total otomatis
- 3 metode pembayaran: Cash, Transfer, QRIS
- DP & sisa pembayaran (auto status `pending`)
- Stok produk otomatis di-decrement di Supabase
- Checkout async dengan loading + error state
- Print + Share invoice langsung

### Produk
- CRUD lengkap (`products` table di Supabase)
- Upload foto via URL atau base64
- Modal form premium dengan validasi
- Statistik stok (nilai stok, stok menipis, stok habis)

### Order
- Daftar transaksi (table desktop / card mobile) dari Supabase
- Filter status: pending / proses / selesai / lunas
- Search by customer / invoice
- Tambah pembayaran (cicilan)
- **Export Excel** dengan filter range tanggal / per bulan
- Detail order modal + invoice

### Invoice (Modern, A4)
- Logo Naira / custom logo dari Supabase Storage
- Status badge berwarna
- Kartu From / To / Detail
- Tabel item premium
- **Rekening bank pakai font Bree Serif** (highlight di box hitam)
- Summary card dengan total + DP/sisa
- **Tombol Share via WhatsApp sebagai JPEG** (bukan teks):
  - Mobile / browser support: Web Share API native dengan file → langsung pilih WhatsApp
  - Fallback: download JPEG + buka WhatsApp Web dengan caption (user attach manual)
- Tombol Download JPEG terpisah
- Print A4 friendly (`@page size: A4`)

### Pengaturan (gear icon di kiri-bawah)
Tab-tab di modal Settings:
- **Toko** — ubah nama, tagline, alamat, no HP, rekening bank → save ke `settings` table
- **Logo** — upload logo depan & invoice → file di-upload ke Supabase Storage bucket `logos`, URL publik disimpan di `settings`
- **Admin** — daftar admin dari `admins` table, tambah baru, hapus (kecuali diri sendiri)
- **Password** — ganti password current user
- **Logout** button (merah, sticky)

### Authentication
- Login screen dengan validasi via Supabase
- Default admin: `admin` / `admin` (di-seed otomatis)
- Session di-keep dalam memory (refresh = login ulang, no localStorage)
- Loading splash saat fetch awal dari Supabase
- Error screen jika koneksi gagal (dengan instruksi setup)

---

## 🗄️ Database Schema

| Table        | Fields                                                                              |
|--------------|-------------------------------------------------------------------------------------|
| `settings`   | id=1 (single row), name, tagline, address, phone, email, bank_*, front_logo, invoice_logo, tax_rate |
| `admins`     | id (uuid), username (unique), password, name, role (owner/staff), created_at        |
| `products`   | id, name, category, price, modal, stock, description, image, created_at             |
| `transactions` | id, invoice_no (unique), customer, items (jsonb), subtotal, discount, tax, total, paid, dp, remaining, payment_method, status, created_at |

Storage bucket `logos` (public) menyimpan file logo yang di-upload.

⚠️ **Security note:** schema demo pakai RLS permissive (anon punya akses CRUD) dan password plain text. Untuk produksi, gunakan Supabase Auth + hash password (bcrypt/argon2) + RLS yang ketat.

---

## 🗂️ Struktur Folder
```
src/
  lib/
    supabase.js         # Supabase client + storage helpers
  components/
    Header.jsx          # Top bar
    Sidebar.jsx         # Sidebar + Settings button
    Modal.jsx           # Reusable modal
    Invoice.jsx         # A4 invoice + html2canvas WhatsApp share
    Settings.jsx        # Modal: Toko, Logo, Admin, Password, Logout
    Logo.jsx            # SVG + custom upload support
    ui.jsx              # Input, Button, Badge, EmptyState, ProductImage
  pages/
    Dashboard.jsx
    Kasir.jsx
    Produk.jsx
    Order.jsx           # + Excel export
    Login.jsx
  hooks/
    useStore.js         # Async Supabase data layer (loading/error/busy state)
  data/
    dummyData.js        # Categories, payment methods, fallback constants
  utils/
    helpers.js          # formatRupiah, CSV export, etc.
  App.jsx               # Splash loader + error screen + route gate
  main.jsx
  index.css
supabase/
  schema.sql            # CREATE TABLE + seed
.env.example
```

---

## 🐛 Troubleshooting

**"Tidak dapat terhubung ke Supabase"** → cek `.env`, pastikan URL & key benar, dan SQL sudah dijalankan.

**Login gagal** → cek tabel `admins` di Supabase, harus ada row username=`admin` password=`admin`.

**Logo tidak muncul setelah upload** → cek bucket `logos` di Supabase Dashboard → Storage. Pastikan public access enabled.

**WhatsApp share buka tab kosong** → di desktop browser tanpa Web Share API support, fallback akan download JPEG dan buka WhatsApp Web — user perlu attach JPEG manual.

---

Made with ❤️ for printing studios.
