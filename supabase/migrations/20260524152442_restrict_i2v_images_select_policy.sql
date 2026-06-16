/*
  # Restrict i2v-images SELECT policy

  The broad "Anyone can read i2v images" policy allowed any client to list all
  files in the bucket, potentially exposing other users' uploads.

  Since the bucket is public, direct object URL access works without any SELECT
  policy at all. However, authenticated users still need SELECT to resolve their
  own file URLs via the storage API.

  Changes:
  - Drop the overly broad public SELECT policy
  - Add a scoped SELECT policy: authenticated users can only read files in their own folder
*/

DROP POLICY IF EXISTS "Anyone can read i2v images" ON storage.objects;

CREATE POLICY "Users can read own i2v images"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'i2v-images' AND auth.uid()::text = (storage.foldername(name))[1]);
