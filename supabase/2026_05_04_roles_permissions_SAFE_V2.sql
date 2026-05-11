-- =========================================================
-- MIZAN: Roles, Permissions & Tasks System - SAFE V3
-- Run this whole file in Supabase SQL Editor.
-- =========================================================

-- 1) Base roles
create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'app_role') then
    create type public.app_role as enum ('admin', 'user');
  end if;
end $$;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  role public.app_role not null default 'user',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''),
    'user'
  )
  on conflict (user_id) do update
  set email = excluded.email,
      full_name = coalesce(nullif(excluded.full_name, ''), public.profiles.full_name),
      updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

insert into public.profiles (user_id, email, full_name, role)
select
  u.id,
  u.email,
  coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name', ''),
  'user'
from auth.users u
on conflict (user_id) do nothing;

create or replace function public.current_user_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role from public.profiles where user_id = auth.uid()),
    'user'::public.app_role
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_role() = 'admin'::public.app_role;
$$;

grant execute on function public.current_user_role() to authenticated;
grant execute on function public.is_admin() to authenticated;

-- 2) Profiles policies
drop policy if exists "profiles_select_self_or_admin" on public.profiles;
drop policy if exists "profiles_update_admin_only" on public.profiles;
drop policy if exists "profiles_insert_admin_only" on public.profiles;
drop policy if exists "profiles_delete_admin_only" on public.profiles;

create policy "profiles_select_self_or_admin"
on public.profiles
for select
to authenticated
using (user_id = auth.uid() or public.is_admin());

create policy "profiles_update_admin_only"
on public.profiles
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "profiles_insert_admin_only"
on public.profiles
for insert
to authenticated
with check (public.is_admin());

create policy "profiles_delete_admin_only"
on public.profiles
for delete
to authenticated
using (public.is_admin());

-- 3) App table policies: users can add/select their own; only admins update/delete
do $$
declare
  v_table text;
begin
  foreach v_table in array array['clients', 'cases', 'hearings', 'documents']
  loop
    if exists (
      select 1
      from information_schema.tables t
      where t.table_schema = 'public'
      and t.table_name = v_table
    ) then
      execute format('alter table public.%I enable row level security', v_table);

      execute format('drop policy if exists "%s_select_own_or_admin" on public.%I', v_table, v_table);
      execute format('drop policy if exists "%s_insert_own_or_admin" on public.%I', v_table, v_table);
      execute format('drop policy if exists "%s_update_admin_only" on public.%I', v_table, v_table);
      execute format('drop policy if exists "%s_delete_admin_only" on public.%I', v_table, v_table);

      execute format(
        'create policy "%s_select_own_or_admin" on public.%I for select to authenticated using (public.is_admin() or user_id = auth.uid())',
        v_table,
        v_table
      );

      execute format(
        'create policy "%s_insert_own_or_admin" on public.%I for insert to authenticated with check (public.is_admin() or user_id = auth.uid())',
        v_table,
        v_table
      );

      execute format(
        'create policy "%s_update_admin_only" on public.%I for update to authenticated using (public.is_admin()) with check (public.is_admin())',
        v_table,
        v_table
      );

      execute format(
        'create policy "%s_delete_admin_only" on public.%I for delete to authenticated using (public.is_admin())',
        v_table,
        v_table
      );
    end if;
  end loop;
end $$;

-- 4) Payments / fees: admin only
do $$
begin
  if exists (
    select 1
    from information_schema.tables t
    where t.table_schema = 'public'
    and t.table_name = 'payments'
  ) then
    alter table public.payments enable row level security;

    drop policy if exists "payments_admin_select" on public.payments;
    drop policy if exists "payments_admin_insert" on public.payments;
    drop policy if exists "payments_admin_update" on public.payments;
    drop policy if exists "payments_admin_delete" on public.payments;

    create policy "payments_admin_select"
    on public.payments
    for select
    to authenticated
    using (public.is_admin());

    create policy "payments_admin_insert"
    on public.payments
    for insert
    to authenticated
    with check (public.is_admin());

    create policy "payments_admin_update"
    on public.payments
    for update
    to authenticated
    using (public.is_admin())
    with check (public.is_admin());

    create policy "payments_admin_delete"
    on public.payments
    for delete
    to authenticated
    using (public.is_admin());
  end if;
end $$;

-- 5) Tasks system

do $$
begin
  if not exists (select 1 from pg_type where typname = 'task_status') then
    create type public.task_status as enum ('todo', 'in_progress', 'done', 'cancelled');
  end if;

  if not exists (select 1 from pg_type where typname = 'task_priority') then
    create type public.task_priority as enum ('low', 'medium', 'high', 'urgent');
  end if;
end $$;

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  assigned_by uuid not null references public.profiles(user_id) on delete cascade,
  assigned_to uuid not null references public.profiles(user_id) on delete cascade,
  title text not null,
  description text,
  status public.task_status not null default 'todo',
  priority public.task_priority not null default 'medium',
  due_date date,
  client_id uuid references public.clients(id) on delete set null,
  case_id uuid references public.cases(id) on delete set null,
  completion_notes text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.tasks add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.tasks add column if not exists assigned_by uuid references public.profiles(user_id) on delete cascade;
