-- Add import_job_id to scraped tables for tracking
ALTER TABLE scraped_curriculum 
ADD COLUMN IF NOT EXISTS import_job_id UUID REFERENCES import_jobs(id) ON DELETE CASCADE;

ALTER TABLE scraped_my_schedule 
ADD COLUMN IF NOT EXISTS import_job_id UUID REFERENCES import_jobs(id) ON DELETE CASCADE;

ALTER TABLE scraped_my_program
ADD COLUMN IF NOT EXISTS import_job_id UUID REFERENCES import_jobs(id) ON DELETE CASCADE;

ALTER TABLE scraped_my_grades
ADD COLUMN IF NOT EXISTS import_job_id UUID REFERENCES import_jobs(id) ON DELETE CASCADE;

ALTER TABLE scraped_account_info
ADD COLUMN IF NOT EXISTS import_job_id UUID REFERENCES import_jobs(id) ON DELETE CASCADE;

ALTER TABLE scraped_hold_orders
ADD COLUMN IF NOT EXISTS import_job_id UUID REFERENCES import_jobs(id) ON DELETE CASCADE;

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_scraped_curriculum_import_job ON scraped_curriculum(import_job_id);
CREATE INDEX IF NOT EXISTS idx_scraped_my_schedule_import_job ON scraped_my_schedule(import_job_id);
CREATE INDEX IF NOT EXISTS idx_scraped_my_program_import_job ON scraped_my_program(import_job_id);
CREATE INDEX IF NOT EXISTS idx_scraped_my_grades_import_job ON scraped_my_grades(import_job_id);
CREATE INDEX IF NOT EXISTS idx_scraped_account_info_import_job ON scraped_account_info(import_job_id);
CREATE INDEX IF NOT EXISTS idx_scraped_hold_orders_import_job ON scraped_hold_orders(import_job_id);