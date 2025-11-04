-- Add raw_html column to scraped_curriculum for storing original HTML
ALTER TABLE scraped_curriculum 
ADD COLUMN IF NOT EXISTS raw_html TEXT,
ADD COLUMN IF NOT EXISTS program_code TEXT,
ADD COLUMN IF NOT EXISTS version_year INTEGER,
ADD COLUMN IF NOT EXISTS version_sem INTEGER,
ADD COLUMN IF NOT EXISTS scraped_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Add metadata column to function_logs to store additional context like program info
ALTER TABLE function_logs
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Create index for faster log queries by metadata
CREATE INDEX IF NOT EXISTS idx_function_logs_metadata ON function_logs USING gin(metadata);

-- Add view for curriculum downloads grouped by program
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
