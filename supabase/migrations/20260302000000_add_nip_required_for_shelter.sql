-- ============================================================================
-- MIGRATION: Enforce NIP as required for shelter accounts at the DB level
-- ============================================================================
-- Purpose: The `shelter_required_fields` CHECK constraint currently enforces
--   name/city/address as NOT NULL for shelters, but does NOT enforce nip.
--   Since NIP is validated as required by the API (via Zod schema) and the
--   handle_new_user() trigger always writes it for shelter accounts, it should
--   also be enforced at the DB level for consistency and data integrity.
--
-- Change: Drop and re-create the `shelter_required_fields` constraint with
--   `nip IS NOT NULL` added to the shelter role condition.
--
-- Dependencies: 20260124000000_update_handle_new_user.sql
-- ============================================================================

ALTER TABLE public.profiles
  DROP CONSTRAINT shelter_required_fields;

ALTER TABLE public.profiles
  ADD CONSTRAINT shelter_required_fields CHECK (
    role != 'shelter' OR (
      name IS NOT NULL AND
      city IS NOT NULL AND
      address IS NOT NULL AND
      nip IS NOT NULL
    )
  );
