-- ============================================================================
-- MIGRATION: Extend handle_new_user() to populate full shelter profile
-- ============================================================================
-- Purpose: Updates the trigger so that all shelter profile fields (nip,
--          phone_number, website_url, city, address) are written atomically
--          during auth.signUp — eliminating the need for a separate
--          profiles.insert in application code and preventing zombie auth users.
--
-- Before this migration: auth.service.ts performed a manual profiles.insert
--   after signUp, which was non-atomic (zombie user risk on DB error).
-- After this migration:  all data is passed via options.data (raw_user_meta_data)
--   and committed in a single transaction with auth.users creation.
--
-- Dependencies: 20260119000000_init_schema.sql, 20260124000000_update_handle_new_user.sql
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Determine role from metadata (defaults to 'shelter')
  -- For shelters: insert all profile fields from raw_user_meta_data
  -- For super_admin: name/city/address/nip remain NULL (allowed by constraint)
  INSERT INTO public.profiles (
    id,
    role,
    status,
    name,
    nip,
    city,
    address,
    phone_number,
    website_url
  )
  VALUES (
    new.id,

    -- role: explicitly set or default to 'shelter'
    COALESCE(new.raw_user_meta_data->>'role', 'shelter')::user_role,

    -- status: super_admin starts verified, shelters start pending
    CASE
      WHEN COALESCE(new.raw_user_meta_data->>'role', 'shelter') = 'super_admin'
      THEN 'verified'::shelter_status
      ELSE 'pending'::shelter_status
    END,

    -- name (required for shelter, NULL for super_admin)
    CASE
      WHEN COALESCE(new.raw_user_meta_data->>'role', 'shelter') = 'shelter'
      THEN new.raw_user_meta_data->>'name'
      ELSE NULL
    END,

    -- nip (required for shelter, unique constraint enforced at DB level)
    CASE
      WHEN COALESCE(new.raw_user_meta_data->>'role', 'shelter') = 'shelter'
      THEN new.raw_user_meta_data->>'nip'
      ELSE NULL
    END,

    -- city (required for shelter via shelter_required_fields constraint)
    CASE
      WHEN COALESCE(new.raw_user_meta_data->>'role', 'shelter') = 'shelter'
      THEN new.raw_user_meta_data->>'city'
      ELSE NULL
    END,

    -- address (required for shelter via shelter_required_fields constraint)
    CASE
      WHEN COALESCE(new.raw_user_meta_data->>'role', 'shelter') = 'shelter'
      THEN new.raw_user_meta_data->>'address'
      ELSE NULL
    END,

    -- phone_number (optional)
    new.raw_user_meta_data->>'phone_number',

    -- website_url (optional)
    new.raw_user_meta_data->>'website_url'
  );

  RETURN new;
END;
$$;
