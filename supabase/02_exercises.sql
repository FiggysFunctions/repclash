-- ============================================================================
--  REPCLASH — exercise catalog
--  Re-runnable: existing rows are updated in place, so you can retune any
--  exercise's points, rename it, or add new ones and just run this file again.
--
--  IDs are permanent. Every logged set points at one, so renaming an id would
--  orphan people's history and personal bests. Change the `name` freely; never
--  change an `id` that has shipped.
--
--  points_per_unit meaning, by kind:
--    strength   → points per rep, then multiplied by load (1 + kg/60, max 3x)
--    bodyweight → points per rep
--    distance   → points per kilometre
--    timed      → points per minute
--
--  Tuning note for machines: leg press, hip abduction and the like get loaded
--  with far more weight than a barbell lift, and the load multiplier caps at 3x
--  (120 kg). So a machine's points_per_unit is deliberately much lower than a
--  free-weight movement's — otherwise a 100 kg abduction would outscore a
--  100 kg squat, which would be daft.
-- ============================================================================

-- Filtering metadata. Purely for finding things in a 200-item picker; nothing
-- downstream scores off it. `category` is what the weekly challenges filter on,
-- so all weights work stays under 'Strength' regardless of equipment.
alter table public.exercises
  add column if not exists muscle    text,
  add column if not exists equipment text;

