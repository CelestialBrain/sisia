-- Add import_job_id column to function_logs for better log tracking
ALTER TABLE function_logs
ADD COLUMN import_job_id uuid REFERENCES import_jobs(id) ON DELETE CASCADE;

-- Add index for efficient queries
CREATE INDEX idx_function_logs_import_job_id ON function_logs(import_job_id);
