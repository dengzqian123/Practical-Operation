/*
  # Add UPDATE policy for i2v-images storage bucket

  The upsert: true option in Supabase storage requires both INSERT and UPDATE policies.
  Without UPDATE, upsert fails with RLS violation when overwriting an existing object.

  Also re-adds the SELECT policy in case it was not applied previously.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
    AND policyname = 'Users can update own i2v images'
  ) THEN
    CREATE POLICY "Users can update own i2v images"
      ON storage.objects FOR UPDATE
      TO authenticated
      USING (bucket_id = 'i2v-images' AND auth.uid()::text = (storage.foldername(name))[1])
      WITH CHECK (bucket_id = 'i2v-images' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
    AND policyname = 'Anyone can read i2v images'
  ) THEN
    CREATE POLICY "Anyone can read i2v images"
      ON storage.objects FOR SELECT
      TO public
      USING (bucket_id = 'i2v-images');
  END IF;
END $$;
