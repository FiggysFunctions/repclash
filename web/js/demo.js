/* ==========================================================================
   DEMO MODE — a fake backend that runs entirely in the browser.

   Purpose: let you (and your mates) poke at the real app before anyone
   creates a Supabase account. Nothing here talks to a network. Data lives in
   localStorage and can be wiped from the settings screen.

   The scoring below deliberately mirrors supabase/01_schema.sql. That file is
   the authority — if the two ever disagree, the database is right and this is
   stale. Demo mode is a shop window, not a second implementation to maintain.
   ========================================================================== */

const KEY = 'repclash.demo';

export function on()      { return localStorage.getItem('repclash.demoMode') === '1'; }
export function enable()  { localStorage.setItem('repclash.demoMode', '1'); }
export function disable() { localStorage.removeItem('repclash.demoMode'); localStorage.removeItem(KEY); }

/* --- constants, matching app.rules() in the schema ----------------------- */
const RULES = {
  daily_effort_cap:  400,
  qualify_threshold: 60,
  session_bonus:     60,
  streak_step:       10,
  streak_cap:        100,
  weekly_target:     4,
  weekly_bonus:      250
};

/* Which exercises are done one side at a time. Mirrors the `sided` column set
   in supabase/08_sets_and_sides.sql. */
const SIDED_ALWAYS = ['dumbbell-row', 'bulgarian-split-squat', 'concentration-curl'];
const SIDED_OPTION = [
  'bicep-curl', 'hammer-curl', 'cable-curl', 'lateral-raise', 'cable-lateral-raise',
  'tricep-pushdown', 'leg-extension', 'leg-curl', 'standing-calf-raise', 'lunge',
  'farmers-carry', 'hip-abduction', 'hip-adduction'
];

/* --- a slice of the real catalog ------------------------------------------
   Enough of each kind and each bit of kit that the picker's filters and search
   behave the same as they do against the real thing. */
