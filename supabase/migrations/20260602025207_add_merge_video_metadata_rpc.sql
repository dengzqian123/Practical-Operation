/*
  # Add merge_video_metadata RPC

  Creates a helper function that merges a JSON patch into the videos.metadata column
  without overwriting existing keys. This prevents task_id/provider/dashscope_region
  from being erased when a timeout error is appended on failure.

  1. New Functions
    - `merge_video_metadata(vid uuid, patch jsonb)` — merges patch into videos.metadata for the given id
  2. Security
    - SECURITY DEFINER so it runs with owner privileges
    - Only updates the row matching the provided uuid
*/

CREATE OR REPLACE FUNCTION merge_video_metadata(vid uuid, patch jsonb)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE videos
  SET metadata = COALESCE(metadata, '{}'::jsonb) || patch
  WHERE id = vid;
$$;
