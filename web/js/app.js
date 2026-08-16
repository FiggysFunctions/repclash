/* ==========================================================================
   RepClash — bootstrap and router.

   The whole app is four tabs over one crew. This file works out which stage
   of onboarding you're at, loads the shared context once, then hands off to
   whichever view is showing.
   ========================================================================== */

import * as api from './api.js';
import { activeCrew } from './config.js';
import { $, esc, toastBad, applyTheme, restoreTheme } from './ui.js';

import { hasUnread, markRead, primeIfFirstRun } from './changelog.js';
import { openWhatsNew } from './views/whatsnew.js';
import {
  renderSetup, renderAuth, renderProfileSetup, renderCrewSetup, renderNewPassword
} from './views/onboarding.js';
import * as leaderboardView from './views/leaderboard.js';
import * as feedView from './views/feed.js';
import * as logView from './views/log.js';
import * as challengesView from './views/challenges.js';
import * as profileView from './views/profile.js';

const TABS = [
  { id: 'board',      icon: '🏆', label: 'Board',   view: leaderboardView },
  { id: 'feed',       icon: '👀', label: 'Feed',    view: feedView },
  { id: 'log',        icon: '＋', label: 'Log',     view: logView, primary: true },
  { id: 'challenges', icon: '🎯', label: 'Weekly',  view: challengesView },
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

  // Arriving from a password reset email: adopt the session the link carries
  // and go straight to choosing a new one. Checked before the signed-in test
  // because the link is what signs them in.
  if (await api.consumeRecoveryLink().catch(() => false)) {
    return stage(renderNewPassword);
  }

  if (!api.isSignedIn())   return stage(renderAuth);

  let profile;
  try {
    profile = await api.getMyProfile();
  } catch (e) {
    return fatal(e.message);
  }
  if (!profile) return stage(renderProfileSetup);

  // Season pass theme. restoreTheme() has already applied the cached value, so
  // this only does anything when it changed on another device.
  applyTheme(profile.equipped_theme);

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

  const isOwner = crew.owner_id === profile.id;

  ctx = {
    crew, profile, rules, isOwner,
    ownerName: isOwner ? 'you' : null,
    unread: 0,                       // suggestions waiting, owner only
    reload: boot,
    goCrewSetup: () => stage((root, next) => renderCrewSetup(root, next, { canCancel: true })),
    bumpBoard: () => { /* views refetch on show, nothing to invalidate */ },
    refreshUnread,
    go: showTab
  };

  hideSplash();
  tabbar.hidden = false;
  drawTabs();
  showTab(currentTab);

  if (isOwner) {
    refreshUnread();
  } else {
    // Only so the suggestion box can say who it's going to.
    api.getProfile(crew.owner_id)
      .then(p => { if (p) ctx.ownerName = p.display_name; })
      .catch(() => { /* cosmetic — the sheet has a fallback */ });
  }

  // Someone opening the app after an update gets the patch notes straight
  // away, once. A brand-new install doesn't — they've not missed anything.
  if (hasUnread() && !primeIfFirstRun()) {
    setTimeout(() => openWhatsNew({ onlyUnread: true }), 700);
  } else if (hasUnread()) {
    markRead();
  }
}

/** Refresh the owner's unread-suggestion badge without redrawing the tab. */
async function refreshUnread() {
  if (!ctx?.isOwner) return;
  try {
    ctx.unread = await api.feedbackUnread(ctx.crew.id) || 0;
  } catch {
    ctx.unread = 0;    // the table might not exist yet on an older database
  }
  drawTabs();
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
  tabbar.innerHTML = TABS.map(t => {
    // The Me tab carries the owner's unread-suggestion count.
    const badge = (t.id === 'me' && ctx?.unread > 0)
      ? `<span class="tab-badge">${ctx.unread > 9 ? '9+' : ctx.unread}</span>` : '';
    return `
    <button class="tab ${t.primary ? 'tab-log' : ''} ${t.id === currentTab ? 'on' : ''}"
            data-tab="${t.id}" aria-label="${t.label}">
      <span class="tab-i">${t.icon}${badge}</span>
      <span class="tab-l">${t.label}</span>
    </button>`;
  }).join('');

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

/* -------------------------------------------------------------------------
   Staying up to date

   An installed PWA that's only backgrounded never re-runs any of this, so
   without an explicit check a phone can sit on old code indefinitely. Three
   things together fix that: don't let the HTTP cache answer for the worker
   script, ask for an update every time the app comes back to the foreground,
   and reload once when a new worker actually takes over.
   ------------------------------------------------------------------------- */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    let reg;
    try {
      reg = await navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' });
    } catch {
      return;   // offline support is a bonus, not a requirement
    }

    const check = () => { if (!document.hidden) reg.update().catch(() => {}); };
    document.addEventListener('visibilitychange', check);
    setInterval(check, 15 * 60 * 1000);

    // On a first-ever install there's no controller yet and the page is
    // already running the newest code — reloading then would be pointless.
    const hadController = !!navigator.serviceWorker.controller;
    let reloading = false;

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadController || reloading) return;
      reloading = true;
      location.reload();
    });
  });
}

restoreTheme();   // before first paint, so there's no flash of the default
boot();
