-- Add missing columns
ALTER TABLE course_equivalencies
  ADD COLUMN IF NOT EXISTS units_override NUMERIC;

ALTER TABLE requirement_groups  
  ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 0;