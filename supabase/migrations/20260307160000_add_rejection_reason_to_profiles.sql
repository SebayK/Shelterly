-- ============================================================================
-- MIGRATION: Persist rejection reason for shelter verification decisions
-- ============================================================================
-- Purpose: Store the admin-provided rejection reason on shelter profiles so
--          rejected shelters can see actionable remediation guidance.
-- Affected: public.profiles
-- Dependencies: None
-- ============================================================================

alter table public.profiles
add column if not exists rejection_reason text;

alter table public.profiles
add constraint profiles_rejection_reason_length_check
check (rejection_reason is null or char_length(trim(rejection_reason)) between 3 and 500);

comment on column public.profiles.rejection_reason is
  'Optional reason provided by a super admin when a shelter application is rejected.';