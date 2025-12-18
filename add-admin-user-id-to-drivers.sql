-- ============================================
-- Add admin_user_id column to drivers table
-- Voer dit uit in Supabase SQL Editor
-- Dit is nodig om chauffeurs met account te koppelen aan de admin die ze heeft aangemaakt
-- ============================================

-- Add admin_user_id column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'drivers' AND column_name = 'admin_user_id'
    ) THEN
        ALTER TABLE drivers ADD COLUMN admin_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
        CREATE INDEX IF NOT EXISTS idx_drivers_admin_user_id ON drivers(admin_user_id);
        
        -- Update existing drivers: if user_id != admin user_id, set admin_user_id to the admin who created them
        -- For now, we'll leave it NULL for existing drivers without account (user_id = admin.user_id)
        -- Drivers with account (user_id != admin.user_id) will need to be updated manually or via application logic
    END IF;
END $$;

-- Note: We keep the existing RLS policies from driver-setup.sql
-- The existing "Admins can view all drivers" policy should work fine
-- We don't need to modify RLS policies here as the admin_user_id is just for data organization

