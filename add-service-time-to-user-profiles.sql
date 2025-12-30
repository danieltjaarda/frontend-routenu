-- ============================================
-- RouteNu Service Time to User Profiles Migration
-- Voeg service_time kolom toe aan user_profiles tabel
-- Voer dit script uit in Supabase SQL Editor
-- ============================================

-- Voeg service_time kolom toe aan user_profiles tabel
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_profiles' AND column_name = 'service_time'
    ) THEN
        ALTER TABLE user_profiles ADD COLUMN service_time INTEGER DEFAULT 5;
        COMMENT ON COLUMN user_profiles.service_time IS 'Standaard service tijd in minuten voor alle stops (standaard 5 minuten)';
    END IF;
END $$;

-- Update bestaande profielen zonder service_time naar standaard waarde 5
UPDATE user_profiles 
SET service_time = 5 
WHERE service_time IS NULL;

