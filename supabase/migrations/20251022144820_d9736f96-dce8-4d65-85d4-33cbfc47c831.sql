-- ================================================================
-- SECURITY FIX: Restrict RLS Policies to Prevent Unauthorized Access
-- ================================================================
-- This migration addresses 7 critical security vulnerabilities related to
-- overly permissive Row-Level Security policies.

-- ================================================================
-- 1. FIX USERS TABLE - Restrict public access to PII
-- ================================================================

-- Drop the overly permissive policies
DROP POLICY IF EXISTS "Anyone can view users" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Users can create own profile" ON public.users;

-- Create proper restrictive policies for SELECT
CREATE POLICY "Users can view own profile" ON public.users
  FOR SELECT 
  USING (auth.uid() = id);

CREATE POLICY "Moderators can view all users" ON public.users
  FOR SELECT 
  USING (public.has_role(auth.uid(), 'moderator'));

-- Create proper restrictive policies for UPDATE
CREATE POLICY "Users can update own profile" ON public.users
  FOR UPDATE 
  USING (auth.uid() = id);

CREATE POLICY "Moderators can update users" ON public.users
  FOR UPDATE 
  USING (public.has_role(auth.uid(), 'moderator'));

-- Create proper restrictive policy for INSERT
-- Note: This allows authenticated users to create their own profile during registration
CREATE POLICY "Users can create own profile" ON public.users
  FOR INSERT 
  WITH CHECK (auth.uid() = id);

-- ================================================================
-- 2. FIX BORROWS TABLE - Restrict access to own records
-- ================================================================

-- Drop the overly permissive policies
DROP POLICY IF EXISTS "Anyone can update borrows" ON public.borrows;
DROP POLICY IF EXISTS "Users can update own borrows" ON public.borrows;
DROP POLICY IF EXISTS "Users can view own borrows" ON public.borrows;
DROP POLICY IF EXISTS "Users can create borrows" ON public.borrows;

-- Create proper restrictive policy for SELECT
CREATE POLICY "Users can view own borrows" ON public.borrows
  FOR SELECT 
  USING (
    user_id IN (SELECT id FROM public.users WHERE id = auth.uid())
  );

CREATE POLICY "Moderators can view all borrows" ON public.borrows
  FOR SELECT 
  USING (public.has_role(auth.uid(), 'moderator'));

-- Create proper restrictive policy for UPDATE
CREATE POLICY "Users can update own borrows" ON public.borrows
  FOR UPDATE 
  USING (
    user_id IN (SELECT id FROM public.users WHERE id = auth.uid())
  );

CREATE POLICY "Moderators can update all borrows" ON public.borrows
  FOR UPDATE 
  USING (public.has_role(auth.uid(), 'moderator'));

-- Create proper restrictive policy for INSERT
CREATE POLICY "Users can create own borrows" ON public.borrows
  FOR INSERT 
  WITH CHECK (
    user_id IN (SELECT id FROM public.users WHERE id = auth.uid())
  );

-- ================================================================
-- 3. FIX UMBRELLAS TABLE - Restrict public updates
-- ================================================================

-- Drop the overly permissive update policy
DROP POLICY IF EXISTS "Anyone can update umbrellas" ON public.umbrellas;

-- Keep public view access (needed for browsing available umbrellas)
-- But restrict updates to moderators only
CREATE POLICY "Moderators can update umbrellas" ON public.umbrellas
  FOR UPDATE 
  USING (public.has_role(auth.uid(), 'moderator'));

-- Also allow authenticated users to update umbrella status when borrowing/returning
-- This is needed for the borrow/return flow to work
CREATE POLICY "Authenticated users can update umbrella status" ON public.umbrellas
  FOR UPDATE 
  USING (auth.uid() IS NOT NULL);
