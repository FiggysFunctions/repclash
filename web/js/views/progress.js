/* ==========================================================================
   Your lifts: personal bests, history and goals.

   None of this is shared with the crew. It's the half of the app that's about
   beating last month rather than beating Jax.
   ========================================================================== */

import * as api from '../api.js';
import {
  $, esc, num, sheet, confirmSheet, toastOk, toastBad, fmtDate, plural
} from '../ui.js';
import {
  METRICS, metricsFor, bestOf, fmtMetric, fmtPace, describeLast, agoLabel,
  describeSets, fromEntry
} from '../progression.js';

/* -------------------------------------------------------------------------
   Me tab: a compact card, tap for everything
   ------------------------------------------------------------------------- */
export function progressCardHtml(summary, goals) {
  const live = goals.filter(g => !g.achieved_on);
  const hit  = goals.filter(g => g.achieved_on);

  return `
    <button class="lifts" id="lifts">
      <div class="lifts-top">
        <div>
          <div class="hero-l">Your lifts</div>
          <div class="lifts-n">${plural(summary.length, 'exercise')}</div>
        </div>
        <div class="lifts-goals">
          ${live.length
            ? `<b>${live.length}</b><span>goal${live.length === 1 ? '' : 's'} open</span>`
            : hit.length
              ? `<b>${hit.length}</b><span>goals hit</span>`
              : `<b>—</b><span>no goals yet</span>`}
        </div>
      </div>
      <div class="lifts-foot">
        Personal bests, history and targets · tap to open
      </div>
    </button>`;
}

/* -------------------------------------------------------------------------
   The main sheet: everything you've ever done
   ------------------------------------------------------------------------- */
export async function openProgress(catalog, onChange) {
  const s = sheet(`
    <h2>Your lifts</h2>
    <p class="sub">Only you can see any of this.</p>
    <div class="seg" id="pmode">
      <button data-m="lifts" class="on">Exercises</button>
      <button data-m="goals">Goals</button>
    </div>
    <div id="pbody"><div class="skel" style="height:70px"></div></div>
  `);

  let summary = [], goals = [], mode = 'lifts';
  const byId = new Map(catalog.map(e => [e.id, e]));

  const paint = () => {
    const host = $('#pbody', s.el);
    if (!host) return;

    if (mode === 'goals') {
      host.innerHTML = goals.length
        ? goals.map(g => goalRow(g)).join('') +
          `<button class="btn mt" data-newgoal>＋ Set a goal</button>`
        : `<div class="empty" style="padding:26px">
             <div class="empty-em">🎯</div>
             <p><b>No goals yet.</b></p>
             <p>Pick an exercise and give yourself a number to chase.</p>
           </div>
           <button class="btn btn-primary" data-newgoal>＋ Set a goal</button>`;

      host.querySelectorAll('[data-goal]').forEach(el =>
        el.addEventListener('click', () => {
          const g = goals.find(x => x.id === el.dataset.goal);
          const ex = byId.get(g.exercise_id);
          if (ex) { s.close(); openExercise(ex, summary.find(r => r.exercise_id === ex.id), onChange); }
        }));

      $('[data-newgoal]', host)?.addEventListener('click', () => {
        s.close();
        pickExerciseForGoal(catalog, summary, onChange);
      });
      return;
    }

    if (!summary.length) {
      host.innerHTML = `
        <div class="empty" style="padding:26px">
          <div class="empty-em">📈</div>
          <p><b>Nothing logged yet.</b></p>
          <p>Once you've done an exercise it shows up here with your bests.</p>
        </div>`;
      return;
    }

    const sorted = [...summary].sort((a, b) =>
      String(b.last_on).localeCompare(String(a.last_on)));

    host.innerHTML = sorted.map(r => {
      const ex = byId.get(r.exercise_id);
      if (!ex) return '';
      const headline = headlineBest(ex.kind, r);
      return `
        <div class="row" data-ex="${esc(r.exercise_id)}">
          <div class="row-av">${esc(ex.emoji)}</div>
          <div class="row-main">
            <div class="row-name">${esc(ex.name)}</div>
            <div class="row-sub">
              ${plural(r.times_done, 'time')} · last ${esc(agoLabel(r.last_on))}
            </div>
          </div>
          ${headline ? `<div class="row-pts" style="font-size:.95rem">
            ${esc(headline.value)}<span>${esc(headline.label)}</span></div>` : ''}
        </div>`;
    }).join('');

    host.querySelectorAll('[data-ex]').forEach(el =>
      el.addEventListener('click', () => {
        const ex = byId.get(el.dataset.ex);
        s.close();
        openExercise(ex, summary.find(r => r.exercise_id === ex.id), onChange);
      }));
  };

  s.el.querySelectorAll('[data-m]').forEach(b =>
    b.addEventListener('click', () => {
      mode = b.dataset.m;
      s.el.querySelectorAll('[data-m]').forEach(x => x.classList.toggle('on', x === b));
      paint();
    }));

  try {
    [summary, goals] = await Promise.all([api.exerciseSummary(), api.myGoals()]);
    paint();
  } catch (e) {
    $('#pbody', s.el).innerHTML = `<div class="err">${esc(e.message)}</div>`;
  }
}

