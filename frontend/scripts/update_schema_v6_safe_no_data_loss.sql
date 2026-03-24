begin;

create schema if not exists backup;

do $$
begin
  if to_regclass('public.pricing_history') is not null and to_regclass('backup.pricing_history_20260317') is null then
    execute 'create table backup.pricing_history_20260317 as table public.pricing_history';
  end if;

  if to_regclass('public.clients') is not null and to_regclass('backup.clients_20260317') is null then
    execute 'create table backup.clients_20260317 as table public.clients';
  end if;

  if to_regclass('public.prices') is not null and to_regclass('backup.prices_20260317') is null then
    execute 'create table backup.prices_20260317 as table public.prices';
  end if;

  if to_regclass('public.users') is not null and to_regclass('backup.users_20260317') is null then
    execute 'create table backup.users_20260317 as table public.users';
  end if;
end
$$;

alter table public.pricing_history add column if not exists net_price numeric;
alter table public.pricing_history add column if not exists gross_price numeric;
alter table public.pricing_history add column if not exists margin_budget numeric;
alter table public.pricing_history add column if not exists size text;
alter table public.pricing_history add column if not exists manager text;
alter table public.pricing_history add column if not exists code text;
alter table public.pricing_history add column if not exists category text;
alter table public.pricing_history add column if not exists subcategory text;
alter table public.pricing_history add column if not exists month text;
alter table public.pricing_history add column if not exists obs text;
alter table public.pricing_history add column if not exists currency text default 'BRL';
alter table public.pricing_history add column if not exists readjustment_status text default 'Em Análise';
alter table public.pricing_history add column if not exists last_price_date timestamptz;
alter table public.pricing_history add column if not exists volume numeric default 0;
alter table public.pricing_history add column if not exists communication_status text default 'pending';
alter table public.pricing_history add column if not exists gate smallint default 1;
alter table public.pricing_history add column if not exists is_current boolean default false;
alter table public.pricing_history add column if not exists updated_at timestamptz default now();

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'pricing_history'
      and column_name = 'price'
  ) then
    execute 'update public.pricing_history set net_price = coalesce(net_price, price) where net_price is null';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'pricing_history'
      and column_name = 'margin'
  ) then
    execute 'update public.pricing_history set margin_budget = coalesce(margin_budget, margin) where margin_budget is null';
  end if;
end
$$;

update public.pricing_history
set currency = 'BRL'
where currency is null
   or btrim(currency) = '';

update public.pricing_history
set readjustment_status = 'Em Análise'
where readjustment_status is null
   or btrim(readjustment_status) = '';

update public.pricing_history
set communication_status = 'pending'
where communication_status is null
   or btrim(communication_status) = '';

update public.pricing_history
set updated_at = coalesce(updated_at, created_at, now())
where updated_at is null;

with ranked as (
  select
    id,
    row_number() over (
      partition by client_id, sku
      order by
        date desc nulls last,
        updated_at desc nulls last,
        created_at desc nulls last,
        id desc
    ) as rn
  from public.pricing_history
  where client_id is not null
    and sku is not null
)
update public.pricing_history ph
set is_current = (ranked.rn = 1)
from ranked
where ph.id = ranked.id;

create index if not exists idx_pricing_history_client_sku_date
  on public.pricing_history (client_id, sku, date desc);

create index if not exists idx_pricing_history_current_lookup
  on public.pricing_history (client_id, sku)
  where is_current is true;

do $$
begin
  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and indexname = 'uq_pricing_history_current_per_client_sku'
  ) then
    if not exists (
      select 1
      from (
        select client_id, sku, count(*) as qtd
        from public.pricing_history
        where is_current is true
          and client_id is not null
          and sku is not null
        group by client_id, sku
        having count(*) > 1
      ) t
    ) then
      execute 'create unique index uq_pricing_history_current_per_client_sku on public.pricing_history (client_id, sku) where is_current is true';
    end if;
  end if;
end
$$;

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text,
  sobrenome text,
  email text,
  area text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

alter table public.users add column if not exists nome text;
alter table public.users add column if not exists sobrenome text;
alter table public.users add column if not exists email text;
alter table public.users add column if not exists area text;
alter table public.users add column if not exists created_at timestamptz default now();
alter table public.users add column if not exists updated_at timestamptz default now();

