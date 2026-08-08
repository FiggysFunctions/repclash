/* ==========================================================================
   The "Me" tab: your numbers, your badges, and the settings.
   ========================================================================== */

import * as api from '../api.js';
import {
  $, esc, num, plural, toastOk, toastBad, todayISO, addDays, fmtDate,
  sheet, confirmSheet, live
} from '../ui.js';
import { activeCrew } from '../config.js';
import { openWhatsNew } from './whatsnew.js';
import { openSubmit, openMine, openInbox } from './feedback.js';
import { progressCard, openPass, openCosmetics } from './pass.js';

/* Badges are derived from stats rather than stored — that way adding a new
   one is a one-line change here and it applies retroactively to everyone. */
const BADGES = [
  { em: '🌱', name: 'First Rep',    desc: 'Log a session',        test: s => s.total_sessions >= 1 },
  { em: '🔟', name: 'Regular',      desc: '10 sessions',          test: s => s.total_sessions >= 10 },
  { em: '💯', name: 'Century',      desc: '100 sessions',         test: s => s.total_sessions >= 100 },
  { em: '🔥', name: 'On Fire',      desc: '7-day streak',         test: s => s.best_streak >= 7 },
  { em: '🌋', name: 'Unstoppable',  desc: '30-day streak',        test: s => s.best_streak >= 30 },
  { em: '🏔️', name: 'Machine',      desc: '100-day streak',       test: s => s.best_streak >= 100 },
  { em: '⭐', name: '1K Club',      desc: '1,000 points',         test: s => s.total_points >= 1000 },
  { em: '🌟', name: '10K Club',     desc: '10,000 points',        test: s => s.total_points >= 10000 },
  { em: '💫', name: '50K Club',     desc: '50,000 points',        test: s => s.total_points >= 50000 },
  { em: '👟', name: 'Marathoner',   desc: '42 km covered',        test: s => s.total_km >= 42 },
  { em: '🛣️', name: 'Centurion',    desc: '100 km covered',       test: s => s.total_km >= 100 },
  { em: '🌍', name: 'Long Hauler',  desc: '500 km covered',       test: s => s.total_km >= 500 },
  { em: '⏱️', name: 'Time Served',  desc: '10 hours logged',      test: s => s.total_minutes >= 600 },
  { em: '🕰️', name: 'Lifer',        desc: '100 hours logged',     test: s => s.total_minutes >= 6000 },
  { em: '📅', name: 'Half Century', desc: '50 active days',       test: s => s.active_days >= 50 },
  { em: '🏆', name: 'Titled',       desc: 'Win a weekly title',   test: (s, t) => t >= 1 },
  { em: '👑', name: 'Collector',    desc: 'Win 5 titles',         test: (s, t) => t >= 5 }
];

