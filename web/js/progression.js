/* ==========================================================================
   Personal progression: what a set is worth, what counts as a personal best,
   and what to try next.

   Mirrors app.fill_entry() and app.metric_of() in
   supabase/08_sets_and_sides.sql. Those are the authority — this exists so the
   log screen can price a set and flag a PB without a round trip while you're
   stood there between sets.

   The working shape for a rep-based exercise is:
       { sets: [{ reps, kg }, ...], perSide: bool }
   and for the others:
       { distanceKm, durationMin }
   ========================================================================== */

const n = (x) => Number(x) || 0;
const tidy = (x) => String(Number(Number(x).toFixed(2)));

/** Epley: compares a heavy triple with a light set of ten. */
export const e1rm = (weight, reps) => n(weight) * (1 + n(reps) / 30);

/** Single-sided work is two lots of everything you entered. */
export const sideMult = (v) => (v.perSide ? 2 : 1);

export const isRepBased = (kind) => kind === 'strength' || kind === 'bodyweight';

/* -------------------------------------------------------------------------
   Effort — each set priced on its own load, then summed.
   ------------------------------------------------------------------------- */
export function effortOf(ex, v) {
  if (!ex) return 0;
  const ppu = n(ex.points_per_unit);

  if (ex.kind === 'distance') return Math.max(0, Math.round(ppu * n(v.distanceKm)));
  if (ex.kind === 'timed')    return Math.max(0, Math.round(ppu * n(v.durationMin)));

  const total = (v.sets || []).reduce((sum, s) => {
    const r = n(s.reps), w = n(s.kg);
    return sum + (ex.kind === 'strength'
      ? ppu * r * Math.min(1 + w / 60, 3)
      : ppu * r);
  }, 0);

  return Math.max(0, Math.round(total * sideMult(v)));
}

/* -------------------------------------------------------------------------
   Metrics, matching app.metric_of()
   ------------------------------------------------------------------------- */
export function metricsOf(kind, v) {
  if (!isRepBased(kind)) {
    return {
      distance_km: n(v.distanceKm),
      duration_min: n(v.durationMin)
    };
  }
  const sets = v.sets || [];
  const mult = sideMult(v);
  return {
    // "heaviest" and "most reps" mean the best single set
    weight: sets.reduce((m, s) => Math.max(m, n(s.kg)), 0),
    reps:   sets.reduce((m, s) => Math.max(m, n(s.reps)), 0),
    e1rm:   sets.reduce((m, s) => Math.max(m, e1rm(s.kg, s.reps)), 0),
    volume: sets.reduce((sum, s) => sum + n(s.reps) * n(s.kg), 0) * mult
  };
}

export const METRICS = {
  weight:       { short: 'Heaviest',  label: 'Heaviest weight',        unit: 'kg',   kinds: ['strength'] },
  e1rm:         { short: 'Est. 1RM',  label: 'Estimated 1 rep max',    unit: 'kg',   kinds: ['strength'] },
  reps:         { short: 'Best set',  label: 'Most reps in a set',     unit: 'reps', kinds: ['strength', 'bodyweight'] },
  volume:       { short: 'Volume',    label: 'Biggest session volume', unit: 'kg',   kinds: ['strength'] },
  distance_km:  { short: 'Furthest',  label: 'Furthest distance',      unit: 'km',   kinds: ['distance'] },
  duration_min: { short: 'Longest',   label: 'Longest time',           unit: 'min',  kinds: ['distance', 'timed'] }
};

export const metricsFor = (kind) =>
  Object.entries(METRICS).filter(([, m]) => m.kinds.includes(kind)).map(([id]) => id);

export function fmtMetric(metric, value) {
  const m = METRICS[metric];
  if (!m || value == null) return '—';
  const x = Number(value);
  if (metric === 'reps' || metric === 'duration_min') return `${Math.round(x)} ${m.unit}`;
  return `${tidy(x)} ${m.unit}`;
}

