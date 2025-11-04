-- Update umbrella_code to follow u1, u2, u3... format
WITH numbered_umbrellas AS (
  SELECT id, 'u' || ROW_NUMBER() OVER (ORDER BY created_at)::text AS new_code
  FROM umbrellas
)
UPDATE umbrellas
SET umbrella_code = numbered_umbrellas.new_code,
    qr_code = numbered_umbrellas.new_code
FROM numbered_umbrellas
WHERE umbrellas.id = numbered_umbrellas.id;
