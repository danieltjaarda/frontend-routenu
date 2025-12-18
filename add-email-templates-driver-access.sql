-- ============================================
-- Allow drivers to read email templates for routes assigned to them
-- Voer dit uit in Supabase SQL Editor
-- ============================================

-- Add policy to allow drivers to read email templates for routes assigned to them
-- This is needed because when a driver starts a route, the system needs to fetch
-- the email template from the route owner (admin), but the driver is logged in
DROP POLICY IF EXISTS "Drivers can view templates for assigned routes" ON email_templates;

CREATE POLICY "Drivers can view templates for assigned routes" ON email_templates
  FOR SELECT USING (
    -- Allow if user owns the template (existing behavior)
    auth.uid() = user_id
    OR
    -- OR allow if user is a driver and has routes assigned that belong to this template owner
    EXISTS (
      SELECT 1 FROM routes r
      INNER JOIN drivers d ON r.driver_id = d.id
      WHERE d.user_id = auth.uid()
      AND r.user_id = email_templates.user_id
    )
  );