/** Pace is the one where lower is better. */
export const fmtPace = (minPerKm) => {
  if (!minPerKm) return null;
  const mins = Math.floor(minPerKm);
  const secs = Math.round((minPerKm - mins) * 60);
  return `${mins}:${String(secs).padStart(2, '0')} /km`;
};

/* -------------------------------------------------------------------------
   Reading a set list back as something a human would say
   ------------------------------------------------------------------------- */

/**
 * Weight first, then reps — the way programs are written and the way the set
 * grid is laid out.
 *
 * "3 sets · 60 kg × 8"                  — everything the same
 * "60 kg × 8 · 8 · 10"                  — reps vary, weight doesn't
 * "27.5 kg × 9 (×4) · 22.5 kg × 13"     — both vary; runs are collapsed
 * "3 × 12 reps"                         — bodyweight
 * plus " each side" when it was one arm or leg at a time
 */
export function describeSets(kind, v) {
  const side = v.perSide ? ' each side' : '';

  if (kind === 'distance') {
    return `${tidy(n(v.distanceKm))} km` + (v.durationMin ? ` in ${v.durationMin} min` : '');
  }
  if (kind === 'timed') return `${n(v.durationMin)} min`;

  const sets = (v.sets || []).filter(s => n(s.reps) > 0);
  if (!sets.length) return '';

  const reps = sets.map(s => n(s.reps));
  const kgs  = sets.map(s => n(s.kg));
  const sameReps = reps.every(r => r === reps[0]);
  const sameKg   = kgs.every(k => k === kgs[0]);
  const loaded   = kgs.some(k => k > 0);

  if (!loaded) {
    return (sameReps ? `${sets.length} × ${reps[0]}` : reps.join(' · ')) + ' reps' + side;
  }
  if (sameReps && sameKg) {
    return `${sets.length} sets · ${tidy(kgs[0])} kg × ${reps[0]}` + side;
  }
  if (sameKg) {
    return `${tidy(kgs[0])} kg × ` + reps.join(' · ') + side;
  }

  // Both vary. Collapse runs of identical sets so a drop set reads as
  // "27.5 kg × 9 (×4) · 22.5 kg × 13" rather than spelling out all five.
  const runs = [];
  for (const s of sets) {
    const prev = runs[runs.length - 1];
    if (prev && prev.reps === n(s.reps) && prev.kg === n(s.kg)) prev.count++;
    else runs.push({ reps: n(s.reps), kg: n(s.kg), count: 1 });
  }
  return runs
    .map(r => `${tidy(r.kg)} kg × ${r.reps}` + (r.count > 1 ? ` (×${r.count})` : ''))
    .join(' · ') + side;
}

/** Turn a stored entry (snake_case, from the database) into the working shape. */
export function fromEntry(e) {
  if (e.set_detail && e.set_detail.length) {
    return { sets: e.set_detail.map(s => ({ reps: s.reps, kg: s.kg })),
             perSide: !!e.per_side };
  }
  const count = e.sets || 1;
  return {
    sets: Array.from({ length: count }, () => ({
      reps: e.reps || 0, kg: Number(e.weight_kg) || 0
    })),
    perSide: !!e.per_side,
    distanceKm: e.distance_km != null ? Number(e.distance_km) : null,
    durationMin: e.duration_min ?? null
  };
}

