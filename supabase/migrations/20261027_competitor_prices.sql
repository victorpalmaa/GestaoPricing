-- =====================================================================
-- Preços de concorrentes (Catálogo PRO)
-- Lotes semestrais de cotações + de-para validado SKU PRO x SKU concorrente
-- Leitura: todas as áreas | Escrita: só Pricing (is_pricing())
-- =====================================================================

-- 1. Lotes de cotação ---------------------------------------------------
create table if not exists public.competitor_import_batches (
  id           uuid primary key default gen_random_uuid(),
  label        text not null unique,              -- ex.: '2026-1'
  quoted_from  date,
  quoted_to    date,
  source_file  text,
  row_count    int,
  is_current   boolean not null default false,
  created_at   timestamptz not null default now(),
  created_by   uuid default auth.uid()
);
-- só um lote vigente por vez
create unique index if not exists competitor_import_batches_one_current
  on public.competitor_import_batches (is_current) where is_current;

-- 2. Cotações -----------------------------------------------------------
create table if not exists public.competitor_prices (
  id             uuid primary key default gen_random_uuid(),
  batch_id       uuid not null references public.competitor_import_batches(id) on delete cascade,
  competitor     text not null,                   -- Industrializador
  competitor_sku text not null,
  embalagem      text,
  formato        text,
  categoria      text not null,
  subtipo        text,
  pack_qty       numeric,                         -- 300 (g) | 60 (cápsulas) ...
  pack_unit      text check (pack_unit in ('g','ml','cápsulas','gomas','géis','sticks','sachês','doses')),
  pack_weight_g  numeric,                         -- peso total, quando conhecido
  volume         int not null check (volume > 0),
  gross_price    numeric(12,4) not null check (gross_price > 0),
  quoted_at      date not null,
  created_at     timestamptz not null default now(),
  unique (batch_id, competitor, competitor_sku, volume)
);
create index if not exists competitor_prices_sku_idx
  on public.competitor_prices (competitor, competitor_sku);

-- 3. Atributos do SKU PRO (base para R$/100g e R$/unidade) ---------------
-- catalog_br_prices é chaveada por (sku, volume) e não tem tamanho/peso
create table if not exists public.catalog_sku_attributes (
  catalog_sku    text primary key,                -- = catalog_br_prices.sku (nome limpo)
  produto_base   text,
  categoria      text not null,
  formato        text,
  embalagem      text,
  subtipo        text,
  pack_qty       numeric,
  pack_unit      text check (pack_unit in ('g','ml','cápsulas','gomas','géis','sticks','sachês','doses')),
  pack_weight_g  numeric,
  updated_at     timestamptz not null default now()
);

-- 4. De-para validado ---------------------------------------------------
create table if not exists public.competitor_sku_map (
  id             uuid primary key default gen_random_uuid(),
  catalog_sku    text not null,
  competitor     text not null,
  competitor_sku text not null,
  match_level    text not null check (match_level in ('exato','similar','referencia')),
  diff_reason    text,                            -- motivo/diferença (gerado)
  note           text,                            -- observação livre do Pricing
  created_at     timestamptz not null default now(),
  created_by     uuid default auth.uid(),
  unique (catalog_sku, competitor, competitor_sku)
);
create index if not exists competitor_sku_map_catalog_idx
  on public.competitor_sku_map (catalog_sku);

-- 5. Pares rejeitados (✖) para não serem sugeridos de novo ----------------
create table if not exists public.competitor_sku_rejections (
  catalog_sku    text not null,
  competitor     text not null,
  competitor_sku text not null,
  created_at     timestamptz not null default now(),
  created_by     uuid default auth.uid(),
  primary key (catalog_sku, competitor, competitor_sku)
);

-- 6. Órfãos: de-para que perdeu a referência ------------------------------
-- (SKU renomeado no catálogo ou SKU de concorrente ausente no lote vigente)
create or replace view public.v_competitor_map_orphans
with (security_invoker = true) as
select m.*,
       case
         when not exists (select 1 from public.catalog_br_prices c where c.sku = m.catalog_sku)
           then 'SKU PRO não existe no catálogo'
         else 'SKU concorrente ausente no lote vigente'
       end as problema
from public.competitor_sku_map m
where not exists (select 1 from public.catalog_br_prices c where c.sku = m.catalog_sku)
   or not exists (
        select 1
        from public.competitor_prices p
        join public.competitor_import_batches b on b.id = p.batch_id and b.is_current
        where p.competitor = m.competitor and p.competitor_sku = m.competitor_sku);

-- 7. RLS --------------------------------------------------------------
alter table public.competitor_import_batches enable row level security;
alter table public.competitor_prices         enable row level security;
alter table public.catalog_sku_attributes    enable row level security;
alter table public.competitor_sku_map        enable row level security;
alter table public.competitor_sku_rejections enable row level security;

do $$
declare t text;
begin
  foreach t in array array['competitor_import_batches','competitor_prices',
                           'catalog_sku_attributes','competitor_sku_map','competitor_sku_rejections']
  loop
    execute format('drop policy if exists %1$s_select on public.%1$I', t);
    execute format('drop policy if exists %1$s_insert on public.%1$I', t);
    execute format('drop policy if exists %1$s_update on public.%1$I', t);
    execute format('drop policy if exists %1$s_delete on public.%1$I', t);
    execute format('create policy %1$s_select on public.%1$I for select to authenticated using (true)', t);
    execute format('create policy %1$s_insert on public.%1$I for insert to authenticated with check (public.is_pricing())', t);
    execute format('create policy %1$s_update on public.%1$I for update to authenticated using (public.is_pricing()) with check (public.is_pricing())', t);
    execute format('create policy %1$s_delete on public.%1$I for delete to authenticated using (public.is_pricing())', t);
  end loop;
end $$;
