create extension if not exists "uuid-ossp";

create table if not exists public.content (
  id uuid primary key default uuid_generate_v4(),
  type text not null check (type in ('video', 'photo')),
  title text not null,
  folder text not null default 'General',
  url text not null,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.users_role (
  id uuid primary key default uuid_generate_v4(),
  email text not null unique,
  role text not null check (role in ('admin', 'user'))
);

alter table public.content enable row level security;
alter table public.users_role enable row level security;

drop policy if exists "user read content" on public.content;
create policy "user read content"
on public.content
for select
to authenticated
using (true);

drop policy if exists "admin manage content" on public.content;
create policy "admin manage content"
on public.content
for all
to authenticated
using (
  exists (
    select 1
    from public.users_role
    where lower(users_role.email) = lower(auth.jwt()->>'email')
      and users_role.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.users_role
    where lower(users_role.email) = lower(auth.jwt()->>'email')
      and users_role.role = 'admin'
  )
);

drop policy if exists "users can read their role" on public.users_role;
create policy "users can read their role"
on public.users_role
for select
to authenticated
using (lower(email) = lower(auth.jwt()->>'email'));

-- IMPORTANT:
-- 1) Supabase Auth me same email create karo.
-- 2) users_role table me bhi exact same email hona chahiye.
-- 3) Agar email mismatch hua, login ke baad role resolve nahi hoga.
insert into public.users_role (email, role)
values
  ('admin@gmail.com', 'admin'),
  ('user@gmail.com', 'user')
on conflict (email) do update set role = excluded.role;
