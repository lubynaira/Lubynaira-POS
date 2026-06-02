-- =====================================================================
-- Luby Naira POS — Migration: Performance Tuning (indexes + items cleanup)
-- =====================================================================
-- Tujuan : Menurunkan loading awal & latency refresh halaman.
--          Mengecilkan ukuran tabel `transactions` dengan menghapus
--          field `image` (base64) dari kolom JSONB items.
--
-- Cara pakai : Tempel di Supabase SQL Editor → Run. Idempotent + safe
--              dijalankan stand-alone (tidak butuh migration lain).
-- =====================================================================

-- 0) PASTIKAN KOLOM ADA DULU -----------------------------------------
-- Migration ini melakukan CREATE INDEX pada kolom-kolom seperti
-- cashier_id, cashier_role, due_date, unit, dll. Jika user menjalankan
-- migration ini sebelum migrasi sebelumnya, kolom tersebut belum ada
-- dan CREATE INDEX akan gagal dengan "column XX does not exist".
-- Karena itu kita ADD COLUMN IF NOT EXISTS di sini sebagai self-defense.

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS cashier       text DEFAULT '';
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS cashier_id    uuid;
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS cashier_role  text DEFAULT '';
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS invoice_no    text;
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS customer_id   uuid;
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS status        text DEFAULT 'pending';
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS due_date      date;
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS created_at    timestamptz DEFAULT now();

ALTER TABLE public.debts
  ADD COLUMN IF NOT EXISTS cashier_id    uuid;
ALTER TABLE public.debts
  ADD COLUMN IF NOT EXISTS invoice_no    text;
ALTER TABLE public.debts
  ADD COLUMN IF NOT EXISTS customer_id   uuid;
ALTER TABLE public.debts
  ADD COLUMN IF NOT EXISTS status        text DEFAULT 'aktif';

ALTER TABLE public.debt_payments
  ADD COLUMN IF NOT EXISTS cashier_id    uuid;
ALTER TABLE public.debt_payments
  ADD COLUMN IF NOT EXISTS debt_id       uuid;
ALTER TABLE public.debt_payments
  ADD COLUMN IF NOT EXISTS paid_at       timestamptz DEFAULT now();
ALTER TABLE public.debt_payments
  ADD COLUMN IF NOT EXISTS invoice_no    text;

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS phone         text;

-- 1) Index lengkap — kolom sudah dipastikan ada di langkah 0 ----------
CREATE INDEX IF NOT EXISTS idx_transactions_invoice_no   ON public.transactions (invoice_no);
CREATE INDEX IF NOT EXISTS idx_transactions_customer_id  ON public.transactions (customer_id);
CREATE INDEX IF NOT EXISTS idx_transactions_cashier_id   ON public.transactions (cashier_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status       ON public.transactions (status);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at_desc
  ON public.transactions (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_debts_invoice_no          ON public.debts (invoice_no);
CREATE INDEX IF NOT EXISTS idx_debts_customer_id         ON public.debts (customer_id);
CREATE INDEX IF NOT EXISTS idx_debts_cashier_id          ON public.debts (cashier_id);
CREATE INDEX IF NOT EXISTS idx_debts_status              ON public.debts (status);

CREATE INDEX IF NOT EXISTS idx_debt_payments_debt_id     ON public.debt_payments (debt_id);
CREATE INDEX IF NOT EXISTS idx_debt_payments_cashier_id  ON public.debt_payments (cashier_id);
CREATE INDEX IF NOT EXISTS idx_debt_payments_paid_at_desc
  ON public.debt_payments (paid_at DESC);

CREATE INDEX IF NOT EXISTS idx_customers_phone           ON public.customers (phone);

-- 2) Bersihkan items JSONB di transactions lama ------------------------
-- Hapus key `image` dan `stock` dari setiap item dalam JSONB array.
-- Aman untuk semua row — jq-like operation native Postgres.
--
-- Sebelum: { name, price, qty, image: "data:image/png;base64,...", stock }
-- Sesudah: { name, price, qty }
--
-- Ini bisa menurunkan ukuran tabel signifikan kalau ada banyak invoice
-- dengan item ber-foto base64.
UPDATE public.transactions
   SET items = (
     SELECT jsonb_agg(item - 'image' - 'stock')
       FROM jsonb_array_elements(items) item
   )
 WHERE items IS NOT NULL
   AND jsonb_array_length(items) > 0
   AND items::text LIKE '%"image"%';  -- skip yang sudah bersih (idempotent)

-- 3) VACUUM (reklaim disk space setelah UPDATE besar) -------------------
-- Postgres tidak otomatis shrink table setelah UPDATE; VACUUM membersihkan
-- dead tuples. Kalau privilege tidak cukup, abaikan.
DO $$
BEGIN
  BEGIN
    EXECUTE 'VACUUM (ANALYZE) public.transactions';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'VACUUM butuh permission; skip. Tidak masalah, autovacuum akan handle.';
  WHEN OTHERS THEN
    RAISE NOTICE 'VACUUM gagal: %', SQLERRM;
  END;
END $$;

-- 4) Statistik untuk planner ------------------------------------------
-- ANALYZE membantu query planner pilih index yang tepat.
ANALYZE public.transactions;
ANALYZE public.debts;
ANALYZE public.debt_payments;
ANALYZE public.customers;
ANALYZE public.products;

-- 5) Refresh PostgREST schema cache ------------------------------------
NOTIFY pgrst, 'reload schema';

-- =====================================================================
-- Selesai. Performa setelah migrasi:
--   • Tabel transactions lebih ramping → SELECT lebih cepat
--   • Index lengkap → semua filter & sort akurat
--   • Statistik fresh → query planner pakai index yang tepat
-- =====================================================================
