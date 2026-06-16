/*
  # Fix merge_video_metadata security issues

  1. Set a fixed search_path to prevent mutable search_path attacks
  2. Revoke EXECUTE from anon and authenticated roles — this function is
     only called from backend logic (GeneratePage via service role context),
     not directly via RPC by end users
*/

CREATE OR REPLACE FUNCTION public.merge_video_metadata(vid uuid, patch jsonb)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE videos
  SET metadata = COALESCE(metadata, '{}'::jsonb) || patch
  WHERE id = vid;
$$;

REVOKE EXECUTE ON FUNCTION public.merge_video_metadata(uuid, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.merge_video_metadata(uuid, jsonb) FROM authenticated;
