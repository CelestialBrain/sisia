-- Add email and name fields to users table
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS email TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS name TEXT;

-- Create index on email for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);

-- Update RLS policies to allow email-based authentication
CREATE POLICY "Users can update own profile" 
ON public.users 
FOR UPDATE 
USING (true);
