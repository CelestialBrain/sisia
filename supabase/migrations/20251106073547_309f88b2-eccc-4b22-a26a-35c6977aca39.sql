-- Add missing columns to user_grade_plan_courses
ALTER TABLE user_grade_plan_courses
  ADD COLUMN IF NOT EXISTS grade TEXT,
  ADD COLUMN IF NOT EXISTS year_level INTEGER,
  ADD COLUMN IF NOT EXISTS semester_label TEXT,
  ADD COLUMN IF NOT EXISTS is_from_actual BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS course_id UUID REFERENCES courses(id) ON DELETE SET NULL;

-- Add effective_start column to curriculum_versions
ALTER TABLE curriculum_versions
  ADD COLUMN IF NOT EXISTS effective_start DATE;

-- Create index on course_id for performance
CREATE INDEX IF NOT EXISTS idx_user_grade_plan_courses_course_id 
  ON user_grade_plan_courses(course_id);