-- Add cohort_year field to profiles table for PE QPI inclusion logic
ALTER TABLE public.profiles
ADD COLUMN cohort_year TEXT;

COMMENT ON COLUMN public.profiles.cohort_year IS 'Entry cohort year (e.g., 2024-2025) to determine if PE courses count in QPI';
