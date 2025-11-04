-- Add location_id column to borrows table
ALTER TABLE public.borrows 
  ADD COLUMN location_id UUID REFERENCES public.locations(location_id);

-- Create index for better query performance
CREATE INDEX idx_borrows_location_id ON public.borrows(location_id);
