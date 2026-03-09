-- ============================================================================
-- SEED DATA: Deterministic Local Development Dataset
-- ============================================================================
-- Purpose:
--   1. Remove historical throwaway signup-test accounts from local auth tables.
--   2. Create a deterministic set of auth users, profiles, and needs.
--   3. Ensure explorer, shelter detail, dashboard, and admin flows work after
--      `supabase db reset` without manual signup.
-- ============================================================================

-- --------------------------------------------------------------------------
-- 1. Cleanup historical local throwaway accounts
-- --------------------------------------------------------------------------

DO $$
BEGIN
  DELETE FROM auth.identities
  WHERE identity_data ->> 'email' LIKE 'signup-test+%@example.com';

  DELETE FROM auth.users
  WHERE email LIKE 'signup-test+%@example.com';
END $$;

-- --------------------------------------------------------------------------
-- 2. Seed deterministic auth users + profiles
-- --------------------------------------------------------------------------

DO $$
DECLARE
  seed_user JSONB;
  seed_users JSONB := jsonb_build_array(
    jsonb_build_object(
      'id', '11111111-1111-4111-8111-111111111111',
      'email', 'test-shelter@shelterly.dev',
      'password', 'Shelterly123!',
      'role', 'shelter',
      'status', 'verified',
      'name', 'Test Shelter Warsaw',
      'nip', '1234567890',
      'city', 'Warszawa',
      'address', 'ul. Testowa 123, Warszawa',
      'phone_number', '+48 123 456 789',
      'website_url', 'https://test-shelter.shelterly.dev',
      'location_lon', 21.0122,
      'location_lat', 52.2297
    ),
    jsonb_build_object(
      'id', '22222222-2222-4222-8222-222222222222',
      'email', 'second-shelter@shelterly.dev',
      'password', 'Shelterly123!',
      'role', 'shelter',
      'status', 'verified',
      'name', 'Test Shelter Krakow',
      'nip', '2234567890',
      'city', 'Kraków',
      'address', 'ul. Floriańska 1, Kraków',
      'phone_number', '+48 223 456 789',
      'website_url', 'https://second-shelter.shelterly.dev',
      'location_lon', 19.9372,
      'location_lat', 50.0614
    ),
    jsonb_build_object(
      'id', '33333333-3333-4333-8333-333333333333',
      'email', 'pending-shelter@shelterly.dev',
      'password', 'Shelterly123!',
      'role', 'shelter',
      'status', 'pending',
      'name', 'Pending Shelter',
      'nip', '3234567890',
      'city', 'Gdańsk',
      'address', 'ul. Długa 1, Gdańsk',
      'phone_number', '+48 323 456 789',
      'website_url', 'https://pending-shelter.shelterly.dev'
    ),
    jsonb_build_object(
      'id', '44444444-4444-4444-8444-444444444444',
      'email', 'rejected-shelter@shelterly.dev',
      'password', 'Shelterly123!',
      'role', 'shelter',
      'status', 'rejected',
      'name', 'Rejected Shelter',
      'nip', '4234567890',
      'city', 'Poznań',
      'address', 'ul. Półwiejska 10, Poznań',
      'phone_number', '+48 423 456 789',
      'website_url', 'https://rejected-shelter.shelterly.dev',
      'rejection_reason', 'Brak poprawnego dokumentu potwierdzającego prowadzenie schroniska.'
    ),
    jsonb_build_object(
      'id', '99999999-9999-4999-8999-999999999999',
      'email', 'admin@shelterly.dev',
      'password', 'Admin123!',
      'role', 'super_admin',
      'status', 'verified',
      'name', 'System Administrator',
      'city', 'Warszawa',
      'address', 'Biuro administracji Shelterly'
    )
  );
  auth_user_id UUID;
  auth_user_email TEXT;
  auth_user_password TEXT;
  profile_role public.user_role;
  profile_status public.shelter_status;
  profile_name TEXT;
  profile_nip TEXT;
  profile_city TEXT;
  profile_address TEXT;
  profile_phone_number TEXT;
  profile_website_url TEXT;
  profile_rejection_reason TEXT;
  location_lon DOUBLE PRECISION;
  location_lat DOUBLE PRECISION;
  metadata JSONB;
