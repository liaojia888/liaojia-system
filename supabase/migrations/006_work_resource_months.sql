-- 工作資源進出：依組織 + 月份儲存（JSON 列資料）

create table public.work_resource_months (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  month_key text not null check (month_key ~ '^\d{4}-\d{2}$'),
  rows jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  unique (organization_id, month_key)
);

create index idx_work_resource_months_org on public.work_resource_months (organization_id);
create index idx_work_resource_months_org_month on public.work_resource_months (organization_id, month_key);

alter table public.work_resource_months enable row level security;

create policy "work_resource_months_all_member"
  on public.work_resource_months
  for all
  using (organization_id in (select public.user_organization_ids()))
  with check (organization_id in (select public.user_organization_ids()));
