-- Script de Atualização de Políticas de Segurança (RLS)
-- Este script garante que as permissões necessárias existam para as tabelas prices e price_rejections

-- 1. Tabela prices: Garantir que RLS esteja ativado e políticas existam
ALTER TABLE prices ENABLE ROW LEVEL SECURITY;

-- Remover políticas antigas para evitar duplicidade e garantir a versão correta
DROP POLICY IF EXISTS "Permitir leitura para todos autenticados" ON prices;
DROP POLICY IF EXISTS "Permitir inserção para todos autenticados" ON prices;
DROP POLICY IF EXISTS "Permitir atualização para todos autenticados" ON prices;
DROP POLICY IF EXISTS "Permitir exclusão para todos autenticados" ON prices;

-- Criar novas políticas para prices
CREATE POLICY "Permitir leitura para todos autenticados" ON prices
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Permitir inserção para todos autenticados" ON prices
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Permitir atualização para todos autenticados" ON prices
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Permitir exclusão para todos autenticados" ON prices
  FOR DELETE USING (auth.role() = 'authenticated');


-- 2. Tabela price_rejections: Garantir que RLS esteja ativado e políticas existam
ALTER TABLE price_rejections ENABLE ROW LEVEL SECURITY;

-- Remover políticas antigas
DROP POLICY IF EXISTS "Permitir leitura para todos autenticados" ON price_rejections;
DROP POLICY IF EXISTS "Permitir inserção para todos autenticados" ON price_rejections;

-- Criar novas políticas para price_rejections
CREATE POLICY "Permitir leitura para todos autenticados" ON price_rejections
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Permitir inserção para todos autenticados" ON price_rejections
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- 3. Garantir colunas necessárias na tabela prices (caso script anterior tenha falhado)
ALTER TABLE prices ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE prices ADD COLUMN IF NOT EXISTS subcategory TEXT;
