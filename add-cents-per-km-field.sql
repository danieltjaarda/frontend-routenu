-- ============================================
-- Add cents_per_km field to vehicles table
-- Voer dit uit in Supabase SQL Editor
-- ============================================

-- Voeg cents_per_km veld toe aan vehicles tabel
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'vehicles' AND column_name = 'cents_per_km'
    ) THEN
        ALTER TABLE vehicles ADD COLUMN cents_per_km DECIMAL(10,2);
    END IF;
END $$;

-- Index voor betere performance (optioneel)
CREATE INDEX IF NOT EXISTS idx_vehicles_cents_per_km ON vehicles(cents_per_km);