const EXERCISES = [
  ['back-squat','Back Squat','Strength','strength',1.20,'🏋️','Legs','Barbell'],
  ['deadlift','Deadlift','Strength','strength',1.30,'🏋️','Back','Barbell'],
  ['romanian-deadlift','Romanian Deadlift','Strength','strength',1.10,'🏋️','Legs','Barbell'],
  ['bench-press','Bench Press','Strength','strength',1.10,'🏋️','Chest','Barbell'],
  ['incline-bench','Incline Bench Press','Strength','strength',1.05,'🏋️','Chest','Barbell'],
  ['overhead-press','Overhead Press','Strength','strength',1.10,'🏋️','Shoulders','Barbell'],
  ['barbell-row','Barbell Row','Strength','strength',1.05,'🏋️','Back','Barbell'],
  ['barbell-curl','Barbell Curl','Strength','strength',0.75,'🏋️','Arms','Barbell'],
  ['hip-thrust','Barbell Hip Thrust','Strength','strength',0.70,'🏋️','Glutes','Barbell'],
  ['smith-squat','Smith Machine Squat','Strength','strength',1.05,'🏋️','Legs','Smith machine'],
  ['smith-bench','Smith Machine Bench Press','Strength','strength',1.00,'🏋️','Chest','Smith machine'],
  ['smith-row','Smith Machine Row','Strength','strength',0.90,'🏋️','Back','Smith machine'],
  ['dumbbell-press','Dumbbell Bench Press','Strength','strength',1.00,'💪','Chest','Dumbbell'],
  ['incline-dumbbell-press','Incline Dumbbell Press','Strength','strength',0.95,'💪','Chest','Dumbbell'],
  ['dumbbell-row','Dumbbell Row','Strength','strength',0.90,'💪','Back','Dumbbell'],
  ['lateral-raise','Lateral Raise','Strength','strength',0.70,'💪','Shoulders','Dumbbell'],
  ['bicep-curl','Dumbbell Curl','Strength','strength',0.70,'💪','Arms','Dumbbell'],
  ['hammer-curl','Hammer Curl','Strength','strength',0.70,'💪','Arms','Dumbbell'],
  ['bulgarian-split-squat','Bulgarian Split Squat','Strength','strength',1.00,'💪','Legs','Dumbbell'],
  ['goblet-squat','Goblet Squat','Strength','strength',0.85,'💪','Legs','Dumbbell'],
  ['hack-squat','Hack Squat','Strength','strength',0.60,'🎚️','Legs','Machine'],
  ['leg-press','Leg Press','Strength','strength',0.55,'🎚️','Legs','Machine'],
  ['leg-extension','Leg Extension','Strength','strength',0.55,'🎚️','Legs','Machine'],
  ['leg-curl','Lying Leg Curl','Strength','strength',0.60,'🎚️','Legs','Machine'],
  ['hip-abduction','Hip Abduction Machine','Strength','strength',0.35,'🎚️','Glutes','Machine'],
  ['hip-adduction','Hip Adduction Machine','Strength','strength',0.35,'🎚️','Legs','Machine'],
  ['chest-press-machine','Chest Press Machine','Strength','strength',0.70,'🎚️','Chest','Machine'],
  ['pec-deck','Pec Deck (Chest Fly)','Strength','strength',0.55,'🎚️','Chest','Machine'],
  ['lat-pulldown','Lat Pulldown','Strength','strength',0.85,'🎚️','Back','Machine'],
  ['seated-row','Seated Cable Row','Strength','strength',0.85,'🎚️','Back','Machine'],
  ['standing-calf-raise','Standing Calf Raise','Strength','strength',0.38,'🎚️','Legs','Machine'],
  ['cable-fly-crossover','Cable Fly Crossover','Strength','strength',0.60,'🔗','Chest','Cable'],
  ['tricep-pushdown','Tricep Pushdown','Strength','strength',0.60,'🔗','Arms','Cable'],
  ['cable-curl','Cable Curl','Strength','strength',0.65,'🔗','Arms','Cable'],
  ['face-pull','Face Pull','Strength','strength',0.55,'🔗','Shoulders','Cable'],
  ['cable-lateral-raise','Cable Lateral Raise','Strength','strength',0.60,'🔗','Shoulders','Cable'],
  ['kettlebell-swing','Kettlebell Swing','Strength','strength',0.60,'🪨','Full body','Kettlebell'],
  ['farmers-carry',"Farmer's Carry",'Strength','timed',5.00,'🪨','Full body','Dumbbell'],
  ['push-up','Push-up','Bodyweight','bodyweight',0.90,'🤸','Chest','Bodyweight'],
  ['pull-up','Pull-up','Bodyweight','bodyweight',3.00,'🤸','Back','Bodyweight'],
  ['dip','Dip','Bodyweight','bodyweight',2.00,'🤸','Chest','Bodyweight'],
  ['burpee','Burpee','Bodyweight','bodyweight',2.20,'🤸','Full body','Bodyweight'],
  ['air-squat','Bodyweight Squat','Bodyweight','bodyweight',0.45,'🤸','Legs','Bodyweight'],
  ['lunge','Lunge','Bodyweight','bodyweight',0.60,'🤸','Legs','Bodyweight'],
  ['assisted-pull-up','Assisted Pull-up','Bodyweight','bodyweight',1.60,'🎚️','Back','Machine'],
  ['sit-up','Sit-up','Core','bodyweight',0.45,'🧘','Core','Bodyweight'],
  ['russian-twist','Russian Twist','Core','bodyweight',0.30,'🧘','Core','Bodyweight'],
  ['weighted-russian-twist','Weighted Russian Twist','Core','strength',0.40,'🧘','Core','Dumbbell'],
  ['cable-crunch','Cable Crunch','Core','strength',0.55,'🔗','Core','Cable'],
  ['plank','Plank','Core','timed',12.00,'🧘','Core','Bodyweight'],
  ['leg-raise','Hanging Leg Raise','Core','bodyweight',0.80,'🧘','Core','Bodyweight'],
  ['run','Run (outdoor)','Cardio','distance',30.00,'🏃','Cardio','Outdoors'],
  ['treadmill-run','Treadmill Run','Cardio','distance',27.00,'🏃','Cardio','Cardio machine'],
  ['walk','Walk','Cardio','distance',8.00,'🚶','Cardio','Outdoors'],
  ['cycle','Cycle (outdoor)','Cardio','distance',10.00,'🚴','Cardio','Outdoors'],
  ['swim','Swim','Cardio','distance',120.00,'🏊','Cardio','Other'],
  ['row-erg','Rowing Machine','Cardio','distance',22.00,'🚣','Cardio','Cardio machine'],
  ['assault-bike','Assault Bike','Cardio','timed',9.00,'🚴','Cardio','Cardio machine'],
  ['jump-rope','Jump Rope','Cardio','timed',8.00,'🪢','Cardio','Other'],
  ['hiit','HIIT Session','Class','timed',7.00,'🔥','Full body','Class'],
  ['crossfit-wod','CrossFit WOD','Class','timed',8.00,'🔥','Full body','Class'],
  ['spin-class','Spin Class','Class','timed',6.00,'🚴','Cardio','Class'],
  ['boxing','Boxing','Class','timed',7.00,'🥊','Full body','Class'],
  ['yoga','Yoga','Class','timed',3.00,'🧘','Full body','Class'],
  ['football','Football / Soccer','Sport','timed',4.00,'⚽','Cardio','Sport'],
  ['basketball','Basketball','Sport','timed',4.50,'🏀','Cardio','Sport'],
  ['tennis','Tennis','Sport','timed',4.00,'🎾','Cardio','Sport'],
  ['climbing','Climbing / Bouldering','Sport','timed',6.00,'🧗','Full body','Sport']
].map(([id, name, category, kind, ppu, emoji, muscle, equipment], i) => ({
  id, name, category, kind, points_per_unit: ppu, emoji,
  muscle, equipment, sort_order: i, active: true,
  sided: SIDED_ALWAYS.includes(id) ? 'always'
       : SIDED_OPTION.includes(id) ? 'option' : null
}));

