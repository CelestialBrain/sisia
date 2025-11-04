-- Safe no-op migration to trigger types regeneration
COMMENT ON TABLE public.users IS 'Users table for Hiramin app';
COMMENT ON TABLE public.umbrellas IS 'Umbrellas inventory with status and location';
COMMENT ON TABLE public.locations IS 'Campus locations of umbrella stations';
COMMENT ON TABLE public.borrows IS 'Borrow transactions linking users and umbrellas';
COMMENT ON TABLE public.user_roles IS 'Role assignments for users';
