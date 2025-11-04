-- Fix the program code for BS Management Engineering from BS MGT to BS ME
UPDATE programs 
SET code = 'BS ME'
WHERE name = 'BS Management Engineering' 
  AND code = 'BS MGT'
  AND school_id = (SELECT id FROM schools WHERE code = 'JGSOM');
