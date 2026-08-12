-- ============================================================================
--  REPCLASH — what each exercise is worth
--  Run AFTER 02_exercises.sql. Safe to re-run. This file owns
--  points_per_unit; 02 owns everything else about an exercise.
--
--  ---------------------------------------------------------------------------
--  WHY THIS FILE EXISTS
--
--  A crew member reported that machine curls outscored bench press. They were
--  right, and the cause was worse than it looked: barbell curls beat bench too.
--  It was never a machine problem, it was an isolation problem.
--
--  Effort is linear in reps, while the load multiplier is compressed —
--  min(1 + kg/60, 3) only ever spans 1x to 3x. So 60 reps of lateral raises at
--  12 kg (60 x 1.2 = 72 units) out-accumulated 25 reps of bench at 100 kg
--  (25 x 2.67 = 67 units), and the per-rep rates weren't far enough apart to
--  make up the difference. Anything done for high reps at light weight won.
--
--  The fix is to spread the rates out properly, in bands:
--
--    1.00 - 1.50   Heavy compound. Multi-joint, free weight, systemically
--                  demanding. Squat, deadlift, bench, press, Olympic lifts.
--    0.70 - 1.00   Compound. Multi-joint but supported, unilateral, or
--                  dumbbell. Split squats, DB pressing, rows.
--    0.40 - 0.70   Machine compound. Multi-joint on a fixed path — no
--                  stabilisation, and the loads are much higher, so the rate
--                  has to come down twice over.
--    0.25 - 0.40   Isolation. Single joint. Curls, extensions, flies,
--                  pushdowns — whatever the equipment.
--    0.12 - 0.25   Small isolation. Calves, delts, abductors, forearms.
--
--  Two things this deliberately does NOT do:
--
--    * It doesn't touch cardio, class or sport rates. Those are per km or per
--      minute and were never part of the complaint. Note that trimming lifting
--      makes cardio relatively stronger; if the crew notices, that's the next
--      dial to turn.
--    * It doesn't rescore anything already logged. app.fill_entry() computes
--      and stores effort_points at insert time, so history and current
--      standings are untouched. Only future sessions use these numbers.
-- ============================================================================