/** The one number worth showing in a list row. */
function headlineBest(kind, r) {
  if (kind === 'strength' && r.best_e1rm)
    return { value: `${Number(r.best_e1rm).toFixed(0)}`, label: 'est 1rm' };
  if (kind === 'bodyweight' && r.best_reps)
    return { value: `${r.best_reps}`, label: 'best set' };
  if (kind === 'distance' && r.best_distance)
    return { value: `${Number(r.best_distance)}`, label: 'km' };
  if (kind === 'timed' && r.best_duration)
    return { value: `${r.best_duration}`, label: 'min' };
  return null;
}

/* -------------------------------------------------------------------------
   One exercise: bests, goal, history
   ------------------------------------------------------------------------- */
export async function openExercise(ex, summaryRow, onChange) {
  const s = sheet(`
    <div class="center" style="padding-bottom:10px">
      <div style="font-size:2.4rem">${esc(ex.emoji)}</div>
      <h2 style="margin:6px 0 2px">${esc(ex.name)}</h2>
      <p class="sub" style="margin:0">${esc(ex.category)}</p>
    </div>
    <div id="exbody"><div class="skel" style="height:80px"></div></div>
  `);

  const redraw = async () => {
    const host = $('#exbody', s.el);
    if (!host) return;
    try {
      const [history, goals] = await Promise.all([
        api.exerciseHistory(ex.id, 30),
        api.myGoals()
      ]);
      if (!$('#exbody', s.el)) return;
      const mine = goals.filter(g => g.exercise_id === ex.id);

      host.innerHTML = `
        ${bestsHtml(ex.kind, summaryRow)}

        <div class="section-title">Goals</div>
        ${mine.length ? mine.map(g => goalRow(g)).join('')
                      : '<p class="hint" style="margin:0 0 10px">Nothing set for this one yet.</p>'}
        <button class="btn btn-sm" data-setgoal>${mine.length ? 'Add another goal' : '🎯 Set a goal'}</button>

        <div class="section-title">History</div>
        ${history.length ? history.map(h => `
          <div class="hist">
            <div class="hist-d">${esc(fmtDate(h.performed_on, { day: 'numeric', month: 'short' }))}</div>
            <div class="hist-v">${esc(histLine(ex.kind, h))}</div>
            ${ex.kind === 'strength' && h.e1rm
              ? `<div class="hist-x">${Number(h.e1rm).toFixed(0)} 1rm</div>` : ''}
          </div>`).join('')
          : '<p class="hint">Nothing logged yet.</p>'}
      `;

      // sheet() replaces rather than stacks, so hand goalSheet a way back
      // instead of letting it close over a sheet that's already gone.
      $('[data-setgoal]', host).addEventListener('click', () => {
        s.close();
        goalSheet(ex, summaryRow, {
          back: () => openExercise(ex, summaryRow, onChange),
          onSaved: () => onChange?.()
        });
      });

      host.querySelectorAll('[data-drop]').forEach(b =>
        b.addEventListener('click', async (e) => {
          e.stopPropagation();
          const ok = await confirmSheet({
            title: 'Remove this goal?', body: 'Your history stays, the target goes.',
            confirmLabel: 'Remove', danger: true,
            back: () => openExercise(ex, summaryRow, onChange)
          });
          if (!ok) return;
          try {
            await api.dropGoal(b.dataset.drop);
            toastOk('Goal removed');
            openExercise(ex, summaryRow, onChange);
            onChange?.();
          } catch (err) { toastBad(err.message); }
        }));
    } catch (e) {
      host.innerHTML = `<div class="err">${esc(e.message)}</div>`;
    }
  };

  redraw();
}

