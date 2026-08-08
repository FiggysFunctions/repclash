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

/* --- a small slice of the real catalog ----------------------------------- */
const EXERCISES = [
  ['back-squat','Back Squat','Strength','strength',1.20,'🏋️'],
  ['deadlift','Deadlift','Strength','strength',1.30,'🏋️'],
  ['bench-press','Bench Press','Strength','strength',1.10,'🏋️'],
  ['overhead-press','Overhead Press','Strength','strength',1.10,'🏋️'],
  ['barbell-row','Barbell Row','Strength','strength',1.05,'🏋️'],
  ['romanian-deadlift','Romanian Deadlift','Strength','strength',1.10,'🏋️'],
  ['dumbbell-press','Dumbbell Press','Strength','strength',1.00,'💪'],
  ['lat-pulldown','Lat Pulldown','Strength','strength',0.85,'💪'],
  ['leg-press','Leg Press','Strength','strength',0.55,'💪'],
  ['bicep-curl','Bicep Curl','Strength','strength',0.70,'💪'],
  ['hip-thrust','Hip Thrust','Strength','strength',0.70,'🏋️'],
  ['push-up','Push-up','Bodyweight','bodyweight',0.90,'🤸'],
  ['pull-up','Pull-up','Bodyweight','bodyweight',3.00,'🤸'],
  ['dip','Dip','Bodyweight','bodyweight',2.00,'🤸'],
  ['burpee','Burpee','Bodyweight','bodyweight',2.20,'🤸'],
  ['air-squat','Bodyweight Squat','Bodyweight','bodyweight',0.45,'🤸'],
  ['lunge','Lunge','Bodyweight','bodyweight',0.60,'🤸'],
  ['sit-up','Sit-up','Core','bodyweight',0.45,'🧘'],
  ['plank','Plank','Core','timed',12.00,'🧘'],
  ['leg-raise','Hanging Leg Raise','Core','bodyweight',0.80,'🧘'],
  ['run','Run (outdoor)','Cardio','distance',30.00,'🏃'],
  ['treadmill-run','Treadmill Run','Cardio','distance',27.00,'🏃'],
  ['walk','Walk','Cardio','distance',8.00,'🚶'],
  ['cycle','Cycle (outdoor)','Cardio','distance',10.00,'🚴'],
  ['swim','Swim','Cardio','distance',120.00,'🏊'],
  ['row-erg','Rowing Machine','Cardio','distance',22.00,'🚣'],
  ['jump-rope','Jump Rope','Cardio','timed',8.00,'🪢'],
  ['hiit','HIIT Session','Class','timed',7.00,'🔥'],
  ['crossfit-wod','CrossFit WOD','Class','timed',8.00,'🔥'],
  ['spin-class','Spin Class','Class','timed',6.00,'🚴'],
  ['boxing','Boxing','Class','timed',7.00,'🥊'],
  ['yoga','Yoga','Class','timed',3.00,'🧘'],
  ['football','Football / Soccer','Sport','timed',4.00,'⚽'],
  ['basketball','Basketball','Sport','timed',4.50,'🏀'],
  ['tennis','Tennis','Sport','timed',4.00,'🎾'],
  ['climbing','Climbing / Bouldering','Sport','timed',6.00,'🧗']
].map(([id, name, category, kind, ppu, emoji], i) => ({
  id, name, category, kind, points_per_unit: ppu, emoji, sort_order: i, active: true
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
      workouts.push({
        id: `demo-w${++wid}`,
        user_id: person.id,
        performed_on: day,
        note: null,
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
      const sets = 3 + Math.floor(rand() * 3);
      const reps = 5 + Math.floor(rand() * 7);
      const weight = Math.round((size / 6) * jitter / 2.5) * 2.5;
      return { sets, reps, weight_kg: weight, distance_km: null, duration_min: null };
    }
    case 'bodyweight': {
      const sets = 3 + Math.floor(rand() * 2);
      const reps = 8 + Math.floor(rand() * 10);
      return { sets, reps, weight_kg: null, distance_km: null, duration_min: null };
    }
    case 'distance': {
      // Work backwards from a believable effort figure so we don't generate
      // an 8 km swim next to an 8 km walk.
      const target = 70 + rand() * 190;
      const km = Math.max(0.5, Math.min(30, target / ex.points_per_unit * jitter));
      return {
        sets: null, reps: null, weight_kg: null,
        distance_km: Math.round(km * 10) / 10,
        duration_min: null
      };
    }
    default:
      return {
        sets: null, reps: null, weight_kg: null, distance_km: null,
        duration_min: Math.round((20 + rand() * 40) * jitter)
      };
  }
}

function effort(ex, v) {
  const ppu = ex.points_per_unit;
  switch (ex.kind) {
    case 'strength':
      return Math.round(ppu * (v.sets || 1) * (v.reps || 0) * Math.min(1 + (v.weight_kg || 0) / 60, 3));
    case 'bodyweight':
      return Math.round(ppu * (v.sets || 1) * (v.reps || 0));
    case 'distance':
      return Math.round(ppu * (v.distance_km || 0));
    case 'timed':
      return Math.round(ppu * (v.duration_min || 0));
    default: return 0;
  }
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

export async function saveWorkout({ performedOn, note, entries }) {
  const s = load();
  const w = {
    id: `demo-w${s.nextId++}`,
    user_id: 'demo-me',
    performed_on: performedOn,
    note: note || null,
    entries: entries.map(e => {
      const ex = EXERCISES.find(x => x.id === e.exerciseId);
      const v = {
        sets: e.sets ?? null, reps: e.reps ?? null,
        weight_kg: e.weightKg ?? null,
        distance_km: e.distanceKm ?? null,
        duration_min: e.durationMin ?? null
      };
      return { ...v, exercise_id: e.exerciseId, effort_points: effort(ex, v) };
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

export async function seasonChampions() { return []; }

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
