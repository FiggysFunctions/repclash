-- ============================================================================
--  REPCLASH — per-set logging and single-sided work
--  Run AFTER 01-07. Safe to re-run.
--
--  Two things people kept having to lie about:
--
--   1. Sets aren't uniform. Three sets of bench where the last one felt good
--      and went to ten is one exercise, not two entries. `set_detail` holds a
--      row per set, each with its own reps and weight, so drop sets, pyramids
--      and "one more than last week" all log honestly.
--
--   2. Single-arm and single-leg work is twice the sets. `per_side` says the
--      reps you entered were done on each side, and doubles the work.
--
--  Old-shape entries (plain sets/reps/weight) keep working exactly as before —
--  set_detail is simply null for them.
-- ============================================================================

alter table public.workout_entries
  add column if not exists set_detail   jsonb,
  add column if not exists per_side     boolean not null default false,
  -- Denormalised at write time so personal bests and goals stay simple, fast
  -- queries instead of unpacking JSON on every read.
  add column if not exists total_reps   int,
  add column if not exists total_volume numeric(10,2),
  add column if not exists top_e1rm     numeric(8,2);

-- Whether an exercise is done one side at a time.
--   'always' → single-sided by nature, toggle defaults on  (single-arm row)
--   'option' → commonly either way, toggle defaults off    (bicep curl)
--   null     → not applicable, no toggle shown             (bench press)
alter table public.exercises
  add column if not exists sided text check (sided in ('always','option'));

-- Shape check: an array of {"reps": n, "kg": n}. Nulls and absent are fine.
alter table public.workout_entries drop constraint if exists set_detail_is_array;
alter table public.workout_entries add constraint set_detail_is_array
  check (set_detail is null
         or (jsonb_typeof(set_detail) = 'array' and jsonb_array_length(set_detail) between 1 and 30));

-- ---------------------------------------------------------------------------
--  Scoring
--
--  Each set is scored on its own load, then summed — so a heavy triple plus
--  two lighter sets is worth what it should be, rather than what the average
--  would suggest.
-- ---------------------------------------------------------------------------
create or replace function app.fill_entry() returns trigger
language plpgsql security definer set search_path = public, app as $$
declare
  ex       public.exercises%rowtype;
  s        jsonb;
  r        int;
  w        numeric;
  eff      numeric := 0;
  tot_reps int := 0;
  tot_vol  numeric := 0;
  max_reps int := 0;
  max_kg   numeric := 0;
  max_e1rm numeric := 0;
  mult     int;
begin
  select * into ex from public.exercises where id = new.exercise_id;
  if not found then raise exception 'Unknown exercise %', new.exercise_id; end if;

  -- user_id always comes from the parent workout, never from the client
  select wk.user_id into new.user_id from public.workouts wk where wk.id = new.workout_id;

  -- Doing both sides only means anything for rep-based work.
  if ex.kind in ('strength','bodyweight') and coalesce(new.per_side, false) then
    mult := 2;
  else
    mult := 1;
    new.per_side := false;
  end if;

  if new.set_detail is not null and jsonb_array_length(new.set_detail) > 0 then
    for s in select value from jsonb_array_elements(new.set_detail) as t(value) loop
      r := greatest(0, coalesce((s->>'reps')::int, 0));
      w := greatest(0, coalesce((s->>'kg')::numeric, 0));

      tot_reps := tot_reps + r;
      tot_vol  := tot_vol + (r * w);
      max_reps := greatest(max_reps, r);
      max_kg   := greatest(max_kg, w);
      max_e1rm := greatest(max_e1rm, w * (1 + r / 30.0));

      eff := eff + case ex.kind
        when 'strength' then ex.points_per_unit * r * least(1 + w / 60.0, 3.0)
        else                 ex.points_per_unit * r
      end;
    end loop;

    -- Keep the flat columns meaningful: `reps` and `weight_kg` become the best
    -- single set, which is exactly what "most reps in a set" and "heaviest"
    -- should mean for a personal best.
    new.sets      := jsonb_array_length(new.set_detail);
    new.reps      := max_reps;
    new.weight_kg := nullif(max_kg, 0);

    new.total_reps    := tot_reps * mult;
    new.total_volume  := tot_vol * mult;
    new.top_e1rm      := max_e1rm;
    new.effort_points := greatest(0, round(eff * mult))::int;

  else
    new.set_detail    := null;
    new.total_reps    := coalesce(new.sets, 1) * coalesce(new.reps, 0) * mult;
    new.total_volume  := coalesce(new.sets, 1) * coalesce(new.reps, 0)
                         * coalesce(new.weight_kg, 0) * mult;
    new.top_e1rm      := coalesce(new.weight_kg, 0) * (1 + coalesce(new.reps, 0) / 30.0);
    new.effort_points := greatest(0, round(
        public.entry_effort(ex.kind, ex.points_per_unit, new.sets, new.reps,
                            new.weight_kg, new.distance_km, new.duration_min) * mult
      ))::int;
  end if;

  return new;
