-- ============================================
-- Setup Test Driver and Route
-- Voer dit uit in Supabase SQL Editor
-- Dit maakt alles klaar voor de test
-- ============================================

-- 1. Update "Test Chauffeur Route" with admin_user_id
-- First, find the admin user ID for test.admin.final@example.com
DO $$
DECLARE
  v_admin_user_id UUID;
  v_driver_user_id UUID;
  v_route_id UUID;
  v_test_driver_id UUID;
  v_vehicle_id UUID;
BEGIN
  -- Get admin user ID
  SELECT id INTO v_admin_user_id
  FROM auth.users
  WHERE email = 'test.admin.final@example.com'
  LIMIT 1;

  IF v_admin_user_id IS NULL THEN
    RAISE EXCEPTION 'Admin user not found: test.admin.final@example.com';
  END IF;

  -- Get driver user ID for "Test Chauffeur Route"
  SELECT id INTO v_driver_user_id
  FROM auth.users
  WHERE email = 'test.chauffeur.route@example.com'
  LIMIT 1;

  IF v_driver_user_id IS NULL THEN
    RAISE EXCEPTION 'Driver user not found: test.chauffeur.route@example.com';
  END IF;

  -- Update driver with admin_user_id
  UPDATE drivers
  SET admin_user_id = v_admin_user_id
  WHERE user_id = v_driver_user_id
  AND name = 'Test Chauffeur Route';

  RAISE NOTICE 'Updated driver with admin_user_id: %', v_admin_user_id;

  -- Get driver ID for "Test Chauffeur Route"
  SELECT id INTO v_test_driver_id
  FROM drivers
  WHERE user_id = v_driver_user_id
  AND name = 'Test Chauffeur Route'
  LIMIT 1;

  IF v_test_driver_id IS NULL THEN
    RAISE WARNING 'Driver "Test Chauffeur Route" not found in drivers table';
  END IF;

  -- Get the route ID for "Route 18-12-2025"
  SELECT id INTO v_route_id
  FROM routes
  WHERE name = 'Route 18-12-2025'
  AND date = '2025-12-17'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_route_id IS NOT NULL AND v_test_driver_id IS NOT NULL THEN
    -- Assign route to "Test Chauffeur Route"
    UPDATE routes
    SET driver_id = v_test_driver_id,
        route_status = 'planned'
    WHERE id = v_route_id;

    RAISE NOTICE 'Assigned route % to driver %', v_route_id, v_test_driver_id;

    -- Also assign a vehicle to "Test Chauffeur Route" so it appears in dropdown
    -- Get first vehicle for this admin
    SELECT id INTO v_vehicle_id
    FROM vehicles
    WHERE user_id = v_admin_user_id
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_vehicle_id IS NOT NULL THEN
      -- Update vehicle to use "Test Chauffeur Route" as driver
      UPDATE vehicles
      SET driver = v_test_driver_id
      WHERE id = v_vehicle_id;

      RAISE NOTICE 'Assigned vehicle % to driver %', v_vehicle_id, v_test_driver_id;
    ELSE
      RAISE WARNING 'No vehicles found for admin user';
    END IF;
  ELSE
    IF v_route_id IS NULL THEN
      RAISE WARNING 'Route "Route 18-12-2025" not found';
    END IF;
  END IF;

END $$;

-- Verify the changes
SELECT 
  d.name as driver_name,
  d.email as driver_email,
  d.admin_user_id,
  r.name as route_name,
  r.driver_id,
  r.route_status
FROM drivers d
LEFT JOIN routes r ON r.driver_id = d.id
WHERE d.email = 'test.chauffeur.route@example.com'
OR d.name = 'Test Chauffeur Route';

