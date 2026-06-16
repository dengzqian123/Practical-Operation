/*
  # Backfill started_at and completed_at for existing videos

  For videos that completed/failed before this feature was added:
  - completed_at = updated_at (best approximation of finish time)
  - started_at = created_at (we don't have the real submit time, so use creation time)

  Only fills rows where the column is still NULL and status is terminal.
*/

UPDATE videos
SET
  started_at = created_at,
  completed_at = updated_at
WHERE
  status IN ('completed', 'failed')
  AND started_at IS NULL
  AND completed_at IS NULL;
