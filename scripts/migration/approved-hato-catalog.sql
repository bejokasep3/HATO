BEGIN;

DO $$
BEGIN
  IF (SELECT COUNT(*) FROM products WHERE is_active) <> 8 OR
     (SELECT COUNT(DISTINCT name) FROM products WHERE is_active) <> 8 OR
     EXISTS (
       SELECT 1 FROM products WHERE is_active AND NOT (
         (name IN ('Ayam Recah', 'Ayam Karkas', 'Ayam Gebrus', 'Ceker ayam', 'Kepala ayam', 'Ati Ampela') AND unit = 'kg') OR
         (name IN ('Tahu Kuning', 'Tahu Putih') AND unit = 'bungkus')
       )
     ) THEN
    RAISE EXCEPTION 'Catalog differs from the eight products approved on 13 October 2026; review mapping again';
  END IF;
END $$;

UPDATE products SET
  target_group = CASE
    WHEN name IN ('Ayam Recah', 'Ayam Karkas', 'Ayam Gebrus') THEN 'AYAM'::"TargetGroup"
    WHEN name IN ('Tahu Kuning', 'Tahu Putih') THEN 'TAHU'::"TargetGroup"
    ELSE 'NONE'::"TargetGroup"
  END,
  quantity_scale = CASE WHEN unit = 'kg' THEN 2 ELSE 0 END
WHERE is_active;

COMMIT;
