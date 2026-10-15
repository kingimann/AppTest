-- Pocket Engine accounts: one table of projects, private to each signed-in person.
-- Run this once in your Supabase project (SQL Editor -> New query -> paste -> Run).

create table if not exists public.projects (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  id text not null,                       -- the project's id on the device (p_xxxx)
  name text not null default '',
  kind text not null default '',          -- 2d, 3d or app
  updated bigint not null default 0,      -- last edit, in milliseconds (Date.now())
  deleted boolean not null default false, -- deleted on one device: removed from the others
  data jsonb,                             -- the whole project
  thumb text,                             -- the small picture shown on the Home screen
  primary key (user_id, id)
);

alter table public.projects enable row level security;

drop policy if exists "read own projects" on public.projects;
drop policy if exists "add own projects" on public.projects;
drop policy if exists "change own projects" on public.projects;
drop policy if exists "remove own projects" on public.projects;
create policy "read own projects" on public.projects for select using (auth.uid() = user_id);
create policy "add own projects" on public.projects for insert with check (auth.uid() = user_id);
create policy "change own projects" on public.projects for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "remove own projects" on public.projects for delete using (auth.uid() = user_id);
