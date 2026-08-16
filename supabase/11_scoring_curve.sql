-- ============================================================================
--  REPCLASH — load curve and rate compensation
--  Run AFTER 09_scoring_rates.sql and 10_more_exercises.sql. Safe to re-run.
--
--  ---------------------------------------------------------------------------
--  WHY
--
--  Second round of feedback, and a sharper one: incline dumbbell press was
--  outscoring bench press, and leg curls were outscoring leg press. Both times
--  the heavier, more demanding lift lost.
--
--  v1.7 fixed the rates. This fixes the shape of the curve underneath them.
--
--  The old load multiplier was min(1 + kg/60, 3). It topped out at 120 kg and
--  the whole range only spanned 1x to 3x, so going from 60 kg to 100 kg bought
--  you 33% more per rep while doing ten reps instead of five bought you 100%.
--  Volume beat intensity every time, no matter what the rates were.
--
--  Now:  load  = min(1 + kg/45, 4)     steeper, and doesn't cap until 135 kg
--        reps  = full up to 15, then half credit beyond
--
--  The rep taper is the other half of the complaint. A set of 25 is not two
--  and a half times a set of 10 — past about fifteen you're buying endurance,
--  not strength, and it shouldn't accumulate forever.
--
--  Heavy compounds keep their rates and so gain 20-25%, which is the point.
--  Everything else is trimmed by band below, so the compound-over-isolation
--  ordering from v1.7 survives intact.
--
--  As always: nothing already logged changes. effort_points is computed and
--  stored when a session is saved.
-- ============================================================================

-- Reps past 15 count half. One definition, used by both code paths below.
create or replace function app.eff_reps(p_reps int)
returns numeric
language sql immutable parallel safe as $$
  select case
    when coalesce(p_reps, 0) <= 15 then coalesce(p_reps, 0)::numeric
    else 15 + (p_reps - 15) * 0.5
  end;
$$;

-- The single-shape formula, for entries without per-set detail.
create or replace function public.entry_effort(
  p_kind text, p_ppu numeric,
  p_sets int, p_reps int, p_weight numeric, p_distance numeric, p_duration int
) returns int
language sql immutable parallel safe as $$
  select greatest(0, round(
    case p_kind
      when 'strength'   then p_ppu * coalesce(p_sets,1) * app.eff_reps(p_reps)
                             * least(1 + coalesce(p_weight,0) / 45.0, 4.0)
      when 'bodyweight' then p_ppu * coalesce(p_sets,1) * app.eff_reps(p_reps)
      when 'distance'   then p_ppu * coalesce(p_distance,0)
      when 'timed'      then p_ppu * coalesce(p_duration,0)
      else 0
    end
  ))::int;
$$;