/* --- the cast ------------------------------------------------------------ */
const CAST = [
  { id: 'demo-me',  display_name: 'You',   avatar_emoji: '💪', freq: 0.55, size: 210 },
  { id: 'demo-jax', display_name: 'Jax',   avatar_emoji: '🦍', freq: 0.72, size: 300 },
  { id: 'demo-sam', display_name: 'Sam',   avatar_emoji: '🔥', freq: 0.64, size: 250 },
  { id: 'demo-kai', display_name: 'Kai',   avatar_emoji: '🐺', freq: 0.50, size: 320 },
  { id: 'demo-ro',  display_name: 'Ro',    avatar_emoji: '🥊', freq: 0.42, size: 270 },
  { id: 'demo-vee', display_name: 'Vee',   avatar_emoji: '⚡', freq: 0.30, size: 380 }
];

const CREW = {
  id: 'demo-crew',
  name: 'The Demo Crew',
  join_code: 'DEMO01',
  owner_id: 'demo-me',   // so the demo shows the owner's inbox too
  season_name: 'Season 1',
  season_number: 1,
  season_starts: iso(addDays(new Date(), -45)),
  season_ends:   iso(addDays(new Date(), 45))
};

/* --- date helpers (local, never UTC) ------------------------------------- */
function iso(d) {
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function parseISO(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
function mondayOf(s) {
  const d = parseISO(s);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return iso(d);
}

/* Deterministic PRNG so the demo looks the same each time you open it. */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const seedOf = (s) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7);

/* --- state --------------------------------------------------------------- */
let state = null;

function load() {
  if (state) return state;
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (saved?.workouts) { state = saved; return state; }
  } catch { /* rebuild below */ }
  state = generate();
  save();
  return state;
}
function save() { localStorage.setItem(KEY, JSON.stringify(state)); }

const NOTES = [
  'Felt strong today.',
  'Legs are gone.',
  'Rough one. Turned up anyway.',
  'New PB 💪',
  'Rain the whole way round.',
  'Short session, better than nothing.'
];

/** 56 days of plausible training history for everyone but you. */
function generate() {
  const workouts = [];
  const today = new Date();
  let wid = 0;

  for (const person of CAST) {
    const rand = rng(seedOf(person.id));
    // You start with a couple of sessions so the app isn't empty, but you're
    // mid-table — there's something to chase.
    const days = person.id === 'demo-me' ? 12 : 56;

    for (let back = days; back >= 0; back--) {
      if (rand() > person.freq) continue;
      const day = iso(addDays(today, -back));
      const picks = 1 + Math.floor(rand() * 3);
      const entries = [];

      for (let i = 0; i < picks; i++) {
        const ex = EXERCISES[Math.floor(rand() * EXERCISES.length)];
        const v = shapeEntry(ex, rand, person.size);
        entries.push({ ...v, exercise_id: ex.id, effort_points: effort(ex, v) });
      }
      // A plausible time of day so the feed orders sensibly, and the odd
      // private session so the padlock is visible in the demo.
      const hour = 6 + Math.floor(rand() * 15);
      workouts.push({
        id: `demo-w${++wid}`,
        user_id: person.id,
        performed_on: day,
        created_at: `${day}T${String(hour).padStart(2, '0')}:${rand() < .5 ? '15' : '45'}:00.000Z`,
        note: rand() < 0.12 ? NOTES[Math.floor(rand() * NOTES.length)] : null,
        is_private: rand() < 0.08,
        entries
      });
    }
  }
  return { workouts, titles: seedTitles(), nextId: wid + 1 };
}

function shapeEntry(ex, rand, size) {
  const jitter = 0.7 + rand() * 0.6;
  switch (ex.kind) {
    case 'strength': {
      const count  = 3 + Math.floor(rand() * 3);
      const reps   = 5 + Math.floor(rand() * 7);
      const weight = Math.round((size / 6) * jitter / 2.5) * 2.5;
      // Most sessions are uniform; some have a last set that went better, or a
      // drop set — which is the whole point of per-set logging.
      const shape = rand();
      const set_detail = Array.from({ length: count }, (_, i) => {
        if (shape < 0.2 && i === count - 1) return { reps: reps + 2, kg: weight };
        if (shape > 0.9 && i === count - 1) return { reps: reps + 4, kg: weight - 5 };
        return { reps, kg: weight };
      });
      return {
        set_detail, per_side: ex.sided === 'always',
        distance_km: null, duration_min: null
      };
    }
    case 'bodyweight': {
      const count = 3 + Math.floor(rand() * 2);
      const reps  = 8 + Math.floor(rand() * 10);
      return {
        set_detail: Array.from({ length: count }, () => ({ reps, kg: 0 })),
        per_side: ex.sided === 'always',
        distance_km: null, duration_min: null
      };
    }
    case 'distance': {
      // Work backwards from a believable effort figure so we don't generate
      // an 8 km swim next to an 8 km walk.
      const target = 70 + rand() * 190;
      const km = Math.max(0.5, Math.min(30, target / ex.points_per_unit * jitter));
      return {
        set_detail: null, per_side: false,
        distance_km: Math.round(km * 10) / 10,
        duration_min: null
      };
    }
    default:
      return {
        set_detail: null, per_side: false, distance_km: null,
        duration_min: Math.round((20 + rand() * 40) * jitter)
      };
  }
}

