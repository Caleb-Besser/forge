with ranked_exercises as (
  select
    id,
    row_number() over (
      partition by user_id, lower(trim(name))
      order by created_at, id
    ) as duplicate_rank
  from public.exercises
  where is_active = true
)
update public.exercises
set is_active = false
where id in (
  select id
  from ranked_exercises
  where duplicate_rank > 1
);

create unique index if not exists exercises_user_active_name_idx
  on public.exercises (user_id, lower(trim(name)))
  where is_active = true;

