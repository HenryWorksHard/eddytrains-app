-- Phase 2 of Pascal customization. Splits "colour" into skin tone
-- (realistic) + accent colour (personality), and adds outfit accessories
-- and selectable base character.
--   pascal_skin: light | medium | tan | dark | deep (face/arms/legs)
--   pascal_outfit: none | cap | headband | sunglasses | beanie
--   pascal_character: classic | robot (renderer to use)
-- All null → app-level defaults (tan / none / classic).

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS pascal_skin TEXT,
  ADD COLUMN IF NOT EXISTS pascal_outfit TEXT,
  ADD COLUMN IF NOT EXISTS pascal_character TEXT;