BEGIN
  FOR seed_user IN SELECT * FROM jsonb_array_elements(seed_users) LOOP
    auth_user_id := (seed_user ->> 'id')::UUID;
    auth_user_email := seed_user ->> 'email';
    auth_user_password := seed_user ->> 'password';
    profile_role := (seed_user ->> 'role')::public.user_role;
    profile_status := (seed_user ->> 'status')::public.shelter_status;
    profile_name := seed_user ->> 'name';
    profile_nip := seed_user ->> 'nip';
    profile_city := seed_user ->> 'city';
    profile_address := seed_user ->> 'address';
    profile_phone_number := seed_user ->> 'phone_number';
    profile_website_url := seed_user ->> 'website_url';
    profile_rejection_reason := seed_user ->> 'rejection_reason';
    location_lon := NULLIF(seed_user ->> 'location_lon', '')::DOUBLE PRECISION;
    location_lat := NULLIF(seed_user ->> 'location_lat', '')::DOUBLE PRECISION;

    metadata := jsonb_strip_nulls(
      jsonb_build_object(
        'sub', auth_user_id::TEXT,
        'email', auth_user_email,
        'email_verified', true,
        'phone_verified', false,
        'role', profile_role::TEXT,
        'name', profile_name,
        'nip', profile_nip,
        'city', profile_city,
        'address', profile_address,
        'phone_number', profile_phone_number,
        'website_url', profile_website_url
      )
    );

    DELETE FROM auth.identities
    WHERE user_id = auth_user_id
       OR identity_data ->> 'email' = auth_user_email;

    DELETE FROM auth.users
    WHERE id = auth_user_id
       OR email = auth_user_email;

    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      confirmation_token,
      recovery_token,
      email_change_token_new,
      email_change,
      email_change_token_current,
      reauthentication_token,
      raw_app_meta_data,
      raw_user_meta_data,
      phone,
      phone_change,
      phone_change_token,
      email_change_confirm_status,
      created_at,
      updated_at,
      is_anonymous
    )
    VALUES (
      '00000000-0000-0000-0000-000000000000',
      auth_user_id,
      'authenticated',
      'authenticated',
      auth_user_email,
      crypt(auth_user_password, gen_salt('bf')),
      NOW(),
      '',
      '',
      '',
      '',
      '',
      '',
      jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
      metadata,
      NULL,
      '',
      '',
      0,
      NOW(),
      NOW(),
      false
    );

    INSERT INTO auth.identities (
      id,
      user_id,
      provider_id,
      identity_data,
      provider,
      last_sign_in_at,
      created_at,
      updated_at
    )
    VALUES (
      gen_random_uuid(),
      auth_user_id,
      auth_user_id::TEXT,
      metadata,
      'email',
      NOW(),
      NOW(),
      NOW()
    );

    INSERT INTO public.profiles (
      id,
      role,
      status,
      name,
      nip,
      city,
      address,
      location,
      phone_number,
      website_url,
      rejection_reason,
      ai_usage_count,
      created_at,
      updated_at
    )
    VALUES (
      auth_user_id,
      profile_role,
      profile_status,
      CASE WHEN profile_role = 'super_admin' THEN COALESCE(profile_name, 'System Administrator') ELSE profile_name END,
      CASE WHEN profile_role = 'shelter' THEN profile_nip ELSE NULL END,
      CASE WHEN profile_role = 'shelter' THEN profile_city ELSE COALESCE(profile_city, 'Warszawa') END,
      CASE WHEN profile_role = 'shelter' THEN profile_address ELSE COALESCE(profile_address, 'Biuro administracji Shelterly') END,
      CASE
        WHEN location_lon IS NOT NULL AND location_lat IS NOT NULL
        THEN ST_SetSRID(ST_MakePoint(location_lon, location_lat), 4326)::geography
        ELSE NULL
      END,
      profile_phone_number,
      profile_website_url,
      profile_rejection_reason,
      0,
      NOW(),
      NOW()
    )
    ON CONFLICT (id) DO UPDATE
    SET
      role = EXCLUDED.role,
      status = EXCLUDED.status,
      name = EXCLUDED.name,
      nip = EXCLUDED.nip,
      city = EXCLUDED.city,
      address = EXCLUDED.address,
      location = EXCLUDED.location,
      phone_number = EXCLUDED.phone_number,
      website_url = EXCLUDED.website_url,
      rejection_reason = EXCLUDED.rejection_reason,
      ai_usage_count = EXCLUDED.ai_usage_count,
      updated_at = NOW();

    RAISE NOTICE 'Seeded auth/profile user: % (% / %)', auth_user_email, auth_user_id, profile_status;
  END LOOP;
END $$;

-- --------------------------------------------------------------------------
-- 3. Seed deterministic needs for verified shelters
-- --------------------------------------------------------------------------

DELETE FROM public.needs
WHERE id IN (
  'aaaaaaaa-1111-4111-8111-111111111111',
  'bbbbbbbb-1111-4111-8111-111111111111',
  'cccccccc-2222-4222-8222-222222222222'
);

INSERT INTO public.needs (
  id,
  shelter_id,
  category,
  urgency,
  title,
  description,
  shopping_url,
  target_quantity,
  current_quantity,
  unit,
  is_fulfilled,
  deleted_at,
  created_at,
  updated_at
)
VALUES
  (
    'aaaaaaaa-1111-4111-8111-111111111111',
    '11111111-1111-4111-8111-111111111111',
    'food',
    'critical',
    'Karma sucha dla psów',
    'Pilnie potrzebujemy karmy suchej dla dorosłych psów dużych ras.',
    'https://example.com/dry-dog-food',
    120,
    35,
    'kg',
    false,
    NULL,
    NOW() - INTERVAL '3 days',
    NOW() - INTERVAL '1 day'
  ),
  (
    'bbbbbbbb-1111-4111-8111-111111111111',
    '11111111-1111-4111-8111-111111111111',
    'medical',
    'high',
    'Środki do odrobaczania',
    'Potrzebne preparaty do podstawowej opieki weterynaryjnej nowych podopiecznych.',
    NULL,
    40,
    40,
    'pcs',
    true,
    NULL,
    NOW() - INTERVAL '6 days',
    NOW() - INTERVAL '2 days'
  ),
  (
    'cccccccc-2222-4222-8222-222222222222',
    '22222222-2222-4222-8222-222222222222',
    'cleaning',
    'normal',
    'Środki czystości',
    'Płyny do mycia podłóg i dezynfekcji boksów.',
    'https://example.com/cleaning-supplies',
    25,
    0,
    'l',
    false,
    NULL,
    NOW() - INTERVAL '2 days',
    NOW() - INTERVAL '12 hours'
  );
