-- Add user_name column to simulations_history
ALTER TABLE simulations_history 
ADD COLUMN IF NOT EXISTS user_name TEXT;

COMMENT ON COLUMN simulations_history.user_name IS 'Nome do usuário que realizou a simulação';
