
-- Add new columns to pricing_history table
ALTER TABLE public.pricing_history
ADD COLUMN IF NOT EXISTS size TEXT,
ADD COLUMN IF NOT EXISTS manager TEXT,
ADD COLUMN IF NOT EXISTS code TEXT,
ADD COLUMN IF NOT EXISTS net_price NUMERIC,
ADD COLUMN IF NOT EXISTS gross_price NUMERIC,
ADD COLUMN IF NOT EXISTS margin_budget NUMERIC,
ADD COLUMN IF NOT EXISTS month TEXT,
ADD COLUMN IF NOT EXISTS category TEXT,
ADD COLUMN IF NOT EXISTS subcategory TEXT;

-- Update existing rows to migrate data if needed (Optional / Best Effort)
-- For example, map existing 'price' to 'net_price' if net_price is null
UPDATE public.pricing_history
SET net_price = price
WHERE net_price IS NULL;

-- Map existing 'margin' to 'margin_budget' if needed
UPDATE public.pricing_history
SET margin_budget = margin
WHERE margin_budget IS NULL;
