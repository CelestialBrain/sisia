-- Add remaining missing columns to scraped_curriculum
ALTER TABLE scraped_curriculum
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS prerequisites TEXT,
  ADD COLUMN IF NOT EXISTS raw_html TEXT;

-- Add control_action column to import_jobs
ALTER TABLE import_jobs
  ADD COLUMN IF NOT EXISTS control_action TEXT;