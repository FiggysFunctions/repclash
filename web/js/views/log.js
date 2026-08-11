/* ==========================================================================
   Logging a workout.

   A session is built up as a local "draft" first, so you can add exercises
   between sets without hitting the network, then saved in one go.
   ========================================================================== */

import * as api from '../api.js';
import {
  $, esc, num, toastOk, toastBad, todayISO, addDays, relDay, fmtDate,
  sheet, confirmSheet, plural, live
} from '../ui.js';
import {
  describeLast, agoLabel, startingValues, suggestions, pbCheck, METRICS
} from '../progression.js';
import { openExercise } from './progress.js';

const DRAFT_KEY = 'repclash.draft';

const draft = {
  read() {
    try {
      const d = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
      if (d && Array.isArray(d.entries)) return d;
    } catch { /* corrupt draft — start fresh */ }
    return { date: todayISO(), note: '', entries: [], isPrivate: false };
  },
  write(d) { localStorage.setItem(DRAFT_KEY, JSON.stringify(d)); },
  clear()  { localStorage.removeItem(DRAFT_KEY); }
};

let d = null;        // the working draft
let catalog = [];    // exercise list
let summary = new Map();   // exercise_id → your history: last set + personal bests

export async function render(root, ctx) {
  d = draft.read();
  // A draft left over from a previous day still belongs to that day, but if
  // it's empty just move it to today and re-apply the privacy preference.
  if (!d.entries.length) {
    if (d.date !== todayISO()) d.date = todayISO();
    d.isPrivate = !!ctx.profile.default_private;
  }

  root.innerHTML = `
    <div class="view">
      <div class="hdr">
        <div class="hdr-txt">
          <h1>Log a workout</h1>
          <p id="datelabel">${relDay(d.date)}</p>
        </div>
        <button class="icon-btn" id="pickdate" aria-label="Change date">📅</button>
      </div>
      <div id="body"><div class="skel"></div><div class="skel"></div></div>
    </div>`;

  $('#pickdate', root).addEventListener('click', () => dateSheet(root, ctx));

  const body = $('#body', root);
  try {
    const [list, rows] = await Promise.all([
      api.exercises(),
      // Your own history. Nice-to-have: if 07_progression.sql hasn't been run
      // the logger still works, just without last-time recall.
      api.exerciseSummary().catch(() => [])
    ]);
    catalog = list;
    summary = new Map(rows.map(r => [r.exercise_id, r]));
  } catch (e) {
    if (live(body)) body.innerHTML = `<div class="err">${esc(e.message)}</div>`;
    return;
  }
  if (!live(body)) return;

  drawBody(root, ctx);
}

/* ------------------------------------------------------------------------- */