export async function render(root, ctx) {
  const { profile, crew } = ctx;

  root.innerHTML = `
    <div class="view">
      <div class="hdr">
        <div class="hdr-txt">
          <h1>${esc(profile.display_name)}</h1>
          <p>${esc(crew.name)}</p>
        </div>
        <button class="icon-btn" id="settings" aria-label="Settings">⚙️</button>
      </div>
      <div class="center" style="font-size:3.6rem;line-height:1;margin-bottom:14px">
        ${esc(profile.avatar_emoji)}
      </div>
      <div id="body">
        <div class="skel" style="height:80px"></div>
        <div class="skel"></div>
      </div>
    </div>`;

  $('#settings', root).addEventListener('click', () => settingsSheet(ctx));

  const body = $('#body', root);
  try {
    const [stats, trophies, pass] = await Promise.all([
      api.memberStats(profile.id),
      api.trophyCase(crew.id),
      api.myPass(crew.id).catch(() => null)   // pass SQL might not be run yet
    ]);
    if (!live(body)) return;          // a newer render already took over
    const myTitles = trophies.filter(t => t.user_id === profile.id);

    body.innerHTML = `
      ${pass ? progressCard(pass) : ''}

      <div class="stats">
        <div class="stat"><div class="stat-n">${num(stats.total_points)}</div><div class="stat-l">Points</div></div>
        <div class="stat"><div class="stat-n">${num(stats.current_streak)}</div><div class="stat-l">Streak</div></div>
        <div class="stat"><div class="stat-n">${num(stats.total_sessions)}</div><div class="stat-l">Sessions</div></div>
      </div>

      ${streakStrip(stats.recent || [])}

      <div class="card mt">
        <div class="kv"><span>Best streak</span><b>${plural(stats.best_streak, 'day')}</b></div>
        <div class="kv"><span>Days active</span><b>${num(stats.active_days)}</b></div>
        <div class="kv"><span>Distance covered</span><b>${Number(stats.total_km).toFixed(1)} km</b></div>
        <div class="kv"><span>Time logged</span><b>${hours(stats.total_minutes)}</b></div>
        <div class="kv"><span>Titles won</span><b>${num(myTitles.length)}</b></div>
        ${stats.first_day ? `<div class="kv"><span>Training since</span>
          <b>${fmtDate(stats.first_day, { day: 'numeric', month: 'short', year: 'numeric' })}</b></div>` : ''}
      </div>

      ${myTitles.length ? `
        <div class="section-title">Titles</div>
        <div class="card">${myTitles.map(t =>
          `<span class="title-pill">${esc(t.emoji)} ${esc(t.title)}</span>`).join('')}</div>` : ''}

      <div class="section-title">Badges · ${BADGES.filter(b => b.test(stats, myTitles.length)).length}/${BADGES.length}</div>
      <div class="ach-grid">
        ${BADGES.map(b => {
          const got = b.test(stats, myTitles.length);
          return `<div class="ach ${got ? 'got' : ''}">
            <div class="ach-em">${b.em}</div>
            <div class="ach-n">${esc(b.name)}</div>
            <div class="ach-d">${esc(b.desc)}</div>
          </div>`;
        }).join('')}
      </div>

      <div class="section-title">Have your say</div>
      ${ctx.isOwner ? `
        <button class="btn ${ctx.unread ? 'btn-primary' : ''}" id="inbox">
          📥 Suggestion box${ctx.unread ? ` · ${ctx.unread} new` : ''}
        </button>
        <button class="btn mt" id="suggest">💡 Suggest something</button>
      ` : `
        <button class="btn btn-primary" id="suggest">💡 Suggest something</button>
        <button class="btn mt" id="mine">📄 What I've suggested</button>
      `}

      <button class="btn mt" id="news">✨ What's new</button>
      <button class="btn mt" id="rules">How scoring works</button>`;

    $('#passcard', root)?.addEventListener('click', () =>
      openPass(ctx, pass, () => render(root, ctx)));

    $('#rules', root).addEventListener('click', () => rulesSheet(ctx));
    $('#news', root).addEventListener('click', () => openWhatsNew());
    $('#suggest', root).addEventListener('click', () =>
      openSubmit(ctx, () => ctx.refreshUnread?.()));
    $('#mine', root)?.addEventListener('click', () => openMine(ctx));
    $('#inbox', root)?.addEventListener('click', () =>
      openInbox(ctx, () => { ctx.refreshUnread?.(); render(root, ctx); }));
  } catch (e) {
    if (live(body)) body.innerHTML = `<div class="err">${esc(e.message)}</div>`;
  }
}

const hours = (mins) => {
  const h = Math.floor((mins || 0) / 60);
  return h >= 1 ? `${num(h)} h ${(mins || 0) % 60} m` : `${num(mins || 0)} min`;
};

/** Last 14 days as a row of pips. */
function streakStrip(recent) {
  const byDay = new Map(recent.map(r => [r.day, r]));
  const days = [];
  for (let i = 13; i >= 0; i--) days.push(addDays(todayISO(), -i));

  return `
    <div class="card mt">
      <h3>Last 14 days</h3>
      <div class="pips">
        ${days.map(iso => {
          const r = byDay.get(iso);
          const on = r?.qualified;
          const today = iso === todayISO();
          return `<div class="pip ${on ? 'on' : ''} ${today ? 'today' : ''}"
                       title="${fmtDate(iso)}${r ? ` · ${num(r.day_points)} pts` : ''}">
                    ${new Date(iso).toLocaleDateString(undefined, { weekday: 'narrow' })}
                  </div>`;
        }).join('')}
      </div>
    </div>`;
}

