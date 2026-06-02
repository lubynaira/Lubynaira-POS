-- =====================================================================
-- Luby Naira POS — Data Fix: Sinkronisasi Order ↔ Piutang ↔ Customer
-- =====================================================================
-- Tujuan : Memperbaiki data lama dimana invoice di halaman Order sudah
--          LUNAS tetapi di halaman Piutang masih AKTIF (dan sebaliknya).
--
-- Penyebab : Sebelum versi ini, `updateTransactionStatus` di Order tidak
--            ikut mengupdate tabel `debts`. Akibatnya status divergen.
--
-- Cara pakai : Tempel SELURUH file ini di Supabase SQL Editor → Run.
--              Aman dijalankan berulang kali.
-- =====================================================================

-- 1) Sync debts.paid/remaining/status dari transactions berdasarkan invoice_no.
--    Sumber kebenaran: nominal di transactions (karena Order yang punya
--    UI checkbox "Lunas"). Debt mengikuti.
UPDATE public.debts d
   SET paid      = COALESCE(t.paid, 0),
       remaining = GREATEST(0, COALESCE(t.remaining, 0)),
       status    = CASE
         WHEN COALESCE(t.remaining, 0) <= 0 THEN 'lunas'
         ELSE 'aktif'
       END,
       updated_at = now()
  FROM public.transactions t
 WHERE d.invoice_no = t.invoice_no
   AND t.invoice_no IS NOT NULL;

-- 2) Cross-check: untuk debt yang link via transaction_id (bukan invoice_no),
--    lakukan sync yang sama.
UPDATE public.debts d
   SET paid      = COALESCE(t.paid, 0),
       remaining = GREATEST(0, COALESCE(t.remaining, 0)),
       status    = CASE
         WHEN COALESCE(t.remaining, 0) <= 0 THEN 'lunas'
         ELSE 'aktif'
       END,
       updated_at = now()
  FROM public.transactions t
 WHERE d.transaction_id = t.id
   AND (d.invoice_no IS NULL OR d.invoice_no <> t.invoice_no);

-- 3) Untuk debt yang sudah lunas (remaining=0) tapi transactions-nya masih
--    pending: tarik transaksi ikut lunas (kasus user hapus debt_payment
--    manual lewat SQL atau migrasi data).
UPDATE public.transactions t
   SET status    = 'lunas',
       paid      = t.total,
       dp        = t.total,
       remaining = 0
  FROM public.debts d
 WHERE d.transaction_id = t.id
   AND d.status = 'lunas'
   AND t.status <> 'lunas';

-- 4) Recompute customers.total_debt = SUM(debts.remaining WHERE aktif).
--    Customer yang tidak punya hutang aktif → total_debt = 0.
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

-- 5) Recompute customers.total_spent + total_transactions dari transactions.
UPDATE public.customers c
   SET total_transactions = COALESCE(s.cnt, 0),
       total_spent        = COALESCE(s.total, 0)
  FROM (
    SELECT customer_id,
           COUNT(*)         AS cnt,
           SUM(total)::numeric AS total
      FROM public.transactions
     WHERE customer_id IS NOT NULL
     GROUP BY customer_id
  ) s
 WHERE c.id = s.customer_id;

-- 6) Customers yang tidak punya transaksi sama sekali → nol-kan stat.
UPDATE public.customers c
   SET total_transactions = 0,
       total_spent        = 0
 WHERE NOT EXISTS (
   SELECT 1 FROM public.transactions t WHERE t.customer_id = c.id
 );

-- 7) Refresh PostgREST schema cache (untuk jaga-jaga).
NOTIFY pgrst, 'reload schema';

-- =====================================================================
-- Selesai. Sekarang:
--   • Order dan Piutang menampilkan status yang konsisten
--   • customers.total_debt akurat (0 untuk customer tanpa hutang aktif)
--   • customers.total_spent + total_transactions akurat
-- =====================================================================
