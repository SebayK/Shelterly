-- ============================================================================
-- MIGRATION: Storage RLS policies for verification-documents bucket
-- ============================================================================

-- Allow authenticated users to upload files to their own folder
DROP POLICY IF EXISTS "Users can upload their own verification documents" ON storage.objects;
CREATE POLICY "Users can upload their own verification documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'verification-documents'
  AND (storage.foldername(name))[1] = 'verification-docs'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

-- Allow authenticated users to read their own files
DROP POLICY IF EXISTS "Users can read their own verification documents" ON storage.objects;
CREATE POLICY "Users can read their own verification documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'verification-documents'
  AND (storage.foldername(name))[1] = 'verification-docs'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

-- Allow authenticated users to delete their own files
DROP POLICY IF EXISTS "Users can delete their own verification documents" ON storage.objects;
CREATE POLICY "Users can delete their own verification documents"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'verification-documents'
  AND (storage.foldername(name))[1] = 'verification-docs'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

-- Allow admins (super_admin) to read all verification documents
DROP POLICY IF EXISTS "Admins can read all verification documents" ON storage.objects;
CREATE POLICY "Admins can read all verification documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'verification-documents'
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role = 'super_admin'
  )
);
