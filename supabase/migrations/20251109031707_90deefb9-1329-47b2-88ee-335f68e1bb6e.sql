-- ============================================
-- COMPREHENSIVE FIX: Reset schools, fix program enrollments schema, add logging
-- ============================================

-- 1. Delete all existing curriculum data and schools
DELETE FROM requirement_rules;
DELETE FROM requirement_groups;
DELETE FROM curriculum_versions;
DELETE FROM program_tracks;
DELETE FROM programs;
DELETE FROM courses;
DELETE FROM schools;

-- 2. Create the 5 official schools
INSERT INTO schools (code, name) VALUES
  ('SOH', 'School of Humanities'),
  ('JGSOM', 'John Gokongwei School of Management'),
  ('SOSE', 'School of Science and Engineering'),
  ('SOSS', 'Dr. Rosita G. Leong School of Social Sciences'),
  ('GBSEALD', 'Gokongwei Brothers School of Education and Learning Design');

-- 3. Fix program_enrollments schema - remove start_term/end_term, add separate fields
ALTER TABLE program_enrollments 
  DROP COLUMN IF EXISTS start_term,
  DROP COLUMN IF EXISTS end_term,
  ADD COLUMN IF NOT EXISTS start_term_year INTEGER,
  ADD COLUMN IF NOT EXISTS start_term_month INTEGER,
  ADD COLUMN IF NOT EXISTS end_term_year INTEGER,
  ADD COLUMN IF NOT EXISTS end_term_month INTEGER;

-- 4. Add indexes for better logging query performance
CREATE INDEX IF NOT EXISTS idx_function_logs_function_name ON function_logs(function_name);
CREATE INDEX IF NOT EXISTS idx_function_logs_level ON function_logs(level);
CREATE INDEX IF NOT EXISTS idx_function_logs_created_at ON function_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_import_jobs_user_id ON import_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_import_jobs_status ON import_jobs(status);

-- 5. Add a client_logs table for comprehensive frontend logging
CREATE TABLE IF NOT EXISTS client_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id),
  user_type TEXT NOT NULL, -- 'guest', 'authenticated', 'unknown'
  level TEXT NOT NULL, -- 'info', 'warn', 'error', 'debug'
  category TEXT NOT NULL,
  message TEXT NOT NULL,
  details JSONB,
  page_url TEXT,
  user_agent TEXT,
  app_version TEXT,
  build_time TEXT
);

-- Enable RLS on client_logs
ALTER TABLE client_logs ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert logs
CREATE POLICY "Anyone can insert client logs"
  ON client_logs FOR INSERT
  WITH CHECK (true);

-- Users can view own logs, admins can view all
CREATE POLICY "Users can view own logs"
  ON client_logs FOR SELECT
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'));

-- Add index for efficient log queries
CREATE INDEX IF NOT EXISTS idx_client_logs_user_id ON client_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_client_logs_created_at ON client_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_client_logs_level ON client_logs(level);
CREATE INDEX IF NOT EXISTS idx_client_logs_category ON client_logs(category);