create table if not exists public.users (
  id uuid primary key,
  nome text not null,
  sobrenome text not null,
  email text not null unique,
  area text not null,
  password_hash text not null
);

create table if not exists public.prices (
  id uuid primary key,
  cliente text not null,
  sku text not null,
  precoLiquido double precision not null,
  precoBruto double precision not null,
  margemBruta double precision not null,
  volume integer not null,
  createdAt timestamptz not null,
  status text not null default 'em_aberto'
);

create index if not exists prices_created_at_idx on public.prices (createdAt desc);

alter table if exists public.users enable row level security;
alter table if exists public.prices enable row level security;

alter table if exists public.prices add column if not exists pricingid text;

create table if not exists public.password_resets (
  email text not null,
  token_hash text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists password_resets_email_idx on public.password_resets (email);
create index if not exists password_resets_expires_idx on public.password_resets (expires_at);

alter table if exists public.password_resets enable row level security;

drop policy if exists dev_allow_all_select_password_resets on public.password_resets;
drop policy if exists dev_allow_all_insert_password_resets on public.password_resets;
drop policy if exists dev_allow_all_update_password_resets on public.password_resets;
drop policy if exists dev_allow_all_delete_password_resets on public.password_resets;
create policy dev_allow_all_select_password_resets on public.password_resets for select to authenticated, anon using (true);
create policy dev_allow_all_insert_password_resets on public.password_resets for insert to authenticated, anon with check (true);
create policy dev_allow_all_update_password_resets on public.password_resets for update to authenticated, anon using (true) with check (true);
create policy dev_allow_all_delete_password_resets on public.password_resets for delete to authenticated, anon using (true);

drop policy if exists dev_allow_all_select_users on public.users;
drop policy if exists dev_allow_all_insert_users on public.users;
create policy dev_allow_all_select_users on public.users for select to authenticated, anon using (true);
create policy dev_allow_all_insert_users on public.users for insert to authenticated, anon with check (true);

drop policy if exists dev_allow_all_select_prices on public.prices;
drop policy if exists dev_allow_all_insert_prices on public.prices;
drop policy if exists dev_allow_all_update_prices on public.prices;
drop policy if exists dev_allow_all_delete_prices on public.prices;
create policy dev_allow_all_select_prices on public.prices for select to authenticated, anon using (true);
create policy dev_allow_all_insert_prices on public.prices for insert to authenticated, anon with check (true);
create policy dev_allow_all_update_prices on public.prices for update to authenticated, anon using (true) with check (true);
create policy dev_allow_all_delete_prices on public.prices for delete to authenticated, anon using (true);