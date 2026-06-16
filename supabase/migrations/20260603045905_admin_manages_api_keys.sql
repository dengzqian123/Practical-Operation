/*
  # Admin-managed API keys

  ## Summary
  Rework user_api_keys access control so that only admin users can create,
  update, and delete API keys. Regular users retain SELECT on their own rows
  (so GeneratePage can still sync full_key into localStorage for generation).
  Admin users gain full SELECT/INSERT/UPDATE/DELETE on all rows to enable
  the key-assignment flow from the admin panel.

  ## Changes
  1. Drop all existing policies on user_api_keys
  2. Re-create policies:
     - SELECT: own rows for regular users; all rows for admin
     - INSERT: admin only (assigns keys to any user)
     - UPDATE: admin only
     - DELETE: admin only

  ## Helper
  Add a helper function is_admin() to keep policies DRY and avoid
  repeated subqueries.
*/

-- Helper: returns true when the calling user has role='admin'
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- Drop all existing user_api_keys policies
DROP POLICY IF EXISTS "Users can view own api keys" ON user_api_keys;
DROP POLICY IF EXISTS "Users can insert own api keys" ON user_api_keys;
DROP POLICY IF EXISTS "Users can update own api keys" ON user_api_keys;
DROP POLICY IF EXISTS "Users can delete own api keys" ON user_api_keys;

-- SELECT: user sees their own keys; admin sees all
CREATE POLICY "Users can read own api keys"
  ON user_api_keys FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR is_admin());

-- INSERT: admin only — admin sets user_id to the target user
CREATE POLICY "Admin can assign api keys to users"
  ON user_api_keys FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

-- UPDATE: admin only
CREATE POLICY "Admin can update api keys"
  ON user_api_keys FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- DELETE: admin only
CREATE POLICY "Admin can delete api keys"
  ON user_api_keys FOR DELETE
  TO authenticated
  USING (is_admin());

-- Admin also needs to read all profiles to list users in the assignment UI
-- Add a policy only if one for admin-reads-all doesn't exist yet
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'profiles' AND policyname = 'Admin can read all profiles'
  ) THEN
    EXECUTE $p$
      CREATE POLICY "Admin can read all profiles"
        ON profiles FOR SELECT
        TO authenticated
        USING (is_admin() OR auth.uid() = id);
    $p$;
  END IF;
END $$;
