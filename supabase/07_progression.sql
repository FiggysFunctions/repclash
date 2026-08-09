-- ============================================================================
--  REPCLASH — personal progression: history, personal bests and goals
--  Run AFTER 01-06. Safe to re-run.
--
--  This half of the app is deliberately NOT competitive. Everything here is
--  scoped to auth.uid() and visible to nobody else — it's the bit that helps
--  you beat last week, rather than beat your mates.
--
--  Nothing here touches scoring.
-- ============================================================================

-- ---------------------------------------------------------------------------
--  One entry, measured however you care to measure it.
--  Shared by personal bests and by goals so the two can never disagree.
--
--  e1rm is the Epley estimate: weight x (1 + reps/30). It's the standard way
--  to compare a heavy triple against a light set of ten, which is what
--  "am I getting stronger" actually means.
-- ---------------------------------------------------------------------------
create or replace function app.entry_metric(
  p_metric text,
  p_sets int, p_reps int, p_weight numeric, p_distance numeric, p_duration int
) returns numeric
language sql immutable parallel safe as $$
  select case p_metric
    when 'weight'       then coalesce(p_weight, 0)
    when 'reps'         then coalesce(p_reps, 0)::numeric
    when 'e1rm'         then coalesce(p_weight, 0) * (1 + coalesce(p_reps, 0) / 30.0)
    when 'volume'       then coalesce(p_sets, 1) * coalesce(p_reps, 0) * coalesce(p_weight, 0)
    when 'distance_km'  then coalesce(p_distance, 0)
    when 'duration_min' then coalesce(p_duration, 0)::numeric
    else 0
  end;
$$;

-- ---------------------------------------------------------------------------
--  Goals. One live goal per exercise per metric.
-- ---------------------------------------------------------------------------
create table if not exists public.goals (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  exercise_id text not null references public.exercises(id) on delete cascade,
  metric      text not null check (metric in
                ('weight','reps','e1rm','volume','distance_km','duration_min')),
  target      numeric(9,2) not null check (target > 0),
  note        text check (char_length(note) <= 140),
  created_at  timestamptz not null default now(),
  archived_at timestamptz
);

create unique index if not exists goals_one_live
  on public.goals (user_id, exercise_id, metric)
  where archived_at is null;

create index if not exists goals_user_idx on public.goals(user_id);

alter table public.goals enable row level security;

drop policy if exists goals_own on public.goals;
create policy goals_own on public.goals
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
--  Everything the app needs to prefill a set and show a personal best.
--  One row per exercise you've ever logged. Fetched once when the Log tab
--  opens, so the picker can show "last time" without a request per exercise.
-- ---------------------------------------------------------------------------
create or replace function public.my_exercise_summary()
returns table (
  exercise_id    text,
  times_done     int,
  last_on        date,
  last_sets      int,
  last_reps      int,
  last_weight    numeric,
  last_distance  numeric,
  last_duration  int,
  best_weight    numeric,
  best_reps      int,
  best_e1rm      numeric,
  best_volume    numeric,
  best_distance  numeric,
  best_duration  int,
  best_pace      numeric   -- minutes per km, lower is better
)
language sql stable security definer set search_path = public, app as $$
  with mine as (
    select e.*, w.performed_on, w.created_at as w_created
    from public.workout_entries e
    join public.workouts w on w.id = e.workout_id
    where e.user_id = auth.uid()
  ),
  latest as (
    select distinct on (m.exercise_id)
      m.exercise_id, m.performed_on, m.sets, m.reps,
      m.weight_kg, m.distance_km, m.duration_min
    from mine m
    order by m.exercise_id, m.performed_on desc, m.w_created desc, m.created_at desc
  )
  select
    b.exercise_id,
    b.times_done,
    l.performed_on, l.sets, l.reps, l.weight_kg, l.distance_km, l.duration_min,
    b.best_weight, b.best_reps, b.best_e1rm, b.best_volume,
    b.best_distance, b.best_duration, b.best_pace
  from (
    select
      m.exercise_id,
      count(*)::int                                          as times_done,
      max(m.weight_kg)                                       as best_weight,
      max(m.reps)                                            as best_reps,
      round(max(app.entry_metric('e1rm', m.sets, m.reps, m.weight_kg, null, null)), 1)
                                                             as best_e1rm,
      max(app.entry_metric('volume', m.sets, m.reps, m.weight_kg, null, null))
                                                             as best_volume,
      max(m.distance_km)                                     as best_distance,
      max(m.duration_min)                                    as best_duration,
      round(min(m.duration_min / nullif(m.distance_km, 0))
            filter (where m.duration_min > 0 and m.distance_km > 0), 2)
                                                             as best_pace
    from mine m
    group by m.exercise_id
  ) b
  join latest l on l.exercise_id = b.exercise_id;
