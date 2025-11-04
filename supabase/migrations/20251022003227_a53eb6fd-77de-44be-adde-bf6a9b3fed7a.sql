-- Alter locations table for higher GPS precision
ALTER TABLE public.locations 
  ALTER COLUMN latitude TYPE NUMERIC(11, 8),
  ALTER COLUMN longitude TYPE NUMERIC(12, 8);

-- Insert the two existing locations with their GPS coordinates
INSERT INTO public.locations (location_name, latitude, longitude) VALUES
  ('Bellarmine Hall', 14.641579, 121.079359),
  ('Xavier Hall', 14.640056, 121.078474)
ON CONFLICT DO NOTHING;
