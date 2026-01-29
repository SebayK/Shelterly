-- ============================================================================
-- MIGRATION: Initial Schema for Shelterly MVP
-- ============================================================================
-- Purpose: Creates the foundational database schema for the Shelterly platform
-- Affected: Creates enums, profiles table, needs table, indexes, RLS policies, and triggers
-- Dependencies: Requires PostGIS extension for geospatial functionality
-- ============================================================================

-- enable necessary extensions
create extension if not exists "postgis";

-- -----------------------------------------------------------------------------
-- 1. ENUMS & TYPES
-- -----------------------------------------------------------------------------

-- role of the user in the system
create type public.user_role as enum ('shelter', 'super_admin');

-- verification status lifecycle of shelter accounts
-- pending: newly registered, awaiting verification
-- verified: approved shelter, can create and manage needs
-- suspended: temporarily blocked from creating/editing needs
-- rejected: application denied
create type public.shelter_status as enum ('pending', 'verified', 'suspended', 'rejected');

-- categories for needs (closed set for MVP)
create type public.need_category as enum ('food', 'textiles', 'cleaning', 'medical', 'toys', 'other');

-- units for needs (mapped in UI: szt, kg, g, l, ml, opak)
create type public.need_unit as enum ('pcs', 'kg', 'g', 'l', 'ml', 'pack');

-- 5-level urgency scale for needs
create type public.urgency_level as enum ('low', 'normal', 'high', 'urgent', 'critical');

-- -----------------------------------------------------------------------------
-- 2. TABLE: PROFILES
-- -----------------------------------------------------------------------------
-- extends auth.users with shelter-specific data
-- stores both public profile (name, location, contact) and sensitive data (nip, verification docs)
-- sensitive data accessible only to owner and super_admin via rls policies
create table public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    
    -- system fields
    role public.user_role not null default 'shelter',
    status public.shelter_status not null default 'pending',
    
    -- public shelter information
    name text not null,
    city text not null,
    address text not null,
    
    -- geolocation for map functionality
    -- using geography(point, 4326) for accurate distance calculations on earth's spheroid
    location geography(point, 4326),
    
    -- contact information
    phone_number text,
    website_url text,
    
    -- sensitive data (owner and admin only via rls)
    nip text unique,
    verification_doc_path text,
    
    -- ai usage tracking for cost limiting
    ai_usage_count integer not null default 0,
    
    -- timestamps
    created_at timestamptz not null default now(),
    updated_at timestamptz,

    -- validation: nip must be exactly 10 digits
    constraint valid_nip check (nip ~ '^\d{10}$')
);

-- -----------------------------------------------------------------------------
-- 3. TABLE: NEEDS
-- -----------------------------------------------------------------------------
-- stores specific needs reported by shelters
-- supports soft delete via deleted_at timestamp
-- includes both user-editable fields and ai-generated suggestions
create table public.needs (
    id uuid primary key default gen_random_uuid(),
    shelter_id uuid not null references public.profiles(id) on delete cascade,
    
    -- need classification
    category public.need_category not null,
    urgency public.urgency_level not null default 'normal',
    
    -- need details (user-editable)
    title text not null,
    description text,
    shopping_url text,
    
    -- quantities
    target_quantity numeric(10,2) not null check (target_quantity > 0),
    current_quantity numeric(10,2) not null default 0 check (current_quantity >= 0),
    unit public.need_unit not null,
    
    -- status tracking
    is_fulfilled boolean not null default false,
    deleted_at timestamptz, -- soft delete support
    
    -- timestamps
    created_at timestamptz not null default now(),
    updated_at timestamptz
);

-- -----------------------------------------------------------------------------
-- 4. INDEXES
-- -----------------------------------------------------------------------------

-- =============================================================================
-- PROFILES INDEXES
-- =============================================================================

-- index for spatial queries (finding nearest shelters on map)
-- using gist index type for efficient geospatial operations
create index profiles_location_idx on public.profiles using gist (location);

-- index for filtering by verification status (show only verified shelters)
create index profiles_status_idx on public.profiles (status);

-- =============================================================================
-- NEEDS INDEXES
-- =============================================================================

-- index for fetching needs of specific shelter (dashboard view)
create index needs_shelter_id_idx on public.needs (shelter_id);

-- index for sorting by creation date (newest first - default list view)
create index needs_created_at_idx on public.needs (created_at);

-- index for filtering by urgency level (e.g., "show only urgent needs")
create index needs_urgency_idx on public.needs (urgency);