end $$;

-- ---------------------------------------------------------------------------
--  Backfill the new columns for everything already logged.
--
--  The trigger is disabled around this deliberately. It recomputes
--  effort_points from the *current* catalog, and points are meant to be fixed
--  at the moment you log them — letting it fire here would silently rescore
--  everyone's history against any rate that's been retuned since.
-- ---------------------------------------------------------------------------
alter table public.workout_entries disable trigger trg_fill_entry;

update public.workout_entries set
  total_reps   = coalesce(sets, 1) * coalesce(reps, 0),
  total_volume = coalesce(sets, 1) * coalesce(reps, 0) * coalesce(weight_kg, 0),
  top_e1rm     = coalesce(weight_kg, 0) * (1 + coalesce(reps, 0) / 30.0)
where total_reps is null;

alter table public.workout_entries enable trigger trg_fill_entry;

-- ---------------------------------------------------------------------------
--  One definition of what a metric is worth, now reading the stored columns.
--  Takes the whole row so callers can't pass the wrong combination.
-- ---------------------------------------------------------------------------
create or replace function app.metric_of(p_metric text, e public.workout_entries)
returns numeric
language sql immutable parallel safe as $$
  select case p_metric
    when 'weight'       then coalesce(e.weight_kg, 0)
    when 'reps'         then coalesce(e.reps, 0)::numeric      -- best single set
    when 'e1rm'         then coalesce(e.top_e1rm, 0)
    when 'volume'       then coalesce(e.total_volume, 0)
    when 'distance_km'  then coalesce(e.distance_km, 0)
    when 'duration_min' then coalesce(e.duration_min, 0)::numeric
    else 0
  end;
$$;

-- ---------------------------------------------------------------------------
--  Progression functions, rebuilt on the stored columns.
--  Dropped first because their return shapes change.
-- ---------------------------------------------------------------------------
drop function if exists public.my_exercise_summary();
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
  last_set_detail jsonb,
  last_per_side  boolean,
  best_weight    numeric,
  best_reps      int,
  best_e1rm      numeric,
  best_volume    numeric,
  best_distance  numeric,
  best_duration  int,
  best_pace      numeric
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
      m.exercise_id, m.performed_on, m.sets, m.reps, m.weight_kg,
      m.distance_km, m.duration_min, m.set_detail, m.per_side
    from mine m
    order by m.exercise_id, m.performed_on desc, m.w_created desc, m.created_at desc
  )
  select
    b.exercise_id, b.times_done,
    l.performed_on, l.sets, l.reps, l.weight_kg, l.distance_km, l.duration_min,
    l.set_detail, l.per_side,
    b.best_weight, b.best_reps, b.best_e1rm, b.best_volume,
    b.best_distance, b.best_duration, b.best_pace
  from (
    select
      m.exercise_id,
      count(*)::int                as times_done,
      max(m.weight_kg)             as best_weight,
      max(m.reps)                  as best_reps,
      round(max(m.top_e1rm), 1)    as best_e1rm,
      max(m.total_volume)          as best_volume,
      max(m.distance_km)           as best_distance,
      max(m.duration_min)          as best_duration,
      round(min(m.duration_min / nullif(m.distance_km, 0))
            filter (where m.duration_min > 0 and m.distance_km > 0), 2) as best_pace
    from mine m
    group by m.exercise_id
  ) b
  join latest l on l.exercise_id = b.exercise_id;
$$;

drop function if exists public.exercise_history(text, int);
create or replace function public.exercise_history(p_exercise text, p_limit int default 40)
returns table (
  performed_on date, sets int, reps int,
  weight_kg numeric, distance_km numeric, duration_min int,
  set_detail jsonb, per_side boolean,
  effort_points int, e1rm numeric, volume numeric
)
language sql stable security definer set search_path = public, app as $$
  select
    w.performed_on, e.sets, e.reps,
    e.weight_kg, e.distance_km, e.duration_min,
    e.set_detail, e.per_side,
    e.effort_points, round(coalesce(e.top_e1rm, 0), 1), coalesce(e.total_volume, 0)
  from public.workout_entries e
  join public.workouts w on w.id = e.workout_id
  where e.user_id = auth.uid() and e.exercise_id = p_exercise
  order by w.performed_on desc, e.created_at desc
  limit greatest(1, least(coalesce(p_limit, 40), 200));
