/*
  # Revoke public execute on merge_video_metadata

  The previous migration revoked from anon/authenticated by name, but PostgreSQL
  also grants EXECUTE to the PUBLIC pseudo-role by default, which covers all roles.
  Revoking from PUBLIC removes access for anon and authenticated.
  Only postgres and service_role retain access.
*/

REVOKE EXECUTE ON FUNCTION public.merge_video_metadata(uuid, jsonb) FROM PUBLIC;
