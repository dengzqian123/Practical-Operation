/*
  # Fix handle_new_user function security

  1. Changes
    - Set fixed search_path on `handle_new_user` to prevent mutable search_path attack
    - Revoke EXECUTE on the function from `anon` and `authenticated` roles
      (it is a trigger function and should only be called internally by the trigger,
      never directly via RPC)
*/

-- Fix mutable search_path by recreating the function with a fixed search_path
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Revoke EXECUTE from anon and authenticated roles — this is a trigger-only function
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
