-- Part 1: Clean up duplicate curriculum versions and their import job references
-- First, nullify the foreign key reference in import_jobs for the duplicate version
UPDATE import_jobs 
SET created_version_id = NULL 
WHERE created_version_id = 'ad45e3b8-ecd8-4d9d-9117-fdce99d12b2c';

-- Delete requirement rules and groups for the duplicate version
DELETE FROM requirement_rules 
WHERE req_group_id IN (
  SELECT id FROM requirement_groups 
  WHERE curriculum_id = 'ad45e3b8-ecd8-4d9d-9117-fdce99d12b2c'
);

DELETE FROM requirement_groups 
WHERE curriculum_id = 'ad45e3b8-ecd8-4d9d-9117-fdce99d12b2c';

-- Now delete the duplicate curriculum version
DELETE FROM curriculum_versions 
WHERE id = 'ad45e3b8-ecd8-4d9d-9117-fdce99d12b2c';

-- Part 2: Add is_university_wide flag to courses table
ALTER TABLE courses ADD COLUMN IF NOT EXISTS is_university_wide BOOLEAN DEFAULT false;

-- Part 3: Create course_school_usage tracking table
CREATE TABLE IF NOT EXISTS course_school_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  first_seen_at TIMESTAMPTZ DEFAULT now(),
  curriculum_count INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(course_id, school_id)
);

-- Enable RLS on course_school_usage
ALTER TABLE course_school_usage ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for course_school_usage
CREATE POLICY "Course school usage is viewable by everyone"
ON course_school_usage FOR SELECT
USING (true);

CREATE POLICY "Only admins can manage course school usage"
ON course_school_usage FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Part 4: Add unique constraint to curriculum_versions to prevent future duplicates
CREATE UNIQUE INDEX IF NOT EXISTS unique_curriculum_version 
ON curriculum_versions (
  program_id, 
  COALESCE(track_id, '00000000-0000-0000-0000-000000000000'::uuid),
  version_year,
  version_sem
);
