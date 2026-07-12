begin;

create extension if not exists pgcrypto;

create table if not exists public.catalog_latam_prices (
  id uuid primary key default gen_random_uuid(),
  catalog_id text,
  sku text not null,
  category text,
  volume integer not null,
  catalog_cost numeric default 0,
  catalog_margin numeric default 0,
  price_brl numeric default 0,
  price_usd numeric default 0,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

alter table public.catalog_latam_prices
  add column if not exists catalog_id text,
  add column if not exists sku text,
  add column if not exists category text,
  add column if not exists volume integer,
  add column if not exists catalog_cost numeric default 0,
  add column if not exists catalog_margin numeric default 0,
  add column if not exists price_brl numeric default 0,
  add column if not exists price_usd numeric default 0,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

alter table public.catalog_latam_prices
  alter column sku set not null,
  alter column volume set not null;

alter table public.catalog_latam_prices
  drop constraint if exists catalog_latam_prices_sku_volume_key;

alter table public.catalog_latam_prices
  add constraint catalog_latam_prices_sku_volume_key
  unique (sku, volume);

drop index if exists public.uq_catalog_latam_prices_sku_volume;

create unique index if not exists uq_catalog_latam_prices_sku_volume
  on public.catalog_latam_prices (sku, volume);

alter table public.catalog_latam_prices
  drop constraint if exists catalog_latam_prices_volume_check;

alter table public.catalog_latam_prices
  add constraint catalog_latam_prices_volume_check
  check (volume in (1000, 1500, 3000, 5000));

create index if not exists idx_catalog_latam_prices_lower_sku
  on public.catalog_latam_prices (lower(sku));

create index if not exists idx_catalog_latam_prices_lower_category
  on public.catalog_latam_prices (lower(category));

create or replace function public.update_catalog_latam_prices_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_update_catalog_latam_prices_updated_at on public.catalog_latam_prices;
create trigger trg_update_catalog_latam_prices_updated_at
before update on public.catalog_latam_prices
for each row
execute function public.update_catalog_latam_prices_updated_at();

alter table public.catalog_latam_prices enable row level security;

grant select, insert, update, delete on table public.catalog_latam_prices to authenticated;

drop policy if exists "Catalog Latam: read authenticated" on public.catalog_latam_prices;
drop policy if exists "Catalog Latam: insert pricing only" on public.catalog_latam_prices;
drop policy if exists "Catalog Latam: update pricing only" on public.catalog_latam_prices;
drop policy if exists "Catalog Latam: delete pricing only" on public.catalog_latam_prices;

create policy "Catalog Latam: read authenticated"
  on public.catalog_latam_prices
  for select
  to authenticated
  using (auth.role() = 'authenticated');

create policy "Catalog Latam: insert pricing only"
  on public.catalog_latam_prices
  for insert
  to authenticated
  with check (
    coalesce(auth.jwt() -> 'user_metadata' ->> 'area', '') = 'Pricing'
  );

create policy "Catalog Latam: update pricing only"
  on public.catalog_latam_prices
  for update
  to authenticated
  using (
    coalesce(auth.jwt() -> 'user_metadata' ->> 'area', '') = 'Pricing'
  )
  with check (
    coalesce(auth.jwt() -> 'user_metadata' ->> 'area', '') = 'Pricing'
  );

create policy "Catalog Latam: delete pricing only"
  on public.catalog_latam_prices
  for delete
  to authenticated
  using (
    coalesce(auth.jwt() -> 'user_metadata' ->> 'area', '') = 'Pricing'
  );

comment on column public.catalog_latam_prices.catalog_id is 'ID do catálogo Latam exibido para Pricing';
comment on column public.catalog_latam_prices.price_brl is 'Preço em R$ exibido no catálogo Latam';
comment on column public.catalog_latam_prices.price_usd is 'Preço em $ exibido no catálogo Latam';

commit;
