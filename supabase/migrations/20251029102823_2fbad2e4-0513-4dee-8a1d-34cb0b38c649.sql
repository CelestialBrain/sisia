-- Re-insert the 5 undergraduate schools
INSERT INTO schools (code, name, created_at, updated_at) VALUES
  ('GBSEALD', 'Gokongwei Brothers School of Education and Learning Design', NOW(), NOW()),
  ('SOH', 'School of Humanities', NOW(), NOW()),
  ('JGSOM', 'John Gokongwei School of Management', NOW(), NOW()),
  ('SOSE', 'School of Science and Engineering', NOW(), NOW()),
  ('SOSS', 'School of Social Sciences', NOW(), NOW())
ON CONFLICT (code) DO UPDATE SET 
  name = EXCLUDED.name,
  updated_at = NOW();

-- Explicitly prevent deletion of schools
-- This is defensive programming - schools are reference data and should never be deleted
CREATE POLICY "Schools cannot be deleted by anyone"
  ON schools
  FOR DELETE
  TO authenticated
  USING (false);

-- Add comment explaining why schools are protected
COMMENT ON TABLE schools IS 'Reference data for Ateneo undergraduate schools. Schools cannot be deleted once created. Use soft-delete patterns if deactivation is needed.';
