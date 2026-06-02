-- ##################################################################
-- ##  LUBY NAIRA POS — SUPABASE BACKEND SETUP (ALL-IN-ONE)         ##
-- ##################################################################
-- Idempotent. Paste seluruh isi ke Supabase SQL Editor -> RUN.
--   1. Buat project baru di https://supabase.com
--   2. SQL Editor -> New query -> paste -> RUN
--   3. Settings -> API: salin URL + anon key ke .env aplikasi
-- ##################################################################


-- ================================================================
-- >>> BAGIAN: [0] SCHEMA DASAR (schema.sql) — tabel, GRANTS, role_check, CATEGORIES
-- ================================================================
-- =============================================================
-- Luby Naira POS — Supabase schema (Enterprise edition, fully idempotent)
-- Run in Supabase Dashboard → SQL Editor → New query → Run
--
-- SAFE TO RE-RUN: every statement is wrapped with IF NOT EXISTS,
-- ON CONFLICT DO NOTHING, DROP-then-CREATE for triggers, or DO blocks
-- with existence checks for objects that don't natively support it
-- (policies, publication membership).
-- =============================================================

-- ---------- CORE TABLES ----------

CREATE TABLE IF NOT EXISTS public.settings (
  id            integer PRIMARY KEY DEFAULT 1,
  name          text DEFAULT 'Luby Naira',
  tagline       text DEFAULT 'Cetak Custom Produkmu Disini!!!',
  address       text DEFAULT '',
  phone         text DEFAULT '',
  email         text DEFAULT '',
  bank_name     text DEFAULT '',
  bank_number   text DEFAULT '',
  bank_holder   text DEFAULT '',
  front_logo    text DEFAULT '',
  invoice_logo  text DEFAULT '',
  tax_rate      integer DEFAULT 0,
  updated_at    timestamptz DEFAULT now(),
  CONSTRAINT settings_single_row CHECK (id = 1)
);

CREATE TABLE IF NOT EXISTS public.admins (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username    text UNIQUE NOT NULL,
  password    text NOT NULL,
  name        text DEFAULT '',
  role        text DEFAULT 'cashier',
  created_at  timestamptz DEFAULT now()
);

-- Role hanya boleh owner/admin/cashier/staff
ALTER TABLE public.admins DROP CONSTRAINT IF EXISTS admins_role_check;
ALTER TABLE public.admins ADD CONSTRAINT admins_role_check CHECK (role IN ('owner', 'admin', 'cashier', 'staff'));

