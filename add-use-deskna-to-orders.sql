-- ============================================
-- RouteNu "use_deskna" to Orders Migration
-- Voegt de use_deskna kolom toe aan de orders tabel.
-- Deze vlag bepaalt of een stop via de Deskna.nl-huisstijl + het
-- deskna.nl domein wordt afgehandeld (aanmeld-, route-gestart-/tracking-mails).
-- Voer dit script uit in de Supabase SQL Editor.
-- ============================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'orders' AND column_name = 'use_deskna'
    ) THEN
        ALTER TABLE orders ADD COLUMN use_deskna BOOLEAN DEFAULT FALSE;
        COMMENT ON COLUMN orders.use_deskna IS 'Indien true: verstuur aanmeld-/tracking-mails via Deskna.nl huisstijl en domein';
    END IF;
END $$;

-- Bestaande orders zonder waarde op standaard (false) zetten
UPDATE orders
SET use_deskna = FALSE
WHERE use_deskna IS NULL;
