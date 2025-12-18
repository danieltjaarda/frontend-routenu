-- ============================================
-- RouteNu Monthly Costs & Fuel Price Setup
-- Voer dit script uit in Supabase SQL Editor
-- Dit voegt maandelijkse kosten en dieselprijs per route toe
-- ============================================

-- ============================================
-- TABEL: monthly_costs
-- Opslaan van maandelijkse kosten (advertenties, etc.)
-- ============================================
CREATE TABLE IF NOT EXISTS monthly_costs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  amount DECIMAL(10,2) NOT NULL,
  cost_type TEXT DEFAULT 'advertisement', -- 'advertisement', 'other'
  month DATE NOT NULL, -- Eerste dag van de maand (YYYY-MM-01)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index voor monthly_costs
CREATE INDEX IF NOT EXISTS idx_monthly_costs_user_id ON monthly_costs(user_id);
CREATE INDEX IF NOT EXISTS idx_monthly_costs_month ON monthly_costs(month);
CREATE INDEX IF NOT EXISTS idx_monthly_costs_type ON monthly_costs(cost_type);

-- ============================================
-- Routes tabel uitbreiden met diesel_price_per_liter
-- ============================================
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'routes' AND column_name = 'diesel_price_per_liter'
    ) THEN
        ALTER TABLE routes ADD COLUMN diesel_price_per_liter DECIMAL(5,3);
        RAISE NOTICE 'diesel_price_per_liter kolom toegevoegd aan routes tabel';
    ELSE
        RAISE NOTICE 'diesel_price_per_liter kolom bestaat al';
    END IF;
END $$;

-- ============================================
-- Trigger voor auto-update updated_at
-- ============================================
CREATE TRIGGER update_monthly_costs_updated_at BEFORE UPDATE ON monthly_costs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================
ALTER TABLE monthly_costs ENABLE ROW LEVEL SECURITY;

-- RLS Policies voor monthly_costs
DROP POLICY IF EXISTS "Users can view their own monthly costs" ON monthly_costs;
DROP POLICY IF EXISTS "Users can insert their own monthly costs" ON monthly_costs;
DROP POLICY IF EXISTS "Users can update their own monthly costs" ON monthly_costs;
DROP POLICY IF EXISTS "Users can delete their own monthly costs" ON monthly_costs;

CREATE POLICY "Users can view their own monthly costs" ON monthly_costs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own monthly costs" ON monthly_costs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own monthly costs" ON monthly_costs
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own monthly costs" ON monthly_costs
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- FUNCTION: Get monthly costs for a specific month
-- ============================================
CREATE OR REPLACE FUNCTION get_monthly_costs_for_month(user_id_param UUID, month_param DATE)
RETURNS DECIMAL(10,2)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_costs DECIMAL(10,2);
BEGIN
  SELECT COALESCE(SUM(amount), 0) INTO total_costs
  FROM monthly_costs
  WHERE user_id = user_id_param
    AND DATE_TRUNC('month', month) = DATE_TRUNC('month', month_param);
  
  RETURN total_costs;
END;
$$;

-- ============================================
-- FUNCTION: Calculate fuel cost for a route
-- ============================================
CREATE OR REPLACE FUNCTION calculate_route_fuel_cost(
  route_id_param UUID,
  diesel_price_per_liter_param DECIMAL(5,3),
  consumption_liters_per_100km DECIMAL(5,2)
)
RETURNS DECIMAL(10,2)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  route_distance_km DECIMAL(10,2);
  fuel_cost DECIMAL(10,2);
BEGIN
  -- Get route distance from route_data JSONB
  SELECT (route_data->>'distance')::DECIMAL / 1000 INTO route_distance_km
  FROM routes
  WHERE id = route_id_param;
  
  IF route_distance_km IS NULL OR route_distance_km = 0 THEN
    RETURN 0;
  END IF;
  
  -- Calculate: (distance_km / 100) * consumption_liters_per_100km * diesel_price_per_liter
  fuel_cost := (route_distance_km / 100) * consumption_liters_per_100km * diesel_price_per_liter_param;
  
  RETURN COALESCE(fuel_cost, 0);
END;
$$;

