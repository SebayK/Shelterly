-- ============================================================================
-- SEED DATA: Test Users (DEVELOPMENT ONLY)
-- ============================================================================
-- Purpose: Create test users for local development/testing
-- 
-- ⚠️ WARNING: This seed file is ONLY executed in local development.
-- Production users must be created manually via Supabase Dashboard or signup flow.
-- 
-- To create super admin in dev:
-- 1. Use Postman "4. Admin > Signup Admin" request (creates user via Supabase Auth)
-- 2. Run this seed to upgrade user to super_admin role
-- OR manually run a SQL block that looks up auth.users by email and updates public.profiles by id.
-- ============================================================================

-- Create a test shelter user with all fields populated
DO $$
DECLARE
  test_shelter_email TEXT := 'test-shelter@shelterly.dev';
  test_shelter_id UUID;
BEGIN
  -- Find user by email in auth.users
  SELECT id INTO test_shelter_id FROM auth.users WHERE email = test_shelter_email;
  
  IF test_shelter_id IS NOT NULL THEN
    -- Update profile to verified shelter with complete data
    UPDATE public.profiles
    SET 
      role = 'shelter',
      status = 'verified',
      name = 'Test Shelter',
      city = 'Warsaw',
      address = 'ul. Testowa 123',
      updated_at = NOW()
    WHERE id = test_shelter_id;
    
    RAISE NOTICE 'Test shelter user upgraded: % (ID: %)', test_shelter_email, test_shelter_id;
  ELSE
    RAISE NOTICE 'Test shelter user not found: %. Create via signup first.', test_shelter_email;
  END IF;
END $$;

-- Upgrade admin user to super_admin role (if exists)
DO $$
DECLARE
  admin_email TEXT := 'admin@shelterly.dev';
  admin_id UUID;
BEGIN
  -- Find admin by email
  SELECT id INTO admin_id FROM auth.users WHERE email = admin_email;
  
  IF admin_id IS NOT NULL THEN
    -- Upgrade to super_admin
    UPDATE public.profiles
    SET 
      role = 'super_admin',
      status = 'verified',
      name = 'System Administrator',
      city = 'Warsaw',
      address = 'Admin Office',
      updated_at = NOW()
    WHERE id = admin_id;
    
    RAISE NOTICE 'Admin user upgraded to super_admin: % (ID: %)', admin_email, admin_id;
  ELSE
    RAISE NOTICE 'Admin user not found: %. Create via signup first.', admin_email;
  END IF;
END $$;
