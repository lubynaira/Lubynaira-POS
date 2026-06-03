create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  full_name text,
  role text not null default 'owner' check (role in ('owner', 'staff'))
);

create table if not exists public.brand_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  brand_name text not null default 'Skupy Fashion',
  logo_url text,
  theme_color text not null default '#0f8b6f',
  unique (user_id)
);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  customer_name text not null,
  brand_name text not null default '',
  whatsapp text not null default '',
  phone text not null default '',
  address text not null default '',
  notes text not null default '',
  logo_url text
);

create table if not exists public.brands (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  brand_name text not null,
  logo_url text,
  owner text not null default ''
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  brand_id uuid references public.brands(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  brand_name text not null,
  product_name text not null,
  product_code text not null,
  customer_name text,
  collection_name text,
  product_color text,
  production_date date not null,
  logo_url text,
  photo_url text,
  fabric_qty numeric(12, 3) not null default 0,
  fabric_unit text not null default 'meter' check (fabric_unit in ('meter', 'yard')),
  fabric_price numeric(14, 2) not null default 0,
  fabric_printing_enabled boolean not null default false,
  fabric_printing_price numeric(14, 2) not null default 0,
  additional_materials jsonb not null default '[]'::jsonb,
  printing_cost numeric(14, 2) not null default 0,
  sewing_cost numeric(14, 2) not null default 0,
  accessory_cost numeric(14, 2) not null default 0,
  label_cost numeric(14, 2) not null default 0,
  shipping_cost numeric(14, 2) not null default 0,
  other_cost numeric(14, 2) not null default 0,
  total_hpp numeric(14, 2) not null default 0,
  margin numeric(8, 2) not null default 0,
  selling_price numeric(14, 2) not null default 0,
  profit numeric(14, 2) not null default 0
);

alter table public.products
add column if not exists customer_name text;

alter table public.products
add column if not exists additional_materials jsonb not null default '[]'::jsonb;

alter table public.customers
add column if not exists phone text not null default '';

alter table public.customers
add column if not exists brand_name text not null default '';

alter table public.customers
add column if not exists whatsapp text not null default '';

alter table public.products
add column if not exists brand_id uuid references public.brands(id) on delete set null;

alter table public.products
add column if not exists customer_id uuid references public.customers(id) on delete set null;

alter table public.products
add column if not exists fabric_printing_enabled boolean not null default false;

alter table public.products
add column if not exists fabric_printing_price numeric(14, 2) not null default 0;

create index if not exists products_user_created_idx on public.products(user_id, created_at desc);
create index if not exists customers_user_created_idx on public.customers(user_id, created_at desc);
create index if not exists brands_user_created_idx on public.brands(user_id, created_at desc);
drop index if exists products_search_idx;
create index if not exists products_search_idx on public.products using gin (
  to_tsvector('simple', coalesce(product_name, '') || ' ' || coalesce(product_code, '') || ' ' || coalesce(customer_name, '') || ' ' || coalesce(brand_name, ''))
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at
before update on public.products
for each row execute function public.set_updated_at();

drop trigger if exists brand_settings_set_updated_at on public.brand_settings;
create trigger brand_settings_set_updated_at
before update on public.brand_settings
for each row execute function public.set_updated_at();

drop trigger if exists customers_set_updated_at on public.customers;
create trigger customers_set_updated_at
before update on public.customers
for each row execute function public.set_updated_at();

drop trigger if exists brands_set_updated_at on public.brands;
create trigger brands_set_updated_at
before update on public.brands
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.raw_user_meta_data ->> 'role', 'owner')
  );

  insert into public.brand_settings (user_id, brand_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'brand_name', 'Skupy Fashion'));

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.brand_settings enable row level security;
alter table public.customers enable row level security;
alter table public.brands enable row level security;
alter table public.products enable row level security;

drop policy if exists "Profiles can read own profile" on public.profiles;
create policy "Profiles can read own profile"
on public.profiles for select
using (auth.uid() = id);

drop policy if exists "Profiles can update own profile" on public.profiles;
create policy "Profiles can update own profile"
on public.profiles for update
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "Users can read own brand settings" on public.brand_settings;
create policy "Users can read own brand settings"
on public.brand_settings for select
using (auth.uid() = user_id);

drop policy if exists "Owners can manage own brand settings" on public.brand_settings;
create policy "Owners can manage own brand settings"
on public.brand_settings for all
using (
  auth.uid() = user_id
  and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'owner')
)
with check (
  auth.uid() = user_id
  and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'owner')
);

drop policy if exists "Users can read own products" on public.products;
drop policy if exists "Users can read own customers" on public.customers;
create policy "Users can read own customers"
on public.customers for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert own customers" on public.customers;
create policy "Users can insert own customers"
on public.customers for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update own customers" on public.customers;
create policy "Users can update own customers"
on public.customers for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Owners can delete own customers" on public.customers;
create policy "Owners can delete own customers"
on public.customers for delete
using (
  auth.uid() = user_id
  and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'owner')
);

drop policy if exists "Users can read own brands" on public.brands;
create policy "Users can read own brands"
on public.brands for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert own brands" on public.brands;
create policy "Users can insert own brands"
on public.brands for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update own brands" on public.brands;
create policy "Users can update own brands"
on public.brands for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Owners can delete own brands" on public.brands;
create policy "Owners can delete own brands"
on public.brands for delete
using (
  auth.uid() = user_id
  and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'owner')
);

drop policy if exists "Users can read own products" on public.products;
create policy "Users can read own products"
on public.products for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert own products" on public.products;
create policy "Users can insert own products"
on public.products for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update own products" on public.products;
create policy "Users can update own products"
on public.products for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Owners can delete own products" on public.products;
create policy "Owners can delete own products"
on public.products for delete
using (
  auth.uid() = user_id
  and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'owner')
);

insert into storage.buckets (id, name, public)
values
  ('brand-assets', 'brand-assets', true),
  ('product-photos', 'product-photos', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "Authenticated users can upload brand assets" on storage.objects;
create policy "Authenticated users can upload brand assets"
on storage.objects for insert
to authenticated
with check (bucket_id = 'brand-assets');

drop policy if exists "Authenticated users can upload product photos" on storage.objects;
create policy "Authenticated users can upload product photos"
on storage.objects for insert
to authenticated
with check (bucket_id = 'product-photos');

drop policy if exists "Public can read uploaded assets" on storage.objects;
create policy "Public can read uploaded assets"
on storage.objects for select
using (bucket_id in ('brand-assets', 'product-photos'));

drop policy if exists "Users can update uploaded assets" on storage.objects;
create policy "Users can update uploaded assets"
on storage.objects for update
to authenticated
using (bucket_id in ('brand-assets', 'product-photos'))
with check (bucket_id in ('brand-assets', 'product-photos'));

drop policy if exists "Owners can delete uploaded assets" on storage.objects;
create policy "Owners can delete uploaded assets"
on storage.objects for delete
to authenticated
using (
  bucket_id in ('brand-assets', 'product-photos')
  and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'owner')
);
