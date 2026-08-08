-- ============================================================================
--  REPCLASH — exercise catalog
--  Re-runnable: existing rows are updated in place, so you can retune any
--  exercise's points and just run this file again.
--
--  points_per_unit meaning, by kind:
--    strength   → points per rep, then multiplied by load (1 + kg/60, max 3x)
--    bodyweight → points per rep
--    distance   → points per kilometre
--    timed      → points per minute
-- ============================================================================

insert into public.exercises (id, name, category, kind, points_per_unit, emoji, sort_order) values
  -- ---- Barbell / heavy compound -------------------------------------------
  ('back-squat',        'Back Squat',            'Strength',   'strength',   1.20, '🏋️',  10),
  ('front-squat',       'Front Squat',           'Strength',   'strength',   1.15, '🏋️',  11),
  ('deadlift',          'Deadlift',              'Strength',   'strength',   1.30, '🏋️',  12),
  ('romanian-deadlift', 'Romanian Deadlift',     'Strength',   'strength',   1.10, '🏋️',  13),
  ('bench-press',       'Bench Press',           'Strength',   'strength',   1.10, '🏋️',  14),
  ('incline-bench',     'Incline Bench Press',   'Strength',   'strength',   1.05, '🏋️',  15),
  ('overhead-press',    'Overhead Press',        'Strength',   'strength',   1.10, '🏋️',  16),
  ('barbell-row',       'Barbell Row',           'Strength',   'strength',   1.05, '🏋️',  17),
  ('power-clean',       'Power Clean',           'Strength',   'strength',   1.40, '🏋️',  18),
  ('snatch',            'Snatch',                'Strength',   'strength',   1.50, '🏋️',  19),
  ('hip-thrust',        'Hip Thrust',            'Strength',   'strength',   0.70, '🏋️',  20),
  ('weighted-lunge',    'Weighted Lunge',        'Strength',   'strength',   0.95, '🏋️',  21),

  -- ---- Dumbbell / machine / accessory -------------------------------------
  ('dumbbell-press',    'Dumbbell Press',        'Strength',   'strength',   1.00, '💪',  30),
  ('dumbbell-row',      'Dumbbell Row',          'Strength',   'strength',   0.90, '💪',  31),
  ('lat-pulldown',      'Lat Pulldown',          'Strength',   'strength',   0.85, '💪',  32),
  ('seated-row',        'Seated Cable Row',      'Strength',   'strength',   0.85, '💪',  33),
  ('leg-press',         'Leg Press',             'Strength',   'strength',   0.55, '💪',  34),
  ('leg-curl',          'Leg Curl',              'Strength',   'strength',   0.60, '💪',  35),
  ('leg-extension',     'Leg Extension',         'Strength',   'strength',   0.55, '💪',  36),
  ('lateral-raise',     'Lateral Raise',         'Strength',   'strength',   0.70, '💪',  37),
  ('bicep-curl',        'Bicep Curl',            'Strength',   'strength',   0.70, '💪',  38),
  ('tricep-extension',  'Tricep Extension',      'Strength',   'strength',   0.70, '💪',  39),
  ('calf-raise',        'Calf Raise',            'Strength',   'strength',   0.40, '💪',  40),
  ('kettlebell-swing',  'Kettlebell Swing',      'Strength',   'strength',   0.60, '💪',  41),
  ('weighted-pull-up',  'Weighted Pull-up',      'Strength',   'strength',   2.20, '💪',  42),
  ('weighted-dip',      'Weighted Dip',          'Strength',   'strength',   1.80, '💪',  43),

  -- ---- Bodyweight ----------------------------------------------------------
  ('push-up',           'Push-up',               'Bodyweight', 'bodyweight', 0.90, '🤸',  50),
  ('pull-up',           'Pull-up',               'Bodyweight', 'bodyweight', 3.00, '🤸',  51),
  ('chin-up',           'Chin-up',               'Bodyweight', 'bodyweight', 2.80, '🤸',  52),
  ('dip',               'Dip',                   'Bodyweight', 'bodyweight', 2.00, '🤸',  53),
  ('inverted-row',      'Inverted Row',          'Bodyweight', 'bodyweight', 1.20, '🤸',  54),
  ('air-squat',         'Bodyweight Squat',      'Bodyweight', 'bodyweight', 0.45, '🤸',  55),
  ('lunge',             'Lunge',                 'Bodyweight', 'bodyweight', 0.60, '🤸',  56),
  ('pistol-squat',      'Pistol Squat',          'Bodyweight', 'bodyweight', 3.50, '🤸',  57),
  ('burpee',            'Burpee',                'Bodyweight', 'bodyweight', 2.20, '🤸',  58),
  ('box-jump',          'Box Jump',              'Bodyweight', 'bodyweight', 1.20, '🤸',  59),
  ('handstand-push-up', 'Handstand Push-up',     'Bodyweight', 'bodyweight', 5.00, '🤸',  60),
  ('jumping-jack',      'Jumping Jack',          'Bodyweight', 'bodyweight', 0.20, '🤸',  61),
  ('mountain-climber',  'Mountain Climber',      'Bodyweight', 'bodyweight', 0.25, '🤸',  62),

  -- ---- Core ----------------------------------------------------------------
  ('sit-up',            'Sit-up',                'Core',       'bodyweight', 0.45, '🧘',  70),
  ('crunch',            'Crunch',                'Core',       'bodyweight', 0.35, '🧘',  71),
  ('leg-raise',         'Hanging Leg Raise',     'Core',       'bodyweight', 0.80, '🧘',  72),
  ('russian-twist',     'Russian Twist',         'Core',       'bodyweight', 0.30, '🧘',  73),
  ('plank',             'Plank',                 'Core',       'timed',     12.00, '🧘',  74),
  ('wall-sit',          'Wall Sit',              'Core',       'timed',      6.00, '🧘',  75),

  -- ---- Cardio (measured in km) ---------------------------------------------
  ('run',               'Run (outdoor)',         'Cardio',     'distance',  30.00, '🏃',  80),
  ('trail-run',         'Trail Run',             'Cardio',     'distance',  34.00, '🏃',  81),
  ('treadmill-run',     'Treadmill Run',         'Cardio',     'distance',  27.00, '🏃',  82),
  ('walk',              'Walk',                  'Cardio',     'distance',   8.00, '🚶',  83),
  ('hike',              'Hike',                  'Cardio',     'distance',  14.00, '🥾',  84),
  ('cycle',             'Cycle (outdoor)',       'Cardio',     'distance',  10.00, '🚴',  85),
  ('indoor-cycle',      'Indoor Bike',           'Cardio',     'distance',  12.00, '🚴',  86),
  ('swim',              'Swim',                  'Cardio',     'distance', 120.00, '🏊',  87),
  ('row-erg',           'Rowing Machine',        'Cardio',     'distance',  22.00, '🚣',  88),
  ('ski-erg',           'Ski Erg',               'Cardio',     'distance',  22.00, '⛷️',  89),
  ('elliptical',        'Elliptical',            'Cardio',     'distance',  12.00, '🏃',  90),
  ('stair-climb',       'Stair Climber',         'Cardio',     'distance',  40.00, '🪜',  91),
  ('jump-rope',         'Jump Rope',             'Cardio',     'timed',      8.00, '🪢',  92),

  -- ---- Classes & conditioning (measured in minutes) -------------------------
  ('hiit',              'HIIT Session',          'Class',      'timed',      7.00, '🔥', 100),
  ('crossfit-wod',      'CrossFit WOD',          'Class',      'timed',      8.00, '🔥', 101),
  ('circuit-training',  'Circuit Training',      'Class',      'timed',      6.50, '🔥', 102),
  ('spin-class',        'Spin Class',            'Class',      'timed',      6.00, '🚴', 103),
  ('rowing-class',      'Rowing Class',          'Class',      'timed',      6.50, '🚣', 104),
  ('boxing',            'Boxing',                'Class',      'timed',      7.00, '🥊', 105),
  ('martial-arts',      'Martial Arts',          'Class',      'timed',      6.50, '🥋', 106),
  ('strongman',         'Strongman Session',     'Class',      'timed',      7.00, '🪨', 107),
  ('yoga',              'Yoga',                  'Class',      'timed',      3.00, '🧘', 108),
  ('pilates',           'Pilates',               'Class',      'timed',      3.50, '🧘', 109),
  ('mobility',          'Mobility Work',         'Class',      'timed',      1.80, '🤾', 110),
  ('stretching',        'Stretching',            'Class',      'timed',      1.50, '🤸', 111),

  -- ---- Sport (measured in minutes) ------------------------------------------
  ('football',          'Football / Soccer',     'Sport',      'timed',      4.00, '⚽', 120),
  ('basketball',        'Basketball',            'Sport',      'timed',      4.50, '🏀', 121),
  ('rugby',             'Rugby',                 'Sport',      'timed',      5.00, '🏉', 122),
  ('hockey',            'Hockey',                'Sport',      'timed',      4.50, '🏒', 123),
  ('tennis',            'Tennis',                'Sport',      'timed',      4.00, '🎾', 124),
  ('padel',             'Padel',                 'Sport',      'timed',      3.80, '🎾', 125),
  ('squash',            'Squash',                'Sport',      'timed',      5.50, '🎾', 126),
  ('badminton',         'Badminton',             'Sport',      'timed',      3.50, '🏸', 127),
  ('climbing',          'Climbing / Bouldering', 'Sport',      'timed',      6.00, '🧗', 128),
  ('skiing',            'Skiing / Snowboarding', 'Sport',      'timed',      4.00, '🎿', 129),
  ('surfing',           'Surfing',               'Sport',      'timed',      3.50, '🏄', 130),
  ('dance',             'Dance',                 'Sport',      'timed',      3.00, '💃', 131),
  ('golf-walking',      'Golf (walking)',        'Sport',      'timed',      1.20, '⛳', 132)
on conflict (id) do update set
  name            = excluded.name,
  category        = excluded.category,
  kind            = excluded.kind,
  points_per_unit = excluded.points_per_unit,
  emoji           = excluded.emoji,
  sort_order      = excluded.sort_order,
  active          = true;
