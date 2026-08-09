/* ==========================================================================
   The feed — everyone's sessions, in full detail, newest first.

   This is the nosy tab: what did Jax actually squat, how far did Kai run.
   Anything someone marked private is simply absent, except your own, which
   you see with a padlock so you know what others can't.
   ========================================================================== */

import * as api from '../api.js';
import {
  $, esc, num, relDay, fmtDate, plural, live, sheet, toastOk, toastBad, confirmSheet
} from '../ui.js';
import { name } from './pass.js';

const PAGE = 20;

let rows = [];
let exhausted = false;
let loading = false;
let filterUser = null;         // null = the whole crew
let colours = new Map();       // user_id → equipped name colour

export async function render(root, ctx) {
  rows = [];
  exhausted = false;
  filterUser = null;

  root.innerHTML = `
    <div class="view">
      <div class="hdr">
        <div class="hdr-txt">
          <h1>Feed</h1>
          <p>What everyone's actually been doing</p>
        </div>
        <button class="icon-btn" id="refresh" aria-label="Refresh">↻</button>
      </div>
      <div id="feed">
        <div class="skel" style="height:130px"></div>
        <div class="skel" style="height:130px"></div>
        <div class="skel" style="height:130px"></div>
      </div>
    </div>`;

  $('#refresh', root).addEventListener('click', () => render(root, ctx));

  const host = $('#feed', root);
  await loadMore(host, ctx, true);
}

async function loadMore(host, ctx, first = false) {
  if (loading || (!first && exhausted)) return;
  loading = true;
  try {
    const before = first ? null : rows[rows.length - 1]?.created_at || null;
    const [page, pass] = await Promise.all([
      api.crewFeed(ctx.crew.id, { limit: PAGE, before, userId: filterUser }),
      // Only needed for name colours, and only worth fetching once.
      first || !colours.size
        ? api.crewPass(ctx.crew.id).catch(() => [])
        : Promise.resolve(null)
    ]);
    if (pass) colours = new Map(pass.map(p => [p.user_id, p.colour]));
    if (!live(host)) return;

    if (page.length < PAGE) exhausted = true;
    rows = first ? page : rows.concat(page);
    paint(host, ctx);
  } catch (e) {
    if (live(host)) {
      host.innerHTML = `<div class="err">${esc(e.message)}</div>
        <button class="btn mt" id="retry">Try again</button>`;
      $('#retry', host)?.addEventListener('click', () => render(host.closest('.app') || host, ctx));
    }
  } finally {
    loading = false;
  }
}

function paint(host, ctx) {
  if (!rows.length) {
    host.innerHTML = `
      <div class="empty">
        <div class="empty-em">🌵</div>
        <p><b>Nothing here yet.</b></p>
        <p>Log a session and it'll show up for the whole crew.</p>
      </div>`;
    return;
  }

  host.innerHTML =
    rows.map(r => postHtml(r)).join('') +
    (exhausted
      ? `<p class="hint center mt">That's everything.</p>`
      : `<button class="btn mt" id="more">Load more</button>`);

  $('#more', host)?.addEventListener('click', async (e) => {
    e.target.disabled = true;
    e.target.textContent = 'Loading…';
    await loadMore(host, ctx);
  });

  host.querySelectorAll('[data-open]').forEach(el =>
    el.addEventListener('click', () => openPost(el.dataset.open, ctx, host)));
}

/* ------------------------------------------------------------------------- */

function postHtml(r) {
  const shown = r.entries.slice(0, 4);
  const extra = r.entries.length - shown.length;

  return `
    <div class="post ${r.is_mine ? 'post-mine' : ''}" data-open="${esc(r.workout_id)}">
      <div class="post-head">
        <div class="row-av">${esc(r.avatar_emoji)}</div>
        <div class="row-main">
          <div class="row-name">
            ${name(r.display_name, colours.get(r.user_id))}
            ${r.is_private ? '<span class="lock" title="Only you can see this">🔒 Private</span>' : ''}
          </div>
          <div class="row-sub">${relDay(r.performed_on)} · ${plural(r.entries.length, 'exercise')}</div>
        </div>
        <div class="row-pts">${num(r.effort)}<span>effort</span></div>
      </div>

      ${r.note ? `<p class="post-note">"${esc(r.note)}"</p>` : ''}

      <div class="post-lines">
        ${shown.map(e => `
          <div class="post-line">
            <span class="post-em">${esc(e.emoji)}</span>
            <span class="post-name">${esc(e.name)}</span>
            <span class="post-detail">${esc(detail(e))}</span>
          </div>`).join('')}
        ${extra > 0 ? `<div class="post-more">+${extra} more</div>` : ''}
      </div>
    </div>`;
}

