-- ============================================
-- Fix: Admins kunnen chauffeurs bewerken
-- Voer dit script uit in Supabase SQL Editor
-- ============================================

-- Drop bestaande update policy
DROP POLICY IF EXISTS "Drivers can update own profile" ON drivers;
DROP POLICY IF EXISTS "Admins can update drivers" ON drivers;

-- Chauffeurs kunnen hun eigen profiel updaten
CREATE POLICY "Drivers can update own profile" ON drivers
  FOR UPDATE USING (auth.uid() = user_id);

-- Admins kunnen chauffeurs updaten die ze hebben aangemaakt (via admin_user_id)
-- OF chauffeurs die direct aan hen gekoppeld zijn (user_id = admin user_id, voor chauffeurs zonder account)
CREATE POLICY "Admins can update drivers" ON drivers
  FOR UPDATE USING (
    auth.uid() = admin_user_id 
    OR auth.uid() = user_id
  );

-- Voeg admin_user_id kolom toe als deze nog niet bestaat
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'drivers' AND column_name = 'admin_user_id'
    ) THEN
        ALTER TABLE drivers ADD COLUMN admin_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
        CREATE INDEX IF NOT EXISTS idx_drivers_admin_user_id ON drivers(admin_user_id);
    END IF;
END $$;

-- Voeg hourly_rate kolom toe als deze nog niet bestaat
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'drivers' AND column_name = 'hourly_rate'
    ) THEN
        ALTER TABLE drivers ADD COLUMN hourly_rate DECIMAL(10,2);
    END IF;
END $$;

-- Update bestaande chauffeurs: stel admin_user_id in voor chauffeurs die een route hebben
-- Dit koppelt chauffeurs aan de admin die routes heeft aangemaakt met die chauffeur
UPDATE drivers d
SET admin_user_id = (
    SELECT DISTINCT r.user_id 
    FROM routes r 
    WHERE r.driver_id = d.id 
    LIMIT 1
)
WHERE admin_user_id IS NULL
AND EXISTS (
    SELECT 1 FROM routes r WHERE r.driver_id = d.id
);

-- ============================================
-- VEHICLES: Voeg cents_per_km kolom toe
-- ============================================
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'vehicles' AND column_name = 'cents_per_km'
    ) THEN
        ALTER TABLE vehicles ADD COLUMN cents_per_km DECIMAL(10,2);
    END IF;
END $$;

-- Toon resultaat drivers
SELECT 
    name, 
    email, 
    hourly_rate, 
    admin_user_id,
    user_id
FROM drivers;

-- Toon resultaat vehicles
SELECT 
    id,
    license_plate,
    cents_per_km
FROM vehicles;

