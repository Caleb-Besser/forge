-- Introduce reusable workouts assigned to weekdays while preserving every
-- existing exercise log. Exercises remain the history-owning catalog records.

-- Forge previously used generic `workouts` table names with an incompatible
-- shape. These routine-specific names intentionally leave that legacy data
-- untouched.
create table if not exists public.routine_workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  weekday smallint not null check (weekday between 0 and 6),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.routine_workout_exercises (
  workout_id uuid not null references public.routine_workouts(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete restrict,
  position integer not null check (position > 0),
  created_at timestamptz not null default now(),
  primary key (workout_id, exercise_id),
  unique (workout_id, position)
);

create unique index if not exists routine_workouts_user_weekday_active_idx
  on public.routine_workouts (user_id, weekday)
  where is_active = true;
create index if not exists routine_workout_exercises_exercise_idx
  on public.routine_workout_exercises (exercise_id);

alter table public.routine_workouts enable row level security;
alter table public.routine_workout_exercises enable row level security;

drop policy if exists "Users manage own routine workouts" on public.routine_workouts;
create policy "Users manage own routine workouts"
  on public.routine_workouts for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users manage exercises in own routine workouts"
  on public.routine_workout_exercises;
create policy "Users manage exercises in own routine workouts"
  on public.routine_workout_exercises for all
  using (
    exists (
      select 1
      from public.routine_workouts
      where routine_workouts.id = routine_workout_exercises.workout_id
        and routine_workouts.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.routine_workouts
      join public.exercises on exercises.user_id = routine_workouts.user_id
      where routine_workouts.id = routine_workout_exercises.workout_id
        and exercises.id = routine_workout_exercises.exercise_id
        and routine_workouts.user_id = auth.uid()
    )
  );

create temporary table forge_routine_exercises (
  canonical_name text primary key,
  exercise_type text not null,
  aliases text[] not null
) on commit drop;

insert into forge_routine_exercises (canonical_name, exercise_type, aliases) values
  ('Goblet Squats', 'weighted', array['goblet squats']),
  ('Flat Dumbbell Press', 'weighted', array['flat dumbbell press']),
  ('Cable Rows', 'weighted', array['cable rows', 'cable row']),
  ('Dumbbell RDLs', 'weighted', array['dumbbell rdls', 'dumbbell romanian deadlifts', 'dumbell romanian deadlifts']),
  ('Lateral Raises', 'weighted', array['lateral raises', 'lateral raise']),
  ('Incline Dumbbell Curls', 'weighted', array['incline dumbbell curls', 'incline dumbbell curl']),
  ('Hanging L-Raises', 'bodyweight', array['hanging l-raises', 'hanging l raises', 'l-raises', 'l raises']),
  ('Bulgarian Split Squats', 'weighted', array['bulgarian split squats']),
  ('Low-Incline Dumbbell Press', 'weighted', array['low-incline dumbbell press', 'low incline dumbbell press', 'low incline dumbell press']),
  ('Pull-ups / Assisted Pull-ups / Negatives', 'bodyweight', array['pull-ups / assisted pull-ups / negatives', 'pull-ups', 'pull ups']),
  ('Dumbbell Shoulder Press', 'weighted', array['dumbbell shoulder press']),
  ('Bench Dips', 'bodyweight', array['bench dips', 'bench dip']),
  ('Rear-Delt Raises', 'weighted', array['rear-delt raises', 'rear-delt raise', 'rear delt raises', 'rear delt raise']),
  ('Planks', 'timed', array['planks', 'plank']),
  ('Push-ups', 'bodyweight', array['push-ups', 'push ups']),
  ('Dumbbell Calf Raises', 'weighted', array['dumbbell calf raises', 'dumbbell calf raise', 'dumbell calf raises']);

create temporary table forge_exercise_winners on commit drop as
with candidates as (
  select
    exercises.id,
    exercises.user_id,
    definitions.canonical_name,
    row_number() over (
      partition by exercises.user_id, definitions.canonical_name
      order by
        (select count(*) from public.exercise_logs where exercise_logs.exercise_id = exercises.id) desc,
        (lower(trim(exercises.name)) = lower(definitions.canonical_name)) desc,
        exercises.created_at
    ) as candidate_rank
  from public.exercises
  join forge_routine_exercises definitions
    on lower(trim(exercises.name)) = any(definitions.aliases)
  where exercises.is_active = true
)
select id, user_id, canonical_name
from candidates
where candidate_rank = 1;

-- Consolidate aliases and duplicates into the record carrying the most history.
update public.exercise_logs logs
set exercise_id = winners.id
from forge_exercise_winners winners
join forge_routine_exercises definitions
  on definitions.canonical_name = winners.canonical_name
join public.exercises duplicate
  on duplicate.user_id = winners.user_id
 and lower(trim(duplicate.name)) = any(definitions.aliases)
 and duplicate.id <> winners.id
where logs.exercise_id = duplicate.id;

update public.exercises duplicate
set is_active = false
from forge_exercise_winners winners
join forge_routine_exercises definitions
  on definitions.canonical_name = winners.canonical_name
where duplicate.user_id = winners.user_id
  and lower(trim(duplicate.name)) = any(definitions.aliases)
  and duplicate.id <> winners.id
  and duplicate.is_active = true;

update public.exercises exercise
set
  name = definitions.canonical_name,
  type = definitions.exercise_type,
  default_weight = null,
  default_sets = 1,
  is_superset = false
from forge_exercise_winners winners
join forge_routine_exercises definitions
  on definitions.canonical_name = winners.canonical_name
where exercise.id = winners.id;

-- Add only exercises that do not already have a history-owning catalog row.
with missing as (
  select
    users.id as user_id,
    definitions.canonical_name,
    definitions.exercise_type,
    row_number() over (
      partition by users.id
      order by definitions.canonical_name
    ) as offset_position
  from auth.users users
  cross join forge_routine_exercises definitions
  where not exists (
    select 1
    from public.exercises
    where exercises.user_id = users.id
      and exercises.is_active = true
      and lower(trim(exercises.name)) = lower(definitions.canonical_name)
  )
),
max_positions as (
  select user_id, coalesce(max(position), 0) as max_position
  from public.exercises
  group by user_id
)
insert into public.exercises (
  user_id, name, type, position, default_weight, default_sets, is_superset
)
select
  missing.user_id,
  missing.canonical_name,
  missing.exercise_type,
  coalesce(max_positions.max_position, 0) + missing.offset_position,
  null,
  1,
  false
from missing
left join max_positions on max_positions.user_id = missing.user_id;

-- Existing custom exercises also start with one input row when opened.
update public.exercises
set default_sets = 1, default_weight = null
where is_active = true;

insert into public.routine_workouts (user_id, name, weekday)
select users.id, schedule.name, schedule.weekday
from auth.users users
cross join (
  values
    ('Monday Workout', 1),
    ('Wednesday Workout', 3),
    ('Friday Workout', 5)
) as schedule(name, weekday)
where not exists (
  select 1
  from public.routine_workouts
  where routine_workouts.user_id = users.id
    and routine_workouts.weekday = schedule.weekday
    and routine_workouts.is_active = true
);

create temporary table forge_schedule (
  weekday smallint not null,
  position integer not null,
  exercise_name text not null
) on commit drop;

insert into forge_schedule (weekday, position, exercise_name) values
  (1, 1, 'Goblet Squats'),
  (1, 2, 'Flat Dumbbell Press'),
  (1, 3, 'Cable Rows'),
  (1, 4, 'Dumbbell RDLs'),
  (1, 5, 'Lateral Raises'),
  (1, 6, 'Incline Dumbbell Curls'),
  (1, 7, 'Hanging L-Raises'),
  (3, 1, 'Bulgarian Split Squats'),
  (3, 2, 'Low-Incline Dumbbell Press'),
  (3, 3, 'Pull-ups / Assisted Pull-ups / Negatives'),
  (3, 4, 'Dumbbell Shoulder Press'),
  (3, 5, 'Bench Dips'),
  (3, 6, 'Rear-Delt Raises'),
  (3, 7, 'Planks'),
  (5, 1, 'Dumbbell RDLs'),
  (5, 2, 'Push-ups'),
  (5, 3, 'Cable Rows'),
  (5, 4, 'Pull-ups / Assisted Pull-ups / Negatives'),
  (5, 5, 'Dumbbell Calf Raises'),
  (5, 6, 'Incline Dumbbell Curls'),
  (5, 7, 'Hanging L-Raises'),
  (5, 8, 'Planks');

insert into public.routine_workout_exercises (workout_id, exercise_id, position)
select workouts.id, exercises.id, schedule.position
from public.routine_workouts workouts
join forge_schedule schedule on schedule.weekday = workouts.weekday
join public.exercises exercises
  on exercises.user_id = workouts.user_id
 and lower(trim(exercises.name)) = lower(schedule.exercise_name)
 and exercises.is_active = true
where workouts.is_active = true
  and not exists (
    select 1
    from public.routine_workout_exercises existing_link
    where existing_link.workout_id = workouts.id
      and existing_link.exercise_id = exercises.id
  )
on conflict do nothing;
