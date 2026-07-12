begin;

create extension if not exists pgcrypto;

create table if not exists public.simulation_minimum_price_rules (
  id uuid primary key default gen_random_uuid(),
  versao text not null,
  volume integer not null,
  margem numeric,
  precobruto numeric
);

alter table public.simulation_minimum_price_rules
  add column if not exists versao text,
  add column if not exists volume integer,
  add column if not exists margem numeric,
  add column if not exists precobruto numeric;

alter table public.simulation_minimum_price_rules
  alter column versao set not null,
  alter column volume set not null;

alter table public.simulation_minimum_price_rules
  drop constraint if exists simulation_minimum_price_rules_sku_volume_key;

alter table public.simulation_minimum_price_rules
  drop constraint if exists simulation_minimum_price_rules_versao_key;

alter table public.simulation_minimum_price_rules
  drop constraint if exists simulation_minimum_price_rules_versao_volume_key;

alter table public.simulation_minimum_price_rules
  add constraint simulation_minimum_price_rules_versao_volume_key
  unique (versao, volume);

drop index if exists public.uq_simulation_minimum_price_rules_sku_volume;
drop index if exists public.uq_simulation_minimum_price_rules_versao;
drop index if exists public.uq_simulation_minimum_price_rules_versao_volume;

create unique index if not exists uq_simulation_minimum_price_rules_versao_volume
  on public.simulation_minimum_price_rules (lower(versao), volume);

alter table public.simulation_minimum_price_rules
  drop constraint if exists simulation_minimum_price_rules_volume_check;

alter table public.simulation_minimum_price_rules
  add constraint simulation_minimum_price_rules_volume_check
  check (volume in (1000, 1500, 3000, 5000));

alter table public.simulation_minimum_price_rules
  drop constraint if exists simulation_minimum_price_rules_threshold_check;

alter table public.simulation_minimum_price_rules
  add constraint simulation_minimum_price_rules_threshold_check
  check (
    coalesce(precobruto, 0) > 0
    or coalesce(margem, 0) > 0
  );

alter table public.simulation_minimum_price_rules enable row level security;

grant select, insert, update, delete on table public.simulation_minimum_price_rules to authenticated;

drop policy if exists "Simulation minimum rules: read authenticated" on public.simulation_minimum_price_rules;
drop policy if exists "Simulation minimum rules: insert pricing only" on public.simulation_minimum_price_rules;
drop policy if exists "Simulation minimum rules: update pricing only" on public.simulation_minimum_price_rules;
drop policy if exists "Simulation minimum rules: delete pricing only" on public.simulation_minimum_price_rules;

create policy "Simulation minimum rules: read authenticated"
  on public.simulation_minimum_price_rules
  for select
  to authenticated
  using (auth.role() = 'authenticated');

create policy "Simulation minimum rules: insert pricing only"
  on public.simulation_minimum_price_rules
  for insert
  to authenticated
  with check (
    coalesce(auth.jwt() -> 'user_metadata' ->> 'area', '') = 'Pricing'
  );

create policy "Simulation minimum rules: update pricing only"
  on public.simulation_minimum_price_rules
  for update
  to authenticated
  using (
    coalesce(auth.jwt() -> 'user_metadata' ->> 'area', '') = 'Pricing'
  )
  with check (
    coalesce(auth.jwt() -> 'user_metadata' ->> 'area', '') = 'Pricing'
  );

create policy "Simulation minimum rules: delete pricing only"
  on public.simulation_minimum_price_rules
  for delete
  to authenticated
  using (
    coalesce(auth.jwt() -> 'user_metadata' ->> 'area', '') = 'Pricing'
  );

alter table public.simulations_history
  add column if not exists minimum_rule_id uuid references public.simulation_minimum_price_rules(id),
  add column if not exists minimum_gross_price numeric,
  add column if not exists minimum_margin numeric,
  add column if not exists is_within_minimum_policy boolean not null default true,
  add column if not exists minimum_policy_status text,
  add column if not exists minimum_policy_message text;

alter table public.simulations_history
  drop constraint if exists simulations_history_minimum_policy_status_check;

alter table public.simulations_history
  add constraint simulations_history_minimum_policy_status_check
  check (
    minimum_policy_status is null
    or minimum_policy_status in (
      'not_configured',
      'within_policy',
      'below_minimum_price',
      'below_minimum_margin',
      'below_minimum_price_and_margin'
    )
  );

create index if not exists idx_simulations_history_minimum_rule_id
  on public.simulations_history (minimum_rule_id);

commit;
