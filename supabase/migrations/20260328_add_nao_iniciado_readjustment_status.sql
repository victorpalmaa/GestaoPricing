ALTER TABLE pricing_history
DROP CONSTRAINT IF EXISTS check_readjustment_status;

ALTER TABLE pricing_history
ADD CONSTRAINT check_readjustment_status
CHECK (readjustment_status IN ('Não iniciado', 'Em Análise', 'Comunicado', 'Em Negociação', 'Aprovado', 'Implementado'));
