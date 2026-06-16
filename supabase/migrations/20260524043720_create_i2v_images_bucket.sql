/*
  # Create i2v-images storage bucket

  Creates a public storage bucket for i2v (image-to-video) first-frame images.

  - Bucket: i2v-images (public)
  - Authenticated users can upload their own images
  - Anyone can read (public URLs needed by Aliyun API)
  - Users can delete their own uploads
*/

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'i2v-images',
  'i2v-images',
  true,
  10485760, -- 10MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users can upload i2v images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'i2v-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Anyone can read i2v images"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'i2v-images');

CREATE POLICY "Users can delete own i2v images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'i2v-images' AND auth.uid()::text = (storage.foldername(name))[1]);
