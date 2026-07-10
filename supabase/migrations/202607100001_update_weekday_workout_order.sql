-- Replace the active weekday routine links with the current program while
-- preserving exercise records and all historical logs.

create temporary table forge_required_exercises (
  exercise_name text primary key,
  exercise_type text not null
) on commit drop;

insert into forge_required_exercises (exercise_name, exercise_type) values
  ('Goblet Squats', 'weighted'),
  ('Flat Dumbbell Press', 'weighted'),
  ('Dumbbell RDLs', 'weighted'),
  ('Lateral Raises', 'weighted'),
  ('Incline Dumbbell Curls', 'weighted'),
  ('Hanging L-Raises', 'bodyweight'),
  ('Planks', 'timed'),
  ('Cable Rows', 'weighted'),
  ('Bulgarian Split Squats', 'weighted'),
  ('Low-Incline Dumbbell Press', 'weighted'),
  ('Pull-ups / Assisted Pull-ups / Negatives', 'bodyweight'),
  ('Bench Dips', 'bodyweight'),
  ('Rear-Delt Raises', 'weighted'),
  ('Calf-Raise Machine', 'weighted'),
  ('Dumbbell Shoulder Press', 'weighted'),
  ('Push-ups', 'bodyweight');

with missing as (
  select
    users.id as user_id,
    required.exercise_name,
    required.exercise_type,
    row_number() over (
      partition by users.id
      order by required.exercise_name
    ) as offset_position
  from auth.users users
  cross join forge_required_exercises required
  where exists (
    select 1
    from public.routine_workouts workouts
    where workouts.user_id = users.id
      and workouts.is_active = true
      and workouts.weekday in (1, 3, 5)
  )
    and not exists (
      select 1
      from public.exercises exercises
      where exercises.user_id = users.id
        and exercises.is_active = true
        and lower(trim(exercises.name)) = lower(required.exercise_name)
    )
),
max_positions as (
  select user_id, coalesce(max(position), 0) as max_position
  from public.exercises
  where is_active = true
  group by user_id
)
insert into public.exercises (
  user_id, name, type, position, default_weight, default_sets, is_superset
)
select
  missing.user_id,
  missing.exercise_name,
  missing.exercise_type,
  coalesce(max_positions.max_position, 0) + missing.offset_position,
  null,
  1,
  false
from missing
left join max_positions on max_positions.user_id = missing.user_id;

create temporary table forge_schedule (
  weekday smallint not null,
  position integer not null,
  exercise_name text not null
) on commit drop;

insert into forge_schedule (weekday, position, exercise_name) values
  (1, 1, 'Goblet Squats'),
  (1, 2, 'Flat Dumbbell Press'),
  (1, 3, 'Dumbbell RDLs'),
  (1, 4, 'Lateral Raises'),
  (1, 5, 'Incline Dumbbell Curls'),
  (1, 6, 'Hanging L-Raises'),
  (1, 7, 'Planks'),
  (1, 8, 'Cable Rows'),
  (3, 1, 'Bulgarian Split Squats'),
  (3, 2, 'Low-Incline Dumbbell Press'),
  (3, 3, 'Pull-ups / Assisted Pull-ups / Negatives'),
  (3, 4, 'Bench Dips'),
  (3, 5, 'Rear-Delt Raises'),
  (3, 6, 'Planks'),
  (3, 7, 'Calf-Raise Machine'),
  (5, 1, 'Dumbbell RDLs'),
  (5, 2, 'Dumbbell Shoulder Press'),
  (5, 3, 'Pull-ups / Assisted Pull-ups / Negatives'),
  (5, 4, 'Push-ups'),
  (5, 5, 'Incline Dumbbell Curls'),
  (5, 6, 'Hanging L-Raises'),
  (5, 7, 'Planks'),
  (5, 8, 'Cable Rows');

create temporary table forge_updated_links on commit drop as
select
  workouts.id as workout_id,
  exercises.id as exercise_id,
  schedule.position
from public.routine_workouts workouts
join forge_schedule schedule on schedule.weekday = workouts.weekday
join public.exercises exercises
  on exercises.user_id = workouts.user_id
 and exercises.is_active = true
 and lower(trim(exercises.name)) = lower(schedule.exercise_name)
where workouts.is_active = true
  and workouts.weekday in (1, 3, 5);

delete from public.routine_workout_exercises links
using public.routine_workouts workouts
where links.workout_id = workouts.id
  and workouts.is_active = true
  and workouts.weekday in (1, 3, 5);

insert into public.routine_workout_exercises (workout_id, exercise_id, position)
select workout_id, exercise_id, position
from forge_updated_links;

update public.exercises exercises
set is_active = false
where exercises.is_active = true
  and lower(trim(exercises.name)) in ('dumbbell calf raises', 'dumbbell calf raise', 'dumbell calf raises')
  and not exists (
    select 1
    from public.exercise_logs logs
    where logs.exercise_id = exercises.id
  )
  and not exists (
    select 1
    from public.routine_workout_exercises links
    where links.exercise_id = exercises.id
  );
