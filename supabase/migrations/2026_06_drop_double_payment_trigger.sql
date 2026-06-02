-- =====================================================================
-- Luby Naira POS — Migration: HOTFIX bug pembayaran terpotong dobel
-- =====================================================================
-- Tujuan : Memperbaiki bug "bayar Rp1.000.000 mengurangi Rp2.000.000".
--
-- Root cause:
--   Trigger `debt_payments_apply` (fungsi `tg_apply_debt_payment`)
--   menambahkan kembali NEW.amount ke debts.paid SETELAH client sudah
--   mengupdate debts.paid via processDebtPayment. Akibatnya angka
--   pembayaran dikurangkan dua kali (sekali dari client, sekali dari
--   trigger).
--
--   Urutan yang terjadi:
--     1. client: UPDATE debts SET paid = paidAfter   (e.g. 1.000.000)
--     2. client: INSERT INTO debt_payments (amount = 1.000.000)
--     3. trigger fires: SELECT debts.paid (= 1.000.000) +
--                       NEW.amount (= 1.000.000) = 2.000.000
--                       UPDATE debts SET paid = 2.000.000  ← DOUBLE!
--                       UPDATE transactions ... = 2.000.000
--
-- Fix:
--   Drop trigger. Client `processDebtPayment` di useStore.js sudah
--   melakukan semua update yang dibutuhkan secara eksplisit:
--     • UPDATE transactions
--     • UPDATE debts
--     • INSERT debt_payments (history saja, tidak boleh mutasi)
--     • recalculateCustomerSummary(customer_id)
--
-- Cara pakai : Tempel di Supabase SQL Editor → Run. Idempotent.
-- =====================================================================

-- 1) Hapus trigger AFTER INSERT pada debt_payments
DROP TRIGGER IF EXISTS debt_payments_apply ON public.debt_payments;

-- 2) Hapus function trigger-nya (boleh, sudah tidak dipakai)
DROP FUNCTION IF EXISTS public.tg_apply_debt_payment();

-- 3) Recompute customers.total_debt setelah cleanup
-- (untuk fix angka yang sudah terlanjur tercatat double)
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

-- 4) Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';

-- =====================================================================
-- Selesai. Setelah migrasi:
--   • Bayar Rp1.000.000 mengurangi tepat Rp1.000.000 (tidak lagi 2x)
--   • Sisa = totalDebt - paid (akurat)
--   • Order, Piutang, Customers, Dashboard sinkron
--
-- Audit cek (opsional):
--   SELECT debt_id, amount, paid_at, COUNT(*) AS dup
--     FROM public.debt_payments
--    GROUP BY debt_id, amount, date_trunc('minute', paid_at)
--   HAVING COUNT(*) > 1
--    ORDER BY paid_at DESC;
-- =====================================================================
