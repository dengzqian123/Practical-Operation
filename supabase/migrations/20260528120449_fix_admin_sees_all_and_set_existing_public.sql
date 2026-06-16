/*
  # Fix admin visibility and set all existing videos to public

  1. Set all existing videos is_public = true (historical data correction)
  2. Update RLS SELECT policy so admin sees ALL videos (not just is_public=true)
     - Regular users: own videos only
     - Admin: all videos from all users
*/

-- Make all existing videos public
UPDATE videos SET is_public = true WHERE is_public = false;

-- Drop the policy added in the previous migration
DROP POLICY IF EXISTS "Video select: own always, admin sees all public" ON videos;

-- Admin sees ALL videos; regular users see only their own
CREATE POLICY "Video select: own always, admin sees all"
  ON videos FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );
