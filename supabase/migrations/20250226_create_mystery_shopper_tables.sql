-- Create table for competitors
CREATE TABLE IF NOT EXISTS competitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fantasy_name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create table for competitor products (mapping)
CREATE TABLE IF NOT EXISTS competitor_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competitor_id UUID NOT NULL REFERENCES competitors(id) ON DELETE CASCADE,
  our_sku TEXT NOT NULL,
  competitor_sku TEXT,
  competitor_product_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(competitor_id, our_sku)
);

-- Create table for mystery shopper quotes
CREATE TABLE IF NOT EXISTS mystery_shopper_quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competitor_product_id UUID NOT NULL REFERENCES competitor_products(id) ON DELETE CASCADE,
  price NUMERIC NOT NULL,
  quote_date DATE NOT NULL DEFAULT CURRENT_DATE,
  source_url TEXT,
  obs TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE competitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitor_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE mystery_shopper_quotes ENABLE ROW LEVEL SECURITY;

-- Create policies (Allow read for authenticated users, write for everyone for now as per previous pattern, or restrict if needed)
-- Assuming 'authenticated' role for read
CREATE POLICY "Enable read access for all users" ON competitors FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Enable read access for all users" ON competitor_products FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Enable read access for all users" ON mystery_shopper_quotes FOR SELECT USING (auth.role() = 'authenticated');

-- Assuming write access for authenticated users (can be refined to specific roles later)
CREATE POLICY "Enable insert for authenticated users" ON competitors FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Enable update for authenticated users" ON competitors FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Enable delete for authenticated users" ON competitors FOR DELETE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable insert for authenticated users" ON competitor_products FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Enable update for authenticated users" ON competitor_products FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Enable delete for authenticated users" ON competitor_products FOR DELETE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable insert for authenticated users" ON mystery_shopper_quotes FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Enable update for authenticated users" ON mystery_shopper_quotes FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Enable delete for authenticated users" ON mystery_shopper_quotes FOR DELETE USING (auth.role() = 'authenticated');
