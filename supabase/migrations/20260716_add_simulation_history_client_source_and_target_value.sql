alter table public.simulations_history
  add column if not exists client_id uuid references public.clients(id) on delete set null,
  add column if not exists client_source text,
  add column if not exists target_value numeric;

create index if not exists idx_simulations_history_client_id
  on public.simulations_history (client_id);

alter table public.simulations_history
  drop constraint if exists simulations_history_client_source_check;

alter table public.simulations_history
  add constraint simulations_history_client_source_check
  check (
    client_source is null
    or client_source in ('base', 'manual')
  );

update public.simulations_history
set target_value = case
  when target is null or btrim(target) = '' then null
  when regexp_replace(target, '[^0-9,.-]', '', 'g') like '%,%' then
    nullif(
      replace(
        replace(regexp_replace(target, '[^0-9,.-]', '', 'g'), '.', ''),
        ',',
        '.'
      ),
      ''
    )::numeric
  else
    nullif(regexp_replace(target, '[^0-9.-]', '', 'g'), '')::numeric
end
where target_value is null;

update public.simulations_history as sh
set client_id = c.id,
    client_source = 'base'
from public.clients as c
where sh.client_id is null
  and coalesce(btrim(sh.client_name), '') <> ''
  and lower(btrim(sh.client_name)) = lower(btrim(c.name));

update public.simulations_history
set client_source = 'base'
where client_id is not null
  and client_source is distinct from 'base';

update public.simulations_history
set client_source = 'manual'
where client_id is null
  and client_source is null
  and coalesce(btrim(client_name), '') <> '';
