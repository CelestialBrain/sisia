-- Rename id column to location_id in locations table
ALTER TABLE public.locations 
  RENAME COLUMN id TO location_id;
