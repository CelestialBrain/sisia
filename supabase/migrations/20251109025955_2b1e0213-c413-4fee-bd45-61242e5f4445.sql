-- Add unique constraint for AISIS credentials to enable upsert
ALTER TABLE user_aisis_credentials
ADD CONSTRAINT user_aisis_credentials_user_id_key UNIQUE (user_id);

-- Add indexes for improved query performance
CREATE INDEX IF NOT EXISTS import_jobs_idempotency_key_idx ON import_jobs(idempotency_key);
CREATE INDEX IF NOT EXISTS import_jobs_job_type_idx ON import_jobs(job_type);
CREATE INDEX IF NOT EXISTS import_jobs_status_idx ON import_jobs(status);
CREATE INDEX IF NOT EXISTS function_logs_function_name_idx ON function_logs(function_name);
CREATE INDEX IF NOT EXISTS function_logs_import_job_id_idx ON function_logs(import_job_id);