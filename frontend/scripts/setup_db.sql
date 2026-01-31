-- Create clients table
CREATE TABLE IF NOT EXISTS public.clients (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create pricing_history table
CREATE TABLE IF NOT EXISTS public.pricing_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
    sku TEXT NOT NULL,
    net_price NUMERIC NOT NULL,
    gross_price NUMERIC,
    margin_budget NUMERIC,
    size TEXT,
    manager TEXT,
    code TEXT,
    category TEXT,
    subcategory TEXT,
    month TEXT,
    date DATE NOT NULL,
    obs TEXT,
    currency TEXT DEFAULT 'BRL',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create client_aliases table
CREATE TABLE IF NOT EXISTS public.client_aliases (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
    alias_name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_aliases ENABLE ROW LEVEL SECURITY;

-- REMOVE EXISTING RESTRICTIVE POLICIES (if any)
DROP POLICY IF EXISTS "Permitir SELECT para usuários autenticados" ON clients;
DROP POLICY IF EXISTS "Permitir INSERT para role pricing" ON clients;
DROP POLICY IF EXISTS "Permitir SELECT para usuários autenticados" ON client_aliases;
DROP POLICY IF EXISTS "Permitir INSERT para role pricing" ON client_aliases;
DROP POLICY IF EXISTS "Permitir SELECT para usuários autenticados" ON pricing_history;
DROP POLICY IF EXISTS "Permitir INSERT para role pricing" ON pricing_history;

-- CREATE PERMISSIVE POLICIES FOR DEVELOPMENT
-- Allow ALL operations for EVERYONE (including anonymous)
-- WARNING: Use this only for development/testing
CREATE POLICY "Dev Policy Clients" ON public.clients FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Dev Policy Pricing" ON public.pricing_history FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Dev Policy Aliases" ON public.client_aliases FOR ALL USING (true) WITH CHECK (true);
