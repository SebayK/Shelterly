-- Migration: Add get_pending_shelters_with_email RPC function
-- Purpose: Safely joins auth.users with profiles to expose email for admin use.
-- SECURITY DEFINER allows the function to run with owner privileges,
-- granting access to auth.users without exposing the service role key to the app.
-- SET search_path = public prevents schema injection attacks.

CREATE OR REPLACE FUNCTION get_pending_shelters_with_email(
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  nip TEXT,
  city TEXT,
  email TEXT,
  verification_doc_path TEXT,
  created_at TIMESTAMPTZ,
  total_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.name,
    p.nip,
    p.city,
    u.email::TEXT,
    p.verification_doc_path,
    p.created_at,
    COUNT(*) OVER()::BIGINT AS total_count
  FROM profiles p
  JOIN auth.users u ON p.id = u.id
  WHERE p.status = 'pending'
  ORDER BY p.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;