$$;

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
      select max(app.metric_of(g.metric, e))
      from public.workout_entries e
      where e.user_id = g.user_id and e.exercise_id = g.exercise_id
    ), 0) as current,
    (
      select min(w.performed_on)
      from public.workout_entries e
      join public.workouts w on w.id = e.workout_id
      where e.user_id = g.user_id and e.exercise_id = g.exercise_id
        and app.metric_of(g.metric, e) >= g.target
    ) as achieved_on
  from public.goals g
  join public.exercises x on x.id = g.exercise_id
  where g.user_id = auth.uid() and g.archived_at is null
  order by (
    select min(w2.performed_on)
    from public.workout_entries e2
    join public.workouts w2 on w2.id = e2.workout_id
    where e2.user_id = g.user_id and e2.exercise_id = g.exercise_id
      and app.metric_of(g.metric, e2) >= g.target
  ) nulls first, g.created_at desc;
$$;

-- ---------------------------------------------------------------------------
--  The feed needs the per-set detail so it can show "8 · 8 · 10 @ 60 kg".
--  Same signature, so a plain replace is fine.
-- ---------------------------------------------------------------------------
create or replace function public.crew_feed(
  p_crew   uuid,
  p_limit  int         default 25,
  p_before timestamptz default null,
  p_user   uuid        default null
) returns table (
  workout_id   uuid,
  user_id      uuid,
  display_name text,
  avatar_emoji text,
  performed_on date,
  note         text,
  created_at   timestamptz,
  effort       int,
  is_mine      boolean,
  is_private   boolean,
  entries      json
)
language plpgsql stable security definer set search_path = public, app as $$
#variable_conflict use_column
begin
  if not app.is_member(p_crew) then raise exception 'Not a member of this crew'; end if;

  return query
  select
    w.id, w.user_id, p.display_name, p.avatar_emoji,
    w.performed_on, w.note, w.created_at,
    coalesce(sum(e.effort_points), 0)::int,
    (w.user_id = auth.uid()),
    w.is_private,
    coalesce(
      json_agg(
        json_build_object(
          'name',         ex.name,
          'emoji',        ex.emoji,
          'kind',         ex.kind,
          'category',     ex.category,
          'sets',         e.sets,
          'reps',         e.reps,
          'weight_kg',    e.weight_kg,
          'distance_km',  e.distance_km,
          'duration_min', e.duration_min,
          'set_detail',   e.set_detail,
          'per_side',     e.per_side,
          'points',       e.effort_points
        ) order by e.created_at
      ) filter (where e.id is not null),
      '[]'::json
    )
  from public.crew_members cm
  join public.workouts w  on w.user_id = cm.user_id
  join public.profiles p  on p.id = w.user_id
  left join public.workout_entries e on e.workout_id = w.id
  left join public.exercises ex      on ex.id = e.exercise_id
  where cm.crew_id = p_crew
    and (not w.is_private or w.user_id = auth.uid())
    and (p_user is null or w.user_id = p_user)
    and (p_before is null or w.created_at < p_before)
  group by w.id, w.user_id, p.display_name, p.avatar_emoji,
           w.performed_on, w.note, w.created_at, w.is_private
  order by w.created_at desc
  limit greatest(1, least(coalesce(p_limit, 25), 100));
end $$;

-- ---------------------------------------------------------------------------
--  Which exercises are single-sided.
--  Safe to re-run 02_exercises.sql afterwards: it doesn't touch this column.
-- ---------------------------------------------------------------------------
update public.exercises set sided = 'always' where id in (
  'dumbbell-row','cable-row-single','single-leg-press','concentration-curl',
  'bulgarian-split-squat','step-up','pistol-squat','turkish-get-up',
  'dumbbell-kickback','cable-kickback','glute-kickback-machine',
  'smith-split-squat','landmine-press'
);

update public.exercises set sided = 'option' where id in (
  'bicep-curl','hammer-curl','cable-curl','cable-hammer-curl','preacher-curl',
  'lateral-raise','cable-lateral-raise','dumbbell-front-raise','cable-front-raise',
  'tricep-extension','dumbbell-skullcrusher','overhead-cable-extension','tricep-pushdown',
  'leg-extension','leg-curl','seated-leg-curl','calf-raise','standing-calf-raise',
  'seated-calf-raise','lunge','weighted-lunge','dumbbell-shoulder-press',
  'farmers-carry','hip-abduction','hip-adduction'
);

grant execute on function public.my_exercise_summary(),
                          public.exercise_history(text, int),
                          public.my_goals(),
                          public.crew_feed(uuid, int, timestamptz, uuid)
  to authenticated;
