-- Create enum for umbrella status
CREATE TYPE umbrella_status AS ENUM ('available', 'borrowed', 'maintenance');

-- Create enum for borrow status  
CREATE TYPE borrow_status AS ENUM ('active', 'returned', 'overdue');

-- Add new columns with enum types
ALTER TABLE umbrellas 
ADD COLUMN status_enum umbrella_status DEFAULT 'available';

ALTER TABLE borrows
ADD COLUMN status_enum borrow_status DEFAULT 'active';

-- Migrate existing data
UPDATE umbrellas 
SET status_enum = CASE 
  WHEN status = 'available' THEN 'available'::umbrella_status
  WHEN status = 'borrowed' THEN 'borrowed'::umbrella_status
  ELSE 'available'::umbrella_status
END;

UPDATE borrows
SET status_enum = CASE
  WHEN status = 'active' THEN 'active'::borrow_status
  WHEN status = 'returned' THEN 'returned'::borrow_status
  ELSE 'returned'::borrow_status
END;

-- Drop old text columns
ALTER TABLE umbrellas DROP COLUMN status;
ALTER TABLE borrows DROP COLUMN status;

-- Rename enum columns to original names
ALTER TABLE umbrellas RENAME COLUMN status_enum TO status;
ALTER TABLE borrows RENAME COLUMN status_enum TO status;

-- Make status columns non-nullable
ALTER TABLE umbrellas ALTER COLUMN status SET NOT NULL;
ALTER TABLE borrows ALTER COLUMN status SET NOT NULL;

-- Add simple umbrella identifier column
ALTER TABLE umbrellas ADD COLUMN umbrella_code TEXT;

-- Create function to generate umbrella codes
CREATE OR REPLACE FUNCTION generate_umbrella_code()
RETURNS TRIGGER AS $$
DECLARE
  next_num INTEGER;
BEGIN
  -- Get the next number by counting existing umbrellas
  SELECT COUNT(*) + 1 INTO next_num FROM umbrellas;
  NEW.umbrella_code := 'u' || next_num;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for auto-generating umbrella codes
CREATE TRIGGER set_umbrella_code
BEFORE INSERT ON umbrellas
FOR EACH ROW
WHEN (NEW.umbrella_code IS NULL)
EXECUTE FUNCTION generate_umbrella_code();

-- Update existing umbrellas with codes
DO $$
DECLARE
  umbrella_record RECORD;
  counter INTEGER := 1;
BEGIN
  FOR umbrella_record IN 
    SELECT id FROM umbrellas ORDER BY created_at
  LOOP
    UPDATE umbrellas 
    SET umbrella_code = 'u' || counter 
    WHERE id = umbrella_record.id;
    counter := counter + 1;
  END LOOP;
END $$;

-- Make umbrella_code unique and non-nullable
ALTER TABLE umbrellas ALTER COLUMN umbrella_code SET NOT NULL;
ALTER TABLE umbrellas ADD CONSTRAINT unique_umbrella_code UNIQUE (umbrella_code);

-- Update QR code format to be app-specific
-- Format: HIRAMIN-{umbrella_code}-{random_hash}
UPDATE umbrellas 
SET qr_code = 'HIRAMIN-' || umbrella_code || '-' || substr(md5(random()::text), 1, 8);
