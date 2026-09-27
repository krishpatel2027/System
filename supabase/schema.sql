-- Arkria Studio OS — Supabase (Postgres) schema.
-- Run this once in the Supabase SQL editor (Project → SQL editor → New query).
-- It is safe to run again: every statement is idempotent, so re-running it
-- also upgrades older installs.

-- The whole workspace is stored as one JSON document with a version number.
-- Every save names the version it was based on; if a teammate saved first the
-- app merges both sets of changes and retries, so nobody's work is lost.
create table if not exists public.arkria_store (
  id text primary key default 'main',
  data jsonb not null default '{}'::jsonb,
  version bigint not null default 0,
  updated_at timestamptz not null default now()
);

-- Upgrade path for installs created before versioning existed.
alter table public.arkria_store add column if not exists version bigint not null default 0;

insert into public.arkria_store (id, data, version)
values ('main', '{}'::jsonb, 0)
on conflict (id) do nothing;

-- Only the server (using the service-role key, which bypasses RLS) may read or
-- write. With RLS on and no policies, the public anon key has no access at all.
alter table public.arkria_store enable row level security;
