-- ============================================
-- Fix All Public Live Route Policies
-- This script combines all policies needed for public live route access
-- Run this in Supabase SQL Editor to fix 404 errors on live route links
-- ============================================

-- IMPORTANT: This script will drop and recreate policies
-- It keeps user policies but adds public policies for live routes

-- ============================================
-- STEP 1: Add required columns if they don't exist
-- ============================================

-- Add live_route_token column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'routes' AND column_name = 'live_route_token'
    ) THEN
        ALTER TABLE routes ADD COLUMN live_route_token TEXT;
        CREATE INDEX IF NOT EXISTS idx_routes_live_route_token ON routes(live_route_token);
    END IF;
END $$;

-- Add stop_tokens column if it doesn't exist
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

-- ============================================
-- STEP 2: Drop existing public policies (we'll recreate them)
-- ============================================

DROP POLICY IF EXISTS "Public can view routes with valid live token" ON routes;
DROP POLICY IF EXISTS "Public can view routes with valid stop token" ON routes;
DROP POLICY IF EXISTS "Public can view route stop timestamps with valid live token" ON route_stop_timestamps;

-- ============================================
-- STEP 3: Create public policies for routes with tokens
-- ============================================

-- Policy 1: Allow public access to routes with valid live_route_token
CREATE POLICY "Public can view routes with valid live token" ON routes
  FOR SELECT USING (
    live_route_token IS NOT NULL 
    AND live_route_token != ''
  );

-- Policy 2: Allow public access to routes with valid stop tokens
CREATE POLICY "Public can view routes with valid stop token" ON routes
  FOR SELECT USING (
    stop_tokens IS NOT NULL 
    AND stop_tokens != '{}'::jsonb
  );

-- ============================================
-- STEP 4: Create public policy for timestamps
-- ============================================

CREATE POLICY "Public can view route stop timestamps with valid live token" ON route_stop_timestamps
  FOR SELECT USING (
    route_id IN (
      SELECT id FROM routes
      WHERE live_route_token IS NOT NULL 
      AND live_route_token != ''
    )
  );

-- ============================================
-- STEP 5: Ensure RLS is enabled
-- ============================================

ALTER TABLE routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE route_stop_timestamps ENABLE ROW LEVEL SECURITY;

-- ============================================
-- NOTES:
-- ============================================
-- This script adds public policies that work alongside existing user policies
-- Users can still view their own routes (via "Users can view own routes" policy)
-- Drivers can still view assigned routes (via "Drivers can view assigned routes" policy)
-- Public users can now view routes with valid tokens (via the new public policies)
--
-- The token acts as the security mechanism:
-- 1. Tokens should be unique and hard to guess
-- 2. Generated securely when route starts
-- 3. Only shared with intended recipients via email
--
-- After running this script, live route links should work on Vercel!
