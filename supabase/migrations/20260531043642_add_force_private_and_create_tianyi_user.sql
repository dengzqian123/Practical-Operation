/*
  # Add force_private flag and create tianyi user

  1. Schema Changes
    - `profiles`: add `force_private` boolean column (DEFAULT false)
      - When true, the user's videos are only visible to themselves — no other
        user including admins can see them via RLS

  2. RLS Policy Update
    - `videos` SELECT policy updated: if the video owner has force_private = true,
      only that owner can select those videos (admin bypass is suppressed)

  3. New User
    - Creates auth user tianyi@frameforge.local with password Admin@1234!
    - Sets force_private = true on their profile so all their content is private
*/

-- 1. Add force_private column to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS force_private boolean NOT NULL DEFAULT false;

-- 2. Drop existing videos SELECT policy and replace with privacy-aware version
DROP POLICY IF EXISTS "Video select: own always, admin sees all" ON videos;

CREATE POLICY "Video select: own always, admin sees all except force_private"
  ON videos
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR (
      -- Admin can see videos only if the owner has NOT enabled force_private
      EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
          AND profiles.role = 'admin'
      )
      AND NOT EXISTS (
        SELECT 1 FROM profiles owner_profile
        WHERE owner_profile.id = videos.user_id
          AND owner_profile.force_private = true
      )
    )
  );

-- 3. Create the auth user for tianyi@frameforge.local
DO $$
DECLARE
  new_user_id uuid;
BEGIN
  -- Only insert if not already present
  IF NOT EXISTS (
    SELECT 1 FROM auth.users WHERE email = 'tianyi@frameforge.local'
  ) THEN
    new_user_id := gen_random_uuid();

    INSERT INTO auth.users (
      id,
      instance_id,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      aud,
      role,
      created_at,
      updated_at
    ) VALUES (
      new_user_id,
      '00000000-0000-0000-0000-000000000000',
      'tianyi@frameforge.local',
      crypt('Admin@1234!', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}',
      '{}',
      'authenticated',
      'authenticated',
      now(),
      now()
    );

    -- Profile is created by trigger; update force_private after a moment
    -- Use upsert in case trigger hasn't fired yet
    INSERT INTO profiles (id, force_private)
      VALUES (new_user_id, true)
      ON CONFLICT (id) DO UPDATE SET force_private = true;
  ELSE
    -- User already exists — just ensure force_private is set
    UPDATE profiles
       SET force_private = true
     WHERE id = (SELECT id FROM auth.users WHERE email = 'tianyi@frameforge.local');
  END IF;
END $$;
