-- ============================================
-- RouteNu Picked Up Bikes Setup Script
-- Voer dit script uit in Supabase SQL Editor
-- Dit voegt een tabel toe voor opgehaalde fietsen
-- ============================================

-- ============================================
-- TABEL: picked_up_bikes
-- Opslaan van opgehaalde fietsen per stop
-- ============================================
CREATE TABLE IF NOT EXISTS picked_up_bikes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  route_id UUID REFERENCES routes(id) ON DELETE CASCADE NOT NULL,
  stop_index INTEGER NOT NULL,
  stop_name TEXT,
  stop_email TEXT,
  stop_phone TEXT,
  stop_address TEXT,
  stop_coordinates JSONB,
  driver_id UUID REFERENCES drivers(id) ON DELETE SET NULL,
  driver_name TEXT,
  route_name TEXT,
  route_date DATE,
  picked_up_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index voor picked_up_bikes
CREATE INDEX IF NOT EXISTS idx_picked_up_bikes_user_id ON picked_up_bikes(user_id);
CREATE INDEX IF NOT EXISTS idx_picked_up_bikes_route_id ON picked_up_bikes(route_id);
CREATE INDEX IF NOT EXISTS idx_picked_up_bikes_picked_up_at ON picked_up_bikes(picked_up_at);
CREATE INDEX IF NOT EXISTS idx_picked_up_bikes_driver_id ON picked_up_bikes(driver_id);

-- Trigger voor auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_picked_up_bikes_updated_at ON picked_up_bikes;
CREATE TRIGGER update_picked_up_bikes_updated_at BEFORE UPDATE ON picked_up_bikes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS voor picked_up_bikes
ALTER TABLE picked_up_bikes ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only see their own picked up bikes
DROP POLICY IF EXISTS "Users can view their own picked up bikes" ON picked_up_bikes;
CREATE POLICY "Users can view their own picked up bikes"
  ON picked_up_bikes
  FOR SELECT
  USING (auth.uid() = user_id);

-- RLS Policy: Users can insert their own picked up bikes
DROP POLICY IF EXISTS "Users can insert their own picked up bikes" ON picked_up_bikes;
CREATE POLICY "Users can insert their own picked up bikes"
  ON picked_up_bikes
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- RLS Policy: Users can update their own picked up bikes
DROP POLICY IF EXISTS "Users can update their own picked up bikes" ON picked_up_bikes;
CREATE POLICY "Users can update their own picked up bikes"
  ON picked_up_bikes
  FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS Policy: Drivers can view picked up bikes for routes they are assigned to
DROP POLICY IF EXISTS "Drivers can view picked up bikes for their routes" ON picked_up_bikes;
CREATE POLICY "Drivers can view picked up bikes for their routes"
  ON picked_up_bikes
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM drivers
      WHERE drivers.id = picked_up_bikes.driver_id
      AND drivers.user_id = auth.uid()
    )
  );

