-- Allow multiple curriculum revisions per program/track/year/sem by including version_seq in uniqueness constraint
DROP INDEX IF EXISTS unique_curriculum_version;

CREATE UNIQUE INDEX unique_curriculum_version
ON public.curriculum_versions (
  program_id,
  COALESCE(track_id, '00000000-0000-0000-0000-000000000000'::uuid),
  version_year,
  version_sem,
  version_seq
);
