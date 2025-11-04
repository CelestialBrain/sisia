-- Add missing foreign key constraints for data integrity

-- 1. Add FK from courses to schools (if not exists)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'courses_school_id_fkey'
  ) THEN
    ALTER TABLE courses
      ADD CONSTRAINT courses_school_id_fkey 
      FOREIGN KEY (school_id) 
      REFERENCES schools(id) 
      ON DELETE RESTRICT;
  END IF;
END $$;

-- 2. Add course_id column to user_courses for stronger relationship
ALTER TABLE user_courses 
  ADD COLUMN IF NOT EXISTS course_id uuid REFERENCES courses(id) ON DELETE SET NULL;

-- 3. Create index for faster course_id lookups
CREATE INDEX IF NOT EXISTS idx_user_courses_course_id ON user_courses(course_id);

-- 4. Backfill course_id from course_code for existing data
UPDATE user_courses uc
SET course_id = c.id
FROM courses c
WHERE uc.course_code = c.course_code
  AND uc.course_id IS NULL;

-- 5. Add FK from user_programs to programs (should already exist, but ensure cascade)
DO $$ 
BEGIN
  -- Drop old FK if exists
  ALTER TABLE user_programs DROP CONSTRAINT IF EXISTS user_programs_program_id_fkey;
  
  -- Add new FK with proper cascade
  ALTER TABLE user_programs
    ADD CONSTRAINT user_programs_program_id_fkey 
    FOREIGN KEY (program_id) 
    REFERENCES programs(id) 
    ON DELETE CASCADE;
END $$;

-- 6. Add FK from user_programs to curriculum_versions (should exist, but ensure cascade)
DO $$ 
BEGIN
  ALTER TABLE user_programs DROP CONSTRAINT IF EXISTS user_programs_curriculum_version_id_fkey;
  
  ALTER TABLE user_programs
    ADD CONSTRAINT user_programs_curriculum_version_id_fkey 
    FOREIGN KEY (curriculum_version_id) 
    REFERENCES curriculum_versions(id) 
    ON DELETE SET NULL;
END $$;

-- 7. Add FK from curriculum_versions to programs (ensure cascade)
DO $$ 
BEGIN
  ALTER TABLE curriculum_versions DROP CONSTRAINT IF EXISTS curriculum_versions_program_id_fkey;
  
  ALTER TABLE curriculum_versions
    ADD CONSTRAINT curriculum_versions_program_id_fkey 
    FOREIGN KEY (program_id) 
    REFERENCES programs(id) 
    ON DELETE CASCADE;
END $$;

-- 8. Add FK from requirement_groups to curriculum_versions (ensure cascade)
DO $$ 
BEGIN
  ALTER TABLE requirement_groups DROP CONSTRAINT IF EXISTS requirement_groups_curriculum_id_fkey;
  
  ALTER TABLE requirement_groups
    ADD CONSTRAINT requirement_groups_curriculum_id_fkey 
    FOREIGN KEY (curriculum_id) 
    REFERENCES curriculum_versions(id) 
    ON DELETE CASCADE;
END $$;

-- 9. Add FK from requirement_rules to requirement_groups (ensure cascade)
DO $$ 
BEGIN
  ALTER TABLE requirement_rules DROP CONSTRAINT IF EXISTS requirement_rules_req_group_id_fkey;
  
  ALTER TABLE requirement_rules
    ADD CONSTRAINT requirement_rules_req_group_id_fkey 
    FOREIGN KEY (req_group_id) 
    REFERENCES requirement_groups(id) 
    ON DELETE CASCADE;
END $$;

-- 10. Add FK from programs to schools (ensure proper cascade)
DO $$ 
BEGIN
  ALTER TABLE programs DROP CONSTRAINT IF EXISTS programs_school_id_fkey;
  
  ALTER TABLE programs
    ADD CONSTRAINT programs_school_id_fkey 
    FOREIGN KEY (school_id) 
    REFERENCES schools(id) 
    ON DELETE RESTRICT;
END $$;
