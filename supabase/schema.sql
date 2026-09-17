-- Run this once in Supabase SQL Editor.
create table if not exists public.admin_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  role text not null default 'admin' check (role = 'admin'),
  created_at timestamptz not null default now()
);

create table if not exists public.books (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 200),
  author text,
  file_path text not null,
  file_url text not null,
  file_size bigint,
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id) on delete cascade
);

alter table public.admin_profiles enable row level security;
alter table public.books enable row level security;

create or replace function public.is_admin(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(select 1 from public.admin_profiles where id = uid and role = 'admin');
$$;

-- The first confirmed account becomes the administrator.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.admin_profiles) then
    insert into public.admin_profiles(id,email) values(new.id, coalesce(new.email,''));
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Public visitors may read book metadata.
drop policy if exists "public can read books" on public.books;
create policy "public can read books" on public.books for select using (true);

-- Only administrators can create/update/delete book records.
drop policy if exists "admins can insert books" on public.books;
create policy "admins can insert books" on public.books for insert with check (public.is_admin(auth.uid()) and created_by = auth.uid());
drop policy if exists "admins can update books" on public.books;
create policy "admins can update books" on public.books for update using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
drop policy if exists "admins can delete books" on public.books;
create policy "admins can delete books" on public.books for delete using (public.is_admin(auth.uid()));

-- Administrators can read their own role record.
drop policy if exists "admins can read profile" on public.admin_profiles;
create policy "admins can read profile" on public.admin_profiles for select using (id = auth.uid() and role = 'admin');

-- Storage bucket for public PDF reading. Upload/delete is restricted by the DB role check.
insert into storage.buckets (id, name, public)
values ('books','books',true)
on conflict (id) do update set public = true;

drop policy if exists "admins can upload books" on storage.objects;
create policy "admins can upload books" on storage.objects for insert to authenticated
with check (bucket_id = 'books' and public.is_admin(auth.uid()));

drop policy if exists "admins can update book files" on storage.objects;
create policy "admins can update book files" on storage.objects for update to authenticated
using (bucket_id = 'books' and public.is_admin(auth.uid()))
with check (bucket_id = 'books' and public.is_admin(auth.uid()));

drop policy if exists "admins can delete book files" on storage.objects;
create policy "admins can delete book files" on storage.objects for delete to authenticated
using (bucket_id = 'books' and public.is_admin(auth.uid()));
