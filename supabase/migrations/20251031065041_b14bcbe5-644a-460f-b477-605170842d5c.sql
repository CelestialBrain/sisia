-- Add import_source column to track original import dataset
ALTER TABLE public.aisis_schedules 
ADD COLUMN import_source text;

-- Create index for filtering by import source
CREATE INDEX idx_aisis_schedules_import_source ON public.aisis_schedules(import_source);

-- Add comment
COMMENT ON COLUMN public.aisis_schedules.import_source IS 'Original import department/source (e.g., "BIOLOGY" or "ALL INTERDISCIPLINARY ELECTIVES")';
