-- Add missing columns to import_jobs
ALTER TABLE import_jobs
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS partial_data JSONB;

-- Create curriculum_downloads table
CREATE TABLE IF NOT EXISTS curriculum_downloads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  program_code TEXT NOT NULL,
  version_label TEXT,
  download_data JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE curriculum_downloads ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can manage own downloads"
  ON curriculum_downloads FOR ALL
  USING (auth.uid() = user_id);