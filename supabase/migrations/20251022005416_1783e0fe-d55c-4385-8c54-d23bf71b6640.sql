-- Drop all existing policies on user_roles
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Moderators can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Anyone can view user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "Authenticated users can manage roles" ON public.user_roles;

-- Create new simple policy for viewing roles
CREATE POLICY "allow_select_user_roles"
ON public.user_roles
FOR SELECT
USING (true);
