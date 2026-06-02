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

