-- Add missing columns to user_courses
ALTER TABLE user_courses
  ADD COLUMN IF NOT EXISTS school_year TEXT,
  ADD COLUMN IF NOT EXISTS semester INTEGER,
  ADD COLUMN IF NOT EXISTS qpi_value NUMERIC;

-- Add message_type column to chat_messages
ALTER TABLE chat_messages
  ADD COLUMN IF NOT EXISTS message_type TEXT DEFAULT 'text';

-- Add name column as alias/copy of group_name for backward compatibility
ALTER TABLE requirement_groups
  ADD COLUMN IF NOT EXISTS name TEXT;

-- Copy existing group_name values to name column
UPDATE requirement_groups
SET name = group_name
WHERE name IS NULL AND group_name IS NOT NULL;