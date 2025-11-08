-- Create migration tracking table
CREATE TABLE IF NOT EXISTS public.scrape_migrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scrape_job_id UUID REFERENCES public.import_jobs(id) ON DELETE CASCADE,
  source_table TEXT NOT NULL,
  source_id UUID NOT NULL,
  target_table TEXT NOT NULL,
  target_id UUID,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'migrated')),
  admin_user_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  migrated_at TIMESTAMPTZ
);

-- Enable RLS
ALTER TABLE public.scrape_migrations ENABLE ROW LEVEL SECURITY;

-- Admins can manage migrations
CREATE POLICY "Admins can manage migrations"
  ON public.scrape_migrations
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Users can view their own migrations
CREATE POLICY "Users can view own migrations"
  ON public.scrape_migrations
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.import_jobs
    WHERE import_jobs.id = scrape_migrations.scrape_job_id
    AND import_jobs.user_id = auth.uid()
  ));

-- Add tracking fields to scraped_curriculum
ALTER TABLE public.scraped_curriculum 
  ADD COLUMN IF NOT EXISTS approved_by_admin UUID,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS migrated_to_curriculum_id UUID REFERENCES public.curriculum_versions(id),
  ADD COLUMN IF NOT EXISTS migration_status TEXT DEFAULT 'pending' CHECK (migration_status IN ('pending', 'approved', 'rejected', 'migrated'));

-- Add tracking fields to scraped_my_schedule
ALTER TABLE public.scraped_my_schedule
  ADD COLUMN IF NOT EXISTS migrated_to_schedule_id UUID,
  ADD COLUMN IF NOT EXISTS migration_status TEXT DEFAULT 'pending' CHECK (migration_status IN ('pending', 'migrated'));

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_scrape_migrations_status ON public.scrape_migrations(status);
CREATE INDEX IF NOT EXISTS idx_scraped_curriculum_migration_status ON public.scraped_curriculum(migration_status);
CREATE INDEX IF NOT EXISTS idx_scraped_my_schedule_migration_status ON public.scraped_my_schedule(migration_status);