-- Add theme customization columns to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS theme_color_mode TEXT DEFAULT 'preset',
ADD COLUMN IF NOT EXISTS theme_color_hue INTEGER DEFAULT 221,
ADD COLUMN IF NOT EXISTS theme_color_saturation INTEGER DEFAULT 83,
ADD COLUMN IF NOT EXISTS theme_color_lightness INTEGER DEFAULT 53;

-- Add check constraints for valid values
ALTER TABLE profiles 
ADD CONSTRAINT theme_color_mode_check 
CHECK (theme_color_mode IN ('preset', 'rgb', 'custom'));

ALTER TABLE profiles
ADD CONSTRAINT theme_color_hue_check 
CHECK (theme_color_hue >= 0 AND theme_color_hue <= 360);

ALTER TABLE profiles
ADD CONSTRAINT theme_color_saturation_check 
CHECK (theme_color_saturation >= 0 AND theme_color_saturation <= 100);

ALTER TABLE profiles
ADD CONSTRAINT theme_color_lightness_check 
CHECK (theme_color_lightness >= 0 AND theme_color_lightness <= 100);