-- partial index for filtering out fulfilled needs (most common query)
-- partial indexes are smaller and faster since they only index rows matching the where clause
create index needs_is_fulfilled_idx on public.needs (is_fulfilled) where is_fulfilled = false;

-- -----------------------------------------------------------------------------
-- 5. ROW LEVEL SECURITY (RLS) POLICIES
-- -----------------------------------------------------------------------------

-- enable rls on all tables
alter table public.profiles enable row level security;
alter table public.needs enable row level security;

-- =============================================================================
-- PROFILES POLICIES
-- =============================================================================

-- policy: allow anonymous users to select verified profiles
-- rationale: public map and list views need to display verified shelters
create policy "anon_select_verified_profiles"
on public.profiles
for select
to anon
using (status = 'verified');

-- policy: allow authenticated users to select verified profiles
-- rationale: logged-in users can browse all verified shelters
create policy "auth_select_verified_profiles"
on public.profiles
for select
to authenticated
using (status = 'verified');

-- policy: allow authenticated users to select their own profile
-- rationale: users need to see their own profile regardless of status (pending, suspended, etc.)
create policy "auth_select_own_profile"
on public.profiles
for select
to authenticated
using (auth.uid() = id);

-- policy: allow authenticated users to update their own profile
-- rationale: shelters can edit their profile information
-- note: critical fields (role, status) should be protected via triggers or excluded from updates
create policy "auth_update_own_profile"
on public.profiles
for update
to authenticated
using (auth.uid() = id);

-- =============================================================================
-- NEEDS POLICIES
-- =============================================================================

-- policy: allow anonymous users to select non-deleted needs from verified shelters
-- rationale: public can browse all active needs on the platform
create policy "anon_select_needs"
on public.needs
for select
to anon
using (
    deleted_at is null
    and exists (
        select 1 from public.profiles
        where id = needs.shelter_id
        and status = 'verified'
    )
);

-- policy: allow authenticated users to select non-deleted needs from verified shelters
-- rationale: logged-in users can browse all active needs
create policy "auth_select_needs"
on public.needs
for select
to authenticated
using (
    deleted_at is null
    and exists (
        select 1 from public.profiles
        where id = needs.shelter_id
        and status = 'verified'
    )
);

-- policy: allow verified shelters to insert their own needs
-- rationale: only verified shelters can create new needs (business rule #7)
-- pending and suspended shelters are blocked from creating needs
create policy "auth_insert_own_needs"
on public.needs
for insert
to authenticated
with check (
    auth.uid() = shelter_id
    and exists (
        select 1 from public.profiles
        where id = auth.uid()
        and status = 'verified'
    )
);

-- policy: allow verified shelters to update their own needs
-- rationale: shelters can edit their needs as long as they remain verified
-- note: users cannot change shelter_id (ownership transfer not allowed)
create policy "auth_update_own_needs"
on public.needs
for update
to authenticated
using (
    auth.uid() = shelter_id
    and exists (
        select 1 from public.profiles
        where id = auth.uid()
        and status = 'verified'
    )
);

-- policy: allow verified shelters to soft delete their own needs
-- rationale: shelters can remove needs by setting deleted_at timestamp
-- actual deletion happens via update (soft delete pattern)
-- note: this policy is covered by the update policy above

-- -----------------------------------------------------------------------------
-- 6. FUNCTIONS & TRIGGERS
-- -----------------------------------------------------------------------------

-- =============================================================================
-- TRIGGER A: automatically create profile entry after supabase auth signup
-- =============================================================================
-- purpose: ensures every authenticated user has a corresponding profile record
-- triggered: after insert on auth.users
create or replace function public.handle_new_user()
returns trigger
security definer
set search_path = public
language plpgsql
as $$
begin
    insert into public.profiles (id, role, status)
    values (new.id, 'shelter', 'pending');
    return new;
end;
$$;

-- bind trigger to auth.users table
create trigger on_auth_user_created
    after insert on auth.users
    for each row
    execute function public.handle_new_user();

-- =============================================================================
-- TRIGGER B: automatically update updated_at timestamp
-- =============================================================================
-- purpose: tracks when records were last modified
-- triggered: before update on profiles and needs tables
create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

-- bind trigger to profiles table
create trigger update_profiles_updated_at
    before update on public.profiles
    for each row
    execute function public.update_updated_at_column();

-- bind trigger to needs table
create trigger update_needs_updated_at
    before update on public.needs
    for each row
    execute function public.update_updated_at_column();
