create extension if not exists pgcrypto;

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  password_hash text not null,
  role text not null check (role in ('admin', 'proxy', 'supporter')),
  created_at timestamptz not null default now()
);

create table if not exists public.interviews (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  status text not null check (status in ('scheduled', 'passed', 'hold', 'failed', 'completed', 'cancelled', 'no_show')),
  color text not null,
  interviewer_id uuid not null,
  created_by_id uuid not null,
  date date not null,
  start_minutes integer not null,
  duration_minutes integer not null,
  step text not null default '',
  real_meeting_link text not null default '',
  support_meeting_link text not null default '',
  jd_link text not null default '',
  doc_link text not null default '',
  note text not null default '',
  resume_original_name text,
  resume_stored_name text,
  resume_mime text,
  resume_size integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint interviews_interviewer_id_fkey foreign key (interviewer_id) references public.users (id),
  constraint interviews_created_by_id_fkey foreign key (created_by_id) references public.users (id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  interview_id uuid not null references public.interviews (id) on delete cascade,
  user_id uuid not null,
  user_name text not null,
  user_role text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists interviews_schedule_idx on public.interviews (date, start_minutes);
create index if not exists interviews_interviewer_idx on public.interviews (interviewer_id);
create index if not exists messages_room_idx on public.messages (interview_id, created_at);

revoke all on table public.users from public, anon, authenticated;
revoke all on table public.interviews from public, anon, authenticated;
revoke all on table public.messages from public, anon, authenticated;
grant select, insert, update, delete on table public.users to service_role;
grant select, insert, update, delete on table public.interviews to service_role;
grant select, insert, update, delete on table public.messages to service_role;

alter table public.users enable row level security;
alter table public.interviews enable row level security;
alter table public.messages enable row level security;

notify pgrst, 'reload schema';
