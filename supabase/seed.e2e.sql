-- ============================================================================
-- SEED DATA: Deterministic E2E Dataset
-- ============================================================================
-- Purpose:
--   1. Extend the default local seed with accounts reserved for Playwright E2E.
--   2. Keep E2E credentials stable across `supabase db reset`.
--   3. Ensure every seeded auth user has a matching `public.profiles` row.
--
-- Notes:
--   - This file is intentionally separate from `seed.sql` so development data
--     and E2E-only credentials stay easy to reason about.
--   - The primary verified shelter matches the current `.env.test` login.
-- ============================================================================

-- --------------------------------------------------------------------------
-- 1. Seed deterministic E2E auth users + profiles
-- --------------------------------------------------------------------------

DO $$
DECLARE
  seed_user JSONB;
  seed_users JSONB := jsonb_build_array(
    jsonb_build_object(
      'id', '1ea66789-a3a1-41bf-9f6c-84fb518107b1',
      'email', 'login-e2e@example.test',
      'password', 'Tester123!',
      'role', 'shelter',
      'status', 'verified',
      'name', 'E2E Verified Shelter',
      'nip', '5234567890',
      'city', 'Warszawa',
      'address', 'ul. E2E 10, Warszawa',
      'phone_number', '+48 501 600 700',
      'website_url', 'https://e2e-verified.shelterly.dev',
      'location_lon', 21.0122,
      'location_lat', 52.2297
    ),
    jsonb_build_object(
      'id', '55555555-5555-4555-8555-555555555555',
      'email', 'pending-e2e@shelterly.dev',
      'password', 'Tester123!',
      'role', 'shelter',
      'status', 'pending',
      'name', 'E2E Pending Shelter',
      'nip', '6234567890',
      'city', 'Gdańsk',
      'address', 'ul. Testowa 5, Gdańsk',
      'phone_number', '+48 502 600 700',
      'website_url', 'https://e2e-pending.shelterly.dev'
    ),
    jsonb_build_object(
      'id', '66666666-6666-4666-8666-666666666666',
      'email', 'rejected-e2e@shelterly.dev',
      'password', 'Tester123!',
      'role', 'shelter',
      'status', 'rejected',
      'name', 'E2E Rejected Shelter',
      'nip', '7234567890',
      'city', 'Poznań',
      'address', 'ul. Testowa 6, Poznań',
      'phone_number', '+48 503 600 700',
      'website_url', 'https://e2e-rejected.shelterly.dev',
      'rejection_reason', 'Dokument weryfikacyjny wymaga poprawy.'
    ),
    jsonb_build_object(
      'id', '77777777-7777-4777-8777-777777777777',
      'email', 'admin-e2e@shelterly.dev',
      'password', 'Admin123!',
      'role', 'super_admin',
      'status', 'verified',
      'name', 'E2E Administrator',
      'city', 'Warszawa',
      'address', 'Biuro E2E Shelterly'
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

    RAISE NOTICE 'Seeded E2E auth/profile user: % (% / %)', auth_user_email, auth_user_id, profile_status;
  END LOOP;
END $$;

-- --------------------------------------------------------------------------
-- 2. Seed deterministic needs for the primary verified E2E shelter
-- --------------------------------------------------------------------------

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
    'eeeeeeee-1111-4111-8111-111111111111'::UUID,
    '1ea66789-a3a1-41bf-9f6c-84fb518107b1'::UUID,
    'food'::public.need_category,
    'high'::public.urgency_level,
    'Sucha karma dla psów',
    'Zapas pod scenariusze e2e związane z listą potrzeb i dashboardem.',
    'https://example.com/e2e-dog-food',
    60::NUMERIC,
    15::NUMERIC,
    'kg'::public.need_unit,
    false,
    NULL::TIMESTAMPTZ,
    NOW() - INTERVAL '2 days',
    NOW() - INTERVAL '1 day'
  ),
  (
    'ffffffff-1111-4111-8111-111111111111'::UUID,
    '1ea66789-a3a1-41bf-9f6c-84fb518107b1'::UUID,
    'cleaning'::public.need_category,
    'normal'::public.urgency_level,
    'Środki czystości',
    'Dane pomocnicze dla e2e dotyczących zarządzania potrzebami.',
    NULL,
    20::NUMERIC,
    5::NUMERIC,
    'l'::public.need_unit,
    false,
    NULL::TIMESTAMPTZ,
    NOW() - INTERVAL '1 day',
    NOW()
  )
ON CONFLICT (id) DO UPDATE
SET
  shelter_id = EXCLUDED.shelter_id,
  category = EXCLUDED.category,
  urgency = EXCLUDED.urgency,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  shopping_url = EXCLUDED.shopping_url,
  target_quantity = EXCLUDED.target_quantity,
  current_quantity = EXCLUDED.current_quantity,
  unit = EXCLUDED.unit,
  is_fulfilled = EXCLUDED.is_fulfilled,
  deleted_at = EXCLUDED.deleted_at,
  updated_at = NOW();
