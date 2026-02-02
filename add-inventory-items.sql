-- Add inventory items to the inventory system
-- This script adds the specified items with their quantities
-- 
-- INSTRUCTIES:
-- 1. Vervang 'YOUR_USER_ID_HERE' hieronder met je eigen user_id
-- 2. Je kunt je user_id vinden in de auth.users tabel of via je applicatie
-- 3. Voer dit script uit in de Supabase SQL Editor
--
-- Als een item al bestaat, wordt de hoeveelheid bijgewerkt naar de nieuwe waarde

-- STAP 1: Vervang deze UUID met je eigen user_id
-- Je kunt je user_id vinden door deze query uit te voeren:
-- SELECT id FROM auth.users WHERE email = 'jouw-email@voorbeeld.nl';
DO $$
DECLARE
  target_user_id UUID := 'YOUR_USER_ID_HERE'::UUID;  -- VERVANG DIT MET JE EIGEN USER_ID
  items RECORD;
  item_data RECORD;
BEGIN
  -- Controleer of user_id is ingesteld
  IF target_user_id = 'YOUR_USER_ID_HERE'::UUID THEN
    RAISE EXCEPTION 'Je moet eerst je user_id instellen! Vervang YOUR_USER_ID_HERE met je eigen user_id.';
  END IF;

  -- Define the items to add
  FOR items IN
    SELECT * FROM (VALUES
      ('V20 accu', 1, 'Accu'),
      ('Voorvork', 5, 'Onderdelen'),
      ('Ketting', 6, 'Onderdelen'),
      ('Remblokken', 50, 'Remmen'),
      ('Logan remmenset LINKS', 20, 'Remmen'),
      ('Logan remmenset RECHTS', 20, 'Remmen'),
      ('H6C display', 14, 'Display'),
      ('Motortandwiel 36T (500W)', 5, 'Motor'),
      ('Trapkrachtsensor', 70, 'Sensor'),
      ('Accurail', 5, 'Onderdelen'),
      ('Verende schokdemper', 5, 'Onderdelen'),
      ('Trapas', 4, 'Onderdelen'),
      ('Mini buitenband', 30, 'Banden'),
      ('Mini binnenband', 60, 'Banden'),
      ('Logan hydraulische rem (voor)', 50, 'Remmen'),
      ('Logan hydraulische rem links/rechts', 100, 'Remmen'),
      ('Rubberen handvatsets', 10, 'Onderdelen'),
      ('V8 accu-laadpoort', 5, 'Accu'),
      ('Accuslot', 10, 'Accu')
    ) AS t(name, quantity, category)
  LOOP
    -- Check if item already exists for this user
    SELECT INTO item_data * FROM inventory 
    WHERE user_id = target_user_id AND name = items.name;
    
    IF item_data IS NULL THEN
      -- Item doesn't exist, insert it
      INSERT INTO inventory (user_id, name, quantity, min_quantity, category)
      VALUES (target_user_id, items.name, items.quantity, 0, items.category);
    ELSE
      -- Item exists, update the quantity to the new value
      UPDATE inventory 
      SET quantity = items.quantity,
          category = items.category,
          updated_at = NOW()
      WHERE id = item_data.id;
    END IF;
  END LOOP;
END $$;

