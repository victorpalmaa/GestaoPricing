-- Script para atualização do banco de dados (Supabase)

-- 1. Adicionar coluna 'category' na tabela 'prices'
ALTER TABLE prices 
ADD COLUMN IF NOT EXISTS category TEXT;

-- 2. Criar tabela de reprovações de preços
CREATE TABLE IF NOT EXISTS price_rejections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  price_id UUID REFERENCES prices(id),
  cliente TEXT,
  sku TEXT,
  preco_bruto NUMERIC,
  margem_bruta NUMERIC,
  motivo TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  user_id UUID -- Opcional: para rastrear quem reprovou
);

-- Adicionar políticas RLS (Row Level Security) se necessário (exemplo básico)
ALTER TABLE price_rejections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir leitura para todos autenticados" ON price_rejections
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Permitir inserção para todos autenticados" ON price_rejections
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');