function effort(ex, v) {
  const ppu = ex.points_per_unit;
  const mult = (v.per_side && (ex.kind === 'strength' || ex.kind === 'bodyweight')) ? 2 : 1;

  if (ex.kind === 'distance') return Math.round(ppu * (v.distance_km || 0));
  if (ex.kind === 'timed')    return Math.round(ppu * (v.duration_min || 0));

  // Each set priced on its own load, matching app.fill_entry()
  const sets = v.set_detail?.length
    ? v.set_detail
    : Array.from({ length: v.sets || 1 },
                 () => ({ reps: v.reps || 0, kg: v.weight_kg || 0 }));

  const total = sets.reduce((sum, s) => {
    const r = Number(s.reps) || 0, w = Number(s.kg) || 0;
    return sum + (ex.kind === 'strength' ? ppu * r * Math.min(1 + w / 60, 3) : ppu * r);
  }, 0);

  return Math.round(total * mult);
}

function seedTitles() {
  // Matches how the database phrases it: "Iron Week · week of 27 Jul 2026".
  const wk = (n) => parseISO(mondayOf(iso(addDays(new Date(), -7 * n))))
    .toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  return [
    { id: 't1', user_id: 'demo-jax', crew_id: CREW.id, title: 'Ironclad',    emoji: '🏋️', awarded_for: 'Iron Week · week of ' + wk(1),     awarded_at: new Date(Date.now() - 6 * 864e5).toISOString() },
    { id: 't2', user_id: 'demo-kai', crew_id: CREW.id, title: 'Road Warrior', emoji: '🛣️', awarded_for: 'Roadwork · week of ' + wk(2),     awarded_at: new Date(Date.now() - 13 * 864e5).toISOString() },
    { id: 't3', user_id: 'demo-sam', crew_id: CREW.id, title: 'The Metronome',emoji: '📅', awarded_for: 'The Metronome · week of ' + wk(3), awarded_at: new Date(Date.now() - 20 * 864e5).toISOString() },
    { id: 't4', user_id: 'demo-jax', crew_id: CREW.id, title: 'Rep Machine',  emoji: '🔁', awarded_for: 'Rep Machine · week of ' + wk(4),   awarded_at: new Date(Date.now() - 27 * 864e5).toISOString() }
  ];
}

/* --- scoring (mirrors app.v_day_total / app.v_week_bonus) ---------------- */

function dayTotals(userId) {
  const byDay = new Map();
  for (const w of load().workouts) {
    if (w.user_id !== userId) continue;
    const cur = byDay.get(w.performed_on) || {
      day: w.performed_on, raw_effort: 0, sessions: 0, reps: 0, distance_km: 0, minutes: 0
    };
    cur.sessions += 1;
    for (const e of w.entries) {
      cur.raw_effort  += e.effort_points;
      cur.reps        += (e.reps || 0) * (e.sets || 1);
      cur.distance_km += Number(e.distance_km || 0);
      cur.minutes     += e.duration_min || 0;
    }
    byDay.set(w.performed_on, cur);
  }

  const days = [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day));
  let streak = 0, prev = null;

  return days.map(d => {
    const qualified = d.raw_effort >= RULES.qualify_threshold;
    if (qualified) {
      streak = (prev && iso(addDays(parseISO(prev), 1)) === d.day) ? streak + 1 : 1;
      prev = d.day;
    }
    const effort_points = Math.min(d.raw_effort, RULES.daily_effort_cap);
    const session_bonus = qualified ? RULES.session_bonus : 0;
    const streak_bonus  = qualified ? Math.min(streak * RULES.streak_step, RULES.streak_cap) : 0;
    return {
      ...d, qualified,
      streak_day: qualified ? streak : 0,
      effort_points, session_bonus, streak_bonus,
      day_points: effort_points + session_bonus + streak_bonus
    };
  });
}

function weekBonuses(userId) {
  const counts = new Map();
  for (const d of dayTotals(userId)) {
    if (!d.qualified) continue;
    const wk = mondayOf(d.day);
    counts.set(wk, (counts.get(wk) || 0) + 1);
  }
  return [...counts].map(([week_start, active_days]) => ({
    week_start, active_days,
    week_bonus: active_days >= RULES.weekly_target ? RULES.weekly_bonus : 0
  }));
}

const inRange = (d, from, to) => d >= from && d <= to;

/* --- the API surface, matching api.js ------------------------------------ */

export const currentUser = () => ({ id: 'demo-me', email: 'demo@repclash.app' });

export async function getMyProfile() {
  return { ...CAST[0], created_at: new Date().toISOString() };
}
export async function getProfile(id) {
  return CAST.find(c => c.id === id) || null;
}
export async function createProfile(name, emoji) {
  CAST[0].display_name = name; CAST[0].avatar_emoji = emoji;
  return CAST[0];
}
export async function updateProfile(patch) {
  Object.assign(CAST[0], patch);
  return CAST[0];
}

export async function myCrews() {
  return [{ crew_id: CREW.id, joined_at: CREW.season_starts, crews: CREW }];
}
export async function createCrew(name) { return { ...CREW, name }; }
export async function joinCrew()       { return CREW; }
export async function leaveCrew()      { return null; }
export async function syncCrew()       { return { titles_awarded: 0, season_rolled: false }; }
export async function scoringRules()   { return RULES; }
export async function exercises()      { return EXERCISES; }

