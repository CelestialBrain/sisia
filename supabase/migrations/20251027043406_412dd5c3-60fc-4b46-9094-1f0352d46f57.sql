-- Create import_jobs table with idempotency support
CREATE TABLE import_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  
  -- Job tracking
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  job_type TEXT NOT NULL DEFAULT 'curriculum_import',
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  
  -- Idempotency key (hash of normalized payload)
  idempotency_key TEXT UNIQUE,
  
  -- Timing
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  -- Import metadata
  program_name TEXT,
  program_code TEXT,
  track_code TEXT,
  version_label TEXT,
  total_courses INTEGER,
  courses_processed INTEGER DEFAULT 0,
  
  -- Results
  created_program_id UUID REFERENCES programs(id),
  created_track_id UUID REFERENCES program_tracks(id),
  created_version_id UUID REFERENCES curriculum_versions(id),
  
  -- Error handling
  error_message TEXT,
  error_details JSONB
);

-- RLS policies
ALTER TABLE import_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own import jobs"
  ON import_jobs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own import jobs"
  ON import_jobs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_import_jobs_user ON import_jobs(user_id);
CREATE INDEX idx_import_jobs_status ON import_jobs(status);
CREATE INDEX idx_import_jobs_idempotency ON import_jobs(idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX idx_import_jobs_created ON import_jobs(created_at DESC);

-- Make foreign key constraints DEFERRABLE for requirement tables
ALTER TABLE requirement_rules 
  DROP CONSTRAINT IF EXISTS requirement_rules_req_group_id_fkey;

ALTER TABLE requirement_rules 
  ADD CONSTRAINT requirement_rules_req_group_id_fkey 
  FOREIGN KEY (req_group_id) REFERENCES requirement_groups(id) 
  ON DELETE CASCADE
  DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE requirement_groups 
  DROP CONSTRAINT IF EXISTS requirement_groups_curriculum_id_fkey;

ALTER TABLE requirement_groups 
  ADD CONSTRAINT requirement_groups_curriculum_id_fkey 
  FOREIGN KEY (curriculum_id) REFERENCES curriculum_versions(id) 
  ON DELETE CASCADE
  DEFERRABLE INITIALLY DEFERRED;

-- Add unique constraints for courses
CREATE UNIQUE INDEX IF NOT EXISTS uq_courses_school_code 
  ON courses(school_id, course_code) 
  WHERE school_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_courses_no_school_code 
  ON courses(course_code) 
  WHERE school_id IS NULL;
