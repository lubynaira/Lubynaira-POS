-- =====================================================================
-- Luby Naira POS — Migration: Sinkronisasi realtime, FK cascade, format
--                        invoice harian, dan kolom pendukung.
-- =====================================================================
-- Tujuan :
--   • Pastikan debts.transaction_id pakai ON DELETE CASCADE
--     (sebelumnya SET NULL, sehingga delete invoice meninggalkan piutang).
--   • Pastikan debt_payments.debt_id pakai ON DELETE CASCADE.
--   • Tambahkan invoice_no di debt_payments untuk cross-link laporan.
--   • Tambahkan index pada kolom yang sering di-filter.
--   • Aktifkan realtime untuk semua tabel POS.
--   • Buat helper SQL public.recalculate_customer_summary(uuid)
--     supaya client (atau psql/Edge Function lain) bisa minta DB
--     menghitung ulang total_transactions / total_spent / total_debt.
--
-- File ini AMAN dijalankan berulang kali (idempotent).
-- =====================================================================

-- 1) Kolom tambahan ----------------------------------------------------

-- 1a. due_date di transactions (sudah ada di v30; ditulis ulang agar
--     migration ini bisa berdiri sendiri kalau dijalankan stand-alone).
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS due_date date;

-- 1b. invoice_no di debt_payments (cross-link ke transaksi/order).
--     Tidak NOT NULL — pembayaran lama mungkin masih kosong.
ALTER TABLE public.debt_payments
  ADD COLUMN IF NOT EXISTS invoice_no text;

-- 1c. Backfill invoice_no di debt_payments dari debt.invoice_no.
UPDATE public.debt_payments dp
   SET invoice_no = d.invoice_no
  FROM public.debts d
 WHERE d.id = dp.debt_id
   AND dp.invoice_no IS NULL
   AND d.invoice_no IS NOT NULL;

-- 2) Foreign keys + ON DELETE CASCADE ----------------------------------

-- Drop FK lama (apapun nama-nya) lalu re-create dengan CASCADE.
DO $$
DECLARE
  fk_name text;
BEGIN
  -- debts.transaction_id → transactions.id
  SELECT tc.constraint_name INTO fk_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
   WHERE tc.constraint_type = 'FOREIGN KEY'
     AND tc.table_schema = 'public'
     AND tc.table_name   = 'debts'
     AND kcu.column_name = 'transaction_id'
   LIMIT 1;
  IF fk_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.debts DROP CONSTRAINT %I', fk_name);
  END IF;
END $$;

ALTER TABLE public.debts
  ADD CONSTRAINT debts_transaction_id_fkey
  FOREIGN KEY (transaction_id) REFERENCES public.transactions(id)
  ON DELETE CASCADE;

-- debts.customer_id sudah CASCADE di schema asli, tetap pasang ulang
-- secara idempotent biar konsisten.
DO $$
DECLARE
  fk_name text;
BEGIN
  SELECT tc.constraint_name INTO fk_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
   WHERE tc.constraint_type = 'FOREIGN KEY'
     AND tc.table_schema = 'public'
     AND tc.table_name   = 'debts'
     AND kcu.column_name = 'customer_id'
   LIMIT 1;
  IF fk_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.debts DROP CONSTRAINT %I', fk_name);
  END IF;
END $$;

ALTER TABLE public.debts
  ADD CONSTRAINT debts_customer_id_fkey
  FOREIGN KEY (customer_id) REFERENCES public.customers(id)
  ON DELETE CASCADE;

-- debt_payments.debt_id → debts.id (CASCADE)
DO $$
DECLARE
  fk_name text;
BEGIN
  SELECT tc.constraint_name INTO fk_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
   WHERE tc.constraint_type = 'FOREIGN KEY'
     AND tc.table_schema = 'public'
     AND tc.table_name   = 'debt_payments'
     AND kcu.column_name = 'debt_id'
   LIMIT 1;
  IF fk_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.debt_payments DROP CONSTRAINT %I', fk_name);
  END IF;
