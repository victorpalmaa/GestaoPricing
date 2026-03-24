begin;

alter table public.prices enable row level security;
alter table public.price_rejections enable row level security;

grant select, insert, update, delete on table public.prices to authenticated;
grant select, insert on table public.price_rejections to authenticated;

drop policy if exists "Permitir leitura para todos autenticados" on public.prices;
drop policy if exists "Permitir inserção para todos autenticados" on public.prices;
drop policy if exists "Permitir atualização para todos autenticados" on public.prices;
drop policy if exists "Permitir exclusão para todos autenticados" on public.prices;

create policy "Prices: read authenticated"
  on public.prices
  for select
  to authenticated
  using (auth.role() = 'authenticated');

create policy "Prices: insert new-business roles"
  on public.prices
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from auth.users u
      where u.id = auth.uid()
        and coalesce(u.raw_user_meta_data->>'area', '') in (
          'Pricing',
          'CS',
          'Pré-vendas',
          'Pre-vendas',
          'Pre Sales',
          'Pré Vendas',
          'Pre Vendas'
        )
    )
  );

create policy "Prices: update new-business roles"
  on public.prices
  for update
  to authenticated
  using (
    exists (
      select 1
      from auth.users u
      where u.id = auth.uid()
        and coalesce(u.raw_user_meta_data->>'area', '') in (
          'Pricing',
          'CS',
          'Pré-vendas',
          'Pre-vendas',
          'Pre Sales',
          'Pré Vendas',
          'Pre Vendas'
        )
    )
  )
  with check (
    exists (
      select 1
      from auth.users u
      where u.id = auth.uid()
        and coalesce(u.raw_user_meta_data->>'area', '') in (
          'Pricing',
          'CS',
          'Pré-vendas',
          'Pre-vendas',
          'Pre Sales',
          'Pré Vendas',
          'Pre Vendas'
        )
    )
  );

create policy "Prices: delete new-business roles"
  on public.prices
  for delete
  to authenticated
  using (
    exists (
      select 1
      from auth.users u
      where u.id = auth.uid()
        and coalesce(u.raw_user_meta_data->>'area', '') in (
          'Pricing',
          'CS',
          'Pré-vendas',
          'Pre-vendas',
          'Pre Sales',
          'Pré Vendas',
          'Pre Vendas'
        )
    )
  );

drop policy if exists "Permitir leitura para todos autenticados" on public.price_rejections;
drop policy if exists "Permitir inserção para todos autenticados" on public.price_rejections;

create policy "Price rejections: read authenticated"
  on public.price_rejections
  for select
  to authenticated
  using (auth.role() = 'authenticated');

create policy "Price rejections: insert new-business roles"
  on public.price_rejections
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from auth.users u
      where u.id = auth.uid()
        and coalesce(u.raw_user_meta_data->>'area', '') in (
          'Pricing',
          'CS',
          'Pré-vendas',
          'Pre-vendas',
          'Pre Sales',
          'Pré Vendas',
          'Pre Vendas'
        )
    )
  );

commit;
