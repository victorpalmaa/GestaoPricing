begin;

create extension if not exists pgcrypto;

create table if not exists public.simulation_catalog_prices (
  id uuid primary key default gen_random_uuid(),
  sku text not null,
  category text,
  volume integer not null,
  catalog_cost numeric default 0,
  catalog_price numeric default 0,
  catalog_gross_price numeric default 0,
  catalog_margin numeric default 0,
  simulation_id text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  unique (sku, volume)
);

alter table public.simulation_catalog_prices
  add column if not exists sku text,
  add column if not exists category text,
  add column if not exists volume integer,
  add column if not exists catalog_cost numeric default 0,
  add column if not exists catalog_price numeric default 0,
  add column if not exists catalog_gross_price numeric default 0,
  add column if not exists catalog_margin numeric default 0,
  add column if not exists simulation_id text,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'simulation_catalog_prices'
      and column_name = 'datasul_code'
  ) then
    execute 'alter table public.simulation_catalog_prices alter column datasul_code drop not null';
  end if;
end $$;

alter table public.simulation_catalog_prices
  alter column sku set not null,
  alter column volume set not null;

alter table public.simulation_catalog_prices
  drop constraint if exists simulation_catalog_prices_datasul_code_volume_key;

alter table public.simulation_catalog_prices
  drop constraint if exists simulation_catalog_prices_sku_volume_key;

alter table public.simulation_catalog_prices
  add constraint simulation_catalog_prices_sku_volume_key
  unique (sku, volume);

alter table public.simulation_catalog_prices
  drop constraint if exists simulation_catalog_prices_volume_check;

alter table public.simulation_catalog_prices
  add constraint simulation_catalog_prices_volume_check
  check (volume in (1000, 3000, 5000));

alter table public.simulation_catalog_prices
  drop constraint if exists simulation_catalog_prices_category_check;

alter table public.simulation_catalog_prices
  add constraint simulation_catalog_prices_category_check
  check (category is null or category in ('Pó', 'Gel', 'Goma', 'Softgel'));

drop index if exists public.uq_simulation_catalog_prices_datasul_volume;

create unique index if not exists uq_simulation_catalog_prices_sku_volume
  on public.simulation_catalog_prices (sku, volume);

create index if not exists idx_simulation_catalog_prices_lower_sku
  on public.simulation_catalog_prices (lower(sku));

create index if not exists idx_simulation_catalog_prices_lower_category
  on public.simulation_catalog_prices (lower(category));

create or replace function public.update_simulation_catalog_prices_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_update_simulation_catalog_prices_updated_at on public.simulation_catalog_prices;
create trigger trg_update_simulation_catalog_prices_updated_at
before update on public.simulation_catalog_prices
for each row
execute function public.update_simulation_catalog_prices_updated_at();

alter table public.simulation_catalog_prices enable row level security;

grant select, insert, update, delete on table public.simulation_catalog_prices to authenticated;

drop policy if exists "simulation catalog select auth" on public.simulation_catalog_prices;
drop policy if exists "simulation catalog insert auth" on public.simulation_catalog_prices;
drop policy if exists "simulation catalog update auth" on public.simulation_catalog_prices;
drop policy if exists "Simulation catalog: read authenticated" on public.simulation_catalog_prices;
drop policy if exists "Simulation catalog: insert pricing only" on public.simulation_catalog_prices;
drop policy if exists "Simulation catalog: update pricing only" on public.simulation_catalog_prices;
drop policy if exists "Simulation catalog: delete pricing only" on public.simulation_catalog_prices;

create policy "Simulation catalog: read authenticated"
  on public.simulation_catalog_prices
  for select
  to authenticated
  using (auth.role() = 'authenticated');

create policy "Simulation catalog: insert pricing only"
  on public.simulation_catalog_prices
  for insert
  to authenticated
  with check (
    coalesce(auth.jwt() -> 'user_metadata' ->> 'area', '') = 'Pricing'
  );

create policy "Simulation catalog: update pricing only"
  on public.simulation_catalog_prices
  for update
  to authenticated
  using (
    coalesce(auth.jwt() -> 'user_metadata' ->> 'area', '') = 'Pricing'
  )
  with check (
    coalesce(auth.jwt() -> 'user_metadata' ->> 'area', '') = 'Pricing'
  );

create policy "Simulation catalog: delete pricing only"
  on public.simulation_catalog_prices
  for delete
  to authenticated
  using (
    coalesce(auth.jwt() -> 'user_metadata' ->> 'area', '') = 'Pricing'
  );

create table if not exists public.simulations_history (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  user_id uuid references auth.users(id) on delete cascade,
  sku text,
  product_name text,
  price numeric,
  cost numeric,
  margin numeric,
  mode text
);

alter table public.simulations_history
  add column if not exists pis numeric,
  add column if not exists cofins numeric,
  add column if not exists icms numeric,
  add column if not exists gross_price numeric,
  add column if not exists user_email text,
  add column if not exists user_name text,
  add column if not exists version text,
  add column if not exists simulation_number bigint generated by default as identity,
  add column if not exists datasul_code text,
  add column if not exists volume integer,
  add column if not exists client_name text,
  add column if not exists target text,
  add column if not exists observations text,
  add column if not exists catalog_cost numeric,
  add column if not exists catalog_price numeric,
  add column if not exists catalog_gross_price numeric,
  add column if not exists catalog_margin numeric,
  add column if not exists approval_status text,
  add column if not exists approved_at timestamptz,
  add column if not exists approved_by_id uuid references auth.users(id),
  add column if not exists approved_by_name text;

create unique index if not exists idx_simulations_history_simulation_number
  on public.simulations_history (simulation_number);

alter table public.simulations_history
  drop constraint if exists simulations_history_volume_check;

alter table public.simulations_history
  add constraint simulations_history_volume_check
  check (volume is null or volume in (1000, 3000, 5000));

alter table public.simulations_history enable row level security;

grant select, insert, update, delete on table public.simulations_history to authenticated;

drop policy if exists "Users can insert their own simulations" on public.simulations_history;
drop policy if exists "Users can view simulations" on public.simulations_history;
drop policy if exists "Users can delete simulations" on public.simulations_history;
drop policy if exists "Simulations: insert own" on public.simulations_history;
drop policy if exists "Simulations: read authenticated" on public.simulations_history;
drop policy if exists "Simulations: update owner or pricing" on public.simulations_history;
drop policy if exists "Simulations: delete owner or pricing" on public.simulations_history;

create policy "Simulations: insert own"
  on public.simulations_history
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Simulations: read authenticated"
  on public.simulations_history
  for select
  to authenticated
  using (auth.role() = 'authenticated');

create policy "Simulations: update owner or pricing"
  on public.simulations_history
  for update
  to authenticated
  using (
    auth.uid() = user_id
    or coalesce(auth.jwt() -> 'user_metadata' ->> 'area', '') = 'Pricing'
  )
  with check (
    auth.uid() = user_id
    or coalesce(auth.jwt() -> 'user_metadata' ->> 'area', '') = 'Pricing'
  );

create policy "Simulations: delete owner or pricing"
  on public.simulations_history
  for delete
  to authenticated
  using (
    auth.uid() = user_id
    or coalesce(auth.jwt() -> 'user_metadata' ->> 'area', '') = 'Pricing'
  );

commit;
