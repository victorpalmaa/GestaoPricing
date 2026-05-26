begin;

alter table public.simulation_catalog_prices
  add column if not exists simulation_id text;

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
