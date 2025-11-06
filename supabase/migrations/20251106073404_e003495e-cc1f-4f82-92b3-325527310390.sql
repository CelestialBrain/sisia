-- Add missing columns to schedule_blocks
ALTER TABLE schedule_blocks
  ADD COLUMN IF NOT EXISTS course_title TEXT,
  ADD COLUMN IF NOT EXISTS font_color TEXT,
  ADD COLUMN IF NOT EXISTS font_size TEXT;

-- Add missing columns to schedule_palette_items  
ALTER TABLE schedule_palette_items
  ADD COLUMN IF NOT EXISTS course_title TEXT,
  ADD COLUMN IF NOT EXISTS is_manual BOOLEAN DEFAULT false;

-- Add missing time_pattern column to aisis_schedules
ALTER TABLE aisis_schedules
  ADD COLUMN IF NOT EXISTS time_pattern TEXT;

-- Create user_programs table (appears to be referenced in code but missing)
CREATE TABLE IF NOT EXISTS user_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on user_programs
ALTER TABLE user_programs ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_programs
CREATE POLICY "Users can view own programs"
  ON user_programs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own programs"
  ON user_programs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own programs"
  ON user_programs FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own programs"
  ON user_programs FOR DELETE
  USING (auth.uid() = user_id);