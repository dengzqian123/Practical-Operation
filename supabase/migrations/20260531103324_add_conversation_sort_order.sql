/*
  # Add sort_order to conversations

  1. Changes
    - Adds `sort_order` (integer) column to `conversations` table with DEFAULT 0
    - Backfills existing rows: assigns sort_order = 0, 1, 2, … ordered by updated_at DESC
      (most recently updated gets the lowest number = appears first)

  2. Notes
    - Lower sort_order value = displayed first in the sidebar
    - No destructive changes; existing data is preserved
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'conversations' AND column_name = 'sort_order'
  ) THEN
    ALTER TABLE conversations ADD COLUMN sort_order integer NOT NULL DEFAULT 0;
  END IF;
END $$;

-- Backfill: assign sequential order based on updated_at DESC
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY updated_at DESC) - 1 AS rn
  FROM conversations
)
UPDATE conversations
SET sort_order = ranked.rn
FROM ranked
WHERE conversations.id = ranked.id;
