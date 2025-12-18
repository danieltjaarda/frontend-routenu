-- ============================================
-- Add onboarding_completed field to user_profiles table
-- Voer dit uit in Supabase SQL Editor
-- ============================================

-- Voeg onboarding_completed veld toe aan user_profiles tabel
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_profiles' AND column_name = 'onboarding_completed'
    ) THEN
        ALTER TABLE user_profiles ADD COLUMN onboarding_completed BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- Index voor betere performance (optioneel)
CREATE INDEX IF NOT EXISTS idx_user_profiles_onboarding ON user_profiles(onboarding_completed);











