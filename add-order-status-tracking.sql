-- ============================================
-- RouteNu Order Status Tracking Setup
-- Voer dit script uit in Supabase SQL Editor
-- Dit voegt functionaliteit toe om te zien of een opdracht voltooid is
-- ============================================

-- ============================================
-- FUNCTION: Check if order is completed
-- Kijkt in route_stop_details of er een completed_at timestamp is
-- voor een stop die overeenkomt met dit order
-- ============================================
CREATE OR REPLACE FUNCTION is_order_completed(order_id_param UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM route_stop_details rsd
    INNER JOIN routes r ON rsd.route_id = r.id
    WHERE rsd.stop_id = order_id_param::TEXT
      AND rsd.completed_at IS NOT NULL
  );
END;
$$;

-- ============================================
-- FUNCTION: Get order completion details
-- Haalt de completion timestamp en route info op voor een order
-- ============================================
CREATE OR REPLACE FUNCTION get_order_completion_info(order_id_param UUID)
RETURNS TABLE (
  is_completed BOOLEAN,
  completed_at TIMESTAMP WITH TIME ZONE,
  route_id UUID,
  route_name TEXT,
  route_date DATE,
  work_description TEXT,
  amount_received DECIMAL(10,2),
  parts_cost DECIMAL(10,2)
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    rsd.completed_at IS NOT NULL as is_completed,
    rsd.completed_at,
    r.id as route_id,
    r.name as route_name,
    r.date as route_date,
    rsd.work_description,
    rsd.amount_received,
    rsd.parts_cost
  FROM route_stop_details rsd
  INNER JOIN routes r ON rsd.route_id = r.id
  WHERE rsd.stop_id = order_id_param::TEXT
    AND rsd.completed_at IS NOT NULL
  ORDER BY rsd.completed_at DESC
  LIMIT 1;
END;
$$;

-- ============================================
-- VIEW: Orders with completion status
-- Maakt een view die orders combineert met completion status
-- ============================================
CREATE OR REPLACE VIEW orders_with_status AS
SELECT 
  o.*,
  is_order_completed(o.id) as is_completed,
  (
    SELECT rsd.completed_at
    FROM route_stop_details rsd
    WHERE rsd.stop_id = o.id::TEXT
      AND rsd.completed_at IS NOT NULL
    ORDER BY rsd.completed_at DESC
    LIMIT 1
  ) as completed_at,
  (
    SELECT r.id
    FROM route_stop_details rsd
    INNER JOIN routes r ON rsd.route_id = r.id
    WHERE rsd.stop_id = o.id::TEXT
      AND rsd.completed_at IS NOT NULL
    ORDER BY rsd.completed_at DESC
    LIMIT 1
  ) as completed_in_route_id,
  (
    SELECT r.name
    FROM route_stop_details rsd
    INNER JOIN routes r ON rsd.route_id = r.id
    WHERE rsd.stop_id = o.id::TEXT
      AND rsd.completed_at IS NOT NULL
    ORDER BY rsd.completed_at DESC
    LIMIT 1
  ) as completed_in_route_name
FROM orders o;

-- ============================================
-- RLS voor de view
-- ============================================
-- De view gebruikt de onderliggende orders tabel, dus RLS van orders blijft gelden

-- Grant permissions
GRANT SELECT ON orders_with_status TO authenticated;

-- ============================================
-- INDEX voor betere performance
-- ============================================
CREATE INDEX IF NOT EXISTS idx_route_stop_details_stop_id ON route_stop_details(stop_id);
CREATE INDEX IF NOT EXISTS idx_route_stop_details_completed_at ON route_stop_details(completed_at) WHERE completed_at IS NOT NULL;

