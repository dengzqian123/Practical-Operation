/*
  # Add role column, fix trigger, set admin role, create user1 and user2

  1. Fixes handle_new_user() trigger
  2. Adds role column to profiles (admin | user, default user)
  3. Sets existing admin profile role to 'admin'
  4. Creates user1 and user2 auth accounts + profiles
*/

-- Fix the broken trigger function
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Add role column
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'user'
  CHECK (role IN ('admin', 'user'));

-- Set admin role on the existing admin account
UPDATE profiles SET role = 'admin'
WHERE username = 'admin';

-- Create user1
DO $$
DECLARE v_id uuid := gen_random_uuid();
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'user1@frameforge.local') THEN
    INSERT INTO auth.users (
      id, instance_id, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      aud, role, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) VALUES (
      v_id, '00000000-0000-0000-0000-000000000000',
      'user1@frameforge.local', crypt('User1@123', gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}', '{"display_name":"User 1"}',
      'authenticated', 'authenticated', now(), now(), '', '', '', ''
    );
    INSERT INTO profiles (id, username, display_name, role, credits)
    VALUES (v_id, 'user1', 'User 1', 'user', 100)
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;

-- Create user2
DO $$
DECLARE v_id uuid := gen_random_uuid();
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'user2@frameforge.local') THEN
    INSERT INTO auth.users (
      id, instance_id, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      aud, role, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) VALUES (
      v_id, '00000000-0000-0000-0000-000000000000',
      'user2@frameforge.local', crypt('User2@123', gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}', '{"display_name":"User 2"}',
      'authenticated', 'authenticated', now(), now(), '', '', '', ''
    );
    INSERT INTO profiles (id, username, display_name, role, credits)
    VALUES (v_id, 'user2', 'User 2', 'user', 100)
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;