/** "5 × 5 · 100 kg" / "5.2 km" / "45 min" */
export function detail(e) {
  const bits = [];
  if (e.sets && e.reps)      bits.push(`${e.sets} × ${e.reps}`);
  else if (e.reps)           bits.push(`${e.reps} reps`);
  if (e.weight_kg)           bits.push(`${trim(e.weight_kg)} kg`);
  if (e.distance_km)         bits.push(`${trim(e.distance_km)} km`);
  if (e.duration_min)        bits.push(`${e.duration_min} min`);
  return bits.join(' · ');
}

const trim = (n) => String(Number(n)).replace(/\.0$/, '');

/* ------------------------------------------------------------------------- */

function openPost(id, ctx, host) {
  const r = rows.find(x => x.workout_id === id);
  if (!r) return;

  const s = sheet(`
    <div class="post-head" style="margin-bottom:14px">
      <div class="row-av">${esc(r.avatar_emoji)}</div>
      <div class="row-main">
        <div class="row-name">${esc(r.display_name)}</div>
        <div class="row-sub">
          ${fmtDate(r.performed_on, { weekday: 'long', day: 'numeric', month: 'long' })}
        </div>
      </div>
      <div class="row-pts">${num(r.effort)}<span>effort</span></div>
    </div>

    ${r.note ? `<p class="post-note" style="margin-bottom:14px">"${esc(r.note)}"</p>` : ''}

    ${r.entries.map(e => `
      <div class="draft-item">
        <div style="font-size:1.2rem">${esc(e.emoji)}</div>
        <div class="draft-main">
          <div class="draft-name">${esc(e.name)}</div>
          <div class="draft-detail">${esc(detail(e))}</div>
        </div>
        <div class="draft-pts">${num(e.points)}</div>
      </div>`).join('')}

    ${r.is_mine ? `
      <div class="privacy-row mt">
        <div>
          <div class="privacy-t">${r.is_private ? '🔒 Private' : '👀 Visible to the crew'}</div>
          <div class="privacy-s">${r.is_private
            ? 'Only you can see the detail. It still scores.'
            : 'Everyone in the crew can see what you did.'}</div>
        </div>
        <button class="switch ${r.is_private ? '' : 'on'}" data-priv
                role="switch" aria-checked="${!r.is_private}"
                aria-label="Visible to the crew"><span></span></button>
      </div>
      <button class="btn btn-danger mt" data-del>Delete this session</button>
    ` : `
      <button class="btn mt" data-only>Only show ${esc(r.display_name)}</button>
    `}
  `);

  $('[data-priv]', s.el)?.addEventListener('click', async () => {
    const btn = $('[data-priv]', s.el);
    const next = !r.is_private;
    btn.disabled = true;
    try {
      await api.setWorkoutPrivacy(r.workout_id, next);
      r.is_private = next;
      s.close();
      toastOk(next ? 'Session hidden from the crew' : 'Session is visible again');
      paint(host, ctx);
    } catch (e) {
      toastBad(e.message);
      btn.disabled = false;
    }
  });

  $('[data-del]', s.el)?.addEventListener('click', async () => {
    const ok = await confirmSheet({
      title: 'Delete session?',
      body: 'The points go with it. This can\'t be undone.',
      confirmLabel: 'Delete', danger: true,
      back: () => openPost(id, ctx, host)
    });
    if (!ok) return;
    try {
      await api.deleteWorkout(r.workout_id);
      rows = rows.filter(x => x.workout_id !== r.workout_id);
      toastOk('Session deleted');
      paint(host, ctx);
    } catch (e) { toastBad(e.message); }
  });

  $('[data-only]', s.el)?.addEventListener('click', async () => {
    s.close();
    filterUser = r.user_id;
    rows = [];
    exhausted = false;
    host.innerHTML = '<div class="skel" style="height:130px"></div>';
    await loadMore(host, ctx, true);
    if (live(host)) {
      host.insertAdjacentHTML('afterbegin', `
        <button class="btn btn-sm mb" id="clearfilter" style="margin-bottom:12px">
          ✕ Showing only ${esc(r.display_name)}
        </button>`);
      $('#clearfilter', host)?.addEventListener('click', async () => {
        filterUser = null;
        rows = [];
        exhausted = false;
        await loadMore(host, ctx, true);
      });
    }
  });
}
