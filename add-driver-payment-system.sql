-- ============================================
-- RouteNu Driver Payment System Setup
-- Voegt monteur betaling systeem toe
-- ============================================

-- ============================================
-- route_stop_details: Voeg payment_to_driver veld toe
-- ============================================
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'route_stop_details' AND column_name = 'payment_to_driver'
    ) THEN
        ALTER TABLE route_stop_details ADD COLUMN payment_to_driver BOOLEAN DEFAULT false;
        CREATE INDEX IF NOT EXISTS idx_route_stop_details_payment_to_driver ON route_stop_details(payment_to_driver);
    END IF;
END $$;

-- ============================================
-- drivers: Voeg balance en total_hours velden toe
-- ============================================
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'drivers' AND column_name = 'balance'
    ) THEN
        ALTER TABLE drivers ADD COLUMN balance DECIMAL(10,2) DEFAULT 0.00;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'drivers' AND column_name = 'total_hours'
    ) THEN
        ALTER TABLE drivers ADD COLUMN total_hours DECIMAL(10,2) DEFAULT 0.00;
    END IF;
END $$;

-- ============================================
-- VERIFICATIE
-- ============================================
DO $$
BEGIN
    RAISE NOTICE '✅ Driver payment system setup voltooid!';
    RAISE NOTICE '📊 route_stop_details uitgebreid met payment_to_driver';
    RAISE NOTICE '💰 drivers tabel uitgebreid met balance en total_hours';
END $$;

