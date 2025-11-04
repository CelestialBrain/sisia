-- Backfill import_source for existing schedules based on import jobs
-- Match schedules to their import job using term_code and subject code pattern

-- First, update schedules that match completed import jobs exactly by department
UPDATE public.aisis_schedules AS s
SET import_source = j.department
FROM public.import_jobs AS j
WHERE s.term_code = j.term_code
  AND s.department = j.department
  AND j.job_type = 'schedule_import'
  AND j.status = 'completed'
  AND s.import_source IS NULL;

-- For remaining schedules (from ALL INTERDISCIPLINARY imports), 
-- match by term_code where the job department was "ALL INTERDISCIPLINARY ELECTIVES"
UPDATE public.aisis_schedules AS s
SET import_source = j.department
FROM public.import_jobs AS j
WHERE s.term_code = j.term_code
  AND j.department LIKE 'ALL INTERDISCIPLINARY%'
  AND j.job_type = 'schedule_import'
  AND j.status = 'completed'
  AND s.import_source IS NULL;

-- Set a default import_source for any remaining schedules
UPDATE public.aisis_schedules
SET import_source = department
WHERE import_source IS NULL;
