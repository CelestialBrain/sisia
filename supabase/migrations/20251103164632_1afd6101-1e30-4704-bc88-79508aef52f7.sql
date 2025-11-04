-- Phase 1: Create User AISIS Credentials Table
CREATE TABLE IF NOT EXISTS user_aisis_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  encrypted_username TEXT NOT NULL,
  encrypted_password TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE user_aisis_credentials ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_aisis_credentials
CREATE POLICY "Users can manage their own credentials"
  ON user_aisis_credentials FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Phase 2: Create Scraped Curriculum Table
CREATE TABLE IF NOT EXISTS scraped_curriculum (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  program_name TEXT NOT NULL,
  program_code TEXT NOT NULL,
  track_code TEXT,
  version_label TEXT NOT NULL,
  year_level INTEGER NOT NULL,
  semester TEXT NOT NULL,
  course_code TEXT NOT NULL,
  course_title TEXT NOT NULL,
  units INTEGER NOT NULL,
  category TEXT NOT NULL,
  prerequisites TEXT[],
  is_placeholder BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  import_job_id UUID REFERENCES import_jobs(id) ON DELETE SET NULL
);

-- Enable RLS
ALTER TABLE scraped_curriculum ENABLE ROW LEVEL SECURITY;

-- RLS Policies for scraped_curriculum
CREATE POLICY "Users can view their own scraped curriculum"
  ON scraped_curriculum FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own scraped curriculum"
  ON scraped_curriculum FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Phase 3: Update Import Jobs Table with new fields
ALTER TABLE import_jobs 
  ADD COLUMN IF NOT EXISTS scrape_mode TEXT,
  ADD COLUMN IF NOT EXISTS pages_scraped INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_pages INTEGER,
  ADD COLUMN IF NOT EXISTS last_scraped_page TEXT;

-- Add trigger to update updated_at for user_aisis_credentials
CREATE TRIGGER update_user_aisis_credentials_updated_at
  BEFORE UPDATE ON user_aisis_credentials
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
