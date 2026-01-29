-- ============================================================================
-- MIGRATION: Disable RLS Policies
-- ============================================================================
-- Purpose: Drops all RLS policies from profiles and needs tables
-- Affected: Removes all existing policies on public.profiles and public.needs
-- Rationale: Temporarily disabling policies for development/testing
-- ============================================================================

-- -----------------------------------------------------------------------------
-- DROP PROFILES POLICIES
-- -----------------------------------------------------------------------------

-- drop all select policies for profiles
drop policy if exists "anon_select_verified_profiles" on public.profiles;
drop policy if exists "auth_select_verified_profiles" on public.profiles;
drop policy if exists "auth_select_own_profile" on public.profiles;

-- drop all update policies for profiles
drop policy if exists "auth_update_own_profile" on public.profiles;

-- -----------------------------------------------------------------------------
-- DROP NEEDS POLICIES
-- -----------------------------------------------------------------------------

-- drop all select policies for needs
drop policy if exists "anon_select_needs" on public.needs;
drop policy if exists "auth_select_needs" on public.needs;

-- drop all insert policies for needs
drop policy if exists "auth_insert_own_needs" on public.needs;

-- drop all update policies for needs
drop policy if exists "auth_update_own_needs" on public.needs;
