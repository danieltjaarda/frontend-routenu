-- ============================================
-- Fix RLS Recursion Error
-- Voer dit uit in Supabase SQL Editor
-- Dit lost de "infinite recursion detected" error op
-- ============================================

-- Create a security definer function to check if user is driver
-- This prevents recursion because it bypasses RLS
CREATE OR REPLACE FUNCTION is_driver_for_route(route_driver_id UUID, current_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if the route's driver_id matches a driver with the current user_id
  -- This function runs with SECURITY DEFINER, so it bypasses RLS
  RETURN EXISTS (
    SELECT 1 FROM drivers 
    WHERE id = route_driver_id 
    AND user_id = current_user_id
  );
END;
$$;

-- Drop the problematic routes policies that cause recursion
DROP POLICY IF EXISTS "Drivers can view assigned routes" ON routes;
DROP POLICY IF EXISTS "Drivers can update assigned routes" ON routes;

-- Recreate the routes policies using the security definer function
-- This prevents recursion because the function bypasses RLS
CREATE POLICY "Drivers can view assigned routes" ON routes
  FOR SELECT USING (
    -- Allow if user owns the route (admin)
    auth.uid() = user_id OR
    -- Allow if route is assigned to a driver and user is that driver
    (driver_id IS NOT NULL AND is_driver_for_route(driver_id, auth.uid()))
  );

CREATE POLICY "Drivers can update assigned routes" ON routes
  FOR UPDATE USING (
    -- Allow if user owns the route (admin)
    auth.uid() = user_id OR
    -- Allow if route is assigned to a driver and user is that driver
    (driver_id IS NOT NULL AND is_driver_for_route(driver_id, auth.uid()))
  );

-- Also ensure the drivers policies are correct and don't cause recursion
-- The "Admins can view all drivers" policy should be safe as it doesn't query other tables
-- But let's make sure it's properly set up
DROP POLICY IF EXISTS "Admins can view all drivers" ON drivers;
CREATE POLICY "Admins can view all drivers" ON drivers
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Note: The recursion might also be caused by the routes policy querying drivers
-- which then triggers other policies. The EXISTS clause above should help,
-- but if recursion persists, we may need to use a different approach.

