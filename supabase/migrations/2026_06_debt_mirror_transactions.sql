-- =====================================================================
-- Luby Naira POS — Migration: Debt MIRROR Transactions
-- =====================================================================
-- Tujuan : Memperbaiki bug "pembayaran cicilan terpotong dobel".
--
-- Root cause:
--   Sebelumnya `debts` di-seed dengan:
--     total_debt = total - DP   (= sisa setelah DP)
--     paid       = 0            (TIDAK include DP)
--     remaining  = total - DP
--   Sedangkan `transactions` punya paid = DP awal.
--   Saat processDebtPayment menyalin paidAfter dari debt ke transactions,
--   DP awal ke-overwrite → angka paid hilang Rp DP, dan setelah satu kali
--   bayar lagi data jadi tidak konsisten antar Order & Piutang.
--
-- Fix:
--   debt selalu MIRROR transactions:
--     debt.total_debt = transactions.total
--     debt.paid       = transactions.paid       (sudah include DP)
--     debt.remaining  = transactions.remaining  (= total - paid)
--
-- Cara pakai : Tempel di Supabase SQL Editor → Run. Idempotent.
-- =====================================================================

-- 1) Backfill debt ← transactions berdasar invoice_no (relasi utama) -----
UPDATE public.debts d
   SET total_debt = t.total,
       paid       = t.paid,
       remaining  = GREATEST(0, COALESCE(t.remaining, t.total - COALESCE(t.paid, 0))),
       status     = CASE
         WHEN GREATEST(0, COALESCE(t.remaining, t.total - COALESCE(t.paid, 0))) <= 0
           THEN 'lunas'
         ELSE 'aktif'
       END,
       updated_at = now()
  FROM public.transactions t
 WHERE d.invoice_no = t.invoice_no
   AND t.invoice_no IS NOT NULL;

-- 2) Fallback: untuk debt yang link via transaction_id (bukan invoice_no) -
UPDATE public.debts d
   SET total_debt = t.total,
       paid       = t.paid,
       remaining  = GREATEST(0, COALESCE(t.remaining, t.total - COALESCE(t.paid, 0))),
       status     = CASE
         WHEN GREATEST(0, COALESCE(t.remaining, t.total - COALESCE(t.paid, 0))) <= 0
           THEN 'lunas'
         ELSE 'aktif'
       END,
       updated_at = now()
  FROM public.transactions t
 WHERE d.transaction_id = t.id
   AND (d.invoice_no IS NULL OR d.invoice_no <> t.invoice_no);

-- 3) Detect duplicate debt_payments — bantu audit kasus double-submit ----
-- Query ini hanya menampilkan; tidak menghapus.
-- Buka SQL Editor → Run query ini untuk cek apakah ada pembayaran kembar:
--
-- SELECT debt_id, amount, paid_at, COUNT(*) AS dup_count
--   FROM public.debt_payments
--  GROUP BY debt_id, amount, date_trunc('minute', paid_at)
-- HAVING COUNT(*) > 1
--  ORDER BY paid_at DESC;
--
-- Kalau ada row dengan dup_count > 1, lihat manual lalu DELETE row excess.

-- 4) Recompute customers.total_debt setelah backfill --------------------
UPDATE public.customers c
   SET total_debt = 0
 WHERE NOT EXISTS (
   SELECT 1 FROM public.debts d
    WHERE d.customer_id = c.id AND d.status = 'aktif'
 );

UPDATE public.customers c
   SET total_debt = COALESCE(x.total_debt, 0)
  FROM (
    SELECT customer_id, SUM(remaining) AS total_debt
      FROM public.debts
     WHERE status = 'aktif'
     GROUP BY customer_id
  ) x
 WHERE c.id = x.customer_id;

-- 5) Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';

-- =====================================================================
-- Selesai. Setelah migrasi:
--   • debts.total_debt = transactions.total (full total tagihan)
--   • debts.paid       = transactions.paid (sudah include DP)
--   • debts.remaining  = total - paid (mirror)
--   • Pembayaran cicilan tidak lagi terpotong dobel
--   • Bayar dari Order = bayar dari Piutang (function sama)
-- =====================================================================
