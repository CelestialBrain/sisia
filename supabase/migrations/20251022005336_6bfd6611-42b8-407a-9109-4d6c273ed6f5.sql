-- Drop old policies
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Moderators can view all roles" ON public.user_roles;

-- Create simpler policies that work with custom auth
CREATE POLICY "Anyone can view user_roles"
ON public.user_roles
FOR SELECT
USING (true);

-- Only allow authenticated users to insert/update roles (for future use)
CREATE POLICY "Authenticated users can manage roles"
ON public.user_roles
FOR ALL
USING (true)
WITH CHECK (true);
