-- Add missing column to requirement_rules
ALTER TABLE requirement_rules
  ADD COLUMN IF NOT EXISTS tag_pattern TEXT;