/* ------------------------------------------------------------------------- */

function rulesSheet(ctx) {
  const r = ctx.rules;
  sheet(`
    <h2>How scoring works</h2>
    <p class="sub">Built so that turning up beats going enormous once a month.</p>

    <div class="card">
      <h3>1 · Effort points</h3>
      <p class="hint" style="margin:0">
        Every exercise is worth points per rep, kilometre or minute. Lifting
        scales with the weight on the bar, up to 3× at 120 kg.
      </p>
    </div>

    <div class="card">
      <h3>2 · Daily cap</h3>
      <p class="hint" style="margin:0">
        Only the first <b>${num(r.daily_effort_cap)}</b> effort points in a day
        count. One monster session can't buy you a week off.
      </p>
    </div>

    <div class="card">
      <h3>3 · Showing up</h3>
      <p class="hint" style="margin:0">
        Any day with <b>${num(r.qualify_threshold)}+</b> effort points counts as
        active and earns a flat <b>+${num(r.session_bonus)}</b>.
      </p>
    </div>

    <div class="card">
      <h3>4 · Streaks</h3>
      <p class="hint" style="margin:0">
        Each consecutive active day adds <b>+${num(r.streak_step)}</b>, up to
        <b>+${num(r.streak_cap)}</b> a day. Miss a day and it resets to zero.
      </p>
    </div>

    <div class="card">
      <h3>5 · Weekly target</h3>
      <p class="hint" style="margin:0">
        Hit <b>${num(r.weekly_target)}</b> active days in a week (Mon–Sun) for a
        <b>+${num(r.weekly_bonus)}</b> bonus. This is the big one.
      </p>
    </div>

    <p class="hint center mt">
      Think the numbers are wrong? Tell Liam — they're one line in the database
      and apply retroactively to everyone.
    </p>
  `);
}

function settingsSheet(ctx) {
  const demo = api.inDemo();

  const s = sheet(`
    <h2>Settings</h2>
    <p class="sub">${demo
      ? 'Demo mode — everything here is fake and lives only on this device.'
      : `Signed in as ${esc(api.currentUser()?.email || '')}`}</p>
    <div class="privacy-row" style="margin-bottom:12px">
      <div>
        <div class="privacy-t">Show my workouts to the crew</div>
        <div class="privacy-s">Sets the default for new sessions. You can still
          flip any individual one.</div>
      </div>
      <button class="switch ${ctx.profile.default_private ? '' : 'on'}" data-defpriv
              role="switch" aria-checked="${!ctx.profile.default_private}"
              aria-label="Show my workouts to the crew"><span></span></button>
    </div>

    <button class="btn" data-look>🎨 Avatar, colours and themes</button>
    <button class="btn mt" data-edit>Change display name</button>
    ${demo ? '' : '<button class="btn mt" data-crews>Switch or join a crew</button>'}
    <button class="btn mt" data-install>How to install this app</button>
    ${demo ? `
      <button class="btn btn-primary mt" data-exit>Set up the real thing</button>
      <button class="btn btn-ghost mt" data-reset>Reset demo data</button>
    ` : `
      <button class="btn btn-ghost mt" data-leave>Leave ${esc(ctx.crew.name)}</button>
      <button class="btn btn-danger mt" data-out>Sign out</button>
    `}
  `);

  $('[data-exit]', s.el)?.addEventListener('click', async () => {
    const ok = await confirmSheet({
      title: 'Leave the demo?',
      body: 'The sample data gets wiped and you go to the setup screen.',
      confirmLabel: 'Leave demo'
    });
    if (!ok) return;
    api.endDemo();
    location.reload();
  });

  $('[data-reset]', s.el)?.addEventListener('click', () => {
    api.endDemo();
    api.startDemo();
    location.reload();
  });

  $('[data-defpriv]', s.el).addEventListener('click', async () => {
    const btn = $('[data-defpriv]', s.el);
    const nextPrivate = !ctx.profile.default_private;
    btn.disabled = true;
    try {
      const updated = await api.updateProfile({ default_private: nextPrivate });
      Object.assign(ctx.profile, updated);
      btn.classList.toggle('on', !nextPrivate);
      btn.setAttribute('aria-checked', String(!nextPrivate));
      toastOk(nextPrivate ? 'New sessions will be private' : 'New sessions will be visible');
    } catch (e) {
      toastBad(e.message);
    } finally {
      btn.disabled = false;
    }
  });

  $('[data-edit]', s.el).addEventListener('click', () => { s.close(); editSheet(ctx); });
  $('[data-look]', s.el).addEventListener('click', () => { s.close(); customise(ctx); });
  $('[data-crews]', s.el)?.addEventListener('click', () => { s.close(); ctx.goCrewSetup(); });
  $('[data-install]', s.el).addEventListener('click', () => { s.close(); installSheet(); });

  $('[data-leave]', s.el)?.addEventListener('click', async () => {
    const ok = await confirmSheet({
      title: `Leave ${ctx.crew.name}?`,
      body: 'Your workouts stay, but you drop off this leaderboard. You can rejoin with the code.',
      confirmLabel: 'Leave crew', danger: true
    });
    if (!ok) return;
    try {
      await api.leaveCrew(ctx.crew.id);
      activeCrew.set(null);
      s.close();
      ctx.reload();
    } catch (e) { toastBad(e.message); }
  });

  $('[data-out]', s.el)?.addEventListener('click', async () => {
    const ok = await confirmSheet({
      title: 'Sign out?', body: 'You\'ll need your email and password to get back in.',
      confirmLabel: 'Sign out', danger: true
    });
    if (!ok) return;
    await api.signOut();
    location.reload();
  });
}