CREATE TABLE IF NOT EXISTS public.customers (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                text NOT NULL,
  phone               text DEFAULT '',
  whatsapp            text DEFAULT '',
  address             text DEFAULT '',
  email               text DEFAULT '',
  notes               text DEFAULT '',
  total_transactions  integer DEFAULT 0,
  total_spent         numeric DEFAULT 0,
  total_debt          numeric DEFAULT 0,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customers_name ON public.customers (name);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON public.customers (phone);

CREATE TABLE IF NOT EXISTS public.products (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL,
  category     text DEFAULT '',
  price        numeric DEFAULT 0,
  modal        numeric DEFAULT 0,
  stock        numeric DEFAULT 0,          -- numeric (was integer) for decimal units (meter/yard)
  unit         text DEFAULT 'pcs',         -- pcs | meter | yard
  description  text DEFAULT '',
  image        text DEFAULT '',
  created_at   timestamptz DEFAULT now()
);

-- Migration for existing products tables (idempotent, safe to re-run)
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS unit text DEFAULT 'pcs';

-- Convert stock to numeric only if it is still integer (decimal support)
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
    ALTER TABLE public.products ALTER COLUMN stock TYPE numeric USING stock::numeric;
  END IF;
END $$;

-- Backfill unit for legacy rows + lock the default
UPDATE public.products SET unit = 'pcs' WHERE unit IS NULL;
ALTER TABLE public.products ALTER COLUMN unit SET DEFAULT 'pcs';

-- Constraint: only PCS / Meter / Yard allowed
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_unit_check;
ALTER TABLE public.products ADD CONSTRAINT products_unit_check
  CHECK (unit IN ('pcs', 'meter', 'yard'));

CREATE INDEX IF NOT EXISTS idx_products_unit ON public.products (unit);

CREATE INDEX IF NOT EXISTS idx_products_category ON public.products (category);

CREATE TABLE IF NOT EXISTS public.transactions (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_no         text UNIQUE NOT NULL,
  order_no           text UNIQUE,
  customer_id        uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  customer           text DEFAULT 'Umum',
  customer_phone     text DEFAULT '',
  customer_address   text DEFAULT '',
  items              jsonb NOT NULL DEFAULT '[]'::jsonb,
  subtotal           numeric DEFAULT 0,
  discount           numeric DEFAULT 0,
  tax                numeric DEFAULT 0,
  total              numeric DEFAULT 0,
  paid               numeric DEFAULT 0,
  dp                 numeric DEFAULT 0,
  remaining          numeric DEFAULT 0,
  payment_method     text DEFAULT 'cash',     -- cash | transfer | qris | hutang
  status             text DEFAULT 'pending',  -- pending | proses | selesai | lunas (payment)
  order_status       text DEFAULT 'menunggu', -- menunggu | diproses | produksi | selesai | diambil | dikirim | dibatalkan
  notes              text DEFAULT '',
  status_history     jsonb NOT NULL DEFAULT '[]'::jsonb,
  cashier            text DEFAULT '',
  cashier_id         uuid REFERENCES public.admins(id) ON DELETE SET NULL,
  due_date           date,                       -- tanggal jatuh tempo (hutang/tempo)
  created_at         timestamptz DEFAULT now()
);

-- Migration for existing installs: add new columns if table already existed
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS order_no         text UNIQUE;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS customer_phone   text DEFAULT '';
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS customer_address text DEFAULT '';
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS order_status     text DEFAULT 'menunggu';
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS notes            text DEFAULT '';
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS status_history   jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS due_date         date;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS cashier_role     text DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_transactions_created_at   ON public.transactions (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_status       ON public.transactions (status);
CREATE INDEX IF NOT EXISTS idx_transactions_order_status ON public.transactions (order_status);
CREATE INDEX IF NOT EXISTS idx_transactions_customer     ON public.transactions (customer_id);
CREATE INDEX IF NOT EXISTS idx_transactions_order_no     ON public.transactions (order_no);

CREATE TABLE IF NOT EXISTS public.debts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id     uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  -- ON DELETE CASCADE: hapus invoice → piutang ikut hilang (no orphan)
  transaction_id  uuid REFERENCES public.transactions(id) ON DELETE CASCADE,
  invoice_no      text,
  total_debt      numeric NOT NULL DEFAULT 0,
  paid            numeric DEFAULT 0,
  remaining       numeric DEFAULT 0,
  due_date        date,
  status          text DEFAULT 'aktif',          -- aktif | lunas
  notes           text DEFAULT '',
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_debts_customer ON public.debts (customer_id);
CREATE INDEX IF NOT EXISTS idx_debts_status   ON public.debts (status);
CREATE INDEX IF NOT EXISTS idx_debts_due_date ON public.debts (due_date);

CREATE TABLE IF NOT EXISTS public.debt_payments (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  debt_id      uuid NOT NULL REFERENCES public.debts(id) ON DELETE CASCADE,
  amount       numeric NOT NULL,
  payment_method text DEFAULT 'cash',
  notes        text DEFAULT '',
  invoice_no   text,                              -- cross-link ke invoice/order
  paid_at      timestamptz DEFAULT now(),
  cashier      text DEFAULT '',
  cashier_id   uuid REFERENCES public.admins(id) ON DELETE SET NULL
);

ALTER TABLE public.debt_payments ADD COLUMN IF NOT EXISTS invoice_no text;

CREATE INDEX IF NOT EXISTS idx_debt_payments_debt        ON public.debt_payments (debt_id);
CREATE INDEX IF NOT EXISTS idx_debt_payments_invoice_no  ON public.debt_payments (invoice_no);
CREATE INDEX IF NOT EXISTS idx_debt_payments_paid_at     ON public.debt_payments (paid_at DESC);
CREATE INDEX IF NOT EXISTS idx_debts_transaction_id      ON public.debts (transaction_id);
CREATE INDEX IF NOT EXISTS idx_debts_invoice_no          ON public.debts (invoice_no);
CREATE INDEX IF NOT EXISTS idx_transactions_invoice_no   ON public.transactions (invoice_no);

-- ---------- TRIGGERS ----------

-- Auto-update updated_at on customers + debts + settings
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS customers_updated_at ON public.customers;
CREATE TRIGGER customers_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

DROP TRIGGER IF EXISTS debts_updated_at ON public.debts;
CREATE TRIGGER debts_updated_at
  BEFORE UPDATE ON public.debts
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

DROP TRIGGER IF EXISTS settings_updated_at ON public.settings;
CREATE TRIGGER settings_updated_at
  BEFORE UPDATE ON public.settings
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- NOTE: trigger tg_apply_debt_payment SENGAJA TIDAK DIBUAT.
-- Sebelumnya trigger ini menambah debts.paid + NEW.amount setelah client
-- sudah mengupdate debts.paid → pembayaran terpotong dobel.
-- Sekarang client `processDebtPayment` di useStore.js adalah satu-satunya
-- pemilik logika update (transactions + debts + customer_total_debt).
-- Pastikan trigger lama (kalau ada dari install sebelumnya) ikut dihapus:
DROP TRIGGER IF EXISTS debt_payments_apply ON public.debt_payments;
DROP FUNCTION IF EXISTS public.tg_apply_debt_payment();

-- After insert on transactions → bump customer stats
CREATE OR REPLACE FUNCTION public.tg_bump_customer_stats()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.customer_id IS NOT NULL THEN
    UPDATE public.customers
      SET total_transactions = total_transactions + 1,
          total_spent = total_spent + NEW.total,
          total_debt  = total_debt + NEW.remaining
      WHERE id = NEW.customer_id;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS transactions_bump_customer ON public.transactions;
CREATE TRIGGER transactions_bump_customer
  AFTER INSERT ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.tg_bump_customer_stats();

-- ---------- ROW LEVEL SECURITY ----------
-- Demo: anon (anon key) has full access. Tighten in production.

ALTER TABLE public.settings       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admins         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debts          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debt_payments  ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN CREATE POLICY "anon all settings"      ON public.settings      FOR ALL USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "anon all admins"        ON public.admins        FOR ALL USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "anon all customers"     ON public.customers     FOR ALL USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "anon all products"      ON public.products      FOR ALL USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "anon all transactions"  ON public.transactions  FOR ALL USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "anon all debts"         ON public.debts         FOR ALL USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "anon all debt_payments" ON public.debt_payments FOR ALL USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------- GRANTS (anon + authenticated) ----------
-- PENTING: RLS hanya mengatur baris. Role tetap butuh privilege tabel,
-- jika tidak akan muncul error: "permission denied for table ...".
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
-- Berlaku juga untuk tabel/sequence yang dibuat di masa depan:
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO anon, authenticated;

-- ---------- STORAGE: logos bucket ----------

INSERT INTO storage.buckets (id, name, public)
VALUES ('logos', 'logos', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('invoices', 'invoices', true)
ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN CREATE POLICY "Public read logos"      ON storage.objects FOR SELECT USING (bucket_id = 'logos'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Public upload logos"    ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'logos'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Public update logos"    ON storage.objects FOR UPDATE USING (bucket_id = 'logos'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Public delete logos"    ON storage.objects FOR DELETE USING (bucket_id = 'logos'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE POLICY "Public read invoices"   ON storage.objects FOR SELECT USING (bucket_id = 'invoices'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Public upload invoices" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'invoices'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Public update invoices" ON storage.objects FOR UPDATE USING (bucket_id = 'invoices'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Public delete invoices" ON storage.objects FOR DELETE USING (bucket_id = 'invoices'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------- REALTIME ----------
-- Add tables to the `supabase_realtime` publication only if they're not already members.
-- `ALTER PUBLICATION ... ADD TABLE` is NOT natively idempotent (raises duplicate_object),
-- so we check pg_publication_tables first.
DO $$
DECLARE
  tbl text;
  tables text[] := ARRAY['transactions','customers','debts','debt_payments','products','admins','settings'];
BEGIN
  -- Skip the whole block if the publication doesn't exist yet (non-Supabase Postgres)
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    RAISE NOTICE 'supabase_realtime publication tidak ditemukan — skip realtime setup';
    RETURN;
  END IF;

  FOREACH tbl IN ARRAY tables LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename  = tbl
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', tbl);
      RAISE NOTICE 'Added % to supabase_realtime', tbl;
    END IF;
  END LOOP;
END $$;

-- ---------- DEFAULT SEED ----------

INSERT INTO public.settings (id, name, tagline, address, phone, email, bank_name, bank_number, bank_holder, tax_rate)
VALUES (
  1,
  'Luby Naira',
  'Cetak Custom Produkmu Disini!!!',
  'Pasar Tanah Abang Blok B Lt.1 Los G No.160-161, Jakarta Pusat 10240',
  '081117001155',
  '',
  'Bank BCA',
  '2064447555',
  'Hardha Perdana',
  0
)
ON CONFLICT (id) DO UPDATE SET
  name        = EXCLUDED.name,
  tagline     = EXCLUDED.tagline,
  address     = EXCLUDED.address,
  phone       = EXCLUDED.phone,
  email       = EXCLUDED.email,
  bank_name   = EXCLUDED.bank_name,
  bank_number = EXCLUDED.bank_number,
  bank_holder = EXCLUDED.bank_holder;

INSERT INTO public.admins (username, password, name, role)
VALUES ('admin', 'admin', 'Admin Utama', 'owner')
ON CONFLICT (username) DO NOTHING;

INSERT INTO public.products (name, category, price, modal, stock, description, image)
SELECT * FROM (VALUES
  ('Jersey Sublimasi Full Print', 'jersey',      185000,  95000,  24, 'Jersey olahraga sublimasi full print.',          'https://images.unsplash.com/photo-1620188467120-5042ed1eb5da?w=600&q=80'),
  ('Jersey Bola Custom Logo',     'jersey',      210000, 110000,  18, 'Jersey bola custom dengan logo tim.',            'https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?w=600&q=80'),
  ('Sticker Vinyl Custom',        'sticker',      15000,   5000, 500, 'Sticker vinyl glossy/matte, ukuran custom.',     'https://images.unsplash.com/photo-1611162616305-c69b3fa7fbe0?w=600&q=80'),
  ('Print A4 Foto',               'printing',      5000,   1500, 999, 'Print A4 foto glossy/matte.',                    'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=600&q=80'),
  ('Topi Custom Logo',            'accessories',  85000,  35000,  40, 'Topi distro / trucker custom logo.',             'https://images.unsplash.com/photo-1521369909029-2afed882baee?w=600&q=80'),
  ('Kaos Polos Cotton Combed 30s','kaos',         75000,  38000,  60, 'Kaos polos cotton combed 30s.',                  'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=600&q=80'),
  ('Banner Spanduk 1x2m',         'banner',       90000,  45000,  40, 'Banner spanduk outdoor 1x2 m.',                  'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=600&q=80')
) AS v(name, category, price, modal, stock, description, image)
WHERE NOT EXISTS (SELECT 1 FROM public.products LIMIT 1);

-- ---------- SYNC LEGACY DATA ----------
-- Backfill: any transaction whose remaining is already 0 (e.g. cash/transfer/qris)
-- but status is still 'pending' should be marked 'lunas'.
-- Also sync transactions whose debt has already been fully paid.

UPDATE public.transactions
   SET status = 'lunas'
 WHERE COALESCE(remaining, 0) <= 0
   AND status IS DISTINCT FROM 'lunas';

UPDATE public.transactions t
   SET status = 'lunas', remaining = 0, paid = t.total, dp = t.total
  FROM public.debts d
 WHERE d.transaction_id = t.id
   AND d.status = 'lunas'
   AND t.status IS DISTINCT FROM 'lunas';

-- Also sync customer.total_debt to reflect actual sum of active debts
UPDATE public.customers c
   SET total_debt = COALESCE((
     SELECT SUM(d.remaining) FROM public.debts d
      WHERE d.customer_id = c.id AND d.status = 'aktif'
   ), 0);

-- ---------- DONE ----------

-- Refresh PostgREST schema cache so the REST API picks up new columns
-- (e.g. products.unit) without needing a manual API restart.
NOTIFY pgrst, 'reload schema';


-- ---------- CATEGORIES (kategori produk — bisa diisi manual via Pengaturan) ----------
CREATE TABLE IF NOT EXISTS public.categories (
  id          text PRIMARY KEY,
  label       text NOT NULL,
  icon        text DEFAULT '📦',
  sort_order  integer DEFAULT 0,
  created_at  timestamptz DEFAULT now()
);
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "anon all categories" ON public.categories FOR ALL USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO anon, authenticated;

-- Seed default (boleh dihapus/ubah dari aplikasi)
INSERT INTO public.categories (id, label, icon, sort_order) VALUES
  ('jersey','Jersey','👕',1),
  ('kaos','Kaos','👚',2),
  ('banner','Banner','🚩',3),
  ('sticker','Sticker','✨',4),
  ('printing','Printing','🖨️',5),
  ('accessories','Accessories','🎒',6),
  ('other','Other','📦',7)
ON CONFLICT (id) DO NOTHING;

-- Realtime
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname='supabase_realtime')
     AND NOT EXISTS (
       SELECT 1 FROM pg_publication_tables
       WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='categories')
  THEN EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.categories';
  END IF;
END $$;


-- ================================================================
-- >>> BAGIAN: [1] 2026_06_add_due_date_to_transactions.sql
-- ================================================================
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


-- ================================================================
-- >>> BAGIAN: [2] 2026_06_add_unit_to_products.sql
-- ================================================================
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


-- ================================================================
-- >>> BAGIAN: [3] 2026_06_role_admin_dashboard.sql
-- ================================================================
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


-- ================================================================
-- >>> BAGIAN: [4] 2026_06_debt_mirror_transactions.sql
-- ================================================================
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


-- ================================================================
-- >>> BAGIAN: [5] 2026_06_drop_double_payment_trigger.sql
-- ================================================================
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


-- ================================================================
-- >>> BAGIAN: [6] 2026_06_realtime_sync_invoice_format.sql
-- ================================================================
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


-- ================================================================
-- >>> BAGIAN: [7] 2026_06_perf_indexes_and_cleanup.sql
-- ================================================================
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


-- ================================================================
-- >>> BAGIAN: [8] 2026_06_timeout_indexes.sql
-- ================================================================
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


-- ================================================================
-- >>> BAGIAN: [9] 2026_06_sync_order_piutang_data_fix.sql
-- ================================================================
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


-- ================================================================
-- >>> BAGIAN: [10] PENEGASAN AKSES & CONSTRAINT
-- ================================================================
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO anon, authenticated;

ALTER TABLE public.admins DROP CONSTRAINT IF EXISTS admins_role_check;
ALTER TABLE public.admins ADD CONSTRAINT admins_role_check
  CHECK (role IN ('owner', 'admin', 'cashier', 'staff'));

ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "settings read anon+auth"  ON public.settings
    FOR SELECT TO anon, authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "settings write anon+auth" ON public.settings
    FOR ALL    TO anon, authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

INSERT INTO public.settings (id, name, tagline)
VALUES (1, 'Luby Naira', 'Cetak Custom Produkmu Disini!!!')
ON CONFLICT (id) DO NOTHING;
-- ================================================================