function drawBody(root, ctx) {
  const total = d.entries.reduce((s, e) => s + e.points, 0);
  const capped = Math.min(total, ctx.rules.daily_effort_cap);
  const overCap = total > ctx.rules.daily_effort_cap;

  $('#datelabel', root).textContent = relDay(d.date);

  $('#body', root).innerHTML = `
    ${d.entries.length ? `
      <div class="hero">
        <div class="hero-top">
          <div>
            <div class="hero-l">This session</div>
            <div class="hero-n">${num(capped)}</div>
          </div>
          <div class="hero-rank">
            <b>${d.entries.length}</b>
            <span>${d.entries.length === 1 ? 'exercise' : 'exercises'}</span>
          </div>
        </div>
        ${overCap ? `<p class="hint" style="margin-top:10px">
          Daily cap reached — anything past ${num(ctx.rules.daily_effort_cap)} effort
          points in a day doesn't add to your score. Consistency beats one big day.
        </p>` : ''}
      </div>

      ${d.entries.map((e, i) => `
        <div class="draft-item">
          <div style="font-size:1.3rem">${esc(e.emoji)}</div>
          <div class="draft-main">
            <div class="draft-name">${esc(e.name)}
              ${e.isPb ? '<span class="pb-dot" title="Personal best">🏆</span>' : ''}
            </div>
            <div class="draft-detail">${esc(e.detail)}</div>
          </div>
          <div class="draft-pts">+${num(e.points)}</div>
          <button class="draft-x" data-rm="${i}" aria-label="Remove ${esc(e.name)}">✕</button>
        </div>`).join('')}
    ` : `
      <div class="empty" style="padding:30px 20px">
        <div class="empty-em">🏋️</div>
        <p><b>Nothing added yet.</b></p>
        <p>Add what you did and watch the points stack up.</p>
      </div>`}

    <button class="btn ${d.entries.length ? '' : 'btn-primary'} mt" id="add">
      ＋ Add exercise
    </button>

    ${d.entries.length ? `
      <div class="field mt">
        <label for="note">Note (optional)</label>
        <input class="input" id="note" maxlength="280"
               placeholder="Felt strong. Legs are gone." value="${esc(d.note)}">
      </div>

      <div class="privacy-row">
        <div>
          <div class="privacy-t">${d.isPrivate ? '🔒 Keep this private' : '👀 Show the crew'}</div>
          <div class="privacy-s">${d.isPrivate
            ? 'Hidden from the feed. Still scores exactly the same.'
            : 'Your exercises, reps and weights appear in the feed.'}</div>
        </div>
        <button class="switch ${d.isPrivate ? '' : 'on'}" id="priv"
                role="switch" aria-checked="${!d.isPrivate}"
                aria-label="Show this session to the crew"><span></span></button>
      </div>

      <button class="btn btn-primary" id="save">Save session · ${num(capped)} pts</button>
      <button class="btn btn-ghost mt" id="discard">Discard</button>
    ` : ''}

    <div class="section-title">Recent sessions</div>
    <div id="recent"><div class="skel" style="height:56px"></div></div>`;

  $('#add', root).addEventListener('click', () => pickerSheet(root, ctx));

  root.querySelectorAll('[data-rm]').forEach(b =>
    b.addEventListener('click', () => {
      d.entries.splice(Number(b.dataset.rm), 1);
      draft.write(d);
      drawBody(root, ctx);
    }));

  $('#note', root)?.addEventListener('input', e => {
    d.note = e.target.value;
    draft.write(d);
  });

  $('#priv', root)?.addEventListener('click', () => {
    d.isPrivate = !d.isPrivate;
    draft.write(d);
    drawBody(root, ctx);
  });

  $('#save', root)?.addEventListener('click', () => saveSession(root, ctx));

  $('#discard', root)?.addEventListener('click', async () => {
    const ok = await confirmSheet({
      title: 'Discard this session?',
      body: `${plural(d.entries.length, 'exercise')} will be thrown away.`,
      confirmLabel: 'Discard', danger: true
    });
    if (!ok) return;
    draft.clear();
    d = draft.read();
    drawBody(root, ctx);
  });

  loadRecent(root, ctx);
}

/* ------------------------------------------------------------------------- */

function dateSheet(root, ctx) {
  const today = todayISO();
  const days = [0, -1, -2, -3, -4, -5, -6].map(n => addDays(today, n));

  const s = sheet(`
    <h2>When was this?</h2>
    <p class="sub">You can back-fill up to a week. Be honest — everyone can see it.</p>
    ${days.map(iso => `
      <div class="row" data-d="${iso}">
        <div class="row-av">${iso === d.date ? '✅' : '📅'}</div>
        <div class="row-main">
          <div class="row-name">${relDay(iso)}</div>
          <div class="row-sub">${fmtDate(iso, { weekday: 'long', day: 'numeric', month: 'long' })}</div>
        </div>
      </div>`).join('')}
  `);

  s.el.querySelectorAll('[data-d]').forEach(el =>
    el.addEventListener('click', () => {
      d.date = el.dataset.d;
      draft.write(d);
      s.close();
      drawBody(root, ctx);
    }));
}

/* Roughly head-to-toe, so the refine strip reads in a sensible order rather
   than alphabetically. Anything not listed falls in at the end. */
const MUSCLE_ORDER = ['Chest', 'Back', 'Shoulders', 'Arms', 'Core',
                      'Legs', 'Glutes', 'Full body', 'Cardio'];

