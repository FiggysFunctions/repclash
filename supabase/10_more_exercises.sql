-- ============================================================================
--  REPCLASH — more gym kit
--  Run AFTER 02_exercises.sql. Safe to re-run.
--
--  Requested by the crew: side delt machines (seated and standing), leg press
--  calf raise, shin raises, and the plate-loaded (Hammer Strength style) racks
--  that most gyms have alongside the pin-loaded ones.
--
--  Rates are set here because these are new rows — 02's ON CONFLICT clause
--  doesn't touch points_per_unit, so an insert is the one place a rate can be
--  introduced. Any later change to them belongs in 11_scoring_curve.sql.
--  These values already assume the steeper load curve from 11.
-- ============================================================================

insert into public.exercises
  (id, name, category, kind, points_per_unit, emoji, sort_order, muscle, equipment) values

  -- Side delt machines. Isolation on a fixed path, so priced with the other
  -- delt work rather than with pressing.
  ('seated-lateral-raise-machine',   'Seated Side Delt Machine',   'Strength','strength',0.20,'🎚️',137,'Shoulders','Machine'),
  ('standing-lateral-raise-machine', 'Standing Side Delt Machine', 'Strength','strength',0.20,'🎚️',137,'Shoulders','Machine'),

  -- Calves on the leg press sled. People load these with more than they
  -- squat, and the load multiplier caps out, so the rate has to be very low
  -- or a set of calf raises would outscore a set of squats.
  ('leg-press-calf-raise',           'Leg Press Calf Raise',       'Strength','strength',0.09,'🎚️',132,'Legs','Machine'),

  -- Tibialis raises. Usually bodyweight against a wall or with a tib bar, so
  -- leave the weight at 0 if you're not loading them.
  ('tibialis-raise',                 'Tibialis (Shin) Raise',      'Strength','strength',0.18,'🤸',133,'Legs','Bodyweight'),

  -- Plate-loaded racks. Priced level with their pin-loaded equivalents: the
  -- path is still fixed, but each arm works independently.
  ('plate-chest-press',              'Plate-Loaded Chest Press',   'Strength','strength',0.47,'🎚️',134,'Chest','Machine'),
  ('plate-incline-press',            'Plate-Loaded Incline Press', 'Strength','strength',0.45,'🎚️',134,'Chest','Machine'),
  ('plate-shoulder-press',           'Plate-Loaded Shoulder Press','Strength','strength',0.47,'🎚️',136,'Shoulders','Machine'),
  ('plate-row',                      'Plate-Loaded Row',           'Strength','strength',0.45,'🎚️',141,'Back','Machine'),
  ('plate-pulldown',                 'Plate-Loaded Pulldown',      'Strength','strength',0.47,'🎚️',138,'Back','Machine'),
  ('plate-leg-press',                'Plate-Loaded Leg Press',     'Strength','strength',0.24,'🎚️',122,'Legs','Machine')

on conflict (id) do update set
  name       = excluded.name,
  category   = excluded.category,
  kind       = excluded.kind,
  emoji      = excluded.emoji,
  sort_order = excluded.sort_order,
  muscle     = excluded.muscle,
  equipment  = excluded.equipment,
  active     = true;

-- Which of these are done one side at a time.
update public.exercises set sided = 'always'
  where id in ('plate-row');

update public.exercises set sided = 'option'
  where id in ('seated-lateral-raise-machine','standing-lateral-raise-machine',
               'leg-press-calf-raise','tibialis-raise','plate-chest-press',
               'plate-incline-press','plate-shoulder-press','plate-pulldown',
               'plate-leg-press');
