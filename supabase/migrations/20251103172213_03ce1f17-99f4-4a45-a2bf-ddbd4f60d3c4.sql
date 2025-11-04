-- Fix security definer view by recreating without SECURITY DEFINER
DROP VIEW IF EXISTS curriculum_downloads;

CREATE OR REPLACE VIEW curriculum_downloads AS
SELECT 
  user_id,
  import_job_id,
  program_name,
  program_code,
  version_year,
  version_sem,
  COUNT(*) as course_count,
  MAX(scraped_at) as scraped_at,
  jsonb_agg(
    jsonb_build_object(
      'course_code', course_code,
      'course_title', course_title,
      'units', units,
      'year_level', year_level,
      'semester', semester,
      'category', category,
      'prerequisites', prerequisites
    ) ORDER BY year_level, semester, course_code
  ) as courses
FROM scraped_curriculum
GROUP BY user_id, import_job_id, program_name, program_code, version_year, version_sem;
