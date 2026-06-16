
/*
  # Create batch@frameforge.local user

  Creates a new authenticated user with email batch@frameforge.local and
  password Admin@1234!, following the same pattern as existing seed users.
  Also inserts the corresponding identity record and profile row.
*/

DO $$
DECLARE
  new_user_id uuid := gen_random_uuid();
BEGIN
  -- Insert auth user
  INSERT INTO auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    is_super_admin,
    created_at,
    updated_at,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change,
    is_anonymous
  ) VALUES (
    new_user_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'batch@frameforge.local',
    crypt('Admin@1234!', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"display_name":"Batch"}',
    false,
    now(),
    now(),
    '',
    '',
    '',
    '',
    false
  );

  -- Insert identity
  INSERT INTO auth.identities (
    id,
    user_id,
    provider_id,
    provider,
    identity_data,
    last_sign_in_at,
    created_at,
    updated_at
  ) VALUES (
    gen_random_uuid(),
    new_user_id,
    'batch@frameforge.local',
    'email',
    jsonb_build_object('sub', new_user_id::text, 'email', 'batch@frameforge.local'),
    now(),
    now(),
    now()
  );
END $$;