/* Name only. The avatar moved to the pass's Customise sheet, because which
   ones you can pick now depends on what you've unlocked — and that has to be
   checked by the server, not here. */
function editSheet(ctx) {
  const s = sheet(`
    <h2>Change your name</h2>
    <p class="sub">This is what the crew sees on the leaderboard.</p>
    <div class="field">
      <label for="dispname">Display name</label>
      <input class="input" id="dispname" maxlength="24"
             value="${esc(ctx.profile.display_name)}">
    </div>
    <button class="btn btn-primary" data-save>Save</button>
    <button class="btn btn-ghost mt" data-look>🎨 Change avatar and colours instead</button>
  `);

  $('[data-look]', s.el).addEventListener('click', () => { s.close(); customise(ctx); });

  $('[data-save]', s.el).addEventListener('click', async () => {
    const btn = $('[data-save]', s.el);
    const name = $('#dispname', s.el).value.trim();
    if (name.length < 2) return toastBad('Name needs at least 2 characters.');
    btn.disabled = true;
    btn.textContent = 'Saving…';
    try {
      const updated = await api.updateProfile({ display_name: name });
      Object.assign(ctx.profile, updated);
      s.close();
      toastOk('Saved');
      ctx.reload();
    } catch (e) {
      toastBad(e.message);
      btn.disabled = false;
      btn.textContent = 'Save';
    }
  });
}

/** Fetches the pass first, since what's on offer depends on your tier. */
async function customise(ctx) {
  try {
    const pass = await api.myPass(ctx.crew.id);
    openCosmetics(ctx, pass, () => ctx.reload());
  } catch (e) {
    toastBad(e.message);
  }
}

function installSheet() {
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  sheet(`
    <h2>Put RepClash on your home screen</h2>
    <p class="sub">It then opens like a normal app — no browser bar, works offline.</p>
    <div class="card">
      <h3>${ios ? 'iPhone / iPad' : 'Android'}</h3>
      <p class="hint" style="margin:0">
        ${ios
          ? '1. Tap the <b>Share</b> button in Safari (the square with the arrow).<br>' +
            '2. Scroll down and tap <b>Add to Home Screen</b>.<br>' +
            '3. Tap <b>Add</b>. Done.<br><br>' +
            'It has to be Safari — Chrome on iOS can\'t install apps.'
          : '1. Tap the <b>⋮</b> menu in Chrome.<br>' +
            '2. Tap <b>Add to Home screen</b> or <b>Install app</b>.<br>' +
            '3. Confirm. Done.'}
      </p>
    </div>
    <p class="hint center">Send your mates the same link and they do the same thing.</p>
  `);
}
