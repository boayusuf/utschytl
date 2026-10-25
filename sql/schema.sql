-- Tellback schema for Supabase (Postgres). Run once in the SQL editor.
-- Demo-grade RLS: the publishable key may read/write everything. Before any real
-- classroom use, replace these policies with per-course lecturer auth (see README).

create extension if not exists "pgcrypto";

create table if not exists courses (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  title text not null,
  code text
);

create table if not exists weeks (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  course_id uuid references courses(id) on delete cascade,
  number int,
  title text not null,
  status text not null default 'draft',          -- draft | published
  material_chars int,
  material_excerpt text
);

create table if not exists outcomes (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  week_id uuid references weeks(id) on delete cascade,  -- null = archived, or a student's private card
  session_id uuid,                                        -- set for private cards ("mine" / "viva"); no FK: sessions is created later
  kind text default 'week',                               -- week | mine | viva
  archived_from uuid,
  position int not null default 0,
  title text not null,
  prompt text not null,
  slide_ref text,
  criteria jsonb not null default '[]',             -- [{id,text,answer_terms[]}]
  common_misconceptions jsonb not null default '[]'
);

create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  week_id uuid references weeks(id) on delete cascade,   -- null for a coursework-viva session
  alias text,
  student_id uuid,                                        -- anonymous per-browser id (cookie), for profile + recall
  kind text default 'practice'                            -- practice | viva
);

create table if not exists attempts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  session_id uuid references sessions(id) on delete cascade,
  outcome_id uuid references outcomes(id) on delete cascade,
  confidence_before int,                            -- 1..5, felt understanding before explaining
  status text not null default 'in_progress',       -- in_progress | mastered | skipped | parked
  student_turns int not null default 0,
  target_id text,
  target_attempts int not null default 0,
  met_ids jsonb not null default '[]',
  misconceptions jsonb not null default '[]',
  last_judge jsonb,
  mastered_at timestamptz,
  kind text default 'practice'                      -- practice | recall
);

create table if not exists materials (                -- student-added study material (text only)
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  session_id uuid references sessions(id) on delete cascade,
  title text,
  text text,
  chars int,
  kind text
);

create table if not exists chats (                    -- learn-mode conversations
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  session_id uuid references sessions(id) on delete cascade,
  messages jsonb not null default '[]'
);

create table if not exists posts (                    -- class wall: students' own explanations
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  session_id uuid references sessions(id) on delete cascade,
  student_id uuid,
  week_id uuid,
  outcome_id uuid references outcomes(id) on delete cascade,
  alias text,
  content text not null,
  verified boolean default false                      -- author had passed the check on this outcome
);

create table if not exists votes (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  post_id uuid references posts(id) on delete cascade,
  student_id uuid,
  value int not null default 0
);

create table if not exists turns (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  attempt_id uuid references attempts(id) on delete cascade,
  role text not null,                               -- student | tutor
  content text not null,
  judge jsonb,
  meta jsonb
);

create index if not exists idx_weeks_course on weeks(course_id);
create index if not exists idx_outcomes_week on outcomes(week_id);
create index if not exists idx_sessions_week on sessions(week_id);
create index if not exists idx_attempts_session on attempts(session_id);
create index if not exists idx_attempts_outcome on attempts(outcome_id);
create index if not exists idx_turns_attempt on turns(attempt_id);
create index if not exists idx_outcomes_session on outcomes(session_id);
create index if not exists idx_materials_session on materials(session_id);
create index if not exists idx_chats_session on chats(session_id);
create index if not exists idx_posts_outcome on posts(outcome_id);
create index if not exists idx_votes_post on votes(post_id);

-- If you created the tables before the class-wall / learn-mode update, run these too:
alter table sessions add column if not exists student_id uuid;
alter table sessions add column if not exists kind text default 'practice';
alter table outcomes add column if not exists session_id uuid;
alter table outcomes add column if not exists kind text default 'week';
alter table attempts add column if not exists kind text default 'practice';

-- Demo RLS -------------------------------------------------------------------
alter table courses  enable row level security;
alter table weeks    enable row level security;
alter table outcomes enable row level security;
alter table sessions enable row level security;
alter table attempts enable row level security;
alter table turns    enable row level security;
alter table materials enable row level security;
alter table chats    enable row level security;
alter table posts    enable row level security;
alter table votes    enable row level security;

do $$
declare t text;
begin
  foreach t in array array['courses','weeks','outcomes','sessions','attempts','turns','materials','chats','posts','votes'] loop
    execute format('drop policy if exists demo_all on %I', t);
    execute format('create policy demo_all on %I for all to anon, authenticated using (true) with check (true)', t);
  end loop;
end $$;
