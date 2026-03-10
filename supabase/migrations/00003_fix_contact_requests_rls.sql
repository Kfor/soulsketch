-- Fix: Allow both from_user and to_user to UPDATE contact_requests.
-- The mutual like flow requires from_user to update their own sent request
-- to "accepted" when a mutual match is detected.

DROP POLICY IF EXISTS "Users can update contact requests sent to them" ON contact_requests;

CREATE POLICY "Users can update contact requests involving them"
  ON contact_requests FOR UPDATE
  USING (auth.uid() = from_user OR auth.uid() = to_user)
  WITH CHECK (auth.uid() = from_user OR auth.uid() = to_user);
