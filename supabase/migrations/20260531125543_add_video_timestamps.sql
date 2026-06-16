/*
  # Add timestamp columns to videos table

  1. Changes
    - `started_at` (timestamptz) — when generation was submitted to the provider
    - `completed_at` (timestamptz) — when generation finished (success or failure)

  These enable computing elapsed time and displaying start/end times in the UI.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'videos' AND column_name = 'started_at'
  ) THEN
    ALTER TABLE videos ADD COLUMN started_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'videos' AND column_name = 'completed_at'
  ) THEN
    ALTER TABLE videos ADD COLUMN completed_at timestamptz;
  END IF;
END $$;
