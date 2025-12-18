-- ============================================
-- RouteNu Database Setup Script
-- Voer dit script uit in Supabase SQL Editor
-- ============================================

-- Enable UUID extension (voor auto-generatie van IDs)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- TABEL: routes
-- Opslaan van routes met stops en route data
-- ============================================
CREATE TABLE IF NOT EXISTS routes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date DATE,
  name TEXT,
  stops JSONB DEFAULT '[]'::jsonb,
  route_data JSONB,
  selected_driver TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- TABEL: vehicles
-- Opslaan van voertuigen met alle instellingen
-- ============================================
CREATE TABLE IF NOT EXISTS vehicles (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  license_plate TEXT,
  description TEXT,
  fixed_color TEXT,
  fuel_type TEXT,
  consumption TEXT,
  co2_emission TEXT,
  driver TEXT,
  start_time TIME,
  end_time TIME,
  speed TEXT,
  planned_break TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- TABEL: orders
-- Opslaan van alle opdrachten/stops
-- ============================================
CREATE TABLE IF NOT EXISTS orders (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  coordinates JSONB NOT NULL,
  address TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  order_type TEXT,
  customer_info JSONB,
  added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- INDEXES voor betere performance
-- ============================================
CREATE INDEX IF NOT EXISTS idx_routes_user_id ON routes(user_id);
CREATE INDEX IF NOT EXISTS idx_routes_date ON routes(date);
CREATE INDEX IF NOT EXISTS idx_vehicles_user_id ON vehicles(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_address ON orders(address);
CREATE INDEX IF NOT EXISTS idx_orders_name ON orders(name);

-- ============================================
-- FUNCTION: Update updated_at timestamp
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- ============================================
-- TRIGGERS: Auto-update updated_at
-- ============================================
CREATE TRIGGER update_routes_updated_at BEFORE UPDATE ON routes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_vehicles_updated_at BEFORE UPDATE ON vehicles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ROW LEVEL SECURITY (RLS) ENABLEN
-- ============================================
ALTER TABLE routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS POLICIES: Routes
-- ============================================
-- Users can view their own routes
CREATE POLICY "Users can view own routes" ON routes
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own routes
CREATE POLICY "Users can insert own routes" ON routes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own routes
CREATE POLICY "Users can update own routes" ON routes
  FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own routes
CREATE POLICY "Users can delete own routes" ON routes
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- RLS POLICIES: Vehicles
-- ============================================
-- Users can view their own vehicles
CREATE POLICY "Users can view own vehicles" ON vehicles
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own vehicles
CREATE POLICY "Users can insert own vehicles" ON vehicles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own vehicles
CREATE POLICY "Users can update own vehicles" ON vehicles
  FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own vehicles
CREATE POLICY "Users can delete own vehicles" ON vehicles
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- RLS POLICIES: Orders
-- ============================================
-- Users can view their own orders
CREATE POLICY "Users can view own orders" ON orders
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own orders
CREATE POLICY "Users can insert own orders" ON orders
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own orders
CREATE POLICY "Users can update own orders" ON orders
  FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own orders
CREATE POLICY "Users can delete own orders" ON orders
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- TABEL: user_profiles
-- Opslaan van gebruikersprofiel instellingen (startpunt)
-- ============================================
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  start_address TEXT,
  start_coordinates JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index voor user_profiles
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);

-- Trigger voor auto-update updated_at
CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS voor user_profiles
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- RLS POLICIES: User Profiles
CREATE POLICY "Users can view own profile" ON user_profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile" ON user_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own profile" ON user_profiles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own profile" ON user_profiles
  FOR DELETE USING (auth.uid() = user_id);

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
CREATE TRIGGER update_drivers_updated_at BEFORE UPDATE ON drivers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS voor drivers
ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;

-- RLS POLICIES: Drivers
CREATE POLICY "Drivers can view own profile" ON drivers
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Drivers can update own profile" ON drivers
  FOR UPDATE USING (auth.uid() = user_id);

-- Admin users can view all drivers (via user_id check in application)
-- Note: This requires checking if user is admin in application logic

-- ============================================
-- Routes tabel uitbreiden met driver_id
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

-- RLS Policy: Drivers can view routes assigned to them
CREATE POLICY "Drivers can view assigned routes" ON routes
  FOR SELECT USING (
    driver_id IN (
      SELECT id FROM drivers WHERE user_id = auth.uid()
    )
  );

-- RLS Policy: Drivers can update routes assigned to them
CREATE POLICY "Drivers can update assigned routes" ON routes
  FOR UPDATE USING (
    driver_id IN (
      SELECT id FROM drivers WHERE user_id = auth.uid()
    )
  );

-- ============================================
-- VERIFICATIE: Check of alles correct is aangemaakt
-- ============================================
DO $$
BEGIN
    RAISE NOTICE '✅ Database setup voltooid!';
    RAISE NOTICE '📊 Tabellen aangemaakt: routes, vehicles, orders, user_profiles, drivers';
    RAISE NOTICE '🔒 Row Level Security ingeschakeld';
    RAISE NOTICE '📈 Indexes aangemaakt voor performance';
    RAISE NOTICE '⏰ Triggers aangemaakt voor auto-update timestamps';
END $$;