function bestsHtml(kind, r) {
  if (!r) return '<p class="hint">No personal bests yet — log it once and they appear.</p>';
  const rows = metricsFor(kind)
    .map(m => ({ m, v: bestOf(r, m) }))
    .filter(x => x.v != null && x.v > 0);

  const pace = kind === 'distance' && r.best_pace ? fmtPace(Number(r.best_pace)) : null;

  return `
    <div class="section-title" style="margin-top:0">Personal bests</div>
    <div class="card">
      ${rows.map(x => `
        <div class="kv"><span>${esc(METRICS[x.m].label)}</span>
          <b>${esc(fmtMetric(x.m, x.v))}</b></div>`).join('')}
      ${pace ? `<div class="kv"><span>Best pace</span><b>${esc(pace)}</b></div>` : ''}
      <div class="kv"><span>Times logged</span><b>${num(r.times_done)}</b></div>
      <div class="kv"><span>Last done</span><b>${esc(agoLabel(r.last_on))}</b></div>
    </div>`;
}

const histLine = (kind, h) => describeSets(kind, fromEntry(h));

/* -------------------------------------------------------------------------
   Goals
   ------------------------------------------------------------------------- */
function goalRow(g) {
  const pct = Math.min(100, (Number(g.current) / Number(g.target)) * 100);
  const done = !!g.achieved_on;

  return `
    <div class="goal ${done ? 'goal-done' : ''}" data-goal="${esc(g.id)}">
      <div class="goal-top">
        <div class="goal-t">${esc(g.exercise_emoji)} ${esc(g.exercise_name)}</div>
        <button class="draft-x" data-drop="${esc(g.id)}" aria-label="Remove goal">✕</button>
      </div>
      <div class="goal-m">
        ${esc(METRICS[g.metric]?.label || g.metric)} ·
        <b>${esc(fmtMetric(g.metric, g.current))}</b> of ${esc(fmtMetric(g.metric, g.target))}
      </div>
      <div class="prog-bar" style="margin-top:8px">
        <div class="prog-fill" style="width:${pct}%"></div>
      </div>
      ${done
        ? `<div class="goal-hit">✅ Hit it on ${esc(fmtDate(g.achieved_on, { day: 'numeric', month: 'short', year: 'numeric' }))}</div>`
        : `<div class="goal-left">${esc(fmtMetric(g.metric, Math.max(0, g.target - g.current)))} to go</div>`}
      ${g.note ? `<div class="goal-note">"${esc(g.note)}"</div>` : ''}
    </div>`;
}

