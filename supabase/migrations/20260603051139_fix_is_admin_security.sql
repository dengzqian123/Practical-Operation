/*
  # Fix is_admin() security issues

  1. Set search_path = '' to prevent mutable search path exploitation
  2. Revoke EXECUTE from anon and authenticated roles so it cannot be
     called directly via /rest/v1/rpc/is_admin
*/

CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

REVOKE EXECUTE ON FUNCTION is_admin() FROM anon;
REVOKE EXECUTE ON FUNCTION is_admin() FROM authenticated;
