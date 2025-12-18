-- ============================================
-- Make email column nullable in drivers table
-- Voer dit uit in Supabase SQL Editor
-- Dit is nodig voor chauffeurs zonder account
-- ============================================

-- Maak email kolom nullable
DO $$ 
BEGIN
    -- Check if email column exists and is NOT NULL
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'drivers' 
        AND column_name = 'email' 
        AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE drivers ALTER COLUMN email DROP NOT NULL;
    END IF;
END $$;

