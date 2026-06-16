/*
  # Fix tianyi user: insert missing auth.identities row

  The auth.identities entry was not created when the user was manually inserted,
  causing "Database error querying schema" on login. This adds the required email
  identity record so Supabase can authenticate the user with email/password.
*/

INSERT INTO auth.identities (
  id,
  user_id,
  provider_id,
  provider,
  identity_data,
  last_sign_in_at,
  created_at,
  updated_at
)
SELECT
  gen_random_uuid(),
  u.id,
  u.id::text,
  'email',
  jsonb_build_object('sub', u.id::text, 'email', u.email),
  now(),
  now(),
  now()
FROM auth.users u
WHERE u.email = 'tianyi@frameforge.local'
  AND NOT EXISTS (
    SELECT 1 FROM auth.identities i WHERE i.user_id = u.id
  );
