-- ============================================================================
-- migration: restore production rls policies for verification-related flows
-- ============================================================================
-- purpose:
--   re-enable row level security on the core public tables used by the
--   shelter verification flow and recreate the production-safe policies
--   required by the current application code.
--
-- affected objects:
--   - public.profiles
--   - public.needs
--   - helper functions used by rls policy predicates
--
-- special considerations:
--   - existing "dev only" migrations removed or disabled the original
--     policies, so this migration is written to be idempotent and safe to
--     re-run during local resets.
--   - admin checks on public.profiles use security definer helper functions
--     to avoid self-referential rls recursion.
--   - the application does not perform hard deletes on public.needs; the
--     delete flow is implemented as a soft delete via update of deleted_at,
--     so no separate delete policy is created for that table.
--   - public.profiles rows are created by the auth trigger, not by direct
--     authenticated inserts, so no insert policy is required for that table.
-- ============================================================================

-- -----------------------------------------------------------------------------
-- 1. helper functions for policy predicates
-- -----------------------------------------------------------------------------

-- returns true when the current authenticated user has the super_admin role.
-- security definer is required here because querying public.profiles from a
-- policy on public.profiles would otherwise recurse into the same rls rules.
create or replace function public.is_super_admin()
returns boolean
security definer
set search_path = public
language sql
stable
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'super_admin'
  );
$$;

comment on function public.is_super_admin() is
  'returns true when the current authenticated user has role = super_admin.';

-- protects verification-critical columns on self-service profile updates.
-- shelters may edit their public/contact data, upload verification documents,
-- and update ai usage fields through application flows, but they must not
-- self-upgrade role/status or overwrite an admin-provided rejection reason.
create or replace function public.can_update_own_profile(
  target_profile_id uuid,
  new_role public.user_role,
  new_status public.shelter_status,
  new_rejection_reason text
)
returns boolean
security definer
set search_path = public
language sql
stable
as $$
  select exists (
    select 1
    from public.profiles as current_profile
    where current_profile.id = auth.uid()
      and current_profile.id = target_profile_id
      and current_profile.role = new_role
      and current_profile.status = new_status
      and current_profile.rejection_reason is not distinct from new_rejection_reason
  );
$$;

comment on function public.can_update_own_profile(uuid, public.user_role, public.shelter_status, text) is
  'allows profile self-updates only when role, status, and rejection_reason stay unchanged.';

revoke execute on function public.is_super_admin() from public;
grant execute on function public.is_super_admin() to authenticated;

revoke execute on function public.can_update_own_profile(uuid, public.user_role, public.shelter_status, text) from public;
grant execute on function public.can_update_own_profile(uuid, public.user_role, public.shelter_status, text) to authenticated;

-- -----------------------------------------------------------------------------
-- 2. re-enable row level security
-- -----------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.needs enable row level security;

-- -----------------------------------------------------------------------------
-- 3. drop stale policies before recreating them
-- -----------------------------------------------------------------------------

drop policy if exists "anon_select_verified_profiles" on public.profiles;
drop policy if exists "auth_select_verified_profiles" on public.profiles;
drop policy if exists "auth_select_own_profile" on public.profiles;
drop policy if exists "auth_update_own_profile" on public.profiles;
drop policy if exists "admin_select_all_profiles" on public.profiles;
drop policy if exists "admin_update_all_profiles" on public.profiles;
drop policy if exists "admin_select_all_shelter_profiles" on public.profiles;
drop policy if exists "admin_update_all_shelter_profiles" on public.profiles;

drop policy if exists "anon_select_needs" on public.needs;
drop policy if exists "auth_select_needs" on public.needs;
drop policy if exists "auth_select_own_needs" on public.needs;
drop policy if exists "auth_insert_own_needs" on public.needs;
drop policy if exists "auth_update_own_needs" on public.needs;

-- -----------------------------------------------------------------------------
-- 4. public.profiles policies
-- -----------------------------------------------------------------------------

-- allow anonymous visitors to browse only verified shelter profiles.
-- super_admin rows are intentionally excluded from public catalogue queries.
create policy "anon_select_verified_profiles"
on public.profiles
for select
to anon
using (
  role = 'shelter'
  and status = 'verified'
);

-- allow authenticated users to browse the same public shelter catalogue.
create policy "auth_select_verified_profiles"
on public.profiles
for select
to authenticated
using (
  role = 'shelter'
  and status = 'verified'
);

-- allow each authenticated user to read their own profile regardless of
-- current status so pending/rejected/suspended flows can still function.
create policy "auth_select_own_profile"
on public.profiles
for select
to authenticated
using (auth.uid() = id);

-- allow each authenticated user to update only their own row, while ensuring
-- verification-controlled fields stay unchanged in self-service flows.
create policy "auth_update_own_profile"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (
  public.can_update_own_profile(id, role, status, rejection_reason)
);

-- allow super admins to read every shelter profile, including pending,
-- rejected, and suspended rows needed by moderation tooling.
create policy "admin_select_all_shelter_profiles"
on public.profiles
for select
to authenticated
using (
  public.is_super_admin()
  and role = 'shelter'
);

-- allow super admins to update shelter verification state without granting
-- them the ability to convert rows into new admin accounts via direct sql.
create policy "admin_update_all_shelter_profiles"
on public.profiles
for update
to authenticated
using (
  public.is_super_admin()
  and role = 'shelter'
)
with check (
  public.is_super_admin()
  and role = 'shelter'
);

-- -----------------------------------------------------------------------------
-- 5. public.needs policies
-- -----------------------------------------------------------------------------

-- allow anonymous visitors to read active needs that belong only to verified
-- shelter profiles. needs from pending/rejected/suspended accounts stay hidden.
create policy "anon_select_needs"
on public.needs
for select
to anon
using (
  deleted_at is null
  and exists (
    select 1
    from public.profiles
    where id = needs.shelter_id
      and role = 'shelter'
      and status = 'verified'
  )
);

-- allow authenticated users to browse the same public set of active needs.
create policy "auth_select_needs"
on public.needs
for select
to authenticated
using (
  deleted_at is null
  and exists (
    select 1
    from public.profiles
    where id = needs.shelter_id
      and role = 'shelter'
      and status = 'verified'
  )
);

-- allow verified shelters to read their own needs, including rows that were
-- just soft-deleted in the same request and need to be returned by update
-- statements using select/returning semantics.
create policy "auth_select_own_needs"
on public.needs
for select
to authenticated
using (
  auth.uid() = shelter_id
  and exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'shelter'
      and status = 'verified'
  )
);

-- allow verified shelters to create only their own active need rows.
-- this blocks super_admin accounts and prevents shelters from inserting
-- needs on behalf of another profile.
create policy "auth_insert_own_needs"
on public.needs
for insert
to authenticated
with check (
  auth.uid() = shelter_id
  and deleted_at is null
  and exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'shelter'
      and status = 'verified'
  )
);

-- allow verified shelters to update only their own active needs.
-- soft delete is covered by this update policy because the application marks
-- deleted rows by updating deleted_at instead of issuing delete statements.
create policy "auth_update_own_needs"
on public.needs
for update
to authenticated
using (
  auth.uid() = shelter_id
  and deleted_at is null
  and exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'shelter'
      and status = 'verified'
  )
)
with check (
  auth.uid() = shelter_id
  and exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'shelter'
      and status = 'verified'
  )
);
