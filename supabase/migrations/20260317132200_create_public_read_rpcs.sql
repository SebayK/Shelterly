-- ============================================================================
-- migration: create safe public read rpcs for profiles and needs
-- ============================================================================
-- purpose:
--   remove direct public table reads from public.profiles and expose only
--   explicitly whitelisted fields for anonymous/authenticated catalogue access.
--
-- affected objects:
--   - public.profiles policies
--   - public.get_public_verified_profiles(...)
--   - public.get_public_verified_profile_detail(...)
--   - public.get_public_needs(...)
--   - public.get_public_need_detail(...)
--
-- special considerations:
--   - these functions are security definer on purpose so public runtime flows
--     can keep working after direct table select policies are removed.
--   - every function returns only the columns already exposed by the app's
--     public dto contracts; sensitive verification fields stay inaccessible.
--   - idempotency matters for local resets, so policy drops and function
--     recreation are safe to re-run.
-- ============================================================================

-- -----------------------------------------------------------------------------
-- 1. remove direct public table reads from public.profiles
-- -----------------------------------------------------------------------------

-- these policies were the source of the data-leak risk because rls filters rows
-- but does not hide individual columns on the matched rows.
drop policy if exists "anon_select_verified_profiles" on public.profiles;
drop policy if exists "auth_select_verified_profiles" on public.profiles;

-- -----------------------------------------------------------------------------
-- 2. public rpc: verified shelter list for explorer/catalogue
-- -----------------------------------------------------------------------------

create or replace function public.get_public_verified_profiles(
  p_limit integer default 20,
  p_offset integer default 0,
  p_lat double precision default null,
  p_lon double precision default null,
  p_urgent_only boolean default false
)
returns table (
  id uuid,
  name text,
  city text,
  location text,
  created_at timestamptz,
  needs_count integer,
  urgent_needs_count integer,
  distance_meters double precision,
  total_count bigint
)
security definer
set search_path = public
language sql
stable
as $$
  with filtered_profiles as (
    select
      p.id,
      p.name,
      p.city,
      st_astext(p.location::geometry) as location,
      p.created_at,
      count(n.id)::integer as needs_count,
      count(*) filter (where n.urgency in ('high', 'critical'))::integer as urgent_needs_count,
      case
        when p_lat is not null and p_lon is not null then
          st_distance(
            p.location,
            st_setsrid(st_makepoint(p_lon, p_lat), 4326)::geography
          )
        else null
      end as distance_meters
    from public.profiles as p
    left join public.needs as n
      on n.shelter_id = p.id
     and n.deleted_at is null
    where p.role = 'shelter'
      and p.status = 'verified'
      and p.location is not null
      and p.name is not null
      and p.city is not null
    group by p.id, p.name, p.city, p.location, p.created_at
    having not p_urgent_only or count(*) filter (where n.urgency in ('high', 'critical')) > 0
  )
  select
    fp.id,
    fp.name,
    fp.city,
    fp.location,
    fp.created_at,
    fp.needs_count,
    fp.urgent_needs_count,
    fp.distance_meters,
    count(*) over()::bigint as total_count
  from filtered_profiles as fp
  order by
    case when p_lat is not null and p_lon is not null then fp.distance_meters end asc nulls last,
    case when p_lat is null or p_lon is null then fp.created_at end desc nulls last,
    fp.id asc
  limit p_limit
  offset p_offset;
$$;

comment on function public.get_public_verified_profiles(integer, integer, double precision, double precision, boolean) is
  'returns the public shelter catalogue with safe columns only; used by anonymous and authenticated explorer flows.';

revoke execute on function public.get_public_verified_profiles(integer, integer, double precision, double precision, boolean) from public;
grant execute on function public.get_public_verified_profiles(integer, integer, double precision, double precision, boolean) to anon;
grant execute on function public.get_public_verified_profiles(integer, integer, double precision, double precision, boolean) to authenticated;

-- -----------------------------------------------------------------------------
-- 3. public rpc: verified shelter detail
-- -----------------------------------------------------------------------------

create or replace function public.get_public_verified_profile_detail(
  p_profile_id uuid
)
returns table (
  id uuid,
  name text,
  city text,
  address text,
  location text,
  phone_number text,
  website_url text,
  created_at timestamptz,
  needs_total integer,
  needs_urgent integer,
  needs_fulfilled integer
)
security definer
set search_path = public
language sql
stable
as $$
  select
    p.id,
    p.name,
    p.city,
    p.address,
    st_astext(p.location::geometry) as location,
    p.phone_number,
    p.website_url,
    p.created_at,
    count(n.id)::integer as needs_total,
    count(*) filter (where n.urgency in ('high', 'critical'))::integer as needs_urgent,
    count(*) filter (where n.is_fulfilled)::integer as needs_fulfilled
  from public.profiles as p
  left join public.needs as n
    on n.shelter_id = p.id
   and n.deleted_at is null
  where p.id = p_profile_id
    and p.role = 'shelter'
    and p.status = 'verified'
  group by p.id, p.name, p.city, p.address, p.location, p.phone_number, p.website_url, p.created_at;
