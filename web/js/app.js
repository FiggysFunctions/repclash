/* ==========================================================================
   RepClash — bootstrap and router.

   The whole app is four tabs over one crew. This file works out which stage
   of onboarding you're at, loads the shared context once, then hands off to
   whichever view is showing.
   ========================================================================== */

import * as api from './api.js';
import { activeCrew } from './config.js';
import { $, esc, toastBad } from './ui.js';

import { renderSetup, renderAuth, renderProfileSetup, renderCrewSetup } from './views/onboarding.js';
import * as leaderboardView from './views/leaderboard.js';
import * as logView from './views/log.js';
import * as challengesView from './views/challenges.js';
import * as profileView from './views/profile.js';

const TABS = [
  { id: 'board',      icon: '🏆', label: 'Board',   view: leaderboardView },
  { id: 'challenges', icon: '🎯', label: 'Weekly',  view: challengesView },
  { id: 'log',        icon: '＋', label: 'Log',     view: logView, primary: true },
  { id: 'me',         icon: '👤', label: 'Me',      view: profileView }
];

const app    = $('#app');
const tabbar = $('#tabbar');

let ctx = null;
let currentTab = 'board';

/* -------------------------------------------------------------------------
   Boot
   ------------------------------------------------------------------------- */

async function boot() {
  api.init();

  if (!api.isConfigured()) return stage(renderSetup);
  if (!api.isSignedIn())   return stage(renderAuth);

  let profile;
  try {
    profile = await api.getMyProfile();
  } catch (e) {
    return fatal(e.message);
  }
  if (!profile) return stage(renderProfileSetup);

  let crews;
  try {
    crews = await api.myCrews();
  } catch (e) {
    return fatal(e.message);
  }
  if (!crews.length) return stage(renderCrewSetup);

  const wanted = activeCrew.get();
  const membership = crews.find(c => c.crew_id === wanted) || crews[0];
  activeCrew.set(membership.crew_id);
  const crew = membership.crews;

  // One call brings the crew up to date: settles finished weeks, hands out
  // titles, creates this week's challenge, rolls the season if it ended.
  let rules;
  try {
    const [, r] = await Promise.all([
      api.syncCrew(crew.id).catch(() => null),   // non-fatal if it fails
      api.scoringRules()
    ]);
    rules = r;
  } catch (e) {
    return fatal(e.message);
  }

  ctx = {
    crew, profile, rules,
    reload: boot,
    goCrewSetup: () => stage((root, next) => renderCrewSetup(root, next, { canCancel: true })),
    bumpBoard: () => { /* views refetch on show, nothing to invalidate */ },
    go: showTab
  };

  hideSplash();
  tabbar.hidden = false;
  drawTabs();
  showTab(currentTab);
}

/** Render a full-screen onboarding step; `next` re-runs boot(). */
function stage(renderFn) {
  hideSplash();
  tabbar.hidden = true;
  app.hidden = false;
  renderFn(app, boot);
}

function fatal(msg) {
  hideSplash();
  tabbar.hidden = true;
  app.hidden = false;
  app.innerHTML = `
    <div class="view" style="padding-top:40px">
      <div class="empty">
        <div class="empty-em">😵</div>
        <p><b>Couldn't load RepClash.</b></p>
        <p>${esc(msg)}</p>
      </div>
      <button class="btn btn-primary" id="again">Try again</button>
      <button class="btn btn-ghost mt" id="out">Sign out</button>
    </div>`;
  $('#again').addEventListener('click', () => location.reload());
  $('#out').addEventListener('click', async () => { await api.signOut(); location.reload(); });
}

function hideSplash() {
  // Only present on the very first render — it removes itself afterwards.
  const s = $('#splash');
  if (s && !s.classList.contains('gone')) {
    s.classList.add('gone');
    setTimeout(() => s.remove(), 400);
  }
  app.hidden = false;
}

/* -------------------------------------------------------------------------
   Tabs
   ------------------------------------------------------------------------- */

function drawTabs() {
  tabbar.innerHTML = TABS.map(t => `
    <button class="tab ${t.primary ? 'tab-log' : ''} ${t.id === currentTab ? 'on' : ''}"
            data-tab="${t.id}" aria-label="${t.label}">
      <span class="tab-i">${t.icon}</span>
      <span class="tab-l">${t.label}</span>
    </button>`).join('');

  tabbar.querySelectorAll('[data-tab]').forEach(b =>
    b.addEventListener('click', () => showTab(b.dataset.tab)));
}

async function showTab(id) {
  currentTab = id;
  tabbar.querySelectorAll('[data-tab]').forEach(b =>
    b.classList.toggle('on', b.dataset.tab === id));
  window.scrollTo(0, 0);

  const tab = TABS.find(t => t.id === id);
  try {
    await tab.view.render(app, ctx);
  } catch (e) {
    app.innerHTML = `<div class="view"><div class="err">${esc(e.message)}</div></div>`;
  }
}

/* -------------------------------------------------------------------------
   Housekeeping
   ------------------------------------------------------------------------- */

// Coming back to the app after a while should show fresh numbers.
let hiddenAt = 0;
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { hiddenAt = Date.now(); return; }
  if (ctx && hiddenAt && Date.now() - hiddenAt > 60_000) showTab(currentTab);
});

window.addEventListener('unhandledrejection', (e) => {
  const msg = e.reason?.message || 'Something went wrong';
  if (/Not configured/.test(msg)) return;
  toastBad(msg);
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => { /* offline mode is a bonus, not a requirement */ });
  });
}

boot();
