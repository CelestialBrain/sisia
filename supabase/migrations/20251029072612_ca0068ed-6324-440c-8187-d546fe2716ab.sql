-- Extend import_jobs table to support schedule imports
-- Add schedule-specific columns to import_jobs
ALTER TABLE import_jobs
ADD COLUMN IF NOT EXISTS term_code TEXT,
ADD COLUMN IF NOT EXISTS department TEXT,
ADD COLUMN IF NOT EXISTS schedules_processed INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_schedules INTEGER;

-- Add indexes for faster duplicate detection and queries
CREATE INDEX IF NOT EXISTS idx_aisis_schedules_lookup 
ON aisis_schedules(term_code, department, subject_code, section) 
WHERE deprecated = false;

CREATE INDEX IF NOT EXISTS idx_import_jobs_idempotency 
ON import_jobs(idempotency_key, job_type) 
WHERE status != 'failed';

CREATE INDEX IF NOT EXISTS idx_import_jobs_schedule_lookup
ON import_jobs(term_code, department, job_type, status)
WHERE job_type = 'schedule_import';
