-- 20260912_mover_vigencia.sql
-- Move a vigência (is_current) de um preço para outra linha do mesmo
-- par (client_id, code) de forma atômica.
--
-- Motivo: a lógica anterior vivia no front (setCurrentPriceForSku) e
-- fazia dois .update() sequenciais sem transação. Se o segundo falhava,
-- o code ficava sem nenhum preço vigente.
--
-- Dois statements, não um UPDATE único: o índice
-- uq_pricing_history_current_per_client_code é unique não-deferrable e
-- é checado linha a linha, então um `set is_current = (id = p_row_id)`
-- pode violar a constraint em estado transitório.
--
-- SECURITY DEFINER contorna RLS, por isso a checagem de is_pricing()
-- é feita explicitamente no corpo. Não substitui o
-- trg_pricing_history_column_guard, que continua valendo (ele decide
-- por auth.uid()/JWT, não pelo role do Postgres).
--
-- A função aceita marcar qualquer linha do code, inclusive uma que não
-- seja a de data mais recente. Isso é deliberado: MASTERWAY
-- 4030.0014.0191/0192 tem a bobina diluída em fev/26 e os repedidos em
-- ago/26, e a vigência correta é a linha mais antiga.

create or replace function public.mover_vigencia(
  p_client_id uuid,
  p_code      text,
  p_row_id    uuid
)
returns integer
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_existe   boolean;
  v_afetadas integer;
begin
  if not public.is_pricing() then
    raise exception 'Apenas a área Pricing pode mover vigência de preço.';
  end if;

  select exists (
    select 1 from pricing_history
    where id = p_row_id
      and client_id = p_client_id
      and code = p_code
  ) into v_existe;

  if not v_existe then
    raise exception 'Linha % não pertence ao par (client_id=%, code=%).',
      p_row_id, p_client_id, p_code;
  end if;

  update pricing_history
  set is_current = false
  where client_id = p_client_id
    and code = p_code
    and is_current is true;

  update pricing_history
  set is_current = true
  where id = p_row_id;

  get diagnostics v_afetadas = row_count;
  return v_afetadas;
end $$;

revoke all on function public.mover_vigencia(uuid, text, uuid) from public;
revoke all on function public.mover_vigencia(uuid, text, uuid) from anon;
grant execute on function public.mover_vigencia(uuid, text, uuid) to authenticated;
