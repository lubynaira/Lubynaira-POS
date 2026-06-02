-- =====================================================================
-- Luby Naira POS — Migration: Role Admin + Dashboard per-Admin
-- =====================================================================
-- Tujuan : Menambahkan kolom yang dibutuhkan untuk fitur role-based
--          dashboard dan filter per-admin.
--
-- Cara pakai : Tempel di Supabase SQL Editor → Run. Idempotent.
-- =====================================================================

-- 1) admins.role — pastikan ada + value valid: owner | admin | cashier
ALTER TABLE public.admins
  ADD COLUMN IF NOT EXISTS role text DEFAULT 'cashier';

-- Backfill: kalau row pertama belum punya role, jadikan owner
UPDATE public.admins
   SET role = 'owner'
 WHERE id = (SELECT id FROM public.admins ORDER BY created_at ASC LIMIT 1)
   AND (role IS NULL OR role = '');

UPDATE public.admins SET role = 'cashier' WHERE role IS NULL;

ALTER TABLE public.admins DROP CONSTRAINT IF EXISTS admins_role_check;
ALTER TABLE public.admins
  ADD CONSTRAINT admins_role_check
  CHECK (role IN ('owner', 'admin', 'cashier', 'staff'));

-- 2) transactions — pastikan cashier_id, cashier (name), cashier_role ada
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS cashier      text DEFAULT '';
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS cashier_id   uuid;
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS cashier_role text DEFAULT '';

-- Backfill cashier_role dari admin yang berelasi
UPDATE public.transactions t
   SET cashier_role = a.role
  FROM public.admins a
 WHERE t.cashier_id = a.id
   AND (t.cashier_role IS NULL OR t.cashier_role = '');

-- 3) debts — tambah cashier_id (siapa yang membuat hutang)
ALTER TABLE public.debts
  ADD COLUMN IF NOT EXISTS cashier_id uuid;

-- Backfill cashier_id debt dari trx yang berelasi
UPDATE public.debts d
   SET cashier_id = t.cashier_id
  FROM public.transactions t
 WHERE d.transaction_id = t.id
   AND d.cashier_id IS NULL
   AND t.cashier_id IS NOT NULL;

-- 4) debt_payments — pastikan cashier_id ada (sudah ada di schema lama)
ALTER TABLE public.debt_payments
  ADD COLUMN IF NOT EXISTS cashier_id uuid;

-- 5) Index untuk filter cepat by cashier_id
CREATE INDEX IF NOT EXISTS idx_transactions_cashier_id  ON public.transactions (cashier_id);
CREATE INDEX IF NOT EXISTS idx_debts_cashier_id         ON public.debts (cashier_id);
CREATE INDEX IF NOT EXISTS idx_debt_payments_cashier_id ON public.debt_payments (cashier_id);

-- 6) Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';

-- =====================================================================
-- Selesai. Setelah migrasi:
--   • Admin pertama otomatis jadi 'owner' (kalau belum di-set)
--   • Setiap checkout menyimpan cashier_id + cashier_role
--   • Dashboard owner bisa filter per-admin via cashier_id
-- =====================================================================
