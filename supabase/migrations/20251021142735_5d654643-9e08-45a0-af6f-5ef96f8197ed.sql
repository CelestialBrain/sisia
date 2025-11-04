-- Add missing RLS policy for updating umbrellas
CREATE POLICY "Anyone can update umbrellas" 
ON public.umbrellas 
FOR UPDATE 
USING (true);

-- Add missing RLS policy for updating borrows  
CREATE POLICY "Anyone can update borrows"
ON public.borrows
FOR UPDATE
USING (true);

-- Create function to update timestamps if it doesn't exist
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Add updated_at column to umbrellas if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'umbrellas' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE public.umbrellas ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now();
  END IF;
END $$;

-- Create trigger for umbrellas timestamps
DROP TRIGGER IF EXISTS update_umbrellas_updated_at ON public.umbrellas;
CREATE TRIGGER update_umbrellas_updated_at
BEFORE UPDATE ON public.umbrellas
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
