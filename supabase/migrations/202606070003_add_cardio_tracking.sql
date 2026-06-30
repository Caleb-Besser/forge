alter table public.exercises
  drop constraint if exists exercises_type_check;

alter table public.exercises
  drop constraint if exists valid_exercise_type;

alter table public.exercises
  add constraint exercises_type_check
  check (type in ('weighted', 'bodyweight', 'timed', 'cardio', 'mobility', 'superset'));

alter table public.exercise_log_sets
  add column if not exists activity_mode text,
  add column if not exists incline numeric,
  add column if not exists speed numeric;

alter table public.exercise_log_sets
  drop constraint if exists exercise_log_sets_activity_mode_check;

alter table public.exercise_log_sets
  add constraint exercise_log_sets_activity_mode_check
  check (activity_mode is null or activity_mode in ('running', 'walking'));

alter table public.exercise_log_sets
  drop constraint if exists exercise_log_sets_incline_check;

alter table public.exercise_log_sets
  add constraint exercise_log_sets_incline_check
  check (incline is null or incline >= 0);

alter table public.exercise_log_sets
  drop constraint if exists exercise_log_sets_speed_check;

alter table public.exercise_log_sets
  add constraint exercise_log_sets_speed_check
  check (speed is null or speed >= 0);
