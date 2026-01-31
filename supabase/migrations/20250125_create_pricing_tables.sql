-- Criar tabela de clientes
CREATE TABLE IF NOT EXISTS clients (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Criar tabela de aliases para normalização de nomes
CREATE TABLE IF NOT EXISTS client_aliases (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    alias_name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Criar tabela de histórico de preços
CREATE TABLE IF NOT EXISTS pricing_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    sku TEXT NOT NULL,
    price NUMERIC(10,2) NOT NULL,
    margin NUMERIC(5,2) NOT NULL,
    currency TEXT NOT NULL DEFAULT 'BRL',
    date DATE NOT NULL,
    obs TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_clients_name ON clients(name);
CREATE INDEX IF NOT EXISTS idx_client_aliases_alias_name ON client_aliases(alias_name);
CREATE INDEX IF NOT EXISTS idx_client_aliases_client_id ON client_aliases(client_id);
CREATE INDEX IF NOT EXISTS idx_pricing_history_client_id ON pricing_history(client_id);
CREATE INDEX IF NOT EXISTS idx_pricing_history_sku ON pricing_history(sku);
CREATE INDEX IF NOT EXISTS idx_pricing_history_date ON pricing_history(date);

-- Habilitar RLS (Row Level Security)
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing_history ENABLE ROW LEVEL SECURITY;

-- Políticas de segurança para clients
CREATE POLICY "Permitir SELECT para usuários autenticados" ON clients
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Permitir INSERT para role pricing" ON clients
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE auth.users.id = auth.uid()
            AND auth.users.raw_user_meta_data->>'area' = 'Pricing'
        )
    );

-- Políticas de segurança para client_aliases
CREATE POLICY "Permitir SELECT para usuários autenticados" ON client_aliases
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Permitir INSERT para role pricing" ON client_aliases
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE auth.users.id = auth.uid()
            AND auth.users.raw_user_meta_data->>'area' = 'Pricing'
        )
    );

-- Políticas de segurança para pricing_history
CREATE POLICY "Permitir SELECT para usuários autenticados" ON pricing_history
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Permitir INSERT para role pricing" ON pricing_history
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE auth.users.id = auth.uid()
            AND auth.users.raw_user_meta_data->>'area' = 'Pricing'
        )
    );

-- Function para atualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger para atualizar updated_at
CREATE TRIGGER update_pricing_history_updated_at
    BEFORE UPDATE ON pricing_history
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();