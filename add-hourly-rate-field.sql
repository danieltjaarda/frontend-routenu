-- ============================================
-- Add hourly_rate field to drivers table
-- Voer dit uit in Supabase SQL Editor
-- ============================================

-- Voeg hourly_rate veld toe aan drivers tabel
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'drivers' AND column_name = 'hourly_rate'
    ) THEN
        ALTER TABLE drivers ADD COLUMN hourly_rate DECIMAL(10,2);
    END IF;
END $$;

-- Index voor betere performance (optioneel)
CREATE INDEX IF NOT EXISTS idx_drivers_hourly_rate ON drivers(hourly_rate);

