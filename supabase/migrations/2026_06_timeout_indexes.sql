-- =====================================================================
-- Luby Naira POS — Migration: Anti-Timeout & Index Tambahan
-- =====================================================================
-- Tujuan : Memperbaiki error "canceling statement due to statement timeout"
--          yang muncul saat dashboard initial load + saat sinkronisasi
--          hutang. Penyebabnya: tabel transactions punya JSONB items
--          yang bisa besar (base64 image per item), dan select * tanpa
--          batas memicu transfer 10+ MB > 8 detik default Supabase.
--
-- Cara pakai : Tempel di Supabase SQL Editor → Run. Idempotent.
-- =====================================================================

-- 1) Naikkan statement_timeout untuk role anon (yang dipakai client web)
--    ke 30 detik. Kalau ada query yang masih > 30s, itu memang query yang
--    perlu diperbaiki di kode, bukan dimaafkan oleh timeout lagi.
--
--    Catatan: di Supabase managed, perintah ini hanya bisa dijalankan via
--    SQL Editor dengan service_role atau dashboard pgconfig. Kalau tidak
--    bisa di-set, abaikan — perbaikan utama tetap di client side (LIMIT
--    + debounce realtime).
DO $$
BEGIN
  BEGIN
    ALTER ROLE anon SET statement_timeout = '30s';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'Tidak punya privilege untuk set statement_timeout di anon. Lewati.';
  END;
  BEGIN
    ALTER ROLE authenticated SET statement_timeout = '30s';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'Tidak punya privilege untuk set statement_timeout di authenticated. Lewati.';
  END;
END $$;

-- 2) Index tambahan untuk query yang sering dipanggil --------
-- Pastikan single-row lookup oleh syncDebtPaymentStatus cepat:
CREATE INDEX IF NOT EXISTS idx_debts_invoice_no_unique_lookup
  ON public.debts (invoice_no);
CREATE INDEX IF NOT EXISTS idx_debts_transaction_id_lookup
  ON public.debts (transaction_id);
CREATE INDEX IF NOT EXISTS idx_debt_payments_debt_id_amount
  ON public.debt_payments (debt_id, amount);
CREATE INDEX IF NOT EXISTS idx_transactions_invoice_no_lookup
  ON public.transactions (invoice_no);
CREATE INDEX IF NOT EXISTS idx_transactions_customer_status
  ON public.transactions (customer_id, status);

-- 3) Audit: pastikan tidak ada recursive trigger ---------------
-- Trigger yang ada saat ini:
--   • debt_payments → tg_apply_debt_payment → update debts + transactions
--   • transactions INSERT → tg_bump_customer_stats → update customers
--   • transactions DELETE → tg_recalc_customer_after_delete → recalc fn
--   • debts DELETE → tg_recalc_customer_after_delete → recalc fn
--
-- Tidak ada trigger pada UPDATE customers / UPDATE transactions / UPDATE
-- debts yang menulis kembali ke tabel asal → TIDAK ADA LOOP RECURSIVE.
--
-- recalculate_customer_summary() hanya melakukan SELECT + UPDATE customers,
-- tidak memicu trigger lain.
--
-- Catatan: kalau muncul "stack depth limit exceeded" di masa depan,
-- gunakan pg_trigger_depth() di trigger function untuk safety.

-- 4) Refresh PostgREST schema cache ----------------------------
NOTIFY pgrst, 'reload schema';

-- =====================================================================
-- Selesai. Setelah migrasi:
--   • statement_timeout untuk client web naik ke 30 detik
--   • Index sudah lengkap untuk lookup invoice_no / transaction_id
--   • Tidak ada recursive trigger
-- =====================================================================
