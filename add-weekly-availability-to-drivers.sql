-- ============================================
-- Add Weekly Availability Field to Drivers Table
-- Monteurs kunnen hun beschikbaarheid per week doorgeven met tijden
-- ============================================

-- Voeg availability_schedule kolom toe aan drivers tabel
-- Dit is een JSONB object met weeknummers als keys (bijv. "2024-W01", "2024-W02")
-- Elke week bevat een object met dagen als keys (0-6) en tijden als values
-- Voorbeeld: { "2024-W01": { "1": "18:00", "2": "18:00", "3": "18:00" }, "2024-W02": { "1": "17:00" } }
-- Waar 0=zondag, 1=maandag, ..., 6=zaterdag
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'drivers' AND column_name = 'availability_schedule'
    ) THEN
        ALTER TABLE drivers ADD COLUMN availability_schedule JSONB DEFAULT '{}'::jsonb;
        CREATE INDEX IF NOT EXISTS idx_drivers_availability_schedule ON drivers USING GIN(availability_schedule);
        RAISE NOTICE '✅ availability_schedule kolom toegevoegd aan drivers tabel';
    ELSE
        RAISE NOTICE 'ℹ️ availability_schedule kolom bestaat al';
    END IF;
END $$;

-- ============================================
-- VERIFICATIE
-- ============================================
DO $$
BEGIN
    RAISE NOTICE '✅ Weekly availability setup voltooid!';
    RAISE NOTICE '📊 drivers tabel uitgebreid met availability_schedule (JSONB object)';
    RAISE NOTICE '💡 Formaat: { "2024-W01": { "1": "18:00", "2": "18:00" } }';
    RAISE NOTICE '💡 Waar 0=zondag, 1=maandag, ..., 6=zaterdag';
    RAISE NOTICE '💡 Tijd formaat: "HH:MM" (bijv. "18:00" voor 18:00 uur)';
END $$;

