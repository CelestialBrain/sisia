-- Create user_aisis_credentials table
CREATE TABLE IF NOT EXISTS user_aisis_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  encrypted_credentials TEXT NOT NULL,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on user_aisis_credentials
ALTER TABLE user_aisis_credentials ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_aisis_credentials
CREATE POLICY "Users can manage own credentials"
  ON user_aisis_credentials FOR ALL
  USING (auth.uid() = user_id);

-- Add missing columns to scraped_curriculum
ALTER TABLE scraped_curriculum
  ADD COLUMN IF NOT EXISTS program_name TEXT,
  ADD COLUMN IF NOT EXISTS version_year INTEGER,
  ADD COLUMN IF NOT EXISTS version_sem INTEGER,
  ADD COLUMN IF NOT EXISTS course_code TEXT,
  ADD COLUMN IF NOT EXISTS course_title TEXT,
  ADD COLUMN IF NOT EXISTS units NUMERIC,
  ADD COLUMN IF NOT EXISTS year_level INTEGER,
  ADD COLUMN IF NOT EXISTS semester INTEGER;