function pickerSheet(root, ctx) {
  const cats = [...new Set(catalog.map(e => e.category))];
  let cat = summary.size ? 'Recent' : 'All';
  let muscle = 'All';
  let q = '';

  // Exercises you actually do, most recent first — usually what you want.
  const recentIds = [...summary.values()]
    .sort((a, b) => String(b.last_on).localeCompare(String(a.last_on)))
    .map(r => r.exercise_id);

  const s = sheet(`
    <h2>Add exercise</h2>
    <div class="field" style="margin-bottom:10px">
      <input class="input" id="q" placeholder="Search name, muscle or kit…"
             autocapitalize="off" autocorrect="off">
    </div>
    <div class="cat-strip" id="cats">
      ${[...(summary.size ? ['Recent'] : []), 'All', ...cats].map(c =>
        `<button class="chip ${c === cat ? 'on' : ''}" data-c="${esc(c)}">${esc(c)}</button>`).join('')}
    </div>
    <div class="cat-strip cat-strip-sub" id="muscles"></div>
    <div class="ex-list" id="list"></div>
  `);

  const list = $('#list', s.el);

  // Searching matches equipment and muscle too, so "smith", "cable" or
  // "glutes" all find the right thing without knowing an exercise's name.
  const haystack = (e) =>
    `${e.name} ${e.muscle || ''} ${e.equipment || ''}`.toLowerCase();

  const inCategory = (e) =>
    cat === 'All' || cat === 'Recent' || e.category === cat;

  /** Muscle chips for whatever the category filter currently allows. */
  const paintMuscles = () => {
    const host = $('#muscles', s.el);
    const pool = catalog.filter(inCategory);
    const present = [...new Set(pool.map(e => e.muscle).filter(Boolean))]
      .sort((a, b) => {
        const ia = MUSCLE_ORDER.indexOf(a), ib = MUSCLE_ORDER.indexOf(b);
        return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
      });

    // Only worth showing when there's actually too much to scroll.
    if (pool.length < 18 || present.length < 3) {
      host.innerHTML = '';
      host.hidden = true;
      muscle = 'All';
      return;
    }
    host.hidden = false;
    host.innerHTML = ['All', ...present].map(m =>
      `<button class="chip chip-sm ${m === muscle ? 'on' : ''}" data-m="${esc(m)}">${esc(m)}</button>`
    ).join('');

    host.querySelectorAll('[data-m]').forEach(b =>
      b.addEventListener('click', () => {
        muscle = b.dataset.m;
        host.querySelectorAll('[data-m]').forEach(x => x.classList.toggle('on', x === b));
        paint();
      }));
  };

  const paint = () => {
    const needle = q.trim().toLowerCase();
    let items = catalog.filter(e =>
      inCategory(e) &&
      (muscle === 'All' || e.muscle === muscle) &&
      (!needle || haystack(e).includes(needle)));

    if (cat === 'Recent' && !needle) {
      const order = new Map(recentIds.map((id, i) => [id, i]));
      items = items.filter(e => order.has(e.id))
                   .sort((a, b) => order.get(a.id) - order.get(b.id));
    }

    list.innerHTML = items.length ? items.map(e => {
      const s = summary.get(e.id);
      const last = describeLast(e.kind, s);
      // Your own history if you have any, otherwise what kit it needs — with
      // 200 exercises, "Machine · Glutes" is the thing that tells them apart.
      const sub = last
        ? `Last: ${last} · ${agoLabel(s.last_on)}`
        : [e.equipment, e.muscle].filter(Boolean).join(' · ');
      return `
      <button class="ex" data-ex="${esc(e.id)}">
        <span class="ex-emoji">${esc(e.emoji)}</span>
        <span class="ex-main">
          <span class="ex-name">${esc(e.name)}</span>
          ${sub ? `<span class="ex-last">${esc(sub)}</span>` : ''}
        </span>
        <span class="ex-kind">${kindLabel(e.kind)}</span>
      </button>`;
    }).join('')
      : `<p class="hint center" style="padding:20px">Nothing matches "${esc(q)}".</p>`;

    list.querySelectorAll('[data-ex]').forEach(b =>
      b.addEventListener('click', () => {
        const ex = catalog.find(x => x.id === b.dataset.ex);
        s.close();
        entrySheet(ex, root, ctx);
      }));
  };

  $('#q', s.el).addEventListener('input', e => { q = e.target.value; paint(); });

  s.el.querySelectorAll('[data-c]').forEach(b =>
    b.addEventListener('click', () => {
      cat = b.dataset.c;
      muscle = 'All';   // a new category means the old muscle filter may not exist
      s.el.querySelectorAll('[data-c]').forEach(x => x.classList.toggle('on', x === b));
      paintMuscles();
      paint();
    }));

  paintMuscles();
  paint();
}

