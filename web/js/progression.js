/* ==========================================================================
   Personal progression: what counts as a personal best, and what to try next.

   Mirrors app.entry_metric() in supabase/07_progression.sql. That file is the
   authority — this exists so the log screen can flag a PB and suggest a jump
   without a round trip while you're stood between sets.
   ========================================================================== */

/** Epley: the standard way to compare a heavy triple with a light set of ten. */
export const e1rm = (weight, reps) =>
  (Number(weight) || 0) * (1 + (Number(reps) || 0) / 30);

export function entryMetric(metric, v) {
  const sets = Number(v.sets) || 1;
  const reps = Number(v.reps) || 0;
  const w    = Number(v.weightKg) || 0;
  switch (metric) {
    case 'weight':       return w;
    case 'reps':         return reps;
    case 'e1rm':         return e1rm(w, reps);
    case 'volume':       return sets * reps * w;
    case 'distance_km':  return Number(v.distanceKm) || 0;
    case 'duration_min': return Number(v.durationMin) || 0;
    default:             return 0;
  }
}

export const METRICS = {
  weight:       { short: 'Heaviest',  label: 'Heaviest weight',    unit: 'kg',   kinds: ['strength'] },
  e1rm:         { short: 'Est. 1RM',  label: 'Estimated 1 rep max', unit: 'kg',  kinds: ['strength'] },
  reps:         { short: 'Best set',  label: 'Most reps in a set', unit: 'reps', kinds: ['strength', 'bodyweight'] },
  volume:       { short: 'Volume',    label: 'Biggest session volume', unit: 'kg', kinds: ['strength'] },
  distance_km:  { short: 'Furthest',  label: 'Furthest distance',  unit: 'km',   kinds: ['distance'] },
  duration_min: { short: 'Longest',   label: 'Longest time',       unit: 'min',  kinds: ['distance', 'timed'] }
};

export const metricsFor = (kind) =>
  Object.entries(METRICS).filter(([, m]) => m.kinds.includes(kind)).map(([id]) => id);

const round = (n, step) => Math.round(n / step) * step;
const tidy  = (n) => String(Number(Number(n).toFixed(2)));

export function fmtMetric(metric, value) {
  const m = METRICS[metric];
  if (!m || value == null) return '—';
  const n = Number(value);
  if (metric === 'reps' || metric === 'duration_min') return `${Math.round(n)} ${m.unit}`;
  return `${tidy(n)} ${m.unit}`;
}

/** Pace is the one where lower is better. */
export const fmtPace = (minPerKm) => {
  if (!minPerKm) return null;
  const mins = Math.floor(minPerKm);
  const secs = Math.round((minPerKm - mins) * 60);
  return `${mins}:${String(secs).padStart(2, '0')} /km`;
};

/* -------------------------------------------------------------------------
   What you did last time, as a readable line
   ------------------------------------------------------------------------- */
export function describeLast(kind, s) {
  if (!s || !s.last_on) return null;
  switch (kind) {
    case 'strength':
      return `${s.last_sets || 1} × ${s.last_reps || 0} @ ${tidy(s.last_weight || 0)} kg`;
    case 'bodyweight':
      return `${s.last_sets || 1} × ${s.last_reps || 0} reps`;
    case 'distance':
      return `${tidy(s.last_distance || 0)} km` +
             (s.last_duration ? ` in ${s.last_duration} min` : '');
    case 'timed':
      return `${s.last_duration || 0} min`;
    default:
      return null;
  }
}

/** "12 days ago" / "Yesterday" */
export function agoLabel(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  const then = new Date(y, m - 1, d);
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const days = Math.round((now - then) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 14) return 'last week';
  if (days < 60) return `${Math.round(days / 7)} weeks ago`;
  return `${Math.round(days / 30)} months ago`;
}

/* -------------------------------------------------------------------------
   Progressive overload
   ------------------------------------------------------------------------- */

