-- ============================================================================
-- MIGRATION: Update profiles table and handle_new_user trigger
-- ============================================================================
-- Purpose: Makes shelter-specific fields nullable and adds role-based validation
--          Updates handle_new_user() to populate name from metadata
-- Affected: public.profiles table, public.handle_new_user() function
-- Dependencies: Requires 20260119000000_init_schema.sql
-- ============================================================================

-- -----------------------------------------------------------------------------
-- 1. ALTER TABLE: Make shelter-specific fields nullable
-- -----------------------------------------------------------------------------
-- name, city, and address should only be required for shelters, not super_admins

ALTER TABLE public.profiles
  ALTER COLUMN name DROP NOT NULL,
  ALTER COLUMN city DROP NOT NULL,
  ALTER COLUMN address DROP NOT NULL;

-- -----------------------------------------------------------------------------
-- 2. ADD CONSTRAINT: Validate required fields for shelter role
-- -----------------------------------------------------------------------------
-- ensures that shelters have required information while allowing super_admins
-- to exist without shelter-specific data

ALTER TABLE public.profiles
  ADD CONSTRAINT shelter_required_fields CHECK (
    role != 'shelter' OR (
      name IS NOT NULL AND
      city IS NOT NULL AND
      address IS NOT NULL
    )
  );

-- -----------------------------------------------------------------------------
-- 3. UPDATE FUNCTION: handle_new_user to populate name from metadata
-- -----------------------------------------------------------------------------
-- extracts name from user metadata during signup
-- uses default value for shelters if not provided
-- super_admins are created without name/city/address

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- create profile based on role from metadata (defaults to 'shelter')
  -- for shelters: name, city, address are REQUIRED via constraint shelter_required_fields
  -- for super_admin: these fields can be NULL
  INSERT INTO public.profiles (id, role, status, name, city, address)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'role', 'shelter')::user_role,
    CASE 
      WHEN COALESCE(new.raw_user_meta_data->>'role', 'shelter') = 'super_admin' 
      THEN 'verified'::shelter_status
      ELSE 'pending'::shelter_status
    END,
    -- only populate shelter-specific fields for shelter role
    CASE 
      WHEN COALESCE(new.raw_user_meta_data->>'role', 'shelter') = 'shelter'
      THEN COALESCE(new.raw_user_meta_data->>'name', 'Nowy Schronisko')
      ELSE NULL
    END,
    CASE 
      WHEN COALESCE(new.raw_user_meta_data->>'role', 'shelter') = 'shelter'
      THEN new.raw_user_meta_data->>'city' -- REQUIRED by constraint
      ELSE NULL
    END,
    CASE 
      WHEN COALESCE(new.raw_user_meta_data->>'role', 'shelter') = 'shelter'
      THEN new.raw_user_meta_data->>'address' -- REQUIRED by constraint
      ELSE NULL
    END
  );
  RETURN new;
END;
$$;
