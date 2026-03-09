-- Migration: Fix ambiguous column reference in get_pending_shelters_with_email
-- Purpose: Avoid collisions between RETURNS TABLE output columns and local queries

create or replace function get_pending_shelters_with_email(
  p_limit integer default 20,
  p_offset integer default 0
)
returns table (
  id uuid,
  name text,
  nip text,
  city text,
  email text,
  verification_doc_path text,
  created_at timestamptz,
  total_count bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_id uuid := auth.uid();
  caller_role text;
begin
  if caller_id is null then
    raise exception 'authentication required' using errcode = 'insufficient_privilege';
  end if;

  select admin_profile.role into caller_role
  from profiles as admin_profile
  where admin_profile.id = caller_id
  limit 1;

  if caller_role is null or caller_role != 'super_admin' then
    raise exception 'permission denied' using errcode = 'insufficient_privilege';
  end if;

  return query
  select
    pending_profile.id,
    pending_profile.name,
    pending_profile.nip,
    pending_profile.city,
    admin_user.email::text,
    pending_profile.verification_doc_path,
    pending_profile.created_at,
    count(*) over()::bigint as total_count
  from profiles as pending_profile
  join auth.users as admin_user on pending_profile.id = admin_user.id
  where pending_profile.status = 'pending'
  order by pending_profile.created_at desc
  limit p_limit
  offset p_offset;
end;
$$;

revoke execute on function get_pending_shelters_with_email(integer, integer) from public;
grant execute on function get_pending_shelters_with_email(integer, integer) to authenticated;