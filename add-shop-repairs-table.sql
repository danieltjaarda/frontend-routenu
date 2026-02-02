-- Create shop_repairs table for in-store repairs
CREATE TABLE IF NOT EXISTS shop_repairs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT,
  customer_name TEXT,
  revenue DECIMAL(10,2) DEFAULT 0,
  parts_cost DECIMAL(10,2) DEFAULT 0,
  labor_hours DECIMAL(4,2) DEFAULT 0,
  btw_percentage DECIMAL(4,2) DEFAULT 21,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add btw_percentage column if table already exists
ALTER TABLE shop_repairs ADD COLUMN IF NOT EXISTS btw_percentage DECIMAL(4,2) DEFAULT 21;

-- Enable RLS
ALTER TABLE shop_repairs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first (to avoid conflicts)
DROP POLICY IF EXISTS "Users can view their own shop repairs" ON shop_repairs;
DROP POLICY IF EXISTS "Users can insert their own shop repairs" ON shop_repairs;
DROP POLICY IF EXISTS "Users can update their own shop repairs" ON shop_repairs;
DROP POLICY IF EXISTS "Users can delete their own shop repairs" ON shop_repairs;

-- Create policies
CREATE POLICY "Users can view their own shop repairs"
  ON shop_repairs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own shop repairs"
  ON shop_repairs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own shop repairs"
  ON shop_repairs FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own shop repairs"
  ON shop_repairs FOR DELETE
  USING (auth.uid() = user_id);

-- Create indexes for faster queries (ignore if already exists)
CREATE INDEX IF NOT EXISTS idx_shop_repairs_user_id ON shop_repairs(user_id);
CREATE INDEX IF NOT EXISTS idx_shop_repairs_date ON shop_repairs(date);
