-- Ensure anonymous users can read programs table
-- This is needed for guest users to access public program information

-- Drop existing overly broad policy and replace with specific ones
DROP POLICY IF EXISTS "Programs are viewable by everyone" ON public.programs;

-- Allow authenticated users to view programs
CREATE POLICY "Authenticated users can view programs"
ON public.programs
FOR SELECT
TO authenticated
USING (true);

-- Allow anonymous (guest) users to view programs
CREATE POLICY "Anonymous users can view programs"
ON public.programs
FOR SELECT
TO anon
USING (true);

-- Similarly ensure curriculum_versions and program_tracks are accessible
DROP POLICY IF EXISTS "Curriculum versions are viewable by everyone" ON public.curriculum_versions;

CREATE POLICY "Authenticated users can view curriculum versions"
ON public.curriculum_versions
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Anonymous users can view curriculum versions"
ON public.curriculum_versions
FOR SELECT
TO anon
USING (true);

DROP POLICY IF EXISTS "Tracks are viewable by everyone" ON public.program_tracks;

CREATE POLICY "Authenticated users can view tracks"
ON public.program_tracks
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Anonymous users can view tracks"
ON public.program_tracks
FOR SELECT
TO anon
USING (true);
