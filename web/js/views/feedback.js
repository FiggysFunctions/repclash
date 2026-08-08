/* ==========================================================================
   The suggestion box.

   Everyone gets a "suggest something" form. The person who owns the crew gets
   an inbox with triage, because there's no free way to actually email them —
   Supabase's free tier reserves its handful of emails per hour for sign-in.
   ========================================================================== */

import * as api from '../api.js';
import { $, esc, sheet, confirmSheet, toastOk, toastBad, fmtDate } from '../ui.js';

const KINDS = [
  ['idea',     '💡', 'An idea',        'Something that would make the app better'],
  ['exercise', '🏋️', 'Missing exercise','Something you do that isn\'t in the list'],
  ['scoring',  '⚖️', 'Scoring',        'Something feels worth too much or too little'],
  ['bug',      '🐛', 'Something broke','It did the wrong thing'],
  ['other',    '💬', 'Anything else',  '']
];

const STATUS = {
  new:      { label: 'New',        cls: 'st-new',      em: '🆕' },
  planned:  { label: 'Planned',    cls: 'st-planned',  em: '📌' },
  done:     { label: 'Done',       cls: 'st-done',     em: '✅' },
  declined: { label: 'Not doing',  cls: 'st-declined', em: '🚫' }
};

/* -------------------------------------------------------------------------
   Submitting
   ------------------------------------------------------------------------- */
export function openSubmit(ctx, onSent) {
  let kind = 'idea';

  const s = sheet(`
    <h2>Suggest something</h2>
    <p class="sub">Goes straight to ${esc(ctx.ownerName || 'whoever runs the crew')}. Be as blunt as you like.</p>
    <div id="fb-err"></div>

    <label style="display:block;margin-bottom:6px;font-size:.74rem;font-weight:800;
                  letter-spacing:.1em;text-transform:uppercase;color:var(--text-faint)">
      What kind of thing?
    </label>
    <div class="kind-grid">
      ${KINDS.map(([id, em, label]) => `
        <button class="kind ${id === kind ? 'on' : ''}" data-kind="${id}">
          <span class="kind-em">${em}</span>
          <span class="kind-l">${esc(label)}</span>
        </button>`).join('')}
    </div>

    <div class="field mt">
      <label for="fb-body">Your suggestion</label>
      <textarea class="input" id="fb-body" rows="5" maxlength="1000"
                placeholder="e.g. Can we get points for climbing? Or: bench press feels underpaid compared to squats."></textarea>
      <p class="hint"><span id="fb-count">0</span>/1000</p>
    </div>

    <button class="btn btn-primary" data-send>Send it</button>
    <button class="btn btn-ghost mt" data-mine>See what I've sent before</button>
  `);

  s.el.querySelectorAll('[data-kind]').forEach(b =>
    b.addEventListener('click', () => {
      kind = b.dataset.kind;
      s.el.querySelectorAll('[data-kind]').forEach(x => x.classList.toggle('on', x === b));
    }));

  $('#fb-body', s.el).addEventListener('input', e => {
    $('#fb-count', s.el).textContent = e.target.value.length;
  });

  $('[data-mine]', s.el).addEventListener('click', () => { s.close(); openMine(ctx); });

  $('[data-send]', s.el).addEventListener('click', async () => {
    const btn = $('[data-send]', s.el);
    const body = $('#fb-body', s.el).value.trim();
    const err = $('#fb-err', s.el);
    err.innerHTML = '';

    if (body.length < 4) {
      err.innerHTML = '<div class="err">Give me a bit more than that.</div>';
      return;
    }
    btn.disabled = true;
    btn.textContent = 'Sending…';
    try {
      await api.sendFeedback(ctx.crew.id, kind, body);
      s.close();
      toastOk('Sent — thanks 🙏');
      onSent?.();
    } catch (e) {
      err.innerHTML = `<div class="err">${esc(e.message)}</div>`;
      btn.disabled = false;
      btn.textContent = 'Send it';
    }
  });
}

/* -------------------------------------------------------------------------
   Your own submissions
   ------------------------------------------------------------------------- */
export async function openMine(ctx) {
  const s = sheet(`
    <h2>Your suggestions</h2>
    <p class="sub">What you've sent, and what came of it.</p>
    <div id="list"><div class="skel" style="height:70px"></div></div>
    <button class="btn btn-primary mt" data-new>Suggest something else</button>
  `);

  $('[data-new]', s.el).addEventListener('click', () => { s.close(); openSubmit(ctx); });

  try {
    const rows = await api.myFeedback(ctx.crew.id);
    $('#list', s.el).innerHTML = rows.length
      ? rows.map(f => card(f)).join('')
      : `<div class="empty" style="padding:26px">
           <div class="empty-em">📭</div>
           <p><b>Nothing yet.</b></p>
           <p>If something about the app annoys you, say so.</p>
         </div>`;
  } catch (e) {
    $('#list', s.el).innerHTML = `<div class="err">${esc(e.message)}</div>`;
  }
}