insert into public.exercises
  (id, name, category, kind, points_per_unit, emoji, sort_order, muscle, equipment) values

  -- ==========================================================================
  --  BARBELL
  -- ==========================================================================
  ('back-squat',        'Back Squat',              'Strength','strength',1.20,'🏋️', 10,'Legs','Barbell'),
  ('front-squat',       'Front Squat',             'Strength','strength',1.15,'🏋️', 11,'Legs','Barbell'),
  ('pause-squat',       'Pause Squat',             'Strength','strength',1.25,'🏋️', 12,'Legs','Barbell'),
  ('box-squat',         'Box Squat',               'Strength','strength',1.15,'🏋️', 13,'Legs','Barbell'),
  ('deadlift',          'Deadlift',                'Strength','strength',1.30,'🏋️', 14,'Back','Barbell'),
  ('sumo-deadlift',     'Sumo Deadlift',           'Strength','strength',1.28,'🏋️', 15,'Back','Barbell'),
  ('romanian-deadlift', 'Romanian Deadlift',       'Strength','strength',1.10,'🏋️', 16,'Legs','Barbell'),
  ('rack-pull',         'Rack Pull',               'Strength','strength',1.10,'🏋️', 17,'Back','Barbell'),
  ('good-morning',      'Good Morning',            'Strength','strength',0.90,'🏋️', 18,'Legs','Barbell'),
  ('bench-press',       'Bench Press',             'Strength','strength',1.10,'🏋️', 19,'Chest','Barbell'),
  ('incline-bench',     'Incline Bench Press',     'Strength','strength',1.05,'🏋️', 20,'Chest','Barbell'),
  ('close-grip-bench',  'Close-Grip Bench Press',  'Strength','strength',1.05,'🏋️', 21,'Arms','Barbell'),
  ('floor-press',       'Floor Press',             'Strength','strength',1.00,'🏋️', 22,'Chest','Barbell'),
  ('overhead-press',    'Overhead Press',          'Strength','strength',1.10,'🏋️', 23,'Shoulders','Barbell'),
  ('push-press',        'Push Press',              'Strength','strength',1.20,'🏋️', 24,'Shoulders','Barbell'),
  ('barbell-row',       'Barbell Row',             'Strength','strength',1.05,'🏋️', 25,'Back','Barbell'),
  ('pendlay-row',       'Pendlay Row',             'Strength','strength',1.05,'🏋️', 26,'Back','Barbell'),
  ('t-bar-row',         'T-Bar Row',               'Strength','strength',1.00,'🏋️', 27,'Back','Barbell'),
  ('landmine-press',    'Landmine Press',          'Strength','strength',0.90,'🏋️', 28,'Shoulders','Barbell'),
  ('upright-row',       'Upright Row',             'Strength','strength',0.65,'🏋️', 29,'Shoulders','Barbell'),
  ('barbell-shrug',     'Barbell Shrug',           'Strength','strength',0.50,'🏋️', 30,'Back','Barbell'),
  ('barbell-curl',      'Barbell Curl',            'Strength','strength',0.75,'🏋️', 31,'Arms','Barbell'),
  ('preacher-curl',     'Preacher Curl',           'Strength','strength',0.70,'🏋️', 32,'Arms','Barbell'),
  ('skullcrusher',      'Skullcrusher',            'Strength','strength',0.75,'🏋️', 33,'Arms','Barbell'),
  ('hip-thrust',        'Barbell Hip Thrust',      'Strength','strength',0.70,'🏋️', 34,'Glutes','Barbell'),
  ('weighted-lunge',    'Barbell Lunge',           'Strength','strength',0.95,'🏋️', 35,'Legs','Barbell'),
  ('power-clean',       'Power Clean',             'Strength','strength',1.40,'🏋️', 36,'Full body','Barbell'),
  ('snatch',            'Snatch',                  'Strength','strength',1.50,'🏋️', 37,'Full body','Barbell'),
  ('thruster',          'Thruster',                'Strength','strength',1.25,'🏋️', 38,'Full body','Barbell'),

  -- ==========================================================================
  --  SMITH MACHINE
  -- ==========================================================================
  ('smith-squat',        'Smith Machine Squat',          'Strength','strength',1.05,'🏋️', 50,'Legs','Smith machine'),
  ('smith-split-squat',  'Smith Machine Split Squat',    'Strength','strength',0.90,'🏋️', 51,'Legs','Smith machine'),
  ('smith-rdl',          'Smith Machine Romanian Deadlift','Strength','strength',0.95,'🏋️',52,'Legs','Smith machine'),
  ('smith-bench',        'Smith Machine Bench Press',    'Strength','strength',1.00,'🏋️', 53,'Chest','Smith machine'),
  ('smith-incline-bench','Smith Machine Incline Press',  'Strength','strength',0.95,'🏋️', 54,'Chest','Smith machine'),
  ('smith-overhead-press','Smith Machine Shoulder Press','Strength','strength',0.95,'🏋️', 55,'Shoulders','Smith machine'),
  ('smith-row',          'Smith Machine Row',            'Strength','strength',0.90,'🏋️', 56,'Back','Smith machine'),
  ('smith-shrug',        'Smith Machine Shrug',          'Strength','strength',0.45,'🏋️', 57,'Back','Smith machine'),
  ('smith-hip-thrust',   'Smith Machine Hip Thrust',     'Strength','strength',0.65,'🏋️', 58,'Glutes','Smith machine'),
  ('smith-calf-raise',   'Smith Machine Calf Raise',     'Strength','strength',0.35,'🏋️', 59,'Legs','Smith machine'),

  -- ==========================================================================
  --  DUMBBELL
  --  Enter the total weight you're holding, not per hand.
  -- ==========================================================================
  ('dumbbell-press',        'Dumbbell Bench Press',      'Strength','strength',1.00,'💪', 80,'Chest','Dumbbell'),
  ('incline-dumbbell-press','Incline Dumbbell Press',    'Strength','strength',0.95,'💪', 81,'Chest','Dumbbell'),
  ('dumbbell-fly',          'Dumbbell Fly',              'Strength','strength',0.70,'💪', 82,'Chest','Dumbbell'),
  ('dumbbell-pullover',     'Dumbbell Pullover',         'Strength','strength',0.65,'💪', 83,'Chest','Dumbbell'),
  ('dumbbell-row',          'Dumbbell Row',              'Strength','strength',0.90,'💪', 84,'Back','Dumbbell'),
  ('dumbbell-shrug',        'Dumbbell Shrug',            'Strength','strength',0.48,'💪', 85,'Back','Dumbbell'),
  ('dumbbell-shoulder-press','Dumbbell Shoulder Press',  'Strength','strength',0.90,'💪', 86,'Shoulders','Dumbbell'),
  ('arnold-press',          'Arnold Press',              'Strength','strength',0.88,'💪', 87,'Shoulders','Dumbbell'),
  ('lateral-raise',         'Lateral Raise',             'Strength','strength',0.70,'💪', 88,'Shoulders','Dumbbell'),
  ('dumbbell-front-raise',  'Front Raise',               'Strength','strength',0.60,'💪', 89,'Shoulders','Dumbbell'),
  ('dumbbell-rear-delt-fly','Rear Delt Fly',             'Strength','strength',0.55,'💪', 90,'Shoulders','Dumbbell'),
  ('bicep-curl',            'Dumbbell Curl',             'Strength','strength',0.70,'💪', 91,'Arms','Dumbbell'),
  ('hammer-curl',           'Hammer Curl',               'Strength','strength',0.70,'💪', 92,'Arms','Dumbbell'),
  ('concentration-curl',    'Concentration Curl',        'Strength','strength',0.65,'💪', 93,'Arms','Dumbbell'),
  ('tricep-extension',      'Overhead Tricep Extension', 'Strength','strength',0.70,'💪', 94,'Arms','Dumbbell'),
  ('dumbbell-skullcrusher', 'Dumbbell Skullcrusher',     'Strength','strength',0.70,'💪', 95,'Arms','Dumbbell'),
  ('dumbbell-kickback',     'Tricep Kickback',           'Strength','strength',0.55,'💪', 96,'Arms','Dumbbell'),
  ('goblet-squat',          'Goblet Squat',              'Strength','strength',0.85,'💪', 97,'Legs','Dumbbell'),
  ('bulgarian-split-squat', 'Bulgarian Split Squat',     'Strength','strength',1.00,'💪', 98,'Legs','Dumbbell'),
  ('dumbbell-rdl',          'Dumbbell Romanian Deadlift','Strength','strength',0.95,'💪', 99,'Legs','Dumbbell'),
  ('step-up',               'Weighted Step-up',          'Strength','strength',0.85,'💪',100,'Legs','Dumbbell'),
  ('calf-raise',            'Dumbbell Calf Raise',       'Strength','strength',0.40,'💪',101,'Legs','Dumbbell'),

  -- ==========================================================================
  --  RESISTANCE MACHINES
  -- ==========================================================================
  ('hack-squat',            'Hack Squat',                'Strength','strength',0.60,'🎚️',120,'Legs','Machine'),
  ('pendulum-squat',        'Pendulum Squat',            'Strength','strength',0.62,'🎚️',121,'Legs','Machine'),
  ('leg-press',             'Leg Press',                 'Strength','strength',0.55,'🎚️',122,'Legs','Machine'),
  ('single-leg-press',      'Single-Leg Press',          'Strength','strength',0.55,'🎚️',123,'Legs','Machine'),
  ('leg-extension',         'Leg Extension',             'Strength','strength',0.55,'🎚️',124,'Legs','Machine'),
  ('leg-curl',              'Lying Leg Curl',            'Strength','strength',0.60,'🎚️',125,'Legs','Machine'),
  ('seated-leg-curl',       'Seated Leg Curl',           'Strength','strength',0.60,'🎚️',126,'Legs','Machine'),
  ('hip-abduction',         'Hip Abduction Machine',     'Strength','strength',0.35,'🎚️',127,'Glutes','Machine'),
  ('hip-adduction',         'Hip Adduction Machine',     'Strength','strength',0.35,'🎚️',128,'Legs','Machine'),
  ('glute-kickback-machine','Glute Kickback Machine',    'Strength','strength',0.45,'🎚️',129,'Glutes','Machine'),
  ('hip-thrust-machine',    'Hip Thrust Machine',        'Strength','strength',0.60,'🎚️',130,'Glutes','Machine'),
  ('seated-calf-raise',     'Seated Calf Raise',         'Strength','strength',0.35,'🎚️',131,'Legs','Machine'),
  ('standing-calf-raise',   'Standing Calf Raise',       'Strength','strength',0.38,'🎚️',132,'Legs','Machine'),
  ('chest-press-machine',   'Chest Press Machine',       'Strength','strength',0.70,'🎚️',133,'Chest','Machine'),
  ('incline-press-machine', 'Incline Press Machine',     'Strength','strength',0.68,'🎚️',134,'Chest','Machine'),
  ('pec-deck',              'Pec Deck (Chest Fly)',      'Strength','strength',0.55,'🎚️',135,'Chest','Machine'),
  ('shoulder-press-machine','Shoulder Press Machine',    'Strength','strength',0.70,'🎚️',136,'Shoulders','Machine'),
  ('rear-delt-fly-machine', 'Rear Delt Fly Machine',     'Strength','strength',0.50,'🎚️',137,'Shoulders','Machine'),
  ('lat-pulldown',          'Lat Pulldown',              'Strength','strength',0.85,'🎚️',138,'Back','Machine'),
  ('close-grip-pulldown',   'Close-Grip Pulldown',       'Strength','strength',0.82,'🎚️',139,'Back','Machine'),
  ('seated-row',            'Seated Cable Row',          'Strength','strength',0.85,'🎚️',140,'Back','Machine'),
  ('chest-supported-row',   'Chest-Supported Row',       'Strength','strength',0.80,'🎚️',141,'Back','Machine'),
  ('pullover-machine',      'Pullover Machine',          'Strength','strength',0.60,'🎚️',142,'Back','Machine'),
  ('back-extension-machine','Back Extension Machine',    'Strength','strength',0.50,'🎚️',143,'Back','Machine'),
  ('bicep-curl-machine',    'Bicep Curl Machine',        'Strength','strength',0.60,'🎚️',144,'Arms','Machine'),
  ('tricep-dip-machine',    'Tricep Dip Machine',        'Strength','strength',0.65,'🎚️',145,'Arms','Machine'),
  ('ab-crunch-machine',     'Ab Crunch Machine',         'Core',    'strength',0.45,'🎚️',146,'Core','Machine'),
  -- Assisted work is measured in reps on purpose: the machine's weight is help,
  -- not load, so scoring it would pay you more for taking more assistance.
  ('assisted-pull-up',      'Assisted Pull-up',          'Bodyweight','bodyweight',1.60,'🎚️',147,'Back','Machine'),
  ('assisted-dip',          'Assisted Dip',              'Bodyweight','bodyweight',1.20,'🎚️',148,'Arms','Machine'),

  -- ==========================================================================
  --  CABLES
  -- ==========================================================================
  ('cable-fly-crossover',  'Cable Fly Crossover',        'Strength','strength',0.60,'🔗',170,'Chest','Cable'),
  ('low-cable-fly',        'Low-to-High Cable Fly',      'Strength','strength',0.58,'🔗',171,'Chest','Cable'),
  ('cable-lat-pullover',   'Cable Lat Pullover',         'Strength','strength',0.58,'🔗',172,'Back','Cable'),
  ('straight-arm-pulldown','Straight-Arm Pulldown',      'Strength','strength',0.55,'🔗',173,'Back','Cable'),
  ('cable-row-single',     'Single-Arm Cable Row',       'Strength','strength',0.75,'🔗',174,'Back','Cable'),
  ('face-pull',            'Face Pull',                  'Strength','strength',0.55,'🔗',175,'Shoulders','Cable'),
  ('cable-lateral-raise',  'Cable Lateral Raise',        'Strength','strength',0.60,'🔗',176,'Shoulders','Cable'),
  ('cable-front-raise',    'Cable Front Raise',          'Strength','strength',0.55,'🔗',177,'Shoulders','Cable'),
  ('cable-upright-row',    'Cable Upright Row',          'Strength','strength',0.60,'🔗',178,'Shoulders','Cable'),
  ('tricep-pushdown',      'Tricep Pushdown',            'Strength','strength',0.60,'🔗',179,'Arms','Cable'),
  ('overhead-cable-extension','Overhead Cable Extension','Strength','strength',0.62,'🔗',180,'Arms','Cable'),
  ('cable-curl',           'Cable Curl',                 'Strength','strength',0.65,'🔗',181,'Arms','Cable'),
  ('cable-hammer-curl',    'Cable Hammer Curl',          'Strength','strength',0.65,'🔗',182,'Arms','Cable'),
  ('cable-pull-through',   'Cable Pull-Through',         'Strength','strength',0.55,'🔗',183,'Glutes','Cable'),
  ('cable-kickback',       'Cable Glute Kickback',       'Strength','strength',0.45,'🔗',184,'Glutes','Cable'),
  ('cable-crunch',         'Cable Crunch',               'Core',    'strength',0.55,'🔗',185,'Core','Cable'),
  ('cable-woodchop',       'Cable Woodchop',             'Core',    'strength',0.50,'🔗',186,'Core','Cable'),
  ('pallof-press',         'Pallof Press',               'Core',    'strength',0.50,'🔗',187,'Core','Cable'),

  -- ==========================================================================
  --  KETTLEBELL & FUNCTIONAL
  -- ==========================================================================
  ('kettlebell-swing',   'Kettlebell Swing',      'Strength','strength',0.60,'🪨',200,'Full body','Kettlebell'),
  ('kettlebell-clean',   'Kettlebell Clean',      'Strength','strength',0.80,'🪨',201,'Full body','Kettlebell'),
  ('kettlebell-snatch',  'Kettlebell Snatch',     'Strength','strength',0.90,'🪨',202,'Full body','Kettlebell'),
  ('turkish-get-up',     'Turkish Get-up',        'Strength','strength',2.00,'🪨',203,'Full body','Kettlebell'),
  ('devils-press',       'Devil''s Press',        'Strength','strength',1.20,'🪨',204,'Full body','Dumbbell'),
  ('weighted-pull-up',   'Weighted Pull-up',      'Strength','strength',2.20,'🪨',205,'Back','Other'),
  ('weighted-dip',       'Weighted Dip',          'Strength','strength',1.80,'🪨',206,'Chest','Other'),
  ('farmers-carry',      'Farmer''s Carry',       'Strength','timed',   5.00,'🪨',207,'Full body','Dumbbell'),
  ('sled-push',          'Sled Push',             'Strength','timed',   8.00,'🪨',208,'Legs','Other'),
  ('sled-drag',          'Sled Drag',             'Strength','timed',   7.00,'🪨',209,'Legs','Other'),
  ('battle-ropes',       'Battle Ropes',          'Strength','timed',   7.50,'🪨',210,'Full body','Other'),
  ('tyre-flip',          'Tyre Flip',             'Strength','timed',   8.00,'🪨',211,'Full body','Other'),
  ('wall-ball',          'Wall Ball',             'Strength','bodyweight',1.10,'🪨',212,'Full body','Other'),
  ('med-ball-slam',      'Medicine Ball Slam',    'Strength','bodyweight',1.00,'🪨',213,'Full body','Other'),

  -- ==========================================================================
  --  BODYWEIGHT
  -- ==========================================================================
  ('push-up',              'Push-up',              'Bodyweight','bodyweight',0.90,'🤸',230,'Chest','Bodyweight'),
  ('diamond-push-up',      'Diamond Push-up',      'Bodyweight','bodyweight',1.00,'🤸',231,'Arms','Bodyweight'),
  ('incline-push-up',      'Incline Push-up',      'Bodyweight','bodyweight',0.60,'🤸',232,'Chest','Bodyweight'),
  ('decline-push-up',      'Decline Push-up',      'Bodyweight','bodyweight',1.05,'🤸',233,'Chest','Bodyweight'),
  ('pike-push-up',         'Pike Push-up',         'Bodyweight','bodyweight',1.20,'🤸',234,'Shoulders','Bodyweight'),
  ('handstand-push-up',    'Handstand Push-up',    'Bodyweight','bodyweight',5.00,'🤸',235,'Shoulders','Bodyweight'),
  ('pull-up',              'Pull-up',              'Bodyweight','bodyweight',3.00,'🤸',236,'Back','Bodyweight'),
  ('wide-grip-pull-up',    'Wide-Grip Pull-up',    'Bodyweight','bodyweight',3.10,'🤸',237,'Back','Bodyweight'),
  ('neutral-grip-pull-up', 'Neutral-Grip Pull-up', 'Bodyweight','bodyweight',2.90,'🤸',238,'Back','Bodyweight'),
  ('chin-up',              'Chin-up',              'Bodyweight','bodyweight',2.80,'🤸',239,'Arms','Bodyweight'),
  ('muscle-up',            'Muscle-up',            'Bodyweight','bodyweight',6.00,'🤸',240,'Back','Bodyweight'),
  ('dip',                  'Dip',                  'Bodyweight','bodyweight',2.00,'🤸',241,'Chest','Bodyweight'),
  ('inverted-row',         'Inverted Row',         'Bodyweight','bodyweight',1.20,'🤸',242,'Back','Bodyweight'),
  ('air-squat',            'Bodyweight Squat',     'Bodyweight','bodyweight',0.45,'🤸',243,'Legs','Bodyweight'),
  ('jump-squat',           'Jump Squat',           'Bodyweight','bodyweight',0.70,'🤸',244,'Legs','Bodyweight'),
  ('lunge',                'Lunge',                'Bodyweight','bodyweight',0.60,'🤸',245,'Legs','Bodyweight'),
  ('pistol-squat',         'Pistol Squat',         'Bodyweight','bodyweight',3.50,'🤸',246,'Legs','Bodyweight'),
  ('nordic-curl',          'Nordic Hamstring Curl','Bodyweight','bodyweight',2.50,'🤸',247,'Legs','Bodyweight'),
  ('glute-bridge',         'Glute Bridge',         'Bodyweight','bodyweight',0.40,'🤸',248,'Glutes','Bodyweight'),
  ('burpee',               'Burpee',               'Bodyweight','bodyweight',2.20,'🤸',249,'Full body','Bodyweight'),
  ('box-jump',             'Box Jump',             'Bodyweight','bodyweight',1.20,'🤸',250,'Legs','Bodyweight'),
  ('jumping-jack',         'Jumping Jack',         'Bodyweight','bodyweight',0.20,'🤸',251,'Full body','Bodyweight'),
  ('mountain-climber',     'Mountain Climber',     'Bodyweight','bodyweight',0.25,'🤸',252,'Core','Bodyweight'),
  ('bear-crawl',           'Bear Crawl',           'Bodyweight','timed',     5.00,'🤸',253,'Full body','Bodyweight'),

  -- ==========================================================================
  --  CORE
  -- ==========================================================================
  ('sit-up',                 'Sit-up',                 'Core','bodyweight',0.45,'🧘',270,'Core','Bodyweight'),
  ('decline-sit-up',         'Decline Sit-up',         'Core','bodyweight',0.60,'🧘',271,'Core','Bodyweight'),
  ('weighted-sit-up',        'Weighted Sit-up',        'Core','strength',  0.55,'🧘',272,'Core','Dumbbell'),
  ('crunch',                 'Crunch',                 'Core','bodyweight',0.35,'🧘',273,'Core','Bodyweight'),
  ('bicycle-crunch',         'Bicycle Crunch',         'Core','bodyweight',0.30,'🧘',274,'Core','Bodyweight'),
  ('russian-twist',          'Russian Twist',          'Core','bodyweight',0.30,'🧘',275,'Core','Bodyweight'),
  ('weighted-russian-twist', 'Weighted Russian Twist', 'Core','strength',  0.40,'🧘',276,'Core','Dumbbell'),
  ('leg-raise',              'Hanging Leg Raise',      'Core','bodyweight',0.80,'🧘',277,'Core','Bodyweight'),
  ('hanging-knee-raise',     'Hanging Knee Raise',     'Core','bodyweight',0.70,'🧘',278,'Core','Bodyweight'),
  ('toes-to-bar',            'Toes to Bar',            'Core','bodyweight',1.20,'🧘',279,'Core','Bodyweight'),
  ('ab-wheel',               'Ab Wheel Rollout',       'Core','bodyweight',1.30,'🧘',280,'Core','Other'),
  ('back-extension',         'Back Extension',         'Core','bodyweight',0.55,'🧘',281,'Back','Bodyweight'),
  ('plank',                  'Plank',                  'Core','timed',    12.00,'🧘',282,'Core','Bodyweight'),
  ('side-plank',             'Side Plank',             'Core','timed',    10.00,'🧘',283,'Core','Bodyweight'),
  ('hollow-hold',            'Hollow Body Hold',       'Core','timed',    11.00,'🧘',284,'Core','Bodyweight'),
  ('l-sit',                  'L-Sit',                  'Core','timed',    14.00,'🧘',285,'Core','Bodyweight'),
  ('wall-sit',               'Wall Sit',               'Core','timed',     6.00,'🧘',286,'Legs','Bodyweight'),
  ('dead-hang',              'Dead Hang',              'Core','timed',     8.00,'🧘',287,'Back','Bodyweight'),

  -- ==========================================================================
  --  CARDIO
  -- ==========================================================================
  ('run',            'Run (outdoor)',        'Cardio','distance', 30.00,'🏃',310,'Cardio','Outdoors'),
  ('trail-run',      'Trail Run',            'Cardio','distance', 34.00,'🏃',311,'Cardio','Outdoors'),
  ('treadmill-run',  'Treadmill Run',        'Cardio','distance', 27.00,'🏃',312,'Cardio','Cardio machine'),
  ('sprint-intervals','Sprint Intervals',    'Cardio','timed',    10.00,'🏃',313,'Cardio','Outdoors'),
  ('walk',           'Walk',                 'Cardio','distance',  8.00,'🚶',314,'Cardio','Outdoors'),
  ('incline-walk',   'Incline Treadmill Walk','Cardio','distance',12.00,'🚶',315,'Cardio','Cardio machine'),
  ('rucking',        'Rucking (weighted walk)','Cardio','distance',16.00,'🎒',316,'Cardio','Outdoors'),
  ('hike',           'Hike',                 'Cardio','distance', 14.00,'🥾',317,'Cardio','Outdoors'),
  ('stairs',         'Stair Climbing',       'Cardio','timed',     7.00,'🪜',318,'Cardio','Outdoors'),
  ('stair-climb',    'Stair Climber',        'Cardio','distance', 40.00,'🪜',319,'Cardio','Cardio machine'),
  ('cycle',          'Cycle (outdoor)',      'Cardio','distance', 10.00,'🚴',320,'Cardio','Outdoors'),
  ('indoor-cycle',   'Indoor Bike',          'Cardio','distance', 12.00,'🚴',321,'Cardio','Cardio machine'),
  ('assault-bike',   'Assault Bike',         'Cardio','timed',     9.00,'🚴',322,'Cardio','Cardio machine'),
  ('swim',           'Swim',                 'Cardio','distance',120.00,'🏊',323,'Cardio','Other'),
  ('row-erg',        'Rowing Machine',       'Cardio','distance', 22.00,'🚣',324,'Cardio','Cardio machine'),
  ('ski-erg',        'Ski Erg',              'Cardio','distance', 22.00,'⛷️',325,'Cardio','Cardio machine'),
  ('elliptical',     'Elliptical',           'Cardio','distance', 12.00,'🏃',326,'Cardio','Cardio machine'),
  ('jump-rope',      'Jump Rope',            'Cardio','timed',     8.00,'🪢',327,'Cardio','Other'),

  -- ==========================================================================
  --  CLASSES & CONDITIONING
  -- ==========================================================================
  ('hiit',             'HIIT Session',      'Class','timed',7.00,'🔥',350,'Full body','Class'),
  ('crossfit-wod',     'CrossFit WOD',      'Class','timed',8.00,'🔥',351,'Full body','Class'),
  ('circuit-training', 'Circuit Training',  'Class','timed',6.50,'🔥',352,'Full body','Class'),
  ('spin-class',       'Spin Class',        'Class','timed',6.00,'🚴',353,'Cardio','Class'),
  ('rowing-class',     'Rowing Class',      'Class','timed',6.50,'🚣',354,'Cardio','Class'),
  ('boxing',           'Boxing',            'Class','timed',7.00,'🥊',355,'Full body','Class'),
  ('martial-arts',     'Martial Arts',      'Class','timed',6.50,'🥋',356,'Full body','Class'),
  ('strongman',        'Strongman Session', 'Class','timed',7.00,'🪨',357,'Full body','Class'),
  ('yoga',             'Yoga',              'Class','timed',3.00,'🧘',358,'Full body','Class'),
  ('pilates',          'Pilates',           'Class','timed',3.50,'🧘',359,'Core','Class'),
  ('mobility',         'Mobility Work',     'Class','timed',1.80,'🤾',360,'Full body','Class'),
  ('stretching',       'Stretching',        'Class','timed',1.50,'🤸',361,'Full body','Class'),

  -- ==========================================================================
  --  SPORT
  -- ==========================================================================
  ('football',     'Football / Soccer',     'Sport','timed',4.00,'⚽',380,'Cardio','Sport'),
  ('basketball',   'Basketball',            'Sport','timed',4.50,'🏀',381,'Cardio','Sport'),
  ('rugby',        'Rugby',                 'Sport','timed',5.00,'🏉',382,'Cardio','Sport'),
  ('hockey',       'Hockey',                'Sport','timed',4.50,'🏒',383,'Cardio','Sport'),
  ('tennis',       'Tennis',                'Sport','timed',4.00,'🎾',384,'Cardio','Sport'),
  ('padel',        'Padel',                 'Sport','timed',3.80,'🎾',385,'Cardio','Sport'),
  ('squash',       'Squash',                'Sport','timed',5.50,'🎾',386,'Cardio','Sport'),
  ('badminton',    'Badminton',             'Sport','timed',3.50,'🏸',387,'Cardio','Sport'),
  ('climbing',     'Climbing / Bouldering', 'Sport','timed',6.00,'🧗',388,'Full body','Sport'),
  ('skiing',       'Skiing / Snowboarding', 'Sport','timed',4.00,'🎿',389,'Legs','Sport'),
  ('surfing',      'Surfing',               'Sport','timed',3.50,'🏄',390,'Full body','Sport'),
  ('dance',        'Dance',                 'Sport','timed',3.00,'💃',391,'Cardio','Sport'),
  ('golf-walking', 'Golf (walking)',        'Sport','timed',1.20,'⛳',392,'Cardio','Sport')

on conflict (id) do update set
  name            = excluded.name,
  category        = excluded.category,
  kind            = excluded.kind,
  points_per_unit = excluded.points_per_unit,
  emoji           = excluded.emoji,
  sort_order      = excluded.sort_order,
  muscle          = excluded.muscle,
  equipment       = excluded.equipment,
  active          = true;
