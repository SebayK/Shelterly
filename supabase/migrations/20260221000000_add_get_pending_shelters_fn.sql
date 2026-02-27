-- Migration: Add get_pending_shelters_with_email RPC function
-- Purpose: Safely joins auth.users with profiles to expose email for admin use.
-- SECURITY DEFINER allows the function to run with owner privileges,
-- granting access to auth.users without exposing the service role key to the app.
-- SET search_path = public prevents schema injection attacks.

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
  -- ensure the caller is authenticated and a super admin
  caller_id uuid := auth.uid();
  caller_role text;
begin
  if caller_id is null then
    raise exception 'authentication required' using errcode = 'insufficient_privilege';
  end if;

  select role into caller_role
  from profiles
  where id = caller_id
  limit 1;

  if caller_role is null or caller_role != 'super_admin' then
    raise exception 'permission denied' using errcode = 'insufficient_privilege';
  end if;

  return query
  select
    p.id,
    p.name,
    p.nip,
    p.city,
    u.email::text,
    p.verification_doc_path,
    p.created_at,
    count(*) over()::bigint as total_count
  from profiles p
  join auth.users u on p.id = u.id
  where p.status = 'pending'
  order by p.created_at desc
  limit p_limit
  offset p_offset;
end;
$$;

-- restrict execute privilege to authenticated roles so anonymous clients cannot reach this sensitive rpc
revoke execute on function get_pending_shelters_with_email(integer, integer) from public;
grant execute on function get_pending_shelters_with_email(integer, integer) to authenticated;