const kindLabel = (k) => ({
  strength: 'sets × reps',
  bodyweight: 'reps',
  distance: 'km',
  timed: 'minutes'
}[k] || '');

function entrySheet(ex, root, ctx) {
  const hist  = summary.get(ex.id);
  const start = startingValues(ex.kind, hist);
  const chips = suggestions(ex.kind, hist);
  const val   = (n) => (n == null ? '' : n);

  const fields = {
    strength: `
      <div class="num-grid">
        <div class="field"><label for="sets">Sets</label>
          <input class="input" id="sets" type="number" inputmode="numeric" min="1" max="50" value="${val(start.sets ?? 3)}"></div>
        <div class="field"><label for="reps">Reps per set</label>
          <input class="input" id="reps" type="number" inputmode="numeric" min="1" max="1000" value="${val(start.reps ?? 10)}"></div>
      </div>
      <div class="field mt"><label for="weight">Weight (kg)</label>
        <input class="input" id="weight" type="number" inputmode="decimal" min="0" max="700" step="0.5" value="${val(start.weightKg ?? 20)}"></div>`,
    bodyweight: `
      <div class="num-grid">
        <div class="field"><label for="sets">Sets</label>
          <input class="input" id="sets" type="number" inputmode="numeric" min="1" max="50" value="${val(start.sets ?? 3)}"></div>
        <div class="field"><label for="reps">Reps per set</label>
          <input class="input" id="reps" type="number" inputmode="numeric" min="1" max="1000" value="${val(start.reps ?? 12)}"></div>
      </div>`,
    distance: `
      <div class="num-grid">
        <div class="field"><label for="dist">Distance (km)</label>
          <input class="input" id="dist" type="number" inputmode="decimal" min="0" max="300" step="0.1" value="${val(start.distanceKm ?? 5)}"></div>
        <div class="field"><label for="dur">Minutes (optional)</label>
          <input class="input" id="dur" type="number" inputmode="numeric" min="0" max="1440" placeholder="—" value="${val(start.durationMin)}"></div>
      </div>`,
    timed: `
      <div class="field"><label for="dur">Minutes</label>
        <input class="input" id="dur" type="number" inputmode="numeric" min="1" max="1440" value="${val(start.durationMin ?? 30)}"></div>`
  }[ex.kind];

  const lastLine = describeLast(ex.kind, hist);

  const s = sheet(`
    <div class="center" style="padding-bottom:6px">
      <div style="font-size:2.4rem">${esc(ex.emoji)}</div>
      <h2 style="margin:6px 0 2px">${esc(ex.name)}</h2>
      <p class="sub" style="margin:0">${esc(ex.category)}</p>
    </div>

    ${lastLine ? `
      <div class="lasttime">
        <div>
          <div class="lasttime-l">Last time · ${esc(agoLabel(hist.last_on))}</div>
          <div class="lasttime-v">${esc(lastLine)}</div>
        </div>
        <button class="btn btn-sm" data-hist>History</button>
      </div>` : `
      <p class="hint center" style="margin:0 0 14px">
        First time logging this — we'll remember it for next time.
      </p>`}

    ${chips.length ? `
      <div class="suggest">
        <div class="suggest-l">Try this time</div>
        <div class="suggest-row">
          ${chips.map(c => `
            <button class="sug" data-sug="${esc(c.id)}">
              <b>${esc(c.label)}</b>
              <span>${esc(c.hint)}</span>
            </button>`).join('')}
        </div>
      </div>` : ''}

    ${fields}

    <div id="pbflag"></div>
    <div class="preview"><b id="pts">0</b><span>points</span></div>
    <button class="btn btn-primary" data-add>Add to session</button>
  `);

  const read = () => ({
    sets:        numVal(s.el, '#sets'),
    reps:        numVal(s.el, '#reps'),
    weightKg:    numVal(s.el, '#weight'),
    distanceKm:  numVal(s.el, '#dist'),
    durationMin: numVal(s.el, '#dur')
  });

  const write = (v) => {
    const put = (sel, n) => { const el = $(sel, s.el); if (el && n != null) el.value = n; };
    put('#sets', v.sets); put('#reps', v.reps); put('#weight', v.weightKg);
    put('#dist', v.distanceKm); put('#dur', v.durationMin);
  };

  const update = () => {
    const v = read();
    $('#pts', s.el).textContent = num(api.previewEffort(ex, v));

    const pbs = pbCheck(ex.kind, hist, v);
    $('#pbflag', s.el).innerHTML = pbs.length
      ? `<div class="pbflag">🏆 New PB — ${pbs.map(m => esc(METRICS[m].short.toLowerCase())).join(', ')}</div>`
      : '';
  };

  s.el.querySelectorAll('input').forEach(i => i.addEventListener('input', update));

  s.el.querySelectorAll('[data-sug]').forEach(b =>
    b.addEventListener('click', () => {
      const chip = chips.find(c => c.id === b.dataset.sug);
      write(chip.values);
      s.el.querySelectorAll('[data-sug]').forEach(x => x.classList.toggle('on', x === b));
      update();
    }));

  $('[data-hist]', s.el)?.addEventListener('click', () => {
    s.close();
    openExercise(ex, hist, () => entrySheet(ex, root, ctx));
  });

  update();

  $('[data-add]', s.el).addEventListener('click', () => {
    const v = read();
    const points = api.previewEffort(ex, v);
    if (points <= 0) {
      toastBad('Put some numbers in first.');
      return;
    }
    const pbs = pbCheck(ex.kind, hist, v);
    d.entries.push({
      exerciseId: ex.id,
      name: ex.name,
      emoji: ex.emoji,
      detail: describe(ex, v),
      points,
      isPb: pbs.length > 0,
      ...v
    });
    draft.write(d);
    s.close();
    if (pbs.length) toastOk(`New PB on ${ex.name} 🏆`);
    drawBody(root, ctx);
  });
}

