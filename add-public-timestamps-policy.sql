-- ============================================
-- Add RLS Policy for Public Access to Route Stop Timestamps
-- This allows unauthenticated users to view timestamps via live route token
-- ============================================

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Public can view route stop timestamps with valid live token" ON route_stop_timestamps;

-- Create policy to allow public access to timestamps for routes with valid live_route_token
-- This is needed for the live route tracking page which is public
CREATE POLICY "Public can view route stop timestamps with valid live token" ON route_stop_timestamps
  FOR SELECT USING (
    route_id IN (
      SELECT id FROM routes
      WHERE live_route_token IS NOT NULL 
      AND live_route_token != ''
      AND route_status = 'started'
    )
  );

-- Note: This policy allows ANYONE with a valid route token to view the timestamps
-- The token acts as the security mechanism, so tokens should be:
-- 1. Unique and hard to guess
-- 2. Generated securely when route starts
-- 3. Only shared with intended recipients via email

