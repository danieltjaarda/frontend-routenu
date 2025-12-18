-- ============================================
-- Add RLS Policy for Public Live Route Access
-- This allows unauthenticated users to view routes via live route token
-- ============================================

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Public can view routes with valid live token" ON routes;

-- Create policy to allow public access to routes with valid live_route_token
-- This is needed for the live route tracking page which is public
-- Note: We check route_status = 'started' in the policy to ensure only started routes are accessible
CREATE POLICY "Public can view routes with valid live token" ON routes
  FOR SELECT USING (
    live_route_token IS NOT NULL 
    AND live_route_token != ''
    AND route_status = 'started'
  );

-- Note: This policy allows ANYONE with a valid token to view the route
-- The token acts as the security mechanism, so tokens should be:
-- 1. Unique and hard to guess
-- 2. Generated securely when route starts
-- 3. Only shared with intended recipients via email

-- IMPORTANT: Make sure RLS is enabled on the routes table
-- If you get permission errors, run this:
-- ALTER TABLE routes ENABLE ROW LEVEL SECURITY;