/** One suggestion. `who` is set in the owner's inbox, `actions` is extra HTML. */
function card(f, { who, actions } = {}) {
  const st = STATUS[f.status] || STATUS.new;
  const k = KINDS.find(x => x[0] === f.kind);
  return `
    <div class="fb">
      <div class="fb-top">
        <span class="fb-kind">${k ? k[1] : '💬'} ${esc(k ? k[2] : f.kind)}</span>
        <span class="tag ${st.cls}">${st.em} ${st.label}</span>
      </div>
      ${who ? `<div class="fb-who">${esc(who)}</div>` : ''}
      <p class="fb-body">${esc(f.body)}</p>
      <div class="fb-date">${fmtDate(f.created_at.slice(0, 10), { day: 'numeric', month: 'short' })}</div>
      ${f.reply ? `<div class="fb-reply"><b>Reply:</b> ${esc(f.reply)}</div>` : ''}
      ${actions || ''}
    </div>`;
}

/* -------------------------------------------------------------------------
   The owner's inbox
   ------------------------------------------------------------------------- */
export async function openInbox(ctx, onChange, initialFilter = 'new') {
  let filter = initialFilter;

  const s = sheet(`
    <h2>Suggestion box</h2>
    <p class="sub">Everything your crew has sent in.</p>
    <div class="seg" id="filter">
      ${[['new', 'New'], ['open', 'Open'], ['all', 'All']].map(([f, label]) =>
        `<button data-f="${f}" class="${f === filter ? 'on' : ''}">${label}</button>`).join('')}
    </div>
    <div id="list"><div class="skel" style="height:70px"></div></div>
  `);

  let rows = [];

  const paint = () => {
    const shown = rows.filter(f =>
      filter === 'all'  ? true :
      filter === 'new'  ? f.status === 'new' :
                          f.status === 'new' || f.status === 'planned');

    $('#list', s.el).innerHTML = shown.length
      ? shown.map(f => card(f, {
          who: `${f.avatar_emoji} ${f.display_name}`,
          actions: `
            <div class="fb-actions">
              ${['planned', 'done', 'declined'].map(st =>
                `<button class="btn btn-sm ${f.status === st ? 'btn-volt' : ''}"
                         data-set="${st}" data-id="${esc(f.id)}">${STATUS[st].em} ${STATUS[st].label}</button>`
              ).join('')}
              <button class="btn btn-sm" data-reply="${esc(f.id)}">💬 Reply</button>
            </div>`
        })).join('')
      : `<div class="empty" style="padding:26px">
           <div class="empty-em">📭</div>
           <p><b>Nothing here.</b></p>
           <p>${filter === 'new' ? 'No unread suggestions.' : 'Nothing matches that filter.'}</p>
         </div>`;

    s.el.querySelectorAll('[data-set]').forEach(b =>
      b.addEventListener('click', () => setStatus(b.dataset.id, b.dataset.set)));
    s.el.querySelectorAll('[data-reply]').forEach(b =>
      b.addEventListener('click', () => replyTo(b.dataset.reply)));
  };

  const setStatus = async (id, status) => {
    try {
      await api.updateFeedback(id, { status });
      const row = rows.find(r => r.id === id);
      if (row) row.status = status;
      paint();
      onChange?.();
    } catch (e) { toastBad(e.message); }
  };

  /* Opening a sheet replaces whatever sheet is already up, so this can't nest
     inside the inbox — it reopens the inbox afterwards, keeping the filter. */
  const replyTo = (id) => {
    const row = rows.find(r => r.id === id);
    const back = () => openInbox(ctx, onChange, filter);

    const r = sheet(`
      <h2>Reply to ${esc(row.display_name)}</h2>
      <p class="sub">They'll see this underneath their suggestion.</p>
      <div class="fb" style="margin-bottom:14px">
        <p class="fb-body" style="margin:0">${esc(row.body)}</p>
      </div>
      <div class="field">
        <textarea class="input" id="fb-reply" rows="4" maxlength="500"
                  placeholder="Good shout — going in the next update.">${esc(row.reply || '')}</textarea>
      </div>
      <button class="btn btn-primary" data-save>Save reply</button>
      <button class="btn btn-ghost mt" data-back>Back to the inbox</button>
    `);

    $('[data-back]', r.el).addEventListener('click', () => { r.close(); back(); });

    $('[data-save]', r.el).addEventListener('click', async () => {
      const btn = $('[data-save]', r.el);
      const text = $('#fb-reply', r.el).value.trim();
      btn.disabled = true;
      btn.textContent = 'Saving…';
      try {
        await api.updateFeedback(id, { reply: text || null });
        r.close();
        toastOk('Reply saved');
        back();
      } catch (e) {
        toastBad(e.message);
        btn.disabled = false;
        btn.textContent = 'Save reply';
      }
    });
  };

  s.el.querySelectorAll('[data-f]').forEach(b =>
    b.addEventListener('click', () => {
      filter = b.dataset.f;
      s.el.querySelectorAll('[data-f]').forEach(x => x.classList.toggle('on', x === b));
      paint();
    }));

  try {
    rows = await api.crewFeedback(ctx.crew.id);
    paint();
  } catch (e) {
    $('#list', s.el).innerHTML = `<div class="err">${esc(e.message)}</div>`;
  }
}
