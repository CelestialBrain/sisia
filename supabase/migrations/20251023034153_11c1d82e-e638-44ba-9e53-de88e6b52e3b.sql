-- Add course field to users table
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS course TEXT;