function numVal(root, sel) {
  const el = $(sel, root);
  if (!el || el.value === '') return null;
  const n = Number(el.value);
  return Number.isFinite(n) ? n : null;
}

function describe(ex, v) {
  switch (ex.kind) {
    case 'strength':
      return `${v.sets || 1} × ${v.reps || 0} @ ${v.weightKg || 0} kg`;
    case 'bodyweight':
      return `${v.sets || 1} × ${v.reps || 0} reps`;
    case 'distance':
      return `${v.distanceKm || 0} km${v.durationMin ? ` · ${v.durationMin} min` : ''}`;
    case 'timed':
      return `${v.durationMin || 0} min`;
    default: return '';
  }
}

/* ------------------------------------------------------------------------- */

async function saveSession(root, ctx) {
  const btn = $('#save', root);
  btn.disabled = true;
  btn.textContent = 'Saving…';
  try {
    await api.saveWorkout({
      performedOn: d.date,
      note: d.note,
      entries: d.entries,
      isPrivate: d.isPrivate
    });
    draft.clear();
    d = draft.read();
    toastOk('Session logged 🔥');
    ctx.bumpBoard();
    drawBody(root, ctx);
  } catch (e) {
    toastBad(e.message);
    btn.disabled = false;
    btn.textContent = 'Save session';
  }
}