update public.exercises e
set points_per_unit = r.rate
from (values
  -- ==========================================================================
  --  HEAVY COMPOUND — 1.00 to 1.50
  -- ==========================================================================
  ('back-squat',            1.20),
  ('front-squat',           1.18),
  ('pause-squat',           1.25),
  ('box-squat',             1.15),
  ('deadlift',              1.30),
  ('sumo-deadlift',         1.28),
  ('romanian-deadlift',     1.05),
  ('rack-pull',             1.00),
  ('bench-press',           1.10),
  ('incline-bench',         1.05),
  ('close-grip-bench',      1.00),
  ('overhead-press',        1.10),
  ('push-press',            1.15),
  ('barbell-row',           1.00),
  ('pendlay-row',           1.00),
  ('power-clean',           1.40),
  ('snatch',                1.50),
  ('thruster',              1.25),
  ('devils-press',          1.20),
  ('turkish-get-up',        2.00),   -- per rep, and a rep takes a minute

  -- ==========================================================================
  --  COMPOUND — 0.70 to 1.00
  -- ==========================================================================
  ('floor-press',           0.95),
  ('t-bar-row',             0.95),
  ('meadows-row',           0.85),
  ('landmine-press',        0.80),
  ('good-morning',          0.80),
  ('weighted-lunge',        0.90),
  ('smith-squat',           1.00),
  ('smith-split-squat',     0.82),
  ('smith-rdl',             0.90),
  ('smith-bench',           0.95),
  ('smith-incline-bench',   0.90),
  ('smith-overhead-press',  0.90),
  ('smith-row',             0.85),
  ('dumbbell-press',        0.95),
  ('incline-dumbbell-press',0.90),
  ('dumbbell-row',          0.85),
  ('dumbbell-shoulder-press',0.85),
  ('arnold-press',          0.85),
  ('goblet-squat',          0.80),
  ('bulgarian-split-squat', 0.95),
  ('dumbbell-rdl',          0.90),
  ('step-up',               0.80),
  ('kettlebell-clean',      0.75),
  ('kettlebell-snatch',     0.85),
  ('weighted-pull-up',      2.00),   -- bodyweight plus the belt, per rep
  ('weighted-dip',          1.60),

  -- ==========================================================================
  --  MACHINE COMPOUND — 0.40 to 0.70
  -- ==========================================================================
  ('hack-squat',            0.40),
  ('pendulum-squat',        0.42),
  ('leg-press',             0.32),   -- the heaviest loads in the gym by far
  ('single-leg-press',      0.34),
  ('hip-thrust',            0.55),
  ('smith-hip-thrust',      0.50),
  ('hip-thrust-machine',    0.45),
  ('chest-press-machine',   0.55),
  ('incline-press-machine', 0.53),
  ('shoulder-press-machine',0.55),
  ('lat-pulldown',          0.55),
  ('close-grip-pulldown',   0.53),
  ('seated-row',            0.55),
  ('chest-supported-row',   0.52),
  ('cable-row-single',      0.50),
  ('tricep-dip-machine',    0.35),
  ('kettlebell-swing',      0.55),

  -- ==========================================================================
  --  ISOLATION — 0.25 to 0.40
  -- ==========================================================================
  ('barbell-curl',          0.40),
  ('preacher-curl',         0.36),
  ('skullcrusher',          0.38),
  ('bicep-curl',            0.40),
  ('hammer-curl',           0.40),
  ('concentration-curl',    0.36),
  ('tricep-extension',      0.38),
  ('dumbbell-skullcrusher', 0.38),
  ('dumbbell-kickback',     0.26),
  ('dumbbell-fly',          0.32),
  ('dumbbell-pullover',     0.35),
  ('lateral-raise',         0.33),
  ('dumbbell-front-raise',  0.30),
  ('dumbbell-rear-delt-fly',0.28),
  ('upright-row',           0.40),
  ('leg-extension',         0.25),
  ('leg-curl',              0.28),
  ('seated-leg-curl',       0.28),
  ('pec-deck',              0.28),
  ('rear-delt-fly-machine', 0.24),
  ('pullover-machine',      0.30),
  ('back-extension-machine',0.30),
  ('bicep-curl-machine',    0.30),
  ('ab-crunch-machine',     0.25),
  ('cable-fly-crossover',   0.30),
  ('low-cable-fly',         0.29),
  ('cable-lat-pullover',    0.29),
  ('straight-arm-pulldown', 0.28),
  ('face-pull',             0.26),
  ('cable-lateral-raise',   0.30),
  ('cable-front-raise',     0.28),
  ('cable-upright-row',     0.35),
  ('tricep-pushdown',       0.32),
  ('overhead-cable-extension',0.33),
  ('cable-curl',            0.35),
  ('cable-hammer-curl',     0.35),
  ('cable-pull-through',    0.35),
  ('cable-crunch',          0.30),
  ('cable-woodchop',        0.28),
  ('pallof-press',          0.28),
  ('glute-kickback-machine',0.22),
  ('cable-kickback',        0.22),

  -- ==========================================================================
  --  SMALL ISOLATION — 0.12 to 0.25
  -- ==========================================================================
  ('barbell-shrug',         0.30),
  ('dumbbell-shrug',        0.28),
  ('smith-shrug',           0.26),
  ('hip-abduction',         0.14),
  ('hip-adduction',         0.14),
  ('calf-raise',            0.18),
  ('seated-calf-raise',     0.15),
  ('standing-calf-raise',   0.16),
  ('smith-calf-raise',      0.16),

  -- ==========================================================================
  --  BODYWEIGHT — no load multiplier at all, so these are priced directly
  --  against how hard one rep is.
  -- ==========================================================================
  ('push-up',               0.55),
  ('diamond-push-up',       0.65),
  ('incline-push-up',       0.40),
  ('decline-push-up',       0.70),
  ('pike-push-up',          0.80),
  ('handstand-push-up',     3.50),
  ('pull-up',               2.00),
  ('wide-grip-pull-up',     2.10),
  ('neutral-grip-pull-up',  1.95),
  ('chin-up',               1.90),
  ('muscle-up',             4.50),
  ('dip',                   1.40),
  ('inverted-row',          0.80),
  ('assisted-pull-up',      1.20),
  ('assisted-dip',          0.90),
  ('air-squat',             0.30),
  ('jump-squat',            0.50),
  ('lunge',                 0.42),
  ('pistol-squat',          2.50),
  ('nordic-curl',           1.80),
  ('glute-bridge',          0.25),
  ('burpee',                1.60),
  ('box-jump',              0.85),
  ('jumping-jack',          0.14),
  ('mountain-climber',      0.18),
  ('wall-ball',             1.10),
  ('med-ball-slam',         1.00),

  -- ==========================================================================
  --  CORE
  -- ==========================================================================
  ('sit-up',                0.30),
  ('decline-sit-up',        0.40),
  ('weighted-sit-up',       0.35),
  ('crunch',                0.22),
  ('bicycle-crunch',        0.20),
  ('russian-twist',         0.20),
  ('weighted-russian-twist',0.26),
  ('leg-raise',             0.55),
  ('hanging-knee-raise',    0.48),
  ('toes-to-bar',           0.85),
  ('ab-wheel',              0.90),
  ('back-extension',        0.38)

) as r(id, rate)
where e.id = r.id;

