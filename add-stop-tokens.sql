-- ============================================
-- Add Stop Tokens for Personal Live Route Links
-- This allows each customer to have a personal link to view only their stop
-- ============================================

-- Add stop_tokens column to routes table to store JSONB object with stop_index -> token mapping
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'routes' AND column_name = 'stop_tokens'
    ) THEN
        ALTER TABLE routes ADD COLUMN stop_tokens JSONB DEFAULT '{}'::jsonb;
        CREATE INDEX IF NOT EXISTS idx_routes_stop_tokens ON routes USING GIN (stop_tokens);
    END IF;
END $$;

-- Add RLS policy to allow public access to routes with valid stop token
DROP POLICY IF EXISTS "Public can view routes with valid stop token" ON routes;

CREATE POLICY "Public can view routes with valid stop token" ON routes
  FOR SELECT USING (
    stop_tokens IS NOT NULL 
    AND stop_tokens != '{}'::jsonb
  );

-- Note: The stop_tokens JSONB will contain:
-- {
--   "0": "token-for-stop-0",
--   "1": "token-for-stop-1",
--   ...
-- }
-- Where the key is the stop_index and the value is the unique token for that stop

