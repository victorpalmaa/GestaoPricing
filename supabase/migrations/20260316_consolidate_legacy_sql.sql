begin;
alter table public.prices add column if not exists category text;
alter table public.prices add column if not exists subcategory text;

create table if not exists public.price_rejections (
  id uuid default gen_random_uuid() primary key,
  price_id uuid references public.prices(id),
  cliente text,
  sku text,
  preco_bruto numeric,
  margem_bruta numeric,
  motivo text,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  user_id uuid
);

alter table public.prices enable row level security;
alter table public.price_rejections enable row level security;
alter table public.notifications enable row level security;

drop policy if exists "Permitir leitura para todos autenticados" on public.prices;
drop policy if exists "Permitir inserção para todos autenticados" on public.prices;
drop policy if exists "Permitir atualização para todos autenticados" on public.prices;
drop policy if exists "Permitir exclusão para todos autenticados" on public.prices;

create policy "Permitir leitura para todos autenticados" on public.prices
  for select using (auth.role() = 'authenticated');
create policy "Permitir inserção para todos autenticados" on public.prices
  for insert with check (auth.role() = 'authenticated');
create policy "Permitir atualização para todos autenticados" on public.prices
  for update using (auth.role() = 'authenticated');
create policy "Permitir exclusão para todos autenticados" on public.prices
  for delete using (auth.role() = 'authenticated');

drop policy if exists "Permitir leitura para todos autenticados" on public.price_rejections;
drop policy if exists "Permitir inserção para todos autenticados" on public.price_rejections;

create policy "Permitir leitura para todos autenticados" on public.price_rejections
  for select using (auth.role() = 'authenticated');
create policy "Permitir inserção para todos autenticados" on public.price_rejections
  for insert with check (auth.role() = 'authenticated');

create table if not exists public.notifications (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  type text not null,
  message text not null,
  read boolean default false,
  user_id uuid references auth.users(id)
);

drop policy if exists "Users can view all notifications" on public.notifications;
drop policy if exists "Users can view own notifications" on public.notifications;
drop policy if exists "Users can view their own notifications" on public.notifications;
drop policy if exists "Users can insert notifications" on public.notifications;
drop policy if exists "Users can update own notifications" on public.notifications;
drop policy if exists "Users can update their own notifications" on public.notifications;

create policy "Users can view their own notifications"
  on public.notifications for select
  using (auth.uid() = user_id or user_id is null);
create policy "Users can insert notifications"
  on public.notifications for insert
  with check (auth.role() = 'authenticated');
create policy "Users can update their own notifications"
  on public.notifications for update
  using (auth.uid() = user_id or user_id is null);

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end
$$;
commit;
