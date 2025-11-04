-- Add checkpoint and control fields to import_jobs table for better scraping management
ALTER TABLE public.import_jobs
ADD COLUMN IF NOT EXISTS progress_checkpoint JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS control_action TEXT CHECK (control_action IN ('pause', 'stop', 'resume', NULL)),
ADD COLUMN IF NOT EXISTS paused_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS partial_data JSONB DEFAULT '{}'::jsonb;

-- Add index for better query performance on control_action
CREATE INDEX IF NOT EXISTS idx_import_jobs_control_action ON public.import_jobs(control_action) WHERE control_action IS NOT NULL;

-- Add index for better query performance on status
CREATE INDEX IF NOT EXISTS idx_import_jobs_status ON public.import_jobs(status) WHERE status IN ('processing', 'pending');

COMMENT ON COLUMN public.import_jobs.progress_checkpoint IS 'Stores checkpoint data to resume scraping from last successful point';
COMMENT ON COLUMN public.import_jobs.control_action IS 'User control action: pause, stop, or resume';
COMMENT ON COLUMN public.import_jobs.paused_at IS 'Timestamp when job was paused';
COMMENT ON COLUMN public.import_jobs.partial_data IS 'Stores partial scraped data even if job fails or is stopped';