-- ---------------------------------------------------------------------------
--  Anything rep-based that this file forgot keeps whatever rate 02 gave it,
--  which is almost certainly wrong now. Shout about it rather than let it hide.
-- ---------------------------------------------------------------------------
do $$
declare missed text;
begin
  select string_agg(id, ', ' order by id) into missed
  from public.exercises
  where kind in ('strength', 'bodyweight')
    and id not in (
      'back-squat','front-squat','pause-squat','box-squat','deadlift','sumo-deadlift',
      'romanian-deadlift','rack-pull','bench-press','incline-bench','close-grip-bench',
      'overhead-press','push-press','barbell-row','pendlay-row','power-clean','snatch',
      'thruster','devils-press','turkish-get-up','floor-press','t-bar-row','meadows-row',
      'landmine-press','good-morning','weighted-lunge','smith-squat','smith-split-squat',
      'smith-rdl','smith-bench','smith-incline-bench','smith-overhead-press','smith-row',
      'dumbbell-press','incline-dumbbell-press','dumbbell-row','dumbbell-shoulder-press',
      'arnold-press','goblet-squat','bulgarian-split-squat','dumbbell-rdl','step-up',
      'kettlebell-clean','kettlebell-snatch','weighted-pull-up','weighted-dip','hack-squat',
      'pendulum-squat','leg-press','single-leg-press','hip-thrust','smith-hip-thrust',
      'hip-thrust-machine','chest-press-machine','incline-press-machine',
      'shoulder-press-machine','lat-pulldown','close-grip-pulldown','seated-row',
      'chest-supported-row','cable-row-single','tricep-dip-machine','kettlebell-swing',
      'barbell-curl','preacher-curl','skullcrusher','bicep-curl','hammer-curl',
      'concentration-curl','tricep-extension','dumbbell-skullcrusher','dumbbell-kickback',
      'dumbbell-fly','dumbbell-pullover','lateral-raise','dumbbell-front-raise',
      'dumbbell-rear-delt-fly','upright-row','leg-extension','leg-curl','seated-leg-curl',
      'pec-deck','rear-delt-fly-machine','pullover-machine','back-extension-machine',
      'bicep-curl-machine','ab-crunch-machine','cable-fly-crossover','low-cable-fly',
      'cable-lat-pullover','straight-arm-pulldown','face-pull','cable-lateral-raise',
      'cable-front-raise','cable-upright-row','tricep-pushdown','overhead-cable-extension',
      'cable-curl','cable-hammer-curl','cable-pull-through','cable-crunch','cable-woodchop',
      'pallof-press','glute-kickback-machine','cable-kickback','barbell-shrug',
      'dumbbell-shrug','smith-shrug','hip-abduction','hip-adduction','calf-raise',
      'seated-calf-raise','standing-calf-raise','smith-calf-raise','push-up',
      'diamond-push-up','incline-push-up','decline-push-up','pike-push-up',
      'handstand-push-up','pull-up','wide-grip-pull-up','neutral-grip-pull-up','chin-up',
      'muscle-up','dip','inverted-row','assisted-pull-up','assisted-dip','air-squat',
      'jump-squat','lunge','pistol-squat','nordic-curl','glute-bridge','burpee','box-jump',
      'jumping-jack','mountain-climber','wall-ball','med-ball-slam','sit-up',
      'decline-sit-up','weighted-sit-up','crunch','bicycle-crunch','russian-twist',
      'weighted-russian-twist','leg-raise','hanging-knee-raise','toes-to-bar','ab-wheel',
      'back-extension'
    );

  if missed is not null then
    raise warning 'These rep-based exercises have no rate in 09_scoring_rates.sql: %', missed;
  else
    raise notice 'Scoring rates applied to every rep-based exercise.';
  end if;
end $$;
