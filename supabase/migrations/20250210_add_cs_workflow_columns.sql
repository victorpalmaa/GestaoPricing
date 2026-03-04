-- Add new columns for CS Workflow
ALTER TABLE pricing_history 
ADD COLUMN IF NOT EXISTS readjustment_status text DEFAULT 'Em Análise',
ADD COLUMN IF NOT EXISTS last_price_date timestamp with time zone;

-- Update existing rows to have a default status if null
UPDATE pricing_history 
SET readjustment_status = 'Em Análise' 
WHERE readjustment_status IS NULL;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_pricing_history_readjustment_status ON pricing_history(readjustment_status);
