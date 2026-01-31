-- Adicionar permissões para as tabelas do módulo Pricing

-- Grant SELECT para usuários autenticados
GRANT SELECT ON clients TO authenticated;
GRANT SELECT ON client_aliases TO authenticated;
GRANT SELECT ON pricing_history TO authenticated;

-- Grant INSERT, UPDATE, DELETE para usuários do Pricing
GRANT INSERT, UPDATE, DELETE ON clients TO authenticated;
GRANT INSERT, UPDATE, DELETE ON client_aliases TO authenticated;
GRANT INSERT, UPDATE, DELETE ON pricing_history TO authenticated;

-- Verificar permissões atuais
SELECT grantee, table_name, privilege_type 
FROM information_schema.role_table_grants 
WHERE table_schema = 'public' 
AND table_name IN ('clients', 'client_aliases', 'pricing_history')
AND grantee IN ('anon', 'authenticated')
ORDER BY table_name, grantee;