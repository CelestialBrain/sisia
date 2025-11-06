-- Add missing description column to program_tracks
ALTER TABLE program_tracks 
  ADD COLUMN IF NOT EXISTS description TEXT;

-- Add missing theme and entry_year columns to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS theme_color_mode TEXT DEFAULT 'preset',
  ADD COLUMN IF NOT EXISTS theme_color_hue INTEGER DEFAULT 215,
  ADD COLUMN IF NOT EXISTS theme_color_saturation INTEGER DEFAULT 25,
  ADD COLUMN IF NOT EXISTS theme_color_lightness INTEGER DEFAULT 47,
  ADD COLUMN IF NOT EXISTS entry_year TEXT;

-- Add helpful sample descriptions for existing program tracks
UPDATE program_tracks
SET description = 'Specialization track for ' || track_name
WHERE description IS NULL;