export async function leaderboard(_crew, from, to) {
  return CAST.map(p => {
    const days = dayTotals(p.id).filter(d => inRange(d.day, from, to));
    const weeks = weekBonuses(p.id).filter(w => w.week_start >= mondayOf(from) && w.week_start <= to);
    const dayPts = days.reduce((s, d) => s + d.day_points, 0);
    const wkPts  = weeks.reduce((s, w) => s + w.week_bonus, 0);
    const last   = dayTotals(p.id).slice(-1)[0];
    const recent = last && (last.day === iso(new Date()) || last.day === iso(addDays(new Date(), -1)));
    return {
      user_id: p.id,
      display_name: p.display_name,
      avatar_emoji: p.avatar_emoji,
      points: dayPts + wkPts,
      effort: days.reduce((s, d) => s + d.effort_points, 0),
      bonus:  days.reduce((s, d) => s + d.session_bonus + d.streak_bonus, 0) + wkPts,
      sessions: days.reduce((s, d) => s + d.sessions, 0),
      active_days: days.filter(d => d.qualified).length,
      current_streak: recent ? last.streak_day : 0,
      title_count: load().titles.filter(t => t.user_id === p.id).length
    };
  }).sort((a, b) => b.points - a.points || b.active_days - a.active_days);
}

export async function memberStats(userId) {
  const days = dayTotals(userId);
  const weeks = weekBonuses(userId);
  const last = days.slice(-1)[0];
  const recent = last && (last.day === iso(new Date()) || last.day === iso(addDays(new Date(), -1)));
  return {
    total_points: days.reduce((s, d) => s + d.day_points, 0) + weeks.reduce((s, w) => s + w.week_bonus, 0),
    total_sessions: days.reduce((s, d) => s + d.sessions, 0),
    active_days: days.filter(d => d.qualified).length,
    best_streak: days.reduce((m, d) => Math.max(m, d.streak_day), 0),
    current_streak: recent ? last.streak_day : 0,
    total_km: days.reduce((s, d) => s + d.distance_km, 0),
    total_minutes: days.reduce((s, d) => s + d.minutes, 0),
    first_day: days[0]?.day || null,
    recent: days.slice(-30).reverse()
  };
}

export async function trophyCase() {
  return load().titles
    .map(t => {
      const p = CAST.find(c => c.id === t.user_id);
      return { ...t, display_name: p.display_name, avatar_emoji: p.avatar_emoji };
    })
    .sort((a, b) => b.awarded_at.localeCompare(a.awarded_at));
}

const DEMO_CHALLENGE = {
  id: 'demo-ch-now',
  crew_id: CREW.id,
  week_start: mondayOf(iso(new Date())),
  title: 'Iron Week',
  description: 'Most effort points from Strength work this week.',
  emoji: '🏋️',
  metric: 'points',
  category: 'Strength',
  reward_title: 'Ironclad',
  settled_at: null
};

export async function currentChallenge() { return DEMO_CHALLENGE; }

export async function pastChallenges() {
  const wk = (n) => mondayOf(iso(addDays(new Date(), -7 * n)));
  return [
    { id: 'demo-ch-1', crew_id: CREW.id, week_start: wk(1), title: 'Roadwork',      emoji: '🛣️', metric: 'distance_km', category: 'Cardio', reward_title: 'Road Warrior',  settled_at: new Date().toISOString() },
    { id: 'demo-ch-2', crew_id: CREW.id, week_start: wk(2), title: 'The Metronome', emoji: '📅', metric: 'active_days', category: null,     reward_title: 'The Metronome', settled_at: new Date().toISOString() },
    { id: 'demo-ch-3', crew_id: CREW.id, week_start: wk(3), title: 'Rep Machine',   emoji: '🔁', metric: 'reps',        category: null,     reward_title: 'Rep Machine',   settled_at: new Date().toISOString() }
  ];
}

export async function challengeStandings(id) {
  const all = [DEMO_CHALLENGE, ...(await pastChallenges())];
  const ch = all.find(c => c.id === id) || DEMO_CHALLENGE;
  const from = ch.week_start;
  const to = iso(addDays(parseISO(from), 6));

  return CAST.map(p => {
    let score = 0;
    if (ch.metric === 'active_days') {
      score = dayTotals(p.id).filter(d => d.qualified && inRange(d.day, from, to)).length;
    } else {
      for (const w of load().workouts) {
        if (w.user_id !== p.id || !inRange(w.performed_on, from, to)) continue;
        for (const e of w.entries) {
          const ex = EXERCISES.find(x => x.id === e.exercise_id);
          if (ch.category && ex?.category !== ch.category) continue;
          if (ch.metric === 'points')      score += e.effort_points;
          if (ch.metric === 'reps')        score += (e.reps || 0) * (e.sets || 1);
          if (ch.metric === 'distance_km') score += Number(e.distance_km || 0);
          if (ch.metric === 'minutes')     score += e.duration_min || 0;
        }
      }
    }
    return {
      user_id: p.id, display_name: p.display_name,
      avatar_emoji: p.avatar_emoji, score
    };
  }).sort((a, b) => b.score - a.score);
}

