-- Fix the RLS policy for users table to allow querying by student_id
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;

-- Allow anyone to view user profiles (needed for the honesty system login)
CREATE POLICY "Anyone can view users"
ON public.users
FOR SELECT
USING (true);

-- Keep the insert policy as is
DROP POLICY IF EXISTS "Users can create own profile" ON public.users;

CREATE POLICY "Users can create own profile"
ON public.users
FOR INSERT
WITH CHECK (true);