function goalSheet(ex, summaryRow, { back, onSaved } = {}) {
  const options = metricsFor(ex.kind);
  let metric = options[0];

  const suggestTarget = (m) => {
    const best = bestOf(summaryRow, m);
    if (!best) return '';
    // A target you might actually hit this season: about 10% up.
    const step = m === 'reps' ? 1 : m === 'weight' || m === 'e1rm' ? 2.5 : 0.5;
    return String(Math.round((Number(best) * 1.1) / step) * step);
  };

  const s = sheet(`
    <h2>Set a goal</h2>
    <p class="sub">${esc(ex.emoji)} ${esc(ex.name)} — just for you, nobody else sees it.</p>
    <div id="gerr"></div>

    <div class="field">
      <label for="g-metric">What are you chasing?</label>
      <select class="input" id="g-metric">
        ${options.map(m =>
          `<option value="${m}">${esc(METRICS[m].label)}</option>`).join('')}
      </select>
    </div>

    <div class="field">
      <label for="g-target">Target (<span id="g-unit">${esc(METRICS[metric].unit)}</span>)</label>
      <input class="input" id="g-target" type="number" inputmode="decimal"
             min="0.5" step="0.5" value="${suggestTarget(metric)}">
      <p class="hint" id="g-current"></p>
    </div>

    <div class="field">
      <label for="g-note">Why (optional)</label>
      <input class="input" id="g-note" maxlength="140" placeholder="Bodyweight bench by Christmas">
    </div>

    <button class="btn btn-primary" data-save>Save goal</button>
    ${back ? '<button class="btn btn-ghost mt" data-back>Back</button>' : ''}
  `);

  $('[data-back]', s.el)?.addEventListener('click', () => { s.close(); back(); });

  const refresh = () => {
    metric = $('#g-metric', s.el).value;
    $('#g-unit', s.el).textContent = METRICS[metric].unit;
    const best = bestOf(summaryRow, metric);
    $('#g-current', s.el).textContent = best
      ? `Your best so far: ${fmtMetric(metric, best)}`
      : 'No personal best for this yet.';
    $('#g-target', s.el).value = suggestTarget(metric);
  };

  $('#g-metric', s.el).addEventListener('change', refresh);
  refresh();

  $('[data-save]', s.el).addEventListener('click', async () => {
    const btn = $('[data-save]', s.el);
    const target = Number($('#g-target', s.el).value);
    const note = $('#g-note', s.el).value.trim() || null;

    if (!Number.isFinite(target) || target <= 0) {
      $('#gerr', s.el).innerHTML = '<div class="err">Give it a number to aim at.</div>';
      return;
    }
    btn.disabled = true;
    btn.textContent = 'Saving…';
    try {
      await api.setGoal(ex.id, metric, target, note);
      s.close();
      toastOk('Goal set 🎯');
      onSaved?.();
      back?.();
    } catch (e) {
      $('#gerr', s.el).innerHTML = `<div class="err">${esc(e.message)}</div>`;
      btn.disabled = false;
      btn.textContent = 'Save goal';
    }
  });
}

/** Choosing what to set a goal on, when you start from the Goals tab. */
function pickExerciseForGoal(catalog, summary, onChange) {
  const done = new Set(summary.map(r => r.exercise_id));
  const ordered = [
    ...catalog.filter(e => done.has(e.id)),
    ...catalog.filter(e => !done.has(e.id))
  ];
  let q = '';

  const s = sheet(`
    <h2>Goal for which exercise?</h2>
    <div class="field"><input class="input" id="gq" placeholder="Search name, muscle or kit…"
           autocapitalize="off" autocorrect="off"></div>
    <div class="ex-list" id="glist"></div>
  `);

  const paint = () => {
    const needle = q.trim().toLowerCase();
    const items = ordered.filter(e => !needle ||
      `${e.name} ${e.muscle || ''} ${e.equipment || ''}`.toLowerCase().includes(needle));
    $('#glist', s.el).innerHTML = items.slice(0, 60).map(e => {
      const sub = [e.equipment, e.muscle].filter(Boolean).join(' · ');
      return `
      <button class="ex" data-ex="${esc(e.id)}">
        <span class="ex-emoji">${esc(e.emoji)}</span>
        <span class="ex-main">
          <span class="ex-name">${esc(e.name)}</span>
          ${sub ? `<span class="ex-last">${esc(sub)}</span>` : ''}
        </span>
        ${done.has(e.id) ? '<span class="ex-kind">logged</span>' : ''}
      </button>`;
    }).join('');

    $('#glist', s.el).querySelectorAll('[data-ex]').forEach(b =>
      b.addEventListener('click', () => {
        const ex = catalog.find(x => x.id === b.dataset.ex);
        s.close();
        goalSheet(ex, summary.find(r => r.exercise_id === ex.id), {
          back: () => openProgress(catalog, onChange),
          onSaved: () => onChange?.()
        });
      }));
  };

  $('#gq', s.el).addEventListener('input', e => { q = e.target.value; paint(); });
  paint();
}
