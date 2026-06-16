/*
  # Update video permissions and defaults

  1. Changes
    - Set `is_public` default to `true` on `videos` table so all new generated content is public by default
    - Set `is_public` default to `true` on `projects` table for consistency

  2. RLS policy updates for `videos`
    - Drop existing SELECT policy
    - Regular users (non-admin): can only SELECT their own videos (`user_id = auth.uid()`)
    - Admin: can SELECT all videos where `is_public = true` across all users
    - Combined into a single policy using role check via profiles join

  3. Security model
    - Admin sees all public works from all users
    - Regular users see only their own works (regardless of public flag)
    - is_public flag controls admin visibility and ExplorePage visibility
*/

-- Set is_public default to true for new videos
ALTER TABLE videos ALTER COLUMN is_public SET DEFAULT true;
ALTER TABLE projects ALTER COLUMN is_public SET DEFAULT true;

-- Update existing videos that have is_public = false to true (initial default correction)
-- Only do this if you want to make all existing content public; comment out if not desired
-- UPDATE videos SET is_public = true WHERE is_public = false;

-- Drop existing videos SELECT policy
DROP POLICY IF EXISTS "Users can view own and public videos" ON videos;
DROP POLICY IF EXISTS "users_select_own_and_public_videos" ON videos;

-- New SELECT policy: own videos always visible; public videos visible to admin
CREATE POLICY "Video select: own always, admin sees all public"
  ON videos FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR (
      is_public = true
      AND EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
          AND profiles.role = 'admin'
      )
    )
  );
