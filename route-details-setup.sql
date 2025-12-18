-- ============================================
-- RouteNu Route Details Setup Script
-- Voer dit script uit in Supabase SQL Editor
-- Dit voegt stop details en route uren toe
-- ============================================

-- ============================================
-- Routes tabel uitbreiden met uren
-- ============================================
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'routes' AND column_name = 'hours_worked'
    ) THEN
        ALTER TABLE routes ADD COLUMN hours_worked DECIMAL(5,2);
    END IF;
END $$;

-- ============================================
-- TABEL: route_stop_details
-- Opslaan van details per stop (werkzaamheden, bedrag, kosten)
-- ============================================
CREATE TABLE IF NOT EXISTS route_stop_details (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  route_id UUID REFERENCES routes(id) ON DELETE CASCADE NOT NULL,
  stop_index INTEGER NOT NULL,
  stop_id TEXT NOT NULL,
  work_description TEXT,
  amount_received DECIMAL(10,2),
  parts_cost DECIMAL(10,2),
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(route_id, stop_index)
);

-- Index voor route_stop_details
CREATE INDEX IF NOT EXISTS idx_route_stop_details_route_id ON route_stop_details(route_id);
CREATE INDEX IF NOT EXISTS idx_route_stop_details_stop_index ON route_stop_details(route_id, stop_index);

-- Trigger voor auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_route_stop_details_updated_at ON route_stop_details;
CREATE TRIGGER update_route_stop_details_updated_at BEFORE UPDATE ON route_stop_details
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS voor route_stop_details
ALTER TABLE route_stop_details ENABLE ROW LEVEL SECURITY;

-- RLS POLICIES: Route Stop Details
-- Drivers can view and update stop details for their assigned routes
DROP POLICY IF EXISTS "Drivers can view stop details for assigned routes" ON route_stop_details;
DROP POLICY IF EXISTS "Drivers can update stop details for assigned routes" ON route_stop_details;
DROP POLICY IF EXISTS "Admins can view all stop details" ON route_stop_details;

CREATE POLICY "Drivers can view stop details for assigned routes" ON route_stop_details
  FOR SELECT USING (
    route_id IN (
      SELECT r.id FROM routes r
      INNER JOIN drivers d ON r.driver_id = d.id
      WHERE d.user_id = auth.uid()
    )
  );

CREATE POLICY "Drivers can update stop details for assigned routes" ON route_stop_details
  FOR UPDATE USING (
    route_id IN (
      SELECT r.id FROM routes r
      INNER JOIN drivers d ON r.driver_id = d.id
      WHERE d.user_id = auth.uid()
    )
  );

CREATE POLICY "Drivers can insert stop details for assigned routes" ON route_stop_details
  FOR INSERT WITH CHECK (
    route_id IN (
      SELECT r.id FROM routes r
      INNER JOIN drivers d ON r.driver_id = d.id
      WHERE d.user_id = auth.uid()
    )
  );

-- Admins can view all stop details
CREATE POLICY "Admins can view all stop details" ON route_stop_details
  FOR SELECT USING (auth.uid() IS NOT NULL);

