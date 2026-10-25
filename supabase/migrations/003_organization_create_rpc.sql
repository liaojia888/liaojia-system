-- 修復：直接 insert organizations 後 .select() 會因尚未加入 organization_members 而觸發 RLS 失敗
-- 改以 security definer 一次建立公司 + 成員

create or replace function public.create_organization_for_user(org_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_org_id uuid;
  uid uuid := auth.uid();
  trimmed text := trim(org_name);
begin
  if uid is null then
    raise exception 'not_authenticated';
  end if;

  if trimmed = '' then
    trimmed := '我的公司';
  end if;

  select om.organization_id
  into new_org_id
  from public.organization_members om
  where om.user_id = uid
  limit 1;

  if new_org_id is not null then
    return new_org_id;
  end if;

  insert into public.organizations (name)
  values (trimmed)
  returning id into new_org_id;

  insert into public.organization_members (organization_id, user_id, role)
  values (new_org_id, uid, 'owner');

  return new_org_id;
end;
$$;

revoke all on function public.create_organization_for_user(text) from public;
grant execute on function public.create_organization_for_user(text) to authenticated;
grant execute on function public.create_organization_for_user(text) to service_role;
