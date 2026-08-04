-- Script to update pricing_history table schema

-- 1. Add 'currency' column if it doesn't exist
ALTER TABLE pricing_history ADD COLUMN IF NOT EXISTS currency text DEFAULT 'BRL';

-- 2. Drop legacy columns that are no longer needed
-- We keep 'date' because it is critical for the timeline charts and filtering in the application
ALTER TABLE pricing_history DROP COLUMN IF EXISTS price;
ALTER TABLE pricing_history DROP COLUMN IF EXISTS margin;
ALTER TABLE pricing_history DROP COLUMN IF EXISTS obs;

-- Note: 'net_price' and 'margin_budget' should already contain the data from 'price' and 'margin'
-- If they don't, you would need to migrate data before dropping columns:
-- UPDATE pricing_history SET net_price = price WHERE net_price IS NULL;
-- UPDATE pricing_history SET margin_budget = margin WHERE margin_budget IS NULL;
