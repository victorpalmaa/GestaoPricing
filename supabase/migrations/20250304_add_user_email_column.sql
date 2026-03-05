-- Add user_email column to simulations_history for easier frontend access
ALTER TABLE simulations_history 
ADD COLUMN IF NOT EXISTS user_email TEXT;

COMMENT ON COLUMN simulations_history.user_email IS 'Email do usuário que realizou a simulação';
