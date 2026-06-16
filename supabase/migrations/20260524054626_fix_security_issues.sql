/*
  # Fix two security issues

  1. Function Search Path Mutable
     - Recreate `public.handle_new_user` with SET search_path = '' to prevent
       search_path injection. Fully-qualify all identifiers inside the function body.

  2. Public Bucket Listing Exposure
     - Drop the broad SELECT policy "Anyone can read i2v images" on storage.objects.
       The bucket is already public, so object URLs are directly accessible without
       needing a permissive RLS SELECT policy. Removing it prevents clients from
       listing all files in the bucket.
*/

-- 1. Fix mutable search_path on handle_new_user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
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

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, PUBLIC;

-- 2. Drop the broad listing policy on the i2v-images bucket
DROP POLICY IF EXISTS "Anyone can read i2v images" ON storage.objects;
