/* ==========================================================================
   Weekly challenge + the crew's trophy cabinet.
   ========================================================================== */

import * as api from '../api.js';
import {
  $, esc, num, fmtDate, weekStart, todayISO, untilEndOfWeek, MEDALS, sheet, live
} from '../ui.js';

const UNITS = {
  points:      'pts',
  active_days: 'days',
  distance_km: 'km',
  reps:        'reps',
  minutes:     'min'
};

const fmtScore = (metric, v) => {
  const n = Number(v) || 0;
  if (metric === 'distance_km') return `${n.toFixed(1)} ${UNITS[metric]}`;
  return `${num(n)} ${UNITS[metric]}`;
};

export async function render(root, ctx) {
  root.innerHTML = `
    <div class="view">
      <div class="hdr">
        <div class="hdr-txt">
          <h1>Challenges</h1>
          <p>Win the week, keep the title forever</p>
        </div>
      </div>
      <div id="body">
        <div class="skel" style="height:150px"></div>
        <div class="skel"></div><div class="skel"></div>
      </div>
    </div>`;

  const body = $('#body', root);

  try {
    const wk = weekStart(todayISO());
    const [challenge, past, trophies] = await Promise.all([
      api.currentChallenge(ctx.crew.id, wk),
      api.pastChallenges(ctx.crew.id, 6),
      api.trophyCase(ctx.crew.id)
    ]);

    if (!live(body)) return;          // a newer render already took over

    body.innerHTML = `
      ${challenge ? challengeCard(challenge) : noChallenge()}
      <div id="standings">
        ${challenge ? '<div class="skel"></div><div class="skel"></div>' : ''}
      </div>
      ${myTitles(trophies, ctx.profile.id)}
      ${hallOfFame(trophies)}
      ${pastList(past)}`;

    if (challenge) loadStandings(body, challenge, ctx);

    body.querySelectorAll('[data-past]').forEach(el =>
      el.addEventListener('click', () =>
        pastSheet(past.find(p => p.id === el.dataset.past), ctx)));

  } catch (e) {
    if (!live(body)) return;
    body.innerHTML = `<div class="err">${esc(e.message)}</div>
      <button class="btn mt" id="retry">Try again</button>`;
    $('#retry', root)?.addEventListener('click', () => render(root, ctx));
  }
}

/* ------------------------------------------------------------------------- */

function challengeCard(c) {
  return `
    <div class="chal">
      <div class="chal-emoji">${esc(c.emoji)}</div>
      <h2>${esc(c.title)}</h2>
      <p>${esc(c.description || '')}</p>
      <div class="chal-prize">🏅 Winner earns "${esc(c.reward_title)}"</div>
      <div class="chal-clock">⏳ ${untilEndOfWeek()} · week of ${fmtDate(c.week_start)}</div>
    </div>`;
}

function noChallenge() {
  return `
    <div class="empty">
      <div class="empty-em">🎯</div>
      <p><b>No challenge running.</b></p>
      <p>Pull down to refresh — one gets created automatically each Monday.</p>
    </div>`;
}

async function loadStandings(root, challenge, ctx) {
  const host = $('#standings', root);
  try {
    const rows = await api.challengeStandings(challenge.id);
    if (!live(host)) return;
    const scored = rows.filter(r => Number(r.score) > 0);

    if (!scored.length) {
      host.innerHTML = `
        <div class="empty" style="padding:26px">
          <div class="empty-em">🫥</div>
          <p><b>Nobody's on the board.</b></p>
          <p>First one to log something takes the lead.</p>
        </div>`;
      return;
    }

    host.innerHTML = `
      <div class="section-title">Standings</div>
      ${scored.map((r, i) => `
        <div class="row ${r.user_id === ctx.profile.id ? 'row-me' : ''}">
          <div class="row-rank">${i < 3 ? MEDALS[i] : i + 1}</div>
          <div class="row-av">${esc(r.avatar_emoji)}</div>
          <div class="row-main">
            <div class="row-name">${esc(r.display_name)}</div>
            ${i === 0 ? '<div class="row-sub">Currently winning the title</div>' : ''}
          </div>
          <div class="row-pts" style="font-size:.98rem">${fmtScore(challenge.metric, r.score)}</div>
        </div>`).join('')}`;
  } catch (e) {
    if (live(host)) host.innerHTML = `<p class="hint center">${esc(e.message)}</p>`;
  }
}

function myTitles(trophies, myId) {
  const mine = trophies.filter(t => t.user_id === myId);
  if (!mine.length) return '';
  return `
    <div class="section-title">Your titles</div>
    <div class="card">
      ${mine.map(t => `<span class="title-pill">${esc(t.emoji)} ${esc(t.title)}</span>`).join('')}
    </div>`;
}

function hallOfFame(trophies) {
  if (!trophies.length) {
    return `
      <div class="section-title">Hall of fame</div>
      <div class="card center">
        <p class="hint" style="margin:0">
          Empty for now. The first title gets handed out when this week ends.
        </p>
      </div>`;
  }
  return `
    <div class="section-title">Hall of fame</div>
    ${trophies.slice(0, 12).map(t => `
      <div class="trophy">
        <div class="trophy-em">${esc(t.emoji)}</div>
        <div class="row-main">
          <div class="trophy-t">${esc(t.title)}</div>
          <div class="trophy-s">${esc(t.display_name)} · ${esc(t.awarded_for || '')}</div>
        </div>
      </div>`).join('')}`;
}

function pastList(past) {
  if (!past.length) return '';
  return `
    <div class="section-title">Past weeks</div>
    ${past.map(c => `
      <div class="row" data-past="${esc(c.id)}">
        <div class="row-av">${esc(c.emoji)}</div>
        <div class="row-main">
          <div class="row-name">${esc(c.title)}</div>
          <div class="row-sub">Week of ${fmtDate(c.week_start)}</div>
        </div>
        <div style="color:var(--text-faint)">›</div>
      </div>`).join('')}`;
}

async function pastSheet(c, ctx) {
  if (!c) return;
  const s = sheet(`
    <div class="center" style="padding-bottom:8px">
      <div style="font-size:2.4rem">${esc(c.emoji)}</div>
      <h2 style="margin:6px 0 2px">${esc(c.title)}</h2>
      <p class="sub" style="margin:0">Week of ${fmtDate(c.week_start)}</p>
    </div>
    <div id="s"><div class="skel"></div><div class="skel"></div></div>
  `);

  try {
    const rows = (await api.challengeStandings(c.id)).filter(r => Number(r.score) > 0);
    $('#s', s.el).innerHTML = rows.length ? rows.map((r, i) => `
      <div class="row ${r.user_id === ctx.profile.id ? 'row-me' : ''}">
        <div class="row-rank">${i < 3 ? MEDALS[i] : i + 1}</div>
        <div class="row-av">${esc(r.avatar_emoji)}</div>
        <div class="row-main"><div class="row-name">${esc(r.display_name)}</div></div>
        <div class="row-pts" style="font-size:.98rem">${fmtScore(c.metric, r.score)}</div>
      </div>`).join('')
      : '<p class="hint center">Nobody scored that week.</p>';
  } catch (e) {
    $('#s', s.el).innerHTML = `<p class="hint center">${esc(e.message)}</p>`;
  }
}