export async function saveWorkout({ performedOn, note, entries, isPrivate }) {
  const s = load();
  const w = {
    id: `demo-w${s.nextId++}`,
    user_id: 'demo-me',
    performed_on: performedOn,
    note: note || null,
    is_private: !!isPrivate,
    entries: entries.map(e => {
      const ex = EXERCISES.find(x => x.id === e.exerciseId);
      const row = {
        exercise_id: e.exerciseId,
        set_detail: e.setDetail ?? null,
        per_side: !!e.perSide,
        distance_km: e.distanceKm ?? null,
        duration_min: e.durationMin ?? null
      };
      const d = derive(row);
      return {
        ...row,
        sets: d.sets, reps: d.reps, weight_kg: d.weight_kg,
        effort_points: effort(ex, row)
      };
    })
  };
  s.workouts.push(w);
  save();
  return w;
}

export async function myWorkouts(limit = 40) {
  return load().workouts
    .filter(w => w.user_id === 'demo-me')
    .sort((a, b) => b.performed_on.localeCompare(a.performed_on))
    .slice(0, limit)
    .map(w => ({
      ...w,
      workout_entries: w.entries.map(e => {
        const ex = EXERCISES.find(x => x.id === e.exercise_id);
        return { ...e, exercises: { name: ex.name, emoji: ex.emoji, kind: ex.kind } };
      })
    }));
}

export async function deleteWorkout(id) {
  const s = load();
  s.workouts = s.workouts.filter(w => w.id !== id);
  save();
}

export async function setWorkoutPrivacy(id, isPrivate) {
  const s = load();
  const w = s.workouts.find(x => x.id === id);
  if (w) w.is_private = !!isPrivate;
  save();
}

export async function crewFeed({ limit = 25, before = null, userId = null } = {}) {
  return load().workouts
    .filter(w => !w.is_private || w.user_id === 'demo-me')
    .filter(w => !userId || w.user_id === userId)
    .map(w => ({ ...w, created_at: w.created_at || `${w.performed_on}T18:00:00.000Z` }))
    .filter(w => !before || w.created_at < before)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, limit)
    .map(w => {
      const p = CAST.find(c => c.id === w.user_id);
      return {
        workout_id: w.id,
        user_id: w.user_id,
        display_name: p.display_name,
        avatar_emoji: p.avatar_emoji,
        performed_on: w.performed_on,
        note: w.note,
        created_at: w.created_at,
        effort: w.entries.reduce((s, e) => s + e.effort_points, 0),
        is_mine: w.user_id === 'demo-me',
        is_private: !!w.is_private,
        entries: w.entries.map(e => {
          const ex = EXERCISES.find(x => x.id === e.exercise_id);
          const d = derive(e);
          return {
            name: ex.name, emoji: ex.emoji, kind: ex.kind, category: ex.category,
            sets: d.sets, reps: d.reps, weight_kg: d.weight_kg,
            distance_km: e.distance_km, duration_min: e.duration_min,
            set_detail: e.set_detail || null, per_side: !!e.per_side,
            points: e.effort_points
          };
        })
      };
    });
}

export async function seasonChampions() { return []; }

/* --- personal progression -------------------------------------------------
   Mirrors supabase/07_progression.sql. */

/* Derived the same way app.fill_entry() does, so varied sets and single-sided
   work behave here exactly as they do against the real database. */
function derive(e) {
  const mult = e.per_side ? 2 : 1;
  if (e.set_detail?.length) {
    const reps = e.set_detail.map(s => Number(s.reps) || 0);
    const kgs  = e.set_detail.map(s => Number(s.kg) || 0);
    return {
      sets: e.set_detail.length,
      reps: Math.max(...reps, 0),
      weight_kg: Math.max(...kgs, 0) || null,
      total_volume: e.set_detail.reduce((t, s) =>
        t + (Number(s.reps) || 0) * (Number(s.kg) || 0), 0) * mult,
      top_e1rm: Math.max(...e.set_detail.map(s =>
        (Number(s.kg) || 0) * (1 + (Number(s.reps) || 0) / 30)), 0)
    };
  }
  const sets = e.sets || 1, reps = e.reps || 0, w = Number(e.weight_kg) || 0;
  return {
    sets, reps, weight_kg: w || null,
    total_volume: sets * reps * w * mult,
    top_e1rm: w * (1 + reps / 30)
  };
}

const metricOf = (metric, e) => {
  const d = derive(e);
  switch (metric) {
    case 'weight':       return d.weight_kg || 0;
    case 'reps':         return d.reps;
    case 'e1rm':         return d.top_e1rm;
    case 'volume':       return d.total_volume;
    case 'distance_km':  return Number(e.distance_km) || 0;
    case 'duration_min': return e.duration_min || 0;
    default:             return 0;
  }
};

/** Every entry you've logged for one exercise, newest first. */
function myEntries(exerciseId = null) {
  return load().workouts
    .filter(w => w.user_id === 'demo-me')
    .flatMap(w => w.entries
      .filter(e => !exerciseId || e.exercise_id === exerciseId)
      .map(e => ({ ...e, performed_on: w.performed_on })))
    .sort((a, b) => b.performed_on.localeCompare(a.performed_on));
}