-- And the per-set path: each set still priced on its own load, new curve.
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

  select wk.user_id into new.user_id from public.workouts wk where wk.id = new.workout_id;

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
        when 'strength' then ex.points_per_unit * app.eff_reps(r) * least(1 + w / 45.0, 4.0)
        else                 ex.points_per_unit * app.eff_reps(r)
      end;
    end loop;

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
--  Rate compensation. Heavy compounds (>= 1.00) are deliberately absent —
--  they keep their rate and take the full benefit of the steeper curve.
-- ---------------------------------------------------------------------------
update public.exercises e
set points_per_unit = r.rate
from (values
  ('floor-press', 0.87),
  ('t-bar-row', 0.87),
  ('meadows-row', 0.78),
  ('landmine-press', 0.74),
  ('good-morning', 0.74),
  ('weighted-lunge', 0.83),
  ('smith-split-squat', 0.75),
  ('smith-rdl', 0.83),
  ('smith-bench', 0.87),
  ('smith-incline-bench', 0.83),
  ('smith-overhead-press', 0.83),
  ('smith-row', 0.78),
  ('dumbbell-press', 0.87),
  ('incline-dumbbell-press', 0.83),
  ('dumbbell-row', 0.78),
  ('dumbbell-shoulder-press', 0.78),
  ('arnold-press', 0.78),
  ('goblet-squat', 0.74),
  ('bulgarian-split-squat', 0.87),
  ('dumbbell-rdl', 0.83),
  ('step-up', 0.74),
  ('kettlebell-clean', 0.69),
  ('kettlebell-snatch', 0.78),
  ('hack-squat', 0.34),
  ('pendulum-squat', 0.36),
  ('leg-press', 0.28),
  ('single-leg-press', 0.30),
  ('hip-thrust', 0.47),
  ('smith-hip-thrust', 0.42),
  ('hip-thrust-machine', 0.38),
  ('chest-press-machine', 0.47),
  ('incline-press-machine', 0.45),
  ('shoulder-press-machine', 0.47),
  ('lat-pulldown', 0.47),
  ('close-grip-pulldown', 0.45),
  ('seated-row', 0.47),
  ('chest-supported-row', 0.44),
  ('cable-row-single', 0.42),
  ('tricep-dip-machine', 0.31),
  ('kettlebell-swing', 0.47),
  ('barbell-curl', 0.34),
  ('preacher-curl', 0.32),
  ('skullcrusher', 0.33),
  ('bicep-curl', 0.34),
  ('hammer-curl', 0.34),
  ('concentration-curl', 0.32),
  ('tricep-extension', 0.33),
  ('dumbbell-skullcrusher', 0.33),
  ('dumbbell-kickback', 0.23),
  ('dumbbell-fly', 0.28),
  ('dumbbell-pullover', 0.31),
  ('lateral-raise', 0.29),
  ('dumbbell-front-raise', 0.26),
  ('dumbbell-rear-delt-fly', 0.25),
  ('upright-row', 0.34),
  ('leg-extension', 0.22),
  ('leg-curl', 0.25),
  ('seated-leg-curl', 0.25),
  ('pec-deck', 0.25),
  ('rear-delt-fly-machine', 0.19),
  ('pullover-machine', 0.26),
  ('back-extension-machine', 0.26),
  ('bicep-curl-machine', 0.26),
  ('ab-crunch-machine', 0.22),
  ('cable-fly-crossover', 0.26),
  ('low-cable-fly', 0.26),
  ('cable-lat-pullover', 0.26),
  ('straight-arm-pulldown', 0.25),
  ('face-pull', 0.23),
  ('cable-lateral-raise', 0.26),
  ('cable-front-raise', 0.25),
  ('cable-upright-row', 0.31),
  ('tricep-pushdown', 0.28),
  ('overhead-cable-extension', 0.29),
  ('cable-curl', 0.31),
  ('cable-hammer-curl', 0.31),
  ('cable-pull-through', 0.31),
  ('cable-crunch', 0.26),
  ('cable-woodchop', 0.25),
  ('pallof-press', 0.25),
  ('glute-kickback-machine', 0.18),
  ('cable-kickback', 0.18),
  ('barbell-shrug', 0.26),
  ('dumbbell-shrug', 0.25),
  ('smith-shrug', 0.23),
  ('hip-abduction', 0.11),
  ('hip-adduction', 0.11),
  ('calf-raise', 0.14),
  ('seated-calf-raise', 0.12),
  ('standing-calf-raise', 0.13),
  ('smith-calf-raise', 0.13),
  ('push-up', 0.47),
  ('diamond-push-up', 0.55),
  ('incline-push-up', 0.34),
  ('decline-push-up', 0.64),
  ('pike-push-up', 0.74),
  ('inverted-row', 0.74),
  ('assisted-dip', 0.83),
  ('air-squat', 0.26),
  ('jump-squat', 0.42),
  ('lunge', 0.36),
  ('glute-bridge', 0.22),
  ('box-jump', 0.78),
  ('jumping-jack', 0.11),
  ('mountain-climber', 0.14),
  ('sit-up', 0.26),
  ('decline-sit-up', 0.34),
  ('weighted-sit-up', 0.31),
  ('crunch', 0.18),
  ('bicycle-crunch', 0.16),
  ('russian-twist', 0.16),
  ('weighted-russian-twist', 0.23),
  ('leg-raise', 0.47),
  ('hanging-knee-raise', 0.41),
  ('toes-to-bar', 0.78),
  ('ab-wheel', 0.83),
  ('back-extension', 0.33)
) as r(id, rate)
where e.id = r.id;

-- ---------------------------------------------------------------------------
--  The two the reporter named specifically.
--
--  The band trim above isn't quite enough for these. Incline dumbbell press
--  sat close enough to flat bench per rep that ten reps of it beat five of
--  bench; leg curls likewise against leg press. Nudged down so the ordering
--  matches what anyone who's done both would expect.
-- ---------------------------------------------------------------------------
update public.exercises set points_per_unit = 0.80 where id = 'incline-dumbbell-press';
update public.exercises set points_per_unit = 0.20 where id = 'leg-curl';
update public.exercises set points_per_unit = 0.20 where id = 'seated-leg-curl';

grant execute on function public.entry_effort(text, numeric, int, int, numeric, numeric, int)
  to authenticated;