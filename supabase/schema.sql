-- Arkria Studio OS — Supabase (Postgres) schema
-- Mirrors src/lib/types.ts. Run once in the Supabase SQL editor.
-- Uses JSONB for nested collections to keep the migration 1:1 with the
-- localStorage document model; normalize later if you need SQL queries.

create table if not exists public.arkria_store (
  id text primary key default 'main',
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- One row holds the whole DB document (same shape as the DB interface).
insert into public.arkria_store (id, data)
values ('main', '{}'::jsonb)
on conflict (id) do nothing;

-- Enable RLS; the service-role key bypasses it (used by /api/store).
-- The anon key gets no access unless you add policies below.
alter table public.arkria_store enable row level security;

-- Optional: allow authenticated users to read the store.
-- create policy "authenticated read"
--   on public.arkria_store for select
--   to authenticated
--   using (true);

-- Optional normalized tables (future use — API still uses arkria_store v1):
-- create table if not exists public.leads (id text primary key, data jsonb not null, updated_at timestamptz default now());
-- create table if not exists public.clients (id text primary key, data jsonb not null, updated_at timestamptz default now());
-- create table if not exists public.projects (id text primary key, data jsonb not null, updated_at timestamptz default now());
-- create table if not exists public.payments (id text primary key, data jsonb not null, updated_at timestamptz default now());
