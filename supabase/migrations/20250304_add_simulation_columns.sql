-- Add columns for Gross Price simulation mode
ALTER TABLE simulations_history 
ADD COLUMN IF NOT EXISTS pis NUMERIC,
ADD COLUMN IF NOT EXISTS cofins NUMERIC,
ADD COLUMN IF NOT EXISTS icms NUMERIC,
ADD COLUMN IF NOT EXISTS gross_price NUMERIC;

-- Optional: Add comments for clarity
COMMENT ON COLUMN simulations_history.pis IS 'Percentual de PIS usado no cálculo';
COMMENT ON COLUMN simulations_history.cofins IS 'Percentual de COFINS usado no cálculo';
COMMENT ON COLUMN simulations_history.icms IS 'Percentual de ICMS usado no cálculo';
COMMENT ON COLUMN simulations_history.gross_price IS 'Preço Bruto calculado (Gross Up)';
