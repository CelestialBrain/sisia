-- Allow unauthenticated users to lookup their own account by student_id for login
CREATE POLICY "Anyone can lookup users by student_id for login"
ON public.users
FOR SELECT
USING (true);

-- Allow unauthenticated users to lookup emails for login
CREATE POLICY "Anyone can lookup emails for login"
ON public.emails
FOR SELECT
USING (true);
