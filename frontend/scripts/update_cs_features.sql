-- Add columns for CS Workflow and Financial Impact
ALTER TABLE pricing_history ADD COLUMN IF NOT EXISTS volume numeric DEFAULT 0;
ALTER TABLE pricing_history ADD COLUMN IF NOT EXISTS communication_status text DEFAULT 'pending'; -- 'pending', 'communicated', 'negotiating'
