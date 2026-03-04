-- Inventory History Table Setup
-- Slaat alle wijzigingen aan de voorraad op als audit log

CREATE TABLE IF NOT EXISTS inventory_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  inventory_item_id UUID REFERENCES inventory(id) ON DELETE SET NULL,
  item_name TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('toegevoegd', 'bewerkt', 'verwijderd', 'voorraad_verhoogd', 'voorraad_verlaagd', 'bulk_import')),
  changes JSONB DEFAULT '{}',
  old_values JSONB DEFAULT '{}',
  new_values JSONB DEFAULT '{}',
  quantity_before INTEGER,
  quantity_after INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index voor snelle queries op user_id en datum
CREATE INDEX IF NOT EXISTS idx_inventory_history_user_id ON inventory_history(user_id);
CREATE INDEX IF NOT EXISTS idx_inventory_history_created_at ON inventory_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_history_item_id ON inventory_history(inventory_item_id);

-- RLS Policies
ALTER TABLE inventory_history ENABLE ROW LEVEL SECURITY;

-- Users can only see their own history
CREATE POLICY "Users can view own inventory history"
  ON inventory_history FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own history
CREATE POLICY "Users can insert own inventory history"
  ON inventory_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own history (optioneel, voor opschonen)
CREATE POLICY "Users can delete own inventory history"
  ON inventory_history FOR DELETE
  USING (auth.uid() = user_id);

