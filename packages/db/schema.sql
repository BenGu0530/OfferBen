-- OfferBen database schema (Supabase / Postgres)
-- Run this in the Supabase SQL editor to enable cloud persistence.
--
-- Every table has Row Level Security enabled and scoped to the authenticated
-- user (auth.uid()), so the data model is multi-tenant safe from day one even
-- while only one person uses it. Enabling this path requires Supabase Auth.

-- ---------------------------------------------------------------------------
-- profiles: one structured candidate profile per row (a user may keep several)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  label       text not null default 'Default',
  data        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists profiles_user_id_idx on public.profiles (user_id);

-- ---------------------------------------------------------------------------
-- jobs: a captured/pasted job posting plus its parsed analysis and match score
-- ---------------------------------------------------------------------------
create table if not exists public.jobs (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  title        text not null default '',
  company      text not null default '',
  url          text,
  source       text,
  description  text not null default '',
  parsed       jsonb,
  match        jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists jobs_user_id_idx on public.jobs (user_id);

-- ---------------------------------------------------------------------------
-- generations: tailored resumes / cover letters / emails / referral content
-- ---------------------------------------------------------------------------
create table if not exists public.generations (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  job_id      uuid references public.jobs (id) on delete cascade,
  kind        text not null check (kind in (
                'tailored_resume', 'cover_letter', 'recruiter_email',
                'referral_note', 'referral_qa'
              )),
  content     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists generations_user_id_idx on public.generations (user_id);
create index if not exists generations_job_id_idx on public.generations (job_id);

-- ---------------------------------------------------------------------------
-- keep updated_at fresh
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists jobs_set_updated_at on public.jobs;
create trigger jobs_set_updated_at
  before update on public.jobs
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security: a user can only read/write their own rows
-- ---------------------------------------------------------------------------
alter table public.profiles    enable row level security;
alter table public.jobs        enable row level security;
alter table public.generations enable row level security;

drop policy if exists "own_profiles" on public.profiles;
create policy "own_profiles" on public.profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own_jobs" on public.jobs;
create policy "own_jobs" on public.jobs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own_generations" on public.generations;
create policy "own_generations" on public.generations
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