$$;

-- ---------------------------------------------------------------------------
--  Every time you've done one exercise, newest first.
-- ---------------------------------------------------------------------------
create or replace function public.exercise_history(p_exercise text, p_limit int default 40)
returns table (
  performed_on date, sets int, reps int,
  weight_kg numeric, distance_km numeric, duration_min int,
  effort_points int, e1rm numeric, volume numeric
)
language sql stable security definer set search_path = public, app as $$
  select
    w.performed_on, e.sets, e.reps,
    e.weight_kg, e.distance_km, e.duration_min, e.effort_points,
    round(app.entry_metric('e1rm',   e.sets, e.reps, e.weight_kg, null, null), 1),
    app.entry_metric('volume', e.sets, e.reps, e.weight_kg, null, null)
  from public.workout_entries e
  join public.workouts w on w.id = e.workout_id
  where e.user_id = auth.uid() and e.exercise_id = p_exercise
  order by w.performed_on desc, e.created_at desc
  limit greatest(1, least(coalesce(p_limit, 40), 200));
$$;

-- ---------------------------------------------------------------------------
--  Goals, with progress worked out rather than stored.
--
--  achieved_on is derived: the first day an entry met the target. That means
--  it stays correct if you delete a session, and if you raise a target that
--  you'd already beaten it simply becomes unachieved again.
-- ---------------------------------------------------------------------------
create or replace function public.my_goals()
returns table (
  id uuid, exercise_id text, exercise_name text, exercise_emoji text,
  metric text, target numeric, note text, created_at timestamptz,
  current numeric, achieved_on date
)
language sql stable security definer set search_path = public, app as $$
  select
    g.id, g.exercise_id, x.name, x.emoji,
    g.metric, g.target, g.note, g.created_at,
    coalesce((
      select max(app.entry_metric(g.metric, e.sets, e.reps,
                                  e.weight_kg, e.distance_km, e.duration_min))
      from public.workout_entries e
      where e.user_id = g.user_id and e.exercise_id = g.exercise_id
    ), 0) as current,
    (
      select min(w.performed_on)
      from public.workout_entries e
      join public.workouts w on w.id = e.workout_id
      where e.user_id = g.user_id and e.exercise_id = g.exercise_id
        and app.entry_metric(g.metric, e.sets, e.reps,
                             e.weight_kg, e.distance_km, e.duration_min) >= g.target
    ) as achieved_on
  from public.goals g
  join public.exercises x on x.id = g.exercise_id
  where g.user_id = auth.uid() and g.archived_at is null
  order by (
    select min(w2.performed_on) from public.workout_entries e2
    join public.workouts w2 on w2.id = e2.workout_id
    where e2.user_id = g.user_id and e2.exercise_id = g.exercise_id
      and app.entry_metric(g.metric, e2.sets, e2.reps,
                           e2.weight_kg, e2.distance_km, e2.duration_min) >= g.target
  ) nulls first, g.created_at desc;
$$;

-- Upsert: setting a goal for an exercise+metric you already have replaces it.
create or replace function public.set_goal(
  p_exercise text, p_metric text, p_target numeric, p_note text default null
) returns public.goals
language plpgsql volatile security definer set search_path = public, app as $$
declare g public.goals;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;

  update public.goals
     set target = p_target, note = p_note, created_at = now()
   where user_id = auth.uid() and exercise_id = p_exercise
     and metric = p_metric and archived_at is null
  returning * into g;

  if not found then
    insert into public.goals (user_id, exercise_id, metric, target, note)
    values (auth.uid(), p_exercise, p_metric, p_target, p_note)
    returning * into g;
  end if;

  return g;
end $$;

create or replace function public.drop_goal(p_goal uuid)
returns void
language sql volatile security definer set search_path = public, app as $$
  update public.goals set archived_at = now()
  where id = p_goal and user_id = auth.uid() and archived_at is null;
$$;

grant select, insert, update, delete on public.goals to authenticated;
grant execute on function public.my_exercise_summary(),
                          public.exercise_history(text, int),
                          public.my_goals(),
                          public.set_goal(text, text, numeric, text),
                          public.drop_goal(uuid)
  to authenticated;
