-- Add version column to simulations_history
ALTER TABLE simulations_history 
ADD COLUMN IF NOT EXISTS version TEXT;

COMMENT ON COLUMN simulations_history.version IS 'Versão da simulação importada';
