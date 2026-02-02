-- ============================================
-- Add Available Days Field to Drivers Table
-- Monteurs kunnen hun beschikbare dagen per week doorgeven
-- ============================================

-- Voeg available_days kolom toe aan drivers tabel
-- Dit is een JSONB array met dagen van de week (0 = zondag, 1 = maandag, ..., 6 = zaterdag)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'drivers' AND column_name = 'available_days'
    ) THEN
        ALTER TABLE drivers ADD COLUMN available_days JSONB DEFAULT '[]'::jsonb;
        CREATE INDEX IF NOT EXISTS idx_drivers_available_days ON drivers USING GIN(available_days);
        RAISE NOTICE '✅ available_days kolom toegevoegd aan drivers tabel';
    ELSE
        RAISE NOTICE 'ℹ️ available_days kolom bestaat al';
    END IF;
END $$;

-- ============================================
-- VERIFICATIE
-- ============================================
DO $$
BEGIN
    RAISE NOTICE '✅ Available days setup voltooid!';
    RAISE NOTICE '📊 drivers tabel uitgebreid met available_days (JSONB array)';
    RAISE NOTICE '💡 Gebruik: [0,1,2,3,4,5,6] waar 0=zondag, 1=maandag, ..., 6=zaterdag';
END $$;

