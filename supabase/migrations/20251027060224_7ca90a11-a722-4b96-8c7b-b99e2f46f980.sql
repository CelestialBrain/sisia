-- Add admin RLS policies for import_jobs
CREATE POLICY "Admins can delete import jobs"
ON import_jobs
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update import jobs"
ON import_jobs
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add admin RLS policy for program_enrollments
CREATE POLICY "Admins can delete any program enrollment"
ON program_enrollments
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Modify import_jobs foreign keys to ON DELETE SET NULL
ALTER TABLE import_jobs DROP CONSTRAINT IF EXISTS import_jobs_created_program_id_fkey;
ALTER TABLE import_jobs ADD CONSTRAINT import_jobs_created_program_id_fkey 
  FOREIGN KEY (created_program_id) REFERENCES programs(id) ON DELETE SET NULL;

ALTER TABLE import_jobs DROP CONSTRAINT IF EXISTS import_jobs_created_track_id_fkey;
ALTER TABLE import_jobs ADD CONSTRAINT import_jobs_created_track_id_fkey 
  FOREIGN KEY (created_track_id) REFERENCES program_tracks(id) ON DELETE SET NULL;

ALTER TABLE import_jobs DROP CONSTRAINT IF EXISTS import_jobs_created_version_id_fkey;
ALTER TABLE import_jobs ADD CONSTRAINT import_jobs_created_version_id_fkey 
  FOREIGN KEY (created_version_id) REFERENCES curriculum_versions(id) ON DELETE SET NULL;
