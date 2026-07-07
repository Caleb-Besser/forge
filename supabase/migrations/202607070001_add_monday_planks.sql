-- Repair accounts whose Monday routine was created before Planks was part
-- of the default Monday workout.

create temporary table forge_plank_winners on commit drop as
with candidates as (
  select
    exercises.id,
    exercises.user_id,
    row_number() over (
      partition by exercises.user_id
      order by
        (lower(trim(exercises.name)) = 'planks') desc,
        (select count(*) from public.exercise_logs where exercise_logs.exercise_id = exercises.id) desc,
        exercises.created_at
    ) as candidate_rank
  from public.exercises
  where exercises.is_active = true
    and lower(trim(exercises.name)) in ('planks', 'plank')
)
select id, user_id
from candidates
where candidate_rank = 1;

update public.exercises exercises
set
  name = 'Planks',
  type = 'timed',
  default_weight = null,
  default_sets = 1,
  is_superset = false
from forge_plank_winners winners
where exercises.id = winners.id;

with missing as (
  select
    users.id as user_id,
    coalesce(max(exercises.position), 0) + 1 as position
  from auth.users users
  left join public.exercises
    on exercises.user_id = users.id
   and exercises.is_active = true
  where not exists (
    select 1
    from forge_plank_winners winners
    where winners.user_id = users.id
  )
  group by users.id
)
insert into public.exercises (
  user_id, name, type, position, default_weight, default_sets, is_superset
)
select
  missing.user_id,
  'Planks',
  'timed',
  missing.position,
  null,
  1,
  false
from missing;

with plank_exercises as (
  select
    exercises.id,
    exercises.user_id,
    row_number() over (
      partition by exercises.user_id
      order by exercises.created_at
    ) as exercise_rank
  from public.exercises
  where exercises.is_active = true
    and lower(trim(exercises.name)) = 'planks'
),
monday_workouts as (
  select
    workouts.id,
    workouts.user_id,
    coalesce(max(links.position), 0) + 1 as next_position
  from public.routine_workouts workouts
  left join public.routine_workout_exercises links
    on links.workout_id = workouts.id
  where workouts.weekday = 1
    and workouts.is_active = true
  group by workouts.id, workouts.user_id
)
insert into public.routine_workout_exercises (workout_id, exercise_id, position)
select
  workouts.id,
  planks.id,
  workouts.next_position
from monday_workouts workouts
join plank_exercises planks
  on planks.user_id = workouts.user_id
 and planks.exercise_rank = 1
where not exists (
  select 1
  from public.routine_workout_exercises existing_links
  join public.exercises existing_exercises
    on existing_exercises.id = existing_links.exercise_id
  where existing_links.workout_id = workouts.id
    and lower(trim(existing_exercises.name)) in ('planks', 'plank')
);
