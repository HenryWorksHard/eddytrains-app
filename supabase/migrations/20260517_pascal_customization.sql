-- Per-user customization for the Pascal mascot.
-- pascal_name: client-chosen display name (e.g. "Rex"). null → fall
--   back to the literal "Pascal" in copy.
-- pascal_color: theme key consumed by the Pascal component. null →
--   yellow default. Allowed values are validated at the app layer
--   (currently: yellow, blue, red, green, purple, orange).

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS pascal_name TEXT,
  ADD COLUMN IF NOT EXISTS pascal_color TEXT;
