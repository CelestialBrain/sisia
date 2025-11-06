-- Phase 1: Create Missing Tables for Grade Planning
CREATE TABLE IF NOT EXISTS user_grade_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  curriculum_version_id UUID REFERENCES curriculum_versions(id) ON DELETE SET NULL,
  plan_name TEXT NOT NULL DEFAULT 'My Grade Plan',
  target_qpi NUMERIC,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_grade_plan_courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES user_grade_plans(id) ON DELETE CASCADE,
  course_code TEXT NOT NULL,
  course_title TEXT,
  units NUMERIC,
  term_year INTEGER NOT NULL,
  term_semester INTEGER NOT NULL,
  expected_grade TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies for Grade Planning Tables
ALTER TABLE user_grade_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_grade_plan_courses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own grade plans"
  ON user_grade_plans FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Users manage own grade plan courses"
  ON user_grade_plan_courses FOR ALL
  USING (EXISTS (
    SELECT 1 FROM user_grade_plans 
    WHERE id = plan_id AND user_id = auth.uid()
  ));

-- Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_user_grade_plans_user ON user_grade_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_user_grade_plans_active ON user_grade_plans(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_grade_plan_courses_plan ON user_grade_plan_courses(plan_id);

-- Phase 2: Add Missing Columns to Existing Tables
ALTER TABLE program_enrollments 
  ADD COLUMN IF NOT EXISTS end_term TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

ALTER TABLE function_logs
  ADD COLUMN IF NOT EXISTS event_type TEXT,
  ADD COLUMN IF NOT EXISTS details TEXT;

ALTER TABLE import_jobs
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS program_name TEXT,
  ADD COLUMN IF NOT EXISTS version_label TEXT,
  ADD COLUMN IF NOT EXISTS schedules_processed INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_schedules INTEGER;

ALTER TABLE curriculum_versions
  ADD COLUMN IF NOT EXISTS version_seq INTEGER DEFAULT 1;

-- Phase 3: Create RPC Function for Cleanup
CREATE OR REPLACE FUNCTION cleanup_stale_import_jobs()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cleaned_count INTEGER;
BEGIN
  UPDATE import_jobs
  SET 
    status = 'failed',
    error_message = 'Job timed out - no activity for 10+ minutes',
    updated_at = NOW()
  WHERE status IN ('processing', 'pending')
    AND updated_at < NOW() - INTERVAL '10 minutes';
  
  GET DIAGNOSTICS cleaned_count = ROW_COUNT;
  
  RETURN cleaned_count;
END;
$$;

GRANT EXECUTE ON FUNCTION cleanup_stale_import_jobs() TO authenticated;

-- Phase 4: Enable Realtime for New Tables
ALTER PUBLICATION supabase_realtime ADD TABLE user_grade_plans;
ALTER PUBLICATION supabase_realtime ADD TABLE user_grade_plan_courses;

-- Phase 5: Seed Initial Data (if empty)
INSERT INTO schools (code, name) 
VALUES ('ADMU', 'Ateneo de Manila University')
ON CONFLICT (code) DO NOTHING;

INSERT INTO programs (code, name, school_id, total_units, description)
SELECT 'BS-CS', 'BS Computer Science', schools.id, 124, 'Bachelor of Science in Computer Science'
FROM schools WHERE code = 'ADMU'
ON CONFLICT DO NOTHING;