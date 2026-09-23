-- Schema de referencia extraido do Supabase em 2026-09-22.
-- ATENCAO: nao e a DDL original. Faltam PK, FK, defaults, indices
-- e as policies de RLS. Serve como documentacao do schema vigente,
-- nao para recriar o ambiente do zero.

create table client_retail_prices (
  id            uuid            not null,
  client_id     uuid            not null,
  datasul_code  text            not null,
  nome_site     text            not null,
  retail_price  numeric(12,2)   not null,
  currency      text            not null,
  collected_at  date            not null,
  source        text,
  created_at    timestamptz     not null,
  created_by    uuid
);

-- RLS vigente:
--   crp_select  SELECT  using (true)
--   crp_insert  INSERT  with check (is_pricing())
--   crp_update  UPDATE  using (is_pricing()) with check (is_pricing())
--   crp_delete  DELETE  using (is_pricing())
