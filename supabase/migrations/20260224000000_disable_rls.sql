-- ============================================================================
-- MIGRATION: Disable RLS on profiles and needs tables
-- ============================================================================
-- Environment: DEVELOPMENT ONLY - DO NOT APPLY IN PRODUCTION
-- Purpose: Completely disable Row Level Security
-- Rationale: Previous migration dropped policies but left RLS enabled,
--            causing all queries to be blocked. Disabling RLS entirely
--            for development/testing purposes.
-- Security: In production, RLS must remain ENABLED with proper policies
-- Note: This migration is skipped in production deployments
-- ============================================================================

-- Disable RLS on profiles table
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;

-- Disable RLS on needs table
ALTER TABLE public.needs DISABLE ROW LEVEL SECURITY;