/** What you did last time, from a my_exercise_summary row. */
export function describeLast(kind, s) {
  if (!s || !s.last_on) return null;
  return describeSets(kind, {
    sets: s.last_set_detail?.length
      ? s.last_set_detail
      : Array.from({ length: s.last_sets || 1 },
                   () => ({ reps: s.last_reps || 0, kg: Number(s.last_weight) || 0 })),
    perSide: !!s.last_per_side,
    distanceKm: s.last_distance != null ? Number(s.last_distance) : null,
    durationMin: s.last_duration ?? null
  });
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
   Where the entry sheet starts
   ------------------------------------------------------------------------- */
export function startingValues(ex, s) {
  const sidedDefault = ex.sided === 'always';

  if (s?.last_on) {
    const v = describeLastValues(s);
    return {
      ...v,
      // 'always' exercises stay on even if an old entry predates the setting
      perSide: sidedDefault || !!s.last_per_side
    };
  }

  const blank = {
    strength:   { sets: [{ reps: 10, kg: 20 }, { reps: 10, kg: 20 }, { reps: 10, kg: 20 }] },
    bodyweight: { sets: [{ reps: 12, kg: 0 }, { reps: 12, kg: 0 }, { reps: 12, kg: 0 }] },
    distance:   { distanceKm: 5, durationMin: null },
    timed:      { durationMin: 30 }
  }[ex.kind] || {};

  return { ...blank, perSide: sidedDefault };
}

function describeLastValues(s) {
  if (s.last_set_detail?.length) {
    return { sets: s.last_set_detail.map(x => ({ reps: x.reps, kg: Number(x.kg) || 0 })) };
  }
  return {
    sets: Array.from({ length: s.last_sets || 1 },
                     () => ({ reps: s.last_reps || 0, kg: Number(s.last_weight) || 0 })),
    distanceKm: s.last_distance != null ? Number(s.last_distance) : null,
    durationMin: s.last_duration ?? null
  };
}

/* -------------------------------------------------------------------------
   Progressive overload — small jumps, applied across every set
   ------------------------------------------------------------------------- */
export function suggestions(ex, s) {
  if (!s?.last_on) return [];
  const base = startingValues(ex, s);

  switch (ex.kind) {
    case 'strength': {
      const top = Math.max(...base.sets.map(x => n(x.kg)), 0);
      // 2.5 kg is the smallest pair of plates in most gyms; below 20 kg you're
      // usually on dumbbells or a machine with 1 kg steps.
      const step = top >= 20 ? 2.5 : 1;
      return [
        { id: 'load', label: `+${tidy(step)} kg`, hint: 'every set',
          values: { ...base, sets: base.sets.map(x => ({ ...x, kg: n(x.kg) + step })) } },
        { id: 'rep', label: '+1 rep', hint: 'every set',
          values: { ...base, sets: base.sets.map(x => ({ ...x, reps: n(x.reps) + 1 })) } },
        { id: 'same', label: 'Repeat', hint: 'as last time', values: base }
      ];
    }
    case 'bodyweight':
      return [
        { id: 'rep', label: '+1 rep', hint: 'every set',
          values: { ...base, sets: base.sets.map(x => ({ ...x, reps: n(x.reps) + 1 })) } },
        { id: 'set', label: '+1 set', hint: 'same reps',
          values: { ...base, sets: [...base.sets, { ...base.sets[base.sets.length - 1] }] } },
        { id: 'same', label: 'Repeat', hint: 'as last time', values: base }
      ];
    case 'distance': {
      const km = n(base.distanceKm);
      const up = Math.max(0.1, Math.round(km * 1.05 * 10) / 10);
      return [
        { id: 'far', label: `${tidy(up)} km`, hint: '+5%', values: { ...base, distanceKm: up } },
        { id: 'same', label: 'Repeat', hint: 'as last time', values: base }
      ];
    }
    case 'timed': {
      const mins = n(base.durationMin);
      return [
        { id: 'long', label: `${mins + 5} min`, hint: '+5 min',
          values: { ...base, durationMin: mins + 5 } },
        { id: 'same', label: 'Repeat', hint: 'as last time', values: base }
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
 * Empty for an exercise you've never logged — the first time you do something
 * isn't a personal best worth shouting about, it's just Tuesday.
 */
export function pbCheck(kind, summary, v) {
  if (!summary?.last_on) return [];
  const now = metricsOf(kind, v);
  return metricsFor(kind).filter(metric => {
    const best = bestOf(summary, metric);
    if (best == null) return false;
    // A hair over, so float noise can't claim a PB for an identical set.
    return (now[metric] ?? 0) > best + 0.001;
  });
}