update public.users u
set
  nome = coalesce(
    nullif(btrim(u.nome), ''),
    nullif(btrim(au.raw_user_meta_data ->> 'nome'), ''),
    nullif(btrim(au.raw_user_meta_data ->> 'full_name'), ''),
    split_part(au.email, '@', 1)
  ),
  sobrenome = coalesce(
    nullif(btrim(u.sobrenome), ''),
    nullif(btrim(au.raw_user_meta_data ->> 'sobrenome'), ''),
    nullif(btrim(au.raw_user_meta_data ->> 'last_name'), ''),
    'N/A'
  ),
  email = coalesce(u.email, au.email),
  area = coalesce(u.area, au.raw_user_meta_data ->> 'area'),
  updated_at = now()
from auth.users au
where u.id = au.id;

do $$
declare
  has_blocking_required_columns boolean;
begin
  select exists (
    select 1
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = 'users'
      and c.is_nullable = 'NO'
      and c.column_default is null
      and c.column_name not in ('id', 'nome', 'sobrenome', 'email', 'area', 'created_at', 'updated_at')
  )
  into has_blocking_required_columns;

  if not has_blocking_required_columns then
    insert into public.users (id, nome, sobrenome, email, area, created_at, updated_at)
    select
      au.id,
      coalesce(
        nullif(btrim(au.raw_user_meta_data ->> 'nome'), ''),
        nullif(btrim(au.raw_user_meta_data ->> 'full_name'), ''),
        split_part(au.email, '@', 1)
      ) as nome,
      coalesce(
        nullif(btrim(au.raw_user_meta_data ->> 'sobrenome'), ''),
        nullif(btrim(au.raw_user_meta_data ->> 'last_name'), ''),
        'N/A'
      ) as sobrenome,
      au.email,
      au.raw_user_meta_data ->> 'area' as area,
      coalesce(au.created_at, now()) as created_at,
      now() as updated_at
    from auth.users au
    where not exists (
      select 1
      from public.users u
      where u.id = au.id
    );
  end if;
end
$$;

create or replace function public.sync_public_users_from_auth()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  begin
    insert into public.users (id, nome, sobrenome, email, area, created_at, updated_at)
    values (
      new.id,
      coalesce(
        nullif(btrim(new.raw_user_meta_data ->> 'nome'), ''),
        nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
        split_part(new.email, '@', 1)
      ),
      coalesce(
        nullif(btrim(new.raw_user_meta_data ->> 'sobrenome'), ''),
        nullif(btrim(new.raw_user_meta_data ->> 'last_name'), ''),
        'N/A'
      ),
      new.email,
      new.raw_user_meta_data ->> 'area',
      coalesce(new.created_at, now()),
      now()
    )
    on conflict (id) do update
    set
      nome = coalesce(nullif(btrim(public.users.nome), ''), excluded.nome),
      sobrenome = coalesce(nullif(btrim(public.users.sobrenome), ''), excluded.sobrenome),
      email = coalesce(public.users.email, excluded.email),
      area = coalesce(public.users.area, excluded.area),
      updated_at = now();
  exception
    when not_null_violation then
      update public.users u
      set
        nome = coalesce(
          nullif(btrim(u.nome), ''),
          nullif(btrim(new.raw_user_meta_data ->> 'nome'), ''),
          nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
          split_part(new.email, '@', 1)
        ),
        sobrenome = coalesce(
          nullif(btrim(u.sobrenome), ''),
          nullif(btrim(new.raw_user_meta_data ->> 'sobrenome'), ''),
          nullif(btrim(new.raw_user_meta_data ->> 'last_name'), ''),
          'N/A'
        ),
        email = coalesce(u.email, new.email),
        area = coalesce(u.area, new.raw_user_meta_data ->> 'area'),
        updated_at = now()
      where u.id = new.id;
  end;

  return new;
end;
$$;

do $$
begin
  begin
    execute 'drop trigger if exists trg_sync_public_users_from_auth on auth.users';
    execute 'create trigger trg_sync_public_users_from_auth after insert or update on auth.users for each row execute function public.sync_public_users_from_auth()';
  exception
    when insufficient_privilege then
      null;
  end;
end
$$;

alter table public.users enable row level security;

drop policy if exists "users_select_own_or_pricing" on public.users;
drop policy if exists "users_update_own" on public.users;

create policy "users_select_own_or_pricing"
  on public.users
  for select
  using (
    auth.uid() = id
    or coalesce(auth.jwt() -> 'user_metadata' ->> 'area', '') = 'Pricing'
  );

create policy "users_update_own"
  on public.users
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

grant select, update on public.users to authenticated;

commit;
