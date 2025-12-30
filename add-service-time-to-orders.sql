-- ============================================
-- RouteNu Service Time to Orders Migration
-- Voeg service_time kolom toe aan orders tabel
-- Voer dit script uit in Supabase SQL Editor
-- ============================================

-- Voeg service_time kolom toe aan orders tabel
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'orders' AND column_name = 'service_time'
    ) THEN
        ALTER TABLE orders ADD COLUMN service_time INTEGER DEFAULT 5;
        COMMENT ON COLUMN orders.service_time IS 'Service tijd in minuten (standaard 5 minuten)';
    END IF;
END $$;

-- Update bestaande orders zonder service_time naar standaard waarde 5
UPDATE orders 
SET service_time = 5 
WHERE service_time IS NULL;

