-- ============================================
-- Add RLS Policy for Drivers to Access Inventory
-- Chauffeurs moeten inventory kunnen lezen van routes die aan hen zijn toegewezen
-- ============================================

-- Create a security definer function to check if user is driver for a route owner
-- This prevents recursion because it bypasses RLS
CREATE OR REPLACE FUNCTION is_driver_for_route_owner(route_owner_user_id UUID, current_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if there's a route owned by route_owner_user_id that is assigned to a driver
  -- where the driver's user_id matches current_user_id
  -- This function runs with SECURITY DEFINER, so it bypasses RLS
  RETURN EXISTS (
    SELECT 1 
    FROM routes r
    INNER JOIN drivers d ON r.driver_id = d.id
    WHERE r.user_id = route_owner_user_id
    AND d.user_id = current_user_id
  );
END;
$$;

-- Add RLS policy: Drivers can view inventory of routes assigned to them
-- This allows drivers to see inventory items that belong to the route owner
-- when they have routes assigned to them from that owner
DROP POLICY IF EXISTS "Drivers can view inventory for assigned routes" ON inventory;

CREATE POLICY "Drivers can view inventory for assigned routes" ON inventory
  FOR SELECT
  USING (
    -- Allow if user owns the inventory (admin/owner)
    auth.uid() = user_id OR
    -- Allow if user is a driver and has routes assigned from this inventory owner
    is_driver_for_route_owner(user_id, auth.uid())
  );

-- Note: We keep the existing policies for INSERT, UPDATE, DELETE
-- Drivers should only be able to READ inventory, not modify it

