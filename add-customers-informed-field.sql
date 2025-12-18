-- ============================================
-- Add customers_informed_at field to routes table
-- Voer dit uit in Supabase SQL Editor
-- ============================================

-- Voeg customers_informed_at veld toe aan routes tabel
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'routes' AND column_name = 'customers_informed_at'
    ) THEN
        ALTER TABLE routes ADD COLUMN customers_informed_at TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

-- Index voor betere performance
CREATE INDEX IF NOT EXISTS idx_routes_customers_informed_at ON routes(customers_informed_at);

