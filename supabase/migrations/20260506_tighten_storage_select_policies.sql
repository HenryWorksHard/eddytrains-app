-- Replace the wide-open "Anyone can view ..." SELECT policies on
-- progress-images and profile-pictures with three narrower ones:
--   1. Owner (file path starts with their user_id) can always read.
--   2. super_admin can read anything (platform support).
--   3. trainer/company_admin in the same organization as the file owner
--      can read — preserves the trainer's view of client avatars and
--      client progress photos without leaking across orgs or clients.

DROP POLICY IF EXISTS "Anyone can view progress images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view profile pictures" ON storage.objects;

-- Progress images
CREATE POLICY "Owner can read progress images" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'progress-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Super admin can read progress images" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'progress-images'
    AND EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

CREATE POLICY "Same-org trainer can read progress images" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'progress-images'
    AND EXISTS (
      SELECT 1
      FROM profiles requester
      JOIN profiles owner ON owner.id::text = (storage.foldername(name))[1]
      WHERE requester.id = auth.uid()
        AND requester.role IN ('trainer', 'company_admin')
        AND requester.organization_id IS NOT NULL
        AND requester.organization_id = owner.organization_id
    )
  );

-- Profile pictures
CREATE POLICY "Owner can read profile pictures" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'profile-pictures'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Super admin can read profile pictures" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'profile-pictures'
    AND EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

CREATE POLICY "Same-org trainer can read profile pictures" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'profile-pictures'
    AND EXISTS (
      SELECT 1
      FROM profiles requester
      JOIN profiles owner ON owner.id::text = (storage.foldername(name))[1]
      WHERE requester.id = auth.uid()
        AND requester.role IN ('trainer', 'company_admin')
        AND requester.organization_id IS NOT NULL
        AND requester.organization_id = owner.organization_id
    )
  );
