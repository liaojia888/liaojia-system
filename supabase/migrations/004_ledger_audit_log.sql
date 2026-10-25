-- 日結雲端變更審計（誰在何時改動哪個月）

create type public.ledger_change_action as enum ('save', 'import');

create table public.daily_ledger_change_log (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  month_key text not null check (month_key ~ '^\d{4}-\d{2}$'),
  changed_by uuid references public.profiles (id) on delete set null,
  action public.ledger_change_action not null default 'save',
  row_count integer,
  created_at timestamptz not null default now()
);

create index idx_ledger_change_log_org_time
  on public.daily_ledger_change_log (organization_id, created_at desc);

create index idx_ledger_change_log_org_month_time
  on public.daily_ledger_change_log (organization_id, month_key, created_at desc);

alter table public.daily_ledger_change_log enable row level security;

create policy "ledger_change_log_select_member"
  on public.daily_ledger_change_log
  for select
  using (organization_id in (select public.user_organization_ids()));

create policy "ledger_change_log_insert_member"
  on public.daily_ledger_change_log
  for insert
  with check (organization_id in (select public.user_organization_ids()));
