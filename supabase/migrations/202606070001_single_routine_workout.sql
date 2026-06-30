create extension if not exists "pgcrypto";

create table if not exists public.exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type text not null check (type in ('weighted', 'bodyweight', 'timed', 'cardio', 'mobility', 'superset')),
  position integer not null,
  default_weight numeric,
  default_sets integer not null default 3 check (default_sets > 0),
  is_superset boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.exercise_parts (
  id uuid primary key default gen_random_uuid(),
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  name text not null,
  position integer not null,
  tracking_type text not null check (tracking_type in ('reps', 'time', 'completed')),
  created_at timestamptz not null default now()
);

create table if not exists public.exercise_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  performed_at timestamptz not null default now(),
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.exercise_log_sets (
  id uuid primary key default gen_random_uuid(),
  exercise_log_id uuid not null references public.exercise_logs(id) on delete cascade,
  exercise_part_id uuid references public.exercise_parts(id) on delete cascade,
  set_number integer not null check (set_number > 0),
  reps integer check (reps >= 0),
  weight numeric check (weight >= 0),
  duration_seconds integer check (duration_seconds >= 0),
  activity_mode text check (activity_mode is null or activity_mode in ('running', 'walking')),
  incline numeric check (incline is null or incline >= 0),
  speed numeric check (speed is null or speed >= 0),
  completed boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index if not exists exercises_user_position_active_idx
  on public.exercises (user_id, position)
  where is_active = true;
create index if not exists exercise_parts_exercise_position_idx
  on public.exercise_parts (exercise_id, position);
create index if not exists exercise_logs_user_exercise_date_idx
  on public.exercise_logs (user_id, exercise_id, performed_at desc);
create index if not exists exercise_log_sets_log_set_idx
  on public.exercise_log_sets (exercise_log_id, set_number);

alter table public.exercises enable row level security;
alter table public.exercise_parts enable row level security;
alter table public.exercise_logs enable row level security;
alter table public.exercise_log_sets enable row level security;

drop policy if exists "Users manage own exercises" on public.exercises;
create policy "Users manage own exercises"
  on public.exercises for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users manage parts of own exercises" on public.exercise_parts;
create policy "Users manage parts of own exercises"
  on public.exercise_parts for all
  using (
    exists (
      select 1 from public.exercises
      where exercises.id = exercise_parts.exercise_id
        and exercises.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.exercises
      where exercises.id = exercise_parts.exercise_id
        and exercises.user_id = auth.uid()
    )
  );

drop policy if exists "Users manage own exercise logs" on public.exercise_logs;
create policy "Users manage own exercise logs"
  on public.exercise_logs for all
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.exercises
      where exercises.id = exercise_logs.exercise_id
        and exercises.user_id = auth.uid()
    )
  );

drop policy if exists "Users manage sets of own logs" on public.exercise_log_sets;
create policy "Users manage sets of own logs"
  on public.exercise_log_sets for all
  using (
    exists (
      select 1 from public.exercise_logs
      where exercise_logs.id = exercise_log_sets.exercise_log_id
        and exercise_logs.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.exercise_logs
      where exercise_logs.id = exercise_log_sets.exercise_log_id
        and exercise_logs.user_id = auth.uid()
        and (
          exercise_log_sets.exercise_part_id is null
          or exists (
            select 1 from public.exercise_parts
            where exercise_parts.id = exercise_log_sets.exercise_part_id
              and exercise_parts.exercise_id = exercise_logs.exercise_id
          )
        )
    )
  );
