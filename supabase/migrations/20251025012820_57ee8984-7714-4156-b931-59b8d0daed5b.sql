-- Drop all tables in the public schema
DROP TABLE IF EXISTS public.borrows CASCADE;
DROP TABLE IF EXISTS public.emails CASCADE;
DROP TABLE IF EXISTS public.user_roles CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;
DROP TABLE IF EXISTS public.umbrellas CASCADE;
DROP TABLE IF EXISTS public.locations CASCADE;
DROP TABLE IF EXISTS public.courses CASCADE;

-- Drop functions
DROP FUNCTION IF EXISTS public.generate_umbrella_code() CASCADE;
DROP FUNCTION IF EXISTS public.has_role(uuid, app_role) CASCADE;
DROP FUNCTION IF EXISTS public.update_updated_at_column() CASCADE;

-- Drop custom types
DROP TYPE IF EXISTS public.app_role CASCADE;
DROP TYPE IF EXISTS public.borrow_status CASCADE;
DROP TYPE IF EXISTS public.umbrella_status CASCADE;