/** Starting values for the entry sheet: last time's numbers, or a sane guess. */
export function startingValues(kind, s) {
  if (s?.last_on) {
    return {
      sets:        s.last_sets ?? null,
      reps:        s.last_reps ?? null,
      weightKg:    s.last_weight != null ? Number(s.last_weight) : null,
      distanceKm:  s.last_distance != null ? Number(s.last_distance) : null,
      durationMin: s.last_duration ?? null
    };
  }
  return {
    strength:   { sets: 3, reps: 10, weightKg: 20 },
    bodyweight: { sets: 3, reps: 12 },
    distance:   { distanceKm: 5 },
    timed:      { durationMin: 30 }
  }[kind] || {};
}

/**
 * Two or three concrete things to try, given what you did last time.
 * Deliberately small jumps — the point is to still be adding a year from now.
 */
export function suggestions(kind, s) {
  if (!s?.last_on) return [];
  const base = startingValues(kind, s);

  switch (kind) {
    case 'strength': {
      const w = base.weightKg || 0;
      // 2.5 kg is the smallest pair of plates in most gyms; below 20 kg you're
      // usually on dumbbells or a machine where 1 kg steps exist.
      const step = w >= 20 ? 2.5 : 1;
      const up = round(w + step, step);
      return [
        { id: 'load', label: `${tidy(up)} kg`, hint: `+${tidy(step)} kg`,
          values: { ...base, weightKg: up } },
        { id: 'rep',  label: `${(base.reps || 0) + 1} reps`, hint: 'same weight',
          values: { ...base, reps: (base.reps || 0) + 1 } },
        { id: 'same', label: 'Repeat', hint: 'same as last time', values: base }
      ];
    }
    case 'bodyweight':
      return [
        { id: 'rep',  label: `${(base.reps || 0) + 1} reps`, hint: '+1 per set',
          values: { ...base, reps: (base.reps || 0) + 1 } },
        { id: 'set',  label: `${(base.sets || 1) + 1} sets`, hint: '+1 set',
          values: { ...base, sets: (base.sets || 1) + 1 } },
        { id: 'same', label: 'Repeat', hint: 'same as last time', values: base }
      ];
    case 'distance': {
      const km = base.distanceKm || 0;
      const up = Math.max(0.1, round(km * 1.05, 0.1));
      return [
        { id: 'far',  label: `${tidy(up)} km`, hint: '+5%',
          values: { ...base, distanceKm: up } },
        { id: 'same', label: 'Repeat', hint: 'same as last time', values: base }
      ];
    }
    case 'timed': {
      const mins = base.durationMin || 0;
      return [
        { id: 'long', label: `${mins + 5} min`, hint: '+5 min',
          values: { ...base, durationMin: mins + 5 } },
        { id: 'same', label: 'Repeat', hint: 'same as last time', values: base }
      ];
    }
    default:
      return [];
  }
}

/* -------------------------------------------------------------------------
   Personal bests
   ------------------------------------------------------------------------- */

const BEST_FIELD = {
  weight: 'best_weight', reps: 'best_reps', e1rm: 'best_e1rm',
  volume: 'best_volume', distance_km: 'best_distance', duration_min: 'best_duration'
};

export const bestOf = (summary, metric) =>
  summary?.[BEST_FIELD[metric]] != null ? Number(summary[BEST_FIELD[metric]]) : null;

/**
 * Which personal bests these numbers would beat.
 * Returns [] for an exercise you've never logged — the first time you do
 * something isn't a personal best worth shouting about, it's just Tuesday.
 */
export function pbCheck(kind, summary, v) {
  if (!summary?.last_on) return [];
  return metricsFor(kind).filter(metric => {
    const best = bestOf(summary, metric);
    if (best == null) return false;
    // A hair over avoids float noise claiming a PB for an identical set.
    return entryMetric(metric, v) > best + 0.001;
  });
}