alter table public.tasks add column if not exists assigned_to uuid references public.profiles(user_id) on delete cascade;
alter table public.tasks add column if not exists title text;
alter table public.tasks add column if not exists description text;
alter table public.tasks add column if not exists status public.task_status not null default 'todo';
alter table public.tasks add column if not exists priority public.task_priority not null default 'medium';
alter table public.tasks add column if not exists due_date date;
alter table public.tasks add column if not exists client_id uuid references public.clients(id) on delete set null;
alter table public.tasks add column if not exists case_id uuid references public.cases(id) on delete set null;
alter table public.tasks add column if not exists completion_notes text;
alter table public.tasks add column if not exists completed_at timestamptz;
alter table public.tasks add column if not exists created_at timestamptz not null default now();
alter table public.tasks add column if not exists updated_at timestamptz not null default now();

-- named FK constraints for easier Supabase joins
alter table public.tasks drop constraint if exists tasks_assigned_by_fkey;
alter table public.tasks add constraint tasks_assigned_by_fkey
foreign key (assigned_by) references public.profiles(user_id) on delete cascade;

alter table public.tasks drop constraint if exists tasks_assigned_to_fkey;
alter table public.tasks add constraint tasks_assigned_to_fkey
foreign key (assigned_to) references public.profiles(user_id) on delete cascade;

create index if not exists tasks_assigned_to_idx on public.tasks(assigned_to);
create index if not exists tasks_assigned_by_idx on public.tasks(assigned_by);
create index if not exists tasks_status_idx on public.tasks(status);
create index if not exists tasks_due_date_idx on public.tasks(due_date);
create index if not exists tasks_case_id_idx on public.tasks(case_id);
create index if not exists tasks_client_id_idx on public.tasks(client_id);

alter table public.tasks enable row level security;

create or replace function public.set_task_update_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();

  if new.status = 'done'::public.task_status and old.status <> 'done'::public.task_status then
    new.completed_at = coalesce(new.completed_at, now());
  elsif new.status <> 'done'::public.task_status then
    new.completed_at = null;
  end if;

  if public.is_admin() then
    return new;
  end if;

  if auth.uid() = old.assigned_to then
    if new.id is distinct from old.id
       or new.user_id is distinct from old.user_id
       or new.assigned_by is distinct from old.assigned_by
       or new.assigned_to is distinct from old.assigned_to
       or new.title is distinct from old.title
       or new.description is distinct from old.description
       or new.priority is distinct from old.priority
       or new.due_date is distinct from old.due_date
       or new.client_id is distinct from old.client_id
       or new.case_id is distinct from old.case_id
    then
      raise exception 'Regular users can only update task status and completion notes';
    end if;

    return new;
  end if;

  raise exception 'Not allowed to update this task';
end;
$$;

drop trigger if exists tasks_set_update_fields on public.tasks;
create trigger tasks_set_update_fields
before update on public.tasks
for each row
execute function public.set_task_update_fields();

drop policy if exists "tasks_select_admin_or_assigned" on public.tasks;
drop policy if exists "tasks_insert_admin_only" on public.tasks;
drop policy if exists "tasks_update_admin_or_assigned_limited" on public.tasks;
drop policy if exists "tasks_delete_admin_only" on public.tasks;

create policy "tasks_select_admin_or_assigned"
on public.tasks
for select
to authenticated
using (public.is_admin() or assigned_to = auth.uid());

create policy "tasks_insert_admin_only"
on public.tasks
for insert
to authenticated
with check (public.is_admin() and user_id = auth.uid() and assigned_by = auth.uid());

create policy "tasks_update_admin_or_assigned_limited"
on public.tasks
for update
to authenticated
using (public.is_admin() or assigned_to = auth.uid())
with check (public.is_admin() or assigned_to = auth.uid());

create policy "tasks_delete_admin_only"
on public.tasks
for delete
to authenticated
using (public.is_admin());

-- 6) Storage policies
insert into storage.buckets (id, name, public)
values ('legal-documents', 'legal-documents', false)
on conflict (id) do nothing;

drop policy if exists "legal_documents_select_own_or_admin" on storage.objects;
drop policy if exists "legal_documents_insert_own_or_admin" on storage.objects;
drop policy if exists "legal_documents_update_admin_only" on storage.objects;
drop policy if exists "legal_documents_delete_admin_only" on storage.objects;

create policy "legal_documents_select_own_or_admin"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'legal-documents'
  and (
    public.is_admin()
    or (storage.foldername(name))[1] = auth.uid()::text
  )
);

create policy "legal_documents_insert_own_or_admin"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'legal-documents'
  and (
    public.is_admin()
    or (storage.foldername(name))[1] = auth.uid()::text
  )
);

create policy "legal_documents_update_admin_only"
on storage.objects
for update
to authenticated
using (bucket_id = 'legal-documents' and public.is_admin())
with check (bucket_id = 'legal-documents' and public.is_admin());

create policy "legal_documents_delete_admin_only"
on storage.objects
for delete
to authenticated
using (bucket_id = 'legal-documents' and public.is_admin());

notify pgrst, 'reload schema';

-- IMPORTANT: after running this file, make your own account admin:
-- update public.profiles set role = 'admin' where email = 'YOUR_EMAIL_HERE';
