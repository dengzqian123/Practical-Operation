/*
  # Add user_api_keys table

  1. New Tables
    - `user_api_keys`
      - `id` (uuid, PK)
      - `user_id` (uuid, FK to profiles)
      - `provider` (text) - e.g. 'volcengine', 'aliyun', 'baidu', 'tencent', 'zhipu', 'openai'
      - `label` (text) - user-defined nickname for this key
      - `api_key_hint` (text) - last 4 chars shown in UI, never full key stored here
      - `is_active` (bool)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  Note: The actual secret key is stored in the browser's localStorage only (never server-side).
  This table tracks which providers the user has configured and metadata about them.

  2. Security
    - Enable RLS
    - Users can only read/write their own keys
*/

CREATE TABLE IF NOT EXISTS user_api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT '',
  label text NOT NULL DEFAULT '',
  api_key_hint text NOT NULL DEFAULT '',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, provider)
);

ALTER TABLE user_api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own api keys"
  ON user_api_keys FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own api keys"
  ON user_api_keys FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own api keys"
  ON user_api_keys FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own api keys"
  ON user_api_keys FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS user_api_keys_user_id_idx ON user_api_keys(user_id);
