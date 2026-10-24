-- 會計管理系統：組織、科目表、傳票分錄

create extension if not exists "pgcrypto";

create type account_type as enum (
  'asset',
  'liability',
  'equity',
  'revenue',
  'expense'
);

create type journal_status as enum ('draft', 'posted');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  created_at timestamptz not null default now()
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  fiscal_year_start_month smallint not null default 1 check (fiscal_year_start_month between 1 and 12),
  created_at timestamptz not null default now()
);

create table public.organization_members (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  code text not null,
  name text not null,
  type account_type not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, code)
);

create table public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  entry_date date not null default current_date,
  reference text,
  description text not null default '',
  status journal_status not null default 'draft',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  posted_at timestamptz
);

create table public.journal_lines (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.journal_entries (id) on delete cascade,
  account_id uuid not null references public.accounts (id) on delete restrict,
  debit numeric(18, 2) not null default 0 check (debit >= 0),
  credit numeric(18, 2) not null default 0 check (credit >= 0),
  memo text,
  line_order smallint not null default 0,
  check (
    (debit > 0 and credit = 0)
    or (credit > 0 and debit = 0)
    or (debit = 0 and credit = 0)
  )
);

create index idx_accounts_org on public.accounts (organization_id);
create index idx_journal_entries_org_date on public.journal_entries (organization_id, entry_date desc);
create index idx_journal_lines_entry on public.journal_lines (entry_id);

-- 新使用者自動建立 profile
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.user_organization_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select organization_id from public.organization_members where user_id = auth.uid();
$$;

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.accounts enable row level security;
alter table public.journal_entries enable row level security;
alter table public.journal_lines enable row level security;

create policy "profiles_select_own" on public.profiles
  for select using (id = auth.uid());
create policy "profiles_update_own" on public.profiles
  for update using (id = auth.uid());

create policy "orgs_select_member" on public.organizations
  for select using (id in (select public.user_organization_ids()));
create policy "orgs_insert_authenticated" on public.organizations
  for insert to authenticated with check (true);
create policy "orgs_update_member" on public.organizations
  for update using (id in (select public.user_organization_ids()));

create policy "org_members_select" on public.organization_members
  for select using (organization_id in (select public.user_organization_ids()));
create policy "org_members_insert_self" on public.organization_members
  for insert to authenticated with check (user_id = auth.uid());

create policy "accounts_all_member" on public.accounts
  for all using (organization_id in (select public.user_organization_ids()))
  with check (organization_id in (select public.user_organization_ids()));

create policy "journal_entries_all_member" on public.journal_entries
  for all using (organization_id in (select public.user_organization_ids()))
  with check (organization_id in (select public.user_organization_ids()));

create policy "journal_lines_via_entry" on public.journal_lines
  for all using (
    exists (
      select 1 from public.journal_entries je
      where je.id = entry_id
        and je.organization_id in (select public.user_organization_ids())
    )
  )
  with check (
    exists (
      select 1 from public.journal_entries je
      where je.id = entry_id
        and je.organization_id in (select public.user_organization_ids())
    )
  );
