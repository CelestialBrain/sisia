-- Phase 1: Migrate existing user_programs data to program_enrollments
-- This ensures backward compatibility and consolidates data

-- Insert records from user_programs that don't already exist in program_enrollments
INSERT INTO program_enrollments (user_id, program_id, curriculum_version_id, start_term, status, notes, created_at)
SELECT 
  up.user_id,
  up.program_id,
  up.curriculum_version_id,
  -- Convert entry_year (e.g., "2024-2025") to start_term (e.g., "2024-1")
  CONCAT(SPLIT_PART(up.entry_year, '-', 1), '-1') as start_term,
  'active' as status,
  'Migrated from user_programs' as notes,
  up.created_at
FROM user_programs up
WHERE NOT EXISTS (
  SELECT 1 FROM program_enrollments pe
  WHERE pe.user_id = up.user_id 
    AND pe.program_id = up.program_id
    AND pe.status = 'active'
)
ON CONFLICT DO NOTHING;

-- Add comment to user_programs table marking it as deprecated
COMMENT ON TABLE user_programs IS 'DEPRECATED: Use program_enrollments table instead. This table is kept for backward compatibility only.';
