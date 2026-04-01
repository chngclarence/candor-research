-- Candor Research — Supabase Schema
-- Paste this into Supabase SQL Editor and click Run

-- Sessions table
create table if not exists sessions (
  id uuid default gen_random_uuid() primary key,
  pin text unique,
  product text not null,
  goal text not null,
  persona text,
  duration_mins integer default 7,
  focus text[],
  total_questions integer default 8,
  language text default 'English',
  status text default 'draft',
  file_ids text[],
  custom_questions text,
  context_url text,
  clarification_log text,
  interview_prompt text,
  created_at timestamptz default now(),
  created_by text,
  response_count integer default 0,
  summary text,
  co_admins text[]
);

-- Participants table
create table if not exists participants (
  id uuid default gen_random_uuid() primary key,
  pin text references sessions(pin) on delete cascade,
  name text,
  role text,
  language text,
  started_at timestamptz default now(),
  completed_at timestamptz,
  status text default 'started',
  transcript jsonb
);

-- Enable Row Level Security
alter table sessions enable row level security;
alter table participants enable row level security;

-- Allow all operations for now (internal tool)
-- You can tighten these later with proper auth policies
create policy "Allow all on sessions" on sessions for all using (true) with check (true);
create policy "Allow all on participants" on participants for all using (true) with check (true);

-- Indexes for performance
create index if not exists sessions_pin_idx on sessions(pin);
create index if not exists sessions_created_by_idx on sessions(created_by);
create index if not exists participants_pin_idx on participants(pin);
create index if not exists participants_status_idx on participants(status);
