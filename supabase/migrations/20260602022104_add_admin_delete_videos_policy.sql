/*
  # Allow admins to delete any video

  The existing DELETE policy only allows users to delete their own videos.
  Admins need to delete videos belonging to any user from the admin view.

  Changes:
  - Drop the existing single DELETE policy
  - Re-create it with an OR clause that also allows admin role users to delete any video
*/

DROP POLICY IF EXISTS "Users can delete own videos" ON videos;

CREATE POLICY "Users can delete own videos or admin can delete any"
  ON videos
  FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );
