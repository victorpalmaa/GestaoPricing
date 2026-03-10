-- Adiciona a coluna 'gate' na tabela 'pricing_history'
ALTER TABLE pricing_history 
ADD COLUMN IF NOT EXISTS gate SMALLINT DEFAULT 1;

-- Opcional: Atualizar registros existentes com base na data (lógica aproximada se necessário)
-- UPDATE pricing_history SET gate = 1 WHERE gate IS NULL;
