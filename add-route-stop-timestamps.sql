-- ============================================
-- Route Stop Timestamps Setup Script
-- Voer dit script uit in Supabase SQL Editor
-- Dit voegt functionaliteit toe voor live route tracking
-- ============================================

-- Add table to track actual arrival times at stops
CREATE TABLE IF NOT EXISTS route_stop_timestamps (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  route_id UUID REFERENCES routes(id) ON DELETE CASCADE NOT NULL,
  stop_index INTEGER NOT NULL,
  stop_id TEXT,
  actual_arrival_time TIMESTAMP WITH TIME ZONE,
  actual_departure_time TIMESTAMP WITH TIME ZONE,
  route_started_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(route_id, stop_index)
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_route_stop_timestamps_route_id ON route_stop_timestamps(route_id);
CREATE INDEX IF NOT EXISTS idx_route_stop_timestamps_stop_index ON route_stop_timestamps(route_id, stop_index);

-- Trigger for auto-update updated_at
CREATE TRIGGER update_route_stop_timestamps_updated_at BEFORE UPDATE ON route_stop_timestamps
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies
ALTER TABLE route_stop_timestamps ENABLE ROW LEVEL SECURITY;

-- Drivers can view and update timestamps for their assigned routes
CREATE POLICY "Drivers can view route stop timestamps" ON route_stop_timestamps
  FOR SELECT USING (
    route_id IN (
      SELECT r.id FROM routes r
      JOIN drivers d ON r.driver_id = d.id
      WHERE d.user_id = auth.uid()
    )
  );

CREATE POLICY "Drivers can insert route stop timestamps" ON route_stop_timestamps
  FOR INSERT WITH CHECK (
    route_id IN (
      SELECT r.id FROM routes r
      JOIN drivers d ON r.driver_id = d.id
      WHERE d.user_id = auth.uid()
    )
  );

CREATE POLICY "Drivers can update route stop timestamps" ON route_stop_timestamps
  FOR UPDATE USING (
    route_id IN (
      SELECT r.id FROM routes r
      JOIN drivers d ON r.driver_id = d.id
      WHERE d.user_id = auth.uid()
    )
  );

-- Route owners can view timestamps for their routes
CREATE POLICY "Route owners can view route stop timestamps" ON route_stop_timestamps
  FOR SELECT USING (
    route_id IN (
      SELECT id FROM routes WHERE user_id = auth.uid()
    )
  );

-- Add route_started_at column to routes table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'routes' AND column_name = 'route_started_at'
    ) THEN
        ALTER TABLE routes ADD COLUMN route_started_at TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

-- Add live_route_token column to routes for secure public access
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'routes' AND column_name = 'live_route_token'
    ) THEN
        ALTER TABLE routes ADD COLUMN live_route_token TEXT;
        CREATE INDEX IF NOT EXISTS idx_routes_live_route_token ON routes(live_route_token);
    END IF;
END $$;
