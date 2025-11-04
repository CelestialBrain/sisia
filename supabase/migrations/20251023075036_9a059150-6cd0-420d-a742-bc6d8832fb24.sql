-- Create courses table
CREATE TABLE public.courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on courses
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;

-- Anyone can view courses
CREATE POLICY "Anyone can view courses"
  ON public.courses
  FOR SELECT
  USING (true);

-- Authenticated users can insert courses
CREATE POLICY "Authenticated users can insert courses"
  ON public.courses
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Create emails table
CREATE TABLE public.emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on emails
ALTER TABLE public.emails ENABLE ROW LEVEL SECURITY;

-- Users can view their own email
CREATE POLICY "Users can view own email"
  ON public.emails
  FOR SELECT
  USING (user_id IN (SELECT users.id FROM users WHERE users.id = auth.uid()));

-- Moderators can view all emails
CREATE POLICY "Moderators can view all emails"
  ON public.emails
  FOR SELECT
  USING (has_role(auth.uid(), 'moderator'::app_role));

-- Users can insert their own email
CREATE POLICY "Users can insert own email"
  ON public.emails
  FOR INSERT
  WITH CHECK (user_id IN (SELECT users.id FROM users WHERE users.id = auth.uid()));

-- Delete all existing data from users table
DELETE FROM public.users;

-- Delete all existing data from borrows table (since it references users)
DELETE FROM public.borrows;

-- Remove email and course columns from users table
ALTER TABLE public.users DROP COLUMN IF EXISTS email;
ALTER TABLE public.users DROP COLUMN IF EXISTS course;

-- Add course_id foreign key to users table
ALTER TABLE public.users ADD COLUMN course_id UUID REFERENCES public.courses(id);

-- Add foreign key constraint for emails table
ALTER TABLE public.emails ADD CONSTRAINT emails_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
