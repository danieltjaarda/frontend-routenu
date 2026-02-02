-- Add selected_parts column to route_stop_details table
-- This stores the parts selected by the driver with quantities

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'route_stop_details' AND column_name = 'selected_parts'
    ) THEN
        ALTER TABLE route_stop_details ADD COLUMN selected_parts JSONB;
        CREATE INDEX IF NOT EXISTS idx_route_stop_details_selected_parts ON route_stop_details USING GIN (selected_parts);
    END IF;
END $$;

