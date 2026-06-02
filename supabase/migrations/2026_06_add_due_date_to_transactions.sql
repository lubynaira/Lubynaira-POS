-- =====================================================================
-- Luby Naira POS — Migration: Tambahkan kolom `due_date` ke tabel transactions
-- =====================================================================
-- Tujuan : Memperbaiki error
--          "Could not find the 'due_date' column of 'transactions' in the schema cache"
--          + memastikan tanggal jatuh tempo Hutang/Tempo tersimpan di
--            transaksi (bukan hanya di tabel debts).
--
-- Cara pakai (dijalankan sekali di Supabase):
--   1. Buka Supabase Dashboard → SQL Editor → New query
--   2. Tempel SELURUH file ini → klik Run
--   3. Tidak perlu reload halaman, schema cache otomatis di-refresh
--      lewat NOTIFY pgrst di akhir file.
--
-- File ini AMAN dijalankan berulang kali (idempotent):
--   * ADD COLUMN IF NOT EXISTS — tidak error jika kolom sudah ada
-- =====================================================================

-- 1) Tambahkan kolom `due_date` ke transactions (idempotent)
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS due_date date;

-- 2) Backfill: untuk transaksi hutang yang sudah ada, salin due_date
--    dari tabel debts (sumber kebenaran sebelumnya).
UPDATE public.transactions t
   SET due_date = d.due_date
  FROM public.debts d
 WHERE d.transaction_id = t.id
   AND t.due_date IS NULL
   AND d.due_date IS NOT NULL;

-- 3) Index ringan agar filter by due_date cepat
CREATE INDEX IF NOT EXISTS idx_transactions_due_date
  ON public.transactions (due_date);

-- =====================================================================
-- 4) PENTING: refresh PostgREST schema cache
-- =====================================================================
NOTIFY pgrst, 'reload schema';

-- Selesai. Invoice & menu Piutang sekarang dapat menampilkan tanggal
-- jatuh tempo dari transaksi langsung.