export async function exerciseSummary() {
  const byEx = new Map();
  for (const e of myEntries()) {
    const cur = byEx.get(e.exercise_id) || { rows: [] };
    cur.rows.push(e);
    byEx.set(e.exercise_id, cur);
  }
  return [...byEx].map(([exercise_id, { rows }]) => {
    const last = rows[0];                       // already newest-first
    const lastD = derive(last);
    const max = (fn) => rows.reduce((m, e) => Math.max(m, fn(e)), 0);
    const paces = rows
      .filter(e => e.duration_min > 0 && e.distance_km > 0)
      .map(e => e.duration_min / e.distance_km);
    return {
      exercise_id,
      times_done: rows.length,
      last_on: last.performed_on,
      last_sets: lastD.sets, last_reps: lastD.reps,
      last_weight: lastD.weight_kg, last_distance: last.distance_km,
      last_duration: last.duration_min,
      last_set_detail: last.set_detail || null,
      last_per_side: !!last.per_side,
      best_weight:   max(e => derive(e).weight_kg || 0) || null,
      best_reps:     max(e => derive(e).reps || 0) || null,
      best_e1rm:     Math.round(max(e => metricOf('e1rm', e)) * 10) / 10 || null,
      best_volume:   max(e => metricOf('volume', e)) || null,
      best_distance: max(e => Number(e.distance_km) || 0) || null,
      best_duration: max(e => e.duration_min || 0) || null,
      best_pace:     paces.length ? Math.round(Math.min(...paces) * 100) / 100 : null
    };
  });
}

export async function exerciseHistory(exerciseId, limit = 40) {
  return myEntries(exerciseId).slice(0, limit).map(e => {
    const d = derive(e);
    return {
      performed_on: e.performed_on,
      sets: d.sets, reps: d.reps, weight_kg: d.weight_kg,
      distance_km: e.distance_km, duration_min: e.duration_min,
      set_detail: e.set_detail || null, per_side: !!e.per_side,
      effort_points: e.effort_points,
      e1rm: Math.round(d.top_e1rm * 10) / 10,
      volume: d.total_volume
    };
  });
}

function goalStore() {
  const s = load();
  s.goals ??= [];
  return s;
}

export async function myGoals() {
  const s = goalStore();
  return s.goals.filter(g => !g.archived_at).map(g => {
    const rows = myEntries(g.exercise_id);
    const ex = EXERCISES.find(x => x.id === g.exercise_id);
    const current = rows.reduce((m, e) => Math.max(m, metricOf(g.metric, e)), 0);
    const hit = rows.filter(e => metricOf(g.metric, e) >= g.target)
                    .map(e => e.performed_on).sort();
    return {
      ...g,
      exercise_name: ex?.name || g.exercise_id,
      exercise_emoji: ex?.emoji || '🏋️',
      current,
      achieved_on: hit[0] || null
    };
  }).sort((a, b) => (a.achieved_on ? 1 : 0) - (b.achieved_on ? 1 : 0));
}

export async function setGoal(exerciseId, metric, target, note) {
  const s = goalStore();
  const existing = s.goals.find(g =>
    g.exercise_id === exerciseId && g.metric === metric && !g.archived_at);
  if (existing) {
    Object.assign(existing, { target: Number(target), note });
  } else {
    s.goals.push({
      id: 'goal' + Date.now(), exercise_id: exerciseId, metric,
      target: Number(target), note, created_at: new Date().toISOString(),
      archived_at: null
    });
  }
  save();
}

export async function dropGoal(id) {
  const s = goalStore();
  const g = s.goals.find(x => x.id === id);
  if (g) g.archived_at = new Date().toISOString();
  save();
}

/* --- season pass ---------------------------------------------------------
   Mirrors supabase/06_season_pass.sql. That file is the authority. */

const PASS_RULES = {
  xp_active_day: 100, xp_weekly_target: 150,
  xp_challenge_win: 250, xp_catchup_week: 400, max_tier: 30
};

export const STARTER_AVATARS = ['💪','🔥','🏋️','🏃','🚴','🧗','🥊','🐺'];

const TIERS = [
  [ 1,     0, null,     null,           'Season started'],
  [ 2,   150, 'avatar', '🦍',           'Gorilla'],
  [ 3,   320, 'avatar', '🦁',           'Lion'],
  [ 4,   510, 'avatar', '🦅',           'Eagle'],
  [ 5,   720, 'title',  'Warming Up',   'Title: Warming Up'],
  [ 6,   950, 'avatar', '⚡',           'Bolt'],
  [ 7,  1200, 'avatar', '🐉',           'Dragon'],
  [ 8,  1470, 'avatar', '🦈',           'Shark'],
  [ 9,  1760, 'colour', 'ember',        'Ember name'],
  [10,  2070, 'avatar', '🐻',           'Bear'],
  [11,  2400, 'avatar', '🦖',           'T-Rex'],
  [12,  2750, 'avatar', '🐗',           'Boar'],
  [13,  3120, 'theme',  'blood',        'Blood theme'],
  [14,  3510, 'avatar', '🦏',           'Rhino'],
  [15,  3920, 'title',  'Halfway Beast','Title: Halfway Beast'],
  [16,  4350, 'avatar', '🐅',           'Tiger'],
  [17,  4800, 'avatar', '🌶️',           'Chilli'],
  [18,  5270, 'avatar', '🥷',           'Ninja'],
  [19,  5760, 'colour', 'volt',         'Volt name'],
  [20,  6270, 'avatar', '🤖',           'Robot'],
  [21,  6800, 'avatar', '🧟',           'Zombie'],
  [22,  7350, 'title',  'Relentless',   'Title: Relentless'],
  [23,  7920, 'avatar', '👹',           'Oni'],
  [24,  8510, 'avatar', '🚀',           'Rocket'],
  [25,  9120, 'theme',  'terminal',     'Terminal theme'],
  [26,  9750, 'avatar', '💀',           'Skull'],
  [27, 10400, 'avatar', '🍑',           'Peach'],
  [28, 11070, 'avatar', '👑',           'Crown'],
  [29, 11760, 'colour', 'shimmer',      'Shimmer name'],
  [30, 12470, 'title',  'Maxed Out',    'Title: Maxed Out']
].map(([tier, xp_required, reward_kind, reward_value, reward_label]) =>
  ({ tier, xp_required, reward_kind, reward_value, reward_label }));

