-- =====================================================================
-- Luby Naira POS — Migration: Tambahkan kolom `unit` ke tabel products
-- =====================================================================
-- Tujuan : Memperbaiki error
--          "Could not find the 'unit' column of 'products' in the schema cache"
--
-- Cara pakai (dijalankan sekali di Supabase):
--   1. Buka Supabase Dashboard → SQL Editor → New query
--   2. Tempel SELURUH file ini → klik Run
--   3. Tidak perlu reload halaman, schema cache otomatis di-refresh
--      lewat NOTIFY pgrst di akhir file.
--
-- File ini AMAN dijalankan berulang kali (idempotent):
--   * ADD COLUMN IF NOT EXISTS — tidak error jika kolom sudah ada
--   * ALTER COLUMN ... TYPE numeric — no-op jika tipe sudah numeric
--   * UPDATE ... WHERE unit IS NULL — hanya backfill row lama
-- =====================================================================

-- 1) Tambahkan kolom `unit` ke products (idempotent)
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS unit text DEFAULT 'pcs';

-- 2) Pastikan kolom `stock` bertipe numeric agar mendukung desimal
--    (Meter / Yard butuh 1.5, 2.75, dst.)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'products'
      AND column_name  = 'stock'
      AND data_type    = 'integer'
  ) THEN
    ALTER TABLE public.products
      ALTER COLUMN stock TYPE numeric USING stock::numeric;
  END IF;
END $$;

-- 3) Backfill: isi 'pcs' untuk produk lama yang masih NULL
UPDATE public.products
   SET unit = 'pcs'
 WHERE unit IS NULL;

-- 4) Pastikan default 'pcs' melekat (untuk insert masa depan)
ALTER TABLE public.products
  ALTER COLUMN unit SET DEFAULT 'pcs';

-- 5) Constraint opsional: batasi nilai unit ke 3 pilihan resmi
--    (drop dulu agar idempotent, lalu add)
ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_unit_check;
ALTER TABLE public.products
  ADD CONSTRAINT products_unit_check
  CHECK (unit IN ('pcs', 'meter', 'yard'));

-- 6) Index ringan agar filter by unit cepat (opsional, tidak wajib)
CREATE INDEX IF NOT EXISTS idx_products_unit ON public.products (unit);

-- =====================================================================
-- 7) PENTING: refresh PostgREST schema cache
--    Tanpa baris ini, Supabase REST API akan tetap menjawab
--    "Could not find the 'unit' column" sampai cache di-restart manual.
-- =====================================================================
NOTIFY pgrst, 'reload schema';

-- Selesai. Coba buka kembali aplikasi Luby Naira POS — form Tambah/Edit Produk
-- dan keranjang kasir sekarang bisa menyimpan unit (PCS / Meter / Yard).
