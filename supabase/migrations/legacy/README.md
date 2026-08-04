# Legacy SQL

Esta pasta preserva scripts SQL antigos do projeto apenas como registro historico.

Nada daqui deve ser executado como parte do fluxo atual de criacao, migracao ou manutencao do banco. Esses arquivos foram aplicados de forma inconsistente entre ambientes e o schema atual divergiu deles.

Motivos para nao executar:
- alguns arquivos recriam tabelas e policies que nao representam o estado atual de producao
- ha referencias a estruturas abandonadas, como `notifications`
- a autorizacao atual por area foi reescrita nas migracoes oficiais e nao deve ser sobrescrita por SQL antigo

Atencao especial para `setup_db.sql`:
- esse arquivo cria policies de desenvolvimento com `FOR ALL USING (true) WITH CHECK (true)`
- isso libera acesso amplo, incluindo alcance ao role `anon`, e expoe a base sem autenticacao
- foi exatamente esse tipo de configuracao que precisou ser removido na migracao `20260801140000_rls_authorization.sql`

Fluxo valido:
- use apenas as migracoes oficiais em `supabase/migrations/`, na ordem cronologica do nome
