-- Restore the 5 undergraduate schools of Ateneo de Manila University
-- Using deterministic UUIDs based on school codes for consistency

INSERT INTO schools (id, code, name, created_at, updated_at) 
VALUES 
  (
    '10000000-0000-0000-0000-000000000001'::uuid,
    'SOH',
    'School of Humanities',
    now(),
    now()
  ),
  (
    '10000000-0000-0000-0000-000000000002'::uuid,
    'JGSOM',
    'John Gokongwei School of Management',
    now(),
    now()
  ),
  (
    '10000000-0000-0000-0000-000000000003'::uuid,
    'SOSE',
    'School of Science and Engineering',
    now(),
    now()
  ),
  (
    '10000000-0000-0000-0000-000000000004'::uuid,
    'SOSS',
    'School of Social Sciences',
    now(),
    now()
  ),
  (
    '10000000-0000-0000-0000-000000000005'::uuid,
    'GBSEALD',
    'Gokongwei Brothers School of Education and Learning Design',
    now(),
    now()
  )
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  updated_at = now();
