-- Phase 1: Database Schema Enhancements

-- 1.1 Add Term & Grading Basis to user_courses
ALTER TABLE user_courses
  ADD COLUMN IF NOT EXISTS term_code VARCHAR(16),
  ADD COLUMN IF NOT EXISTS grading_basis TEXT DEFAULT 'letter' CHECK (grading_basis IN ('letter', 'pass_fail', 'audit', 'satisfactory')),
  ADD COLUMN IF NOT EXISTS counts_for_qpi BOOLEAN GENERATED ALWAYS AS (grading_basis = 'letter') STORED;

-- Update existing rows to have term_code (derive from school_year + semester)
UPDATE user_courses 
SET term_code = CONCAT(
  school_year, 
  '-', 
  CASE semester 
    WHEN '1st Semester' THEN '1'
    WHEN '2nd Semester' THEN '2'
    WHEN 'Summer' THEN '3'
    ELSE '1'
  END
)
WHERE term_code IS NULL AND school_year IS NOT NULL;

-- 1.2 Create program_enrollments Table (Program Shifting Support)
CREATE TABLE IF NOT EXISTS program_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  program_id UUID NOT NULL REFERENCES programs(id) ON DELETE RESTRICT,
  curriculum_version_id UUID NOT NULL REFERENCES curriculum_versions(id) ON DELETE RESTRICT,
  start_term VARCHAR(16) NOT NULL,
  end_term VARCHAR(16),
  status VARCHAR(10) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended', 'what_if')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, program_id, start_term)
);

-- RLS policies for program_enrollments
ALTER TABLE program_enrollments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own program enrollments" ON program_enrollments;
CREATE POLICY "Users can view their own program enrollments"
  ON program_enrollments FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own program enrollments" ON program_enrollments;
CREATE POLICY "Users can insert their own program enrollments"
  ON program_enrollments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own program enrollments" ON program_enrollments;
CREATE POLICY "Users can update their own program enrollments"
  ON program_enrollments FOR UPDATE
  USING (auth.uid() = user_id);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_program_enrollments_user_status ON program_enrollments(user_id, status);
CREATE INDEX IF NOT EXISTS idx_program_enrollments_term ON program_enrollments(start_term, end_term);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_program_enrollments_updated_at ON program_enrollments;
CREATE TRIGGER update_program_enrollments_updated_at
  BEFORE UPDATE ON program_enrollments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 1.3 Create course_equivalencies Table
CREATE TABLE IF NOT EXISTS course_equivalencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  to_course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  equivalence_type VARCHAR(20) NOT NULL DEFAULT 'full' CHECK (equivalence_type IN ('full', 'partial', 'one_of_many')),
  units_override INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(from_course_id, to_course_id)
);

ALTER TABLE course_equivalencies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Equivalencies are viewable by everyone" ON course_equivalencies;
CREATE POLICY "Equivalencies are viewable by everyone"
  ON course_equivalencies FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Only admins can manage equivalencies" ON course_equivalencies;
CREATE POLICY "Only admins can manage equivalencies"
  ON course_equivalencies FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_equivalencies_from ON course_equivalencies(from_course_id);
CREATE INDEX IF NOT EXISTS idx_equivalencies_to ON course_equivalencies(to_course_id);

-- 1.4 Add Priority to requirement_groups
ALTER TABLE requirement_groups
  ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 100;

-- Set priorities based on group names (Core=10, Major=20, GE=30, Electives=40)
UPDATE requirement_groups 
SET priority = 
  CASE 
    WHEN name ILIKE '%core%' THEN 10
    WHEN name ILIKE '%major%' THEN 20
    WHEN name ILIKE '%ge%' OR name ILIKE '%general education%' THEN 30
    WHEN name ILIKE '%elective%' THEN 40
    ELSE 100
  END
WHERE priority = 100;

-- Phase 5: Migrate existing user_programs to program_enrollments
INSERT INTO program_enrollments (
  user_id, 
  program_id, 
  curriculum_version_id,
  start_term,
  status
)
SELECT 
  user_id,
  program_id,
  curriculum_version_id,
  COALESCE(entry_year, '2024') || '-1' AS start_term,
  'active' AS status
FROM user_programs
WHERE is_primary = true
ON CONFLICT (user_id, program_id, start_term) DO NOTHING;
