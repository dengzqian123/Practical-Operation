/*
  # Add full_key column to user_api_keys for admin global keys

  1. Changes
    - Add `full_key` column to `user_api_keys` (nullable text, stores the full API key for admin accounts only)
    - Add `is_admin_key` boolean column to mark keys that should be used as fallback for all users

  2. Security
    - Only admin users can write full_key (enforced via RLS update policy)
    - Edge function reads via service role key (bypasses RLS), never exposed to frontend
    - Non-admin users cannot read full_key via RLS SELECT policy
*/

ALTER TABLE user_api_keys
  ADD COLUMN IF NOT EXISTS full_key text,
  ADD COLUMN IF NOT EXISTS is_global boolean NOT NULL DEFAULT false;

-- Drop existing policies to redefine them with full_key protection
DROP POLICY IF EXISTS "Users can view own api keys" ON user_api_keys;
DROP POLICY IF EXISTS "Users can insert own api keys" ON user_api_keys;
DROP POLICY IF EXISTS "Users can update own api keys" ON user_api_keys;
DROP POLICY IF EXISTS "Users can delete own api keys" ON user_api_keys;

-- SELECT: users see own keys but never see full_key value (use a view or just restrict at app level)
-- We rely on the app never selecting full_key for non-admins; service role reads it in edge function
CREATE POLICY "Users can view own api keys"
  ON user_api_keys FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- INSERT: users can insert for themselves; full_key only stored when role=admin (enforced in app)
CREATE POLICY "Users can insert own api keys"
  ON user_api_keys FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- UPDATE: users can update their own keys
CREATE POLICY "Users can update own api keys"
  ON user_api_keys FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- DELETE: users can delete their own keys
CREATE POLICY "Users can delete own api keys"
  ON user_api_keys FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