END $$;

ALTER TABLE public.debt_payments
  ADD CONSTRAINT debt_payments_debt_id_fkey
  FOREIGN KEY (debt_id) REFERENCES public.debts(id)
  ON DELETE CASCADE;

-- 3) Index -------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_transactions_invoice_no
  ON public.transactions (invoice_no);
CREATE INDEX IF NOT EXISTS idx_transactions_customer_id
  ON public.transactions (customer_id);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at_desc
  ON public.transactions (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_debts_transaction_id
  ON public.debts (transaction_id);
CREATE INDEX IF NOT EXISTS idx_debts_invoice_no
  ON public.debts (invoice_no);

CREATE INDEX IF NOT EXISTS idx_debt_payments_debt_id
  ON public.debt_payments (debt_id);
CREATE INDEX IF NOT EXISTS idx_debt_payments_invoice_no
  ON public.debt_payments (invoice_no);
CREATE INDEX IF NOT EXISTS idx_debt_payments_paid_at
  ON public.debt_payments (paid_at DESC);

-- 4) Helper function: recalculate_customer_summary ---------------------
-- Hitung ulang total_transactions, total_spent, total_debt untuk
-- satu customer berdasarkan tabel transactions + debts.
CREATE OR REPLACE FUNCTION public.recalculate_customer_summary(p_customer_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_trx_count   integer;
  v_total_spent numeric;
  v_total_debt  numeric;
BEGIN
  SELECT COUNT(*), COALESCE(SUM(total), 0)
    INTO v_trx_count, v_total_spent
    FROM public.transactions
   WHERE customer_id = p_customer_id;

  SELECT COALESCE(SUM(remaining), 0)
    INTO v_total_debt
    FROM public.debts
   WHERE customer_id = p_customer_id
     AND status = 'aktif';

  UPDATE public.customers
     SET total_transactions = v_trx_count,
         total_spent        = v_total_spent,
         total_debt         = v_total_debt
   WHERE id = p_customer_id;
END $$;

-- 5) Trigger: setelah DELETE transactions / debts → recalc customer ---
CREATE OR REPLACE FUNCTION public.tg_recalc_customer_after_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.customer_id IS NOT NULL THEN
    PERFORM public.recalculate_customer_summary(OLD.customer_id);
  END IF;
  RETURN OLD;
END $$;

DROP TRIGGER IF EXISTS transactions_recalc_customer ON public.transactions;
CREATE TRIGGER transactions_recalc_customer
  AFTER DELETE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.tg_recalc_customer_after_delete();

DROP TRIGGER IF EXISTS debts_recalc_customer ON public.debts;
CREATE TRIGGER debts_recalc_customer
  AFTER DELETE ON public.debts
  FOR EACH ROW EXECUTE FUNCTION public.tg_recalc_customer_after_delete();

-- 6) Realtime: pastikan publication mencakup semua tabel utama --------
DO $$
DECLARE
  tbl text;
  pubs text[] := ARRAY['transactions','debts','debt_payments','customers','products'];
BEGIN
  FOREACH tbl IN ARRAY pubs LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime'
         AND schemaname = 'public'
         AND tablename = tbl
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', tbl);
    END IF;
  END LOOP;
END $$;

-- 7) Refresh PostgREST schema cache ------------------------------------
NOTIFY pgrst, 'reload schema';

-- =====================================================================
-- Selesai. Setelah migrasi:
--   • Hapus invoice → piutang + history pembayaran ikut terhapus
--     dan total_debt customer otomatis ter-recalc.
--   • Realtime channel di app mengupdate UI tanpa reload.
--   • Aplikasi sekarang membuat invoice format DDMMYYYY-001
--     dan order_no format ORD-DDMMYYYY-001 (reset harian).
-- =====================================================================