function xpFor(userId) {
  const days  = dayTotals(userId).filter(d => d.qualified &&
                  d.day >= CREW.season_starts && d.day <= CREW.season_ends);
  const weeks = weekBonuses(userId).filter(w => w.week_bonus > 0);
  const wins  = load().titles.filter(t => t.user_id === userId).length;
  return days.length  * PASS_RULES.xp_active_day
       + weeks.length * PASS_RULES.xp_weekly_target
       + wins         * PASS_RULES.xp_challenge_win;
}

const tierFor = (xp) =>
  TIERS.reduce((best, t) => (t.xp_required <= xp ? t.tier : best), 1);

export async function crewPass() {
  return CAST.map(p => {
    const xp = xpFor(p.id);
    return { user_id: p.id, xp, tier: tierFor(xp), colour: p.equipped_colour || null };
  });
}

export async function myPass() {
  const xp = xpFor('demo-me');
  const tier = tierFor(xp);
  const today = new Date();
  const end = parseISO(CREW.season_ends);
  return {
    xp, tier,
    max_tier: PASS_RULES.max_tier,
    season_name: CREW.season_name,
    season_starts: CREW.season_starts,
    season_ends: CREW.season_ends,
    days_left: Math.max(0, Math.round((end - today) / 864e5)),
    tiers: TIERS.map(t => ({ ...t, unlocked: t.tier <= tier })),
    starter_avatars: STARTER_AVATARS
  };
}

export async function equip({ avatar, colour, theme, clearColour, clearTheme }) {
  const tier = tierFor(xpFor('demo-me'));
  const owns = (kind, value) =>
    TIERS.some(t => t.reward_kind === kind && t.reward_value === value && t.tier <= tier);

  if (avatar && !STARTER_AVATARS.includes(avatar) && !owns('avatar', avatar))
    throw new Error('You have not unlocked that avatar yet');
  if (colour && !owns('colour', colour))
    throw new Error('You have not unlocked that name colour yet');
  if (theme && !owns('theme', theme))
    throw new Error('You have not unlocked that theme yet');

  if (avatar) CAST[0].avatar_emoji = avatar;
  if (clearColour) CAST[0].equipped_colour = null; else if (colour) CAST[0].equipped_colour = colour;
  if (clearTheme)  CAST[0].equipped_theme  = null; else if (theme)  CAST[0].equipped_theme  = theme;
  return CAST[0];
}

/* --- feedback ------------------------------------------------------------
   In the demo you're the crew owner, so you see both sides: you can send a
   suggestion and then triage it in the inbox. */
function feedbackStore() {
  const s = load();
  s.feedback ??= [
    { id: 'fb1', user_id: 'demo-jax', kind: 'exercise', status: 'new',  reply: null,
      body: 'No kettlebell snatch in the list. Add it?',
      created_at: new Date(Date.now() - 2 * 864e5).toISOString() },
    { id: 'fb2', user_id: 'demo-sam', kind: 'scoring',  status: 'planned',
      reply: 'Fair. Looking at it for the next update.',
      body: 'Swimming feels underpaid — 1 km of front crawl is harder than 3 km of jogging.',
      created_at: new Date(Date.now() - 5 * 864e5).toISOString() }
  ];
  return s;
}

export async function sendFeedback(_crew, kind, body) {
  const s = feedbackStore();
  s.feedback.unshift({
    id: 'fb' + Date.now(), user_id: 'demo-me', kind, body,
    status: 'new', reply: null, created_at: new Date().toISOString()
  });
  save();
}

export async function myFeedback() {
  return feedbackStore().feedback.filter(f => f.user_id === 'demo-me');
}

export async function crewFeedback() {
  return feedbackStore().feedback
    .map(f => {
      const p = CAST.find(c => c.id === f.user_id);
      return { ...f, display_name: p.display_name, avatar_emoji: p.avatar_emoji };
    })
    .sort((a, b) => (b.status === 'new') - (a.status === 'new') ||
                    b.created_at.localeCompare(a.created_at));
}

export async function feedbackUnread() {
  return feedbackStore().feedback.filter(f => f.status === 'new').length;
}

export async function updateFeedback(id, patch) {
  const s = feedbackStore();
  const row = s.feedback.find(f => f.id === id);
  if (row) Object.assign(row, patch);
  save();
}
