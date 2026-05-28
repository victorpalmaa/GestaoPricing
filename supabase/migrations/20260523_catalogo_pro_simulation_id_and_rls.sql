begin;

alter table public.simulation_catalog_prices
  add column if not exists simulation_id text;

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
  drop constraint if exists simulation_catalog_prices_datasul_code_volume_key;

alter table public.simulation_catalog_prices
  drop constraint if exists simulation_catalog_prices_sku_volume_key;

alter table public.simulation_catalog_prices
  add constraint simulation_catalog_prices_sku_volume_key
  unique (sku, volume);

drop index if exists public.uq_simulation_catalog_prices_datasul_volume;

create unique index if not exists uq_simulation_catalog_prices_sku_volume
  on public.simulation_catalog_prices (sku, volume);

alter table public.simulation_catalog_prices
  drop constraint if exists simulation_catalog_prices_volume_check;

alter table public.simulation_catalog_prices
  add constraint simulation_catalog_prices_volume_check
  check (volume in (1000, 1500, 3000, 5000));

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

create index if not exists idx_simulation_catalog_prices_lower_sku
  on public.simulation_catalog_prices (lower(sku));

commit;
