-- ============================================
-- RouteNu Vehicle & Driver Costs Setup Script
-- Voer dit script uit in Supabase SQL Editor
-- Dit voegt kosten per kilometer en uurloon toe
-- ============================================

-- ============================================
-- Vehicles tabel uitbreiden met cents_per_km
-- ============================================
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'vehicles' AND column_name = 'cents_per_km'
    ) THEN
        ALTER TABLE vehicles ADD COLUMN cents_per_km NUMERIC(10,2);
    END IF;
END $$;

-- ============================================
-- Drivers tabel uitbreiden met hourly_rate
-- ============================================
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'drivers' AND column_name = 'hourly_rate'
    ) THEN
        ALTER TABLE drivers ADD COLUMN hourly_rate NUMERIC(10,2);
    END IF;
END $$;

-- Index voor performance (optioneel)
CREATE INDEX IF NOT EXISTS idx_vehicles_cents_per_km ON vehicles(cents_per_km);
CREATE INDEX IF NOT EXISTS idx_drivers_hourly_rate ON drivers(hourly_rate);