$$;

comment on function public.get_public_verified_profile_detail(uuid) is
  'returns the public shelter detail payload with safe profile fields and aggregated need counters only.';

revoke execute on function public.get_public_verified_profile_detail(uuid) from public;
grant execute on function public.get_public_verified_profile_detail(uuid) to anon;
grant execute on function public.get_public_verified_profile_detail(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 4. public rpc: needs list
-- -----------------------------------------------------------------------------

create or replace function public.get_public_needs(
  p_limit integer default 20,
  p_offset integer default 0,
  p_shelter_id uuid default null,
  p_category public.need_category default null,
  p_urgency public.urgency_level default null,
  p_fulfilled boolean default null
)
returns table (
  id uuid,
  category public.need_category,
  title text,
  description text,
  urgency public.urgency_level,
  target_quantity integer,
  current_quantity integer,
  unit public.need_unit,
  is_fulfilled boolean,
  created_at timestamptz,
  shelter_id uuid,
  shelter_name text,
  shelter_city text,
  total_count bigint
)
security definer
set search_path = public
language sql
stable
as $$
  select
    n.id,
    n.category,
    n.title,
    n.description,
    n.urgency,
    n.target_quantity,
    n.current_quantity,
    n.unit,
    n.is_fulfilled,
    n.created_at,
    p.id as shelter_id,
    p.name as shelter_name,
    p.city as shelter_city,
    count(*) over()::bigint as total_count
  from public.needs as n
  join public.profiles as p
    on p.id = n.shelter_id
  where n.deleted_at is null
    and p.role = 'shelter'
    and p.status = 'verified'
    and p.name is not null
    and p.city is not null
    and (p_shelter_id is null or n.shelter_id = p_shelter_id)
    and (p_category is null or n.category = p_category)
    and (p_urgency is null or n.urgency = p_urgency)
    and (p_fulfilled is null or n.is_fulfilled = p_fulfilled)
  order by n.created_at desc, n.id asc
  limit p_limit
  offset p_offset;
$$;

comment on function public.get_public_needs(integer, integer, uuid, public.need_category, public.urgency_level, boolean) is
  'returns public need listings with safe embedded shelter info only.';

revoke execute on function public.get_public_needs(integer, integer, uuid, public.need_category, public.urgency_level, boolean) from public;
grant execute on function public.get_public_needs(integer, integer, uuid, public.need_category, public.urgency_level, boolean) to anon;
grant execute on function public.get_public_needs(integer, integer, uuid, public.need_category, public.urgency_level, boolean) to authenticated;

-- -----------------------------------------------------------------------------
-- 5. public rpc: need detail
-- -----------------------------------------------------------------------------

create or replace function public.get_public_need_detail(
  p_need_id uuid
)
returns table (
  id uuid,
  category public.need_category,
  title text,
  description text,
  shopping_url text,
  urgency public.urgency_level,
  target_quantity integer,
  current_quantity integer,
  unit public.need_unit,
  is_fulfilled boolean,
  created_at timestamptz,
  updated_at timestamptz,
  shelter_id uuid,
  shelter_name text,
  shelter_city text,
  shelter_phone_number text
)
security definer
set search_path = public
language sql
stable
as $$
  select
    n.id,
    n.category,
    n.title,
    n.description,
    n.shopping_url,
    n.urgency,
    n.target_quantity,
    n.current_quantity,
    n.unit,
    n.is_fulfilled,
    n.created_at,
    n.updated_at,
    p.id as shelter_id,
    p.name as shelter_name,
    p.city as shelter_city,
    p.phone_number as shelter_phone_number
  from public.needs as n
  join public.profiles as p
    on p.id = n.shelter_id
  where n.id = p_need_id
    and n.deleted_at is null
    and p.role = 'shelter'
    and p.status = 'verified'
    and p.name is not null
    and p.city is not null;
$$;

comment on function public.get_public_need_detail(uuid) is
  'returns the public need detail payload with safe shelter fields only.';

revoke execute on function public.get_public_need_detail(uuid) from public;
grant execute on function public.get_public_need_detail(uuid) to anon;
grant execute on function public.get_public_need_detail(uuid) to authenticated;
