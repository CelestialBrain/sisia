-- Make school_id nullable to allow university-wide courses
ALTER TABLE courses 
ALTER COLUMN school_id DROP NOT NULL;

-- Add index for efficient filtering
CREATE INDEX IF NOT EXISTS idx_courses_school_id ON courses(school_id);

COMMENT ON COLUMN courses.school_id IS 'NULL for university-wide courses (MATH, ENGL, etc.), otherwise school-specific';
