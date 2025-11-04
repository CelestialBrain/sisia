-- Fix search path for umbrella code generation function
DROP TRIGGER IF EXISTS set_umbrella_code ON umbrellas;
DROP FUNCTION IF EXISTS generate_umbrella_code() CASCADE;

CREATE OR REPLACE FUNCTION generate_umbrella_code()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_num INTEGER;
BEGIN
  -- Get the next number by counting existing umbrellas
  SELECT COUNT(*) + 1 INTO next_num FROM umbrellas;
  NEW.umbrella_code := 'u' || next_num;
  RETURN NEW;
END;
$$;

-- Recreate the trigger
CREATE TRIGGER set_umbrella_code
BEFORE INSERT ON umbrellas
FOR EACH ROW
WHEN (NEW.umbrella_code IS NULL)
EXECUTE FUNCTION generate_umbrella_code();
