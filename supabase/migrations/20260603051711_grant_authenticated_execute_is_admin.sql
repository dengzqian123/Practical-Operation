/*
  # Restore EXECUTE on is_admin() for authenticated role

  Problem: After revoking PUBLIC EXECUTE, the RLS policies on user_api_keys
  that call is_admin() started failing with "permission denied for function is_admin"
  because PostgreSQL requires the calling role to have EXECUTE even for
  SECURITY INVOKER functions used inside RLS policies.

  Fix: Grant EXECUTE back to authenticated. Since the function is now
  SECURITY INVOKER (not DEFINER), it runs as the calling user and can only
  ever return data the caller already has access to — there is no privilege
  escalation risk. The REST endpoint /rpc/is_admin will simply return true/false
  for the calling user's own admin status, which is harmless.

  anon stays revoked — unauthenticated users have no business calling this.
*/

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
