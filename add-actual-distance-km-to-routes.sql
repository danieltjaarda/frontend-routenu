-- ============================================
-- RouteNu Actual Distance KM Setup
-- Voer dit script uit in Supabase SQL Editor
-- Dit voegt het actual_distance_km veld toe aan routes tabel
-- ============================================

-- ============================================
-- Routes tabel uitbreiden met actual_distance_km
-- ============================================
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'routes' AND column_name = 'actual_distance_km'
    ) THEN
        ALTER TABLE routes ADD COLUMN actual_distance_km DECIMAL(10,2);
        RAISE NOTICE 'actual_distance_km kolom toegevoegd aan routes tabel';
    ELSE
        RAISE NOTICE 'actual_distance_km kolom bestaat al';
    END IF;
END $$;

