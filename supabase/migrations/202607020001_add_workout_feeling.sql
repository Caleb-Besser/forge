alter table public.exercise_logs
  add column if not exists feeling text;

alter table public.exercise_logs
  drop constraint if exists exercise_logs_feeling_check;

alter table public.exercise_logs
  add constraint exercise_logs_feeling_check
  check (
    feeling is null
    or feeling in ('great', 'good', 'okay', 'tough', 'rough')
  );
