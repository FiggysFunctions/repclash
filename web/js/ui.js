/* ==========================================================================
   Small DOM + formatting helpers. No framework, no virtual DOM — the app is
   small enough that rendering a view is just "build a string, set innerHTML,
   then wire up the handlers".
   ========================================================================== */

/* --- escaping ------------------------------------------------------------
   Display names come from other people. Everything user-typed goes through
   esc() before it touches innerHTML. */
export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

export const $  = (sel, root = document) => root.querySelector(sel);

/**
 * True if `node` is still attached to the page.
 *
 * Views fetch, then write their results into a container they looked up
 * earlier. If a second render started in the meantime — a tab tapped twice, or
 * a sheet asking for a refresh — that container has been replaced, and the
 * slow render would write into a detached node and then wire handlers against
 * elements nobody can see. Checking this after every await keeps the last
 * render the one that wins.
 */
export const live = (node) => !!node?.isConnected;
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/** Attach a click handler to every match of a selector. */
export function on(root, sel, handler, evt = 'click') {
  $$(sel, root).forEach(el => el.addEventListener(evt, handler));
}

/* --- themes ---------------------------------------------------------------
   Unlocked through the season pass. Stamps the root element; the CSS does the
   rest. Applied before first paint so there's no flash of the default. */
export function applyTheme(theme) {
  const root = document.documentElement;
  if (theme) root.setAttribute('data-rc-theme', theme);
  else       root.removeAttribute('data-rc-theme');
  try {
    theme ? localStorage.setItem('repclash.theme', theme)
          : localStorage.removeItem('repclash.theme');
  } catch { /* private browsing — the theme just won't persist */ }
}

/** Re-apply the remembered theme immediately on boot, before the profile
    round-trip finishes, so the app doesn't flash orange then go red. */
export function restoreTheme() {
  try { applyTheme(localStorage.getItem('repclash.theme')); } catch { /* ignore */ }
}

/* --- toasts --------------------------------------------------------------- */
export function toast(msg, kind = '') {
  const host = $('#toasts');
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.textContent = msg;
  host.appendChild(el);
  setTimeout(() => {
    el.classList.add('out');
    setTimeout(() => el.remove(), 260);
  }, kind === 'bad' ? 4200 : 2600);
}
export const toastOk  = (m) => toast(m, 'good');
export const toastBad = (m) => toast(m, 'bad');

/* --- bottom sheet ---------------------------------------------------------
   Returns a close() function. Resolves nothing — callers wire their own
   buttons inside the provided element. */
export function sheet(html, { onClose } = {}) {
  const root = $('#sheet-root');
  root.innerHTML = `
    <div class="sheet-back" data-close></div>
    <div class="sheet" role="dialog" aria-modal="true">
      <div class="sheet-grab"></div>
      ${html}
    </div>`;
  document.body.style.overflow = 'hidden';

  const close = () => {
    root.innerHTML = '';
    document.body.style.overflow = '';
    document.removeEventListener('keydown', onKey);
    onClose?.();
  };
  const onKey = (e) => { if (e.key === 'Escape') close(); };

  $('[data-close]', root).addEventListener('click', close);
  document.addEventListener('keydown', onKey);

  // Give the first field focus, but not on touch — the keyboard leaping up
  // over the sheet is more annoying than helpful.
  if (!matchMedia('(pointer: coarse)').matches) {
    setTimeout(() => $('input, select', root)?.focus(), 60);
  }
  return { el: $('.sheet', root), close };
}

/**
 * A yes/no sheet. Resolves true if confirmed.
 *
 * `back` matters when you're confirming from inside another sheet: this one
 * replaces it rather than stacking on top, so backing out would otherwise
 * dump the user on the page behind. Pass a function that reopens the sheet
 * they came from and it runs on cancel or dismiss. The confirmed path is left
 * alone — callers almost always navigate somewhere themselves.
 */
export function confirmSheet({ title, body, confirmLabel = 'Confirm', danger, back }) {
  return new Promise(resolve => {
    let answered = false;
    const cancel = () => { answered = true; s.close(); back?.(); resolve(false); };

    const s = sheet(`
      <h2>${esc(title)}</h2>
      <p class="sub">${esc(body)}</p>
      <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-yes>${esc(confirmLabel)}</button>
      <button class="btn btn-ghost mt" data-no>Cancel</button>
    `, { onClose: () => { if (!answered) { back?.(); resolve(false); } } });

    $('[data-yes]', s.el).addEventListener('click', () => { answered = true; s.close(); resolve(true); });
    $('[data-no]',  s.el).addEventListener('click', cancel);
  });
}

/* --- dates ----------------------------------------------------------------
   All dates are handled as plain local YYYY-MM-DD strings. A workout done on
   Tuesday should say Tuesday regardless of timezone, so we deliberately never
   involve UTC. */
export function todayISO(d = new Date()) {
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function addDays(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d + n);
  return todayISO(dt);
}

/** Monday of the week containing `iso`. Matches Postgres date_trunc('week'). */
export function weekStart(iso = todayISO()) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const shift = (dt.getDay() + 6) % 7;   // Sunday(0) → 6, Monday(1) → 0
  return addDays(iso, -shift);
}

export function fmtDate(iso, opts = { day: 'numeric', month: 'short' }) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, opts);
}

export function relDay(iso) {
  const t = todayISO();
  if (iso === t) return 'Today';
  if (iso === addDays(t, -1)) return 'Yesterday';
  const days = Math.round((new Date(t) - new Date(iso)) / 86400000);
  if (days > 0 && days < 7) return fmtDate(iso, { weekday: 'long' });
  return fmtDate(iso);
}

/* --- numbers -------------------------------------------------------------- */
export const nf = new Intl.NumberFormat();
export const num = (n) => nf.format(Math.round(Number(n) || 0));

export function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function plural(n, one, many = one + 's') {
  return `${num(n)} ${Math.round(n) === 1 ? one : many}`;
}

/** "3d 4h left" — used for the weekly challenge countdown. */
export function untilEndOfWeek() {
  const now = new Date();
  const end = new Date(now);
  const daysLeft = (7 - ((now.getDay() + 6) % 7)) % 7;
  end.setDate(now.getDate() + (daysLeft === 0 ? 7 : daysLeft));
  end.setHours(0, 0, 0, 0);
  const ms = end - now;
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  if (d > 0) return `${d}d ${h}h left`;
  const m = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m left` : `${m}m left`;
}

export const MEDALS = ['🥇', '🥈', '🥉'];

export const AVATARS = [
  '💪','🔥','🏋️','🦍','🐺','🦁','🐉','🦅','⚡','🥊','🏃','🚴','🧗','🦈',
  '🐻','🦖','👹','🤖','👑','💀','🌶️','🍑','🥷','🧟','🐗','🦏','🐅','🚀'
];

/* What you get before earning anything. The other 20 are season pass rewards.
   Must match app.starter_avatars() in supabase/06_season_pass.sql — the
   server rejects anything you haven't unlocked, so a mismatch here just means
   the picker offers something that won't save. */
export const STARTER_AVATARS = ['💪','🔥','🏋️','🏃','🚴','🧗','🥊','🐺'];

/** So a new member always starts with something other than the default. */
export function randomAvatar() {
  return STARTER_AVATARS[Math.floor(Math.random() * STARTER_AVATARS.length)];
}
