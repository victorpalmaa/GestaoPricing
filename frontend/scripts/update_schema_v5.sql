-- Migration to add user_name column to simulations_history
-- Run this script in your Supabase SQL Editor to fix the "Could not find the 'user_name' column" error.

ALTER TABLE simulations_history 
ADD COLUMN IF NOT EXISTS user_name TEXT;

COMMENT ON COLUMN simulations_history.user_name IS 'Nome do usuário que realizou a simulação';

-- Optional: Update existing records with email prefix if name is missing (safe update)
UPDATE simulations_history
SET user_name = split_part(user_email, '@', 1)
WHERE user_name IS NULL AND user_email IS NOT NULL;
