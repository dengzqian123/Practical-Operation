/*
  # Fix is_admin() so RLS policies work after PUBLIC EXECUTE was revoked

  Root cause: revoking PUBLIC EXECUTE broke RLS policy evaluation because
  PostgreSQL evaluates SECURITY DEFINER functions under the calling role's
  privileges. The fix is to switch to SECURITY INVOKER — the function then
  runs as the calling user, needs no special grant, and still returns the
  correct result because auth.uid() is always the current session user.
  This also eliminates the SECURITY DEFINER concern entirely.

  Steps:
  1. Re-grant EXECUTE to authenticated and anon so existing policies don't
     break during the window before the replacement is applied.
  2. Replace the function as SECURITY INVOKER with a fixed search_path.
  3. Revoke the explicit grants that are no longer needed (PUBLIC grant was
     already revoked; named grants added in step 1 are cleaned up).
*/

-- Restore grants so policies work immediately
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon;

-- Replace with SECURITY INVOKER — no privilege escalation, no DEFINER risk
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- Remove the named grants — SECURITY INVOKER functions don't need them
-- (PUBLIC was already revoked; these were added above only as a safety net)
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM anon;
