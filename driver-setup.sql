-- ============================================
-- RouteNu Chauffeur Setup Script
-- Voer dit script uit in Supabase SQL Editor
-- Dit voegt chauffeur functionaliteit toe aan bestaande database
-- ============================================

-- ============================================
-- TABEL: drivers (chauffeurs)
-- Opslaan van chauffeur informatie
-- ============================================
CREATE TABLE IF NOT EXISTS drivers (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  license_number TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index voor drivers
CREATE INDEX IF NOT EXISTS idx_drivers_user_id ON drivers(user_id);
CREATE INDEX IF NOT EXISTS idx_drivers_email ON drivers(email);

-- Trigger voor auto-update updated_at
DROP TRIGGER IF EXISTS update_drivers_updated_at ON drivers;
CREATE TRIGGER update_drivers_updated_at BEFORE UPDATE ON drivers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS voor drivers
ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;

-- RLS POLICIES: Drivers
-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Drivers can view own profile" ON drivers;
DROP POLICY IF EXISTS "Drivers can update own profile" ON drivers;
DROP POLICY IF EXISTS "Admins can view all drivers" ON drivers;
DROP POLICY IF EXISTS "Admins can insert drivers" ON drivers;
DROP POLICY IF EXISTS "Authenticated users can insert drivers" ON drivers;

-- Drivers can view own profile
CREATE POLICY "Drivers can view own profile" ON drivers
  FOR SELECT USING (auth.uid() = user_id);

-- Drivers can update own profile
CREATE POLICY "Drivers can update own profile" ON drivers
  FOR UPDATE USING (auth.uid() = user_id);

-- Allow any authenticated user to insert drivers (for admin creating drivers)
-- This is needed because the admin creates a driver record for a newly created user
CREATE POLICY "Authenticated users can insert drivers" ON drivers
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Allow authenticated users to view all drivers (for admin view)
CREATE POLICY "Admins can view all drivers" ON drivers
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- ============================================
-- Routes tabel uitbreiden met driver_id en route_status
-- ============================================
-- Add driver_id column to routes if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'routes' AND column_name = 'driver_id'
    ) THEN
        ALTER TABLE routes ADD COLUMN driver_id UUID REFERENCES drivers(id) ON DELETE SET NULL;
        CREATE INDEX IF NOT EXISTS idx_routes_driver_id ON routes(driver_id);
    END IF;
END $$;

-- Add route_status column to routes
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'routes' AND column_name = 'route_status'
    ) THEN
        ALTER TABLE routes ADD COLUMN route_status TEXT DEFAULT 'planned' CHECK (route_status IN ('planned', 'started', 'completed', 'cancelled'));
        CREATE INDEX IF NOT EXISTS idx_routes_status ON routes(route_status);
    END IF;
END $$;

-- Set default route_status for existing routes
UPDATE routes SET route_status = 'planned' WHERE route_status IS NULL;

-- ============================================
-- RLS Policies voor routes: Drivers kunnen hun toegewezen routes zien
-- ============================================
-- Drop existing policy if it exists (voor het geval je dit script meerdere keren uitvoert)
DROP POLICY IF EXISTS "Drivers can view assigned routes" ON routes;
DROP POLICY IF EXISTS "Drivers can update assigned routes" ON routes;

-- Drivers can view routes assigned to them
CREATE POLICY "Drivers can view assigned routes" ON routes
  FOR SELECT USING (
    driver_id IN (
      SELECT id FROM drivers WHERE user_id = auth.uid()
    )
  );

-- Drivers can update routes assigned to them
CREATE POLICY "Drivers can update assigned routes" ON routes
  FOR UPDATE USING (
    driver_id IN (
      SELECT id FROM drivers WHERE user_id = auth.uid()
    )
  );

-- ============================================
-- VERIFICATIE
-- ============================================
DO $$
BEGIN
    RAISE NOTICE '✅ Chauffeur setup voltooid!';
    RAISE NOTICE '📊 Tabel aangemaakt: drivers';
    RAISE NOTICE '📝 Routes tabel uitgebreid met driver_id en route_status';
    RAISE NOTICE '🔒 Row Level Security policies aangemaakt voor chauffeurs';
END $$;

