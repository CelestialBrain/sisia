-- Clean up duplicate AB ChNS curriculum versions from 2018
-- This migration deletes 3 duplicate curriculum versions and their associated data

-- Step 1: Delete requirement_rules associated with the duplicate curriculum versions
DELETE FROM requirement_rules
WHERE req_group_id IN (
  SELECT id FROM requirement_groups
  WHERE curriculum_id IN (
    'c6c5faef-f27b-4305-b882-e4e091f78ea7',
    '753ede72-01cb-4f37-9765-16e7088e3ac6',
    '7038db97-48b1-464a-a5ba-4c66e2fadb83'
  )
);

-- Step 2: Delete requirement_groups associated with the duplicate curriculum versions
DELETE FROM requirement_groups
WHERE curriculum_id IN (
  'c6c5faef-f27b-4305-b882-e4e091f78ea7',
  '753ede72-01cb-4f37-9765-16e7088e3ac6',
  '7038db97-48b1-464a-a5ba-4c66e2fadb83'
);

-- Step 3: Delete the duplicate curriculum versions
-- (These were created 2-3 minutes after the originals during duplicate imports)
DELETE FROM curriculum_versions
WHERE id IN (
  'c6c5faef-f27b-4305-b882-e4e091f78ea7',  -- Business Track 2018 duplicate
  '753ede72-01cb-4f37-9765-16e7088e3ac6',  -- H Track 2018 duplicate
  '7038db97-48b1-464a-a5ba-4c66e2fadb83'   -- Science Track 2018 duplicate
);
