-- Add password_changed column to profiles
-- Run this in Supabase SQL Editor

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS password_changed BOOLEAN DEFAULT true;

-- Set existing users as already changed (they set their own passwords)
UPDATE profiles SET password_changed = true WHERE password_changed IS NULL;

-- New users created by admin will have password_changed = false