async function loadRecent(root, ctx) {
  const host = $('#recent', root);
  if (!host) return;
  try {
    const rows = await api.myWorkouts(12);
    if (!live(host)) return;          // a newer render already took over
    if (!rows.length) {
      host.innerHTML = '<p class="hint center" style="padding:12px">No sessions logged yet.</p>';
      return;
    }
    host.innerHTML = rows.map(w => {
      const pts = w.workout_entries.reduce((s, e) => s + e.effort_points, 0);
      const names = w.workout_entries.map(e => e.exercises?.name).filter(Boolean);
      return `
        <div class="row" data-w="${esc(w.id)}">
          <div class="row-av">${esc(w.workout_entries[0]?.exercises?.emoji || '🏋️')}</div>
          <div class="row-main">
            <div class="row-name">${relDay(w.performed_on)}
              ${w.is_private ? '<span class="lock">🔒</span>' : ''}
            </div>
            <div class="row-sub">${esc(names.slice(0, 3).join(', '))}${names.length > 3 ? ` +${names.length - 3}` : ''}</div>
          </div>
          <div class="row-pts">${num(pts)}<span>effort</span></div>
        </div>`;
    }).join('');

    host.querySelectorAll('[data-w]').forEach(el =>
      el.addEventListener('click', () => workoutSheet(rows.find(r => r.id === el.dataset.w), root, ctx)));
  } catch (e) {
    if (live(host)) host.innerHTML = `<p class="hint center">${esc(e.message)}</p>`;
  }
}

function workoutSheet(w, root, ctx) {
  if (!w) return;
  const pts = w.workout_entries.reduce((s, e) => s + e.effort_points, 0);

  const s = sheet(`
    <h2>${relDay(w.performed_on)}</h2>
    <p class="sub">${fmtDate(w.performed_on, { weekday: 'long', day: 'numeric', month: 'long' })} · ${num(pts)} effort points</p>
    ${w.note ? `<p class="hint" style="margin-bottom:12px">"${esc(w.note)}"</p>` : ''}
    ${w.workout_entries.map(e => `
      <div class="draft-item">
        <div style="font-size:1.2rem">${esc(e.exercises?.emoji || '🏋️')}</div>
        <div class="draft-main">
          <div class="draft-name">${esc(e.exercises?.name || 'Exercise')}</div>
          <div class="draft-detail">${esc(entryDetail(e))}</div>
        </div>
        <div class="draft-pts">${num(e.effort_points)}</div>
      </div>`).join('')}

    <div class="privacy-row mt">
      <div>
        <div class="privacy-t">${w.is_private ? '🔒 Private' : '👀 Visible to the crew'}</div>
        <div class="privacy-s">${w.is_private
          ? 'Hidden from the feed. Still scores the same.'
          : 'Everyone in the crew can see this in the feed.'}</div>
      </div>
      <button class="switch ${w.is_private ? '' : 'on'}" data-priv
              role="switch" aria-checked="${!w.is_private}"
              aria-label="Visible to the crew"><span></span></button>
    </div>

    <button class="btn btn-danger mt" data-del>Delete this session</button>
  `);

  $('[data-priv]', s.el).addEventListener('click', async () => {
    const btn = $('[data-priv]', s.el);
    const next = !w.is_private;
    btn.disabled = true;
    try {
      await api.setWorkoutPrivacy(w.id, next);
      w.is_private = next;
      s.close();
      toastOk(next ? 'Hidden from the crew' : 'Visible to the crew');
      loadRecent(root, ctx);
    } catch (e) {
      toastBad(e.message);
      btn.disabled = false;
    }
  });

  $('[data-del]', s.el).addEventListener('click', async () => {
    const ok = await confirmSheet({
      title: 'Delete session?',
      body: 'The points go with it. This can\'t be undone.',
      confirmLabel: 'Delete', danger: true,
      back: () => workoutSheet(w, root, ctx)
    });
    if (!ok) return;
    try {
      await api.deleteWorkout(w.id);
      s.close();
      toastOk('Session deleted');
      ctx.bumpBoard();
      loadRecent(root, ctx);
    } catch (e) { toastBad(e.message); }
  });
}

function entryDetail(e) {
  const bits = [];
  if (e.sets && e.reps) bits.push(`${e.sets} × ${e.reps}`);
  else if (e.reps) bits.push(`${e.reps} reps`);
  if (e.weight_kg) bits.push(`${e.weight_kg} kg`);
  if (e.distance_km) bits.push(`${e.distance_km} km`);
  if (e.duration_min) bits.push(`${e.duration_min} min`);
  return bits.join(' · ');
}
