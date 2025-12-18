-- ============================================
-- Verificatie en toevoeging route_status kolom
-- Voer dit uit in Supabase SQL Editor als je niet zeker weet of de kolom bestaat
-- ============================================

-- Check of route_status kolom bestaat en voeg toe als deze niet bestaat
DO $$ 
BEGIN
    -- Check of de kolom al bestaat
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'routes' 
        AND column_name = 'route_status'
        AND table_schema = 'public'
    ) THEN
        -- Voeg de kolom toe
        ALTER TABLE routes 
        ADD COLUMN route_status TEXT DEFAULT 'planned' 
        CHECK (route_status IN ('planned', 'started', 'completed', 'cancelled'));
        
        -- Maak een index voor betere performance
        CREATE INDEX IF NOT EXISTS idx_routes_status ON routes(route_status);
        
        -- Zet default waarde voor bestaande routes
        UPDATE routes SET route_status = 'planned' WHERE route_status IS NULL;
        
        RAISE NOTICE 'route_status kolom is toegevoegd aan routes tabel';
    ELSE
        RAISE NOTICE 'route_status kolom bestaat al in routes tabel';
    END IF;
END $$;

-- Verificatie: Toon alle mogelijke route_status waarden
SELECT DISTINCT route_status, COUNT(*) as aantal
FROM routes
GROUP BY route_status
ORDER BY route_status;











