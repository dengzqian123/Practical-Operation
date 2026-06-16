/*
  # Revoke public execute on is_admin()

  The previous migration revoked EXECUTE from anon and authenticated by name,
  but PostgreSQL had a blanket EXECUTE grant on PUBLIC which covers both roles.
  This migration revokes that PUBLIC grant so the function cannot be called
  via /rest/v1/rpc/is_admin by anyone outside of RLS policy evaluation.
*/

REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC;
